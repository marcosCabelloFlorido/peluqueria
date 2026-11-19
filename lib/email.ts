import { Resend } from "resend";
import { fmt, euro } from "./time";

type Appt = { id: string; starts_at: string; ends_at: string; total_cents: number; services: string };

const shell = (title: string, body: string, width = 480) => `<!doctype html><html><body style="margin:0;background:#000;font-family:Inter,Arial,sans-serif;color:#fafafa">
<div style="max-width:${width}px;margin:0 auto;padding:40px 24px"><p style="font-size:18px;letter-spacing:-.02em;margin:0 0 32px"><b>DouceCreative</b></p>
<h1 style="font-size:24px;letter-spacing:-.03em;font-weight:500;margin:0 0 16px">${title}</h1>${body}
<p style="margin-top:40px;font-size:12px;color:#71717a">DouceCreative</p></div></body></html>`;

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

// `manage`: enlace firmado para cambiar la hora o cancelar sin iniciar sesión.
const manageBtn = (manage?: string) => (manage ? btn(manage, "Cambiar hora o cancelar") : "");
export const confirmationEmail = (a: Appt, manage?: string) => shell("Cita confirmada", details(a) + manageBtn(manage));
export const rescheduleEmail = (a: Appt, manage?: string) => shell("Cita cambiada", details(a) + manageBtn(manage));
export const reminderEmail = (a: Appt, manage?: string) => shell("Te esperamos pronto", details(a) + manageBtn(manage));
export const cancellationEmail = (a: Appt) => shell("Cita cancelada", details(a));
export const loginCodeEmail = (code: string) =>
  shell("Tu código de acceso", `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#a1a1aa">Introduce este código en DouceCreative:</p>
<p style="font-size:34px;letter-spacing:8px;font-weight:600;margin:0 0 16px">${code}</p>
<p style="font-size:14px;color:#71717a;margin:0">Caduca en 10 minutos. Si no lo has pedido tú, ignora este email.</p>`);
export const adminNewEmail = (a: Appt, name: string) => shell("Nueva cita", `<p>${name}</p>` + details(a));

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type DayAppt = {
  starts_at: string; ends_at: string; total_cents: number;
  name: string; phone: string | null; services: string; note: string | null;
};

/** Resumen para el administrador: citas del día siguiente, en orden. `day` = fecha legible. */
export function dailySummaryEmail(day: string, appts: DayAppt[]) {
  if (!appts.length)
    return shell("Mañana sin citas", `<p style="font-size:16px;line-height:1.6;margin:0;color:#a1a1aa">${esc(day)}<br>No hay citas confirmadas. Día libre.</p>`, 560);

  const total = appts.reduce((n, a) => n + a.total_cents, 0);
  const stat = (label: string, value: string) =>
    `<td style="padding:16px;background:#111;border:1px solid #27272a;border-radius:12px;text-align:center"><div style="font-size:24px;font-weight:600;letter-spacing:-.03em">${value}</div><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin-top:4px">${label}</div></td>`;
  const stats = `<table role="presentation" width="100%" cellspacing="8" style="margin:0 -8px 24px;border-collapse:separate"><tr>${stat("Citas", String(appts.length))}${stat("Primera", fmt(appts[0].starts_at, "HH:mm"))}${stat("Ingresos", euro(total))}</tr></table>`;

  const rows = appts.map((a) => `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellspacing="0" style="background:#111;border:1px solid #27272a;border-radius:12px"><tr>
<td width="84" valign="top" style="padding:16px 0 16px 16px"><div style="font-size:22px;font-weight:600;letter-spacing:-.03em">${fmt(a.starts_at, "HH:mm")}</div><div style="font-size:12px;color:#71717a;margin-top:2px">hasta ${fmt(a.ends_at, "HH:mm")}</div></td>
<td valign="top" style="padding:16px"><div style="font-size:16px;font-weight:600">${esc(a.name)}</div><div style="font-size:14px;line-height:1.5;color:#a1a1aa;margin-top:4px">${esc(a.services)}</div>${a.phone ? `<div style="font-size:14px;margin-top:6px"><a href="tel:${esc(a.phone)}" style="color:#fafafa">${esc(a.phone)}</a></div>` : ""}${a.note ? `<div style="font-size:13px;color:#a1a1aa;margin-top:8px;padding-top:8px;border-top:1px solid #27272a">${esc(a.note)}</div>` : ""}</td>
<td valign="top" align="right" style="padding:16px 16px 16px 0;font-size:14px;color:#a1a1aa;white-space:nowrap">${euro(a.total_cents)}</td></tr></table></td></tr>`).join("");

  const cta = process.env.NEXT_PUBLIC_SITE_URL ? btn(`${process.env.NEXT_PUBLIC_SITE_URL}/admin/agenda`, "Abrir agenda") : "";
  return shell(
    `Mañana: ${appts.length} ${appts.length === 1 ? "corte" : "cortes"}`,
    `<p style="font-size:15px;margin:0 0 24px;color:#a1a1aa;text-transform:capitalize">${esc(day)}</p>${stats}<table role="presentation" width="100%" cellspacing="0">${rows}</table><div style="margin-top:12px">${cta}</div>`,
    560,
  );
}
