import { useState } from "react";
import { Mail, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { ConfirmDialog } from "../../admin/components/ui/confirm-dialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Pagination } from "../../admin/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../admin/components/ui/sheet";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { EnquiryStatusBadge } from "../../admin/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger } from "../../admin/components/ui/tabs";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime, formatRelative, whatsappLink } from "../../admin/lib/format";
import type { Enquiry, EnquiryStatus } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";

export function AdminEnquiriesPage() {
  const api = useAdminApi();
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);
  const [status, setStatus] = useState<EnquiryStatus | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const query = useQuery(() => api.enquiries.list({ status, page, pageSize: 20 }), [status, page]);

  async function update(partial: { status?: EnquiryStatus; internalNote?: string }) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.enquiries.update(selected.id, partial);
      setSelected(updated);
      setNote(updated.internalNote ?? "");
      toast.success("Enquiry updated");
      await query.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-admin">
      <PageHeader title="Enquiries" description="Contact form inbox from the public site." />
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />

      <Tabs
        value={status || "all"}
        onValueChange={(v) => {
          setPage(1);
          setStatus(v === "all" ? "" : (v as EnquiryStatus));
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="NEW">New</TabsTrigger>
          <TabsTrigger value="REPLIED">Replied</TabsTrigger>
          <TabsTrigger value="CLOSED">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !query.data?.items.length ? (
        <EmptyState title="No enquiries" description="New messages from the contact form will land here." />
      ) : (
        <>
          <div className="space-y-2">
            {query.data.items.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setSelected(e);
                  setNote(e.internalNote ?? "");
                }}
                className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{e.sessionType || e.message}</p>
                  <p className="text-[11px] text-muted-foreground">{formatRelative(e.createdAt)}</p>
                </div>
                <EnquiryStatusBadge status={e.status} />
              </button>
            ))}
          </div>
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>{formatLagosDateTime(selected.createdAt)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <EnquiryStatusBadge status={selected.status} />
                <p>
                  <span className="text-muted-foreground">Email:</span> {selected.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {selected.phone || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Session:</span> {selected.sessionType || "—"}
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{selected.message}</p>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${selected.email}?subject=${encodeURIComponent("Re: Photo Arena enquiry")}`}>
                      <Mail />
                      Email
                    </a>
                  </Button>
                  {selected.phone ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={whatsappLink(selected.phone, `Hi ${selected.name}, thanks for contacting Photo Arena.`)} target="_blank" rel="noreferrer">
                        <MessageCircle />
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal note</p>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                  <Button size="sm" loading={saving} onClick={() => void update({ internalNote: note })}>
                    Save note
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="secondary" loading={saving} onClick={() => void update({ status: "REPLIED" })}>
                    Mark replied
                  </Button>
                  <Button size="sm" variant="outline" loading={saving} onClick={() => void update({ status: "CLOSED" })}>
                    Close
                  </Button>
                  {manage ? (
                    <ConfirmDialog
                      title="Delete enquiry?"
                      description="This permanently removes the message."
                      confirmLabel="Delete"
                      destructive
                      successMessage="Enquiry deleted"
                      onConfirm={async () => {
                        await api.enquiries.remove(selected.id);
                        setSelected(null);
                        await query.refetch();
                      }}
                      trigger={
                        <Button size="sm" variant="destructive">
                          <Trash2 />
                          Delete
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
