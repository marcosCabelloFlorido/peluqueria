import { supabaseService } from "./supabase/server";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key() {
  const raw = new TextEncoder().encode(process.env.TOKEN_ENCRYPTION_KEY ?? "");
  if (!raw.length) throw new Error("TOKEN_ENCRYPTION_KEY vacío");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encrypt(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(text)));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function decrypt(enc: string) {
  const [iv, ct] = enc.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct)));
}

export const redirectUri = () => `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`;

export function authUrl(state: string) {
  return "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
}

export async function exchangeCode(code: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code, grant_type: "authorization_code", redirect_uri: redirectUri(),
      client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });
  if (!r.ok) throw new Error(`google token ${r.status}`);
  return (await r.json()) as { refresh_token?: string; access_token: string; scope: string };
}

async function accessToken(userId: string) {
  const svc = supabaseService();
  const { data } = await svc.from("google_tokens").select("refresh_token_enc").eq("user_id", userId).single();
  if (!data) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: await decrypt(data.refresh_token_enc),
      client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });
  if (!r.ok) {
    // token revocado/caducado: desconectar
    if (r.status === 400 || r.status === 401) await disconnect(userId, false);
    return null;
  }
  return ((await r.json()) as { access_token: string }).access_token;
}

export async function disconnect(userId: string, revoke = true) {
  const svc = supabaseService();
  if (revoke) {
    try {
      const { data } = await svc.from("google_tokens").select("refresh_token_enc").eq("user_id", userId).single();
      if (data) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token: await decrypt(data.refresh_token_enc) }) });
    } catch {}
  }
  await svc.from("google_tokens").delete().eq("user_id", userId);
  await svc.from("profiles").update({ google_calendar_connected: false }).eq("id", userId);
}

/** Devuelve el id del evento o null. Nunca lanza: la reserva no depende de Google. */
export async function insertEvent(userId: string, e: { summary: string; start: string; end: string; location?: string }) {
  try {
    const t = await accessToken(userId);
    if (!t) return null;
    const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: e.summary, location: e.location,
        start: { dateTime: e.start }, end: { dateTime: e.end },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
      }),
    });
    return r.ok ? ((await r.json()) as { id: string }).id : null;
  } catch (err) {
    console.error("[google] insert", err);
    return null;
  }
}

export async function deleteEvent(userId: string, eventId: string) {
  try {
    const t = await accessToken(userId);
    if (t) await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
  } catch (err) {
    console.error("[google] delete", err);
  }
}
