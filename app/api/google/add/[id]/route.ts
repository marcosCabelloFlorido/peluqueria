import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { insertEvent } from "@/lib/google";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { origin } = req.nextUrl;
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/citas`);

  const [{ data: p }, { data: a }] = await Promise.all([
    sb.from("profiles").select("google_calendar_connected").eq("id", user.id).single(),
    sb.from("appointments").select("id,starts_at,ends_at,status,google_event_id,appointment_services(services(name))").eq("id", id).single(),
  ]);
  if (!a || a.status !== "confirmed") return NextResponse.redirect(`${origin}/citas?cal=error`);
  if (a.google_event_id) return NextResponse.redirect(`${origin}/citas?cal=added`);
  // Sin conectar: OAuth una vez y vuelta aquí para crear el evento sin pasos extra.
  if (!p?.google_calendar_connected) return NextResponse.redirect(`${origin}/api/google/connect?next=${encodeURIComponent(`/api/google/add/${id}`)}`);

  const services = (a.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + ");
  const ev = await insertEvent(user.id, { summary: `DouceCreative — ${services}`, start: a.starts_at, end: a.ends_at, location: process.env.NEXT_PUBLIC_SHOP_ADDRESS });
  if (!ev) return NextResponse.redirect(`${origin}/citas?cal=error`);
  await supabaseService().from("appointments").update({ google_event_id: ev }).eq("id", a.id);
  return NextResponse.redirect(`${origin}/citas?cal=added`);
}
