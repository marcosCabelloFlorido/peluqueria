import { supabaseService } from "@/lib/supabase/server";
import { reminderEmail, send } from "@/lib/email";
import { apptUrl } from "@/lib/apptAccess";

export const dynamic = "force-dynamic";

// Llamar cada 15 min (Cloudflare Cron Trigger) con `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const svc = supabaseService();
  const { data: s } = await svc.from("settings").select("reminder_hours_before").single();
  const hours = s?.reminder_hours_before ?? 48;
  const now = new Date();
  const limit = new Date(+now + hours * 3600_000).toISOString();

  // Idempotente: marcar y devolver solo las que aún no tenían recordatorio.
  const { data: claimed } = await svc
    .from("appointments")
    .update({ reminder_sent_at: now.toISOString() })
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", limit)
    .select("id,user_id,contact_email,starts_at,ends_at,created_at,total_cents,appointment_services(services(name))");

  let sent = 0;
  for (const a of claimed ?? []) {
    // Reservada con menos antelación que el aviso: la confirmación ya cubre el recordatorio.
    if (+new Date(a.starts_at) - +new Date(a.created_at) < hours * 3600_000) continue;
    if (a.user_id) {
      const { data: p } = await svc.from("profiles").select("email_reminders").eq("id", a.user_id).single();
      if (p && !p.email_reminders) continue;
    }
    const email = a.contact_email ?? (a.user_id ? (await svc.auth.admin.getUserById(a.user_id)).data.user?.email : undefined);
    const services = (a.appointment_services as unknown as { services: { name: string } }[]).map((x) => x.services.name).join(" + ");
    await send(email, "Recordatorio de tu cita · DouceCreative", reminderEmail({ ...a, services }, await apptUrl(a.id)));
    sent++;
  }
  return Response.json({ sent });
}
