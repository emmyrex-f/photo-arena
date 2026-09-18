import { addDays, format, parse, startOfWeek } from "date-fns";
import { formatNairaFromKobo } from "../../data/packages";
import { formatLagosDate, formatLagosTime, lagosToday, LAGOS } from "../../lib/datetime";

export { formatNairaFromKobo, formatLagosDate, formatLagosTime, lagosToday };

/** Lagos is UTC+1 all year (no DST). */
export const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** `YYYY-MM-DD` (Lagos calendar day) for an ISO instant. */
export function lagosYmd(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS }).format(new Date(iso));
}

/** Lagos wall-clock parts for an ISO instant. */
export function lagosParts(iso: string | Date): { hour: number; minute: number; minutesOfDay: number } {
  const shifted = new Date(new Date(iso).getTime() + LAGOS_OFFSET_MS);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return { hour, minute, minutesOfDay: hour * 60 + minute };
}

/** Build an ISO instant from a Lagos calendar date + wall-clock time. */
export function lagosDateTimeIso(ymd: string, hour: number, minute = 0): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00+01:00`).toISOString();
}

/** Parse `YYYY-MM-DD` as a local calendar date (for date-only arithmetic). */
export function parseYmd(ymd: string): Date {
  return parse(ymd, "yyyy-MM-dd", new Date());
}

export function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function addYmdDays(ymd: string, days: number): string {
  return toYmd(addDays(parseYmd(ymd), days));
}

/** Monday-start week containing `ymd`. */
export function weekOf(ymd: string): string[] {
  const start = startOfWeek(parseYmd(ymd), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => toYmd(addDays(start, i)));
}

/** 0 = Sunday … 6 = Saturday for a `YYYY-MM-DD`. */
export function ymdWeekday(ymd: string): number {
  return parseYmd(ymd).getDay();
}

/** Opening hours (Lagos) per confirmed requirements D-01. */
export function openingHoursForYmd(ymd: string): { startHour: number; endHour: number } {
  return ymdWeekday(ymd) === 0 ? { startHour: 12, endHour: 18 } : { startHour: 8, endHour: 18 };
}

export function formatYmd(ymd: string, pattern = "EEE d MMM yyyy"): string {
  return format(parseYmd(ymd), pattern);
}

/** "Sat 13 Sep, 2:30 PM" in Lagos time. */
export function formatLagosDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${formatLagosDate(iso)}, ${formatLagosTime(iso)}`;
}

/** Full date with year: "13 Sep 2026" in Lagos time. */
export function formatLagosFullDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ${suffix}`;
  return formatLagosFullDate(iso);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/** "₦25,000" → 2_500_000 kobo. Accepts commas and a ₦ prefix. */
export function nairaInputToKobo(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const naira = Number(cleaned);
  if (!Number.isFinite(naira)) return null;
  return Math.round(naira * 100);
}

export function koboToNairaInput(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "";
  return String(Math.round(kobo / 100));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function copyToClipboard(text: string) {
  return navigator.clipboard?.writeText(text);
}
