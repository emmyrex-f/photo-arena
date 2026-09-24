import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ExternalLink,
  LayoutGrid,
  Save,
  Video,
} from "lucide-react";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { Input } from "../../admin/components/ui/input";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import type { SettingsMap } from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { site } from "../../lib/site";

type TabKey = "homepage" | "about" | "services" | "contact" | "seo";
type SectionKey = "hero" | "tour" | "cta";

const TABS: { id: TabKey; label: string }[] = [
  { id: "homepage", label: "Homepage" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "contact", label: "Contact" },
  { id: "seo", label: "SEO" },
];

const HOMEPAGE_SECTIONS: { id: SectionKey; label: string; hint: string }[] = [
  { id: "hero", label: "Hero", hint: "Headline, subtitle, and background video" },
  { id: "tour", label: "Studio Tour", hint: "Tour heading, body, and video (Features slot)" },
  { id: "cta", label: "CTA", hint: "Booking call-to-action block" },
];

const EDITABLE_KEYS = [
  "hero.headline",
  "hero.subheadline",
  "hero.videoUrl",
  "tour.heading",
  "tour.body",
  "tour.videoUrl",
  "cta.heading",
  "cta.body",
  "cta.buttonLabel",
  "cta.buttonHref",
  "about.headline",
  "about.body",
  "about.imageUrl",
  "about.ctaLabel",
  "about.ctaHref",
  "site.name",
  "site.tagline",
  "site.phone",
  "site.email",
  "site.whatsapp",
  "site.address",
  "site.hours.weekday",
  "site.hours.sunday",
  "site.mapEmbed",
  "social.instagram",
  "social.facebook",
  "social.tiktok",
  "seo.defaultTitle",
  "seo.defaultDescription",
  "seo.ogImage",
] as const;

type EditableKey = (typeof EDITABLE_KEYS)[number];

const DEFAULTS: Record<EditableKey, string> = {
  "hero.headline": site.hero.headline,
  "hero.subheadline": site.hero.subheadline,
  "hero.videoUrl": site.hero.videoUrl,
  "tour.heading": site.tour.heading,
  "tour.body": site.tour.body,
  "tour.videoUrl": site.tour.videoUrl,
  "cta.heading": site.cta.heading,
  "cta.body": site.cta.body,
  "cta.buttonLabel": site.cta.buttonLabel,
  "cta.buttonHref": site.cta.buttonHref,
  "about.headline": site.about.headline,
  "about.body": site.about.body,
  "about.imageUrl": site.about.imageUrl,
  "about.ctaLabel": site.about.ctaLabel,
  "about.ctaHref": site.about.ctaHref,
  "site.name": site.name,
  "site.tagline": site.tagline,
  "site.phone": site.phone,
  "site.email": site.email,
  "site.whatsapp": site.whatsapp,
  "site.address": site.address.full,
  "site.hours.weekday": site.hoursWeekday,
  "site.hours.sunday": site.hoursSunday,
  "site.mapEmbed": site.mapEmbed,
  "social.instagram": site.instagram,
  "social.facebook": site.facebook,
  "social.tiktok": site.tiktok,
  "seo.defaultTitle": site.seo.defaultTitle,
  "seo.defaultDescription": site.seo.defaultDescription,
  "seo.ogImage": site.seo.ogImage,
};

function pickEditable(source: SettingsMap): Record<EditableKey, string> {
  const out = { ...DEFAULTS };
  for (const key of EDITABLE_KEYS) {
    const value = source[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((t) => t.id === value);
}

export function AdminContentPage() {
  const api = useAdminApi();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "homepage";

  const [saved, setSaved] = useState<Record<EditableKey, string>>(DEFAULTS);
  const [draft, setDraft] = useState<Record<EditableKey, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<SectionKey | null>("hero");

  const setTab = useCallback(
    (next: TabKey) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next === "homepage") copy.delete("tab");
          else copy.set("tab", next);
          return copy;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const map = await api.settings.get();
      const next = pickEditable(map);
      setSaved(next);
      setDraft(next);
    } catch (err) {
      setError(errorMessage(err));
      if (!(err instanceof ApiError)) toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => EDITABLE_KEYS.some((key) => (draft[key] ?? "") !== (saved[key] ?? "")),
    [draft, saved],
  );

  function setField(key: EditableKey, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!dirty) {
      toast.message("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const payload: SettingsMap = {};
      for (const key of EDITABLE_KEYS) {
        if ((draft[key] ?? "") !== (saved[key] ?? "")) {
          payload[key] = draft[key] ?? "";
        }
      }
      const map = await api.settings.put(payload);
      const next = pickEditable(map);
      setSaved(next);
      setDraft(next);
      toast.success("Content saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function jumpTo(section: SectionKey) {
    setTab("homepage");
    setOpenSection(section);
  }

  return (
    <div className="pa-content space-y-admin-stack">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Content
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit homepage, about, contact, and SEO copy stored in studio settings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              View site
            </Link>
          </Button>
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => void save()}>
            <Save className="h-4 w-4" strokeWidth={1.5} />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      <div
        role="tablist"
        aria-label="Content sections"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-admin-stack xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          ) : null}

          {!loading && tab === "homepage" ? (
            <div className="space-y-3">
              {HOMEPAGE_SECTIONS.map((section) => {
                const open = openSection === section.id;
                return (
                  <Card key={section.id} id={`section-${section.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-admin-card-sm text-left"
                      onClick={() => setOpenSection(open ? null : section.id)}
                      aria-expanded={open}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">{section.label}</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{section.hint}</p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {open ? (
                      <CardContent className="space-y-4 border-t border-border pt-4">
                        {section.id === "hero" ? (
                          <>
                            <VideoPreview url={draft["hero.videoUrl"]} label="Hero video" />
                            <FormField label="Title" required>
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["hero.headline"]}
                                  onChange={(e) => setField("hero.headline", e.target.value)}
                                />
                              )}
                            </FormField>
                            <FormField label="Subtitle">
                              {(c) => (
                                <Textarea
                                  {...c}
                                  rows={3}
                                  value={draft["hero.subheadline"]}
                                  onChange={(e) => setField("hero.subheadline", e.target.value)}
                                />
                              )}
                            </FormField>
                            <FormField
                              label="Background video"
                              hint="Path or URL. Full media upload lands with the Media Library module."
                            >
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["hero.videoUrl"]}
                                  onChange={(e) => setField("hero.videoUrl", e.target.value)}
                                  placeholder="/LANDSCAPE.mp4"
                                />
                              )}
                            </FormField>
                          </>
                        ) : null}

                        {section.id === "tour" ? (
                          <>
                            <VideoPreview url={draft["tour.videoUrl"]} label="Tour video" />
                            <FormField label="Heading" required>
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["tour.heading"]}
                                  onChange={(e) => setField("tour.heading", e.target.value)}
                                />
                              )}
                            </FormField>
                            <FormField label="Body">
                              {(c) => (
                                <Textarea
                                  {...c}
                                  rows={4}
                                  value={draft["tour.body"]}
                                  onChange={(e) => setField("tour.body", e.target.value)}
                                />
                              )}
                            </FormField>
                            <FormField label="Video URL" hint="Path or URL for the studio tour clip.">
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["tour.videoUrl"]}
                                  onChange={(e) => setField("tour.videoUrl", e.target.value)}
                                  placeholder="/tour.mp4"
                                />
                              )}
                            </FormField>
                          </>
                        ) : null}

                        {section.id === "cta" ? (
                          <>
                            <FormField label="Title" required>
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["cta.heading"]}
                                  onChange={(e) => setField("cta.heading", e.target.value)}
                                />
                              )}
                            </FormField>
                            <FormField label="Description">
                              {(c) => (
                                <Textarea
                                  {...c}
                                  rows={3}
                                  value={draft["cta.body"]}
                                  onChange={(e) => setField("cta.body", e.target.value)}
                                />
                              )}
                            </FormField>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField label="Button label">
                                {(c) => (
                                  <Input
                                    {...c}
                                    value={draft["cta.buttonLabel"]}
                                    onChange={(e) => setField("cta.buttonLabel", e.target.value)}
                                  />
                                )}
                              </FormField>
                              <FormField label="Button link" hint="Internal path or absolute URL.">
                                {(c) => (
                                  <Input
                                    {...c}
                                    value={draft["cta.buttonHref"]}
                                    onChange={(e) => setField("cta.buttonHref", e.target.value)}
                                  />
                                )}
                              </FormField>
                            </div>
                          </>
                        ) : null}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : null}

          {!loading && tab === "about" ? (
            <Card>
              <CardHeader className="p-admin-card-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="font-display text-lg font-normal">Home About strip</CardTitle>
                  <ActiveBadge active />
                </div>
                <p className="text-xs text-muted-foreground">Shown on the homepage About section.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Headline" required>
                  {(c) => (
                    <Input
                      {...c}
                      value={draft["about.headline"]}
                      onChange={(e) => setField("about.headline", e.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Body">
                  {(c) => (
                    <Textarea
                      {...c}
                      rows={4}
                      value={draft["about.body"]}
                      onChange={(e) => setField("about.body", e.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Image URL" hint="Path or URL. Upload via Media Library later.">
                  {(c) => (
                    <Input
                      {...c}
                      value={draft["about.imageUrl"]}
                      onChange={(e) => setField("about.imageUrl", e.target.value)}
                    />
                  )}
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="CTA label">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["about.ctaLabel"]}
                        onChange={(e) => setField("about.ctaLabel", e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="CTA link">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["about.ctaHref"]}
                        onChange={(e) => setField("about.ctaHref", e.target.value)}
                      />
                    )}
                  </FormField>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!loading && tab === "services" ? (
            <Card>
              <CardHeader className="p-admin-card-sm">
                <CardTitle className="font-display text-lg font-normal">Services catalog</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Packages, pricing, and durations live in the Services desk — not in content settings.
                </p>
                <Button type="button" asChild>
                  <Link to="/admin/services">
                    <LayoutGrid className="h-4 w-4" />
                    Open Services
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!loading && tab === "contact" ? (
            <Card>
              <CardHeader className="p-admin-card-sm">
                <CardTitle className="font-display text-lg font-normal">Contact &amp; hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Studio name">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["site.name"]}
                        onChange={(e) => setField("site.name", e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="Phone">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["site.phone"]}
                        onChange={(e) => setField("site.phone", e.target.value)}
                      />
                    )}
                  </FormField>
                </div>
                <FormField label="Tagline">
                  {(c) => (
                    <Input
                      {...c}
                      value={draft["site.tagline"]}
                      onChange={(e) => setField("site.tagline", e.target.value)}
                    />
                  )}
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Email">
                    {(c) => (
                      <Input
                        {...c}
                        type="email"
                        value={draft["site.email"]}
                        onChange={(e) => setField("site.email", e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="WhatsApp link">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["site.whatsapp"]}
                        onChange={(e) => setField("site.whatsapp", e.target.value)}
                      />
                    )}
                  </FormField>
                </div>
                <FormField label="Address">
                  {(c) => (
                    <Textarea
                      {...c}
                      rows={2}
                      value={draft["site.address"]}
                      onChange={(e) => setField("site.address", e.target.value)}
                    />
                  )}
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Hours · Mon–Sat">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["site.hours.weekday"]}
                        onChange={(e) => setField("site.hours.weekday", e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="Hours · Sunday">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["site.hours.sunday"]}
                        onChange={(e) => setField("site.hours.sunday", e.target.value)}
                      />
                    )}
                  </FormField>
                </div>
                <FormField label="Map embed URL">
                  {(c) => (
                    <Input
                      {...c}
                      value={draft["site.mapEmbed"]}
                      onChange={(e) => setField("site.mapEmbed", e.target.value)}
                    />
                  )}
                </FormField>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Instagram">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["social.instagram"]}
                        onChange={(e) => setField("social.instagram", e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="Facebook">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["social.facebook"]}
                        onChange={(e) => setField("social.facebook", e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="TikTok">
                    {(c) => (
                      <Input
                        {...c}
                        value={draft["social.tiktok"]}
                        onChange={(e) => setField("social.tiktok", e.target.value)}
                      />
                    )}
                  </FormField>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!loading && tab === "seo" ? (
            <Card>
              <CardHeader className="p-admin-card-sm">
                <CardTitle className="font-display text-lg font-normal">Default SEO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Default title">
                  {(c) => (
                    <Input
                      {...c}
                      value={draft["seo.defaultTitle"]}
                      onChange={(e) => setField("seo.defaultTitle", e.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Default description">
                  {(c) => (
                    <Textarea
                      {...c}
                      rows={4}
                      value={draft["seo.defaultDescription"]}
                      onChange={(e) => setField("seo.defaultDescription", e.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="OG image" hint="Path or absolute URL used for social previews.">
                  {(c) => (
                    <Input
                      {...c}
                      value={draft["seo.ogImage"]}
                      onChange={(e) => setField("seo.ogImage", e.target.value)}
                    />
                  )}
                </FormField>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader className="p-admin-card-sm">
              <CardTitle className="text-sm font-medium">Content Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2 pt-0">
              {HOMEPAGE_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpTo(section.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/40",
                    tab === "homepage" && openSection === section.id && "bg-primary/10",
                  )}
                >
                  <span>{section.label}</span>
                  <Badge variant="success">Active</Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-admin-card-sm">
              <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2 pt-0">
              <QuickLink to="/" label="Public homepage" />
              <QuickLink to="/about" label="About page" />
              <QuickLink to="/admin/services" label="Services desk" />
              <QuickLink to="/admin/gallery" label="Media Library" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-admin-card-sm">
              <CardTitle className="text-sm font-medium">Recent Updates</CardTitle>
            </CardHeader>
            <CardContent className="p-admin-card-sm pt-0">
              <EmptyState
                compact
                className="border-0 bg-transparent px-0 py-4"
                title="No timeline yet"
                description="Settings audit history will appear here when available."
              />
            </CardContent>
          </Card>

          {dirty ? (
            <p className="text-xs text-muted-foreground">You have unsaved content changes.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  const external = !to.startsWith("/admin");
  return (
    <Link
      to={to}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted/40"
    >
      <span>{label}</span>
      {external ? <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> : null}
    </Link>
  );
}

function VideoPreview({ url, label }: { url: string; label: string }) {
  if (!url.trim()) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Video className="h-4 w-4" />
          No video path set
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
      <video
        key={url}
        className="aspect-video w-full object-cover"
        muted
        playsInline
        preload="metadata"
        controls
        aria-label={label}
      >
        <source src={url} />
      </video>
    </div>
  );
}
