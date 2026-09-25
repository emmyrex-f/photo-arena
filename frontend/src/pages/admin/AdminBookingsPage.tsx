import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import { addDays, format, getDaysInMonth, startOfMonth } from "date-fns";
import { Avatar, AvatarFallback } from "../../admin/components/ui/avatar";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { ConfirmDialog } from "../../admin/components/ui/confirm-dialog";
import { CreateBookingDialog } from "../../components/admin/CreateBookingDialog";
import { RecordPaymentDialog } from "../../components/admin/RecordPaymentDialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import { BookingStatusBadge } from "../../admin/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../../admin/components/ui/tabs";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatLagosDate,
  formatLagosTime,
  formatNairaFromKobo,
  humanize,
  initials,
  lagosToday,
  lagosYmd,
  parseYmd,
  toYmd,
} from "../../admin/lib/format";
import { hasDeskPermission } from "../../admin/lib/permissions";
import type {
  BookingRecord,
  BookingsDeskStats,
  DashboardPaymentStatus,
  PackageOption,
} from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";

const PAGE_SIZE = 8;

type StatusTab = "ALL" | "CONFIRMED" | "PENDING" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

const STATUS_TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All Bookings" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PENDING", label: "Pending" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "NO_SHOW", label: "No Show" },
];

function signedDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function pctHint(deltaPct: number | null, fallback: string): string {
  if (deltaPct == null) return fallback;
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct}% from last 30 days`;
}

function revenueHint(deltaPct: number | null, deltaKobo: number): string {
  if (deltaPct != null) {
    const sign = deltaPct > 0 ? "+" : "";
    return `${sign}${deltaPct}% from yesterday`;
  }
  const sign = deltaKobo > 0 ? "+" : deltaKobo < 0 ? "−" : "";
  return `${sign}${formatNairaFromKobo(Math.abs(deltaKobo))} from yesterday`;
}

function paidSuccessKobo(booking: BookingRecord): number {
  return (booking.payments ?? [])
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + p.amountKobo, 0);
}

function amountDueKobo(booking: BookingRecord): number {
  if (booking.amountKobo != null && booking.amountKobo > 0) return booking.amountKobo;
  return booking.package?.priceKobo ?? 0;
}

function paymentDisplay(booking: BookingRecord): DashboardPaymentStatus {
  const due = amountDueKobo(booking);
  const paid = paidSuccessKobo(booking);
  if (paid <= 0) return "UNPAID";
  if (paid >= due) return "PAID";
  return "PARTIAL";
}

/** Solid pills matching the bookings board reference. */
function PaymentPill({ status }: { status: DashboardPaymentStatus }) {
  if (status === "PAID") {
    return (
      <Badge className="rounded-full border-transparent bg-emerald-600 px-2.5 text-[11px] font-semibold text-white">
        Paid
      </Badge>
    );
  }
  if (status === "PARTIAL") {
    return (
      <Badge className="rounded-full border-transparent bg-amber-500 px-2.5 text-[11px] font-semibold text-amber-950">
        Partial
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full border-transparent bg-red-700 px-2.5 text-[11px] font-semibold text-white">
      Unpaid
    </Badge>
  );
}

function BoardStatusBadge({ status }: { status: BookingRecord["status"] }) {
  const className = (() => {
    switch (status) {
      case "CONFIRMED":
        return "rounded-full border-transparent bg-emerald-600 px-2.5 text-[11px] font-semibold text-white";
      case "PENDING":
        return "rounded-full border-transparent bg-amber-500 px-2.5 text-[11px] font-semibold text-amber-950";
      case "COMPLETED":
        return "rounded-full border-transparent bg-blue-600 px-2.5 text-[11px] font-semibold text-white";
      case "CANCELLED":
        return "rounded-full border-transparent bg-muted px-2.5 text-[11px] font-semibold text-muted-foreground";
      case "NO_SHOW":
        return "rounded-full border-transparent bg-destructive px-2.5 text-[11px] font-semibold text-white";
      case "TEMPORARY_HOLD":
        return "rounded-full border-transparent bg-violet-600 px-2.5 text-[11px] font-semibold text-white";
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  })();
  return (
    <Badge className={className}>
      {status === "TEMPORARY_HOLD" ? "Hold" : humanize(status)}
    </Badge>
  );
}

function formatCompactTime(iso: string): string {
  return formatLagosTime(iso);
}

function formatCompactDate(iso: string): string {
  return format(parseYmd(lagosYmd(iso)), "MMM d");
}

/** Monday–Sunday week containing Lagos YMD. */
function weekRangeContaining(ymd: string): { from: string; to: string } {
  const day = parseYmd(ymd);
  const mondayOffset = (day.getDay() + 6) % 7;
  const from = addDays(day, -mondayOffset);
  return { from: toYmd(from), to: toYmd(addDays(from, 6)) };
}

function formatWeekRangeLabel(from: string, to: string): string {
  return `${format(parseYmd(from), "MMM d, yyyy")} – ${format(parseYmd(to), "MMM d, yyyy")}`;
}

function pageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

function monthMatrix(ymd: string): Array<Array<string | null>> {
  const start = startOfMonth(parseYmd(ymd.slice(0, 7) + "-01"));
  const days = getDaysInMonth(start);
  const firstWeekday = (start.getDay() + 6) % 7; // Mon=0
  const cells: Array<string | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push(toYmd(addDays(start, d - 1)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function packageMeta(pkg: BookingRecord["package"]): string {
  const parts: string[] = [`${pkg.durationMinutes} min`];
  if (pkg.backdropCount) parts.push(`${pkg.backdropCount} backdrop${pkg.backdropCount === 1 ? "" : "s"}`);
  if (pkg.editedPhotoCount) parts.push(`${pkg.editedPhotoCount} photos`);
  return parts.join(" · ");
}

/** Reference table package line: "1 outfit, 15 min". */
function packageBoardMeta(pkg: BookingRecord["package"] | null | undefined): string {
  if (!pkg) return "—";
  const parts: string[] = [];
  if (pkg.outfitCount) {
    parts.push(`${pkg.outfitCount} outfit${pkg.outfitCount === 1 ? "" : "s"}`);
  }
  parts.push(`${pkg.durationMinutes} min`);
  return parts.join(", ");
}

export function AdminBookingsPage() {
  const api = useAdminApi();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = lagosToday();

  const selectedDate = params.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date")!)
    ? params.get("date")!
    : today;
  const selectedId = params.get("id");
  const q = (params.get("q") ?? "").trim();
  const statusTab = (params.get("tab") as StatusTab) || "ALL";

  const [monthCursor, setMonthCursor] = useState(() => selectedDate.slice(0, 7) + "-01");
  const [stats, setStats] = useState<BookingsDeskStats | null>(null);
  const [rows, setRows] = useState<BookingRecord[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [detail, setDetail] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [notesDraft, setNotesDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [createBookingOpen, setCreateBookingOpen] = useState(false);

  const canMutate = hasDeskPermission(user, "bookings") && (user?.role === "OWNER" || user?.role === "ADMIN");

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const monthStart = monthCursor.slice(0, 7) + "-01";
  const monthEnd = toYmd(addDays(startOfMonth(parseYmd(monthStart)), getDaysInMonth(parseYmd(monthStart)) - 1));

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes, pkgs] = await Promise.all([
        api.bookings.stats(),
        api.bookings.range({
          from: monthStart,
          to: monthEnd,
          q: q || undefined,
        }),
        api.bookings.packages(),
      ]);
      // Normalize older API shapes that lack totalAll so the page never crashes on render.
      const normalized: BookingsDeskStats = {
        totalAll: {
          count: statsRes.totalAll?.count ?? statsRes.totalLast30?.count ?? 0,
        },
        totalLast30: {
          count: statsRes.totalLast30?.count ?? 0,
          deltaPct: statsRes.totalLast30?.deltaPct ?? null,
        },
        today: {
          count: statsRes.today?.count ?? 0,
          delta: statsRes.today?.delta ?? 0,
        },
        todayRevenue: {
          totalKobo: statsRes.todayRevenue?.totalKobo ?? 0,
          deltaPct: statsRes.todayRevenue?.deltaPct ?? null,
          deltaKobo: statsRes.todayRevenue?.deltaKobo ?? 0,
        },
        unpaid: {
          count: statsRes.unpaid?.count ?? 0,
        },
      };
      setStats(normalized);
      setRows(Array.isArray(listRes) ? listRes : []);
      setPackages(Array.isArray(pkgs) ? pkgs : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setRows([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [api, monthEnd, monthStart, q]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setMonthCursor(selectedDate.slice(0, 7) + "-01");
  }, [selectedDate]);

  useEffect(() => {
    setPage(1);
  }, [selectedDate, statusTab, serviceFilter, packageFilter, paymentFilter, q]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void api.bookings
      .get(selectedId)
      .then((b) => {
        if (!cancelled) {
          setDetail(b);
          setNotesDraft(b.notes ?? "");
          setEditingNotes(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(errorMessage(err));
          setParam({ id: null });
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, setParam]);

  const weekRange = useMemo(() => weekRangeContaining(selectedDate), [selectedDate]);

  const weekRows = useMemo(
    () =>
      rows.filter((b) => {
        const y = lagosYmd(b.startTime);
        return y >= weekRange.from && y <= weekRange.to;
      }),
    [rows, weekRange.from, weekRange.to],
  );

  const filtered = useMemo(() => {
    return weekRows.filter((b) => {
      if (statusTab !== "ALL" && b.status !== statusTab) return false;
      if (serviceFilter !== "all" && b.package.service?.id !== serviceFilter) return false;
      if (packageFilter !== "all" && b.package.id !== packageFilter) return false;
      const pay = paymentDisplay(b);
      if (paymentFilter !== "all" && pay !== paymentFilter) return false;
      return true;
    });
  }, [weekRows, statusTab, serviceFilter, packageFilter, paymentFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const services = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of packages) {
      if (p.service) map.set(p.service.id, p.service.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [packages]);

  const packageOptions = useMemo(() => {
    if (serviceFilter === "all") return packages;
    return packages.filter((p) => p.serviceId === serviceFilter || p.service?.id === serviceFilter);
  }, [packages, serviceFilter]);

  const daysWithBookings = useMemo(() => {
    const set = new Set(rows.map((b) => lagosYmd(b.startTime)));
    return set;
  }, [rows]);

  async function saveNotes() {
    if (!detail) return;
    const updated = await api.bookings.update(detail.id, { notes: notesDraft });
    setDetail(updated);
    setEditingNotes(false);
    toast.success("Notes saved");
    await loadList();
  }

  async function confirmCancel() {
    if (!detail) return;
    const updated = await api.bookings.setStatus(detail.id, "CANCELLED");
    setDetail(updated);
    await loadList();
  }

  const monthLabel = format(parseYmd(monthStart), "MMMM yyyy");
  const canMarkPaid =
    canMutate &&
    Boolean(detail) &&
    detail?.status !== "CANCELLED" &&
    detail?.status !== "COMPLETED" &&
    paymentDisplay(detail!) !== "PAID";

  return (
    <div className="pa-bookings space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all studio bookings, view details, and update statuses.
          </p>
        </div>
        {canMutate && (
          <Button
            type="button"
            onClick={() => setCreateBookingOpen(true)}
            className="gap-2 shrink-0 font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        )}
      </header>

      <ErrorBanner message={error} onRetry={() => void loadList()} retrying={loading} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Booking metrics">
        <StatCard
          label="Total Bookings"
          icon={CalendarPlus}
          tone="primary"
          loading={loading}
          value={stats?.totalAll?.count ?? stats?.totalLast30?.count ?? "—"}
          hint={
            stats
              ? pctHint(
                  stats.totalLast30?.deltaPct ?? null,
                  `${stats.totalLast30?.count ?? 0} in last 30 days`,
                )
              : undefined
          }
        />
        <StatCard
          label="Today's Bookings"
          icon={CalendarIcon}
          loading={loading}
          value={stats?.today?.count ?? "—"}
          hint={stats?.today ? `${signedDelta(stats.today.delta)} from yesterday` : undefined}
        />
        <StatCard
          label="Today's Revenue"
          icon={Banknote}
          tone="success"
          loading={loading}
          value={
            stats?.todayRevenue != null
              ? formatNairaFromKobo(stats.todayRevenue.totalKobo)
              : "—"
          }
          hint={
            stats?.todayRevenue
              ? revenueHint(stats.todayRevenue.deltaPct, stats.todayRevenue.deltaKobo)
              : undefined
          }
        />
        <StatCard
          label="Pending / Unpaid"
          icon={AlertTriangle}
          tone="warning"
          loading={loading}
          value={stats?.unpaid?.count ?? "—"}
          hint={
            stats?.unpaid
              ? stats.unpaid.count === 0
                ? "All clear"
                : `${stats.unpaid.count} need${stats.unpaid.count === 1 ? "s" : ""} attention`
              : "Needs attention"
          }
        />
      </section>

      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusTab}
          onValueChange={(v) => setParam({ tab: v === "ALL" ? null : v })}
          className="min-w-0 flex-1"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-0 rounded-none border-0 bg-transparent p-0">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="rounded-none border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div
          className="mb-px inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          aria-label={`Week range ${formatWeekRangeLabel(weekRange.from, weekRange.to)}`}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="tabular-nums">{formatWeekRangeLabel(weekRange.from, weekRange.to)}</span>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-admin-stack",
          detail || detailLoading
            ? "xl:grid-cols-[17.5rem_minmax(0,1fr)_20rem]"
            : "xl:grid-cols-[17.5rem_minmax(0,1fr)]",
        )}
      >
        <aside className="space-y-admin-stack-sm">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-admin-card-sm pb-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() =>
                  setMonthCursor(toYmd(addDays(startOfMonth(parseYmd(monthStart)), -1)))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-sm font-medium">{monthLabel}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                onClick={() =>
                  setMonthCursor(
                    toYmd(addDays(startOfMonth(parseYmd(monthStart)), getDaysInMonth(parseYmd(monthStart)))),
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-admin-card-sm pt-0">
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {monthMatrix(monthStart).flatMap((week, wi) =>
                  week.map((day, di) => {
                    if (!day) return <span key={`${wi}-${di}`} className="h-8" />;
                    const isSelected = day === selectedDate;
                    const isToday = day === today;
                    const inWeek = day >= weekRange.from && day <= weekRange.to;
                    const has = daysWithBookings.has(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setParam({ date: day, id: null })}
                        className={cn(
                          "relative flex h-8 cursor-pointer items-center justify-center text-xs tabular-nums transition-colors",
                          isSelected
                            ? "rounded-full bg-primary font-semibold text-primary-foreground"
                            : "rounded-full text-foreground hover:bg-muted/50",
                          inWeek && !isSelected && "bg-primary/10",
                          isToday && !isSelected && "ring-1 ring-primary/40",
                        )}
                      >
                        {Number(day.slice(8))}
                        {has && !isSelected ? (
                          <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                        ) : null}
                      </button>
                    );
                  }),
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-admin-card-sm pb-2">
              <CardTitle className="text-sm font-medium">Quick Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-admin-card-sm pt-0">
              <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPackageFilter("all"); }}>
                <SelectTrigger aria-label="Filter by service" className="h-10">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger aria-label="Filter by package" className="h-10">
                  <SelectValue placeholder="All Package Options" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Package Options</SelectItem>
                  {packageOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger aria-label="Filter by payment status" className="h-10">
                  <SelectValue placeholder="All Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment Status</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </aside>

        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-admin-card-sm" aria-busy>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : pageRows.length === 0 ? (
              <EmptyState
                compact
                className="m-admin-card-sm border-0 bg-transparent"
                title="No bookings"
                description={
                  q
                    ? `No matches for “${q}” in this week.`
                    : `Nothing scheduled for ${formatWeekRangeLabel(weekRange.from, weekRange.to)}.`
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Time
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Customer
                      </TableHead>
                      <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                        Service
                      </TableHead>
                      <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                        Package
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Payment
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => {
                      const active = row.id === selectedId;
                      return (
                        <TableRow
                          key={row.id}
                          className={cn("cursor-pointer", active && "bg-muted/40")}
                          onClick={() => setParam({ id: row.id })}
                        >
                          <TableCell>
                            <div className="leading-tight">
                              <p className="tabular-nums text-sm font-semibold">
                                {formatCompactTime(row.startTime)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCompactDate(row.startTime)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-[10px]">
                                  {initials(row.customer.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{row.customer.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {row.customer.phone}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[10rem] truncate text-sm lg:table-cell">
                            {row.package.service?.name ?? "—"}
                          </TableCell>
                          <TableCell className="hidden max-w-[9rem] truncate text-sm text-muted-foreground md:table-cell">
                            {packageBoardMeta(row.package)}
                          </TableCell>
                          <TableCell>
                            <BoardStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell>
                            <PaymentPill status={paymentDisplay(row)} />
                          </TableCell>
                          <TableCell>
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filtered.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-border px-admin-card-sm py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {pageRows.length} of {filtered.length} booking
                  {filtered.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={safePage <= 1}
                    aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {pageItems(safePage, pageCount).map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`e-${idx}`}
                        className="px-1.5 text-xs text-muted-foreground"
                        aria-hidden
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        aria-label={`Page ${item}`}
                        aria-current={item === safePage ? "page" : undefined}
                        onClick={() => setPage(item)}
                        className={cn(
                          "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-xs tabular-nums transition-colors",
                          item === safePage
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {item}
                      </button>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={safePage >= pageCount}
                    aria-label="Next page"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {detailLoading || detail ? (
          <BookingDetailPanel
            loading={detailLoading}
            booking={detail}
            notesDraft={notesDraft}
            editingNotes={editingNotes}
            canMutate={canMutate}
            canMarkPaid={Boolean(canMarkPaid)}
            onClose={() => setParam({ id: null })}
            onNotesChange={setNotesDraft}
            onEditNotes={() => setEditingNotes(true)}
            onCancelEditNotes={() => {
              setEditingNotes(false);
              setNotesDraft(detail?.notes ?? "");
            }}
            onSaveNotes={() => void saveNotes()}
            onCancel={() => setCancelOpen(true)}
            onMarkPaid={() => setMarkPaidOpen(true)}
          />
        ) : null}
      </div>

      <CreateBookingDialog
        open={createBookingOpen}
        onOpenChange={setCreateBookingOpen}
        defaultDate={selectedDate}
        onSuccess={(created) => {
          setDetail(created);
          void loadList();
          setParam({ id: created.id, date: lagosYmd(created.startTime) });
        }}
      />

      <RecordPaymentDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        booking={detail}
        onSuccess={(updated) => {
          setDetail(updated);
          void loadList();
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel booking"
        description={
          detail ? (
            <>
              Cancel the session for <strong>{detail.customer.name}</strong>? This cannot be undone
              by the customer.
            </>
          ) : null
        }
        confirmLabel="Cancel booking"
        destructive
        successMessage="Booking cancelled"
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function BookingDetailPanel({
  loading,
  booking,
  notesDraft,
  editingNotes,
  canMutate,
  canMarkPaid,
  onClose,
  onNotesChange,
  onEditNotes,
  onCancelEditNotes,
  onSaveNotes,
  onCancel,
  onMarkPaid,
}: {
  loading: boolean;
  booking: BookingRecord | null;
  notesDraft: string;
  editingNotes: boolean;
  canMutate: boolean;
  canMarkPaid: boolean;
  onClose: () => void;
  onNotesChange: (v: string) => void;
  onEditNotes: () => void;
  onCancelEditNotes: () => void;
  onSaveNotes: () => void;
  onCancel: () => void;
  onMarkPaid: () => void;
}) {
  if (loading || !booking) {
    return (
      <Card className="h-fit">
        <CardContent className="space-y-3 p-admin-card-sm" aria-busy>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const due = amountDueKobo(booking);
  const paid = paidSuccessKobo(booking);
  const payStatus = paymentDisplay(booking);
  const discount =
    booking.source === "ONLINE" && booking.package.priceKobo > due
      ? booking.package.priceKobo - due
      : 0;

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-admin-card-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-display text-lg font-normal">Booking Details</CardTitle>
            <BookingStatusBadge status={booking.status} />
          </div>
          <button
            type="button"
            className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Back to list
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-admin-card-sm pt-0">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials(booking.customer.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium">{booking.customer.name}</p>
            <DetailLine icon={<Phone className="h-3.5 w-3.5" />} text={booking.customer.phone} />
            {booking.customer.email ? (
              <DetailLine icon={<Mail className="h-3.5 w-3.5" />} text={booking.customer.email} />
            ) : null}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <DetailLine
            icon={<CalendarIcon className="h-3.5 w-3.5" />}
            text={formatLagosDate(booking.startTime)}
          />
          <DetailLine
            icon={<CalendarIcon className="h-3.5 w-3.5" />}
            text={`${formatLagosTime(booking.startTime)} – ${formatLagosTime(booking.endTime)}`}
          />
          <DetailLine
            icon={<MapPin className="h-3.5 w-3.5" />}
            text="Photo Arena Studio, Lagos, Nigeria"
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="font-medium">{booking.package.service?.name ?? booking.package.name}</p>
          {booking.package.outfitCount ? (
            <Badge variant="outline" className="mt-1">
              {booking.package.outfitCount} outfit{booking.package.outfitCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">{packageMeta(booking.package)}</p>
          <p className="mt-2 text-sm font-semibold tabular-nums">
            {formatNairaFromKobo(booking.package.priceKobo)}
          </p>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Studio price</span>
            <span className="tabular-nums">{formatNairaFromKobo(booking.package.priceKobo)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Online discount (5%)</span>
              <span className="tabular-nums text-[var(--color-success)]">
                −{formatNairaFromKobo(discount)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="font-medium">
              {payStatus === "PAID" ? "Total paid" : "Amount due"}
            </span>
            <span className="flex items-center gap-2 font-semibold tabular-nums text-primary">
              {formatNairaFromKobo(payStatus === "PAID" ? paid : Math.max(0, due - paid))}
              <PaymentPill status={payStatus} />
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-medium">Booking notes</p>
            {canMutate && !editingNotes ? (
              <Button type="button" variant="ghost" size="sm" onClick={onEditNotes}>
                Edit
              </Button>
            ) : null}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notesDraft}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={3}
                aria-label="Booking notes"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onSaveNotes}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancelEditNotes}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {booking.notes?.trim() || "No notes yet."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {canMutate && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {canMarkPaid ? (
            <Button type="button" size="sm" onClick={onMarkPaid}>
              Record Payment
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="text-muted-foreground/80" aria-hidden>
        {icon}
      </span>
      <span className="truncate">{text}</span>
    </p>
  );
}
