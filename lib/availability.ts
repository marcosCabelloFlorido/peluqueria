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

export async function getAvailableSlots(day: string, durationMin: number) {
  const { hours, settings, busy } = await ctx(day, day);
  return computeSlots({ day, durationMin, hours, busy, now: new Date(), stepMin: settings.slot_step_min, minNoticeMin: settings.min_notice_min });
}

/** Días del mes (yyyy-MM-dd) con al menos un hueco. */
export async function getMonthAvailability(month: string, durationMin: number) {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = new Date(`${first}T12:00:00Z`); formatInTimeZone(d, TZ, "yyyy-MM") === month; d = addDays(d, 1))
    days.push(formatInTimeZone(d, TZ, "yyyy-MM-dd"));
  const { hours, settings, busy } = await ctx(days[0], days[days.length - 1]);
  const today = todayMadrid();
  const last = formatInTimeZone(addDays(new Date(), settings.booking_window_days), TZ, "yyyy-MM-dd");
  return days.filter(
    (day) =>
      day >= today && day <= last &&
      computeSlots({ day, durationMin, hours, busy, now: new Date(), stepMin: settings.slot_step_min, minNoticeMin: settings.min_notice_min }).length > 0,
  );
}
