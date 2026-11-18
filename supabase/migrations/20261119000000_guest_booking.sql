-- Reserva sin cuenta: la cita guarda los datos de contacto; user_id pasa a ser opcional.
alter table appointments alter column user_id drop not null;
alter table appointments
  add column contact_name text,
  add column contact_phone text,
  add column contact_email text;

-- Corrige cancel_appointment: con user_id nulo la comparación `<>` daba NULL y dejaba cancelar a cualquiera.
create or replace function cancel_appointment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype; v_set settings%rowtype;
begin
  select * into a from appointments where id = p_id;
  if not found or (a.user_id is distinct from auth.uid() and not is_admin()) then raise exception 'not_found'; end if;
  if a.status <> 'confirmed' then raise exception 'not_cancellable'; end if;
  select * into v_set from settings;
  if not is_admin() and a.starts_at < now() + make_interval(mins => v_set.cancel_limit_min) then
    raise exception 'too_late';
  end if;
  update appointments set status = 'cancelled' where id = p_id;
end $$;

-- Nueva reserva: solo la llama el servidor (service role) tras validar y leer la sesión opcional.
drop function book_appointment(uuid[], timestamptz, text);

create function book_appointment(
  p_user_id uuid, p_name text, p_phone text, p_email text,
  p_service_ids uuid[], p_starts_at timestamptz, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_set settings%rowtype;
  v_dur int; v_total int; v_n int; v_groups int; v_distinct_groups int;
  v_ends timestamptz; v_id uuid;
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

  begin
    insert into appointments (user_id, contact_name, contact_phone, contact_email, starts_at, ends_at, total_cents, note)
    values (p_user_id, trim(p_name), trim(p_phone), lower(trim(p_email)), p_starts_at, v_ends, v_total, nullif(trim(p_note),''))
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
