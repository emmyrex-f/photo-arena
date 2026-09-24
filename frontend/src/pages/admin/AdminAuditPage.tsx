import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime } from "../../admin/lib/format";
import type { AuditLog } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";

const PAGE_SIZE = 50;

const ENTITY_OPTIONS = [
  "ALL",
  "booking",
  "payment",
  "customer",
  "enquiry",
  "service",
  "gallery",
  "testimonial",
  "blog",
  "settings",
  "user",
  "notification",
  "media_usage",
] as const;

export function AdminAuditPage() {
  const api = useAdminApi();
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [entity, setEntity] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.audit.list({
        page,
        pageSize: PAGE_SIZE,
        q: q || undefined,
        entity: entity === "ALL" ? undefined : entity,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(errorMessage(err, "Could not load audit log"));
    } finally {
      setLoading(false);
    }
  }, [api, page, q, entity]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="pa-audit space-y-admin-stack">
      <header>
        <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
          Audit
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Desk activity history. Read-only.</p>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      <section className="flex flex-col gap-admin-gap sm:flex-row sm:flex-wrap sm:items-center" aria-label="Filters">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQ(qDraft.trim());
          }}
        >
          <Input
            value={qDraft}
            onChange={(event) => setQDraft(event.target.value)}
            placeholder="Search action, email, or entity id…"
            className="sm:max-w-sm"
            aria-label="Search audit log"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Select
          value={entity}
          onValueChange={(value) => {
            setEntity(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[11rem]" aria-label="Filter by entity">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "ALL" ? "All entities" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Shield} title="No audit entries" description="Desk actions will appear here." />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatLagosDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{row.userEmail || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="muted">{row.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{row.entity}</TableCell>
                    <TableCell className="max-w-[10rem] truncate font-mono text-xs text-muted-foreground">
                      {row.entityId || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {total} events · page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
