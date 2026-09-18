import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Pagination } from "../../admin/components/ui/pagination";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import { TagsInput } from "../../admin/components/ui/tags-input";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime, humanize } from "../../admin/lib/format";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";

export function AdminNotificationsPage() {
  const api = useAdminApi();
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);
  const settingsQuery = useQuery(() => api.notifications.settings(), []);
  const templatesQuery = useQuery(() => api.notifications.templates(), []);
  const [page, setPage] = useState(1);
  const logsQuery = useQuery(() => api.notifications.logs({ page, pageSize: 20 }), [page]);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder2h, setReminder2h] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setRecipients(settingsQuery.data.recipients ?? []);
    setReminder24h(settingsQuery.data.reminder24h);
    setReminder2h(settingsQuery.data.reminder2h);
  }, [settingsQuery.data]);

  async function save() {
    setSaving(true);
    try {
      await api.notifications.putSettings({ recipients, reminder24h, reminder2h });
      toast.success("Notification settings saved");
      await settingsQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const result = await api.notifications.test();
      toast.success(result.dryRun ? "Test logged (SMTP not configured)" : "Test email sent");
      await logsQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Notifications"
        description="Recipients, reminders, templates and delivery logs."
        actions={
          manage ? (
            <Button variant="outline" onClick={() => void sendTest()} loading={testing}>
              <Send />
              Send test
            </Button>
          ) : null
        }
      />
      <ErrorBanner
        message={settingsQuery.error || templatesQuery.error || logsQuery.error}
        onRetry={() => {
          void settingsQuery.refetch();
          void templatesQuery.refetch();
          void logsQuery.refetch();
        }}
        retrying={settingsQuery.fetching}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Settings</CardTitle>
            {settingsQuery.data ? (
              <Badge variant={settingsQuery.data.smtpConfigured ? "success" : "warning"}>
                {settingsQuery.data.smtpConfigured ? "SMTP ready" : "Dry-run"}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsQuery.loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <FormField label="Recipients" hint="Email addresses that receive studio alerts.">
                  {() => <TagsInput value={recipients} onChange={setRecipients} disabled={!manage} placeholder="Add email…" />}
                </FormField>
                {settingsQuery.data?.fromAddress ? (
                  <p className="text-xs text-muted-foreground">From: {settingsQuery.data.fromAddress}</p>
                ) : null}
                <FormField label="24h reminder" inline>
                  {() => <Switch checked={reminder24h} onCheckedChange={setReminder24h} disabled={!manage} />}
                </FormField>
                <FormField label="2h reminder" inline>
                  {() => <Switch checked={reminder2h} onCheckedChange={setReminder2h} disabled={!manage} />}
                </FormField>
                {manage ? (
                  <Button onClick={() => void save()} loading={saving}>
                    Save settings
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templatesQuery.loading ? (
              <Skeleton className="h-32 w-full" />
            ) : !templatesQuery.data?.length ? (
              <EmptyState compact title="No templates" />
            ) : (
              templatesQuery.data.map((t) => (
                <div key={t.event} className="rounded-md border border-border px-3 py-2">
                  <p className="text-sm font-medium">{humanize(t.event)}</p>
                  <p className="text-xs text-muted-foreground">{t.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.bodyPreview}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logsQuery.loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : !logsQuery.data?.items.length ? (
            <EmptyState compact title="No logs yet" />
          ) : (
            <>
              {logsQuery.data.items.map((log) => (
                <div key={log.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{humanize(log.event)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {log.channel} → {log.to}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatLagosDateTime(log.createdAt)}</p>
                </div>
              ))}
              <Pagination
                page={logsQuery.data.page}
                pageSize={logsQuery.data.pageSize}
                total={logsQuery.data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
