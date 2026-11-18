import { supabaseService } from "@/lib/supabase/server";
import { dailySummaryEmail, send, type DayAppt } from "@/lib/email";
import { fmt, localToDate } from "@/lib/time";

export const dynamic = "force-dynamic";

// El Cron Trigger corre cada 15 min; solo actúa entre las 21:00 y las 21:14 (Europe/Madrid),
// así cuadra con el horario de verano. `?force=1` salta la hora (pruebas manuales).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  if (new URL(req.url).searchParams.get("force") !== "1" && !(fmt(now, "HH") === "21" && +fmt(now, "mm") < 15))
    return Response.json({ skipped: true });

  // Aritmética de días sobre mediodía UTC: inmune al cambio de hora.
  const addDay = (day: string) => new Date(+new Date(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const tomorrow = addDay(fmt(now, "yyyy-MM-dd"));
  const afterTomorrow = addDay(tomorrow);

  const svc = supabaseService();
  const { data } = await svc
    .from("appointments")
    .select("starts_at,ends_at,total_cents,note,contact_name,contact_phone,profiles(full_name,phone),appointment_services(services(name))")
    .eq("status", "confirmed")
    .gte("starts_at", localToDate(tomorrow, "00:00").toISOString())
    .lt("starts_at", localToDate(afterTomorrow, "00:00").toISOString())
    .order("starts_at");

  const appts: DayAppt[] = (data ?? []).map((a) => {
    const p = a.profiles as unknown as { full_name: string; phone: string | null } | null;
    const svs = a.appointment_services as unknown as { services: { name: string } }[];
    return {
      starts_at: a.starts_at, ends_at: a.ends_at, total_cents: a.total_cents, note: a.note,
      name: a.contact_name || p?.full_name || "Cliente",
      phone: a.contact_phone || p?.phone || null,
      services: svs.map((x) => x.services.name).join(" + "),
    };
  });

  const day = fmt(localToDate(tomorrow, "12:00"), "EEEE d 'de' MMMM");
  await send(
    process.env.ADMIN_EMAIL,
    appts.length ? `Mañana: ${appts.length} ${appts.length === 1 ? "corte" : "cortes"} · ${day}` : `Mañana sin citas · ${day}`,
    dailySummaryEmail(day, appts),
  );
  return Response.json({ sent: true, count: appts.length });
}
