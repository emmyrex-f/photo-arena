import { toIcsUtc } from "./datetime";

export type CalendarBooking = {
  id: string;
  reference: string | null;
  startTime: string;
  endTime: string;
  package: { name: string; durationMinutes: number };
};

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(booking: CalendarBooking, location: string): string {
  const uid = `${booking.reference ?? booking.id}@photoarenang.com`;
  const summary = icsEscape(`Photo Arena — ${booking.package.name}`);
  const description = icsEscape(
    `Booking ${booking.reference ?? booking.id}. Photo Arena, Port Harcourt. Bring this reference.`,
  );
  const loc = icsEscape(location);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Photo Arena//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(booking.startTime)}`,
    `DTEND:${toIcsUtc(booking.endTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${loc}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Photo Arena session tomorrow",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Photo Arena session in 2 hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function googleCalendarUrl(booking: CalendarBooking, location: string): string {
  const dates = `${toIcsUtc(booking.startTime)}/${toIcsUtc(booking.endTime)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Photo Arena — ${booking.package.name}`,
    dates,
    details: `Booking ${booking.reference ?? booking.id}\nPhoto Arena, Port Harcourt`,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(booking: CalendarBooking, location: string) {
  const blob = new Blob([buildIcs(booking, location)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `photo-arena-${booking.reference ?? booking.id}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
