import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  Mail,
  MessageSquare,
  MessageSquareReply,
  MoreHorizontal,
  Phone,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { EnquiryStatusBadge } from "../../admin/components/ui/status-badge";
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
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatLagosDateTime,
  initials,
  lagosToday,
  parseYmd,
  toYmd,
} from "../../admin/lib/format";
import type { EnquiriesSummary, Enquiry, EnquiryStatus } from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";

const PAGE_SIZE = 8;

type TabKey = "ALL" | EnquiryStatus;

function pctHint(deltaPct: number | null, fallback: string): string {
  if (deltaPct == null) return fallback;
  const sign = deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "";
  return `${sign} ${Math.abs(deltaPct)}% from last 30 days`;
}

function subjectLine(enquiry: Enquiry): string {
  if (enquiry.sessionType?.trim()) return enquiry.sessionType.trim();
  const first = enquiry.message.trim().split(/\n/)[0] ?? "";
  return first.length > 56 ? `${first.slice(0, 56)}…` : first || "Enquiry";
}

function messageSnippet(enquiry: Enquiry): string {
  const text = enquiry.message.trim().replace(/\s+/g, " ");
  if (!text) return "—";
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

export function AdminEnquiriesPage() {
  const api = useAdminApi();
  const [params, setParams] = useSearchParams();
  const today = lagosToday();

  const to = params.get("to") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("to")!) ? params.get("to")! : today;
  const from =
    params.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("from")!)
      ? params.get("from")!
      : toYmd(addDays(parseYmd(to), -6));
  const tab = (params.get("tab") as TabKey | null) || "ALL";
  const statusFilter = (params.get("status") as EnquiryStatus | "ALL" | null) || "ALL";
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page") || "1") || 1);
  const selectedId = params.get("id");

  const effectiveStatus: EnquiryStatus | "" =
    tab !== "ALL" ? tab : statusFilter === "ALL" ? "" : statusFilter;

  const [summary, setSummary] = useState<EnquiriesSummary | null>(null);
  const [items, setItems] = useState<Enquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);
  const [acting, setActing] = useState(false);

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
        api.enquiries.summary(),
        api.enquiries.list({
          status: effectiveStatus,
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
  }, [api, effectiveStatus, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => items.find((e) => e.id === selectedId) ?? null,
    [items, selectedId],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeLabel = `${format(parseYmd(from), "MMM d, yyyy")} – ${format(parseYmd(to), "MMM d, yyyy")}`;

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setParam({ q: searchDraft.trim() || null, page: "1", id: null });
  }

  async function setStatus(id: string, status: EnquiryStatus) {
    setActing(true);
    try {
      const updated = await api.enquiries.update(id, { status });
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)));
      toast.success(status === "REPLIED" ? "Marked as replied" : status === "CLOSED" ? "Enquiry closed" : "Status updated");
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setActing(false);
    }
  }

  async function saveNote(id: string, internalNote: string) {
    setActing(true);
    try {
      const updated = await api.enquiries.update(id, { internalNote });
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)));
      toast.success("Note saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setActing(false);
    }
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: summary?.tabs.all ?? 0 },
    { key: "NEW", label: "New", count: summary?.tabs.new ?? 0 },
    { key: "REPLIED", label: "Replied", count: summary?.tabs.replied ?? 0 },
    { key: "CLOSED", label: "Closed", count: summary?.tabs.closed ?? 0 },
  ];

  return (
    <div className="pa-enquiries space-y-admin-stack">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Enquiries
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage customer enquiries, respond to new messages and track conversations.
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

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Enquiry metrics">
        <StatCard
          label="Total Enquiries"
          icon={MessageSquare}
          tone="primary"
          loading={loading}
          value={summary?.total.count ?? "—"}
          hint={summary ? pctHint(summary.total.deltaPct, "vs 30 days ago") : undefined}
        />
        <StatCard
          label="New Enquiries"
          icon={Clock3}
          tone="warning"
          loading={loading}
          value={summary?.new.count ?? "—"}
          hint={summary ? pctHint(summary.new.deltaPct, "open / unread") : undefined}
        />
        <StatCard
          label="Replied"
          icon={MessageSquareReply}
          tone="success"
          loading={loading}
          value={summary?.replied.count ?? "—"}
          hint={summary ? pctHint(summary.replied.deltaPct, "vs prior period") : undefined}
        />
        <StatCard
          label="Closed"
          icon={CheckCircle2}
          tone="default"
          loading={loading}
          value={summary?.closed.count ?? "—"}
          hint={summary ? pctHint(summary.closed.deltaPct, "vs prior period") : undefined}
        />
      </section>

      <div
        role="tablist"
        aria-label="Enquiry status"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() =>
                setParam({
                  tab: t.key === "ALL" ? null : t.key,
                  status: null,
                  page: "1",
                  id: null,
                })
              }
            >
              {t.label}
              {!loading ? (
                <span className="ml-1.5 tabular-nums text-muted-foreground">({t.count})</span>
              ) : null}
              {active ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "grid gap-admin-stack",
          selected ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : "grid-cols-1",
        )}
      >
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border p-admin-card-sm sm:flex-row sm:items-center">
            <form onSubmit={submitSearch} className="min-w-0 flex-1">
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search by name, phone, or email…"
                aria-label="Search enquiries"
              />
            </form>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setParam({
                  status: v === "ALL" ? null : v,
                  tab: null,
                  page: "1",
                  id: null,
                })
              }
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="REPLIED">Replied</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
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
                title="No enquiries"
                description={
                  q
                    ? `No matches for “${q}”.`
                    : "Website contact form submissions will appear here."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="hidden lg:table-cell">Source</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => {
                      const active = row.id === selectedId;
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
                              <p className="truncate text-sm font-medium">{row.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[10rem] md:table-cell">
                            <p className="truncate text-sm">{row.phone || "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                          </TableCell>
                          <TableCell className="max-w-[14rem]">
                            <p className="truncate text-sm font-medium">{subjectLine(row)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {messageSnippet(row)}
                            </p>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              Website
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                            {formatLagosDateTime(row.createdAt)}
                          </TableCell>
                          <TableCell>
                            <EnquiryStatusBadge status={row.status} />
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
                  enquiries
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
          <EnquiryDetailPanel
            enquiry={selected}
            acting={acting}
            onClose={() => setParam({ id: null })}
            onMarkReplied={() => void setStatus(selected.id, "REPLIED")}
            onCloseEnquiry={() => void setStatus(selected.id, "CLOSED")}
            onSaveNote={(note) => void saveNote(selected.id, note)}
          />
        ) : null}
      </div>
    </div>
  );
}

function EnquiryDetailPanel({
  enquiry,
  acting,
  onClose,
  onMarkReplied,
  onCloseEnquiry,
  onSaveNote,
}: {
  enquiry: Enquiry;
  acting: boolean;
  onClose: () => void;
  onMarkReplied: () => void;
  onCloseEnquiry: () => void;
  onSaveNote: (note: string) => void;
}) {
  const [replyDraft, setReplyDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState(enquiry.internalNote ?? "");

  useEffect(() => {
    setNoteDraft(enquiry.internalNote ?? "");
    setReplyDraft("");
  }, [enquiry.id, enquiry.internalNote]);

  return (
    <Card className="flex h-fit max-h-[calc(100vh-8rem)] flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-row items-start justify-between space-y-0 border-b border-border p-admin-card-sm">
        <div>
          <CardTitle className="font-display text-lg font-normal">Enquiry Details</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{subjectLine(enquiry)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-admin-card-sm">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback>{initials(enquiry.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{enquiry.name}</p>
              <EnquiryStatusBadge status={enquiry.status} />
            </div>
            {enquiry.phone ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {enquiry.phone}
              </p>
            ) : null}
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {enquiry.email}
            </p>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Globe className="h-3 w-3" aria-hidden />
              Website
            </Badge>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <InfoRow label="Subject" value={subjectLine(enquiry)} />
          <InfoRow label="Received" value={formatLagosDateTime(enquiry.createdAt)} />
          <InfoRow label="Source" value="Website" />
          <InfoRow label="Assigned To" value="Unassigned" />
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/15 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Conversation
          </p>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <p className="text-[11px] text-muted-foreground">{enquiry.name} · inbound</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{enquiry.message}</p>
          </div>
          {enquiry.internalNote?.trim() ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              <p className="text-[11px] text-primary">Studio · internal note</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{enquiry.internalNote}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor="enquiry-reply">
            Reply
          </label>
          <div className="rounded-xl border border-border bg-card p-2">
            <Textarea
              id="enquiry-reply"
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Type a reply…"
              rows={3}
              className="min-h-[4.5rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={!replyDraft.trim() || acting}
                loading={acting}
                onClick={() => {
                  const text = replyDraft.trim();
                  if (!text) return;
                  const combined = [noteDraft.trim(), `Reply draft: ${text}`].filter(Boolean).join("\n\n");
                  onSaveNote(combined);
                  onMarkReplied();
                  setReplyDraft("");
                }}
              >
                <Send className="h-3.5 w-3.5" />
                Mark replied
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saves your draft to the internal note and marks the enquiry as replied. Outbound email is not available.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor="enquiry-note">
            Internal note
          </label>
          <Textarea
            id="enquiry-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            placeholder="Private note for the desk…"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={acting}
            disabled={noteDraft === (enquiry.internalNote ?? "")}
            onClick={() => onSaveNote(noteDraft)}
          >
            Save note
          </Button>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-primary text-primary hover:bg-primary/10"
            loading={acting}
            disabled={enquiry.status === "REPLIED"}
            onClick={onMarkReplied}
          >
            <MessageSquareReply className="h-4 w-4" />
            Mark as Replied
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            loading={acting}
            disabled={enquiry.status === "CLOSED"}
            onClick={onCloseEnquiry}
          >
            <XCircle className="h-4 w-4" />
            Close Enquiry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}
