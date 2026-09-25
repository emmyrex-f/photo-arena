import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Layers,
  PenTool,
  Save,
  Search,
  Share2,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import { TagsInput } from "../../admin/components/ui/tags-input";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { BlogAssetPickerModal } from "../../admin/components/BlogAssetPickerModal";
import { useAdminApi } from "../../admin/lib/adminApi";
import { slugify } from "../../admin/lib/format";
import { useAdminTheme } from "../../admin/lib/theme";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/publicApi";

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  tags: string[];
  isPublished: boolean;
};

const EMPTY: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  metaTitle: "",
  metaDescription: "",
  ogImageUrl: "",
  tags: [],
  isPublished: false,
};

type SeoPreviewTab = "google" | "social";

export function AdminBlogEditorPage() {
  const api = useAdminApi();
  const { resolved: themeMode } = useAdminTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Asset picker target: 'cover' | 'og' | 'content' | null
  const [assetPickerTarget, setAssetPickerTarget] = useState<"cover" | "og" | "content" | null>(null);

  // SEO Accordion & Preview Mode
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoTab, setSeoTab] = useState<SeoPreviewTab>("google");

  const load = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    setError(null);
    try {
      const post = await api.blog.get(id);
      setForm({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        coverImageUrl: post.coverImageUrl ?? "",
        metaTitle: post.metaTitle ?? "",
        metaDescription: post.metaDescription ?? "",
        ogImageUrl: post.ogImageUrl ?? "",
        tags: post.tags ?? [],
        isPublished: post.isPublished,
      });
      setSlugTouched(true);
      if (post.metaTitle || post.metaDescription || post.ogImageUrl) {
        setSeoOpen(true);
      }
    } catch (err) {
      setError(errorMessage(err, "Could not load post"));
    } finally {
      setLoading(false);
    }
  }, [api, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  // Custom toolbar command to open Media Library image picker
  const mediaLibraryCommand: commands.ICommand = useMemo(
    () => ({
      name: "media-library",
      keyCommand: "media-library",
      buttonProps: {
        "aria-label": "Insert image from Media Library",
        title: "Insert image from Media Library",
      },
      icon: (
        <span className="flex items-center gap-1 text-[11px] font-medium px-1 text-primary">
          <ImageIcon className="h-3 w-3" />
          <span>Media</span>
        </span>
      ),
      execute: () => {
        setAssetPickerTarget("content");
      },
    }),
    [],
  );

  // Handle asset picker selection
  function handleAssetSelected(url: string) {
    if (assetPickerTarget === "cover") {
      setForm((prev) => ({ ...prev, coverImageUrl: url }));
      toast.success("Cover image updated");
    } else if (assetPickerTarget === "og") {
      setForm((prev) => ({ ...prev, ogImageUrl: url }));
      toast.success("Social preview image updated");
    } else if (assetPickerTarget === "content") {
      const imageMarkdown = `\n![Photo Arena Media](${url})\n`;
      setForm((prev) => ({
        ...prev,
        content: prev.content ? `${prev.content}\n${imageMarkdown}` : imageMarkdown,
      }));
      toast.success("Image inserted into editor");
    }
    setAssetPickerTarget(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    const excerpt = form.excerpt.trim();
    const content = form.content.trim();
    if (!title || !excerpt || !content) {
      toast.error("Title, excerpt, and content are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        slug: form.slug.trim() || undefined,
        excerpt,
        content,
        coverImageUrl: form.coverImageUrl.trim() || null,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        ogImageUrl: form.ogImageUrl.trim() || null,
        tags: form.tags,
        isPublished: form.isPublished,
      };

      if (isNew) {
        const created = await api.blog.create(payload);
        toast.success(form.isPublished ? "Post published" : "Draft saved");
        navigate(`/admin/blog/${created.id}`, { replace: true });
      } else if (id) {
        await api.blog.update(id, {
          ...payload,
          slug: form.slug.trim() || slugify(title),
        });
        toast.success("Post updated");
        await load();
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not save post"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id || isNew) return;
    if (!window.confirm(`Delete “${form.title || "this post"}”?`)) return;
    setSaving(true);
    try {
      await api.blog.remove(id);
      toast.success("Post deleted");
      navigate("/admin/blog");
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete post"));
      setSaving(false);
    }
  }

  // Word count & reading time stats
  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // Resolved SEO values for previews
  const resolvedSeoTitle = form.metaTitle.trim() || form.title.trim() || "Untitled Post";
  const resolvedSeoDesc =
    form.metaDescription.trim() ||
    form.excerpt.trim() ||
    "Add a post excerpt or custom meta description to preview how this appears in search results.";
  const resolvedOgImage = form.ogImageUrl.trim() || form.coverImageUrl.trim();
  const postSlugPreview = form.slug.trim() || slugify(form.title) || "post-url";

  return (
    <div className="pa-blog-editor max-w-7xl mx-auto space-y-4">
      {/* COMPACT TOP NAVIGATION BAR */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link to="/admin/blog">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="text-xs">Blog</span>
            </Link>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl sm:text-2xl font-normal tracking-tight text-foreground">
              {isNew ? "New post" : "Edit post"}
            </h1>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                form.isPublished
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {form.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && form.isPublished && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs hidden md:flex"
              asChild
            >
              <a href={`/blog/${form.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View Live
              </a>
            </Button>
          )}
          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onDelete()}
              disabled={saving}
              className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2.5"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link to="/admin/blog">Cancel</Link>
          </Button>
          <Button
            type="submit"
            form="blog-post-form"
            size="sm"
            loading={saving}
            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3.5"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {form.isPublished ? "Save & Publish" : "Save Draft"}
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="lg:col-span-4 space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : (
        <form
          id="blog-post-form"
          className="grid gap-4 lg:grid-cols-12 items-start"
          onSubmit={(event) => void onSubmit(event)}
        >
          {/* ========================================================================= */}
          {/* LEFT / CENTER COLUMN: ESSENTIALS + WYSIWYG EDITOR + SEO (8 of 12 cols)  */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 space-y-4">
            {/* POST TITLE & EXCERPT CARD */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="blog-title" className="text-xs font-semibold text-foreground">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {form.title.length} chars
                  </span>
                </div>
                <Input
                  id="blog-title"
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      title,
                      slug: slugTouched ? prev.slug : slugify(title),
                    }));
                  }}
                  placeholder="e.g. 5 Tips for a Flawless Pre-Wedding Studio Shoot"
                  className="text-base font-medium h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="blog-excerpt" className="text-xs font-semibold text-foreground">
                    Excerpt / Lead Summary <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {form.excerpt.length} chars
                  </span>
                </div>
                <Textarea
                  id="blog-excerpt"
                  value={form.excerpt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, excerpt: event.target.value }))
                  }
                  rows={2}
                  placeholder="A concise synopsis shown on the journal grid and social shares."
                  className="text-xs leading-relaxed resize-none"
                  required
                />
              </div>
            </div>

            {/* WYSIWYG MARKDOWN LIVE PREVIEW EDITOR */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5 text-primary" />
                  <Label htmlFor="blog-content" className="text-xs font-semibold text-foreground">
                    Article Content (WYSIWYG Markdown) <span className="text-destructive">*</span>
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssetPickerTarget("content")}
                  className="h-7 text-[11px] px-2 text-primary"
                >
                  <ImageIcon className="h-3 w-3 mr-1" />
                  Insert Image
                </Button>
              </div>

              <div
                data-color-mode={themeMode}
                className="rounded-lg overflow-hidden border border-border shadow-inner"
              >
                <MDEditor
                  value={form.content}
                  onChange={(val) => setForm((prev) => ({ ...prev, content: val || "" }))}
                  height={440}
                  preview="live"
                  commands={[
                    commands.bold,
                    commands.italic,
                    commands.strikethrough,
                    commands.hr,
                    commands.group(
                      [
                        commands.title1,
                        commands.title2,
                        commands.title3,
                        commands.title4,
                        commands.title5,
                        commands.title6,
                      ],
                      {
                        name: "title",
                        groupName: "title",
                        buttonProps: { "aria-label": "Insert title", title: "Insert title" },
                      },
                    ),
                    commands.divider,
                    commands.link,
                    commands.quote,
                    commands.code,
                    commands.codeBlock,
                    mediaLibraryCommand,
                    commands.table,
                    commands.divider,
                    commands.unorderedListCommand,
                    commands.orderedListCommand,
                    commands.checkedListCommand,
                  ]}
                  extraCommands={[
                    commands.codeEdit,
                    commands.codeLive,
                    commands.codePreview,
                    commands.fullscreen,
                  ]}
                />
              </div>

              {/* COMPACT EDITOR FOOTER */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
                <div className="flex items-center gap-2">
                  <span><strong>{wordCount}</strong> words</span>
                  <span>•</span>
                  <span><strong>{form.content.length}</strong> chars</span>
                  <span>•</span>
                  <span>~{readMinutes} min read</span>
                </div>
                <span className="hidden sm:inline text-muted-foreground/70">
                  Split live preview enabled
                </span>
              </div>
            </div>

            {/* C4: SEO & SOCIAL SHARING SECTION */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setSeoOpen(!seoOpen)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      SEO &amp; Social Share Metadata
                    </span>
                    {(form.metaTitle || form.metaDescription || form.ogImageUrl) && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </div>
                </div>
                {seoOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {seoOpen && (
                <div className="border-t border-border p-3.5 sm:p-4 space-y-4 bg-muted/5">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* SEO INPUTS */}
                    <div className="space-y-3">
                      {/* Meta Title */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="meta-title" className="text-[11px] font-medium">
                            Custom Meta Title
                          </Label>
                          <span
                            className={cn(
                              "text-[10px]",
                              form.metaTitle.length > 60
                                ? "text-amber-500 font-medium"
                                : "text-muted-foreground",
                            )}
                          >
                            {form.metaTitle.length} / 60
                          </span>
                        </div>
                        <Input
                          id="meta-title"
                          value={form.metaTitle}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, metaTitle: e.target.value }))
                          }
                          placeholder={form.title || "Defaults to article title"}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Meta Description */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="meta-desc" className="text-[11px] font-medium">
                            Custom Meta Description
                          </Label>
                          <span
                            className={cn(
                              "text-[10px]",
                              form.metaDescription.length > 160
                                ? "text-amber-500 font-medium"
                                : "text-muted-foreground",
                            )}
                          >
                            {form.metaDescription.length} / 160
                          </span>
                        </div>
                        <Textarea
                          id="meta-desc"
                          value={form.metaDescription}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, metaDescription: e.target.value }))
                          }
                          rows={2}
                          placeholder={form.excerpt || "Defaults to article excerpt"}
                          className="text-xs resize-none"
                        />
                      </div>

                      {/* OpenGraph Image */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium">
                          Social Share (OG) Image
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={form.ogImageUrl}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, ogImageUrl: e.target.value }))
                            }
                            placeholder={form.coverImageUrl || "Defaults to cover image"}
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAssetPickerTarget("og")}
                            className="h-8 text-xs shrink-0 px-2"
                          >
                            <Search className="h-3 w-3 mr-1" />
                            Pick
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* LIVE PREVIEW SIMULATOR */}
                    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-border pb-1.5">
                        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Share2 className="h-3 w-3 text-primary" />
                          Snippet Simulator
                        </span>
                        <div className="flex rounded border border-border bg-muted/40 p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setSeoTab("google")}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                              seoTab === "google"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Google
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeoTab("social")}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                              seoTab === "social"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Social Card
                          </button>
                        </div>
                      </div>

                      {seoTab === "google" ? (
                        <div className="space-y-1 rounded border border-border/80 bg-white p-2.5 text-left text-neutral-900 shadow-sm dark:bg-[#202124] dark:text-[#bdc1c6]">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-[9px] font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              PA
                            </div>
                            <span className="text-neutral-500 dark:text-neutral-400 font-mono text-[9px] truncate">
                              photoarena.ng › blog › {postSlugPreview}
                            </span>
                          </div>
                          <h3 className="text-xs font-medium text-[#1a0dab] hover:underline cursor-pointer dark:text-[#8ab4f8] line-clamp-1">
                            {resolvedSeoTitle}
                          </h3>
                          <p className="text-[11px] text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 leading-tight">
                            {resolvedSeoDesc}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded border border-border/80 bg-card shadow-sm text-left">
                          <div className="relative aspect-[1.91/1] w-full bg-muted/40 overflow-hidden flex items-center justify-center">
                            {resolvedOgImage ? (
                              <img
                                src={mediaUrl(resolvedOgImage)}
                                alt="Social preview"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-6 w-6 mb-0.5 opacity-40" />
                                <span className="text-[10px]">No image selected</span>
                              </div>
                            )}
                          </div>
                          <div className="p-2 space-y-0.5 bg-muted/20">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                              photoarena.ng
                            </p>
                            <h4 className="text-[11px] font-semibold text-foreground line-clamp-1">
                              {resolvedSeoTitle}
                            </h4>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                              {resolvedSeoDesc}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT SIDEBAR COLUMN: PUBLISH + COVER + PERMALINK + TAGS (4 of 12 cols)    */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 space-y-4">
            {/* SIDEBAR CARD 1: PUBLISH & STATUS */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Publishing Status
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    form.isPublished
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {form.isPublished ? "Live on site" : "Draft (hidden)"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground">Visible to Public</p>
                  <p className="text-[10px] text-muted-foreground">Indexable by search engines</p>
                </div>
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(isPublished) => setForm((prev) => ({ ...prev, isPublished }))}
                  aria-label="Publish status"
                />
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <Button
                  type="submit"
                  size="sm"
                  loading={saving}
                  className="w-full text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {form.isPublished ? "Save & Publish" : "Save as Draft"}
                </Button>
              </div>
            </div>

            {/* SIDEBAR CARD 2: FEATURED COVER IMAGE */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  Featured Cover
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAssetPickerTarget("cover")}
                  className="h-6 text-[11px] px-1.5 text-primary hover:text-primary"
                >
                  {form.coverImageUrl ? "Change" : "Browse"}
                </Button>
              </div>

              {form.coverImageUrl ? (
                <div className="relative group overflow-hidden rounded-lg border border-border bg-muted/20">
                  <div className="aspect-[16/9] w-full overflow-hidden bg-black/40 flex items-center justify-center">
                    <img
                      src={mediaUrl(form.coverImageUrl)}
                      alt="Cover preview"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-102"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-card/95 border-t border-border text-[10px]">
                    <span className="truncate max-w-[160px] font-mono text-muted-foreground">
                      {form.coverImageUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, coverImageUrl: "" }))}
                      className="text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setAssetPickerTarget("cover")}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary mb-1.5">
                    <Upload className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium text-foreground">Select cover image</p>
                  <p className="text-[10px] text-muted-foreground">Media library or upload</p>
                </div>
              )}
            </div>

            {/* SIDEBAR CARD 3: PERMALINK & TAGS */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              {/* URL SLUG */}
              <div className="space-y-1">
                <Label htmlFor="blog-slug" className="text-xs font-semibold text-foreground">
                  URL Slug
                </Label>
                <div className="flex items-center rounded-lg border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground h-8">
                  <span className="font-mono text-[11px] text-muted-foreground/75">/blog/</span>
                  <input
                    id="blog-slug"
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setForm((prev) => ({ ...prev, slug: event.target.value }));
                    }}
                    placeholder="post-slug"
                    className="flex-1 bg-transparent py-1 pl-1 font-mono text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* TAGS */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-xs font-semibold text-foreground">Tags</Label>
                </div>
                <TagsInput
                  value={form.tags}
                  onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* C3 ASSET PICKER MODAL */}
      <BlogAssetPickerModal
        open={assetPickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssetPickerTarget(null);
        }}
        onSelect={handleAssetSelected}
        title={
          assetPickerTarget === "cover"
            ? "Choose Article Cover Image"
            : assetPickerTarget === "og"
            ? "Choose Social Share (OpenGraph) Image"
            : "Insert Image into Article Content"
        }
        description={
          assetPickerTarget === "cover"
            ? "Select an image from the library or upload a high-resolution photo for the post header."
            : assetPickerTarget === "og"
            ? "Select a 1200×630 image optimized for social media share previews."
            : "Select an image to embed into your markdown article body."
        }
        currentUrl={
          assetPickerTarget === "cover"
            ? form.coverImageUrl
            : assetPickerTarget === "og"
            ? form.ogImageUrl
            : undefined
        }
      />
    </div>
  );
}
