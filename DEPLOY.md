# Deploy (Cloudflare Workers + Supabase)

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
   `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY` (32 bytes base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`.
4. Variables no secretas para el cron: añade en `wrangler.jsonc` bajo `"vars"`: `{ "SITE_URL": "https://<dominio>" }`; y el secreto `CRON_SECRET` ya vale.
5. `npm run deploy`. El Cron Trigger (cada 15 min) llama a `/api/cron/reminders` y mantiene activa la BD.
6. Comprueba `https://<dominio>/api/health` → `{"ok":true}`.

## 4. Resend (emails)
Verifica tu dominio (SPF, DKIM, DMARC) y pon `EMAIL_FROM="DouceCreative <citas@tudominio.com>"`.

## 5. Backups
GitHub → Settings → Secrets: `SUPABASE_DB_URL` (connection string de Supabase) y `BACKUP_PASSPHRASE`.
