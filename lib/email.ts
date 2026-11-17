import { Resend } from "resend";
import { fmt, euro } from "./time";

type Appt = { id: string; starts_at: string; ends_at: string; total_cents: number; services: string };

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#000;font-family:Inter,Arial,sans-serif;color:#fafafa">
<div style="max-width:480px;margin:0 auto;padding:40px 24px"><p style="font-size:18px;letter-spacing:-.02em;margin:0 0 32px"><b>DouceCreative</b></p>
<h1 style="font-size:24px;letter-spacing:-.03em;font-weight:500;margin:0 0 16px">${title}</h1>${body}
<p style="margin-top:40px;font-size:12px;color:#71717a;border-top:1px solid #26262a;padding-top:16px">DouceCreative</p></div></body></html>`;

const details = (a: Appt) =>
  `<p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#a1a1aa">${a.services}<br><b style="color:#fafafa">${fmt(a.starts_at, "EEEE d 'de' MMMM")}</b> a las <b style="color:#fafafa">${fmt(a.starts_at, "HH:mm")}</b><br>Total: ${euro(a.total_cents)}</p>`;
const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#fafafa;color:#000;padding:12px 20px;border-radius:8px;font-weight:500;text-decoration:none">${label}</a>`;

export async function send(to: string | undefined, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!to) return;
  if (!key) return void console.log(`[email:dev] ${to} · ${subject}`);
  const { error } = await new Resend(key).emails.send({
    from: process.env.EMAIL_FROM ?? "DouceCreative <onboarding@resend.dev>", to, subject, html,
  });
  if (error) console.error("[email] error", error);
}

export const confirmationEmail = (a: Appt) =>
  shell("Cita confirmada", details(a) + btn(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/google/add/${a.id}`, "Añadir a Google Calendar"));
export const reminderEmail = (a: Appt) => shell("Te esperamos pronto", details(a));
export const cancellationEmail = (a: Appt) => shell("Cita cancelada", details(a));
export const adminNewEmail = (a: Appt, name: string) => shell("Nueva cita", `<p>${name}</p>` + details(a));
