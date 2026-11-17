import { addMinutes } from "date-fns";
import { localToDate } from "./time";

export type Hours = { weekday: number; opens: string; closes: string };
export type Busy = { starts_at: string; ends_at: string };
export type SlotOpts = {
  day: string; // yyyy-MM-dd (Madrid)
  durationMin: number;
  hours: Hours[];
  busy: Busy[];
  now: Date;
  stepMin: number;
  minNoticeMin: number;
};

const hm = (t: string) => t.slice(0, 5);
export const isoWeekday = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

/** Horas de inicio disponibles ("HH:mm", hora Madrid) para un día. */
export function computeSlots(o: SlotOpts): string[] {
  const earliest = addMinutes(o.now, o.minNoticeMin);
  const busy = o.busy.map((b) => [+new Date(b.starts_at), +new Date(b.ends_at)] as const);
  const out: string[] = [];
  for (const h of o.hours.filter((x) => x.weekday === isoWeekday(o.day))) {
    const open = localToDate(o.day, hm(h.opens));
    const close = localToDate(o.day, hm(h.closes));
    for (let s = open; addMinutes(s, o.durationMin) <= close; s = addMinutes(s, o.stepMin)) {
      const e = addMinutes(s, o.durationMin);
      if (s < earliest) continue;
      if (busy.some(([bs, be]) => bs < +e && be > +s)) continue;
      out.push(
        new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(s),
      );
    }
  }
  return out;
}
