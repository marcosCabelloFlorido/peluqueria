// Lógica pura del mini CRM (sin acceso a datos): estadísticas de cliente, inactividad, búsqueda y enlaces.

const DAY = 86_400_000;

export type CrmAppt = {
  starts_at: string; status: string; total_cents: number;
  appointment_services: { price_cents: number; services: { name: string } }[];
};

export type ClientSummary = {
  visits: number; total: number; avgTicket: number | null;
  firstVisit: string | null; lastVisit: string | null; nextAppt: string | null;
  topService: string | null; avgGapDays: number | null;
};

export function clientSummary(appts: CrmAppt[], now: number): ClientSummary {
  const done = appts.filter((a) => a.status === "completed").sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const total = done.reduce((s, a) => s + a.total_cents, 0);
  const count = new Map<string, number>();
  for (const a of done) for (const s of a.appointment_services) count.set(s.services.name, (count.get(s.services.name) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  const next = appts.filter((a) => a.status === "confirmed" && +new Date(a.starts_at) > now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  const gap = done.length > 1 ? (+new Date(done[done.length - 1].starts_at) - +new Date(done[0].starts_at)) / DAY / (done.length - 1) : null;
  return {
    visits: done.length, total, avgTicket: done.length ? Math.round(total / done.length) : null,
    firstVisit: done[0]?.starts_at ?? null, lastVisit: done[done.length - 1]?.starts_at ?? null,
    nextAppt: next?.starts_at ?? null, topService: top?.[0] ?? null, avgGapDays: gap == null ? null : Math.round(gap),
  };
}

/** Instante límite: quien tenga su última visita anterior a esto lleva más de `days` días sin venir. */
export const inactiveCutoff = (days: number, now: number) => new Date(now - days * DAY).toISOString();

/** "Te echamos de menos": con visitas, la última hace más de `days` días y sin cita futura. */
export function isInactive(c: { visits: number; last_visit: string | null; next_appt: string | null }, days: number, now: number) {
  return c.visits > 0 && !!c.last_visit && +new Date(c.last_visit) < now - days * DAY && !c.next_appt;
}

/** Texto de búsqueda seguro para un filtro `.or()` de PostgREST (sin separadores ni comodines). */
export const cleanSearch = (q: string) => q.replace(/[,()%*\\"'\u0000]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export function waLink(phone: string) {
  const n = phone.replace(/\D/g, "");
  return `https://wa.me/${n.length === 9 ? "34" + n : n}`;
}
export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
