export const BOOKING_RULES = {
  slotIncrementMinutes: 30,
  bufferMinutes: 0,
  sameDayMinimumNoticeMinutes: 120,
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

export function openingHoursForYmd(ymd: string) {
  return lagosWeekday(ymd) === 0 ? SUNDAY_OPEN : WEEKDAY_OPEN;
}

export function openingHoursFor(date: Date) {
  return openingHoursForYmd(toLagosYmd(date));
}

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

export function generateCandidateStartsForYmd(ymd: string): Date[] {
  const hours = openingHoursForYmd(ymd);
  const starts: Date[] = [];
  let minutes = hours.startHour * 60;
  const closeMinutes = hours.endHour * 60;
  while (minutes < closeMinutes) {
    starts.push(lagosDateTime(ymd, Math.floor(minutes / 60), minutes % 60));
    minutes += BOOKING_RULES.slotIncrementMinutes;
  }
  return starts;
}

export function generateCandidateStarts(date: Date): Date[] {
  return generateCandidateStartsForYmd(toLagosYmd(date));
}

export function slotFits(
  start: Date,
  durationMinutes: number,
  now: Date,
  existing: Array<{ startTime: Date; endTime: Date }>,
  options?: { requireSameDayNotice?: boolean },
): boolean {
  const requireSameDayNotice = options?.requireSameDayNotice ?? true;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const ymd = toLagosYmd(start);
  const hours = openingHoursForYmd(ymd);
  const close = lagosDateTime(ymd, hours.endHour, 0);
  if (end > close) return false;

  if (requireSameDayNotice && toLagosYmd(start) === toLagosYmd(now)) {
    const minStart = new Date(now.getTime() + BOOKING_RULES.sameDayMinimumNoticeMinutes * 60_000);
    if (start < minStart) return false;
  }

  return !existing.some((booking) => rangesOverlap(start, end, booking.startTime, booking.endTime));
}
