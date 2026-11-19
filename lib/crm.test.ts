import { describe, expect, it } from "vitest";
import { cleanSearch, clientSummary, inactiveCutoff, isInactive, waLink, type CrmAppt } from "./crm";

const now = +new Date("2026-11-19T12:00:00Z");
const a = (starts_at: string, status: string, total_cents: number, svc: string[] = ["Corte"]): CrmAppt => ({
  starts_at, status, total_cents, appointment_services: svc.map((name) => ({ price_cents: total_cents, services: { name } })),
});

describe("clientSummary", () => {
  it("cliente sin visitas", () => {
    expect(clientSummary([a("2026-12-01T10:00:00Z", "confirmed", 1500)], now)).toMatchObject({ visits: 0, total: 0, avgTicket: null, lastVisit: null, nextAppt: "2026-12-01T10:00:00Z", avgGapDays: null });
  });
  it("estadísticas con varias visitas", () => {
    const s = clientSummary([
      a("2026-09-01T10:00:00Z", "completed", 1500),
      a("2026-10-01T10:00:00Z", "completed", 2000, ["Corte", "Barba"]),
      a("2026-10-31T10:00:00Z", "completed", 1500),
      a("2026-10-15T10:00:00Z", "no_show", 1500),
      a("2026-08-01T10:00:00Z", "cancelled", 1500),
    ], now);
    expect(s.visits).toBe(3);
    expect(s.total).toBe(5000);
    expect(s.avgTicket).toBe(1667);
    expect(s.topService).toBe("Corte");
    expect(s.lastVisit).toBe("2026-10-31T10:00:00Z");
    expect(s.firstVisit).toBe("2026-09-01T10:00:00Z");
    expect(s.avgGapDays).toBe(30);
  });
  it("ignora citas confirmadas ya pasadas al buscar la próxima", () => {
    expect(clientSummary([a("2026-11-01T10:00:00Z", "confirmed", 1500)], now).nextAppt).toBeNull();
  });
});

describe("inactividad", () => {
  const base = { visits: 2, last_visit: "2026-10-01T10:00:00Z", next_appt: null };
  it("más de N días sin venir y sin cita futura", () => {
    expect(isInactive(base, 30, now)).toBe(true);
    expect(isInactive({ ...base, last_visit: "2026-11-10T10:00:00Z" }, 30, now)).toBe(false);
    expect(isInactive({ ...base, next_appt: "2026-12-01T10:00:00Z" }, 30, now)).toBe(false);
    expect(isInactive({ visits: 0, last_visit: null, next_appt: null }, 30, now)).toBe(false);
  });
  it("cutoff", () => {
    expect(inactiveCutoff(30, now)).toBe("2026-10-20T12:00:00.000Z");
  });
});

describe("utilidades", () => {
  it("búsqueda sin caracteres de filtro", () => {
    expect(cleanSearch(" ana,(x)%* ")).toBe("ana x");
  });
  it("whatsapp con prefijo de España", () => {
    expect(waLink("612 34 56 78")).toBe("https://wa.me/34612345678");
    expect(waLink("+34 612345678")).toBe("https://wa.me/34612345678");
  });
});
