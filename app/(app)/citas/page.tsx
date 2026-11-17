import { supabaseServer } from "@/lib/supabase/server";
import Appointments from "@/components/Appointments";

export default async function Citas() {
  const sb = await supabaseServer();
  const [{ data }, { data: settings }] = await Promise.all([
    sb
      .from("appointments")
      .select("id,starts_at,ends_at,total_cents,status,appointment_services(services(name))")
      .order("starts_at", { ascending: false }),
    sb.from("settings").select("cancel_limit_min").single(),
  ]);
  const list = (data ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    total_cents: a.total_cents,
    status: a.status as "confirmed" | "cancelled" | "completed" | "no_show",
    services: (a.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + "),
  }));
  return (
    <>
      <h1 className="display text-4xl mb-6">Mis citas</h1>
      <Appointments list={list} cancelLimitMin={settings?.cancel_limit_min ?? 120} />
    </>
  );
}
