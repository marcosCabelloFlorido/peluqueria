import { fmt, localToDate } from "./time";

// Matemática de periodos de facturación. Los días son cadenas "yyyy-MM-dd" en Europe/Madrid y los
// periodos son [start, end) con `end` exclusivo. La aritmética de días usa mediodía UTC (inmune al
// cambio de hora); los límites en instantes reales se calculan con `localToDate` (respeta el DST).

export type View = "dia" | "semana" | "mes" | "anio";
export const VIEWS: View[] = ["dia", "semana", "mes", "anio"];
export type Period = { view: View; start: string; end: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const utc = (day: string) => new Date(`${day}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Devuelve el día si es una fecha real "yyyy-MM-dd", si no null. */
export function parseDay(s: string | undefined | null): string | null {
  if (!s || !DAY_RE.test(s)) return null;
  const d = utc(s);
  return Number.isNaN(+d) || iso(d) !== s ? null : s;
}

export const addDays = (day: string, n: number) => iso(new Date(+utc(day) + n * 86_400_000));
export const daysBetween = (a: string, b: string) => Math.round((+utc(b) - +utc(a)) / 86_400_000);

export function addMonths(day: string, n: number) {
  const d = utc(day);
  const t = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const y = Math.floor(t / 12), m = t % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), 12)));
}

/** Lunes de la semana ISO que contiene `day`. */
export const weekStart = (day: string) => addDays(day, -((utc(day).getUTCDay() + 6) % 7));

export function isoWeek(day: string): { year: number; week: number } {
  const thu = utc(addDays(weekStart(day), 3));
  const year = thu.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1, 12);
  return { year, week: Math.floor((+thu - jan1) / 86_400_000 / 7) + 1 };
}

/** Lunes de la semana ISO `week` del año ISO `year` (si no existe, p. ej. la 53, usa la última). */
export function mondayOfIsoWeek(year: number, week: number) {
  const jan4 = iso(new Date(Date.UTC(year, 0, 4, 12)));
  const monday = addDays(weekStart(jan4), (week - 1) * 7);
  return isoWeek(monday).year === year ? monday : addDays(monday, -7);
}

export function periodOf(view: View, day: string): Period {
  switch (view) {
    case "dia": return { view, start: day, end: addDays(day, 1) };
    case "semana": { const s = weekStart(day); return { view, start: s, end: addDays(s, 7) }; }
    case "mes": { const s = `${day.slice(0, 7)}-01`; return { view, start: s, end: addMonths(s, 1) }; }
    case "anio": { const s = `${day.slice(0, 4)}-01-01`; return { view, start: s, end: `${Number(day.slice(0, 4)) + 1}-01-01` }; }
  }
}

export function shiftPeriod(p: Period, n: number): Period {
  switch (p.view) {
    case "dia": return periodOf("dia", addDays(p.start, n));
    case "semana": return periodOf("semana", addDays(p.start, 7 * n));
    case "mes": return periodOf("mes", addMonths(p.start, n));
    case "anio": return periodOf("anio", `${Number(p.start.slice(0, 4)) + n}-01-01`);
  }
}

export const previousPeriod = (p: Period) => shiftPeriod(p, -1);

/** Mismo periodo un año antes: mismo día, misma semana ISO, mismo mes; para el año, el año anterior. */
export function lastYearPeriod(p: Period): Period {
  switch (p.view) {
    case "dia": return periodOf("dia", addMonths(p.start, -12)); // 29 feb → 28 feb
    case "semana": {
      const { year, week } = isoWeek(p.start);
      return periodOf("semana", mondayOfIsoWeek(year - 1, week));
    }
    case "mes": return periodOf("mes", addMonths(p.start, -12));
    case "anio": return shiftPeriod(p, -1);
  }
}

export const isFuture = (p: Period, today: string) => p.start > today;
export const isCurrent = (p: Period, today: string) => p.start <= today && today < p.end;
/** El día del último periodo navegable (el actual). */
export const canGoNext = (p: Period, today: string) => shiftPeriod(p, 1).start <= today;

/** Días transcurridos del periodo hasta hoy incluido (periodo completo si ya terminó). */
export function elapsedDays(p: Period, today: string) {
  return Math.max(0, Math.min(daysBetween(p.start, p.end), daysBetween(p.start, today) + 1));
}

/** Recorta un periodo a `days` días desde su inicio (para comparar "hasta hoy" con rangos equivalentes). */
export const clampDays = (p: Period, days: number): Period => ({ ...p, end: addDays(p.start, Math.min(days, daysBetween(p.start, p.end))) });

/**
 * Rango justo para comparar. Día: no se recorta. Resto: si el periodo está en curso, se limita a los
 * días transcurridos; si ya terminó, es el periodo completo.
 */
export function elapsedRange(p: Period, today: string): { days: number; partial: boolean; range: Period } {
  const total = daysBetween(p.start, p.end);
  if (p.view === "dia" || !isCurrent(p, today)) return { days: total, partial: false, range: p };
  const days = elapsedDays(p, today);
  return { days, partial: days < total, range: clampDays(p, days) };
}

/** Límites reales (instantes) de un periodo en Madrid. */
export const bounds = (p: Period) => ({ from: localToDate(p.start, "00:00"), to: localToDate(p.end, "00:00") });

// ---------------------------------------------------------------- agregados

export type BillAppt = {
  id: string; starts_at: string; ends_at: string; total_cents: number; status: string;
  client_id: string | null; contact_email: string | null; user_id: string | null;
};

export const dayOf = (isoDate: string) => fmt(isoDate, "yyyy-MM-dd");
export const inRange = (a: { starts_at: string }, p: Period) => { const d = dayOf(a.starts_at); return d >= p.start && d < p.end; };
export const clientKey = (a: BillAppt) => a.client_id ?? a.contact_email?.toLowerCase() ?? a.user_id ?? a.id;

export type Stats = {
  revenue: number; paid: number; avgTicket: number | null;
  noShows: number; cancelled: number; pendingConfirm: number; pendingCents: number;
  clients: number;
};

export function stats(appts: BillAppt[], nowMs: number): Stats {
  let revenue = 0, paid = 0, noShows = 0, cancelled = 0, pendingConfirm = 0, pendingCents = 0;
  const who = new Set<string>();
  for (const a of appts) {
    if (a.status === "completed") { revenue += a.total_cents; paid++; who.add(clientKey(a)); }
    else if (a.status === "no_show") noShows++;
    else if (a.status === "cancelled") cancelled++;
    else if (a.status === "confirmed" && +new Date(a.ends_at) <= nowMs) { pendingConfirm++; pendingCents += a.total_cents; }
  }
  return { revenue, paid, avgTicket: paid ? Math.round(revenue / paid) : null, noShows, cancelled, pendingConfirm, pendingCents, clients: who.size };
}

export type Delta = { abs: number; pct: number | null };
/** Diferencia absoluta y porcentual; sin base (0 o dato ausente) → pct null ("—"). */
export function delta(cur: number | null, prev: number | null): Delta | null {
  if (cur == null || prev == null) return null;
  return { abs: cur - prev, pct: prev === 0 ? null : ((cur - prev) / prev) * 100 };
}

/** Clientes nuevos: su primera visita cobrada cae dentro del periodo. */
export const countNew = (firstVisits: (string | null)[], p: Period) =>
  firstVisits.reduce((n, f) => (f && inRange({ starts_at: f }, p) ? n + 1 : n), 0);

export type Bucket = { key: string; label: string; cents: number };

/** Ingresos (citas cobradas) por hora (día), por día (semana/mes) o por mes (año). */
export function revenueSeries(appts: BillAppt[], p: Period): Bucket[] {
  const paid = appts.filter((a) => a.status === "completed");
  if (p.view === "dia") {
    const sum = new Map<number, number>();
    for (const a of paid) { const h = Number(fmt(a.starts_at, "H")); sum.set(h, (sum.get(h) ?? 0) + a.total_cents); }
    const hs = [...sum.keys()];
    const lo = Math.min(9, ...hs), hi = Math.max(20, ...hs);
    return Array.from({ length: hi - lo + 1 }, (_, i) => ({ key: String(lo + i), label: String(lo + i), cents: sum.get(lo + i) ?? 0 }));
  }
  if (p.view === "anio") {
    const sum = new Map<string, number>();
    for (const a of paid) { const m = dayOf(a.starts_at).slice(0, 7); sum.set(m, (sum.get(m) ?? 0) + a.total_cents); }
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${p.start.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
      return { key, label: fmt(localToDate(`${key}-01`, "12:00"), "LLLLL").toUpperCase(), cents: sum.get(key) ?? 0 };
    });
  }
  const sum = new Map<string, number>();
  for (const a of paid) { const d = dayOf(a.starts_at); sum.set(d, (sum.get(d) ?? 0) + a.total_cents); }
  return Array.from({ length: daysBetween(p.start, p.end) }, (_, i) => {
    const key = addDays(p.start, i);
    return { key, label: p.view === "semana" ? fmt(localToDate(key, "12:00"), "EEEEE").toUpperCase() : String(Number(key.slice(8))), cents: sum.get(key) ?? 0 };
  });
}

/** Mejor cubo (primero en empate); null si no hay ingresos. */
export function bestBucket(series: Bucket[]): Bucket | null {
  let best: Bucket | null = null;
  for (const b of series) if (b.cents > 0 && (!best || b.cents > best.cents)) best = b;
  return best;
}

export type ServiceLine = { name: string; cents: number; count: number };
export function serviceBreakdown(
  appts: { status: string; appointment_services: { price_cents: number; services: { name: string } }[] }[],
): ServiceLine[] {
  const m = new Map<string, ServiceLine>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    for (const s of a.appointment_services) {
      const l = m.get(s.services.name) ?? { name: s.services.name, cents: 0, count: 0 };
      l.cents += s.price_cents; l.count++;
      m.set(s.services.name, l);
    }
  }
  return [...m.values()].sort((a, b) => b.cents - a.cents);
}

/** Ingreso por día (yyyy-MM-dd) de citas cobradas; sirve para el calendario. */
export function revenueByDay(appts: { starts_at: string; total_cents: number }[]) {
  const m = new Map<string, number>();
  for (const a of appts) { const d = dayOf(a.starts_at); m.set(d, (m.get(d) ?? 0) + a.total_cents); }
  return m;
}

/** URL de facturación para una vista anclada en `day` (y, opcionalmente, mes del calendario abierto). */
export function billingHref(view: View, day: string, cm?: string) {
  const u = new URLSearchParams({ v: view });
  if (view === "dia" || view === "semana") u.set("d", day);
  else if (view === "mes") u.set("m", day.slice(0, 7));
  else u.set("y", day.slice(0, 4));
  if (cm) u.set("cm", cm);
  return `/admin/facturacion?${u}`;
}
