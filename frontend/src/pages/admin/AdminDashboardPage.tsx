import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { BookingStatusBadge, EnquiryStatusBadge, PaymentStatusBadge } from "../../admin/components/ui/status-badge";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatLagosDateTime,
  formatLagosTime,
  formatNairaFromKobo,
  formatRelative,
  formatYmd,
} from "../../admin/lib/format";
import { useQuery } from "../../admin/lib/useQuery";
import { cn } from "../../lib/cn";

function formatAxisNaira(value: number) {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `₦${Math.round(value / 1_000)}k`;
  return `₦${value}`;
}

function compactNairaFromKobo(kobo: number) {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(2)}m`;
  if (naira >= 10_000) return `₦${Math.round(naira / 1_000)}k`;
  return formatNairaFromKobo(kobo);
}

export function AdminDashboardPage() {
  const api = useAdminApi();
  const { data, error, loading, fetching, refetch } = useQuery(() => api.dashboard.get(), []);

  const chartData =
    data?.series.map((row) => ({
      ...row,
      label: formatYmd(row.date, "d MMM"),
      revenueNaira: Math.round(row.revenueKobo / 100),
    })) ?? [];

  return (
    <div className="min-w-0 space-y-admin">
      <PageHeader title="Dashboard" description="Studio pulse for today — floor, cash, and inbox." />

      <ErrorBanner message={error} onRetry={() => void refetch()} retrying={fetching} />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="grid grid-cols-2 divide-x divide-y divide-border/60 lg:grid-cols-5 lg:divide-y-0">
          <Kpi
            label="On the floor"
            loading={loading}
            value={data?.today.count ?? 0}
            hint="Live sessions today"
          />
          <Kpi label="Pending pay" loading={loading} value={data?.counts.pendingPayments ?? 0} />
          <Kpi label="Active holds" loading={loading} value={data?.counts.activeHolds ?? 0} />
          <Kpi label="New enquiries" loading={loading} value={data?.counts.newEnquiries ?? 0} />
          <Kpi
            label="Customers"
            loading={loading}
            value={data?.counts.customers ?? 0}
            hint={`${data?.counts.upcoming7d ?? 0} upcoming (7d)`}
            className="col-span-2 lg:col-span-1"
          />
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
          <Kpi
            label="Received today"
            loading={loading}
            value={
              <>
                <span className="sm:hidden">{compactNairaFromKobo(data?.revenue.todayKobo ?? 0)}</span>
                <span className="hidden sm:inline">{formatNairaFromKobo(data?.revenue.todayKobo ?? 0)}</span>
              </>
            }
            hint="Successful payments today"
            title={formatNairaFromKobo(data?.revenue.todayKobo ?? 0)}
          />
          <Kpi
            label="This week"
            loading={loading}
            value={
              <>
                <span className="sm:hidden">{compactNairaFromKobo(data?.revenue.weekKobo ?? 0)}</span>
                <span className="hidden sm:inline">{formatNairaFromKobo(data?.revenue.weekKobo ?? 0)}</span>
              </>
            }
            title={formatNairaFromKobo(data?.revenue.weekKobo ?? 0)}
          />
          <Kpi
            label="This month"
            loading={loading}
            value={
              <>
                <span className="sm:hidden">{compactNairaFromKobo(data?.revenue.monthKobo ?? 0)}</span>
                <span className="hidden sm:inline">{formatNairaFromKobo(data?.revenue.monthKobo ?? 0)}</span>
              </>
            }
            title={formatNairaFromKobo(data?.revenue.monthKobo ?? 0)}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-admin-stack-sm xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="text-sm font-medium">Last 30 days</CardTitle>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Revenue</span>
          </CardHeader>
          <CardContent className="h-[200px] p-3 pt-0 sm:h-[280px] sm:p-4 sm:pt-0">
            {loading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <EmptyState compact title="No chart data yet" description="Revenue series will appear once bookings settle." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={16} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="rev"
                    tick={{ fontSize: 10 }}
                    tickFormatter={formatAxisNaira}
                    width={44}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value, name) => {
                      if (name === "revenueNaira") return [`₦${Number(value).toLocaleString("en-NG")}`, "Revenue"];
                      return [value, "Bookings"];
                    }}
                  />
                  <Area
                    yAxisId="rev"
                    type="monotone"
                    dataKey="revenueNaira"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#revFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="text-sm font-medium">Today’s floor</CardTitle>
            <Link to="/admin/bookings" className="text-[11px] font-medium text-primary hover:underline">
              Open bookings
            </Link>
          </CardHeader>
          <CardContent className="max-h-[min(50vh,22rem)] overflow-y-auto p-0 sm:max-h-[280px]">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data?.today.bookings.length ? (
              <div className="p-4">
                <EmptyState compact icon={CalendarDays} title="No live sessions today" />
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {data.today.bookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/admin/bookings?id=${b.id}`}
                      className="flex min-h-12 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:gap-3 sm:px-4"
                    >
                      <span className="w-[4.5rem] shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {formatLagosTime(b.startTime)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{b.customer.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{b.package.name}</span>
                      </span>
                      <BookingStatusBadge status={b.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-admin-stack-sm lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="text-sm font-medium">Recent enquiries</CardTitle>
            <Link to="/admin/enquiries" className="text-[11px] font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data?.recentEnquiries.length ? (
              <div className="p-4">
                <EmptyState compact title="Inbox is clear" />
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {data.recentEnquiries.map((e) => (
                  <li key={e.id} className="flex min-h-12 items-center gap-3 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {e.sessionType || e.message} · {formatRelative(e.createdAt)}
                      </p>
                    </div>
                    <EnquiryStatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="text-sm font-medium">Recent payments</CardTitle>
            <Link to="/admin/payments" className="text-[11px] font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data?.recentPayments.length ? (
              <div className="p-4">
                <EmptyState compact title="No payments yet" />
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {data.recentPayments.map((p) => (
                  <li key={p.id} className="flex min-h-12 items-center gap-3 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.booking?.customer?.name ?? "Customer"} · {formatNairaFromKobo(p.amountKobo)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.method === "STUDIO" ? "Studio" : "Online"} · {formatLagosDateTime(p.paidAt ?? p.createdAt)}
                      </p>
                    </div>
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  loading,
  className,
  title,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  loading?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn("min-w-0 px-admin-gap py-admin-gap sm:px-admin-card-sm", className)} title={title}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
      )}
      {hint ? <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{hint}</p> : null}
    </div>
  );
}
