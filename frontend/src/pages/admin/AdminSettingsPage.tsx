import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Settings } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import type { SettingsMap } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";

const POLICY_KEYS = [
  "policies.deliveryDays",
  "policies.expressPercent",
  "policies.expressMaxPhotos",
  "policies.expressNote",
  "policies.extraImageKobo",
  "policies.vatPercent",
  "policies.accompanyingMax",
  "policies.promoUsage",
  "policies.nonRefundable",
  "policies.rescheduleFeePercent",
  "policies.onlineDiscountPercent",
] as const;

const ANALYTICS_KEYS = ["analytics.ga4Id", "analytics.metaPixelId"] as const;

type PolicyKey = (typeof POLICY_KEYS)[number];
type AnalyticsKey = (typeof ANALYTICS_KEYS)[number];
type EditableKey = PolicyKey | AnalyticsKey;

const LABELS: Record<EditableKey, string> = {
  "policies.deliveryDays": "Standard delivery",
  "policies.expressPercent": "Express surcharge %",
  "policies.expressMaxPhotos": "Express max photos",
  "policies.expressNote": "Express note",
  "policies.extraImageKobo": "Extra image (kobo)",
  "policies.vatPercent": "VAT %",
  "policies.accompanyingMax": "Max accompanying guests",
  "policies.promoUsage": "Promo usage note",
  "policies.nonRefundable": "Non-refundable",
  "policies.rescheduleFeePercent": "Reschedule fee %",
  "policies.onlineDiscountPercent": "Online discount %",
  "analytics.ga4Id": "GA4 measurement ID",
  "analytics.metaPixelId": "Meta Pixel ID",
};

const DEFAULTS: Record<EditableKey, string> = {
  "policies.deliveryDays": "3–4 working days",
  "policies.expressPercent": "30",
  "policies.expressMaxPhotos": "8",
  "policies.expressNote": "Within 24hrs · +30% charge (max 8 photos)",
  "policies.extraImageKobo": "300000",
  "policies.vatPercent": "7.5",
  "policies.accompanyingMax": "1",
  "policies.promoUsage": "Photo Arena may use photos for promos unless exclusive package purchased",
  "policies.nonRefundable": "true",
  "policies.rescheduleFeePercent": "15",
  "policies.onlineDiscountPercent": "5",
  "analytics.ga4Id": "",
  "analytics.metaPixelId": "",
};

function pick(source: SettingsMap): Record<EditableKey, string> {
  const next = { ...DEFAULTS };
  for (const key of [...POLICY_KEYS, ...ANALYTICS_KEYS]) {
    if (typeof source[key] === "string") next[key] = source[key]!;
  }
  return next;
}

export function AdminSettingsPage() {
  const api = useAdminApi();
  const [saved, setSaved] = useState<Record<EditableKey, string>>(DEFAULTS);
  const [draft, setDraft] = useState<Record<EditableKey, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const map = await api.settings.get();
      const next = pick(map);
      setSaved(next);
      setDraft(next);
    } catch (err) {
      setError(errorMessage(err, "Could not load settings"));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    return ([...POLICY_KEYS, ...ANALYTICS_KEYS] as EditableKey[]).some((key) => draft[key] !== saved[key]);
  }, [draft, saved]);

  async function onSave() {
    setSaving(true);
    try {
      const payload: SettingsMap = {};
      for (const key of [...POLICY_KEYS, ...ANALYTICS_KEYS] as EditableKey[]) {
        if (draft[key] !== saved[key]) payload[key] = draft[key];
      }
      const map = await api.settings.put(payload);
      const next = pick(map);
      setSaved(next);
      setDraft(next);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pa-settings space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Studio policies and analytics. Site copy lives under Content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/content">Site content</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/notifications">Notifications</Link>
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={!dirty || loading} loading={saving}>
            <Save strokeWidth={1.5} />
            Save changes
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-normal">Studio policies</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-admin-gap sm:grid-cols-2">
              {POLICY_KEYS.map((key) => {
                if (key === "policies.nonRefundable") {
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 sm:col-span-2"
                    >
                      <div>
                        <p className="text-sm text-foreground">{LABELS[key]}</p>
                        <p className="text-xs text-muted-foreground">Shown on public policy surfaces.</p>
                      </div>
                      <Switch
                        checked={draft[key] === "true"}
                        onCheckedChange={(on) => setDraft((prev) => ({ ...prev, [key]: on ? "true" : "false" }))}
                        aria-label={LABELS[key]}
                      />
                    </div>
                  );
                }
                if (key === "policies.promoUsage" || key === "policies.expressNote") {
                  return (
                    <div key={key} className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={key}>{LABELS[key]}</Label>
                      <Textarea
                        id={key}
                        value={draft[key]}
                        onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                        rows={2}
                      />
                    </div>
                  );
                }
                return (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{LABELS[key]}</Label>
                    <Input
                      id={key}
                      value={draft[key]}
                      onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-normal">Analytics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-admin-gap sm:grid-cols-2">
              {ANALYTICS_KEYS.map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{LABELS[key]}</Label>
                  <Input
                    id={key}
                    value={draft[key]}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                    placeholder="Leave blank to disable"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                IDs load on the public site only after cookie consent.
              </p>
            </CardContent>
          </Card>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Settings className="h-3.5 w-3.5" aria-hidden />
            Theme preference is in the header menu. Login email is the studio owner account.
          </p>
        </>
      )}
    </div>
  );
}
