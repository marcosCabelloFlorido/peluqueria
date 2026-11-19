"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { sendWinbackEmail } from "@/lib/winback";

// Todas las acciones exigen sesión de administrador (la RLS de las tablas lo vuelve a comprobar).
async function guard() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data } = user ? await sb.from("profiles").select("role").eq("id", user.id).single() : { data: null };
  if (data?.role !== "admin") throw new Error("forbidden");
  return sb;
}

const id = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const fields = z.object({
  full_name: text(100),
  email: z.string().trim().toLowerCase().max(200).email(),
  phone: text(30),
  birthday: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
});
const read = (f: FormData) => fields.safeParse({
  full_name: f.get("full_name") ?? "", email: f.get("email") ?? "", phone: f.get("phone") ?? "", birthday: f.get("birthday") ?? "",
});

export async function adminCreateClient(f: FormData) {
  const sb = await guard();
  const p = read(f);
  if (!p.success || p.data.full_name.length < 2) redirect("/admin/clientes/nuevo?error=invalido");
  const { data, error } = await sb.from("clients")
    .insert({ full_name: p.data.full_name, email: p.data.email, phone: p.data.phone || null, birthday: p.data.birthday || null })
    .select("id").single();
  if (error?.code === "23505") redirect("/admin/clientes/nuevo?error=duplicado");
  if (error || !data) redirect("/admin/clientes/nuevo?error=fallo");
  revalidatePath("/admin", "layout");
  redirect(`/admin/clientes/${data.id}`);
}

export async function adminUpdateClient(f: FormData) {
  const sb = await guard();
  const cid = id.parse(f.get("id"));
  const p = read(f);
  if (!p.success) redirect(`/admin/clientes/${cid}?error=invalido`);
  const { error } = await sb.from("clients").update({
    full_name: p.data.full_name, email: p.data.email, phone: p.data.phone || null, birthday: p.data.birthday || null,
    marketing_opt_out: f.get("marketing_opt_out") === "on",
  }).eq("id", cid);
  if (error?.code === "23505") redirect(`/admin/clientes/${cid}?error=duplicado`);
  if (error) redirect(`/admin/clientes/${cid}?error=fallo`);
  revalidatePath("/admin", "layout");
  redirect(`/admin/clientes/${cid}`);
}

export async function adminSaveNotes(clientId: string, notes: string): Promise<{ ok: true } | { error: string }> {
  const sb = await guard();
  const p = z.object({ id, notes: z.string().max(5000) }).safeParse({ id: clientId, notes });
  if (!p.success) return { error: "Las notas son demasiado largas." };
  const { error } = await sb.from("clients").update({ notes: p.data.notes }).eq("id", p.data.id);
  if (error) return { error: "No se pudo guardar. Inténtalo de nuevo." };
  revalidatePath(`/admin/clientes/${p.data.id}`);
  return { ok: true };
}

/** Registra una foto ya subida al almacén privado (la subida va directa desde el navegador). */
export async function adminAddPhoto(input: { clientId: string; path: string; caption?: string }): Promise<{ ok: true } | { error: string }> {
  const sb = await guard();
  const p = z.object({ clientId: id, path: z.string().max(200), caption: text(120).optional() }).safeParse(input);
  if (!p.success || !p.data.path.startsWith(`${p.data.clientId}/`) || p.data.path.includes("..")) return { error: "Foto no válida." };
  const { error } = await sb.from("client_photos").insert({ client_id: p.data.clientId, path: p.data.path, caption: p.data.caption || null });
  if (error) return { error: "No se pudo guardar la foto." };
  revalidatePath(`/admin/clientes/${p.data.clientId}`);
  return { ok: true };
}

export async function adminUpdatePhotoCaption(photoId: string, caption: string): Promise<{ ok: true } | { error: string }> {
  const sb = await guard();
  const p = z.object({ id, caption: text(120) }).safeParse({ id: photoId, caption });
  if (!p.success) return { error: "Pie de foto no válido." };
  const { data, error } = await sb.from("client_photos").update({ caption: p.data.caption || null }).eq("id", p.data.id).select("client_id").single();
  if (error || !data) return { error: "No se pudo guardar." };
  revalidatePath(`/admin/clientes/${data.client_id}`);
  return { ok: true };
}

export async function adminDeletePhoto(photoId: string): Promise<{ ok: true } | { error: string }> {
  const sb = await guard();
  const pid = id.safeParse(photoId);
  if (!pid.success) return { error: "Foto no válida." };
  const { data: row } = await sb.from("client_photos").select("client_id,path").eq("id", pid.data).single();
  if (!row) return { error: "Foto no encontrada." };
  await sb.storage.from("client-photos").remove([row.path]);
  const { error } = await sb.from("client_photos").delete().eq("id", pid.data);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath(`/admin/clientes/${row.client_id}`);
  return { ok: true };
}

/** "Enviar recordatorio ahora": respeta la baja del cliente y el aviso desactivado de su cuenta. */
export async function adminSendWinback(f: FormData) {
  await guard();
  const cid = id.parse(f.get("id"));
  const svc = supabaseService();
  const { data: c } = await svc.from("clients").select("id,email,full_name,user_id,marketing_opt_out").eq("id", cid).single();
  if (!c) redirect(`/admin/clientes/${cid}?error=fallo`);
  if (c.marketing_opt_out) redirect(`/admin/clientes/${cid}?error=baja`);
  if (c.user_id) {
    const { data: p } = await svc.from("profiles").select("email_reminders").eq("id", c.user_id).single();
    if (p && !p.email_reminders) redirect(`/admin/clientes/${cid}?error=baja`);
  }
  const { data: s } = await svc.from("settings").select("winback_offer").single();
  await svc.from("clients").update({ last_winback_sent_at: new Date().toISOString() }).eq("id", cid);
  await sendWinbackEmail(c, s?.winback_offer ?? "");
  revalidatePath(`/admin/clientes/${cid}`);
  redirect(`/admin/clientes/${cid}?aviso=enviado`);
}

export async function adminSaveWinback(f: FormData) {
  const sb = await guard();
  const p = z.object({
    winback_days: z.coerce.number().int().min(7).max(730),
    winback_offer: text(200),
  }).safeParse({ winback_days: f.get("winback_days"), winback_offer: f.get("winback_offer") ?? "" });
  if (!p.success) redirect("/admin/ajustes?error=invalido");
  await sb.from("settings").update({
    winback_enabled: f.get("winback_enabled") === "on", winback_days: p.data.winback_days, winback_offer: p.data.winback_offer,
  }).eq("id", true);
  revalidatePath("/admin", "layout");
  redirect("/admin/ajustes?ok=1");
}
