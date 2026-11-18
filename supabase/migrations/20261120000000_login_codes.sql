-- Códigos de acceso por email (los genera y envía la app, no Supabase Auth).
-- Solo el servidor (service role) lee y escribe: RLS activa y sin políticas.
create table login_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now()
);
alter table login_codes enable row level security;
