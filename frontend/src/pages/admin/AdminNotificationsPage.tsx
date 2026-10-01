import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, ChevronLeft, ChevronRight, Eye, Mail, MessageSquarePlus, Pencil, Send } from "lucide-react";
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
import { cn } from "../../lib/cn";

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
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<NotificationTemplate | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editSaving, setEditSaving] = useState(false);
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

          <div className="grid gap-admin-stack lg:grid-cols-12 items-start">
            {/* Left: Template Selector List */}
            <Card className="lg:col-span-5 overflow-hidden">
              <CardHeader className="p-admin-card-sm border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display text-lg font-normal">Templates</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a template to preview or customize
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {templates.length} Active
                </Badge>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 space-y-2.5 max-h-[600px] overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No templates registered.</p>
                ) : (
                  templates.map((template) => {
                    const isSelected = (selectedTemplate?.event ?? templates[0]?.event) === template.event;
                    return (
                      <div
                        key={template.event}
                        onClick={() => setSelectedTemplate(template)}
                        className={cn(
                          "group relative flex items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                            : "border-border/60 hover:border-border hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                              isSelected
                                ? "border-primary/40 bg-primary/20 text-primary"
                                : "border-border bg-muted/40 text-muted-foreground group-hover:text-foreground",
                            )}
                          >
                            <Mail className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-sm font-medium text-foreground truncate">
                              {template.subject}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {template.event}
                              </span>
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground/80 mt-1">
                              {template.bodyPreview}
                            </p>
                          </div>
                        </div>

                        {/* Edit Action Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit message template"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(template);
                            setEditTemplate(template);
                            setEditSubject(template.subject);
                            setEditMessage(template.bodyPreview);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit template</span>
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Right: Rich Message & Email Live Preview */}
            <Card className="lg:col-span-7 overflow-hidden border border-border shadow-sm">
              <CardHeader className="p-admin-card-sm border-b border-border flex flex-row items-center justify-between bg-muted/10">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <CardTitle className="font-display text-base font-normal">
                    Message Preview
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const activeTpl = selectedTemplate || templates[0];
                      if (activeTpl) {
                        setEditTemplate(activeTpl);
                        setEditSubject(activeTpl.subject);
                        setEditMessage(activeTpl.bodyPreview);
                        setEditOpen(true);
                      }
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit Message
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    onClick={() => void sendTest()}
                    loading={testing}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Test Send
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-4 bg-background/50">
                {/* Mail Client Header Simulator */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">From:</span>
                      <span>{settings?.fromAddress || "Photo Arena <noreply@photoarenang.com>"}</span>
                    </div>
                    <span className="text-[11px]">Today · 2:30 PM</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground border-b border-border/40 pb-2">
                    <span className="font-semibold text-foreground">To:</span>
                    <span className="text-foreground/90">Amaka Johnson &lt;amaka.johnson@example.com&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground font-medium pt-0.5">
                    <span className="text-muted-foreground font-semibold">Subject:</span>
                    <span className="text-primary font-sans font-medium">
                      {(selectedTemplate || templates[0])?.subject.replace(/\{\{reference\}\}/g, "PA-8942").replace(/\{\{customerName\}\}/g, "Amaka Johnson") || "Photo Arena Notification"}
                    </span>
                  </div>
                </div>

                {/* Email Body Visual Canvas */}
                <div className="rounded-2xl border border-border bg-[#101112] text-stone-100 p-6 sm:p-8 space-y-6 shadow-md">
                  {/* Brand Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-5">
                    <div className="space-y-0.5">
                      <span className="font-display text-xl font-medium tracking-wide text-white">
                        PHOTO ARENA
                      </span>
                      <p className="text-[11px] text-stone-400 font-mono tracking-widest uppercase">
                        Studio &amp; Creative Space
                      </p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5">
                      {(selectedTemplate || templates[0])?.event.replace(/_/g, " ") || "NOTIFICATION"}
                    </Badge>
                  </div>

                  {/* Salutation & Headline */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-200/90">Hello Amaka Johnson,</p>
                    <h3 className="font-display text-2xl font-normal text-white">
                      {(selectedTemplate || templates[0])?.event === "booking_confirmed"
                        ? "Your Session is Confirmed! 🎉"
                        : (selectedTemplate || templates[0])?.event === "payment_received"
                        ? "Payment Received 💳"
                        : (selectedTemplate || templates[0])?.event === "booking_cancelled"
                        ? "Booking Cancelled ❌"
                        : (selectedTemplate || templates[0])?.event === "booking_rescheduled"
                        ? "Booking Rescheduled 📅"
                        : "Your Photo Session Update"}
                    </h3>
                    <p className="text-sm text-stone-300 leading-relaxed">
                      {(selectedTemplate || templates[0])?.bodyPreview
                        .replace(/\{\{customerName\}\}/g, "Amaka Johnson")
                        .replace(/\{\{reference\}\}/g, "PA-8942")
                        .replace(/\{\{startTime\}\}/g, "Saturday, 24 Oct 2026 · 2:00 PM")
                        .replace(/\{\{amount\}\}/g, "₦40,000") ||
                        "Thank you for choosing Photo Arena. Here are your booking details."}
                    </p>
                  </div>

                  {/* Structured Details Box */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3 font-sans text-xs">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-stone-400">Booking Reference:</span>
                      <span className="font-mono font-bold text-amber-300 text-sm">PA-8942</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-stone-400">Session Type:</span>
                      <span className="text-stone-200 font-medium">Personal / Birthday Shoots (2 Outfits)</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-stone-400">Scheduled Date &amp; Time:</span>
                      <span className="text-stone-200 font-medium">Saturday, 24 Oct 2026 · 2:00 PM WAT</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-stone-400">Studio Location:</span>
                      <span className="text-stone-200">12 Peter Odili Road, Trans-Amadi, Port Harcourt</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-stone-400">Total Amount:</span>
                      <span className="font-mono font-bold text-white text-sm">₦40,000</span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <div className="pt-2 flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-xs font-bold uppercase tracking-wider text-stone-950 shadow-md">
                      <span>View Booking Details</span>
                    </div>
                  </div>

                  {/* Footer Notes */}
                  <div className="border-t border-white/10 pt-4 text-[11px] text-stone-400 space-y-1">
                    <p>Need to modify your appointment? Reach us on WhatsApp at +234 812 345 6789 or reply to this email.</p>
                    <p className="text-stone-500">© 2026 Photo Arena Studio. All rights reserved.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-admin-stack-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-normal">Delivery log</h2>
                {logTotal > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Showing {Math.min((logPage - 1) * PAGE_SIZE + 1, logTotal)}–{Math.min(logPage * PAGE_SIZE, logTotal)} of {logTotal} entries
                  </p>
                ) : null}
              </div>
              <p className="text-xs font-medium text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border">
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

      {/* Edit Notification Template Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Template · {editTemplate?.event}
            </DialogTitle>
            <DialogDescription>
              Customize the default subject line and message body used when this event triggers.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setEditSaving(true);
              setTimeout(() => {
                if (editTemplate) {
                  const updated = templates.map((t) =>
                    t.event === editTemplate.event
                      ? { ...t, subject: editSubject, bodyPreview: editMessage }
                      : t
                  );
                  setTemplates(updated);
                  if (selectedTemplate?.event === editTemplate.event) {
                    setSelectedTemplate({
                      ...selectedTemplate,
                      subject: editSubject,
                      bodyPreview: editMessage,
                    });
                  }
                }
                setEditSaving(false);
                setEditOpen(false);
                toast.success(`Template updated for ${editTemplate?.event}`);
              }, 400);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-subject">Subject Line Template</Label>
              <Input
                id="edit-subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Photo Arena — ..."
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Supported variables: <code>{"{{reference}}"}</code>, <code>{"{{customerName}}"}</code>, <code>{"{{startTime}}"}</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-message">Message Copy Template</Label>
              <Textarea
                id="edit-message"
                rows={5}
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="Message body..."
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Supported variables: <code>{"{{customerName}}"}</code>, <code>{"{{reference}}"}</code>, <code>{"{{startTime}}"}</code>, <code>{"{{amount}}"}</code>
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setManualSubject(editSubject);
                  setManualMessage(editMessage);
                  setEditOpen(false);
                  setManualOpen(true);
                }}
              >
                Send as Manual Message
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={editSaving}>
                  Save Template
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
