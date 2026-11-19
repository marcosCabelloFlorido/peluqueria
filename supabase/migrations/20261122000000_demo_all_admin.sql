-- MODO DEMO: todo usuario que inicia sesión es admin y accede al panel de peluquero.
-- Revertir: restaurar handle_new_user de 20261117000000_init.sql y bajar roles a 'client'.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'phone',
    'admin'
  );
  return new;
end $$;

-- Usuarios ya existentes también pasan a admin.
update profiles set role = 'admin' where role <> 'admin';
