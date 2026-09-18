export const LAGOS = "Africa/Lagos";

/** Lagos is UTC+1 all year (no DST). */
export const LAGOS_OFFSET_MINUTES = 60;

/** Today's calendar date in Lagos as YYYY-MM-DD. */
export function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS }).format(new Date());
}

/** Calendar date (YYYY-MM-DD) in Lagos for an instant. */
export function lagosDateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS }).format(new Date(date));
}

/** Adds `days` to a YYYY-MM-DD key without timezone drift. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday … 6 = Saturday) for a YYYY-MM-DD key. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isSundayKey(key: string): boolean {
  return weekdayOfKey(key) === 0;
}

/** Formats a YYYY-MM-DD key for display, e.g. "Tue 15 Sep". */
export function formatDateKey(key: string, options?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...options,
  }).format(utc);
}

export function formatLagosDate(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatLagosLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatLagosTime(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatLagosRange(startIso: string, endIso: string): string {
  return `${formatLagosTime(startIso)} – ${formatLagosTime(endIso)}`;
}

export function formatLagosDateTime(iso: string): string {
  return `${formatLagosLongDate(iso)}, ${formatLagosTime(iso)}`;
}

/** Long-form publish date for articles: "12 September 2026". */
export function formatPublishDate(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Formats a duration in minutes as "1 hr 30 min" / "45 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
  return `${hours} hr ${rest} min`;
}

/** Remaining milliseconds until an ISO instant (never negative). */
export function msUntil(iso: string): number {
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** UTC timestamp in iCalendar basic format (YYYYMMDDTHHMMSSZ). */
export function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
