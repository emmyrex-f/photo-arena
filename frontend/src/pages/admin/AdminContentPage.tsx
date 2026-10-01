import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  ImageIcon,
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Save,
  Upload,
  Video,
  X,
} from "lucide-react";
import { BlogAssetPickerModal } from "../../admin/components/BlogAssetPickerModal";
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
import {
  ABOUT_PAGE_SLIDES,
  BOOK_PAGE_SLIDES,
  HOME_ABOUT_EXTRA_IMAGES,
  PORTFOLIO_PAGE_SLIDES,
} from "../../data/headerStills";

type TabKey = "homepage" | "banners" | "about" | "services" | "contact" | "seo";
type SectionKey = "hero" | "tour" | "cta";
type BannerKey = "site.header.about" | "site.header.portfolio" | "site.header.book" | "about.images";

const TABS: { id: TabKey; label: string }[] = [
  { id: "homepage", label: "Homepage" },
  { id: "banners", label: "Page banners" },
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

const BANNER_PAGES: { key: BannerKey; label: string; path: string; fallback: string[] }[] = [
  { key: "site.header.about", label: "About page", path: "/about", fallback: ABOUT_PAGE_SLIDES.map((s) => s.src) },
  {
    key: "site.header.portfolio",
    label: "Portfolio page",
    path: "/portfolio",
    fallback: PORTFOLIO_PAGE_SLIDES.map((s) => s.src),
  },
  { key: "site.header.book", label: "Book Now page", path: "/book", fallback: BOOK_PAGE_SLIDES.map((s) => s.src) },
];

function parseSlideUrls(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
  } catch {
    return [];
  }
}

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
  "site.header.about",
  "site.header.portfolio",
  "site.header.book",
  "about.images",
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
  "site.header.about": "",
  "site.header.portfolio": "",
  "site.header.book": "",
  "about.images": "",
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
  const [editingAbout, setEditingAbout] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingSeo, setEditingSeo] = useState(false);
  const [assetPickerField, setAssetPickerField] = useState<EditableKey | null>(null);
  const [bannerPickerKey, setBannerPickerKey] = useState<BannerKey | null>(null);
  const aboutCarouselFallback = [draft["about.imageUrl"] || site.about.imageUrl, ...HOME_ABOUT_EXTRA_IMAGES];
  const bannerFallback = (key: BannerKey) =>
    key === "about.images" ? aboutCarouselFallback : (BANNER_PAGES.find((p) => p.key === key)?.fallback ?? []);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingTour, setUploadingTour] = useState(false);
  const [uploadingAbout, setUploadingAbout] = useState(false);
  const [uploadingSeo, setUploadingSeo] = useState(false);
  const fileInputAboutRef = useRef<HTMLInputElement>(null);
  const fileInputSeoRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    file: File,
    targetField: EditableKey,
    setUploading: (loading: boolean) => void,
  ) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("kind", "CONTENT");
      formData.append("files", file);
      const uploaded = await api.gallery.upload(formData);
      if (uploaded && uploaded[0]?.url) {
        setField(targetField, uploaded[0].url);
        toast.success(file.type.startsWith("video/") ? "Video uploaded successfully" : "Media uploaded successfully");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

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
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <div className="space-y-4 lg:col-span-7">
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
                              <MediaPickerField
                                label="Background video / media"
                                hint="Pick from media library, upload from device, or enter path (e.g. /LANDSCAPE.mp4)."
                                value={draft["hero.videoUrl"]}
                                onChange={(val) => setField("hero.videoUrl", val)}
                                onBrowseLibrary={() => setAssetPickerField("hero.videoUrl")}
                                onUploadFile={(file) => void handleFileUpload(file, "hero.videoUrl", setUploadingHero)}
                                uploading={uploadingHero}
                                accept="video/mp4,video/webm,video/*,image/*"
                                placeholder="/LANDSCAPE.mp4"
                              />
                            </div>
                            <div className="lg:col-span-5 space-y-2">
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video Preview</label>
                              <VideoPreview url={draft["hero.videoUrl"]} label="Hero video" />
                            </div>
                          </div>
                        ) : null}

                        {section.id === "tour" ? (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <div className="space-y-4 lg:col-span-7">
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
                              <MediaPickerField
                                label="Studio tour video clip"
                                hint="Pick from media library, upload from device, or enter path (e.g. /tour.mp4)."
                                value={draft["tour.videoUrl"]}
                                onChange={(val) => setField("tour.videoUrl", val)}
                                onBrowseLibrary={() => setAssetPickerField("tour.videoUrl")}
                                onUploadFile={(file) => void handleFileUpload(file, "tour.videoUrl", setUploadingTour)}
                                uploading={uploadingTour}
                                accept="video/mp4,video/webm,video/*,image/*"
                                placeholder="/tour.mp4"
                              />
                            </div>
                            <div className="lg:col-span-5 space-y-2">
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video Preview</label>
                              <VideoPreview url={draft["tour.videoUrl"]} label="Tour video" />
                            </div>
                          </div>
                        ) : null}

                        {section.id === "cta" ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            <div className="space-y-4">
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
                                    rows={4}
                                    value={draft["cta.body"]}
                                    onChange={(e) => setField("cta.body", e.target.value)}
                                  />
                                )}
                              </FormField>
                            </div>
                            <div className="space-y-4">
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
                          </div>
                        ) : null}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : null}

          {!loading && tab === "banners" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Photos rotate in the hero banner of each page. Add, reorder, or remove photos, then click Save Changes.
              </p>
              {BANNER_PAGES.map((page) => (
                <BannerSlidesCard
                  key={page.key}
                  label={page.label}
                  path={page.path}
                  value={draft[page.key]}
                  fallback={page.fallback}
                  onChange={(next) => setField(page.key, next)}
                  onAdd={() => setBannerPickerKey(page.key)}
                />
              ))}
            </div>
          ) : null}

          {!loading && tab === "about" ? (
            <>
              <BannerSlidesCard
                label="Home About carousel"
                path="/ (About Us section)"
                value={draft["about.images"]}
                fallback={aboutCarouselFallback}
                onChange={(next) => setField("about.images", next)}
                onAdd={() => setBannerPickerKey("about.images")}
              />
              {!editingAbout ? (
                <Card className="overflow-hidden border-border/80 shadow-sm">
                  <CardHeader className="border-b border-border/60 bg-muted/10 p-admin-card-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">Home About strip</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Shown on the homepage About section.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAbout(true)}
                        className="gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Content
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm sm:p-admin-card">
                    <div className="grid gap-6 lg:grid-cols-12 items-start">
                      {/* Left column: Content details */}
                      <div className="space-y-4 lg:col-span-7">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Headline
                          </span>
                          <h3 className="font-display text-2xl font-normal text-foreground mt-1">
                            {draft["about.headline"] || site.about.headline}
                          </h3>
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Body Story
                          </span>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                            {draft["about.body"] || site.about.body}
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Call to Action
                          </span>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                {draft["about.ctaLabel"] || site.about.ctaLabel}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                links to <code className="text-[11px] text-foreground">{draft["about.ctaHref"] || site.about.ctaHref}</code>
                              </span>
                            </div>
                            <Button variant="ghost" size="icon-sm" asChild>
                              <Link to={draft["about.ctaHref"] || site.about.ctaHref} target="_blank" rel="noreferrer">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Right column: Image preview */}
                      <div className="space-y-2 lg:col-span-5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Image Preview
                        </span>
                        <div className="group relative overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm aspect-[4/3]">
                          <img
                            src={draft["about.imageUrl"] || site.about.imageUrl}
                            alt={draft["about.headline"] || "About section preview"}
                            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/media/about.jpg";
                            }}
                          />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Source: <span className="font-mono text-foreground">{draft["about.imageUrl"] || site.about.imageUrl}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-border shadow-md animate-in fade-in-0 duration-200">
                  <CardHeader className="border-b border-border bg-muted/20 p-admin-card-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">Edit Home About Strip</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Update the copy and image for the homepage about section.</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setField("about.headline", saved["about.headline"]);
                          setField("about.body", saved["about.body"]);
                          setField("about.imageUrl", saved["about.imageUrl"]);
                          setField("about.ctaLabel", saved["about.ctaLabel"]);
                          setField("about.ctaHref", saved["about.ctaHref"]);
                          setEditingAbout(false);
                        }}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm sm:p-admin-card">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void (async () => {
                          await save();
                          setEditingAbout(false);
                        })();
                      }}
                    >
                      <div className="grid gap-6 lg:grid-cols-12 items-start">
                        {/* Left Column: Form Fields */}
                        <div className="space-y-4 lg:col-span-7">
                          <FormField label="Headline" required>
                            {(c) => (
                              <Input
                                {...c}
                                value={draft["about.headline"]}
                                onChange={(e) => setField("about.headline", e.target.value)}
                                placeholder="e.g. Welcome"
                                required
                              />
                            )}
                          </FormField>
                          <FormField label="Body Story">
                            {(c) => (
                              <Textarea
                                {...c}
                                rows={4}
                                value={draft["about.body"]}
                                onChange={(e) => setField("about.body", e.target.value)}
                                placeholder="Tell visitors about your studio, rooms, lights, sets..."
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
                                  placeholder="e.g. Read More"
                                />
                              )}
                            </FormField>
                            <FormField label="CTA link">
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["about.ctaHref"]}
                                  onChange={(e) => setField("about.ctaHref", e.target.value)}
                                  placeholder="/about or https://..."
                                />
                              )}
                            </FormField>
                          </div>
                        </div>

                        {/* Right Column: Image File Picker & Live Preview */}
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <label className="text-sm font-semibold text-foreground">
                                About Image
                              </label>
                              <p className="text-[11px] text-muted-foreground">Main visual for the about section</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputAboutRef.current?.click()}
                                disabled={uploadingAbout}
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                <Upload className="h-3.5 w-3.5 text-primary" />
                                {uploadingAbout ? "Uploading…" : "Upload"}
                              </Button>
                              <input
                                ref={fileInputAboutRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleFileUpload(file, "about.imageUrl", setUploadingAbout);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setAssetPickerField("about.imageUrl")}
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                                Library
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="overflow-hidden rounded-lg border border-border bg-muted/40 aspect-[4/3]">
                              <img
                                src={draft["about.imageUrl"] || site.about.imageUrl}
                                alt="About preview"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "/media/about.jpg";
                                }}
                              />
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              Asset: <span className="font-mono text-foreground">{draft["about.imageUrl"] || site.about.imageUrl}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setField("about.headline", saved["about.headline"]);
                            setField("about.body", saved["about.body"]);
                            setField("about.imageUrl", saved["about.imageUrl"]);
                            setField("about.ctaLabel", saved["about.ctaLabel"]);
                            setField("about.ctaHref", saved["about.ctaHref"]);
                            setEditingAbout(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" loading={saving}>
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
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
            <>
              {!editingContact ? (
                <Card className="overflow-hidden border-border/80 shadow-sm">
                  <CardHeader className="border-b border-border/60 bg-muted/10 p-admin-card-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">Contact &amp; hours</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Studio location, business hours, reach-out channels, and social links.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingContact(true)}
                        className="gap-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Content
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm sm:p-admin-card">
                    <div className="grid gap-6 lg:grid-cols-12 items-start">
                      {/* Left column: Studio Details, Contact Info, Hours, Socials */}
                      <div className="space-y-4 lg:col-span-7">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Studio
                          </span>
                          <h3 className="text-xl font-medium tracking-tight text-foreground">
                            {draft["site.name"] || site.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {draft["site.tagline"] || site.tagline}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-muted-foreground">Studio Address</span>
                              <p className="text-sm text-foreground">{draft["site.address"] || site.address.full}</p>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-muted-foreground">Phone</span>
                                <p className="truncate text-sm font-medium text-foreground">
                                  {draft["site.phone"] || site.phone}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-muted-foreground">Email</span>
                                <p className="truncate text-sm font-medium text-foreground">
                                  {draft["site.email"] || site.email}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-muted-foreground">WhatsApp Link</span>
                                <p className="truncate text-xs font-mono text-foreground">
                                  {draft["site.whatsapp"] || site.whatsapp}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0 space-y-0.5">
                                <span className="text-xs font-medium text-muted-foreground">Operating Hours</span>
                                <p className="text-xs text-foreground">
                                  <span className="text-muted-foreground">Mon–Sat:</span>{" "}
                                  {draft["site.hours.weekday"] || site.hoursWeekday}
                                </p>
                                <p className="text-xs text-foreground">
                                  <span className="text-muted-foreground">Sunday:</span>{" "}
                                  {draft["site.hours.sunday"] || site.hoursSunday}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Social Channels
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {draft["social.instagram"] ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
                                  <span className="font-medium text-foreground">Instagram:</span>
                                  <a
                                    href={draft["social.instagram"]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-0.5 text-primary hover:underline"
                                  >
                                    {draft["social.instagram"].replace(/^https?:\/\/(www\.)?instagram\.com\/?/, "@")}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </span>
                              ) : null}
                              {draft["social.facebook"] ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
                                  <span className="font-medium text-foreground">Facebook:</span>
                                  <a
                                    href={draft["social.facebook"]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-0.5 text-primary hover:underline"
                                  >
                                    Page link <ExternalLink className="h-3 w-3" />
                                  </a>
                                </span>
                              ) : null}
                              {draft["social.tiktok"] ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
                                  <span className="font-medium text-foreground">TikTok:</span>
                                  <a
                                    href={draft["social.tiktok"]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-0.5 text-primary hover:underline"
                                  >
                                    {draft["social.tiktok"].replace(/^https?:\/\/(www\.)?tiktok\.com\/?/, "")}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right column: Interactive Map Preview */}
                      <div className="space-y-2 lg:col-span-5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Location &amp; Map Preview
                        </span>
                        <div className="group relative overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm aspect-[4/3] min-h-[220px]">
                          {draft["site.mapEmbed"] || site.mapEmbed ? (
                            <iframe
                              title="Studio location map preview"
                              src={draft["site.mapEmbed"] || site.mapEmbed}
                              className="h-full w-full border-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                              No map embed URL configured.
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                          <span className="truncate font-mono text-[11px]">
                            {draft["site.mapEmbed"] || site.mapEmbed}
                          </span>
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                [draft["site.name"] || site.name, draft["site.address"] || site.address.full]
                                  .filter(Boolean)
                                  .join(", "),
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open Google Maps"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-border shadow-md animate-in fade-in-0 duration-200">
                  <CardHeader className="border-b border-border bg-muted/20 p-admin-card-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">Edit Contact &amp; Hours</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Update studio info, operating hours, map link, and social channels.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setField("site.name", saved["site.name"]);
                          setField("site.phone", saved["site.phone"]);
                          setField("site.tagline", saved["site.tagline"]);
                          setField("site.email", saved["site.email"]);
                          setField("site.whatsapp", saved["site.whatsapp"]);
                          setField("site.address", saved["site.address"]);
                          setField("site.hours.weekday", saved["site.hours.weekday"]);
                          setField("site.hours.sunday", saved["site.hours.sunday"]);
                          setField("site.mapEmbed", saved["site.mapEmbed"]);
                          setField("social.instagram", saved["social.instagram"]);
                          setField("social.facebook", saved["social.facebook"]);
                          setField("social.tiktok", saved["social.tiktok"]);
                          setEditingContact(false);
                        }}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm sm:p-admin-card">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void (async () => {
                          await save();
                          setEditingContact(false);
                        })();
                      }}
                    >
                      <div className="grid gap-6 lg:grid-cols-12 items-start">
                        {/* Left Column: Contact Form Fields */}
                        <div className="space-y-4 lg:col-span-7">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Studio name" required>
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["site.name"]}
                                  onChange={(e) => setField("site.name", e.target.value)}
                                  required
                                />
                              )}
                            </FormField>
                            <FormField label="Phone" required>
                              {(c) => (
                                <Input
                                  {...c}
                                  value={draft["site.phone"]}
                                  onChange={(e) => setField("site.phone", e.target.value)}
                                  required
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
                            <FormField label="Email" required>
                              {(c) => (
                                <Input
                                  {...c}
                                  type="email"
                                  value={draft["site.email"]}
                                  onChange={(e) => setField("site.email", e.target.value)}
                                  required
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
                          <FormField label="Address" required>
                            {(c) => (
                              <Textarea
                                {...c}
                                rows={2}
                                value={draft["site.address"]}
                                onChange={(e) => setField("site.address", e.target.value)}
                                required
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
                        </div>

                        {/* Right Column: Map Embed URL & Live Preview */}
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-5">
                          <label htmlFor="contact-map-embed" className="text-sm font-semibold">
                            Location Map Configuration
                          </label>
                          <FormField
                            label="Map embed URL"
                            hint="OpenStreetMap or Google Maps iframe embed URL"
                          >
                            {(c) => (
                              <Input
                                {...c}
                                id="contact-map-embed"
                                value={draft["site.mapEmbed"]}
                                onChange={(e) => setField("site.mapEmbed", e.target.value)}
                                placeholder="https://www.openstreetmap.org/export/embed.html?..."
                              />
                            )}
                          </FormField>
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-medium text-muted-foreground">Live Map Preview</span>
                            <div className="overflow-hidden rounded-lg border border-border bg-muted/40 aspect-[4/3] min-h-[180px]">
                              {draft["site.mapEmbed"] ? (
                                <iframe
                                  title="Live map preview"
                                  src={draft["site.mapEmbed"]}
                                  className="h-full w-full border-0"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                                  Enter a map embed URL to see the live preview.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setField("site.name", saved["site.name"]);
                            setField("site.phone", saved["site.phone"]);
                            setField("site.tagline", saved["site.tagline"]);
                            setField("site.email", saved["site.email"]);
                            setField("site.whatsapp", saved["site.whatsapp"]);
                            setField("site.address", saved["site.address"]);
                            setField("site.hours.weekday", saved["site.hours.weekday"]);
                            setField("site.hours.sunday", saved["site.hours.sunday"]);
                            setField("site.mapEmbed", saved["site.mapEmbed"]);
                            setField("social.instagram", saved["social.instagram"]);
                            setField("social.facebook", saved["social.facebook"]);
                            setField("social.tiktok", saved["social.tiktok"]);
                            setEditingContact(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" loading={saving}>
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}

          {!loading && tab === "seo" ? (
            <>
              {!editingSeo ? (
                <Card className="overflow-hidden border-border/80 shadow-sm">
                  <CardHeader className="border-b border-border/60 bg-muted/10 p-admin-card-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">Default SEO &amp; Meta</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Global search engine metadata and social sharing preview cards.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSeo(true)}
                        className="gap-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit SEO
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm sm:p-admin-card">
                    <div className="grid gap-6 lg:grid-cols-12 items-start">
                      {/* Left column: Meta information & Google Search Simulation */}
                      <div className="space-y-4 lg:col-span-7">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Page Title
                          </span>
                          <h3 className="text-lg font-medium text-foreground">
                            {draft["seo.defaultTitle"] || site.seo.defaultTitle}
                          </h3>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Meta Description
                          </span>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {draft["seo.defaultDescription"] || site.seo.defaultDescription}
                          </p>
                        </div>

                        <div className="space-y-1.5 pt-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Google Search Preview
                          </span>
                          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1 max-w-xl">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Globe className="h-3.5 w-3.5 text-primary" />
                              <span>photoarena.ng</span>
                              <span>›</span>
                              <span>home</span>
                            </div>
                            <h4 className="text-base font-medium text-primary hover:underline cursor-pointer">
                              {draft["seo.defaultTitle"] || site.seo.defaultTitle}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {draft["seo.defaultDescription"] || site.seo.defaultDescription}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right column: OG Social Image Preview */}
                      <div className="space-y-2 lg:col-span-5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Social Share Preview (OG Image)
                        </span>
                        <div className="group relative overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm aspect-[1200/630]">
                          <img
                            src={draft["seo.ogImage"] || site.seo.ogImage}
                            alt="SEO OpenGraph preview"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/media/hero.jpg";
                            }}
                          />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Source: <span className="font-mono text-foreground">{draft["seo.ogImage"] || site.seo.ogImage}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-border shadow-md animate-in fade-in-0 duration-200">
                  <CardHeader className="border-b border-border bg-muted/20 p-admin-card-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg font-normal">Edit Default SEO</CardTitle>
                          <ActiveBadge active />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Update global title, description, and social share image.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setField("seo.defaultTitle", saved["seo.defaultTitle"]);
                          setField("seo.defaultDescription", saved["seo.defaultDescription"]);
                          setField("seo.ogImage", saved["seo.ogImage"]);
                          setEditingSeo(false);
                        }}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm sm:p-admin-card">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void (async () => {
                          await save();
                          setEditingSeo(false);
                        })();
                      }}
                    >
                      <div className="grid gap-6 lg:grid-cols-12 items-start">
                        {/* Left Column: Title & Description */}
                        <div className="space-y-4 lg:col-span-7">
                          <FormField label="Default title" required>
                            {(c) => (
                              <Input
                                {...c}
                                value={draft["seo.defaultTitle"]}
                                onChange={(e) => setField("seo.defaultTitle", e.target.value)}
                                placeholder="Photo Arena — Photography Studio in Port Harcourt"
                                required
                              />
                            )}
                          </FormField>
                          <FormField label="Default description" required>
                            {(c) => (
                              <Textarea
                                {...c}
                                rows={4}
                                value={draft["seo.defaultDescription"]}
                                onChange={(e) => setField("seo.defaultDescription", e.target.value)}
                                placeholder="Port Harcourt's premier walk-in portrait and creative studio..."
                                required
                              />
                            )}
                          </FormField>
                        </div>

                        {/* Right Column: OG Image with file picker & preview */}
                        {/* Right Column: OG Image with file picker & preview */}
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <label className="text-sm font-semibold text-foreground">
                                OG Social Image
                              </label>
                              <p className="text-[11px] text-muted-foreground">Social sharing preview card asset</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputSeoRef.current?.click()}
                                disabled={uploadingSeo}
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                <Upload className="h-3.5 w-3.5 text-primary" />
                                {uploadingSeo ? "Uploading…" : "Upload"}
                              </Button>
                              <input
                                ref={fileInputSeoRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleFileUpload(file, "seo.ogImage", setUploadingSeo);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setAssetPickerField("seo.ogImage")}
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                                Library
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="overflow-hidden rounded-lg border border-border bg-muted/40 aspect-[1200/630]">
                              <img
                                src={draft["seo.ogImage"] || site.seo.ogImage}
                                alt="SEO preview"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "/media/hero.jpg";
                                }}
                              />
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              Asset: <span className="font-mono text-foreground">{draft["seo.ogImage"] || site.seo.ogImage}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setField("seo.defaultTitle", saved["seo.defaultTitle"]);
                            setField("seo.defaultDescription", saved["seo.defaultDescription"]);
                            setField("seo.ogImage", saved["seo.ogImage"]);
                            setEditingSeo(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" loading={saving}>
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
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

      <BlogAssetPickerModal
        open={assetPickerField !== null}
        onOpenChange={(open) => !open && setAssetPickerField(null)}
        onSelect={(url) => {
          if (assetPickerField) setField(assetPickerField, url);
        }}
        title="Select Media Asset"
        currentUrl={assetPickerField ? draft[assetPickerField] : ""}
      />

      <BlogAssetPickerModal
        open={bannerPickerKey !== null}
        onOpenChange={(open) => !open && setBannerPickerKey(null)}
        onSelect={(url) => {
          if (!bannerPickerKey) return;
          const current = parseSlideUrls(draft[bannerPickerKey]);
          const base = current.length ? current : bannerFallback(bannerPickerKey);
          if (!base.includes(url)) setField(bannerPickerKey, JSON.stringify([...base, url]));
        }}
        title="Add banner photo"
        description="Choose a photo from the media library or upload a new one."
      />
    </div>
  );
}

function BannerSlidesCard({
  label,
  path,
  value,
  fallback,
  onChange,
  onAdd,
}: {
  label: string;
  path: string;
  value: string;
  fallback: string[];
  onChange: (next: string) => void;
  onAdd: () => void;
}) {
  const custom = parseSlideUrls(value);
  const urls = custom.length ? custom : fallback;
  const commit = (next: string[]) => onChange(next.length ? JSON.stringify(next) : "");
  const move = (from: number, to: number) => {
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  return (
    <Card>
      <CardHeader className="p-admin-card-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="font-display text-lg font-normal">{label}</CardTitle>
              {custom.length ? null : <Badge variant="secondary">Default photos</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hero slideshow on <code className="text-foreground">{path}</code>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {custom.length ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange("")}>
                Reset to default
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onAdd}>
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Add photo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-admin-card-sm pt-0">
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {urls.map((url, i) => (
            <li key={url} className="overflow-hidden rounded-lg border border-border bg-muted/30">
              <img src={url} alt={`${label} banner photo ${i + 1}`} className="aspect-[16/10] w-full object-cover" />
              <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">#{i + 1}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move photo ${i + 1} earlier`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move photo ${i + 1} later`}
                    disabled={i === urls.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove photo ${i + 1}`}
                    className="hover:text-destructive"
                    onClick={() => commit(urls.filter((_, j) => j !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function MediaPickerField({
  label,
  hint,
  value,
  onChange,
  onBrowseLibrary,
  onUploadFile,
  uploading,
  accept = "image/*,video/*",
  placeholder = "Select or enter file path…",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  onBrowseLibrary: () => void;
  onUploadFile: (file: File) => void;
  uploading?: boolean;
  accept?: string;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingDirectUrl, setEditingDirectUrl] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <button
          type="button"
          onClick={() => setEditingDirectUrl(!editingDirectUrl)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {editingDirectUrl ? "Hide manual URL" : "Edit manual path / URL"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBrowseLibrary}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          Browse Library
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <Upload className="h-3.5 w-3.5 text-primary" />
          {uploading ? "Uploading…" : "Upload from device"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = "";
          }}
        />

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-xs">
        <span className="text-muted-foreground shrink-0 font-medium">Selected:</span>
        {value ? (
          <span className="font-mono text-foreground truncate max-w-full">{value}</span>
        ) : (
          <span className="italic text-muted-foreground">No media selected yet</span>
        )}
      </div>

      {editingDirectUrl ? (
        <div className="pt-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-8 text-xs font-mono"
          />
        </div>
      ) : null}

      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [url]);

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

  const isLocalPath = /^(?:\/home\/|[a-zA-Z]:[\\\/]|\/Users\/|\/tmp\/)/i.test(url.trim());
  if (isLocalPath) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center text-xs text-amber-500">
        <AlertTriangle className="mb-2 h-6 w-6 text-amber-500" />
        <p className="font-semibold text-foreground">Local file path detected</p>
        <p className="mt-1 text-muted-foreground text-[11px] max-w-xs">
          Browsers cannot stream files from your local disk path (<code className="text-foreground">{url}</code>). Please click <strong>Upload from device</strong> to upload the video file to the server.
        </p>
      </div>
    );
  }

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      void videoRef.current.play().catch(() => {});
    }
  }, [url]);

  if (loadError) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-xs text-destructive">
        <Video className="mb-2 h-6 w-6 opacity-70" />
        <p className="font-semibold text-foreground">Unable to load video</p>
        <p className="mt-1 text-muted-foreground text-[11px] max-w-xs">
          Could not stream <code className="text-foreground">{url}</code>. Check that the file exists or try uploading it.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black/40 shadow-inner">
      <video
        key={url}
        ref={videoRef}
        className="aspect-video w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        controls
        aria-label={label}
        onError={() => setLoadError(true)}
      >
        <source src={url} />
      </video>
    </div>
  );
}
