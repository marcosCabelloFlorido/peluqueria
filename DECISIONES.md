# Decisiones
- BD local: Supabase CLI en Docker (mismo stack que producción).
- Sin Google: ni login con Google ni Calendar. Recordatorios por email (confirmación al reservar y aviso `reminder_hours_before` antes de la cita).
- Errores de formulario: negro con icono ⚠, sin rojo.
- Emails: HTML en línea (sin React Email) para minimizar dependencias.
- Horario y datos del negocio: provisionales (seed).
- Contraseña mínima 6 caracteres (valor por defecto de Supabase local).
- Reserva sin cuenta: la cita guarda `contact_name/phone/email`; los emails van a ese correo. `user_id` es opcional. `book_appointment` solo la llama el servidor (service role). Tras reservar, modal opcional de login; al entrar, la cita se vincula a la cuenta (`/citas?claim=<id>`).
