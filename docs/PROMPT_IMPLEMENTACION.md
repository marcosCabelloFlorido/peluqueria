# Prompt de implementación — DouceCreative (app de citas de peluquería)

> Copia todo este documento y pásaselo al modelo que va a implementar la app.

---

## 0. Rol y forma de trabajar

Eres un ingeniero frontend/full-stack senior con criterio de diseño de producto premium. Vas a construir desde cero una web app móvil (PWA) de reserva de citas para la barbería/peluquería **DouceCreative**.

Antes de escribir código, carga y aplica estas skills durante TODO el proyecto:

| Skill | Para qué se usa aquí | Instalación (Claude Code) |
|---|---|---|
| **ponytail** (DietrichGebert/ponytail) | Escribir el mínimo código posible: reutilizar plataforma nativa, librerías ya elegidas y stdlib antes de crear abstracciones nuevas. | `npx -y skills add DietrichGebert/ponytail --skill ponytail --agent claude-code` o `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail` |
| **graphify** | Mantener un grafo de conocimiento del código (`graphify-out/`) para orientarte en el repo y responder dudas de arquitectura sin releer todo. Regenéralo al cerrar cada fase. | Ya instalada globalmente en `~/.claude/skills/graphify` (comando `/graphify`). |
| **taste-skill** (Leonxlnx/taste-skill → `design-taste-frontend`) | Criterio estético anti-"plantilla": tipografía, espaciado, ritmo, motion. | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| **impeccable** (pbakaus/impeccable) | Pulido y auditoría de UI. Ejecuta `/impeccable teach` al inicio con el contexto de marca de la sección 2, y `/audit` + `/polish` al final de cada pantalla. | `npx -y skills add pbakaus/impeccable --skill impeccable --agent claude-code` |
| **modern-web-guidance** (GoogleChrome/modern-web-guidance) | Usar APIs web modernas (View Transitions, `:has()`, container queries, `dvh`, `popover`, `inert`, etc.) en lugar de hacks antiguos; rendimiento, accesibilidad y seguridad. | `npx skills add GoogleChrome/modern-web-guidance` |

Reglas de trabajo:
- Trabaja por fases (sección 9). Al acabar cada fase: la app compila, pasa lint/typecheck y se ve bien a 375 px de ancho.
- No añadas funcionalidades que no estén en este documento. Si algo es ambiguo, elige la opción más simple y déjalo anotado en `DECISIONES.md`.
- Todo el texto visible de la app en **español**.
- Nunca subas secretos al repo. Usa `.env.local` + `.env.example` con las claves vacías.

---

## 1. Producto

App móvil (mobile-first, instalable como PWA) para que los clientes de DouceCreative:
1. Inicien sesión (Google o email/contraseña).
2. Elijan uno o varios servicios.
3. Escojan día en un calendario y hora disponible.
4. Confirmen la cita, reciban email de confirmación y recordatorio.
5. Vean y cancelen sus citas.
6. Sincronicen la cita con Google Calendar (si entraron con Google).
7. Hablen con el peluquero por WhatsApp.

Más un panel mínimo para el peluquero (rol `admin`) donde ve las citas del día/semana y bloquea días u horas.

---

## 2. Marca y dirección de diseño

- **Nombre:** DouceCreative (escrito así, una palabra, "C" mayúscula).
- **Paleta estricta:** blanco y negro. Permitidos solo tonos de gris neutros derivados para estados (bordes, texto secundario, deshabilitado). Ningún color de acento.
  - Tokens sugeridos: `--ink: #0A0A0A`, `--paper: #FFFFFF`, `--gray-1: #F4F4F4`, `--gray-2: #E5E5E5`, `--gray-3: #A3A3A3`, `--gray-4: #525252`.
  - Errores: no uses rojo; usa negro con icono y texto claro. (Si la auditoría de accesibilidad lo exige, se permite un único rojo oscuro solo para errores de formulario; anótalo en `DECISIONES.md`.)
- **Estilo:** premium minimalista. Mucho aire, jerarquía tipográfica fuerte, bordes finos (1 px), radios contenidos (12–16 px en tarjetas, botones pill opcionales), sin sombras pesadas, sin gradientes de color.
- **Tipografía:** una display con carácter para titulares (p. ej. "Fraunces", "Instrument Serif" o una grotesca condensada) + una sans neutra para UI ("Inter", "Geist"). Cárgalas con `next/font` (self-hosted, sin CLS).
- **Jerarquía de botones (requisito clave):**
  - **Primario (acción que avanza el flujo):** fondo negro sólido, texto blanco, altura ≥ 52 px, ancho completo en móvil, fijo en la parte inferior (sticky bottom bar con safe-area). Micro-interacción al pulsar (scale 0.97) y flecha que se desplaza ligeramente en hover/focus. Solo UN primario por pantalla.
  - **Secundario:** borde negro 1 px, fondo transparente.
  - **Terciario/enlace:** solo texto subrayado o gris.
  - El usuario debe saber siempre cuál es el siguiente paso sin pensar.
- **Navegación:** barra inferior con 3 pestañas máximo: **Reservar**, **Mis citas**, **Perfil**. Botón flotante o fila fija de WhatsApp accesible desde Reservar y Mis citas.
- **Animaciones (suaves y fluidas):**
  - Librería: `motion` (antes Framer Motion) para gestos y layout; CSS/View Transitions API para cambios de ruta cuando sea suficiente.
  - Curvas: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expo) para entradas; duraciones 200–450 ms; springs suaves (stiffness ~260, damping ~30) para elementos táctiles.
  - Transiciones entre pasos del flujo de reserva con deslizamiento horizontal + fade.
  - Aparición escalonada (stagger 40–60 ms) de las horas disponibles al seleccionar día.
  - Animación de "layout" en la selección de día (el indicador negro se desliza al nuevo día con `layoutId`).
  - Skeletons en lugar de spinners.
  - Animar solo `transform` y `opacity`. Respetar `prefers-reduced-motion` (desactivar desplazamientos, mantener fades cortos).

---

## 3. Pantallas

### 3.1 Bienvenida (splash / onboarding)
- Pantalla completa negra. Animación de entrada del logotipo "DouceCreative": revelado letra a letra (mask + translateY) o trazo de tijeras SVG que se dibuja (`stroke-dashoffset`) y se transforma en el logotipo. Duración total ≤ 2,2 s.
- Después, el fondo pasa de negro a blanco con una transición de cortinilla y aparecen: claim corto ("Tu estilo, a tu hora." o similar), botón primario **"Reservar cita"** y enlace secundario **"Ya tengo cuenta"**.
- Se muestra completa solo la primera visita (flag en `localStorage`); en visitas posteriores, versión abreviada (< 600 ms) o directa a la app si hay sesión.

### 3.2 Login / Registro
- Botón **"Continuar con Google"** (estilo secundario, con logo G en monocromo permitido por las guías de marca de Google: usa la variante neutra oficial).
- Separador "o".
- Email + contraseña, con pestañas Entrar / Crear cuenta. Recuperar contraseña por email.
- Registro manual pide: nombre, email, teléfono (opcional, útil para el peluquero), contraseña.
- Si el usuario llega desde "Reservar cita" sin sesión, puede elegir servicios y hora primero, y el login se pide justo antes de confirmar (no perder lo seleccionado).

### 3.3 Reservar (flujo en 3 pasos con indicador de progreso)
**Paso 1 — Servicios** (selección múltiple, tarjetas grandes táctiles):

| Servicio | Precio | Duración por defecto* |
|---|---|---|
| Corte máquina + tijeras | 10 € | 30 min |
| Solo máquina | 6 € | 20 min |
| Barba | 3 € | 15 min |
| Cejas | 1 € | 5 min |

\*Duraciones configurables desde BD; son valores iniciales.
- "Corte máquina + tijeras" y "Solo máquina" son excluyentes entre sí.
- Barra inferior fija con total (€) y duración total, y botón primario **"Elegir fecha"** (deshabilitado hasta elegir al menos uno).

**Paso 2 — Fecha y hora:**
- Calendario mensual propio (no un datepicker genérico), semana empezando en lunes, días pasados y días cerrados atenuados y no seleccionables, hoy marcado con un punto.
- Navegación entre meses con swipe y flechas. Ventana de reserva: hoy + 30 días (configurable).
- Al tocar un día: debajo aparecen las **horas disponibles** en una rejilla de chips (stagger animation). Si no hay huecos: mensaje vacío elegante + sugerencia del siguiente día con huecos.
- Las horas se calculan en servidor según: horario del negocio, duración total de los servicios elegidos, citas existentes, bloqueos del peluquero y margen mínimo de antelación (p. ej. 60 min).
- Botón primario **"Continuar"**.

**Paso 3 — Confirmar:**
- Resumen: servicios, total, fecha, hora, duración.
- Campo opcional "Nota para el peluquero".
- Checkbox (marcado por defecto si hay login con Google y permiso concedido) **"Añadir a mi Google Calendar"**.
- Botón primario **"Confirmar cita"**.
- Pantalla de éxito con animación (check que se dibuja), botones: **"Añadir al calendario"** (Google / .ics), **"Ver mis citas"**, y enlace a WhatsApp.

### 3.4 Mis citas
- Pestañas **Próximas** / **Historial**.
- Tarjeta por cita: fecha grande, hora, servicios, total, estado (confirmada / cancelada / completada).
- Acciones: **Cancelar** (hasta X horas antes, configurable, por defecto 2 h; confirmación con bottom sheet), **Añadir a calendario**, **Escribir por WhatsApp** (mensaje precargado con fecha y hora de la cita).
- Botón primario **"Reservar otra cita"** cuando no haya próximas.

### 3.5 Perfil
- Nombre, email, teléfono editable.
- Estado de conexión con Google Calendar (conectar / desconectar).
- Preferencia de recordatorio por email (on/off).
- Cerrar sesión. Eliminar cuenta (requisito RGPD).
- Enlaces a política de privacidad y aviso legal.

### 3.6 WhatsApp
- Enlace `https://wa.me/<TELEFONO_E164_SIN_+>?text=<mensaje url-encoded>`. Número en variable de entorno `NEXT_PUBLIC_WHATSAPP_PHONE`.
- Mensaje por defecto: "Hola, te escribo desde la app de DouceCreative." Con cita: "Hola, tengo cita el {fecha} a las {hora}…".

### 3.7 Panel peluquero (`/admin`, solo rol `admin`)
- Vista día y semana de citas (lista, no calendario complejo).
- Marcar cita como completada / no presentado / cancelar.
- Bloquear días completos o franjas (vacaciones, descansos).
- Editar horario semanal, duraciones y precios de servicios.
- Nada más. Sin estadísticas ni pagos.

---

## 4. Stack (100 % gratuito y fiable)

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | SSR/SSG, server actions, ecosistema enorme. |
| Estilos | **Tailwind CSS v4** con tokens en CSS variables | Rápido, consistente, fácil de mantener blanco/negro. |
| Animación | **motion** (`motion/react`) + View Transitions API | Gestos, layout animations, springs. |
| Componentes accesibles | **Radix UI primitives** (Dialog, Tabs) o **vaul** para bottom sheets | Accesibilidad sin estilo impuesto. |
| Fechas | **date-fns** + `date-fns-tz` con zona `Europe/Madrid` | Ligero, sin sorpresas de zona horaria. |
| Validación | **zod** | Validar en cliente y servidor con el mismo esquema. |
| BD + Auth | **Supabase** (Postgres + Auth con Google y email/contraseña + Row Level Security) | Plan gratuito con Postgres real, backups, auth incluida. |
| Emails | **Resend** + **React Email** | Plan gratuito 3.000 emails/mes (100/día), muy buena entregabilidad. |
| Hosting | **Cloudflare Workers** con **OpenNext** (`@opennextjs/cloudflare`) | Plan gratuito que **sí permite uso comercial**, CDN global, sin "cold starts" relevantes. |
| Tareas programadas | **Cloudflare Cron Triggers** (cada 15 min) | Gratis; envía recordatorios y mantiene Supabase activo. |
| Google Calendar | Google Calendar API v3 (scope `calendar.events`) | Insertar/borrar eventos en el calendario del usuario. |
| PWA | Manifest + service worker mínimo (Serwist o manual) | Instalable en el móvil, icono en pantalla de inicio. |
| Calidad | ESLint, Prettier, Vitest (lógica de huecos), Playwright (flujo de reserva en móvil) | Evitar regresiones en lo crítico. |

### Notas de fiabilidad (implementar sí o sí)
1. **Supabase pausa proyectos gratuitos tras 7 días sin actividad.** El Cron Trigger de recordatorios consulta la BD cada 15 min, lo que lo mantiene activo. Añade además un endpoint `/api/health` que haga un `select 1`.
2. **Copias de seguridad:** el plan gratuito no garantiza backups descargables. Crea un GitHub Action semanal que ejecute `pg_dump` (con la connection string en secretos del repo) y guarde el dump como artefacto cifrado.
3. **Doble reserva imposible a nivel de BD:** usar restricción de exclusión con `tstzrange` (ver sección 5). La UI no es la fuente de verdad.
4. **Vercel Hobby no permite uso comercial**; por eso se elige Cloudflare. Si se prefiere Vercel, pasar a plan Pro.
5. **Google OAuth:** el scope `calendar.events` es "sensible". Hasta que Google verifique la app, aparece una pantalla de "app no verificada" y hay límite de 100 usuarios. Por eso:
   - El login con Google pide solo `openid email profile`.
   - El permiso de Calendar se pide **de forma incremental** solo cuando el usuario activa "Añadir a mi Google Calendar".
   - Siempre existe la alternativa sin permisos: enlace "Añadir a Google Calendar" (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...`) y descarga `.ics`. Así funciona aunque la verificación no esté hecha.
   - Iniciar el proceso de verificación de Google (requiere política de privacidad publicada y dominio verificado).
6. **Emails:** verificar dominio propio en Resend (SPF, DKIM, DMARC) para no caer en spam.
7. **Zona horaria:** guardar todo en UTC (`timestamptz`), mostrar siempre en `Europe/Madrid`.

---

## 5. Modelo de datos (Supabase / Postgres)

```sql
create extension if not exists btree_gist;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('client','admin')),
  email_reminders boolean not null default true,
  google_calendar_connected boolean not null default false,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- 'corte-completo','maquina','barba','cejas'
  name text not null,
  price_cents int not null,
  duration_min int not null,
  exclusive_group text,                -- 'corte' para los dos cortes excluyentes
  active boolean not null default true,
  sort int not null default 0
);

create table business_hours (          -- horario semanal, permite turnos partidos
  id serial primary key,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = lunes
  opens time not null,
  closes time not null
);

create table blocked_slots (           -- vacaciones, descansos
  id uuid primary key default gen_random_uuid(),
  during tstzrange not null,
  reason text
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  total_cents int not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','completed','no_show')),
  note text,
  google_event_id text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

create table appointment_services (
  appointment_id uuid references appointments on delete cascade,
  service_id uuid references services,
  price_cents int not null,            -- precio congelado en el momento de reservar
  primary key (appointment_id, service_id)
);

create table settings (                -- fila única
  id boolean primary key default true check (id),
  slot_step_min int not null default 15,
  booking_window_days int not null default 30,
  min_notice_min int not null default 60,
  cancel_limit_min int not null default 120,
  reminder_hours_before int not null default 24
);
```

- **RLS activado en todas las tablas.** Cliente: lee/edita su `profile`, lee `services`/`business_hours`/`settings`, lee sus `appointments` y solo puede cancelar las suyas. Admin: acceso completo. Los inserts de citas se hacen vía una función `book_appointment(...)` `security definer` que valida servicios, calcula `ends_at` y precio en servidor (nunca confiar en el cliente).
- Tokens de Google (refresh token) **cifrados** en una tabla `google_tokens` accesible solo con service role, nunca expuesta al cliente.
- Seed con los 4 servicios y un horario de ejemplo (L–V 10:00–14:00 y 16:30–20:30, S 10:00–14:00) marcado como provisional.

---

## 6. Lógica de huecos disponibles

Función de servidor `getAvailableSlots(date, totalDurationMin)`:
1. Obtener franjas de `business_hours` del día de la semana.
2. Generar inicios cada `slot_step_min` donde `inicio + duración ≤ cierre`.
3. Excluir solapes con citas `confirmed` y `blocked_slots`.
4. Excluir inicios anteriores a `ahora + min_notice_min`.
5. Devolver en hora local `Europe/Madrid`.

Cubrir con tests unitarios (Vitest): día cerrado, turno partido, servicio que no cabe al final de franja, solape parcial, cambio de horario verano/invierno.

Endpoint adicional para el calendario: `getMonthAvailability(month, duration)` que devuelve qué días tienen al menos un hueco (para atenuar días llenos).

---

## 7. Emails (Resend + React Email)

Plantillas en blanco y negro, coherentes con la app:
1. **Confirmación** al reservar (con botón "Añadir a Google Calendar" + adjunto `.ics`).
2. **Recordatorio** `reminder_hours_before` horas antes (por defecto 24 h). Opcional segundo recordatorio 2 h antes si no supera el límite de envío.
3. **Cancelación** (al cliente y aviso al peluquero).
4. **Aviso al peluquero** de nueva cita (email a `ADMIN_EMAIL`).

Recordatorios: el Cron Trigger cada 15 min busca citas `confirmed` con `starts_at` dentro de la ventana y `reminder_sent_at is null`, envía y marca. Idempotente (usar `update ... where reminder_sent_at is null returning`) para no duplicar envíos.

---

## 8. Google Calendar

- Al conectar: OAuth con `access_type=offline`, `prompt=consent`, scope `https://www.googleapis.com/auth/calendar.events`. Guardar refresh token cifrado.
- Al confirmar cita con la opción activa: `events.insert` en el calendario `primary` con título "DouceCreative — {servicios}", ubicación del local, recordatorio popup 60 min. Guardar `google_event_id`.
- Al cancelar: `events.delete`.
- Si falla Google, la cita **se guarda igualmente** y se muestra aviso discreto + enlace manual. La reserva nunca depende de Google.

---

## 9. Fases de entrega

1. **Base:** proyecto Next.js + Tailwind + tokens + fuentes + layout móvil + barra inferior + deploy en Cloudflare funcionando. `/impeccable teach` con la sección 2.
2. **Bienvenida** con animación.
3. **Auth** (email + Google) con Supabase, perfiles, RLS.
4. **Reserva:** servicios → calendario + horas → confirmación. Restricción de no solape. Tests de huecos.
5. **Mis citas** + cancelación + WhatsApp.
6. **Emails** (confirmación, cancelación) + Cron de recordatorios + health check.
7. **Google Calendar** (incremental) + fallback enlace/.ics.
8. **Panel admin** mínimo.
9. **PWA**, SEO básico, páginas legales (privacidad, aviso legal, cookies si aplica).
10. **Pulido final:** `/audit` y `/polish` (impeccable) en cada pantalla, revisión con modern-web-guidance, Lighthouse móvil ≥ 95 en Performance/Accesibilidad/Buenas prácticas, Playwright del flujo completo a 375×812. `/graphify` para dejar el grafo actualizado.

---

## 10. Criterios de aceptación

- Un usuario nuevo reserva una cita en **menos de 45 segundos** y ≤ 4 toques tras elegir servicios.
- En cada pantalla hay exactamente un botón primario y se distingue al instante.
- Dos usuarios que reservan la misma hora a la vez: uno lo consigue y el otro ve un mensaje claro y las horas se refrescan.
- El email de confirmación llega en < 1 min; el recordatorio llega en la ventana configurada y una sola vez.
- Funciona sin Google Calendar conectado.
- Contraste AA, navegable con teclado y lector de pantalla, objetivos táctiles ≥ 44 px, `prefers-reduced-motion` respetado.
- Sin scroll horizontal a 320 px. Respeta safe areas de iPhone (`env(safe-area-inset-*)`).
- Coste mensual: 0 €.

---

## 11. Variables de entorno (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=
RESEND_API_KEY=
EMAIL_FROM="DouceCreative <citas@tudominio.com>"
ADMIN_EMAIL=
NEXT_PUBLIC_WHATSAPP_PHONE=34XXXXXXXXX
NEXT_PUBLIC_SITE_URL=
CRON_SECRET=
```

## 12. Datos pendientes del negocio (pedir al dueño, usar placeholders mientras)

- Teléfono de WhatsApp.
- Dirección del local (para eventos de calendario y emails).
- Horario real y días de cierre.
- Duración real de cada servicio.
- Dominio propio (necesario para emails fiables y verificación de Google).
- Logotipo, si existe (si no, logotipo tipográfico).
