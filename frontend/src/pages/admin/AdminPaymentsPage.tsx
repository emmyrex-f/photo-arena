import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Mail,
  MoreHorizontal,
  Phone,
  X,
  XCircle,
} from "lucide-react";
import { addDays } from "date-fns";
import { Avatar, AvatarFallback } from "../../admin/components/ui/avatar";
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
import { PaymentStatusBadge } from "../../admin/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
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
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentsSummary,
} from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";

const PAGE_SIZE = 8;

function pctHint(deltaPct: number | null, fallback: string): string {
  if (deltaPct == null) return fallback;
  const sign = deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "";
  return `${sign} ${Math.abs(deltaPct)}% vs prior period`;
}

function methodLabel(method: PaymentMethod): string {
  if (method === "ONLINE_BACHS") return "Bachs";
  if (method === "STUDIO") return "Studio";
  const _exhaustive: never = method;
  return _exhaustive;
}

function statusUiLabel(status: PaymentStatus): string {
  switch (status) {
    case "SUCCESS":
      return "Paid";
    case "PENDING":
      return "Pending";
    case "PROCESSING":
      return "Processing";
    case "FAILED":
      return "Failed";
    case "REFUNDED":
      return "Refunded";
    case "PARTIALLY_REFUNDED":
      return "Partially refunded";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminPaymentsPage() {
  const api = useAdminApi();
  const [params, setParams] = useSearchParams();
  const today = lagosToday();

  const to = params.get("to") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("to")!) ? params.get("to")! : today;
  const from =
    params.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("from")!)
      ? params.get("from")!
      : toYmd(addDays(parseYmd(to), -6));
  const statusFilter = (params.get("status") as PaymentStatus | "ALL" | null) || "ALL";
  const methodFilter = (params.get("method") as PaymentMethod | "ALL" | null) || "ALL";
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page") || "1") || 1);
  const selectedId = params.get("id");

  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);
  const [exporting, setExporting] = useState(false);

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
        api.payments.summary({ from, to }),
        api.payments.list({
          from,
          to,
          status: statusFilter === "ALL" ? "" : statusFilter,
          method: methodFilter === "ALL" ? "" : methodFilter,
          q: q || undefined,
          page,
          pageSize: PAGE_SIZE,
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
  }, [api, from, to, statusFilter, methodFilter, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => items.find((p) => p.id === selectedId) ?? null,
    [items, selectedId],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function onExport() {
    setExporting(true);
    try {
      const blob = await api.payments.exportCsv({ from, to });
      downloadBlob(blob, `payments-${from}-to-${to}.csv`);
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

  const revenueTone =
    (summary?.revenue?.deltaPct ?? 0) >= 0 ? ("success" as const) : ("destructive" as const);

  return (
    <div className="pa-payments space-y-admin-stack">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage all payment transactions, reconciliations, and checkout status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={from}
            aria-label="From date"
            className="w-[9.5rem]"
            onChange={(e) => setParam({ from: e.target.value || null, page: "1", id: null })}
          />
          <Input
            type="date"
            value={to}
            aria-label="To date"
            className="w-[9.5rem]"
            onChange={(e) => setParam({ to: e.target.value || null, page: "1", id: null })}
          />
          <Button type="button" onClick={() => void onExport()} loading={exporting}>
            <Download strokeWidth={1.5} />
            Export
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Payment metrics">
        <StatCard
          label="Total Revenue"
          icon={CreditCard}
          tone={revenueTone}
          loading={loading}
          value={
            summary ? formatNairaFromKobo(summary.revenue?.totalKobo ?? summary.totalKobo) : "—"
          }
          hint={
            summary
              ? pctHint(
                  summary.revenue?.deltaPct ?? null,
                  formatNairaFromKobo(summary.revenue?.deltaKobo ?? 0),
                )
              : undefined
          }
        />
        <StatCard
          label="Successful Payments"
          icon={CheckCircle2}
          tone="success"
          loading={loading}
          value={summary?.successful?.count ?? summary?.count ?? "—"}
          hint={
            summary ? pctHint(summary.successful?.deltaPct ?? null, "vs prior period") : undefined
          }
        />
        <StatCard
          label="Pending Payments"
          icon={AlertTriangle}
          tone="warning"
          loading={loading}
          value={summary?.pending?.count ?? "—"}
          hint={summary ? pctHint(summary.pending?.deltaPct ?? null, "vs prior period") : undefined}
        />
        <StatCard
          label="Failed / Abandoned"
          icon={XCircle}
          tone="destructive"
          loading={loading}
          value={summary?.failed?.count ?? "—"}
          hint={summary ? pctHint(summary.failed?.deltaPct ?? null, "Failed & abandoned") : undefined}
        />
      </section>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Select
          value={statusFilter}
          onValueChange={(v) => setParam({ status: v === "ALL" ? null : v, page: "1", id: null })}
        >
          <SelectTrigger className="w-full lg:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="SUCCESS">Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
            <SelectItem value="PARTIALLY_REFUNDED">Partially refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={methodFilter}
          onValueChange={(v) => setParam({ method: v === "ALL" ? null : v, page: "1", id: null })}
        >
          <SelectTrigger className="w-full lg:w-44" aria-label="Filter by method">
            <SelectValue placeholder="Payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All methods</SelectItem>
            <SelectItem value="ONLINE_BACHS">Bachs (online)</SelectItem>
            <SelectItem value="STUDIO">Studio</SelectItem>
          </SelectContent>
        </Select>
        <form onSubmit={submitSearch} className="min-w-0 flex-1">
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search reference or customer…"
            aria-label="Search payments"
          />
        </form>
      </div>

      <div
        className={cn(
          "grid gap-admin-stack",
          selected ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1",
        )}
      >
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-admin-card-sm" aria-busy>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                compact
                className="m-admin-card-sm border-0 bg-transparent"
                title="No payments"
                description={
                  q
                    ? `No matches for “${q}” in this range.`
                    : "Successful, pending, and failed payments will appear here."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ref</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden md:table-cell">Booking</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden sm:table-cell">Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Date</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => {
                      const active = row.id === selectedId;
                      const customer = row.booking?.customer;
                      const pkg = row.booking?.package;
                      return (
                        <TableRow
                          key={row.id}
                          className={cn("cursor-pointer", active && "bg-muted/40")}
                          onClick={() => setParam({ id: row.id })}
                        >
                          <TableCell className="max-w-[9rem]">
                            <p className="truncate font-mono text-xs font-medium text-foreground">
                              {row.booking?.reference ?? "—"}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground" title={row.reference}>
                              Pay: {row.reference}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate text-sm">{customer?.name ?? "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {customer?.phone ?? "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[9rem] md:table-cell">
                            <p className="truncate text-sm">
                              {pkg?.service?.name ?? pkg?.name ?? "—"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.booking?.startTime
                                ? formatLagosDate(row.booking.startTime)
                                : "—"}
                            </p>
                          </TableCell>
                          <TableCell className="font-semibold">
                            <span className="inline-flex items-baseline gap-0.5">
                              <span aria-hidden="true">₦</span>
                              <span className="tabular-nums">
                                {Math.round(row.amountKobo / 100).toLocaleString("en-NG")}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {methodLabel(row.method)}
                          </TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                            {formatLagosDate(row.paidAt ?? row.createdAt)}
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

            {total > 0 ? (
              <div className="flex items-center justify-between border-t border-border px-admin-card-sm py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}{" "}
                  payments
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

        {selected ? (
          <PaymentDetailPanel
            payment={selected}
            onClose={() => setParam({ id: null })}
          />
        ) : null}
      </div>
    </div>
  );
}

function PaymentDetailPanel({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const customer = payment.booking?.customer;
  const pkg = payment.booking?.package;
  const source = payment.booking?.source;

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-admin-card-sm">
        <div className="space-y-2">
          <CardTitle className="font-display text-lg font-normal">Payment Details</CardTitle>
          <p className="text-xs font-medium tabular-nums text-muted-foreground">{payment.reference}</p>
          <div className="flex items-center gap-2">
            <PaymentStatusBadge status={payment.status} />
            <span className="text-[11px] text-muted-foreground">
              {statusUiLabel(payment.status)}
            </span>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 p-admin-card-sm pt-0">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11">
            <AvatarFallback>{initials(customer?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium">{customer?.name ?? "—"}</p>
            {customer?.phone ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {customer.phone}
              </p>
            ) : null}
            {customer?.email ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {customer.email}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Booking</p>
          <p className="mt-1 text-sm font-medium">
            {pkg?.service?.name ?? pkg?.name ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {payment.booking?.startTime
              ? `${formatLagosDate(payment.booking.startTime)}${
                  payment.booking.startTime && payment.booking.endTime
                    ? ` · ${formatLagosTime(payment.booking.startTime)}–${formatLagosTime(payment.booking.endTime)}`
                    : ""
                }`
              : "—"}
            {pkg?.durationMinutes ? ` · ${pkg.durationMinutes} min` : ""}
          </p>
        </div>

        <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Amount</span>
            <span className="tabular-nums">{formatNairaFromKobo(payment.amountKobo)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="font-medium">
              {payment.status === "SUCCESS" ? "Total paid" : "Amount"}
            </span>
            <span className="font-semibold tabular-nums text-primary">
              {formatNairaFromKobo(payment.amountKobo)}
            </span>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Method · {methodLabel(payment.method)}
            {payment.channel ? ` (${payment.channel})` : ""}
            {payment.provider ? ` · ${payment.provider}` : ""}
          </p>
          {source ? <p>Source · {source === "ONLINE" ? "Website" : source.replace("_", " ")}</p> : null}
          <p>Created · {formatLagosDateTime(payment.createdAt)}</p>
          {payment.paidAt ? <p>Paid · {formatLagosDateTime(payment.paidAt)}</p> : null}
        </div>

        {payment.refundedAmountKobo ? (
          <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
            <div className="flex justify-between font-medium">
              <span>Historical Refund</span>
              <span className="tabular-nums">{formatNairaFromKobo(payment.refundedAmountKobo)}</span>
            </div>
            {payment.refundReason ? (
              <p className="text-[11px] text-muted-foreground">Reason: {payment.refundReason}</p>
            ) : null}
            {payment.refundedAt ? (
              <p className="text-[11px] text-muted-foreground">
                Refund date: {formatLagosDateTime(payment.refundedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
