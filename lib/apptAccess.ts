import { supabaseServer, supabaseService } from "./supabase/server";

// Enlace firmado para gestionar una cita sin cuenta (cancelar / cambiar hora desde el email).
// El token es un HMAC del id: quien lo tiene es quien recibió el email.
const secret = () =>
  process.env.APPT_LINK_SECRET || process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))).slice(0, 32);
}

async function verify(message: string, token: string | undefined | null) {
  if (!token || !secret()) return false;
  const good = await sign(message);
  if (good.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export const apptToken = (id: string) => sign(`appt:${id}`);
export const verifyApptToken = (id: string, token: string | undefined | null) => verify(`appt:${id}`, token);

// Baja de emails promocionales de un cliente: mismo secreto, otro ámbito (un token de cita no sirve aquí).
export const unsubToken = (clientId: string) => sign(`unsub:${clientId}`);
export const verifyUnsubToken = (clientId: string, token: string | undefined | null) => verify(`unsub:${clientId}`, token);
export async function unsubUrl(clientId: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/baja?${await unsubQuery(clientId)}`;
}
/** Query `c=…&t=…` firmada, compartida por la página y la API de baja. */
export async function unsubQuery(clientId: string) {
  return `c=${clientId}&t=${await unsubToken(clientId)}`;
}
/** Endpoint de baja con un clic (RFC 8058, cabecera List-Unsubscribe). */
export async function unsubApiUrl(clientId: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/baja?${await unsubQuery(clientId)}`;
}

export const TEST_CLIENT_ID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUnsubLinkValid = async (c: string | null | undefined, t: string | null | undefined) =>
  !!c && UUID_RE.test(c) && (await verifyUnsubToken(c, t));

export type OptOutResult = "ok" | "test" | "invalid";
/** Re-verifica el token y marca la baja. `ok` solo si una fila existente se actualizó. */
export async function optOutClient(c: string | null | undefined, t: string | null | undefined): Promise<OptOutResult> {
  if (!c || !(await isUnsubLinkValid(c, t))) return "invalid";
  if (c === TEST_CLIENT_ID) return "test";
  const { data, error } = await supabaseService().from("clients").update({ marketing_opt_out: true }).eq("id", c).select("id");
  return !error && data && data.length > 0 ? "ok" : "invalid";
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
