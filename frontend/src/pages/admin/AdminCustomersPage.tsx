import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search, UsersRound } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Pagination } from "../../admin/components/ui/pagination";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosFullDate, formatNairaFromKobo, formatRelative } from "../../admin/lib/format";
import { useQuery } from "../../admin/lib/useQuery";
import { downloadBlob, errorMessage } from "../../lib/api";

export function AdminCustomersPage() {
  const api = useAdminApi();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exporting, setExporting] = useState(false);

  const query = useQuery(
    () => api.customers.list({ q: q.trim() || undefined, tag: tag.trim() || undefined, page, pageSize }),
    [q, tag, page, pageSize],
  );

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.customers.exportCsv();
      downloadBlob(blob, "customers.csv");
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Customers"
        description="CRM list with booking history and tags."
        actions={
          <Button variant="outline" onClick={() => void exportCsv()} loading={exporting}>
            <Download />
            Export CSV
          </Button>
        }
      />
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, phone, email…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <Input
          className="sm:max-w-[160px]"
          placeholder="Tag filter"
          value={tag}
          onChange={(e) => {
            setPage(1);
            setTag(e.target.value);
          }}
        />
      </div>

      {query.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !query.data?.items.length ? (
        <EmptyState icon={UsersRound} title="No customers found" description="Try a different search or clear filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Bookings</th>
                  <th className="px-3 py-3">Last visit</th>
                  <th className="px-3 py-3">Paid</th>
                  <th className="px-3 py-3">Tags</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <Link to={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      {c.email ? <p className="text-xs text-muted-foreground">{c.email}</p> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{c.phone}</td>
                    <td className="px-3 py-3 tabular-nums">{c.bookingCount}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {c.lastBookingAt ? formatRelative(c.lastBookingAt) : "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatNairaFromKobo(c.totalPaidKobo)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
          <p className="sr-only">Joined {formatLagosFullDate(query.data.items[0]?.createdAt)}</p>
        </>
      )}
    </div>
  );
}
