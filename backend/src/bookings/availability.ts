export const BOOKING_RULES = {
  slotIncrementMinutes: 30,
  bufferMinutes: 0,
  sameDayMinimumNoticeMinutes: 0,
  holdDurationMinutes: 15,
  timezone: "Africa/Lagos",
} as const;

export const WEEKDAY_OPEN = { startHour: 8, endHour: 18 };
export const SUNDAY_OPEN = { startHour: 12, endHour: 18 };

const LAGOS = "Africa/Lagos";
const LAGOS_OFFSET = "+01:00";

export function toLagosYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS }).format(date);
}

export function toLagosHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: LAGOS,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
}

export function startOfLagosDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${LAGOS_OFFSET}`);
}

export function lagosDateTime(ymd: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00${LAGOS_OFFSET}`);
}

export function addLagosDays(ymd: string, days: number): string {
  return toLagosYmd(new Date(startOfLagosDay(ymd).getTime() + days * 86_400_000));
}

export function lagosWeekday(ymd: string): number {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: LAGOS,
  }).format(startOfLagosDay(ymd));
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? 0;
}

export interface ParsedHours {
  isOpen: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export function parseOpeningHours(raw?: string | null): ParsedHours | null {
  if (!raw || typeof raw !== "string") return null;
  const str = raw.trim();
  if (!str) return null;

  if (/^(closed|off|none|n\/a)$/i.test(str)) {
    return { isOpen: false, startHour: 0, startMinute: 0, endHour: 0, endMinute: 0 };
  }

  // Look for range separators: –, —, -, or 'to'
  const parts = str.split(/[\–\—\-\~]|(?:\s+to\s+)/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  function parseTimePart(timeStr: string): { hour: number; minute: number } | null {
    const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    let hour = parseInt(match[1]!, 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (hour < 0 || hour > 24 || minute < 0 || minute >= 60) return null;
    return { hour, minute };
  }

  const start = parseTimePart(parts[0]!);
  const end = parseTimePart(parts[1]!);
  if (!start || !end) return null;

  const startTotalMinutes = start.hour * 60 + start.minute;
  const endTotalMinutes = end.hour * 60 + end.minute;
  if (endTotalMinutes <= startTotalMinutes) return null;

  return {
    isOpen: true,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

export function openingHoursForYmd(
  ymd: string,
  cmsHours?: { weekday?: string; sunday?: string; [key: string]: string | undefined } | null,
): {
  startHour: number;
  endHour: number;
  isOpen?: boolean;
  startMinute?: number;
  endMinute?: number;
} {
  const isSunday = lagosWeekday(ymd) === 0;
  if (cmsHours) {
    const raw = isSunday
      ? (cmsHours["site.hours.sunday"] ?? cmsHours.sunday)
      : (cmsHours["site.hours.weekday"] ?? cmsHours.weekday);
    if (raw) {
      const parsed = parseOpeningHours(raw);
      if (parsed) {
        if (!parsed.isOpen) {
          return { startHour: 0, endHour: 0, isOpen: false, startMinute: 0, endMinute: 0 };
        }
        return {
          startHour: parsed.startHour,
          endHour: parsed.endHour,
          isOpen: true,
          startMinute: parsed.startMinute,
          endMinute: parsed.endMinute,
        };
      }
    }
  }

  return isSunday ? { ...SUNDAY_OPEN } : { ...WEEKDAY_OPEN };
}

export function openingHoursFor(
  date: Date,
  cmsHours?: { weekday?: string; sunday?: string; [key: string]: string | undefined } | null,
) {
  return openingHoursForYmd(toLagosYmd(date), cmsHours);
}

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

export function generateCandidateStartsForYmd(
  ymd: string,
  cmsHours?: Record<string, string> | null,
): Date[] {
  const hours = openingHoursForYmd(ymd, cmsHours);
  if (hours.isOpen === false || (hours.startHour === 0 && hours.endHour === 0)) {
    return [];
  }
  const starts: Date[] = [];
  const startMinute = hours.startMinute ?? 0;
  const endMinute = hours.endMinute ?? 0;
  let minutes = hours.startHour * 60 + startMinute;
  const closeMinutes = hours.endHour * 60 + endMinute;
  while (minutes < closeMinutes) {
    starts.push(lagosDateTime(ymd, Math.floor(minutes / 60), minutes % 60));
    minutes += BOOKING_RULES.slotIncrementMinutes;
  }
  return starts;
}

export function generateCandidateStarts(date: Date, cmsHours?: Record<string, string> | null): Date[] {
  return generateCandidateStartsForYmd(toLagosYmd(date), cmsHours);
}

export function slotFits(
  start: Date,
  durationMinutes: number,
  now: Date,
  existing: Array<{ startTime: Date; endTime: Date }>,
  options?: {
    requireSameDayNotice?: boolean;
    /** Only for re-placing an already-held booking (payment confirmation), never for new bookings. */
    allowStarted?: boolean;
    cmsHours?: Record<string, string> | null;
  },
): boolean {
  const allowStarted = options?.allowStarted ?? false;
  const requireSameDayNotice = !allowStarted && (options?.requireSameDayNotice ?? true);
  if (!allowStarted && start.getTime() <= now.getTime()) return false;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const ymd = toLagosYmd(start);
  const hours = openingHoursForYmd(ymd, options?.cmsHours);

  if (hours.isOpen === false || (hours.startHour === 0 && hours.endHour === 0)) {
    return false;
  }

  const open = lagosDateTime(ymd, hours.startHour, hours.startMinute ?? 0);
  const close = lagosDateTime(ymd, hours.endHour, hours.endMinute ?? 0);
  if (start < open || end > close) return false;

  if (requireSameDayNotice && toLagosYmd(start) === toLagosYmd(now)) {
    const minStart = new Date(now.getTime() + BOOKING_RULES.sameDayMinimumNoticeMinutes * 60_000);
    if (start < minStart) return false;
  }

  return !existing.some((booking) => rangesOverlap(start, end, booking.startTime, booking.endTime));
}

