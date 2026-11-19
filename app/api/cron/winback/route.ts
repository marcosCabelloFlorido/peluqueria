import { supabaseService } from "@/lib/supabase/server";
import { inactiveCutoff } from "@/lib/crm";
import { fmt } from "@/lib/time";
import { sendWinbackEmail } from "@/lib/winback";

export const dynamic = "force-dynamic";

const MAX_PER_RUN = 50;

// El Cron Trigger corre cada 15 min; solo actúa entre las 11:00 y las 11:14 (Europe/Madrid).
// `?force=1` salta la hora (pruebas manuales). Como mucho un email por cliente y episodio de inactividad.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  if (new URL(req.url).searchParams.get("force") !== "1" && !(fmt(now, "HH") === "11" && +fmt(now, "mm") < 15))
    return Response.json({ skipped: true });

  const svc = supabaseService();
  const { data: s } = await svc.from("settings").select("winback_enabled,winback_days,winback_offer").single();
  if (!s?.winback_enabled) return Response.json({ skipped: "disabled" });

  // winback_due: nunca avisado, o avisado antes de su última visita (nuevo episodio).
  const { data: cands } = await svc
    .from("client_stats")
    .select("id,email,full_name,user_id,last_visit,last_winback_sent_at")
    .eq("marketing_opt_out", false).eq("winback_due", true)
    .gt("visits", 0).lt("last_visit", inactiveCutoff(s.winback_days, +now))
    .is("next_appt", null)
    .order("last_visit", { ascending: false })
    .limit(MAX_PER_RUN * 3); // margen para los que se descartan (sin email_reminders / ya reclamados)

  // Cuentas que desactivaron los emails: se respeta también aquí.
  const userIds = [...new Set((cands ?? []).map((c) => c.user_id).filter((u): u is string => !!u))];
  const { data: off } = userIds.length
    ? await svc.from("profiles").select("id").in("id", userIds).eq("email_reminders", false)
    : { data: [] as { id: string }[] };
  const muted = new Set((off ?? []).map((p) => p.id));

  let sent = 0, failed = 0;
  for (const c of cands ?? []) {
    if (sent >= MAX_PER_RUN) break;
    if (c.user_id && muted.has(c.user_id)) continue;
    // Idempotente: reclamar antes de enviar; si otra ejecución ya lo hizo, no devuelve fila.
    const { data: claimed } = await svc.from("clients")
      .update({ last_winback_sent_at: now.toISOString() })
      .eq("id", c.id)
      .or(`last_winback_sent_at.is.null,last_winback_sent_at.lt.${new Date(c.last_visit).toISOString()}`)
      .select("id");
    if (!claimed?.length) continue;
    // Si falla el envío, se deshace la marca para reintentarlo en la próxima ejecución diaria.
    const ok = await sendWinbackEmail(c, s.winback_offer).catch(() => false);
    if (!ok) {
      await svc.from("clients").update({ last_winback_sent_at: c.last_winback_sent_at }).eq("id", c.id);
      failed++;
      continue;
    }
    sent++;
  }
  return Response.json({ sent, failed });
}
