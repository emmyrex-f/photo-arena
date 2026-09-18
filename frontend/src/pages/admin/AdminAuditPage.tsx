import { useState } from "react";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Pagination } from "../../admin/components/ui/pagination";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime, humanize } from "../../admin/lib/format";
import { useQuery } from "../../admin/lib/useQuery";
import { cn } from "../../lib/cn";

export function AdminAuditPage() {
  const api = useAdminApi();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery(
    () => api.audit.list({ q: q.trim() || undefined, entity: entity.trim() || undefined, page, pageSize: 25 }),
    [q, entity, page],
  );

  return (
    <div className="space-y-admin">
      <PageHeader title="Audit log" description="Every admin write is recorded here." />
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search action, email…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="sm:max-w-sm"
        />
        <Input
          placeholder="Entity (booking, service…)"
          value={entity}
          onChange={(e) => {
            setPage(1);
            setEntity(e.target.value);
          }}
          className="sm:max-w-xs"
        />
      </div>

      {query.loading ? (
        Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
      ) : !query.data?.items.length ? (
        <EmptyState icon={Shield} title="No audit entries" />
      ) : (
        <>
          <div className="space-y-2">
            {query.data.items.map((row) => {
              const open = openId === row.id;
              return (
                <div key={row.id} className="rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-3 text-left"
                    onClick={() => setOpenId(open ? null : row.id)}
                  >
                    {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{humanize(row.action)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.userEmail} · {row.entity}
                        {row.entityId ? ` #${row.entityId.slice(0, 8)}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] text-muted-foreground">{formatLagosDateTime(row.createdAt)}</p>
                  </button>
                  <div className={cn("border-t border-border px-3 py-3", !open && "hidden")}>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                      {row.meta == null ? "No meta" : JSON.stringify(row.meta, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
