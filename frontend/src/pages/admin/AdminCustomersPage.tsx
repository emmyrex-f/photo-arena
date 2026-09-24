import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Instagram,
  Mail,
  Phone,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { ActiveBadge, BookingStatusBadge } from "../../admin/components/ui/status-badge";
import { Avatar, AvatarFallback } from "../../admin/components/ui/avatar";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../admin/components/ui/tabs";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatLagosDate,
  formatLagosDateTime,
  formatLagosTime,
  formatNairaFromKobo,
  initials,
  lagosToday,
  parseYmd,
  toYmd,
} from "../../admin/lib/format";
import type {
  BookingRecord,
  CustomerDetail,
  CustomerListItem,
  CustomersSummary,
  Payment,
} from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";

const PAGE_SIZE = 8;

const SOURCE_OPTIONS = ["Website", "Instagram", "Walk-in", "Referral"] as const;

function pctHint(deltaPct: number | null, fallback: string): string {
  if (deltaPct == null) return fallback;
  const sign = deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "";
  return `${sign} ${Math.abs(deltaPct)}% from last 30 days`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sourceLabel(tags?: string[] | null): string {
  if (!tags?.length) return "—";
  const match = tags.find((t) =>
    SOURCE_OPTIONS.some((s) => s.toLowerCase() === t.toLowerCase()),
  );
  return match ?? tags[0] ?? "—";
}

function normalizeSourceTag(value: string): string {
  if (value === "Walk-in") return "Walk-in";
  return value;
}

export function AdminCustomersPage() {
  const api = useAdminApi();
  const [params, setParams] = useSearchParams();
  const today = lagosToday();

  const to = params.get("to") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("to")!) ? params.get("to")! : today;
  const from =
    params.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("from")!)
      ? params.get("from")!
      : toYmd(addDays(parseYmd(to), -6));
  const statusFilter = (params.get("status") as "active" | "inactive" | "ALL" | null) || "ALL";
  const tagFilter = params.get("tag") ?? "";
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page") || "1") || 1);
  const selectedId = params.get("id");

  const [summary, setSummary] = useState<CustomersSummary | null>(null);
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, list] = await Promise.all([
        api.customers.summary(),
        api.customers.list({
          q: q || undefined,
          page,
          pageSize: PAGE_SIZE,
          tag: tagFilter || undefined,
          status: statusFilter === "ALL" ? "" : statusFilter,
        }),
      ]);
      setSummary(sum);
      setItems(list.items);
      setTotal(list.total);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setItems([]);
      setSummary(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [api, q, page, tagFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void api.customers
      .get(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        toast.error(errorMessage(err));
        setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, selectedId]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeLabel = `${format(parseYmd(from), "MMM d, yyyy")} – ${format(parseYmd(to), "MMM d, yyyy")}`;

  async function onExport() {
    setExporting(true);
    try {
      const blob = await api.customers.exportCsv();
      downloadBlob(blob, `customers-${toYmd(new Date())}.csv`);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setParam({ q: searchDraft.trim() || null, page: "1", id: null });
  }

  const selectedListRow = useMemo(
    () => items.find((c) => c.id === selectedId) ?? null,
    [items, selectedId],
  );

  return (
    <div className="pa-customers space-y-admin-stack">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Customers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage customer information, view history and track bookings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{rangeLabel}</span>
          </div>
          <Input
            type="date"
            value={from}
            aria-label="From date"
            className="w-[9.5rem]"
            onChange={(e) => setParam({ from: e.target.value || null })}
          />
          <Input
            type="date"
            value={to}
            aria-label="To date"
            className="w-[9.5rem]"
            onChange={(e) => setParam({ to: e.target.value || null })}
          />
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-3" aria-label="Customer metrics">
        <StatCard
          label="Total Customers"
          icon={Users}
          tone="primary"
          loading={loading}
          value={summary?.total.count ?? "—"}
          hint={summary ? pctHint(summary.total.deltaPct, "vs 30 days ago") : undefined}
        />
        <StatCard
          label="New Customers"
          icon={UserPlus}
          tone="success"
          loading={loading}
          value={summary?.newCustomers.count ?? "—"}
          hint={summary ? pctHint(summary.newCustomers.deltaPct, "last 30 days") : undefined}
        />
        <StatCard
          label="Upcoming Bookings"
          icon={CalendarClock}
          tone="default"
          loading={loading}
          value={summary?.upcomingBookings.count ?? "—"}
          hint={
            summary ? pctHint(summary.upcomingBookings.deltaPct, "confirmed & pending ahead") : undefined
          }
        />
      </section>

      <div
        className={cn(
          "grid gap-admin-stack",
          selectedId ? "xl:grid-cols-[minmax(0,1fr)_21rem]" : "grid-cols-1",
        )}
      >
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border p-admin-card-sm sm:flex-row sm:items-center">
            <form onSubmit={submitSearch} className="min-w-0 flex-1">
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search by name, phone, or email…"
                aria-label="Search customers"
              />
            </form>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setParam({ status: v === "ALL" ? null : v, page: "1", id: null })
              }
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={tagFilter || "ALL"}
              onValueChange={(v) =>
                setParam({
                  tag: v === "ALL" ? null : normalizeSourceTag(v),
                  page: "1",
                  id: null,
                })
              }
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by source">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              loading={exporting}
              onClick={() => void onExport()}
            >
              <Download strokeWidth={1.5} />
              Export
            </Button>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-admin-card-sm" aria-busy>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                compact
                className="m-admin-card-sm border-0 bg-transparent"
                title="No customers"
                description={
                  q
                    ? `No matches for “${q}”.`
                    : "Customers appear here after their first booking or walk-in."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden sm:table-cell">Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Bookings</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Booking</TableHead>
                      <TableHead className="hidden xl:table-cell">Next Booking</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => {
                      const active = row.id === selectedId;
                      const source = sourceLabel(row.tags);
                      return (
                        <TableRow
                          key={row.id}
                          className={cn("cursor-pointer", active && "bg-muted/40")}
                          onClick={() => setParam({ id: row.id })}
                        >
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarFallback>{initials(row.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{row.name}</p>
                                {source !== "—" ? (
                                  <Badge variant="secondary" className="mt-1 text-[10px] font-medium">
                                    {source}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                            {row.phone}
                          </TableCell>
                          <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground md:table-cell">
                            {row.email ?? "—"}
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">{row.bookingCount}</TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                            {row.lastBookingAt ? formatLagosDate(row.lastBookingAt) : "—"}
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                            {row.nextBookingAt ? formatLagosDate(row.nextBookingAt) : "—"}
                          </TableCell>
                          <TableCell>
                            <ActiveBadge active={row.isActive} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`View ${row.name}`}
                              onClick={() => setParam({ id: row.id })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {total > 0 ? (
              <div className="flex items-center justify-between border-t border-border px-admin-card-sm py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}{" "}
                  customers
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={page <= 1}
                    aria-label="Previous page"
                    onClick={() => setParam({ page: String(page - 1), id: null })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground tabular-nums">
                    {page}
                  </span>
                  <span className="px-1 text-xs text-muted-foreground">/ {pageCount}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={page >= pageCount}
                    aria-label="Next page"
                    onClick={() => setParam({ page: String(page + 1), id: null })}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {selectedId ? (
          <CustomerDetailPanel
            listRow={selectedListRow}
            detail={detail}
            loading={detailLoading}
            onClose={() => setParam({ id: null })}
          />
        ) : null}
      </div>
    </div>
  );
}

function CustomerDetailPanel({
  listRow,
  detail,
  loading,
  onClose,
}: {
  listRow: CustomerListItem | null;
  detail: CustomerDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const name = detail?.name ?? listRow?.name ?? "Customer";
  const phone = detail?.phone ?? listRow?.phone ?? "—";
  const email = detail?.email ?? listRow?.email ?? null;
  const tags = detail?.tags ?? listRow?.tags ?? [];
  const source = sourceLabel(tags);
  const isActive = detail?.isActive ?? listRow?.isActive ?? false;
  const bookingCount = detail?.bookingCount ?? listRow?.bookingCount ?? 0;
  const upcomingCount = detail?.upcomingCount ?? 0;
  const completedCount = detail?.completedCount ?? 0;
  const joined = detail?.createdAt ?? listRow?.createdAt;

  const upcomingBooking = useMemo(() => {
    if (!detail?.bookings?.length) return null;
    const ts = Date.now();
    return (
      detail.bookings
        .filter(
          (b) =>
            new Date(b.startTime).getTime() >= ts &&
            (b.status === "CONFIRMED" || b.status === "PENDING" || b.status === "TEMPORARY_HOLD"),
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null
    );
  }, [detail]);

  const payments = useMemo(() => {
    if (!detail?.bookings) return [] as (Payment & { bookingRef?: string })[];
    return detail.bookings.flatMap((b) =>
      (b.payments ?? []).map((p) => ({ ...p, bookingRef: b.reference ?? b.id })),
    );
  }, [detail]);

  return (
    <Card className="h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-admin-card-sm">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="text-base">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <CardTitle className="font-display text-lg font-normal leading-tight">{name}</CardTitle>
            <ActiveBadge active={isActive} />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {phone}
            </p>
            {email ? (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {email}
              </p>
            ) : null}
            {source === "Instagram" ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Instagram className="h-3 w-3" aria-hidden />
                Instagram
              </Badge>
            ) : source !== "—" ? (
              <Badge variant="secondary" className="text-[10px]">
                {source}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 p-admin-card-sm pt-0">
        {loading && !detail ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border text-center">
              <div className="px-2 py-3">
                <p className="text-lg font-semibold tabular-nums">{bookingCount}</p>
                <p className="text-[10px] text-muted-foreground">Total Bookings</p>
              </div>
              <div className="px-2 py-3">
                <p className="text-lg font-semibold tabular-nums">{upcomingCount}</p>
                <p className="text-[10px] text-muted-foreground">Upcoming</p>
              </div>
              <div className="px-2 py-3">
                <p className="text-lg font-semibold tabular-nums">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="bookings" className="text-xs">
                  Booking History
                </TabsTrigger>
                <TabsTrigger value="payments" className="text-xs">
                  Payment History
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="space-y-2 text-sm">
                  <InfoRow label="Name" value={name} />
                  <InfoRow label="Phone" value={phone} />
                  <InfoRow label="Email" value={email ?? "—"} />
                  <InfoRow label="Source" value={source} />
                  <InfoRow
                    label="Joined"
                    value={joined ? formatLagosDate(joined) : "—"}
                  />
                  <InfoRow
                    label="Lifetime paid"
                    value={formatNairaFromKobo(detail?.totalPaidKobo ?? listRow?.totalPaidKobo ?? 0)}
                  />
                </div>

                {upcomingBooking ? <UpcomingBookingCard booking={upcomingBooking} /> : null}
              </TabsContent>

              <TabsContent value="bookings" className="space-y-2">
                {!detail?.bookings?.length ? (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                ) : (
                  detail.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {b.package?.service?.name ?? b.package?.name ?? "Session"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatLagosDateTime(b.startTime)}
                          </p>
                        </div>
                        <BookingStatusBadge status={b.status} />
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="payments" className="space-y-2">
                {!payments.length ? (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                ) : (
                  payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium tabular-nums">
                          {formatNairaFromKobo(p.amountKobo)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.reference} · {formatLagosDate(p.paidAt ?? p.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          p.status === "SUCCESS"
                            ? "success"
                            : p.status === "FAILED"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {p.status === "SUCCESS" ? "Paid" : p.status}
                      </Badge>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="notes">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {detail?.notes?.trim() || "No notes yet."}
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Quick Actions
              </p>
              {detail?.email ? (
                <Button type="button" variant="outline" className="w-full justify-start" asChild>
                  <a href={`mailto:${detail.email}`}>
                    <Mail className="h-4 w-4" />
                    Email customer
                  </a>
                </Button>
              ) : null}
              {detail?.phone ? (
                <Button type="button" variant="outline" className="w-full justify-start" asChild>
                  <a href={`tel:${detail.phone.replace(/\s+/g, "")}`}>
                    <Phone className="h-4 w-4" />
                    Call customer
                  </a>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function UpcomingBookingCard({ booking }: { booking: BookingRecord }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Upcoming Booking
      </p>
      <div className="mt-2 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <CalendarClock className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {booking.package?.name ?? booking.package?.service?.name ?? "Session"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatLagosDate(booking.startTime)} · {formatLagosTime(booking.startTime)}
            {booking.endTime ? `–${formatLagosTime(booking.endTime)}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {booking.package?.service?.name ?? "Studio Session"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <BookingStatusBadge status={booking.status} />
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link to={`/admin/bookings?id=${booking.id}`}>View Details →</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
