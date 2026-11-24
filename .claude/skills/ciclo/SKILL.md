---
name: ciclo
description: Ejecuta una tarea con el flujo Orquestador → develop → testing → commit. Úsalo con /ciclo <tarea>.
disable-model-invocation: true
argument-hint: <tarea>
---

Durante este ciclo eres el **Orquestador**. Repartes el trabajo. **No editas código del proyecto**: solo coordinas, lees, escribes `docs/agents/REGISTRO.md` y haces commits.

Tarea: $ARGUMENTS

## Flujo

1. **Alcance.** Escribe en 3-5 líneas: qué se cambia, archivos probables y criterio de aceptación numerado (`CA-1`, `CA-2`...). Cada punto del criterio debe ser comprobable con un test, un comando o una línea de código. Si la tarea es ambigua, pregunta al usuario antes de seguir.
2. **develop.** Delega con el alcance completo, incluido el criterio. En rondas posteriores, envía también la lista de fallos de `testing` tal cual.
   - Ronda 2 en adelante: continúa el mismo agente con `SendMessage` en lugar de lanzar uno nuevo, para que conserve el contexto.
3. **testing.** Envía siempre estas tres cosas:
   - la tarea y el criterio de aceptación;
   - el informe completo de `develop` (archivos, resumen y salida en rojo si es un bug);
   - en rondas posteriores, la lista de fallos de la ronda anterior.

   **Modelo de `testing`.** Mira la lista de `develop` y `git diff --stat`. Lanza `testing` con `model: "opus"` si el cambio toca alguno de estos puntos:

   - login o auth: `app/login/`, `app/auth/`, `lib/loginCode.ts`, `lib/apptAccess.ts`;
   - `middleware.ts` o `lib/adminGuard.ts`;
   - `supabase/migrations/` (RLS);
   - `lib/billing.ts`;
   - `app/api/`;
   - secretos: `.env.example`, `process.env` nuevo, `supabaseService()` nuevo.

   En otro caso, no pases `model`: usa `sonnet` del agente. Si una ronda usa `opus`, las rondas siguientes del ciclo también.
4. `testing` responde `PASS` o una lista numerada de fallos.
   - Fallos: reenvíalos tal cual a `develop` y vuelve al paso 3.
   - `PASS`: sigue al paso 5.
5. **Commit** pequeño, Conventional Commits en español. Incluye solo los archivos de la tarea. Añade la entrada de `docs/agents/REGISTRO.md` en el mismo commit. Indica en la entrada si `testing` usó `opus` y si el e2e se ejecutó o por qué no.
6. **Informe** al usuario: qué cambió, rondas necesarias, resultado final.

Límite: máximo 5 rondas develop↔testing. Si no llega a PASS, para y pregunta al usuario.

## Reglas del ciclo

- Una tarea = un ciclo. No mezcles temas en un commit.
- `testing` es la única autoridad de "terminado". No declares PASS por tu cuenta.
- Registra en `docs/agents/REGISTRO.md` los ciclos con más de una ronda o con notas relevantes.
