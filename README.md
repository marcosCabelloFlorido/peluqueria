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
Hecho: bienvenida, auth email, reserva 3 pasos, mis citas + cancelar, WhatsApp, perfil (+RGPD), admin, emails (Resend; sin clave se loguean), cron `/api/cron/reminders` (Bearer `CRON_SECRET`), .ics + enlace Google Calendar, PWA, legales (borrador).
Google OAuth + Calendar implementado (falta probar con credenciales reales). Pendiente: deploy Cloudflare/OpenNext, dominio Resend, GitHub Action de backup, datos reales del negocio.

## Google (login + Calendar)
1. Google Cloud Console → proyecto → pantalla de consentimiento OAuth (externa, modo pruebas; añade tu email como usuario de prueba) → activar **Google Calendar API**.
2. Credenciales → ID de cliente OAuth (web). URIs de redirección autorizadas:
   - `http://127.0.0.1:54321/auth/v1/callback` (login, vía Supabase local)
   - `http://localhost:3000/api/google/callback` (permiso Calendar)
3. `.env.local`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`TOKEN_ENCRYPTION_KEY` ya generado).
4. `supabase/.env` con las mismas dos variables; en `supabase/config.toml` poner `[auth.external.google] enabled = true`; `npx supabase stop && npx supabase start`.
5. Login pide solo `openid email profile`. Calendar se pide después (Perfil → Conectar, o paso 3 de la reserva). Refresh token cifrado (AES-GCM) en `google_tokens`, solo service role.
