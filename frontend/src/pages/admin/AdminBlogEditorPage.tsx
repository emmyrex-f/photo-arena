import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { ConfirmDialog } from "../../admin/components/ui/confirm-dialog";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { Switch } from "../../admin/components/ui/switch";
import { TagsInput } from "../../admin/components/ui/tags-input";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { slugify } from "../../admin/lib/format";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";

export function AdminBlogEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const api = useAdminApi();
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);

  const query = useQuery(() => api.blog.get(id!), [id], { enabled: !isNew && !!id });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setTitle(query.data.title);
    setSlug(query.data.slug);
    setExcerpt(query.data.excerpt);
    setContent(query.data.content);
    setCoverImageUrl(query.data.coverImageUrl ?? "");
    setTags(query.data.tags ?? []);
    setIsPublished(query.data.isPublished);
    setSlugTouched(true);
  }, [query.data]);

  if (!manage) {
    return <Navigate to="/admin/content" replace />;
  }

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", "BLOG");
      form.append("files", file);
      const images = await api.gallery.upload(form);
      const url = images[0]?.url;
      if (url) {
        setCoverImageUrl(url);
        toast.success("Cover uploaded");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        title,
        slug: slug || slugify(title),
        excerpt,
        content,
        coverImageUrl: coverImageUrl || null,
        tags,
        isPublished,
      };
      if (isNew) {
        const created = await api.blog.create(body);
        toast.success("Post created");
        navigate(`/admin/blog/${created.id}`, { replace: true });
      } else if (id) {
        await api.blog.update(id, body);
        toast.success("Post saved");
        await query.refetch();
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-admin">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/admin/content">
          <ArrowLeft />
          Back to content
        </Link>
      </Button>
      <PageHeader
        title={isNew ? "New blog post" : "Edit blog post"}
        actions={
          <div className="flex flex-wrap gap-2">
            {!isNew && id ? (
              <ConfirmDialog
                title="Delete post?"
                description="This cannot be undone."
                confirmLabel="Delete"
                destructive
                successMessage="Post deleted"
                onConfirm={async () => {
                  await api.blog.remove(id);
                  navigate("/admin/content");
                }}
                trigger={
                  <Button variant="destructive" size="sm">
                    <Trash2 />
                    Delete
                  </Button>
                }
              />
            ) : null}
            <Button onClick={() => void save()} loading={saving}>
              Save
            </Button>
          </div>
        }
      />

      {!isNew ? <ErrorBanner message={query.error} onRetry={() => void query.refetch()} /> : null}
      {!isNew && query.loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <FormField label="Title" required>
              {(c) => (
                <Input
                  id={c.id}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                />
              )}
            </FormField>
            <FormField label="Slug">
              {(c) => (
                <Input
                  id={c.id}
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
              )}
            </FormField>
            <FormField label="Excerpt" required>
              {(c) => <Textarea id={c.id} rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />}
            </FormField>
            <FormField label="Cover image">
              {(c) => (
                <div className="space-y-2">
                  <Input
                    id={c.id}
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="/uploads/blog/…"
                  />
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <label className="cursor-pointer">
                        <ImagePlus />
                        Upload cover
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadCover(file);
                          }}
                        />
                      </label>
                    </Button>
                    {uploading ? <span className="text-xs text-muted-foreground self-center">Uploading…</span> : null}
                  </div>
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="" className="max-h-40 rounded-md object-cover" />
                  ) : null}
                </div>
              )}
            </FormField>
            <FormField label="Tags">
              {() => <TagsInput value={tags} onChange={setTags} />}
            </FormField>
            <FormField label="Published" inline>
              {() => <Switch checked={isPublished} onCheckedChange={setIsPublished} />}
            </FormField>
            <FormField label="Markdown content" required>
              {(c) => (
                <Textarea
                  id={c.id}
                  rows={18}
                  className="font-mono text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <h1>{title || "Untitled"}</h1>
              {excerpt ? <p className="lead text-muted-foreground">{excerpt}</p> : null}
              <ReactMarkdown>{content || "*Nothing to preview yet.*"}</ReactMarkdown>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
