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


## Equipo de agentes

Tres agentes con roles separados (Claude Code):

| Agente | Fichero | Rol |
|---|---|---|
| Orquestador | [`CLAUDE.md`](CLAUDE.md) (+ [`AGENTS.md`](AGENTS.md) para el estilo) | Recibe la tarea, reparte, hace commit. No programa. |
| Develop | [`.claude/agents/develop.md`](.claude/agents/develop.md) | Subagente que programa siguiendo la estructura real del repo. |
| Testing | [`.claude/agents/testing.md`](.claude/agents/testing.md) | Subagente de solo revisión. Aplica [`docs/agents/DIRECTRICES.md`](docs/agents/DIRECTRICES.md) y ejecuta lint, typecheck, tests y build. |

Ciclo: Orquestador → `develop` → `testing` → si hay fallos (lista numerada con regla `D-xx`), vuelven a `develop` → se repite hasta `PASS` → commit. Máximo 5 rondas. Ejemplo real en [`docs/agents/REGISTRO.md`](docs/agents/REGISTRO.md).

## Prueba

- App: https://doucecreative.douce-cr.workers.dev (pública, sin login de plataforma). Salud: `/api/health`.
- Entrar: botón de acceso en la web, `/login`. Dos vías: código de 6 dígitos por email, o "Entrar con contraseña" (email + contraseña).
- Usuario de prueba: se crea una vez en Supabase (Dashboard > Authentication > Users > Add user, con "Auto Confirm User"). Las credenciales se entregan aparte, no están en el repo.
- Modo demo: todo usuario que inicia sesión es admin (migración `20261122000000_demo_all_admin.sql`), así que el usuario de prueba ve también `/admin`.
- Sin claves en el repo: ver `.env.example`. Secretos de producción con `wrangler secret put`.
