import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { supabaseServer } from "./supabase/server";
import { computeSlots } from "./slots";
import { localToDate, TZ, todayMadrid } from "./time";

async function ctx(fromDay: string, toDay: string) {
  const sb = await supabaseServer();
  const [{ data: hours }, { data: settings }, { data: busy }] = await Promise.all([
    sb.from("business_hours").select("weekday,opens,closes"),
    sb.from("settings").select("*").single(),
    sb.rpc("busy_ranges", { p_from: localToDate(fromDay, "00:00").toISOString(), p_to: localToDate(toDay, "23:59").toISOString() }),
  ]);
  return { hours: hours ?? [], settings: settings!, busy: busy ?? [] };
}

/** `ignore`: rango de la propia cita que se está moviendo (no cuenta como ocupado). */
export async function getAvailableSlots(day: string, durationMin: number, ignore?: { starts_at: string; ends_at: string }) {
  const { hours, settings, busy } = await ctx(day, day);
  const last = formatInTimeZone(addDays(new Date(), settings.booking_window_days), TZ, "yyyy-MM-dd");
  if (day > last) return [];
  const free = ignore
    ? busy.filter((b: { starts_at: string; ends_at: string }) => !(+new Date(b.starts_at) === +new Date(ignore.starts_at) && +new Date(b.ends_at) === +new Date(ignore.ends_at)))
    : busy;
  return computeSlots({ day, durationMin, hours, busy: free, now: new Date(), stepMin: settings.slot_step_min, minNoticeMin: settings.min_notice_min });
}

export type DayInfo = { n: number; why?: "cerrado" | "completo" };

/** Días reservables del mes (yyyy-MM-dd → huecos libres y, si no hay, el motivo). Fuera de ventana no aparecen. */
export async function getMonthAvailability(month: string, durationMin: number) {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = new Date(`${first}T12:00:00Z`); formatInTimeZone(d, TZ, "yyyy-MM") === month; d = addDays(d, 1))
    days.push(formatInTimeZone(d, TZ, "yyyy-MM-dd"));
  const { hours, settings, busy } = await ctx(days[0], days[days.length - 1]);
  const today = todayMadrid();
  const last = formatInTimeZone(addDays(new Date(), settings.booking_window_days), TZ, "yyyy-MM-dd");
  const open = new Set(hours.map((h: { weekday: number }) => h.weekday));
  const out: Record<string, DayInfo> = {};
  for (const day of days) {
    if (day < today || day > last) continue;
    const n = computeSlots({ day, durationMin, hours, busy, now: new Date(), stepMin: settings.slot_step_min, minNoticeMin: settings.min_notice_min }).length;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7; // ISO: lunes=1 … domingo=7
    out[day] = n > 0 ? { n } : { n: 0, why: open.has(weekday) ? "completo" : "cerrado" };
  }
  return out;
}
