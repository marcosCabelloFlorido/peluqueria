# Deploy (Cloudflare Workers + Supabase) y credenciales de Google

Estado: `npm run deploy` está preparado (`wrangler.jsonc`, `worker.ts`, `open-next.config.ts`). `npx opennextjs-cloudflare build` y `wrangler deploy --dry-run` pasan. Falta lo que exige tus cuentas.

## 1. Supabase (nube, gratis)
1. Crea proyecto en supabase.com. Copia **Project URL**, **anon key** y **service_role key**.
2. `npx supabase login` y `npx supabase link --project-ref <REF>`.
3. `npx supabase db push` (aplica `supabase/migrations`, incluye seed provisional).
4. Auth, URL Configuration: Site URL = tu dominio `https://<tu-worker>.workers.dev` (o dominio propio); Redirect URLs: `https://<dominio>/auth/callback`.
5. Hazte admin (SQL Editor): `update profiles set role='admin' where id=(select id from auth.users where email='TU@EMAIL');`

## 2. Cloudflare
1. `npx wrangler login`.
2. Crea `.env.production.local` (gana a `.env.local`; solo variables públicas, se incrustan en build):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<REF>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
   NEXT_PUBLIC_SITE_URL=https://<dominio>
   NEXT_PUBLIC_WHATSAPP_PHONE=34XXXXXXXXX
   NEXT_PUBLIC_SHOP_ADDRESS=<dirección>
   ```
3. Secretos (uno a uno, `npx wrangler secret put <NOMBRE>`):
   `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY` (32 bytes base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Variables no secretas para el cron: añade en `wrangler.jsonc` bajo `"vars"`: `{ "SITE_URL": "https://<dominio>" }`; y el secreto `CRON_SECRET` ya vale.
5. `npm run deploy`. El Cron Trigger (cada 15 min) llama a `/api/cron/reminders` y mantiene activa la BD.
6. Comprueba `https://<dominio>/api/health` → `{"ok":true}`.

## 3. Credenciales de Google
1. console.cloud.google.com → proyecto nuevo → **APIs y servicios → Biblioteca**: activar **Google Calendar API**.
2. **Pantalla de consentimiento OAuth**: tipo Externo, modo *Prueba*, añade tu email como usuario de prueba. Scopes: `openid`, `email`, `profile` y `.../auth/calendar.events`. Política de privacidad: `https://<dominio>/privacidad`.
3. **Credenciales → ID de cliente OAuth → Aplicación web**. URIs de redirección autorizadas:
   - `https://<REF>.supabase.co/auth/v1/callback` (login con Google en Supabase nube)
   - `https://<dominio>/api/google/callback` (permiso Calendar)
   - local: `http://127.0.0.1:54321/auth/v1/callback` y `http://localhost:3000/api/google/callback`
4. Copia **Client ID** y **Client secret**:
   - Nube: Supabase → Authentication → Providers → Google → activar y pegar ambos. Además `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
   - Local: `.env.local` y `supabase/.env`; en `supabase/config.toml` `[auth.external.google] enabled = true`; `npx supabase stop && npx supabase start`.
5. Verificación de Google (para salir de "app no verificada" / límite de 100 usuarios): requiere dominio verificado y política publicada. Mientras, sin verificar, funciona con tus usuarios de prueba; sin conectar Calendar siempre queda enlace + .ics.

## 4. Resend (emails)
Verifica tu dominio (SPF, DKIM, DMARC) y pon `EMAIL_FROM="DouceCreative <citas@tudominio.com>"`.

## 5. Backups
GitHub → Settings → Secrets: `SUPABASE_DB_URL` (connection string de Supabase) y `BACKUP_PASSPHRASE`.
