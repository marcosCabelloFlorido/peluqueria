import { describe, expect, it } from "vitest";
import { computeSlots, type Hours } from "./slots";

const hours: Hours[] = [
  { weekday: 1, opens: "10:00", closes: "14:00" },
  { weekday: 1, opens: "16:30", closes: "20:30" },
  { weekday: 6, opens: "10:00", closes: "14:00" },
];
const base = { hours, busy: [], now: new Date("2026-01-01T00:00:00Z"), stepMin: 15, minNoticeMin: 60 };
// 2026-11-16 es lunes; 2026-11-15 domingo
describe("computeSlots", () => {
  it("día cerrado", () => {
    expect(computeSlots({ ...base, day: "2026-11-15", durationMin: 30 })).toEqual([]);
  });
  it("turno partido", () => {
    const s = computeSlots({ ...base, day: "2026-11-16", durationMin: 30 });
    expect(s).toContain("13:30");
    expect(s).not.toContain("14:00");
    expect(s).not.toContain("15:00");
    expect(s).toContain("16:30");
  });
  it("servicio que no cabe al final", () => {
    const s = computeSlots({ ...base, day: "2026-11-16", durationMin: 45 });
    expect(s).toContain("13:15");
    expect(s).not.toContain("13:30");
  });
  it("solape parcial", () => {
    const s = computeSlots({
      ...base, day: "2026-11-16", durationMin: 30,
      busy: [{ starts_at: "2026-11-16T09:15:00Z", ends_at: "2026-11-16T09:45:00Z" }], // 10:15-10:45 Madrid
    });
    expect(s).toContain("10:00".replace("10:00", "10:45"));
    expect(s).not.toContain("10:00");
    expect(s).not.toContain("10:30");
  });
  it("antelación mínima", () => {
    const s = computeSlots({ ...base, day: "2026-11-16", durationMin: 30, now: new Date("2026-11-16T09:00:00Z") }); // 10:00 Madrid
    expect(s[0]).toBe("11:00");
  });
  it("cambio de hora (octubre 2026, último domingo = 25)", () => {
    const s = computeSlots({ ...base, day: "2026-10-26", durationMin: 30 });
    expect(s[0]).toBe("10:00");
  });
});
