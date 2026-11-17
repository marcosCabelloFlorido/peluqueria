import { supabaseServer } from "@/lib/supabase/server";
import { icsFile } from "@/lib/calendar";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("appointments")
    .select("id,starts_at,ends_at,appointment_services(services(name))")
    .eq("id", id)
    .single();
  if (!data) return new Response("No encontrada", { status: 404 });
  const services = (data.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + ");
  return new Response(icsFile({ ...data, services }), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="cita.ics"' },
  });
}
