import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Pagination } from "../../admin/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import { PaymentStatusBadge } from "../../admin/components/ui/status-badge";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime, formatNairaFromKobo, humanize, lagosToday } from "../../admin/lib/format";
import type { PaymentMethod, PaymentStatus } from "../../admin/lib/types";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { downloadBlob, errorMessage } from "../../lib/api";

export function AdminPaymentsPage() {
  const api = useAdminApi();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(lagosToday);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const listQuery = useQuery(
    () => api.payments.list({ from, to, status, method, page, pageSize: 20 }),
    [from, to, status, method, page],
  );
  const summaryQuery = useQuery(() => api.payments.summary({ from, to }), [from, to]);
  const integrationQuery = useQuery(() => api.payments.integration(), []);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.payments.exportCsv({ from, to });
      downloadBlob(blob, `payments-${from}-to-${to}.csv`);
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const integration = integrationQuery.data;

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Payments"
        description="Studio and online settlement history."
        actions={
          <Button variant="outline" onClick={() => void exportCsv()} loading={exporting}>
            <Download />
            Export CSV
          </Button>
        }
      />
      <ErrorBanner
        message={listQuery.error || summaryQuery.error || integrationQuery.error}
        onRetry={() => {
          void listQuery.refetch();
          void summaryQuery.refetch();
          void integrationQuery.refetch();
        }}
        retrying={listQuery.fetching || summaryQuery.fetching || integrationQuery.fetching}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bachs connection</CardTitle>
          <CardDescription>
            Booking → checkout → webhook → CONFIRMED. Register the webhook URL in the Bachs Developer
            Portal (sandbox and live are separate destinations).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {integrationQuery.loading && !integration ? <Skeleton className="h-20 w-full" /> : null}
          {integration ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <p>
                  <span className="text-muted-foreground">Checkout:</span>{" "}
                  {integration.mockCheckout ? "Mock (dev)" : "Bachs hosted"}
                </p>
                <p>
                  <span className="text-muted-foreground">Environment:</span> {integration.environment}
                </p>
                <p>
                  <span className="text-muted-foreground">API key:</span>{" "}
                  {integration.apiKeyConfigured ? "Configured" : "Not set"}
                </p>
                <p>
                  <span className="text-muted-foreground">Webhook secret:</span>{" "}
                  {integration.webhookSecretConfigured ? "Configured" : "Not set"}
                </p>
              </div>
              <p className="break-all font-mono text-xs">
                <span className="text-muted-foreground">Webhook URL:</span> {integration.webhookUrl}
              </p>
              <p className="text-xs text-muted-foreground">
                Events: {integration.events.join(", ")}. Live ready:{" "}
                {integration.readyForLive ? "yes" : "no — sandbox/mock until sk_live_ + live secret"}.
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total"
          loading={summaryQuery.loading}
          value={formatNairaFromKobo(summaryQuery.data?.totalKobo ?? 0)}
          hint={`${summaryQuery.data?.count ?? 0} payments`}
          tone="success"
        />
        <StatCard
          label="Studio"
          loading={summaryQuery.loading}
          value={formatNairaFromKobo(summaryQuery.data?.byMethod.STUDIO ?? 0)}
        />
        <StatCard
          label="Online"
          loading={summaryQuery.loading}
          value={formatNairaFromKobo(summaryQuery.data?.byMethod.ONLINE_BACHS ?? 0)}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="sm:w-40" />
        <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="sm:w-40" />
        <Select value={status || "all"} onValueChange={(v) => { setPage(1); setStatus(v === "all" ? "" : (v as PaymentStatus)); }}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={method || "all"} onValueChange={(v) => { setPage(1); setMethod(v === "all" ? "" : (v as PaymentMethod)); }}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>{m === "STUDIO" ? "Studio" : "Online Bachs"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listQuery.loading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
      ) : !listQuery.data?.items.length ? (
        <EmptyState title="No payments" description="Adjust the date range or filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Package</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.items.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-3 whitespace-nowrap">{formatLagosDateTime(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-3 py-3">{p.booking?.customer?.name ?? "—"}</td>
                    <td className="px-3 py-3">{p.booking?.package?.name ?? "—"}</td>
                    <td className="px-3 py-3">{p.method === "STUDIO" ? "Studio" : "Online"}</td>
                    <td className="px-3 py-3 tabular-nums">{formatNairaFromKobo(p.amountKobo)}</td>
                    <td className="px-3 py-3"><PaymentStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={listQuery.data.page}
            pageSize={listQuery.data.pageSize}
            total={listQuery.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
