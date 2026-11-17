create extension if not exists btree_gist;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'client' check (role in ('client','admin')),
  email_reminders boolean not null default true,
  google_calendar_connected boolean not null default false,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  price_cents int not null,
  duration_min int not null,
  exclusive_group text,
  active boolean not null default true,
  sort int not null default 0
);

create table business_hours (
  id serial primary key,
  weekday smallint not null check (weekday between 1 and 7),
  opens time not null,
  closes time not null,
  check (closes > opens)
);

create table blocked_slots (
  id uuid primary key default gen_random_uuid(),
  during tstzrange not null,
  reason text
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  total_cents int not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','completed','no_show')),
  note text,
  google_event_id text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);
create index on appointments (user_id, starts_at);

create table appointment_services (
  appointment_id uuid references appointments on delete cascade,
  service_id uuid references services,
  price_cents int not null,
  primary key (appointment_id, service_id)
);

create table settings (
  id boolean primary key default true check (id),
  slot_step_min int not null default 15,
  booking_window_days int not null default 30,
  min_notice_min int not null default 60,
  cancel_limit_min int not null default 120,
  reminder_hours_before int not null default 24
);

create table google_tokens (
  user_id uuid primary key references profiles(id) on delete cascade,
  refresh_token_enc text not null,
  updated_at timestamptz not null default now()
);

-- helpers ---------------------------------------------------------------
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- prevent clients from escalating role
create function protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() and auth.uid() is not null then
    new.role := old.role;
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on profiles
  for each row execute function protect_profile_role();

-- RLS ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table services enable row level security;
alter table business_hours enable row level security;
alter table blocked_slots enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table settings enable row level security;
alter table google_tokens enable row level security; -- sin políticas: solo service role

create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid() or is_admin());

create policy services_read on services for select using (true);
create policy services_admin on services for all using (is_admin()) with check (is_admin());
create policy hours_read on business_hours for select using (true);
create policy hours_admin on business_hours for all using (is_admin()) with check (is_admin());
create policy settings_read on settings for select using (true);
create policy settings_admin on settings for all using (is_admin()) with check (is_admin());
create policy blocked_read on blocked_slots for select using (is_admin());
create policy blocked_admin on blocked_slots for all using (is_admin()) with check (is_admin());

create policy appt_read on appointments for select using (user_id = auth.uid() or is_admin());
create policy appt_admin_update on appointments for update using (is_admin());
create policy appt_services_read on appointment_services for select using (
  exists (select 1 from appointments a where a.id = appointment_id and (a.user_id = auth.uid() or is_admin()))
);

-- Rangos ocupados (sin datos personales) ---------------------------------
create function busy_ranges(p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at from appointments a
    where a.status = 'confirmed' and a.starts_at < p_to and a.ends_at > p_from
  union all
  select lower(b.during), upper(b.during) from blocked_slots b
    where b.during && tstzrange(p_from, p_to);
$$;

-- Reserva ------------------------------------------------------------------
create function book_appointment(p_service_ids uuid[], p_starts_at timestamptz, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_set settings%rowtype;
  v_dur int; v_total int; v_n int; v_groups int; v_distinct_groups int;
  v_ends timestamptz; v_id uuid;
  v_local timestamp; v_local_end timestamp;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
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

  begin
    insert into appointments (user_id, starts_at, ends_at, total_cents, note)
    values (v_uid, p_starts_at, v_ends, v_total, nullif(trim(p_note),''))
    returning id into v_id;
  exception when exclusion_violation or deadlock_detected then
    raise exception 'slot_taken';
  end;

  insert into appointment_services (appointment_id, service_id, price_cents)
    select v_id, id, price_cents from services where id = any(p_service_ids);
  return v_id;
end $$;

create function cancel_appointment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype; v_set settings%rowtype;
begin
  select * into a from appointments where id = p_id;
  if not found or (a.user_id <> auth.uid() and not is_admin()) then raise exception 'not_found'; end if;
  if a.status <> 'confirmed' then raise exception 'not_cancellable'; end if;
  select * into v_set from settings;
  if not is_admin() and a.starts_at < now() + make_interval(mins => v_set.cancel_limit_min) then
    raise exception 'too_late';
  end if;
  update appointments set status = 'cancelled' where id = p_id;
end $$;

revoke all on function book_appointment, cancel_appointment from public;
grant execute on function book_appointment, cancel_appointment to authenticated;
grant execute on function busy_ranges to anon, authenticated;

-- Seed (horario PROVISIONAL) -----------------------------------------------
insert into settings default values;
insert into services (slug, name, price_cents, duration_min, exclusive_group, sort) values
  ('corte-completo', 'Corte máquina + tijeras', 1000, 30, 'corte', 1),
  ('maquina',        'Solo máquina',             600, 20, 'corte', 2),
  ('barba',          'Barba',                    300, 15, null,    3),
  ('cejas',          'Cejas',                    100,  5, null,    4);
insert into business_hours (weekday, opens, closes)
  select d, '10:00', '14:00' from generate_series(1,6) d;
insert into business_hours (weekday, opens, closes)
  select d, '16:30', '20:30' from generate_series(1,5) d;
