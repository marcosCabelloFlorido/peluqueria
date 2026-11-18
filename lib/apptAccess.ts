import { supabaseServer, supabaseService } from "./supabase/server";

// Enlace firmado para gestionar una cita sin cuenta (cancelar / cambiar hora desde el email).
// El token es un HMAC del id: quien lo tiene es quien recibió el email.
const secret = () =>
  process.env.APPT_LINK_SECRET || process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function apptToken(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`appt:${id}`))).slice(0, 32);
}

export async function verifyApptToken(id: string, token: string | undefined | null) {
  if (!token || !secret()) return false;
  const good = await apptToken(id);
  if (good.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function apptUrl(id: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/cita/${id}?t=${await apptToken(id)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManagedAppt = {
  id: string; starts_at: string; ends_at: string; total_cents: number; status: string;
  user_id: string | null; serviceIds: string[]; services: string;
};

/** Devuelve la cita si quien pregunta tiene token válido o es su dueño con sesión. */
export async function authorizeAppt(id: string, token?: string | null): Promise<ManagedAppt | null> {
  if (!UUID.test(id)) return null;
  const { data } = await supabaseService()
    .from("appointments")
    .select("id,starts_at,ends_at,total_cents,status,user_id,appointment_services(service_id,services(name))")
    .eq("id", id).single();
  if (!data) return null;
  let ok = await verifyApptToken(id, token);
  if (!ok && data.user_id) {
    const { data: { user } } = await (await supabaseServer()).auth.getUser();
    ok = user?.id === data.user_id;
  }
  if (!ok) return null;
  const rows = data.appointment_services as unknown as { service_id: string; services: { name: string } }[];
  return {
    id: data.id, starts_at: data.starts_at, ends_at: data.ends_at, total_cents: data.total_cents, status: data.status,
    user_id: data.user_id, serviceIds: rows.map((r) => r.service_id), services: rows.map((r) => r.services.name).join(" + "),
  };
}

export async function cancelLimitMin() {
  const { data } = await supabaseService().from("settings").select("cancel_limit_min").single();
  return data?.cancel_limit_min ?? 120;
}

export const canChange = (a: { status: string; starts_at: string }, limitMin: number) =>
  a.status === "confirmed" && +new Date(a.starts_at) - Date.now() > limitMin * 60000;
