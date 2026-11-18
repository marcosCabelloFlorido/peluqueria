"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { getAvailableSlots, getMonthAvailability } from "@/lib/availability";
import { localToDate } from "@/lib/time";
import { adminNewEmail, cancellationEmail, confirmationEmail, rescheduleEmail, send } from "@/lib/email";
import { apptUrl, authorizeAppt, canChange, cancelLimitMin, verifyApptToken } from "@/lib/apptAccess";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dur = z.number().int().min(5).max(600);

export async function fetchSlots(d: string, duration: number, move?: { id: string; token?: string }) {
  const a = move ? await authorizeAppt(move.id, move.token) : null;
  return getAvailableSlots(day.parse(d), dur.parse(duration), a ?? undefined);
}
export const fetchMonth = async (m: string, duration: number) =>
  getMonthAvailability(z.string().regex(/^\d{4}-\d{2}$/).parse(m), dur.parse(duration));

const ERRORS: Record<string, string> = {
  slot_taken: "Esa hora acaba de ser reservada. Elige otra.",
  too_soon: "Esa hora ya no admite reservas. Elige otra.",
  too_far: "Todavía no se puede reservar tan adelante.",
  outside_hours: "Esa hora está fuera del horario.",
  invalid_services: "Servicios no válidos.",
  exclusive_services: "No puedes combinar esos dos cortes.",
  invalid_contact: "Revisa tu nombre, teléfono y email.",
  too_late: "Ya no se puede cancelar online. Escribe por WhatsApp.",
  too_late_change: "Ya no se puede cambiar online. Escribe por WhatsApp.",
  not_found: "Enlace no válido o cita no encontrada.",
  not_cancellable: "Esta cita no se puede cancelar.",
};
const msg = (e: { message: string }) =>
  ERRORS[e.message] ?? `Algo ha fallado. Inténtalo de nuevo.${process.env.NODE_ENV === "production" ? "" : ` [${e.message}]`}`;

async function loadAppt(id: string) {
  const svc = supabaseService();
  const { data } = await svc
    .from("appointments")
    .select("id,starts_at,ends_at,total_cents,user_id,contact_name,contact_email,appointment_services(services(name))")
    .eq("id", id).single();
  if (!data) return null;
  let email = data.contact_email ?? undefined, name = data.contact_name ?? "", notify = true;
  if (data.user_id) {
    const { data: p } = await svc.from("profiles").select("full_name,email_reminders").eq("id", data.user_id).single();
    if (!email) email = (await svc.auth.admin.getUserById(data.user_id)).data.user?.email;
    name ||= p?.full_name ?? "";
    notify = p?.email_reminders ?? true;
  }
  const services = (data.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + ");
  return { appt: { ...data, services }, email, name, notify, hasAccount: !!data.user_id };
}

const contact = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[+\d][\d\s().-]{6,19}$/),
  email: z.string().trim().max(200).email(),
});

export async function book(input: { serviceIds: string[]; day: string; time: string; note?: string; name: string; phone: string; email: string }) {
  const c = contact.safeParse({ name: input.name, phone: input.phone, email: input.email });
  if (!c.success) return { error: ERRORS.invalid_contact };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const startsAt = localToDate(day.parse(input.day), z.string().regex(/^\d{2}:\d{2}$/).parse(input.time));
  const svc = supabaseService();
  const args = {
    p_name: c.data.name, p_phone: c.data.phone, p_email: c.data.email,
    p_service_ids: input.serviceIds, p_starts_at: startsAt.toISOString(), p_note: input.note?.slice(0, 500) ?? null,
  };
  let r = await svc.rpc("book_appointment", { ...args, p_user_id: user?.id ?? null });
  // Sesión de una cuenta ya sin perfil (FK): reservar como invitado en vez de fallar.
  if (r.error?.code === "23503" && user) r = await svc.rpc("book_appointment", { ...args, p_user_id: null });
  const { data, error } = r;
  if (error) { if (!ERRORS[error.message]) console.error("[book] rpc", error); return { error: msg(error), refresh: error.message === "slot_taken" }; }
  let ends = startsAt.toISOString();
  try {
    const l = await loadAppt(data as string);
    if (l) {
      ends = l.appt.ends_at;
      await send(l.email, "Cita confirmada · DouceCreative", confirmationEmail(l.appt, await apptUrl(l.appt.id)));
      await send(process.env.ADMIN_EMAIL, "Nueva cita", adminNewEmail(l.appt, l.name));
    }
  } catch (e) { console.error("[book] email", e); }
  revalidatePath("/citas");
  return { id: data as string, starts_at: startsAt.toISOString(), ends_at: ends, loggedIn: !!user };
}

// Tras reservar como invitado y entrar: la cita pasa a la cuenta. Quien conoce el id es quien la creó.
export async function claimAppointment(id: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !z.string().uuid().safeParse(id).success) return;
  await supabaseService().from("appointments").update({ user_id: user.id }).eq("id", id).is("user_id", null);
}

export async function cancel(id: string, token?: string) {
  if (token) {
    // Desde el enlace del email (sin sesión): mismas reglas que cancel_appointment.
    if (!(await verifyApptToken(id, token))) return { error: msg({ message: "not_found" }) };
    const a = await authorizeAppt(id, token);
    if (!a || a.status !== "confirmed") return { error: ERRORS.not_cancellable };
    if (!canChange(a, await cancelLimitMin())) return { error: ERRORS.too_late };
    const { error } = await supabaseService().from("appointments").update({ status: "cancelled" }).eq("id", id).eq("status", "confirmed");
    if (error) return { error: msg(error) };
  } else {
    const sb = await supabaseServer();
    const { error } = await sb.rpc("cancel_appointment", { p_id: id });
    if (error) return { error: msg(error) };
  }
  try {
    const l = await loadAppt(id);
    if (l) {
      await send(l.email, "Cita cancelada · DouceCreative", cancellationEmail(l.appt));
      await send(process.env.ADMIN_EMAIL, "Cita cancelada", cancellationEmail(l.appt));
    }
  } catch (e) { console.error("[cancel] email", e); }
  revalidatePath("/citas"); revalidatePath(`/cita/${id}`); revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Mueve una cita a otro día/hora manteniendo servicios, precio y datos. */
export async function reschedule(input: { id: string; token?: string; day: string; time: string }) {
  const a = await authorizeAppt(input.id, input.token);
  if (!a || a.status !== "confirmed") return { error: ERRORS.not_cancellable };
  if (!canChange(a, await cancelLimitMin())) return { error: ERRORS.too_late_change };
  const d = day.parse(input.day), t = z.string().regex(/^\d{2}:\d{2}$/).parse(input.time);
  const minutes = Math.round((+new Date(a.ends_at) - +new Date(a.starts_at)) / 60000);
  const slots = await getAvailableSlots(d, minutes, a);
  if (!slots.includes(t)) return { error: ERRORS.slot_taken, refresh: true };
  const starts = localToDate(d, t), ends = new Date(+starts + minutes * 60000);
  const { error } = await supabaseService().from("appointments")
    .update({ starts_at: starts.toISOString(), ends_at: ends.toISOString(), reminder_sent_at: null })
    .eq("id", a.id).eq("status", "confirmed");
  // 23P01 = exclusion_violation: alguien reservó esa hora en el último momento.
  if (error) return error.code === "23P01" ? { error: ERRORS.slot_taken, refresh: true } : { error: msg(error) };
  try {
    const l = await loadAppt(a.id);
    if (l) {
      await send(l.email, "Cita cambiada · DouceCreative", rescheduleEmail(l.appt, await apptUrl(a.id)));
      await send(process.env.ADMIN_EMAIL, "Cita cambiada", rescheduleEmail(l.appt));
    }
  } catch (e) { console.error("[reschedule] email", e); }
  revalidatePath("/citas"); revalidatePath(`/cita/${a.id}`); revalidatePath("/admin", "layout");
  return { ok: true, starts_at: starts.toISOString(), ends_at: ends.toISOString() };
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

export async function adminSetStatus(id: string, status: "completed" | "no_show" | "cancelled" | "confirmed") {
  const sb = await requireAdmin();
  const { error } = await sb.from("appointments").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  if (status === "cancelled") {
    const l = await loadAppt(id);
    if (l) await send(l.email, "Cita cancelada · DouceCreative", cancellationEmail(l.appt));
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function adminBlock(f: FormData) {
  const sb = await requireAdmin();
  const d = day.parse(f.get("day"));
  const from = String(f.get("from") || "00:00"), to = String(f.get("to") || "23:59");
  const s = localToDate(d, from).toISOString(), e = localToDate(d, to).toISOString();
  await sb.from("blocked_slots").insert({ during: `[${s},${e})`, reason: String(f.get("reason") || "") || null });
  revalidatePath("/admin", "layout");
}
export async function adminUnblock(id: string) {
  const sb = await requireAdmin();
  await sb.from("blocked_slots").delete().eq("id", id);
  revalidatePath("/admin", "layout");
}
export async function adminUpdateService(f: FormData) {
  const sb = await requireAdmin();
  await sb.from("services").update({
    price_cents: Math.round(Number(f.get("price")) * 100),
    duration_min: Number(f.get("duration")),
    active: f.get("active") === "on",
  }).eq("id", String(f.get("id")));
  revalidatePath("/admin", "layout");
}
export async function adminAddHours(f: FormData) {
  const sb = await requireAdmin();
  await sb.from("business_hours").insert({ weekday: Number(f.get("weekday")), opens: String(f.get("opens")), closes: String(f.get("closes")) });
  revalidatePath("/admin", "layout");
}
export async function adminDeleteHours(id: number) {
  const sb = await requireAdmin();
  await sb.from("business_hours").delete().eq("id", id);
  revalidatePath("/admin", "layout");
}
