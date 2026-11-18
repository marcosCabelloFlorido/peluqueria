import Booking from "@/components/Booking";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Reservar() {
  const sb = await supabaseServer();
  const [{ data: services }, { data: settings }, { data: { user } }] = await Promise.all([
    sb.from("services").select("id,slug,name,price_cents,duration_min,exclusive_group").eq("active", true).order("sort"),
    sb.from("settings").select("booking_window_days").single(),
    sb.auth.getUser(),
  ]);
  const { data: p } = user ? await sb.from("profiles").select("full_name,phone").eq("id", user.id).single() : { data: null };
  const profile = user ? { name: p?.full_name ?? "", phone: p?.phone ?? "", email: user.email ?? "" } : undefined;
  return <Booking services={services ?? []} windowDays={settings?.booking_window_days ?? 30} profile={profile} />;
}
