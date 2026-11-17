# DouceCreative — app de citas

Next.js 15 + Tailwind v4 + motion + Supabase (local en Docker). Especificación: `docs/PROMPT_IMPLEMENTACION.md`.

## Local
```bash
npx supabase start        # Postgres + Auth en Docker (aplica supabase/migrations)
npm run dev               # http://localhost:3000
npx supabase db reset     # reinicia BD con seed
npm test                  # huecos (Vitest)
```
Emails de Supabase Auth locales: http://127.0.0.1:54324 (Mailpit). Studio: http://127.0.0.1:54323.
Hacer admin a un usuario:
`docker exec supabase_db_peluqueria psql -U postgres -c "update profiles set role='admin' where id=(select id from auth.users where email='TU@EMAIL')"`

## Estado
Hecho: bienvenida, auth email, reserva 3 pasos, mis citas + cancelar, WhatsApp, perfil (+RGPD), admin, emails (Resend; sin clave se loguean), cron `/api/cron/reminders` (Bearer `CRON_SECRET`), PWA, legales (borrador).
Pendiente: deploy Cloudflare/OpenNext, dominio Resend, GitHub Action de backup, datos reales del negocio.

