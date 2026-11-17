"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { getAvailableSlots, getMonthAvailability } from "@/lib/availability";
import { localToDate } from "@/lib/time";
import { adminNewEmail, cancellationEmail, confirmationEmail, send } from "@/lib/email";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dur = z.number().int().min(5).max(600);

export const fetchSlots = async (d: string, duration: number) =>
  getAvailableSlots(day.parse(d), dur.parse(duration));
export const fetchMonth = async (m: string, duration: number) =>
  getMonthAvailability(z.string().regex(/^\d{4}-\d{2}$/).parse(m), dur.parse(duration));

const ERRORS: Record<string, string> = {
  slot_taken: "Esa hora acaba de ser reservada. Elige otra.",
  too_soon: "Esa hora ya no admite reservas. Elige otra.",
  too_far: "Todavía no se puede reservar tan adelante.",
  outside_hours: "Esa hora está fuera del horario.",
  invalid_services: "Servicios no válidos.",
  exclusive_services: "No puedes combinar esos dos cortes.",
  not_authenticated: "Inicia sesión para confirmar.",
  too_late: "Ya no se puede cancelar online. Escribe por WhatsApp.",
  not_cancellable: "Esta cita no se puede cancelar.",
};
const msg = (e: { message: string }) => ERRORS[e.message] ?? "Algo ha fallado. Inténtalo de nuevo.";

async function loadAppt(id: string) {
  const svc = supabaseService();
  const { data } = await svc
    .from("appointments")
    .select("id,starts_at,ends_at,total_cents,user_id,appointment_services(services(name))")
    .eq("id", id).single();
  if (!data) return null;
  const { data: u } = await svc.auth.admin.getUserById(data.user_id);
  const { data: p } = await svc.from("profiles").select("full_name,email_reminders").eq("id", data.user_id).single();
  const services = (data.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + ");
  return { appt: { ...data, services }, email: u.user?.email, name: p?.full_name ?? "", notify: p?.email_reminders ?? true };
}

export async function book(input: { serviceIds: string[]; day: string; time: string; note?: string }) {
  const sb = await supabaseServer();
  const startsAt = localToDate(day.parse(input.day), z.string().regex(/^\d{2}:\d{2}$/).parse(input.time));
  const { data, error } = await sb.rpc("book_appointment", {
    p_service_ids: input.serviceIds, p_starts_at: startsAt.toISOString(), p_note: input.note?.slice(0, 500) ?? null,
  });
  if (error) return { error: msg(error), refresh: error.message === "slot_taken" };
  let ends = startsAt.toISOString();
  try {
    const l = await loadAppt(data as string);
    if (l) {
      ends = l.appt.ends_at;
      await send(l.email, "Cita confirmada · DouceCreative", confirmationEmail(l.appt));
      await send(process.env.ADMIN_EMAIL, "Nueva cita", adminNewEmail(l.appt, l.name));
    }
  } catch (e) { console.error("[book] email", e); }
  revalidatePath("/citas");
  return { id: data as string, starts_at: startsAt.toISOString(), ends_at: ends };
}

export async function cancel(id: string) {
  const sb = await supabaseServer();
  const { error } = await sb.rpc("cancel_appointment", { p_id: id });
  if (error) return { error: msg(error) };
  try {
    const l = await loadAppt(id);
    if (l) {
      await send(l.email, "Cita cancelada · DouceCreative", cancellationEmail(l.appt));
      await send(process.env.ADMIN_EMAIL, "Cita cancelada", cancellationEmail(l.appt));
    }
  } catch (e) { console.error("[cancel] email", e); }
  revalidatePath("/citas"); revalidatePath("/admin");
  return { ok: true };
}

export async function updateProfile(f: FormData) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("profiles").update({
    full_name: String(f.get("full_name") ?? "").slice(0, 100),
    phone: String(f.get("phone") ?? "").slice(0, 30) || null,
    email_reminders: f.get("email_reminders") === "on",
  }).eq("id", user.id);
  revalidatePath("/perfil");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
}

export async function deleteAccount() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await supabaseService().auth.admin.deleteUser(user.id);
  await sb.auth.signOut();
}

// ---------------- admin ----------------
async function requireAdmin() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data } = user ? await sb.from("profiles").select("role").eq("id", user.id).single() : { data: null };
  if (data?.role !== "admin") throw new Error("forbidden");
  return sb;
}

export async function adminSetStatus(id: string, status: "completed" | "no_show" | "cancelled") {
  const sb = await requireAdmin();
  const { error } = await sb.from("appointments").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  if (status === "cancelled") {
    const l = await loadAppt(id);
    if (l) await send(l.email, "Cita cancelada · DouceCreative", cancellationEmail(l.appt));
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminBlock(f: FormData) {
  const sb = await requireAdmin();
  const d = day.parse(f.get("day"));
  const from = String(f.get("from") || "00:00"), to = String(f.get("to") || "23:59");
  const s = localToDate(d, from).toISOString(), e = localToDate(d, to).toISOString();
  await sb.from("blocked_slots").insert({ during: `[${s},${e})`, reason: String(f.get("reason") || "") || null });
  revalidatePath("/admin");
}
export async function adminUnblock(id: string) {
  const sb = await requireAdmin();
  await sb.from("blocked_slots").delete().eq("id", id);
  revalidatePath("/admin");
}
export async function adminUpdateService(f: FormData) {
  const sb = await requireAdmin();
  await sb.from("services").update({
    price_cents: Math.round(Number(f.get("price")) * 100),
    duration_min: Number(f.get("duration")),
    active: f.get("active") === "on",
  }).eq("id", String(f.get("id")));
  revalidatePath("/admin");
}
export async function adminAddHours(f: FormData) {
  const sb = await requireAdmin();
  await sb.from("business_hours").insert({ weekday: Number(f.get("weekday")), opens: String(f.get("opens")), closes: String(f.get("closes")) });
  revalidatePath("/admin");
}
export async function adminDeleteHours(id: number) {
  const sb = await requireAdmin();
  await sb.from("business_hours").delete().eq("id", id);
  revalidatePath("/admin");
}
