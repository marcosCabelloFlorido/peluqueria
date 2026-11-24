# Directrices de código

Contrato entre `develop` y `testing`. `develop` las cumple; `testing` comprueba cada una y cita su número (`D-xx`) al devolver un fallo. Cada regla es verificable.

## Calidad

- **D-01** `npm run lint` termina sin errores ni warnings nuevos.
- **D-02** `npm run typecheck` termina sin errores. TypeScript estricto (`strict: true`).
- **D-03** Sin `any`, `@ts-ignore`, `@ts-expect-error` ni `eslint-disable` nuevos. Comprobar: `git diff -U0 | grep -E "\bany\b|@ts-ignore|eslint-disable"`.
- **D-04** `npm run build` termina bien.
- **D-05** Sin `console.log`, código muerto ni comentarios `TODO` nuevos. `console.error` solo en rutas de error reales.
- **D-06** Los alias usan `@/` (ver `tsconfig.json`). Sin rutas relativas que suban más de un nivel (`../../`).
- **D-07** El cambio se limita a lo pedido: ningún archivo sin relación con la tarea en el diff.

## Estructura

- **D-08** Lógica pura y reutilizable en `lib/`; UI en `components/`; páginas y rutas en `app/`; SQL solo en `supabase/migrations/`.
- **D-09** Todo cambio de esquema es una migración nueva `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`. Nunca se edita una migración ya existente.
- **D-10** Entrada de datos externa (formularios, params, body de API) se valida con `zod` antes de usarla.
- **D-11** Mutaciones desde la UI usan server actions (`"use server"`, como `app/actions.ts`) o rutas en `app/api/`. Las server actions devuelven `{ error: string }` en fallo; no lanzan al cliente mensajes internos.
- **D-12** Textos visibles al usuario en español. Fechas y horas con `lib/time.ts` (zona `Europe/Madrid`), nunca `new Date().toLocaleString()`.

## Seguridad

- **D-13** Sin claves, tokens, contraseñas ni URLs con credenciales en el código, tests, docs ni migraciones. Comprobar: `git diff | grep -iE "sk_(live|test)|re_[A-Za-z0-9]{20}|eyJ[A-Za-z0-9_-]{20}|secret|password *[:=] *['\"]"`.
- **D-14** Los secretos se leen solo de `process.env`. Variable nueva = se añade vacía a `.env.example`. Ningún `.env*` salvo `.env.example` entra en git.
- **D-15** `SUPABASE_SERVICE_ROLE_KEY` y `supabaseService()` solo en servidor (server actions, rutas API, `lib/`). Nunca en archivos `"use client"` ni en variables `NEXT_PUBLIC_*`.
- **D-16** Toda tabla nueva tiene `enable row level security` y políticas explícitas en la misma migración.
- **D-17** Zonas de administración usan `requireAdmin` (`lib/adminGuard.ts`). Rutas protegidas nuevas se añaden al middleware.
- **D-18** Comparar tokens, códigos o hashes con `sameHash`, no con `===`. Los códigos de login se guardan solo como HMAC.
- **D-19** Sin `dangerouslySetInnerHTML` ni HTML construido con datos del usuario sin escapar. Datos del usuario en emails se escapan.
- **D-20** Los errores devueltos al cliente no incluyen stack, SQL ni nombres internos en producción.

## Accesibilidad y UI

- **D-21** Todo `<input>`/`<select>`/`<textarea>` tiene `<label htmlFor>` o `aria-label`.
- **D-22** Botones solo-icono tienen `aria-label`. Imágenes tienen `alt`.
- **D-23** Errores de formulario con `role="alert"`; estados con `role="status"`.
- **D-24** Objetivos táctiles >= 44px (`size-11` o equivalente). Elementos clicables usan `<button>` o `<a>`/`Link`, no `<div onClick>`.
- **D-25** Funciona en móvil: sin ancho fijo en px que fuerce scroll horizontal.
- **D-26** Estilos con tokens de Tailwind y variables de `app/globals.css`; sin colores hex nuevos en línea.

## Tests

- **D-27** Lógica nueva en `lib/` trae test Vitest `lib/<nombre>.test.ts` en el mismo cambio (el runner solo incluye `lib/**/*.test.ts`).
- **D-28** Un bug arreglado trae un test que falla sin el arreglo.
- **D-29** Los tests no llaman a red, Supabase ni Resend reales: se mockean (`vi.mock`). No dependen de la hora actual: fijan `now`.
- **D-30** `npm test` pasa entero. No se borran ni se saltan (`.skip`, `.only`) tests existentes.
- **D-31** Cambio de flujo de reserva o login: el test e2e `e2e/*.spec.ts` se actualiza si afecta a lo cubierto (no se exige ejecutarlo).

## Git y entrega

- **D-32** Sin archivos generados ni artefactos en el diff (`.next/`, `.open-next/`, `test-results/`, `*.tsbuildinfo`).
- **D-33** `develop` no hace commit; lo hace el Orquestador tras PASS.

## Informe de Testing

`PASS` solo si D-01, D-02, D-04 y D-30 pasan y no se viola ninguna otra regla aplicable. Si no: lista numerada `N. archivo:línea — D-xx — cómo arreglar`.
