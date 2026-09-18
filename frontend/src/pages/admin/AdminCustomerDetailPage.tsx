import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { BookingStatusBadge } from "../../admin/components/ui/status-badge";
import { TagsInput } from "../../admin/components/ui/tags-input";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime, formatNairaFromKobo } from "../../admin/lib/format";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";

export function AdminCustomerDetailPage() {
  const { id = "" } = useParams();
  const api = useAdminApi();
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);
  const query = useQuery(() => api.customers.get(id), [id], { enabled: !!id });
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const customer = query.data;
  const draftName = name ?? customer?.name ?? "";
  const draftEmail = email ?? customer?.email ?? "";
  const draftNotes = notes ?? customer?.notes ?? "";
  const draftTags = tags ?? customer?.tags ?? [];

  async function save() {
    if (!customer) return;
    setSaving(true);
    try {
      const updated = await api.customers.update(customer.id, {
        name: draftName,
        email: draftEmail || null,
        notes: draftNotes,
        tags: draftTags,
      });
      query.setData(updated);
      setName(null);
      setEmail(null);
      setNotes(null);
      setTags(null);
      toast.success("Customer updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-admin">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/admin/customers">
          <ArrowLeft />
          Back to customers
        </Link>
      </Button>
      <PageHeader title={customer?.name ?? "Customer"} description={customer?.phone} />
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />

      {query.loading || !customer ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField label="Name">
                {(c) => (
                  <Input
                    id={c.id}
                    value={draftName}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!manage}
                  />
                )}
              </FormField>
              <FormField label="Email">
                {(c) => (
                  <Input
                    id={c.id}
                    type="email"
                    value={draftEmail}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!manage}
                  />
                )}
              </FormField>
              <FormField label="Notes">
                {(c) => (
                  <Textarea
                    id={c.id}
                    rows={4}
                    value={draftNotes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!manage}
                  />
                )}
              </FormField>
              <FormField label="Tags">
                {() => <TagsInput value={draftTags} onChange={setTags} disabled={!manage} />}
              </FormField>
              {manage ? (
                <Button onClick={() => void save()} loading={saving}>
                  Save changes
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!customer.bookings?.length ? (
                <EmptyState compact title="No bookings yet" />
              ) : (
                customer.bookings.map((b) => (
                  <Link
                    key={b.id}
                    to={`/admin/bookings?id=${b.id}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.package.name}</p>
                      <p className="text-xs text-muted-foreground">{formatLagosDateTime(b.startTime)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {b.amountKobo != null ? formatNairaFromKobo(b.amountKobo) : "—"}
                      </p>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
