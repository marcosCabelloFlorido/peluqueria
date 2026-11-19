-- Mini CRM: clientes por email (los invitados no tienen cuenta), notas, fotos y reactivación por email.

-- Ajustes de la reactivación automática -----------------------------------
alter table settings
  add column winback_enabled boolean not null default true,
  add column winback_days int not null default 30 check (winback_days between 7 and 730),
  add column winback_offer text not null default '10% de descuento en tu próximo corte';

-- Clientes ----------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  user_id uuid references profiles(id) on delete set null,
  full_name text not null default '',
  phone text,
  birthday date,
  notes text not null default '',
  marketing_opt_out boolean not null default false,
  last_winback_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_user_idx on clients (user_id);

create function clients_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger clients_touch before update on clients
  for each row execute function clients_touch();

alter table appointments add column client_id uuid references clients(id) on delete set null;
create index appointments_client_idx on appointments (client_id, starts_at desc);

-- Relleno: un cliente por email (contact_email o, si no hay, el de la cuenta), con el nombre/teléfono más reciente.
with src as (
  select a.id, a.starts_at, a.user_id,
         lower(trim(coalesce(nullif(trim(a.contact_email), ''), u.email))) as email,
         coalesce(nullif(trim(a.contact_name), ''), nullif(trim(p.full_name), ''), '') as name,
         coalesce(nullif(trim(a.contact_phone), ''), nullif(trim(p.phone), '')) as phone
  from appointments a
  left join profiles p on p.id = a.user_id
  left join auth.users u on u.id = a.user_id
), latest as (
  select distinct on (email) email, name, phone
  from src where email is not null and email <> ''
  order by email, starts_at desc
)
insert into clients (email, user_id, full_name, phone)
select l.email,
       (select s.user_id from src s where s.email = l.email and s.user_id is not null order by s.starts_at desc limit 1),
       l.name, l.phone
from latest l;

update appointments a set client_id = c.id
from clients c
where c.email = lower(trim(coalesce(nullif(trim(a.contact_email), ''), (select u.email from auth.users u where u.id = a.user_id))));

-- Fotos -------------------------------------------------------------------
create table client_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  path text not null,
  caption text,
  taken_at timestamptz not null default now(),
  appointment_id uuid references appointments(id) on delete set null
);
create index client_photos_client_idx on client_photos (client_id, taken_at desc);

-- RLS: solo administradores --------------------------------------------------
alter table clients enable row level security;
alter table client_photos enable row level security;
create policy clients_admin on clients for all using (is_admin()) with check (is_admin());
create policy client_photos_admin on client_photos for all using (is_admin()) with check (is_admin());

-- Almacén privado de fotos (se muestran con URLs firmadas generadas en el servidor).
insert into storage.buckets (id, name, public) values ('client-photos', 'client-photos', false)
on conflict (id) do nothing;

create policy client_photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'client-photos' and public.is_admin());
create policy client_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-photos' and public.is_admin());
create policy client_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-photos' and public.is_admin());

-- Estadísticas por cliente (respeta RLS del que consulta: solo admin ve filas) --
create view client_stats with (security_invoker = true) as
select c.id, c.email, c.full_name, c.phone, c.user_id, c.birthday, c.marketing_opt_out,
       c.last_winback_sent_at, c.created_at,
       count(a.id) filter (where a.status = 'completed') as visits,
       coalesce(sum(a.total_cents) filter (where a.status = 'completed'), 0)::bigint as total_cents,
       min(a.starts_at) filter (where a.status = 'completed') as first_visit,
       max(a.starts_at) filter (where a.status = 'completed') as last_visit,
       min(a.starts_at) filter (where a.status = 'confirmed' and a.starts_at > now()) as next_appt,
       -- true si aún no se le ha avisado en este episodio de inactividad
       coalesce(c.last_winback_sent_at < max(a.starts_at) filter (where a.status = 'completed'), true) as winback_due
from clients c
left join appointments a on a.client_id = c.id
group by c.id;
revoke all on client_stats from anon;
grant select on client_stats to authenticated, service_role;

-- Reserva: igual que antes + alta/actualización del cliente por email ---------
create or replace function book_appointment(
  p_user_id uuid, p_name text, p_phone text, p_email text,
  p_service_ids uuid[], p_starts_at timestamptz, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_set settings%rowtype;
  v_dur int; v_total int; v_n int; v_groups int; v_distinct_groups int;
  v_ends timestamptz; v_id uuid; v_client uuid;
  v_local timestamp; v_local_end timestamp;
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_phone),'') = '' or coalesce(trim(p_email),'') = '' then
    raise exception 'invalid_contact';
  end if;
  select * into v_set from settings;

  select count(*), coalesce(sum(duration_min),0), coalesce(sum(price_cents),0),
         count(exclusive_group), count(distinct exclusive_group)
    into v_n, v_dur, v_total, v_groups, v_distinct_groups
    from services where id = any(p_service_ids) and active;
  if v_n = 0 or v_n <> cardinality(p_service_ids) then raise exception 'invalid_services'; end if;
  if v_groups <> v_distinct_groups then raise exception 'exclusive_services'; end if;

  v_ends := p_starts_at + make_interval(mins => v_dur);
  if p_starts_at < now() + make_interval(mins => v_set.min_notice_min) then raise exception 'too_soon'; end if;
  if p_starts_at > now() + make_interval(days => v_set.booking_window_days + 1) then raise exception 'too_far'; end if;

  v_local := p_starts_at at time zone 'Europe/Madrid';
  v_local_end := v_ends at time zone 'Europe/Madrid';
  if not exists (
    select 1 from business_hours h
    where h.weekday = extract(isodow from v_local)
      and v_local::time >= h.opens and v_local_end::time <= h.closes
      and v_local::date = v_local_end::date
  ) then raise exception 'outside_hours'; end if;

  if exists (select 1 from blocked_slots where during && tstzrange(p_starts_at, v_ends)) then
    raise exception 'slot_taken';
  end if;

  -- Cliente por email: crea o actualiza nombre/teléfono/cuenta (si la reserva trae sesión).
  insert into clients (email, user_id, full_name, phone)
  values (lower(trim(p_email)), p_user_id, trim(p_name), trim(p_phone))
  on conflict (email) do update set
    full_name = coalesce(nullif(excluded.full_name, ''), clients.full_name),
    phone = coalesce(nullif(excluded.phone, ''), clients.phone),
    user_id = coalesce(excluded.user_id, clients.user_id)
  returning id into v_client;

  begin
    insert into appointments (user_id, client_id, contact_name, contact_phone, contact_email, starts_at, ends_at, total_cents, note)
    values (p_user_id, v_client, trim(p_name), trim(p_phone), lower(trim(p_email)), p_starts_at, v_ends, v_total, nullif(trim(p_note),''))
    returning id into v_id;
  exception when exclusion_violation or deadlock_detected then
    raise exception 'slot_taken';
  end;

  insert into appointment_services (appointment_id, service_id, price_cents)
    select v_id, id, price_cents from services where id = any(p_service_ids);
  return v_id;
end $$;

revoke all on function book_appointment(uuid, text, text, text, uuid[], timestamptz, text) from public, anon, authenticated;
grant execute on function book_appointment(uuid, text, text, text, uuid[], timestamptz, text) to service_role;
