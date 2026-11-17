import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

export const TZ = "Europe/Madrid";
export const fmt = (d: Date | string, f: string) =>
  formatInTimeZone(d, TZ, f, { locale: es });
export const euro = (cents: number) =>
  (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });
export const localToDate = (day: string, hm: string) => fromZonedTime(`${day}T${hm}:00`, TZ);
export const todayMadrid = () => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
