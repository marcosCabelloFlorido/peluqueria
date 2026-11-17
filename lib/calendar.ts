import { formatInTimeZone } from "date-fns-tz";

const LOCATION = process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? "DouceCreative";
const stamp = (d: Date | string) => formatInTimeZone(d, "UTC", "yyyyMMdd'T'HHmmss'Z'");

export function googleCalendarUrl(a: { starts_at: string; ends_at: string; services: string }) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `DouceCreative — ${a.services}`,
    dates: `${stamp(a.starts_at)}/${stamp(a.ends_at)}`,
    details: "Cita en DouceCreative",
    location: LOCATION,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function icsFile(a: { id: string; starts_at: string; ends_at: string; services: string }) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DouceCreative//ES", "BEGIN:VEVENT",
    `UID:${a.id}@doucecreative`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(a.starts_at)}`, `DTEND:${stamp(a.ends_at)}`,
    `SUMMARY:DouceCreative — ${a.services}`, `LOCATION:${LOCATION}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Cita", "TRIGGER:-PT60M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export const whatsappUrl = (text: string) =>
  `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? ""}?text=${encodeURIComponent(text)}`;
