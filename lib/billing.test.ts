import { describe, expect, it } from "vitest";
import {
  addMonths, bestBucket, bounds, canGoNext, clampDays, clientKey, countNew, delta, elapsedRange, isoWeek, lastYearPeriod,
  mondayOfIsoWeek, parseDay, periodOf, previousPeriod, revenueSeries, serviceBreakdown, shiftPeriod, stats, weekStart,
  type BillAppt,
} from "./billing";

const appt = (over: Partial<BillAppt> & { starts_at: string }): BillAppt => ({
  id: over.starts_at, ends_at: new Date(+new Date(over.starts_at) + 1800_000).toISOString(), total_cents: 1500, status: "completed",
  client_id: null, contact_email: null, user_id: null, ...over,
});

describe("periodos", () => {
  it("parseDay valida fechas reales", () => {
    expect(parseDay("2026-11-19")).toBe("2026-11-19");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("hola")).toBeNull();
  });
  it("semana ISO lunes-domingo", () => {
    expect(weekStart("2026-11-19")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(periodOf("semana", "2026-11-22")).toEqual({ view: "semana", start: "2026-11-16", end: "2026-11-23" });
  });
  it("mes y año", () => {
    expect(periodOf("mes", "2026-02-10")).toEqual({ view: "mes", start: "2026-02-01", end: "2026-03-01" });
    expect(periodOf("anio", "2026-06-10")).toEqual({ view: "anio", start: "2026-01-01", end: "2027-01-01" });
  });
  it("addMonths recorta fin de mes", () => {
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("anterior", () => {
    expect(previousPeriod(periodOf("dia", "2026-03-01")).start).toBe("2026-02-28");
    expect(previousPeriod(periodOf("semana", "2026-11-19")).start).toBe("2026-11-09");
    expect(previousPeriod(periodOf("mes", "2026-01-15"))).toEqual({ view: "mes", start: "2025-12-01", end: "2026-01-01" });
    expect(previousPeriod(periodOf("anio", "2026-05-05")).start).toBe("2025-01-01");
  });
  it("mismo periodo del año pasado", () => {
    expect(lastYearPeriod(periodOf("dia", "2024-02-29")).start).toBe("2023-02-28");
    expect(lastYearPeriod(periodOf("mes", "2026-11-19"))).toEqual({ view: "mes", start: "2025-11-01", end: "2025-12-01" });
    expect(lastYearPeriod(periodOf("anio", "2026-11-19")).start).toBe("2025-01-01");
  });
  it("semana ISO del año pasado", () => {
    expect(isoWeek("2026-11-19")).toEqual({ year: 2026, week: 47 });
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
    expect(isoWeek("2025-12-29")).toEqual({ year: 2026, week: 1 });
    expect(mondayOfIsoWeek(2025, 47)).toBe("2025-11-17");
    expect(lastYearPeriod(periodOf("semana", "2026-11-19")).start).toBe("2025-11-17");
    // la semana 53 de 2026 no existe en 2025: usa la 52
    expect(lastYearPeriod(periodOf("semana", "2027-01-01")).start).toBe("2024-12-23".replace("2024-12-23", mondayOfIsoWeek(2025, 52)));
  });
  it("shift y navegación", () => {
    const m = periodOf("mes", "2026-11-19");
    expect(shiftPeriod(m, -11).start).toBe("2025-12-01");
    expect(canGoNext(m, "2026-11-19")).toBe(false);
    expect(canGoNext(previousPeriod(m), "2026-11-19")).toBe(true);
    expect(canGoNext(periodOf("dia", "2026-11-18"), "2026-11-19")).toBe(true);
  });
});

describe("rango transcurrido", () => {
  it("periodo en curso se recorta a los días vividos", () => {
    const m = periodOf("mes", "2026-11-19");
    const e = elapsedRange(m, "2026-11-19");
    expect(e).toMatchObject({ days: 19, partial: true });
    expect(e.range.end).toBe("2026-11-20");
    expect(clampDays(previousPeriod(m), e.days).end).toBe("2026-11-20".replace("11-20", "10-20"));
  });
  it("periodo cerrado o día no se recorta", () => {
    expect(elapsedRange(periodOf("mes", "2026-10-10"), "2026-11-19").partial).toBe(false);
    expect(elapsedRange(periodOf("dia", "2026-11-19"), "2026-11-19").partial).toBe(false);
  });
  it("clampDays no pasa del final del periodo comparado", () => {
    expect(clampDays(periodOf("mes", "2026-02-01"), 30).end).toBe("2026-03-01");
  });
});

describe("DST", () => {
  it("el día del cambio de hora de primavera dura 23 h y el de otoño 25 h", () => {
    const h = (day: string) => { const b = bounds(periodOf("dia", day)); return (+b.to - +b.from) / 3600_000; };
    expect(h("2026-03-29")).toBe(23);
    expect(h("2026-10-25")).toBe(25);
    expect(h("2026-11-19")).toBe(24);
  });
  it("un corte a las 23:30 de Madrid cae en su día local", () => {
    const p = periodOf("dia", "2026-03-28");
    const { from, to } = bounds(p);
    expect(from.toISOString()).toBe("2026-03-27T23:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });
});

describe("agregados", () => {
  const list = [
    appt({ starts_at: "2026-11-02T09:00:00Z", client_id: "a", total_cents: 2000 }),
    appt({ starts_at: "2026-11-02T10:00:00Z", client_id: "a", total_cents: 1000 }),
    appt({ starts_at: "2026-11-03T10:00:00Z", client_id: "b", total_cents: 3000 }),
    appt({ starts_at: "2026-11-04T10:00:00Z", status: "no_show" }),
    appt({ starts_at: "2026-11-05T10:00:00Z", status: "cancelled" }),
    appt({ starts_at: "2026-11-06T10:00:00Z", status: "confirmed", total_cents: 1700 }),
    appt({ starts_at: "2099-11-06T10:00:00Z", status: "confirmed" }),
  ];
  const now = +new Date("2026-11-19T12:00:00Z");
  it("KPIs", () => {
    expect(stats(list, now)).toEqual({
      revenue: 6000, paid: 3, avgTicket: 2000, noShows: 1, cancelled: 1, pendingConfirm: 1, pendingCents: 1700, clients: 2,
    });
    expect(stats([], now).avgTicket).toBeNull();
  });
  it("clave de cliente", () => {
    expect(clientKey(appt({ starts_at: "2026-11-01T10:00:00Z", contact_email: "A@B.es" }))).toBe("a@b.es");
    expect(clientKey(appt({ starts_at: "2026-11-01T10:00:00Z", client_id: "c", contact_email: "a@b.es" }))).toBe("c");
  });
  it("delta: sin base → pct null", () => {
    expect(delta(150, 100)).toEqual({ abs: 50, pct: 50 });
    expect(delta(50, 100)).toEqual({ abs: -50, pct: -50 });
    expect(delta(10, 0)).toEqual({ abs: 10, pct: null });
    expect(delta(null, 5)).toBeNull();
  });
  it("clientes nuevos", () => {
    const p = periodOf("mes", "2026-11-10");
    expect(countNew(["2026-11-02T10:00:00Z", "2026-10-31T22:30:00Z", null, "2026-12-01T00:00:00Z"], p)).toBe(1);
  });
  it("serie por día y mejor día", () => {
    const s = revenueSeries(list, periodOf("semana", "2026-11-02"));
    expect(s).toHaveLength(7);
    expect(s[0]).toMatchObject({ key: "2026-11-02", cents: 3000, label: "L" });
    expect(bestBucket(s)).toMatchObject({ key: "2026-11-02" });
    expect(bestBucket(revenueSeries([], periodOf("mes", "2026-11-02")))).toBeNull();
  });
  it("serie por mes y por hora", () => {
    const y = revenueSeries(list, periodOf("anio", "2026-11-02"));
    expect(y).toHaveLength(12);
    expect(y[10].cents).toBe(6000);
    const d = revenueSeries(list, periodOf("dia", "2026-11-02"));
    expect(d[0].key).toBe("9");
    expect(d.find((b) => b.key === "10")?.cents).toBe(2000);
  });
  it("desglose por servicio", () => {
    const r = serviceBreakdown([
      { status: "completed", appointment_services: [{ price_cents: 1500, services: { name: "Corte" } }, { price_cents: 500, services: { name: "Barba" } }] },
      { status: "completed", appointment_services: [{ price_cents: 1500, services: { name: "Corte" } }] },
      { status: "cancelled", appointment_services: [{ price_cents: 900, services: { name: "Tinte" } }] },
    ]);
    expect(r).toEqual([{ name: "Corte", cents: 3000, count: 2 }, { name: "Barba", cents: 500, count: 1 }]);
  });
});
