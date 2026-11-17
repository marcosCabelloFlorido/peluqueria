# Decisiones
- BD local: Supabase CLI en Docker (mismo stack que producción).
- Sin Google: ni login con Google ni Calendar. Recordatorios por email (confirmación al reservar y aviso `reminder_hours_before` antes de la cita).
- Errores de formulario: negro con icono ⚠, sin rojo.
- Emails: HTML en línea (sin React Email) para minimizar dependencias.
- Horario y datos del negocio: provisionales (seed).
- Contraseña mínima 6 caracteres (valor por defecto de Supabase local).
