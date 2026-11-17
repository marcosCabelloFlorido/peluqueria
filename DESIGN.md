# Diseño: DouceCreative

## Tokens (`app/globals.css`)
- Color: `--ink #0A0A0A`, `--paper #FFF`, grises `--gray-1 #F4F4F4`, `--gray-2 #E5E5E5`, `--gray-3 #A3A3A3`, `--gray-4 #525252`. Nada más.
- Tipografía: Fraunces (display, titulares) + Inter (UI), vía `next/font`. Cifras tabulares.
- Radios: tarjetas 16 px, campos 12 px, botones pill, hoja inferior 24 px arriba. Bordes 1 px; sin sombras.
- Movimiento: `cubic-bezier(0.22,1,0.36,1)`, 200–450 ms, springs 260/30. Solo `transform`/`opacity`. `prefers-reduced-motion` respetado.

## Componentes
- `.btn-primary`: negro sólido, ≥52 px, ancho completo, fijo abajo (`.sticky-bar`) con safe-area; flecha que avanza en hover/focus; escala .97 al pulsar.
- `.btn-secondary`: borde negro 1 px. `.link`: texto subrayado gris.
- Navegación: barra inferior 3 pestañas (Reservar, Mis citas, Perfil), pestaña activa en negro.
- Errores: caja con borde negro + icono de alerta; nunca rojo.
- Hoja inferior: `<dialog>` nativo modal (`.sheet`), foco inicial en la acción segura.
- Superficies del navegador tematizadas: `::selection`, `caret-color`, `accent-color`, scrollbar.

## Pantallas clave
Bienvenida (revelado letra a letra + cortinilla) · Reserva 3 pasos (calendario propio, píldora `layoutId`, horas en stagger) · Mis citas · Perfil · Admin.
