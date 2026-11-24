# Registro de ciclos

## 1. Tests para `lib/loginCode.ts`

- Tarea: el login por código no tenía tests (D-27). Añadir `lib/loginCode.test.ts`.
- Ronda 1, `develop`: crea el test (11 casos: normEmail, newCode, hashCode, sameHash). Lint, typecheck y test en verde.
- Ronda 1, `testing`: PASS. Sin fallos de directrices. D-27, D-29, D-13, D-03, D-05, D-06, D-30, D-32 cumplen.
  - Nota de entorno: `npm run lint` falla solo por `docs/marketing/shot.cjs` (archivo sin seguimiento, fuera de git, ajeno a la tarea). `npx eslint app lib components e2e middleware.ts` limpio.
  - Nota menor: el test deja `TOKEN_ENCRYPTION_KEY` en `process.env` sin restaurar. Vitest aísla por archivo, sin efecto.
- Resultado: PASS en 1 ronda. typecheck ok, 47 tests ok, build ok. Commit por el Orquestador.
