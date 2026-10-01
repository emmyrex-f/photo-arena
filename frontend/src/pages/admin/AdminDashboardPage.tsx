import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ImageIcon,
  ImagePlus,
  Inbox,
  LayoutGrid,
  LineChart as LineChartIcon,
  Plus,
  ShieldAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback } from "../../admin/components/ui/avatar";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import { BookingStatusBadge } from "../../admin/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatNairaFromKobo,
  initials,
  lagosYmd,
} from "../../admin/lib/format";
import type {
  DashboardData,
  DashboardPaymentStatus,
  DashboardUpcomingBooking,
  DashboardWeeklyRevenue,
} from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { CreateBookingDialog } from "../../components/admin/CreateBookingDialog";
import { addDaysToKey, formatDateKey, lagosDateKey, LAGOS } from "../../lib/datetime";
import { useSetting } from "../../lib/settings";
import { cn } from "../../lib/cn";

type AttentionTone = "danger" | "info" | "warning" | "muted";

type AttentionRowDef = {
  key: "newEnquiries" | "noShowFollowUp" | "failedPayments";
  label: (count: number) => string;
  to: string;
  Icon: LucideIcon;
  tone: AttentionTone;
};

const ATTENTION_ROWS: AttentionRowDef[] = [
  {
    key: "newEnquiries",
    label: (n) => (n === 1 ? "New enquiry" : "New enquiries"),
    to: "/admin/enquiries?tab=NEW",
    Icon: Inbox,
    tone: "info",
  },
  {
    key: "noShowFollowUp",
    label: (n) =>
      n === 1 ? "Upcoming no-show follow-up" : "Upcoming no-show follow-ups",
    to: "/admin/bookings?tab=NO_SHOW",
    Icon: Eye,
    tone: "warning",
  },
  {
    key: "failedPayments",
    label: (n) => (n === 1 ? "Failed payment" : "Failed payments"),
    to: "/admin/payments?status=FAILED",
    Icon: ShieldAlert,
    tone: "muted",
  },
];

const QUICK_ACTIONS: Array<{ label: string; to: string; icon: LucideIcon }> = [
  { label: "View Bookings", to: "/admin/bookings", icon: Calendar },
  { label: "Add Service", to: "/admin/services", icon: Plus },
  { label: "Upload Media", to: "/admin/gallery", icon: ImagePlus },
];

function formatLongLagosDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCompactTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function formatUpcomingDayLabel(ymd: string, todayYmd: string): string {
  if (ymd === addDaysToKey(todayYmd, 1)) return "Tomorrow";
  return formatDateKey(ymd, { weekday: "short", month: "short", day: "numeric" });
}

function formatWeekRangeLabel(weekStart: string, weekEnd: string, isCurrentWeek: boolean): string {
  if (isCurrentWeek) return "This week";
  const fmt = (ymd: string, withYear: boolean) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat("en-NG", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" as const } : {}),
    }).format(utc);
  };
  return `${fmt(weekStart, false)} – ${fmt(weekEnd, true)}`;
}

function groupUpcomingBookings(
  bookings: DashboardUpcomingBooking[],
  todayYmd: string,
): Array<{ key: string; label: string; rows: DashboardUpcomingBooking[] }> {
  const groups: Array<{ key: string; label: string; rows: DashboardUpcomingBooking[] }> = [];
  for (const booking of bookings) {
    const key = lagosDateKey(booking.startTime);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(booking);
      continue;
    }
    groups.push({
      key,
      label: formatUpcomingDayLabel(key, todayYmd),
      rows: [booking],
    });
  }
  return groups;
}

function signedDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function revenueDeltaHint(deltaPct: number | null, deltaKobo: number): string {
  if (deltaPct != null) {
    const sign = deltaPct > 0 ? "+" : "";
    return `${sign}${deltaPct}% from yesterday`;
  }
  const sign = deltaKobo > 0 ? "+" : deltaKobo < 0 ? "−" : "";
  return `${sign}${formatNairaFromKobo(Math.abs(deltaKobo))} from yesterday`;
}

function shiftMonthKey(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

function periodDeltaHint(
  period: "week" | "month",
  deltaPct: number | null | undefined,
  totalKobo: number,
  isCurrent?: boolean,
): string {
  if (deltaPct != null) {
    const sign = deltaPct > 0 ? "+" : "";
    return `${sign}${deltaPct}% vs prior ${period}`;
  }
  return isCurrent
    ? `${formatNairaFromKobo(totalKobo)} this ${period}`
    : `${formatNairaFromKobo(totalKobo)} that ${period}`;
}



function PaymentPill({ status }: { status: DashboardPaymentStatus }) {
  if (status === "PAID") {
    return <Badge variant="success">Paid</Badge>;
  }
  if (status === "PARTIAL") {
    return <Badge variant="warning">Partial</Badge>;
  }
  return <Badge variant="destructive">Unpaid</Badge>;
}

function chartTickNaira(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `${Math.round(naira / 1_000_000)}m`;
  if (naira >= 1_000) return `${Math.round(naira / 1_000)}k`;
  return String(Math.round(naira));
}

/** Render site name with favicon mark as the first “o”/“O” when present. */
function SiteBrandTitle({ name }: { name: string }) {
  const match = /^(.*?)([Oo])(.*)$/.exec(name);
  if (!match) {
    return <span>{name}</span>;
  }
  const [, before, , after] = match;
  return (
    <>
      <span aria-hidden>{before}</span>
      <img
        src="/favicon-mark.png"
        alt=""
        className="pa-dash-hero-o mx-[0.06em] inline-block h-[0.82em] w-[0.82em] shrink-0 object-contain"
        aria-hidden
      />
      <span aria-hidden>{after}</span>
    </>
  );
}

export function AdminDashboardPage() {
  const api = useAdminApi();
  const siteName = useSetting("site.name");
  const siteTagline = useSetting("site.tagline");
  const [data, setData] = useState<DashboardData | null>(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState<DashboardWeeklyRevenue | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<"week" | "month">("week");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createBookingOpen, setCreateBookingOpen] = useState(false);

  const load = useCallback(
    async (weekStart?: string) => {
      setLoading(true);
      setError(null);
      try {
        const next = await api.dashboard.get(weekStart ? { weekStart } : undefined);
        setData(next);
        setWeeklyRevenue(next.weeklyRevenue);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        setError(errorMessage(err));
        setData(null);
        setWeeklyRevenue(null);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function shiftPeriod(direction: -1 | 1) {
    if (!weeklyRevenue) return;
    if (revenuePeriod === "month") {
      if (!weeklyRevenue.month) return;
      const nextMonth = shiftMonthKey(weeklyRevenue.month, direction);
      if (direction < 0 && !weeklyRevenue.canGoBack) return;
      if (direction > 0 && !weeklyRevenue.canGoForward) return;

      setChartLoading(true);
      try {
        const next = await api.dashboard.revenue({ month: nextMonth, period: "month" });
        setWeeklyRevenue(next);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        setError(errorMessage(err));
      } finally {
        setChartLoading(false);
      }
    } else {
      if (!weeklyRevenue.weekStart) return;
      const nextStart =
        direction < 0
          ? addDaysToKey(weeklyRevenue.weekStart, -7)
          : addDaysToKey(weeklyRevenue.weekStart, 7);
      if (direction < 0 && !weeklyRevenue.canGoBack) return;
      if (direction > 0 && !weeklyRevenue.canGoForward) return;

      setChartLoading(true);
      try {
        const next = await api.dashboard.revenue({ weekStart: nextStart, period: "week" });
        setWeeklyRevenue(next);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        setError(errorMessage(err));
      } finally {
        setChartLoading(false);
      }
    }
  }

  async function changePeriod(nextPeriod: "week" | "month") {
    if (nextPeriod === revenuePeriod) return;
    setRevenuePeriod(nextPeriod);
    setChartLoading(true);
    try {
      const next = await api.dashboard.revenue({ period: nextPeriod });
      setWeeklyRevenue(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setChartLoading(false);
    }
  }

  const chartData =
    weeklyRevenue?.daily.map((d) => ({
      label: d.label,
      sublabel: d.sublabel,
      date: d.date,
      revenueKobo: d.revenueKobo,
      naira: d.revenueKobo / 100,
    })) ?? [];

  const todos = data?.today.todos;
  const upcomingSource = data?.upcomingBookings ?? data?.tomorrowsBookings ?? [];
  const upcomingGroups = data
    ? groupUpcomingBookings(upcomingSource, data.today.date)
    : [];

  return (
    <div className="pa-dash space-y-admin-stack">
      <div className="pa-dash-hero relative isolate">
        <img
          src="/media/about.jpg"
          alt=""
          className="pa-dash-hero-bg absolute inset-0 h-full w-full object-cover object-[78%_center]"
          aria-hidden
        />
        <div className="pa-dash-hero-veil" aria-hidden />
        <div className="pa-dash-hero-front relative z-[1] flex flex-col gap-admin-stack px-[var(--admin-gutter)] pb-admin-stack pt-5 sm:pt-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h1
                className="pa-dash-hero-title flex items-center text-[30px] font-bold leading-none tracking-tight text-white"
                aria-label={siteName}
              >
                <SiteBrandTitle name={siteName} />
              </h1>
              <p className="pa-dash-hero-date mt-1.5 flex shrink-0 items-center gap-2 text-sm text-white/80">
                <Calendar className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                <time dateTime={lagosYmd(new Date())}>{formatLongLagosDate()}</time>
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setCreateBookingOpen(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-medium shrink-0"
            >
              <Plus className="h-4 w-4" />
              Book Session
            </Button>
          </header>

          <ErrorBanner
            message={error}
            onRetry={() => void load(weeklyRevenue?.weekStart)}
            retrying={loading}
          />

          <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
            <StatCard
              label="Today's Bookings"
              icon={CalendarPlus}
              tone="primary"
              loading={loading}
              value={data?.today.bookingsCount ?? "—"}
              hint={
                data
                  ? `${signedDelta(data.today.bookingsDelta)} from yesterday`
                  : undefined
              }
            />
            <StatCard
              label="Today's Revenue"
              icon={LayoutGrid}
              tone="success"
              loading={loading}
              value={data ? formatNairaFromKobo(data.today.revenueTotalKobo) : "—"}
              hint={
                data
                  ? revenueDeltaHint(data.today.revenueDeltaPct, data.today.revenueDeltaKobo)
                  : undefined
              }
            />
            <StatCard
              label="Pending Actions"
              icon={AlertTriangle}
              tone="warning"
              loading={loading}
              value={todos?.total ?? "—"}
              hint={
                todos
                  ? `${todos.newEnquiries} enquir${
                      todos.newEnquiries === 1 ? "y" : "ies"
                    } · ${todos.failedPayments} failed`
                  : undefined
              }
            />
            <StatCard
              label="Upcoming"
              icon={Clock3}
              loading={loading}
              value={data?.today.upcomingTomorrowCount ?? "—"}
              hint="Tomorrow"
            />
          </section>
        </div>
      </div>

      <div className="pa-dash-body space-y-admin-stack">
      <div className="pa-dash-grid grid items-stretch gap-admin-stack xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-admin-stack">
          {/* Unified Row: Today's Bookings (60%) + Revenue (40%) */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-admin-stack items-stretch">
            {/* Today's Bookings (60%) */}
            <Card className="pa-dash-card flex flex-col h-full overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-admin-card-sm pb-2">
                <CardTitle className="font-display text-lg font-normal">Today&apos;s Bookings</CardTitle>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/admin/bookings">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-auto">
                {loading ? (
                  <div className="space-y-3 p-admin-card-sm" aria-busy>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : !data?.todaysBookings.length ? (
                  <EmptyState
                    compact
                    className="m-admin-card-sm border-0 bg-transparent"
                    title="No bookings today"
                    description="When sessions are on the floor, they’ll show up here."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Time</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden 2xl:table-cell">Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="w-6" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.todaysBookings.map((row) => (
                        <TableRow key={row.id} className="cursor-default">
                          <TableCell className="tabular-nums font-medium text-xs">
                            {formatCompactTime(row.startTime)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[9px]">
                                  {initials(row.customerName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-sm font-medium">{row.customerName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[8rem] truncate text-xs text-muted-foreground 2xl:table-cell">
                            {row.serviceName}
                          </TableCell>
                          <TableCell>
                            <BookingStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell>
                            <PaymentPill status={row.paymentStatus} />
                          </TableCell>
                          <TableCell className="p-1">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Revenue Graph (40%) */}
            <Card className="pa-dash-card flex flex-col h-full">
              <CardHeader className="flex flex-col gap-2.5 space-y-0 p-admin-card-sm pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="font-display text-lg font-normal">Revenue</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {revenuePeriod === "month"
                        ? weeklyRevenue?.monthLabel
                          ? weeklyRevenue.isCurrentMonth
                            ? `This month (${weeklyRevenue.monthLabel})`
                            : weeklyRevenue.monthLabel
                          : "This month"
                        : weeklyRevenue?.weekStart && weeklyRevenue?.weekEnd
                          ? formatWeekRangeLabel(
                              weeklyRevenue.weekStart,
                              weeklyRevenue.weekEnd,
                              Boolean(weeklyRevenue.isCurrentWeek),
                            )
                          : "This week"}
                    </p>
                  </div>
                  <div className="text-right">
                    {loading || (chartLoading && !weeklyRevenue) ? (
                      <Skeleton className="ml-auto h-7 w-24" />
                    ) : (
                      <>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatNairaFromKobo(weeklyRevenue?.totalKobo ?? 0)}
                        </p>
                        <p
                          className={cn(
                            "text-[11px]",
                            (weeklyRevenue?.deltaPct ?? 0) >= 0
                              ? "text-[var(--color-success)]"
                              : "text-destructive",
                          )}
                        >
                          {weeklyRevenue
                            ? periodDeltaHint(
                                revenuePeriod,
                                weeklyRevenue.deltaPct,
                                weeklyRevenue.totalKobo,
                                revenuePeriod === "month"
                                  ? weeklyRevenue.isCurrentMonth
                                  : weeklyRevenue.isCurrentWeek,
                              )
                            : null}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Toolbar: Period Filter (Weeks/Month), Chart Type (Bar/Line), Nav (< >) */}
                <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                  {/* Period Filter */}
                  <div className="flex items-center rounded-lg bg-muted/60 p-0.5 ring-1 ring-border/50">
                    <button
                      type="button"
                      onClick={() => void changePeriod("week")}
                      className={cn(
                        "rounded-md px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer",
                        revenuePeriod === "week"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Weeks
                    </button>
                    <button
                      type="button"
                      onClick={() => void changePeriod("month")}
                      className={cn(
                        "rounded-md px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer",
                        revenuePeriod === "month"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Month
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Chart Type Toggle */}
                    <div className="flex items-center rounded-lg bg-muted/60 p-0.5 ring-1 ring-border/50">
                      <button
                        type="button"
                        onClick={() => setChartType("bar")}
                        title="Bar chart"
                        aria-label="Bar chart"
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md transition-all cursor-pointer",
                          chartType === "bar"
                            ? "bg-background text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <BarChart2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType("line")}
                        title="Line graph"
                        aria-label="Line graph"
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md transition-all cursor-pointer",
                          chartType === "line"
                            ? "bg-background text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <LineChartIcon className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Nav Chevrons */}
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6"
                        aria-label={`Previous ${revenuePeriod}`}
                        disabled={loading || chartLoading || !weeklyRevenue?.canGoBack}
                        onClick={() => void shiftPeriod(-1)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6"
                        aria-label={`Next ${revenuePeriod}`}
                        disabled={loading || chartLoading || !weeklyRevenue?.canGoForward}
                        onClick={() => void shiftPeriod(1)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 px-admin-card-sm pb-admin-card-sm pt-0 flex flex-col justify-end">
                {loading && !weeklyRevenue ? (
                  <Skeleton className="h-44 w-full" />
                ) : chartData.every((d) => d.revenueKobo === 0) ? (
                  <EmptyState
                    compact
                    className="border-0 bg-transparent py-8"
                    title={
                      revenuePeriod === "month"
                        ? weeklyRevenue?.isCurrentMonth
                          ? "No revenue this month yet"
                          : "No revenue that month"
                        : weeklyRevenue?.isCurrentWeek
                          ? "No revenue this week yet"
                          : "No revenue that week"
                    }
                    description="Successful payments will appear in the revenue chart."
                  />
                ) : (
                  <div
                    className={cn("h-44 w-full min-h-[11rem]", chartLoading && "opacity-60")}
                    role="img"
                    aria-label={`${revenuePeriod === "month" ? "Monthly" : "Weekly"} revenue ${chartType === "bar" ? "bar chart" : "line graph"}`}
                    aria-busy={chartLoading}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={32}
                            tickFormatter={(v: number) => chartTickNaira(v * 100)}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                          />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(value) => [
                              formatNairaFromKobo(Number(value ?? 0) * 100),
                              "Revenue",
                            ]}
                            labelFormatter={(label, payload) => {
                              const item = payload?.[0]?.payload;
                              return item?.sublabel || label;
                            }}
                          />
                          <Bar
                            dataKey="naira"
                            fill="hsl(var(--primary))"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={32}
                          />
                        </BarChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="dashRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={32}
                            tickFormatter={(v: number) => chartTickNaira(v * 100)}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(value) => [
                              formatNairaFromKobo(Number(value ?? 0) * 100),
                              "Revenue",
                            ]}
                            labelFormatter={(label, payload) => {
                              const item = payload?.[0]?.payload;
                              return item?.sublabel || label;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="naira"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#dashRevenueGrad)"
                            dot={{ r: 3.5, fill: "hsl(var(--primary))", strokeWidth: 1.5, stroke: "hsl(var(--card))" }}
                            activeDot={{ r: 5.5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="pa-dash-card">
            <CardHeader className="p-admin-card-sm pb-admin-control">
              <CardTitle className="font-display text-lg font-normal">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-admin-gap p-admin-card-sm pt-0 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setCreateBookingOpen(true)}
                className="pa-dash-action flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-4 text-center transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-primary group"
              >
                <CalendarPlus className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={1.75} aria-hidden />
                <span className="text-xs font-semibold text-foreground">Book Walk-in</span>
              </button>
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="pa-dash-action flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-4 text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <action.icon className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden />
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-admin-stack xl:h-full">
          <Card className="pa-dash-card pa-dash-aside-card">
            <CardHeader className="p-admin-card-sm pb-admin-control">
              <div className="pa-dash-aside-head">
                <h2 className="pa-dash-aside-title">
                  <Inbox strokeWidth={1.75} aria-hidden />
                  Needs Attention
                </h2>
                <Link to="/admin/bookings" className="pa-dash-view-all">
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-admin-card-sm pt-0">
              {loading || !todos ? (
                <div className="space-y-2" aria-busy>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="pa-dash-attention-list">
                  {ATTENTION_ROWS.map((row) => {
                    const count = todos[row.key] ?? 0;
                    return (
                      <li key={row.key}>
                        <Link
                          to={row.to}
                          className={cn("pa-dash-attention-row", `pa-dash-tone-${row.tone}`)}
                        >
                          <span className="pa-dash-attention-icon" aria-hidden>
                            <row.Icon strokeWidth={2} />
                          </span>
                          <span className="pa-dash-attention-count">{count}</span>
                          <span className="pa-dash-attention-label">{row.label(count)}</span>
                          <ChevronRight className="pa-dash-attention-chevron" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="pa-dash-card pa-dash-aside-card">
            <CardHeader className="p-admin-card-sm pb-admin-control">
              <div className="pa-dash-aside-head">
                <h2 className="pa-dash-aside-title">
                  <ImageIcon strokeWidth={1.75} aria-hidden />
                  Upcoming Bookings
                </h2>
                <Link to="/admin/bookings" className="pa-dash-view-all">
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-admin-card-sm pt-0">
              {loading ? (
                <div className="space-y-2" aria-busy>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !upcomingGroups.length ? (
                <EmptyState
                  compact
                  className="border-0 bg-transparent"
                  title="Nothing upcoming"
                  description="Confirmed and pending sessions for the next week will list here."
                />
              ) : (
                <div className="pa-dash-upcoming-list">
                  {upcomingGroups.map((group) => (
                    <div key={group.key} className="pa-dash-upcoming-group">
                      <p className="pa-dash-day-label">{group.label}</p>
                      <ul className="pa-dash-attention-list">
                        {group.rows.map((row) => (
                          <li key={row.id}>
                            <Link to={`/admin/bookings?id=${encodeURIComponent(row.id)}`} className="pa-dash-upcoming-row">
                              <span className="pa-dash-upcoming-time">
                                {formatCompactTime(row.startTime)}
                              </span>
                              <span className="pa-dash-upcoming-meta">
                                <UserRound strokeWidth={1.75} aria-hidden />
                                <span className="pa-dash-upcoming-service">{row.serviceName}</span>
                              </span>
                              <ChevronRight className="pa-dash-upcoming-chevron" aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="pa-dash-brand relative mt-auto overflow-hidden rounded-xl border border-border">
            <img
              src="/admin-sidebar-promo.jpg"
              alt=""
              className="pa-dash-brand-bg absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="relative z-[1] flex min-h-[9.5rem] flex-col items-center justify-center px-5 py-6 text-center">
              <p className="pa-dash-brand-quote font-display text-lg leading-snug text-white">
                {siteTagline}
              </p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                {siteName}
              </p>
            </div>
          </div>
        </aside>
      </div>
      </div>

      <CreateBookingDialog
        open={createBookingOpen}
        onOpenChange={setCreateBookingOpen}
        onSuccess={() => void load(weeklyRevenue?.weekStart)}
      />
    </div>
  );
}
