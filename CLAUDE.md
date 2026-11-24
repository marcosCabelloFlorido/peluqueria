# DouceCreative

@AGENTS.md

Proyecto DouceCreative: Next.js 15 + Supabase + Resend, desplegado en Cloudflare Workers.

## Equipo de agentes

El flujo con agentes es opcional. Se activa con `/ciclo <tarea>` (`.claude/skills/ciclo/SKILL.md`). Sin `/ciclo`, la sesión trabaja de forma normal.

| Agente | Fichero | Función |
|---|---|---|
| Orquestador | `.claude/skills/ciclo/SKILL.md` | Recibe la tarea, delega, decide cuándo se cierra |
| `develop` | `.claude/agents/develop.md` | Programa los cambios |
| `testing` | `.claude/agents/testing.md` | Revisa contra el criterio de aceptación y `docs/agents/DIRECTRICES.md`; devuelve PASS o fallos |

## Reglas para cualquier sesión

- Nunca `git push`, nunca `npm run deploy`, nunca tocar Supabase de producción sin orden explícita del usuario. `.claude/settings.json` bloquea push y deploy.
- Nunca commitear secretos ni `.env*` (salvo `.env.example`).
- No commitear carpetas sin seguimiento ajenas a la tarea (`.hallmark/`, `diseno-*`, `docs/marketing/`).
- Código nuevo cumple `docs/agents/DIRECTRICES.md`.
