import Booking from "@/components/Booking";
import { supabaseServer } from "@/lib/supabase/server";
import { authorizeAppt, canChange, cancelLimitMin } from "@/lib/apptAccess";
import { fmt } from "@/lib/time";

export default async function Reservar({ searchParams }: { searchParams: Promise<{ cambiar?: string; t?: string }> }) {
  const { cambiar, t } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: services }, { data: settings }, { data: { user } }] = await Promise.all([
    sb.from("services").select("id,slug,name,price_cents,duration_min,exclusive_group").eq("active", true).order("sort"),
    sb.from("settings").select("booking_window_days").single(),
    sb.auth.getUser(),
  ]);
  const [{ data: p }, { data: lastAppt }] = user
    ? await Promise.all([
        sb.from("profiles").select("full_name,phone").eq("id", user.id).single(),
        // Última cita no cancelada: base del atajo "Repetir".
        sb.from("appointments").select("appointment_services(service_id)").in("status", ["confirmed", "completed"])
          .order("starts_at", { ascending: false }).limit(1).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const profile = user ? { name: p?.full_name ?? "", phone: p?.phone ?? "", email: user.email ?? "" } : undefined;
  const last = (lastAppt?.appointment_services as { service_id: string }[] | undefined)?.map((s) => s.service_id);

  // Cambiar hora de una cita existente (desde Mis citas o el enlace del email).
  let move;
  if (cambiar) {
    const a = await authorizeAppt(cambiar, t);
    if (a && canChange(a, await cancelLimitMin())) {
      move = {
        id: a.id, token: t, ids: a.serviceIds, services: a.services,
        duration: Math.round((+new Date(a.ends_at) - +new Date(a.starts_at)) / 60000),
        current: `${fmt(a.starts_at, "EEEE d 'de' MMMM")} · ${fmt(a.starts_at, "HH:mm")}`,
      };
    }
  }

  return <Booking key={move?.id ?? "new"} services={services ?? []} windowDays={settings?.booking_window_days ?? 30} profile={profile} last={last} move={move} />;
}
