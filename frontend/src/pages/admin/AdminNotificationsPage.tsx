import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, ChevronLeft, ChevronRight, Mail, MessageSquarePlus, Send } from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../admin/components/ui/dialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { TagsInput } from "../../admin/components/ui/tags-input";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime } from "../../admin/lib/format";
import type { NotificationLog, NotificationSettings, NotificationTemplate } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";

const PAGE_SIZE = 20;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AdminNotificationsPage() {
  const api = useAdminApi();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder2h, setReminder2h] = useState(true);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTo, setManualTo] = useState("");
  const [manualCustomer, setManualCustomer] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualSending, setManualSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSettings, nextTemplates, nextLogs] = await Promise.all([
        api.notifications.settings(),
        api.notifications.templates(),
        api.notifications.logs({ page: logPage, pageSize: PAGE_SIZE }),
      ]);
      setSettings(nextSettings);
      setRecipients(nextSettings.recipients ?? []);
      setReminder24h(nextSettings.reminder24h);
      setReminder2h(nextSettings.reminder2h);
      setTemplates(nextTemplates);
      setLogs(nextLogs.items);
      setLogTotal(nextLogs.total);
    } catch (err) {
      setError(errorMessage(err, "Could not load notifications"));
    } finally {
      setLoading(false);
    }
  }, [api, logPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const cleaned = recipients.map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (cleaned.some((email) => !isEmail(email))) {
      toast.error("Every recipient must be a valid email");
      return;
    }
    setSaving(true);
    try {
      const next = await api.notifications.putSettings({
        recipients: cleaned,
        reminder24h,
        reminder2h,
      });
      setSettings(next);
      setRecipients(next.recipients);
      toast.success("Notification settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      await api.notifications.test();
      toast.success("Test notification sent");
      const nextLogs = await api.notifications.logs({ page: 1, pageSize: PAGE_SIZE });
      setLogPage(1);
      setLogs(nextLogs.items);
      setLogTotal(nextLogs.total);
    } catch (err) {
      toast.error(errorMessage(err, "Test send failed"));
    } finally {
      setTesting(false);
    }
  }

  async function sendManual(event: FormEvent) {
    event.preventDefault();
    const cleanTo = manualTo.trim().toLowerCase();
    if (!isEmail(cleanTo)) {
      toast.error("Please enter a valid recipient email");
      return;
    }
    if (!manualSubject.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!manualMessage.trim()) {
      toast.error("Please enter a message body");
      return;
    }

    setManualSending(true);
    try {
      await api.notifications.sendManual({
        to: cleanTo,
        subject: manualSubject.trim(),
        message: manualMessage.trim(),
        customerName: manualCustomer.trim() || undefined,
      });
      toast.success(`Message sent to ${cleanTo}`);
      setManualOpen(false);
      setManualTo("");
      setManualCustomer("");
      setManualSubject("");
      setManualMessage("");
      const nextLogs = await api.notifications.logs({ page: 1, pageSize: PAGE_SIZE });
      setLogPage(1);
      setLogs(nextLogs.items);
      setLogTotal(nextLogs.total);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to send message"));
    } finally {
      setManualSending(false);
    }
  }

  const logPageCount = Math.max(1, Math.ceil(logTotal / PAGE_SIZE));

  return (
    <div className="pa-notifications space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desk alerts, booking reminders, rich HTML templates, and client messaging.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void sendTest()} loading={testing}>
            <Send strokeWidth={1.5} />
            Send test
          </Button>
          <Button type="button" onClick={() => setManualOpen(true)}>
            <MessageSquarePlus strokeWidth={1.5} />
            Manual message
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      {loading && !settings ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="font-display text-lg font-normal">Email settings</CardTitle>
              <Badge variant={settings?.emailConfigured ? "success" : "warning"}>
                {settings?.emailConfigured
                  ? settings.provider === "resend"
                    ? "Resend active"
                    : "SMTP active"
                  : "Email not configured"}
              </Badge>
            </CardHeader>
            <CardContent>
              {!settings?.emailConfigured ? (
                <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                  Password resets and booking emails will not leave the server until you set{" "}
                  <code className="rounded bg-background/60 px-1">RESEND_API_KEY</code> (preferred) or{" "}
                  <code className="rounded bg-background/60 px-1">SMTP_HOST</code> /{" "}
                  <code className="rounded bg-background/60 px-1">SMTP_USER</code> /{" "}
                  <code className="rounded bg-background/60 px-1">SMTP_PASS</code> in{" "}
                  <code className="rounded bg-background/60 px-1">backend/.env</code>, then restart the API.
                  While unconfigured, reset links are printed in the Nest console as{" "}
                  <code className="rounded bg-background/60 px-1">[email:dry-run]</code>.
                </div>
              ) : null}
              <form className="space-y-admin-stack-sm" onSubmit={(event) => void saveSettings(event)}>
                {settings?.fromAddress ? (
                  <p className="text-xs text-muted-foreground">From: {settings.fromAddress}</p>
                ) : null}
                <div className="space-y-1.5">
                  <Label>Desk recipients</Label>
                  <TagsInput
                    value={recipients}
                    onChange={setRecipients}
                    placeholder="Add email and press Enter"
                  />
                  <p className="text-xs text-muted-foreground">
                    Booking alerts go to these addresses. Use full emails only.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">24-hour reminder</p>
                    <p className="text-xs text-muted-foreground">Remind before sessions starting in about a day.</p>
                  </div>
                  <Switch checked={reminder24h} onCheckedChange={setReminder24h} aria-label="24-hour reminder" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">2-hour reminder</p>
                    <p className="text-xs text-muted-foreground">Remind before sessions starting in about two hours.</p>
                  </div>
                  <Switch checked={reminder2h} onCheckedChange={setReminder2h} aria-label="2-hour reminder" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={saving}>
                    Save settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-normal">Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates registered.</p>
              ) : (
                <ul className="space-y-3">
                  {templates.map((template) => (
                    <li key={template.event} className="rounded-lg border border-border p-3">
                      <div className="flex items-start gap-2">
                        <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{template.subject}</p>
                          <p className="text-xs text-muted-foreground">{template.event}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.bodyPreview}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <section className="space-y-admin-stack-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-normal">Delivery log</h2>
              <p className="text-xs text-muted-foreground">
                Page {logPage} of {logPageCount}
              </p>
            </div>
            {logs.length === 0 ? (
              <EmptyState icon={Bell} title="No notification logs yet" description="Sends will appear here." compact />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Channel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatLagosDateTime(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">{row.event}</TableCell>
                        <TableCell className="text-sm">{row.to}</TableCell>
                        <TableCell>
                          <Badge variant="muted">{row.channel}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logPage <= 1}
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logPage >= logPageCount}
                onClick={() => setLogPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Manual Notification</DialogTitle>
            <DialogDescription>
              Compose and dispatch a branded studio email directly to any customer or desk recipient.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-admin-stack-sm" onSubmit={(e) => void sendManual(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="manual-to">Recipient Email</Label>
              <Input
                id="manual-to"
                type="email"
                placeholder="customer@example.com"
                value={manualTo}
                onChange={(e) => setManualTo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-customer">Customer Name (optional)</Label>
              <Input
                id="manual-customer"
                type="text"
                placeholder="e.g. Chioma Okafor"
                value={manualCustomer}
                onChange={(e) => setManualCustomer(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-subject">Subject Line</Label>
              <Input
                id="manual-subject"
                type="text"
                placeholder="e.g. Update regarding your upcoming portrait session"
                value={manualSubject}
                onChange={(e) => setManualSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-message">Message Content</Label>
              <Textarea
                id="manual-message"
                rows={5}
                placeholder="Type your message here..."
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={manualSending}>
                <Send strokeWidth={1.5} />
                Send message
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
