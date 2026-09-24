import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import { TagsInput } from "../../admin/components/ui/tags-input";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { slugify } from "../../admin/lib/format";
import { errorMessage } from "../../lib/api";

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  tags: string[];
  isPublished: boolean;
};

const EMPTY: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  tags: [],
  isPublished: false,
};

export function AdminBlogEditorPage() {
  const api = useAdminApi();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        tags: post.tags ?? [],
        isPublished: post.isPublished,
      });
      setSlugTouched(true);
    } catch (err) {
      setError(errorMessage(err, "Could not load post"));
    } finally {
      setLoading(false);
    }
  }, [api, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (isNew) {
        const created = await api.blog.create({
          title,
          slug: form.slug.trim() || undefined,
          excerpt,
          content,
          coverImageUrl: form.coverImageUrl.trim() || null,
          tags: form.tags,
          isPublished: form.isPublished,
        });
        toast.success(form.isPublished ? "Post published" : "Draft saved");
        navigate(`/admin/blog/${created.id}`, { replace: true });
      } else if (id) {
        await api.blog.update(id, {
          title,
          slug: form.slug.trim() || slugify(title),
          excerpt,
          content,
          coverImageUrl: form.coverImageUrl.trim() || null,
          tags: form.tags,
          isPublished: form.isPublished,
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

  return (
    <div className="pa-blog-editor space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link to="/admin/blog">
              <ArrowLeft className="h-4 w-4" />
              Back to blog
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            {isNew ? "New post" : "Edit post"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drafts stay off the public blog until you publish.
          </p>
        </div>
        {!isNew ? (
          <Button type="button" variant="destructive" onClick={() => void onDelete()} disabled={saving}>
            <Trash2 strokeWidth={1.5} />
            Delete
          </Button>
        ) : null}
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <form className="mx-auto max-w-3xl space-y-admin-stack-sm" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="blog-title">Title</Label>
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
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-slug">Slug</Label>
            <Input
              id="blog-slug"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((prev) => ({ ...prev, slug: event.target.value }));
              }}
              placeholder="auto-from-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-excerpt">Excerpt</Label>
            <Textarea
              id="blog-excerpt"
              value={form.excerpt}
              onChange={(event) => setForm((prev) => ({ ...prev, excerpt: event.target.value }))}
              rows={3}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-content">Content</Label>
            <Textarea
              id="blog-content"
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              rows={14}
              required
              className="min-h-[20rem] font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-cover">Cover image URL</Label>
            <Input
              id="blog-cover"
              value={form.coverImageUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))}
              placeholder="/gallery/01-birthdays.jpg or /uploads/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagsInput value={form.tags} onChange={(tags) => setForm((prev) => ({ ...prev, tags }))} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm text-foreground">Published</p>
              <p className="text-xs text-muted-foreground">Visible on the public blog when on.</p>
            </div>
            <Switch
              checked={form.isPublished}
              onCheckedChange={(isPublished) => setForm((prev) => ({ ...prev, isPublished }))}
              aria-label="Published"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/blog">Cancel</Link>
            </Button>
            <Button type="submit" loading={saving}>
              <Save strokeWidth={1.5} />
              Save
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
