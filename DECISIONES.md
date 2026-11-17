# Decisiones
- BD local: Supabase CLI en Docker (mismo stack que producción).
- Google Calendar: OAuth incremental propio (`lib/google.ts`); sin conectar, enlace + .ics. Si Google falla la cita se guarda igual.
- Login con Google: Supabase Auth; `enabled=false` en config.toml hasta tener credenciales.
- Errores de formulario: negro con icono ⚠, sin rojo.
- Emails: HTML en línea (sin React Email) para minimizar dependencias.
- Horario y datos del negocio: provisionales (seed).
- Contraseña mínima 6 caracteres (valor por defecto de Supabase local).
