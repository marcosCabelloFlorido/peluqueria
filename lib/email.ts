import { Resend } from "resend";
import { fmt, euro } from "./time";
import { googleCalendarUrl } from "./calendar";

type Appt = { id: string; starts_at: string; ends_at: string; total_cents: number; services: string };

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#fff;font-family:Inter,Arial,sans-serif;color:#0a0a0a">
<div style="max-width:480px;margin:0 auto;padding:40px 24px"><p style="font-size:22px;letter-spacing:.02em;margin:0 0 32px"><b>DouceCreative</b></p>
<h1 style="font-size:24px;margin:0 0 16px">${title}</h1>${body}
<p style="margin-top:40px;font-size:12px;color:#525252">DouceCreative</p></div></body></html>`;

const details = (a: Appt) =>
  `<p style="font-size:16px;line-height:1.6;margin:0 0 24px">${a.services}<br><b>${fmt(a.starts_at, "EEEE d 'de' MMMM")}</b> a las <b>${fmt(a.starts_at, "HH:mm")}</b><br>Total: ${euro(a.total_cents)}</p>`;
const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none">${label}</a>`;

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
  shell("Cita confirmada", details(a) + btn(googleCalendarUrl(a), "Añadir a Google Calendar"));
export const reminderEmail = (a: Appt) => shell("Te esperamos pronto", details(a));
export const cancellationEmail = (a: Appt) => shell("Cita cancelada", details(a));
export const adminNewEmail = (a: Appt, name: string) => shell("Nueva cita", `<p>${name}</p>` + details(a));
