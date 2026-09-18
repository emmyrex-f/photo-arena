import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { ConfirmDialog } from "../../admin/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Switch } from "../../admin/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../admin/components/ui/tabs";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { ServiceMediaPicker, type SelectedServiceMedia } from "../../admin/components/ServiceMediaPicker";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosFullDate, formatRelative } from "../../admin/lib/format";
import type { Faq, SettingsMap, Testimonial } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";
import { hasDeskPermission } from "../../admin/lib/permissions";

const SITE_KEYS = [
  "site.name",
  "site.tagline",
  "site.phone",
  "site.email",
  "site.whatsapp",
  "site.address",
  "site.hours.weekday",
  "site.hours.sunday",
  "site.mapEmbed",
] as const;

const SOCIAL_KEYS = ["social.instagram", "social.facebook", "social.tiktok"] as const;
const HERO_KEYS = ["hero.headline", "hero.subheadline", "hero.videoUrl"] as const;
const TOUR_KEYS = ["tour.heading", "tour.body", "tour.videoUrl"] as const;
const SEO_KEYS = ["seo.defaultTitle", "seo.defaultDescription", "seo.ogImage"] as const;
const ANALYTICS_KEYS = ["analytics.ga4Id", "analytics.metaPixelId"] as const;
const POLICY_KEYS = [
  "policies.vatPercent",
  "policies.expressPercent",
  "policies.extraImageKobo",
  "policies.accompanyingMax",
  "policies.deliveryDays",
  "policies.rescheduleFeePercent",
  "policies.onlineDiscountPercent",
] as const;

type InstagramItem = { image: string; href: string };

export function AdminContentPage() {
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);
  const canContent = hasDeskPermission(user, "content");
  const canTestimonials = hasDeskPermission(user, "testimonials");
  const location = useLocation();
  const [tab, setTab] = useState(() =>
    !canContent || (location.pathname.includes("/testimonials") && canTestimonials)
      ? "testimonials"
      : "settings",
  );

  useEffect(() => {
    if (location.pathname.includes("/testimonials") && canTestimonials) {
      setTab("testimonials");
    } else if (/(?:^|\/)content\/?$/.test(location.pathname)) {
      setTab("settings");
    }
  }, [canTestimonials, location.pathname]);

  return (
    <div className="space-y-admin">
      <PageHeader title="Content" description="Site copy, social proof, FAQs, policies and blog." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          {canContent ? <TabsTrigger value="settings">Settings</TabsTrigger> : null}
          {canTestimonials ? <TabsTrigger value="testimonials">Testimonials</TabsTrigger> : null}
          {canContent ? <TabsTrigger value="faq">FAQ</TabsTrigger> : null}
          {canContent ? <TabsTrigger value="policies">Policies</TabsTrigger> : null}
          {canContent ? <TabsTrigger value="blog">Blog</TabsTrigger> : null}
        </TabsList>
        {canContent ? (
          <TabsContent value="settings">
            <SettingsTab manage={manage} />
          </TabsContent>
        ) : null}
        {canTestimonials ? (
          <TabsContent value="testimonials">
            <TestimonialsTab manage={manage} />
          </TabsContent>
        ) : null}
        {canContent ? (
          <TabsContent value="faq">
            <FaqsTab manage={manage} />
          </TabsContent>
        ) : null}
        {canContent ? (
          <TabsContent value="policies">
            <PoliciesTab manage={manage} />
          </TabsContent>
        ) : null}
        {canContent ? (
          <TabsContent value="blog">
            <BlogTab manage={manage} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function SettingsTab({ manage }: { manage: boolean }) {
  const api = useAdminApi();
  const query = useQuery(() => api.settings.get(), []);
  const [draft, setDraft] = useState<SettingsMap>({});
  const [instagram, setInstagram] = useState<InstagramItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setDraft({ ...query.data });
    try {
      const raw = query.data["instagram.items"];
      setInstagram(raw ? (JSON.parse(raw) as InstagramItem[]) : []);
    } catch {
      setInstagram([]);
    }
  }, [query.data]);

  function setKey(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save(keys: readonly string[], extra?: SettingsMap) {
    setSaving(true);
    try {
      const body: SettingsMap = { ...(extra ?? {}) };
      for (const key of keys) body[key] = draft[key] ?? "";
      await api.settings.put(body);
      toast.success("Settings saved");
      await query.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (query.loading) return <Skeleton className="h-64 w-full" />;
  if (query.error) {
    return <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />;
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Site"
        keys={SITE_KEYS}
        draft={draft}
        setKey={setKey}
        manage={manage}
        saving={saving}
        onSave={() => void save(SITE_KEYS)}
      />
      <SettingsCard
        title="Social"
        keys={SOCIAL_KEYS}
        draft={draft}
        setKey={setKey}
        manage={manage}
        saving={saving}
        onSave={() => void save(SOCIAL_KEYS)}
      />
      <SettingsCard
        title="Hero"
        keys={HERO_KEYS}
        draft={draft}
        setKey={setKey}
        manage={manage}
        saving={saving}
        onSave={() => void save(HERO_KEYS)}
      />
      <SettingsCard
        title="Studio tour"
        keys={TOUR_KEYS}
        draft={draft}
        setKey={setKey}
        manage={manage}
        saving={saving}
        onSave={() => void save(TOUR_KEYS)}
        multiline={["tour.body"]}
      />
      <SettingsCard
        title="SEO"
        keys={SEO_KEYS}
        draft={draft}
        setKey={setKey}
        manage={manage}
        saving={saving}
        onSave={() => void save(SEO_KEYS)}
        multiline={["seo.defaultDescription"]}
      />
      <SettingsCard
        title="Analytics"
        keys={ANALYTICS_KEYS}
        draft={draft}
        setKey={setKey}
        manage={manage}
        saving={saving}
        onSave={() => void save(ANALYTICS_KEYS)}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Instagram strip</CardTitle>
          {manage ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInstagram((items) => [...items, { image: "/gallery/01-birthdays.jpg", href: "" }])}
            >
              <Plus />
              Item
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {!instagram.length ? (
            <EmptyState compact title="No Instagram items" />
          ) : (
            instagram.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={item.image}
                  disabled={!manage}
                  placeholder="Image path"
                  onChange={(e) =>
                    setInstagram((rows) => rows.map((r, i) => (i === index ? { ...r, image: e.target.value } : r)))
                  }
                />
                <Input
                  value={item.href}
                  disabled={!manage}
                  placeholder="Instagram URL"
                  onChange={(e) =>
                    setInstagram((rows) => rows.map((r, i) => (i === index ? { ...r, href: e.target.value } : r)))
                  }
                />
                {manage ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setInstagram((rows) => rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
          {manage ? (
            <Button
              loading={saving}
              onClick={() => void save([], { "instagram.items": JSON.stringify(instagram) })}
            >
              Save Instagram items
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsCard({
  title,
  keys,
  draft,
  setKey,
  manage,
  saving,
  onSave,
  multiline = [],
}: {
  title: string;
  keys: readonly string[];
  draft: SettingsMap;
  setKey: (key: string, value: string) => void;
  manage: boolean;
  saving: boolean;
  onSave: () => void;
  multiline?: string[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {manage ? (
          <Button size="sm" loading={saving} onClick={onSave}>
            Save
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {keys.map((key) => (
          <FormField key={key} label={key} className={multiline.includes(key) ? "sm:col-span-2" : undefined}>
            {(c) =>
              multiline.includes(key) ? (
                <Textarea
                  id={c.id}
                  rows={3}
                  value={draft[key] ?? ""}
                  disabled={!manage}
                  onChange={(e) => setKey(key, e.target.value)}
                />
              ) : (
                <Input
                  id={c.id}
                  value={draft[key] ?? ""}
                  disabled={!manage}
                  onChange={(e) => setKey(key, e.target.value)}
                />
              )
            }
          </FormField>
        ))}
      </CardContent>
    </Card>
  );
}

function PoliciesTab({ manage }: { manage: boolean }) {
  const api = useAdminApi();
  const query = useQuery(() => api.settings.get(), []);
  const [draft, setDraft] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) setDraft({ ...query.data });
  }, [query.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Studio policies</CardTitle>
        {manage ? (
          <Button
            size="sm"
            loading={saving}
            onClick={() => {
              setSaving(true);
              const body: SettingsMap = {};
              for (const key of POLICY_KEYS) body[key] = draft[key] ?? "";
              void api.settings
                .put(body)
                .then(() => {
                  toast.success("Policies saved");
                  return query.refetch();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setSaving(false));
            }}
          >
            Save
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {query.loading ? (
          <Skeleton className="h-32 w-full sm:col-span-2" />
        ) : (
          POLICY_KEYS.map((key) => (
            <FormField key={key} label={key}>
              {(c) => (
                <Input
                  id={c.id}
                  value={draft[key] ?? ""}
                  disabled={!manage}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              )}
            </FormField>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TestimonialsTab({ manage }: { manage: boolean }) {
  const api = useAdminApi();
  const query = useQuery(() => api.testimonials.list(), []);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Testimonial | null>(null);

  function move(item: Testimonial, dir: -1 | 1) {
    const all = [...(query.data ?? [])];
    const idx = all.findIndex((t) => t.id === item.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= all.length) return;
    [all[idx], all[swap]] = [all[swap], all[idx]];
    void api.testimonials
      .reorder(all.map((t) => t.id))
      .then(() => {
        toast.success("Order saved");
        return query.refetch();
      })
      .catch((err) => toast.error(errorMessage(err)));
  }

  return (
    <div className="space-y-3">
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} />
      {manage ? (
        <Button
          size="sm"
          onClick={() => {
            setEdit(null);
            setOpen(true);
          }}
        >
          <Plus />
          Add testimonial
        </Button>
      ) : null}
      {query.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !query.data?.length ? (
        <EmptyState title="No testimonials" />
      ) : (
        query.data.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm italic">“{t.quote}”</p>
                <p className="mt-2 text-sm font-medium">
                  {t.name}
                  {t.role ? ` · ${t.role}` : ""}
                </p>
                <div className="mt-1 flex gap-2">
                  <ActiveBadge active={t.isPublished} />
                  {t.rating ? <span className="text-xs text-muted-foreground">{t.rating}/5</span> : null}
                </div>
              </div>
              {manage ? (
                <div className="flex flex-wrap gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => move(t, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => move(t, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEdit(t);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void api.testimonials
                        .update(t.id, { isPublished: !t.isPublished })
                        .then(() => {
                          toast.success(t.isPublished ? "Unpublished" : "Published");
                          return query.refetch();
                        })
                        .catch((err) => toast.error(errorMessage(err)));
                    }}
                  >
                    {t.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <ConfirmDialog
                    title="Delete testimonial?"
                    confirmLabel="Delete"
                    destructive
                    successMessage="Deleted"
                    onConfirm={async () => {
                      await api.testimonials.remove(t.id);
                      await query.refetch();
                    }}
                    trigger={
                      <Button size="icon-sm" variant="ghost">
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
      <TestimonialDialog
        open={open}
        initial={edit}
        onOpenChange={setOpen}
        onSaved={async () => {
          setOpen(false);
          await query.refetch();
        }}
      />
    </div>
  );
}

function TestimonialDialog({
  open,
  initial,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  initial: Testimonial | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [quote, setQuote] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState("5");
  const [isPublished, setIsPublished] = useState(false);
  const [media, setMedia] = useState<SelectedServiceMedia | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuote(initial?.quote ?? "");
    setName(initial?.name ?? "");
    setRole(initial?.role ?? "");
    setRating(String(initial?.rating ?? 5));
    setIsPublished(initial?.isPublished ?? false);
    setMedia(
      initial?.media
        ? {
            id: initial.media.id,
            url: initial.media.url,
            thumbUrl: initial.media.thumbUrl,
            alt: initial.media.alt,
          }
        : null,
    );
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit testimonial" : "New testimonial"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Quote" required>
            {(c) => <Textarea id={c.id} rows={4} value={quote} onChange={(e) => setQuote(e.target.value)} />}
          </FormField>
          <FormField label="Name" required>
            {(c) => <Input id={c.id} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Role">
            {(c) => <Input id={c.id} value={role} onChange={(e) => setRole(e.target.value)} />}
          </FormField>
          <FormField label="Rating">
            {(c) => (
              <Input id={c.id} type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
            )}
          </FormField>
          <FormField label="Published" inline>
            {() => <Switch checked={isPublished} onCheckedChange={setIsPublished} />}
          </FormField>
          <ServiceMediaPicker
            enabled={open}
            value={media}
            onChange={setMedia}
            previewAlt="Selected testimonial image"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              setPending(true);
              const body = {
                quote,
                name,
                role: role || null,
                rating: Number(rating) || null,
                isPublished,
                sortOrder: initial?.sortOrder ?? 0,
                mediaId: media?.id ?? null,
              };
              const req = initial
                ? api.testimonials.update(initial.id, body)
                : api.testimonials.create(body);
              void req
                .then(() => {
                  toast.success("Saved");
                  return onSaved();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FaqsTab({ manage }: { manage: boolean }) {
  const api = useAdminApi();
  const query = useQuery(() => api.faqs.list(), []);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Faq | null>(null);

  function move(item: Faq, dir: -1 | 1) {
    const all = [...(query.data ?? [])];
    const idx = all.findIndex((t) => t.id === item.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= all.length) return;
    [all[idx], all[swap]] = [all[swap], all[idx]];
    void api.faqs
      .reorder(all.map((t) => t.id))
      .then(() => {
        toast.success("Order saved");
        return query.refetch();
      })
      .catch((err) => toast.error(errorMessage(err)));
  }

  return (
    <div className="space-y-3">
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} />
      {manage ? (
        <Button
          size="sm"
          onClick={() => {
            setEdit(null);
            setOpen(true);
          }}
        >
          <Plus />
          Add FAQ
        </Button>
      ) : null}
      {query.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !query.data?.length ? (
        <EmptyState title="No FAQs" />
      ) : (
        query.data.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-between">
              <div>
                <p className="font-medium">{f.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
                <ActiveBadge active={f.isActive} className="mt-2" />
              </div>
              {manage ? (
                <div className="flex flex-wrap gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => move(f, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => move(f, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEdit(f);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <ConfirmDialog
                    title="Delete FAQ?"
                    confirmLabel="Delete"
                    destructive
                    successMessage="Deleted"
                    onConfirm={async () => {
                      await api.faqs.remove(f.id);
                      await query.refetch();
                    }}
                    trigger={
                      <Button size="icon-sm" variant="ghost">
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
      <FaqDialog
        open={open}
        initial={edit}
        onOpenChange={setOpen}
        onSaved={async () => {
          setOpen(false);
          await query.refetch();
        }}
      />
    </div>
  );
}

function FaqDialog({
  open,
  initial,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  initial: Faq | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuestion(initial?.question ?? "");
    setAnswer(initial?.answer ?? "");
    setIsActive(initial?.isActive ?? true);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit FAQ" : "New FAQ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Question" required>
            {(c) => <Input id={c.id} value={question} onChange={(e) => setQuestion(e.target.value)} />}
          </FormField>
          <FormField label="Answer" required>
            {(c) => <Textarea id={c.id} rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} />}
          </FormField>
          <FormField label="Active" inline>
            {() => <Switch checked={isActive} onCheckedChange={setIsActive} />}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              setPending(true);
              const body = { question, answer, isActive, sortOrder: initial?.sortOrder ?? 0 };
              const req = initial ? api.faqs.update(initial.id, body) : api.faqs.create(body);
              void req
                .then(() => {
                  toast.success("Saved");
                  return onSaved();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlogTab({ manage }: { manage: boolean }) {
  const api = useAdminApi();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery(() => api.blog.list({ q: q.trim() || undefined, page, pageSize: 20 }), [q, page]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search posts…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="sm:max-w-xs"
        />
        {manage ? (
          <Button asChild size="sm">
            <Link to="/admin/blog/new">
              <Plus />
              New post
            </Link>
          </Button>
        ) : null}
      </div>
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} />
      {query.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !query.data?.items.length ? (
        <EmptyState title="No blog posts" />
      ) : (
        <div className="space-y-2">
          {query.data.items.map((post) => (
            <Link
              key={post.id}
              to={`/admin/blog/${post.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/30"
            >
              <div className="min-w-0">
                <p className="font-medium">{post.title}</p>
                <p className="truncate text-sm text-muted-foreground">{post.excerpt}</p>
                <p className="text-[11px] text-muted-foreground">
                  {post.isPublished
                    ? `Published ${formatLagosFullDate(post.publishedAt ?? post.createdAt)}`
                    : `Draft · ${formatRelative(post.updatedAt)}`}
                </p>
              </div>
              <ActiveBadge active={post.isPublished} />
            </Link>
          ))}
        </div>
      )}
      {query.data && query.data.total > query.data.pageSize ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * query.data.pageSize >= query.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
