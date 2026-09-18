import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, ChevronLeft, ChevronRight, CalendarDays, ChevronRight as OpenIcon, Search } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { ConfirmDialog } from "../../admin/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { MoneyInput } from "../../admin/components/ui/money-input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../admin/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../admin/components/ui/sheet";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  bookingCalendarTone,
} from "../../admin/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger } from "../../admin/components/ui/tabs";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  addYmdDays,
  formatDuration,
  formatLagosDateTime,
  formatLagosTime,
  formatNairaFromKobo,
  formatYmd,
  humanize,
  lagosParts,
  lagosToday,
  lagosYmd,
  openingHoursForYmd,
  weekOf,
} from "../../admin/lib/format";
import type { BookingRecord, BookingStatus, Payment } from "../../admin/lib/types";
import { BOOKING_STATUSES } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { useSiteInfo } from "../../lib/settings";

const AGENDA_DAYS = 14;
const HOUR_PX = 88;
const TIME_GUTTER = "3.5rem";

function isQuietBooking(booking: BookingRecord): boolean {
  return booking.status === "CANCELLED" || booking.status === "TEMPORARY_HOLD";
}

function paymentSummary(booking: BookingRecord): { amount: string; status: Payment["status"] | null; label: string } {
  const paid = booking.payments.find((p) => p.status === "SUCCESS");
  const latest = paid ?? booking.payments[0] ?? null;
  const amountKobo = latest?.amountKobo ?? booking.amountKobo ?? null;
  const amount = amountKobo != null ? formatNairaFromKobo(amountKobo) : "—";
  if (!latest) return { amount, status: null, label: amountKobo != null ? "Unpaid" : "—" };
  if (latest.status === "SUCCESS") return { amount, status: latest.status, label: "Paid" };
  if (latest.status === "FAILED") return { amount, status: latest.status, label: "Failed" };
  if (latest.status === "PROCESSING") return { amount, status: latest.status, label: "Processing" };
  return { amount, status: latest.status, label: "Pending" };
}

function packageLabel(booking: BookingRecord): string {
  const service = booking.package.service?.name?.trim() ?? "";
  const name = booking.package.name.trim();
  const duration = formatDuration(booking.package.durationMinutes);
  const title =
    service && !name.toLowerCase().includes(service.toLowerCase()) ? `${service} · ${name}` : name;
  if (/\d+\s*(min|h)\b/i.test(title)) return title;
  return `${title} · ${duration}`;
}

function dayHeading(ymd: string, today: string): string {
  const label = formatYmd(ymd, "EEEE d MMM");
  if (ymd === today) return `${label} · Today`;
  if (ymd === addYmdDays(today, 1)) return `${label} · Tomorrow`;
  return label;
}

function hoursForDay(ymd: string, unifyWeek = false): number[] {
  const { startHour, endHour } = unifyWeek
    ? { startHour: 8, endHour: 18 }
    : openingHoursForYmd(ymd);
  const out: number[] = [];
  for (let h = startHour; h < endHour; h++) out.push(h);
  return out;
}

function formatHourLabel(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12} ${ampm}`;
}

function statusLabel(status: BookingStatus): string {
  return status === "TEMPORARY_HOLD" ? "Hold" : humanize(status);
}

function BookingCard({
  booking,
  onClick,
  gridStartMinutes,
  compact,
}: {
  booking: BookingRecord;
  onClick: () => void;
  gridStartMinutes: number;
  compact?: boolean;
}) {
  const start = lagosParts(booking.startTime).minutesOfDay;
  const end = lagosParts(booking.endTime).minutesOfDay;
  const top = ((start - gridStartMinutes) / 60) * HOUR_PX;
  const height = Math.max(20, ((end - start) / 60) * HOUR_PX - 4);
  const tone = bookingCalendarTone[booking.status];
  const quiet = isQuietBooking(booking);
  const showTime = height >= 28;
  const showService = height >= 38;
  const showStatus = !compact && height >= 62;
  const horizontal = !compact && height < 52;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-md text-left ring-1 ring-inset transition hover:brightness-110",
        tone.card,
        quiet && "opacity-70",
        horizontal && "flex items-center gap-2 py-0",
      )}
      style={{ top, height: horizontal ? Math.max(height, 36) : height }}
      title={`${formatLagosTime(booking.startTime)} · ${booking.customer.name} · ${packageLabel(booking)} · ${statusLabel(booking.status)}`}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", tone.bar)} />
      {horizontal ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1 pl-2.5 pr-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
              {formatLagosTime(booking.startTime)}
            </span>
            <span className={cn("max-w-[10rem] truncate text-xs font-semibold", quiet && "line-through")}>
              {booking.customer.name}
            </span>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{packageLabel(booking)}</span>
          </span>
          <span className="shrink-0 text-[10px] font-medium text-foreground/70">{statusLabel(booking.status)}</span>
        </span>
      ) : (
        <span className="flex h-full flex-col justify-center gap-0.5 py-1 pl-2.5 pr-1.5">
          {showTime ? (
            <span className="text-[10px] font-medium leading-none tabular-nums text-muted-foreground">
              {formatLagosTime(booking.startTime)}
            </span>
          ) : null}
          <span className={cn("truncate text-xs font-semibold leading-tight", quiet && "line-through")}>
            {booking.customer.name}
          </span>
          {showService ? (
            <span className="truncate text-[10px] leading-tight text-muted-foreground">{packageLabel(booking)}</span>
          ) : null}
          {showStatus ? (
            <span className="mt-0.5 truncate text-[10px] font-medium leading-none text-muted-foreground">
              {statusLabel(booking.status)}
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
}

function CalendarDayHeader({ ymd, today }: { ymd: string; today: string }) {
  const isToday = ymd === today;
  return (
    <div className="flex flex-col items-center justify-center gap-1 border-l border-border/50 px-2 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {formatYmd(ymd, "EEE")}
      </span>
      <span
        className={cn(
          "flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums",
          isToday ? "bg-primary text-primary-foreground" : "text-foreground",
        )}
      >
        {formatYmd(ymd, "d")}
      </span>
    </div>
  );
}

function CalendarBoard({
  days,
  week,
  today,
  loading,
  bookingsByDay,
  quietHidden,
  onOpen,
}: {
  days: string[];
  week: boolean;
  today: string;
  loading: boolean;
  bookingsByDay: Map<string, BookingRecord[]>;
  quietHidden: boolean;
  onOpen: (id: string) => void;
}) {
  const hours = hoursForDay(days[0] ?? today, week);
  const gridStart = (hours[0] ?? 8) * 60;
  const totalH = hours.length * HOUR_PX;
  const colMin = week ? "7rem" : "12rem";
  const now = lagosParts(new Date());
  const nowTop = ((now.minutesOfDay - gridStart) / 60) * HOUR_PX;
  const gridEnd = (hours[hours.length - 1] ?? 17) * 60 + 60;
  const showNow = now.minutesOfDay >= gridStart && now.minutesOfDay < gridEnd;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-admin-card">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-h-[min(72vh,46rem)] overflow-auto rounded-2xl border border-border/60 bg-card">
      <div style={{ minWidth: week ? `max(100%, calc(${TIME_GUTTER} + ${days.length} * 7rem))` : undefined }}>
        <div className="sticky top-0 z-20 flex border-b border-border/50 bg-card">
          <div className="sticky left-0 z-30 shrink-0 bg-card" style={{ width: TIME_GUTTER }} />
          {days.map((day) => (
            <div key={day} className="min-w-0 flex-1" style={{ minWidth: colMin }}>
              <CalendarDayHeader ymd={day} today={today} />
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: TIME_GUTTER, height: totalH }}>
            {hours.map((hour, i) => (
              <div key={hour} className="relative" style={{ height: HOUR_PX }}>
                <span
                  className={cn(
                    "absolute right-2 text-[11px] font-medium tabular-nums text-muted-foreground",
                    i === 0 ? "top-1" : "-top-2",
                  )}
                >
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const open = openingHoursForYmd(day);
            const dayBookings = bookingsByDay.get(day) ?? [];
            const closedTop = Math.max(0, ((open.startHour * 60 - gridStart) / 60) * HOUR_PX);
            const closedBottomStart = ((open.endHour * 60 - gridStart) / 60) * HOUR_PX;
            const isToday = day === today;
            return (
              <div
                key={day}
                className="relative min-w-0 flex-1 border-l border-border/40"
                style={{ minWidth: colMin, height: totalH }}
              >
                {hours.map((hour) => (
                  <div key={`${day}-${hour}`} className="relative border-t border-border/35" style={{ height: HOUR_PX }}>
                    <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-border/25" />
                  </div>
                ))}
                {closedTop > 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0 bg-muted/30" style={{ height: closedTop }} />
                ) : null}
                {closedBottomStart < totalH ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bg-muted/30"
                    style={{ top: closedBottomStart, height: totalH - closedBottomStart }}
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-0">
                  <div className="pointer-events-auto relative h-full">
                    {dayBookings.map((b) => {
                      if (isQuietBooking(b) && quietHidden) return null;
                      const start = lagosParts(b.startTime).minutesOfDay;
                      if (start < gridStart) return null;
                      return (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          gridStartMinutes={gridStart}
                          compact={week}
                          onClick={() => onOpen(b.id)}
                        />
                      );
                    })}
                  </div>
                </div>
                {isToday && showNow ? (
                  <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
                    <span className="h-2 w-2 shrink-0 -translate-x-0.5 rounded-full bg-primary" />
                    <span className="h-px flex-1 bg-primary" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AdminBookingsPage() {
  const api = useAdminApi();
  const { user } = useAuth();
  const { hoursWeekday, hoursSunday } = useSiteInfo();
  const manage = canManageBookings(user?.role);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");

  const [view, setView] = useState<"agenda" | "day" | "week">("agenda");
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("day");
  const [cursor, setCursor] = useState(lagosToday);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "">("");
  const [showQuiet, setShowQuiet] = useState(false);
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<BookingRecord | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(lagosToday);
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    if (view === "week") {
      const days = weekOf(cursor);
      return { from: days[0], to: days[6], days };
    }
    if (view === "agenda") {
      const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addYmdDays(cursor, i));
      return { from: days[0]!, to: days[AGENDA_DAYS - 1]!, days };
    }
    return { from: cursor, to: cursor, days: [cursor] };
  }, [cursor, view]);

  const listQuery = useQuery(
    () => api.bookings.range({ from: range.from, to: range.to, status: statusFilter, q: q.trim() || undefined }),
    [range.from, range.to, statusFilter, q],
  );

  const packagesQuery = useQuery(() => api.bookings.packages(), [], { enabled: manage });

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await api.bookings.get(selectedId);
        if (!cancelled) {
          setDetail(row);
          setNotesDraft(row.notes ?? "");
        }
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err, "Could not load booking"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId]);

  function openBooking(id: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", id);
      return next;
    });
  }

  function closeDetail() {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("id");
      return next;
    });
    setDetail(null);
  }

  async function refresh() {
    await listQuery.refetch();
    if (selectedId) {
      const row = await api.bookings.get(selectedId);
      setDetail(row);
      setNotesDraft(row.notes ?? "");
    }
  }

  async function saveNotes() {
    if (!detail) return;
    setBusy(true);
    try {
      await api.bookings.update(detail.id, { notes: notesDraft });
      toast.success("Notes saved");
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "COMPLETED" | "NO_SHOW" | "CANCELLED") {
    if (!detail) return;
    setBusy(true);
    try {
      await api.bookings.setStatus(detail.id, status);
      toast.success(`Marked ${status.toLowerCase().replace("_", " ")}`);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const rescheduleSlotsQuery = useQuery(
    () =>
      api.bookings.availability(
        rescheduleDate,
        detail?.package.durationMinutes ?? 60,
      ),
    [rescheduleDate, detail?.package.durationMinutes],
    { enabled: rescheduleOpen && !!detail },
  );

  useEffect(() => {
    const first = rescheduleSlotsQuery.data?.slots[0] ?? "";
    setRescheduleSlot((cur) => (rescheduleSlotsQuery.data?.slots.includes(cur) ? cur : first));
  }, [rescheduleSlotsQuery.data]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingRecord[]>();
    for (const day of range.days) map.set(day, []);
    for (const b of listQuery.data ?? []) {
      const key = lagosYmd(b.startTime);
      const list = map.get(key);
      if (list) list.push(b);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [listQuery.data, range.days]);

  const agendaGroups = useMemo(() => {
    const today = lagosToday();
    const searching = Boolean(q.trim()) || Boolean(statusFilter);
    const includeQuiet = showQuiet || searching;
    const groups: Array<{ day: string; live: BookingRecord[]; quiet: BookingRecord[] }> = [];
    for (const day of range.days) {
      const rows = bookingsByDay.get(day) ?? [];
      const live = rows.filter((b) => !isQuietBooking(b));
      const quiet = rows.filter((b) => isQuietBooking(b));
      if (live.length === 0 && (quiet.length === 0 || !includeQuiet)) continue;
      groups.push({ day, live, quiet: includeQuiet ? quiet : [] });
    }
    return { groups, today, quietHidden: !includeQuiet };
  }, [bookingsByDay, range.days, q, statusFilter, showQuiet]);

  const navStep = view === "agenda" ? AGENDA_DAYS : view === "week" ? 7 : 1;
  const pageTab = view === "agenda" ? "agenda" : "calendar";

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Bookings"
        description={`Mon–Sat ${hoursWeekday} · Sunday ${hoursSunday} · Africa/Lagos`}
        actions={
          manage ? (
            <Button className="w-full sm:w-auto" onClick={() => setNewOpen(true)}>
              <CalendarPlus />
              New reservation
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={pageTab}
              onValueChange={(v) => setView(v === "agenda" ? "agenda" : calendarMode)}
            >
              <TabsList>
                <TabsTrigger value="agenda">Agenda</TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarDays className="h-3.5 w-3.5" /> Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {pageTab === "calendar" ? (
              <Tabs value={calendarMode} onValueChange={(v) => {
                const mode = v as "day" | "week";
                setCalendarMode(mode);
                setView(mode);
              }}>
                <TabsList className="h-8">
                  <TabsTrigger value="day" className="h-6 px-2.5 text-xs">Day</TabsTrigger>
                  <TabsTrigger value="week" className="h-6 px-2.5 text-xs">Week</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pageTab === "calendar" ? (
              <>
                <div className="inline-flex items-center rounded-lg border border-border/70 bg-card">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCursor((c) => addYmdDays(c, -navStep))}
                    aria-label="Previous"
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="min-w-[8.75rem] px-1 text-center text-sm font-medium tabular-nums">
                    {view === "week"
                      ? `${formatYmd(range.from, "d MMM")} – ${formatYmd(range.to, "d MMM")}`
                      : formatYmd(cursor, "EEE d MMM")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCursor((c) => addYmdDays(c, navStep))}
                    aria-label="Next"
                  >
                    <ChevronRight />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCursor(lagosToday)}>
                  Today
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCursor((c) => addYmdDays(c, -navStep))}
                  aria-label="Previous"
                >
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCursor(lagosToday)}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCursor((c) => addYmdDays(c, navStep))}
                  aria-label="Next"
                >
                  <ChevronRight />
                </Button>
                <span className="text-sm font-medium">
                  {`${formatYmd(range.from, "d MMM")} – ${formatYmd(range.to, "d MMM yyyy")}`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, reference…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
              aria-label="Search bookings"
            />
          </div>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : (v as BookingStatus))}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {BOOKING_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "TEMPORARY_HOLD" ? "Hold" : s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusFilter ? null : (
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showQuiet} onCheckedChange={setShowQuiet} aria-label="Show holds and cancelled" />
              Holds & cancelled
            </label>
          )}
        </div>
      </div>

      <ErrorBanner message={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.fetching} />

      {view === "agenda" ? (
        <AgendaList
          loading={listQuery.loading}
          groups={agendaGroups.groups}
          today={agendaGroups.today}
          quietHidden={agendaGroups.quietHidden}
          onOpen={openBooking}
        />
      ) : (
        <CalendarBoard
          days={range.days}
          week={view === "week"}
          today={agendaGroups.today}
          loading={listQuery.loading}
          bookingsByDay={bookingsByDay}
          quietHidden={agendaGroups.quietHidden}
          onOpen={openBooking}
        />
      )}

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && closeDetail()}>
        <SheetContent className="sm:max-w-lg">
          {!detail ? (
            <div className="space-y-3 pt-8">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{detail.customer.name}</SheetTitle>
                <SheetDescription>
                  {formatLagosDateTime(detail.startTime)} · {packageLabel(detail)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <BookingStatusBadge status={detail.status} />
                  <span className="text-xs text-muted-foreground">{detail.source}</span>
                  {detail.reference ? (
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">{detail.reference}</span>
                  ) : null}
                </div>
                <div className="grid gap-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Phone:</span> {detail.customer.phone}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email:</span> {detail.customer.email || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Amount:</span>{" "}
                    {detail.amountKobo != null ? formatNairaFromKobo(detail.amountKobo) : "—"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} disabled={!manage} />
                  {manage ? (
                    <Button size="sm" onClick={() => void saveNotes()} loading={busy}>
                      Save notes
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                  {detail.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments recorded</p>
                  ) : (
                    detail.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded border border-border px-3 py-3 text-sm">
                        <span>
                          {formatNairaFromKobo(p.amountKobo)} · {p.method === "STUDIO" ? "Studio" : "Online"}
                        </span>
                        <PaymentStatusBadge status={p.status} />
                      </div>
                    ))
                  )}
                </div>

                {manage ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button size="sm" onClick={() => { setPayAmount(detail.amountKobo ?? null); setPayOpen(true); }}>
                      Record payment
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setRescheduleDate(lagosYmd(detail.startTime)); setRescheduleOpen(true); }}>
                      Reschedule
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus("COMPLETED")}>
                      Complete
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus("NO_SHOW")}>
                      No-show
                    </Button>
                    <ConfirmDialog
                      title="Cancel booking?"
                      description="This marks the session cancelled. Holds and pending payments may be affected."
                      confirmLabel="Cancel booking"
                      destructive
                      successMessage="Booking cancelled"
                      onConfirm={() => api.bookings.setStatus(detail.id, "CANCELLED").then(() => refresh())}
                      trigger={
                        <Button size="sm" variant="destructive">
                          Cancel
                        </Button>
                      }
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record studio payment</DialogTitle>
            <DialogDescription>Optional amount override in naira.</DialogDescription>
          </DialogHeader>
          <FormField label="Amount">
            {(c) => <MoneyInput id={c.id} valueKobo={payAmount} onChangeKobo={setPayAmount} />}
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Close
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                if (!detail) return;
                setBusy(true);
                void api.bookings
                  .recordPayment(detail.id, payAmount != null ? { amountKobo: payAmount } : undefined)
                  .then(() => {
                    toast.success("Payment recorded");
                    setPayOpen(false);
                    return refresh();
                  })
                  .catch((err) => toast.error(errorMessage(err)))
                  .finally(() => setBusy(false));
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule</DialogTitle>
            <DialogDescription>
              Moving a booking records a <strong>15% reschedule fee</strong> as a pending studio payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Date">
              {(c) => (
                <Input
                  id={c.id}
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Start time">
              {(c) => (
                <Select value={rescheduleSlot} onValueChange={setRescheduleSlot}>
                  <SelectTrigger id={c.id}>
                    <SelectValue placeholder="Pick a slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rescheduleSlotsQuery.data?.slots ?? []).map((iso) => (
                      <SelectItem key={iso} value={iso}>
                        {formatLagosTime(iso)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            {rescheduleSlotsQuery.error ? <p className="text-sm text-destructive">{rescheduleSlotsQuery.error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
              Close
            </Button>
            <Button
              loading={busy}
              disabled={!rescheduleSlot}
              onClick={() => {
                if (!detail || !rescheduleSlot) return;
                setBusy(true);
                void api.bookings
                  .reschedule(detail.id, rescheduleSlot)
                  .then(() => {
                    toast.success("Rescheduled (15% fee pending)");
                    setRescheduleOpen(false);
                    return refresh();
                  })
                  .catch((err) => toast.error(errorMessage(err)))
                  .finally(() => setBusy(false));
              }}
            >
              Confirm reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {manage ? (
        <NewReservationDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          packages={packagesQuery.data ?? []}
          onCreated={async (id) => {
            setNewOpen(false);
            await listQuery.refetch();
            openBooking(id);
          }}
        />
      ) : null}
    </div>
  );
}

function AgendaList({
  loading,
  groups,
  today,
  quietHidden,
  onOpen,
}: {
  loading: boolean;
  groups: Array<{ day: string; live: BookingRecord[]; quiet: BookingRecord[] }>;
  today: string;
  quietHidden: boolean;
  onOpen: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No sessions in this window"
        description={
          quietHidden
            ? "Holds and cancelled bookings are hidden. Turn them on, search, or pick another date."
            : "Nothing is booked in this range. Create a reservation or move the date window."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.day} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {dayHeading(group.day, today)}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[5.5rem_minmax(0,1.1fr)_minmax(0,1.4fr)_7.5rem_7rem_5.5rem] md:gap-3">
              <span>Time</span>
              <span>Customer</span>
              <span>Package</span>
              <span>Payment</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <ul>
              {group.live.map((booking) => (
                <AgendaRow key={booking.id} booking={booking} onOpen={onOpen} />
              ))}
              {group.quiet.map((booking) => (
                <AgendaRow key={booking.id} booking={booking} onOpen={onOpen} quiet />
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}

function AgendaRow({
  booking,
  onOpen,
  quiet = false,
}: {
  booking: BookingRecord;
  onOpen: (id: string) => void;
  quiet?: boolean;
}) {
  const pay = paymentSummary(booking);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(booking.id)}
        className={cn(
          "grid w-full gap-1 border-t border-border px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-muted/40 md:grid-cols-[5.5rem_minmax(0,1.1fr)_minmax(0,1.4fr)_7.5rem_7rem_5.5rem] md:items-center md:gap-3",
          quiet && "bg-muted/20 text-muted-foreground",
        )}
      >
        <p className="font-medium tabular-nums text-foreground">{formatLagosTime(booking.startTime)}</p>
        <div className="min-w-0">
          <p className={cn("truncate font-medium", quiet ? "text-muted-foreground" : "text-foreground")}>
            {booking.customer.name}
          </p>
          <p className="truncate text-xs text-muted-foreground md:hidden">{packageLabel(booking)}</p>
        </div>
        <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">{packageLabel(booking)}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm md:block">
          <span className="tabular-nums">{pay.amount}</span>
          <span className="text-xs text-muted-foreground">{pay.label}</span>
        </div>
        <div>
          <BookingStatusBadge status={booking.status} className={cn(quiet && "opacity-80")} />
        </div>
        <span className="hidden items-center justify-end gap-1 text-sm font-medium text-primary md:inline-flex">
          Open
          <OpenIcon className="h-3.5 w-3.5" />
        </span>
      </button>
    </li>
  );
}

function NewReservationDialog({
  open,
  onOpenChange,
  packages,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    service: { name: string };
  }>;
  onCreated: (id: string) => Promise<void>;
}) {
  const api = useAdminApi();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [packageId, setPackageId] = useState("");
  const [date, setDate] = useState(lagosToday);
  const [startTime, setStartTime] = useState("");
  const [source, setSource] = useState<"WALK_IN" | "ADMIN">("WALK_IN");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const selected = packages.find((p) => p.id === packageId) ?? packages[0];

  useEffect(() => {
    if (open && packages[0] && !packageId) setPackageId(packages[0].id);
  }, [open, packages, packageId]);

  const slotsQuery = useQuery(
    () => api.bookings.availability(date, selected?.durationMinutes ?? 60),
    [date, selected?.durationMinutes],
    { enabled: open && !!selected },
  );

  useEffect(() => {
    const first = slotsQuery.data?.slots[0] ?? "";
    setStartTime((cur) => (slotsQuery.data?.slots.includes(cur) ? cur : first));
  }, [slotsQuery.data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected || !startTime) return;
    setPending(true);
    try {
      const created = await api.bookings.create({
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        packageId: selected.id,
        startTime,
        source,
        notes: notes || undefined,
      });
      toast.success("Reservation created");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setNotes("");
      await onCreated(created.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>Walk-in or desk booking for an available Lagos slot.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Customer name" required>
            {(c) => <Input id={c.id} value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />}
          </FormField>
          <FormField label="Phone" required>
            {(c) => <Input id={c.id} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />}
          </FormField>
          <FormField label="Email">
            {(c) => <Input id={c.id} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />}
          </FormField>
          <FormField label="Package" required>
            {(c) => (
              <Select value={selected?.id} onValueChange={setPackageId}>
                <SelectTrigger id={c.id}>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.service.name} · {p.name} ({formatDuration(p.durationMinutes)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Date" required>
              {(c) => <Input id={c.id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}
            </FormField>
            <FormField label="Start" required>
              {(c) => (
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger id={c.id}>
                    <SelectValue placeholder="Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {(slotsQuery.data?.slots ?? []).map((iso) => (
                      <SelectItem key={iso} value={iso}>
                        {formatLagosTime(iso)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>
          <FormField label="Source">
            {(c) => (
              <Select value={source} onValueChange={(v) => setSource(v as "WALK_IN" | "ADMIN")}>
                <SelectTrigger id={c.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WALK_IN">Walk-in</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Notes">
            {(c) => <Textarea id={c.id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!startTime}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
