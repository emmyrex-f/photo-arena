import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../admin/components/ui/dropdown-menu";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import { Switch } from "../../admin/components/ui/switch";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { mediaInUseFromError } from "../../admin/lib/media-usage";
import type { GalleryImage } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/publicApi";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const PAGE_SIZE = 24;
const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const SUGGESTED_CATEGORIES = ["birthdays", "portraits", "corporate", "kids", "general"] as const;

function isAllowedImage(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function usageTypeLabel(usageType: string): string {
  switch (usageType) {
    case "service":
      return "Service";
    case "portfolio":
      return "Portfolio";
    case "testimonial":
      return "Testimonial";
    case "blog":
      return "Blog";
    default:
      return usageType;
  }
}

/** Public site hides images under 64px on either edge. */
function isPublicSized(image: GalleryImage): boolean {
  if (image.width == null && image.height == null) return true;
  if (image.width != null && image.width < 64) return false;
  if (image.height != null && image.height < 64) return false;
  return true;
}

type EditForm = {
  alt: string;
  category: string;
  featured: boolean;
  isActive: boolean;
};

export function AdminPortfolioPage() {
  const api = useAdminApi();
  const fileRef = useRef<HTMLInputElement>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive" | "featured">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [uploadCategory, setUploadCategory] = useState("general");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, debouncedQ]);

  const listQuery = useQuery(
    () =>
      api.gallery.list({
        kind: "GALLERY",
        page,
        pageSize: PAGE_SIZE,
        ...(statusFilter === "active" ? { isActive: true } : {}),
        ...(statusFilter === "inactive" ? { isActive: false } : {}),
        ...(statusFilter === "featured" ? { featured: true, isActive: true } : {}),
        ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
        ...(debouncedQ ? { q: debouncedQ } : {}),
      }),
    [statusFilter, categoryFilter, debouncedQ, page],
  );

  const pageData = listQuery.data;
  const images = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const counts = pageData?.counts ?? { active: 0, featured: 0, inactive: 0 };
  const pageCount = Math.max(1, Math.ceil(total / (pageData?.pageSize ?? PAGE_SIZE)));

  const categories = useMemo(() => {
    const set = new Set<string>(SUGGESTED_CATEGORIES);
    for (const image of images) {
      if (image.category?.trim()) set.add(image.category.trim().toLowerCase());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [images]);

  const orderedIds = useMemo(
    () => [...images].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id),
    [images],
  );

  const stats = useMemo(
    () => ({
      total,
      live: counts.active,
      featured: counts.featured,
      hidden: counts.inactive,
    }),
    [total, counts],
  );

  const openEdit = useCallback((image: GalleryImage) => {
    setEditing(image);
    setEditForm({
      alt: image.alt,
      category: image.category,
      featured: image.featured,
      isActive: image.isActive,
    });
  }, []);

  const closeEdit = useCallback(() => {
    setEditing(null);
    setEditForm(null);
    setEditSaving(false);
  }, []);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = [...fileList];
      if (!files.length) return;
      if (files.length > MAX_FILES) {
        toast.error(`Upload up to ${MAX_FILES} files at a time`);
        return;
      }
      for (const file of files) {
        if (!isAllowedImage(file)) {
          toast.error("Only JPEG, PNG, or WebP images are allowed");
          return;
        }
        if (file.size > MAX_BYTES) {
          toast.error("Each file must be 15 MB or smaller");
          return;
        }
      }

      const form = new FormData();
      form.append("kind", "GALLERY");
      form.append("category", uploadCategory.trim() || "general");
      for (const file of files) form.append("files", file);

      setProgress(0);
      try {
        const rows = await api.gallery.upload(form, setProgress);
        setPage(1);
        await listQuery.refetch();
        toast.success(rows.length === 1 ? "Portfolio image added" : `${rows.length} portfolio images added`);
      } catch (err) {
        toast.error(errorMessage(err, "Upload failed"));
      } finally {
        setProgress(null);
      }
    },
    [api, listQuery, uploadCategory],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      if (event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
    },
    [uploadFiles],
  );

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editForm) return;
    setEditSaving(true);
    try {
      const updated = await api.gallery.update(editing.id, {
        alt: editForm.alt.trim() || "Gallery image",
        category: editForm.category.trim() || "general",
        featured: editForm.featured,
        isActive: editForm.isActive,
      });
      listQuery.setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
            }
          : current,
      );
      toast.success("Portfolio item updated");
      closeEdit();
      await listQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Could not update item"));
      setEditSaving(false);
    }
  }

  async function toggleFlag(image: GalleryImage, patch: Partial<Pick<GalleryImage, "featured" | "isActive">>) {
    setBusyId(image.id);
    try {
      const updated = await api.gallery.update(image.id, patch);
      listQuery.setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
            }
          : current,
      );
      await listQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Could not update item"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeImage(image: GalleryImage) {
    if (!window.confirm(`Remove “${image.alt || image.filename || "this image"}” from the portfolio?`)) {
      return;
    }
    setBusyId(image.id);
    try {
      await api.gallery.remove(image.id);
      if (editing?.id === image.id) closeEdit();
      toast.success("Removed from portfolio");
      if (images.length <= 1 && page > 1) setPage((p) => p - 1);
      else await listQuery.refetch();
    } catch (err) {
      const conflict = mediaInUseFromError(err);
      if (conflict) {
        const detail = conflict.usages
          .slice(0, 3)
          .map((u) => `${usageTypeLabel(u.usageType)} (${u.entityId.slice(0, 8)}…)`)
          .join(", ");
        toast.error(detail ? `${conflict.message} In use: ${detail}` : conflict.message);
      } else {
        toast.error(errorMessage(err, "Could not remove image"));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function moveImage(image: GalleryImage, direction: -1 | 1) {
    const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((row) => row.id === image.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const a = ordered[index];
    const b = ordered[swapIndex];
    setBusyId(image.id);
    try {
      await Promise.all([
        api.gallery.update(a.id, { sortOrder: b.sortOrder }),
        api.gallery.update(b.id, { sortOrder: a.sortOrder }),
      ]);
      await listQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Could not reorder"));
      await listQuery.refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pa-portfolio space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Portfolio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate what appears on the public portfolio. Active gallery images show on the site.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <a href="/portfolio" target="_blank" rel="noreferrer">
              <ExternalLink strokeWidth={1.5} />
              View site
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/gallery">Media Library</Link>
          </Button>
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={progress != null}
            loading={progress != null}
          >
            <Upload strokeWidth={1.5} />
            Add photos
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) void uploadFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      <ErrorBanner message={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.fetching} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio metrics">
        <StatCard label="Portfolio items" icon={Images} tone="primary" loading={listQuery.loading} value={stats.total} />
        <StatCard label="Live on site" icon={Images} loading={listQuery.loading} value={stats.live} />
        <StatCard label="Featured" icon={Star} tone="primary" loading={listQuery.loading} value={stats.featured} />
        <StatCard label="Hidden" icon={Images} loading={listQuery.loading} value={stats.hidden} />
      </section>

      <section
        className={cn(
          "rounded-xl border border-dashed bg-card/40 p-admin-card-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        aria-label="Upload drop zone"
      >
        <div className="flex flex-col gap-admin-gap lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Drop portfolio photos here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Uploads as Gallery kind · JPEG, PNG, or WebP · up to {MAX_FILES} files · 15 MB each
              {progress != null ? ` · Uploading ${progress}%` : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="portfolio-upload-category">Category</Label>
            <Input
              id="portfolio-upload-category"
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value)}
              className="w-[10rem]"
              list="portfolio-category-suggestions"
              placeholder="general"
            />
          </div>
        </div>
        <datalist id="portfolio-category-suggestions">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </section>

      <section className="flex flex-col gap-admin-gap sm:flex-row sm:flex-wrap sm:items-center" aria-label="Filters">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search alt text, filename, or category…"
          className="sm:max-w-sm"
          aria-label="Search portfolio"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as "ALL" | "active" | "inactive" | "featured")}
        >
          <SelectTrigger className="w-[10.5rem]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All items</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[10.5rem]" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {listQuery.loading ? (
        <div className="grid grid-cols-2 gap-admin-gap md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <EmptyState
          icon={Images}
          title={total || debouncedQ || categoryFilter !== "ALL" || statusFilter !== "ALL" ? "No matches" : "Portfolio is empty"}
          description={
            total || debouncedQ || categoryFilter !== "ALL" || statusFilter !== "ALL"
              ? "Try a different search or filter."
              : "Add Gallery-kind photos to publish on the public portfolio page."
          }
          action={
            !total && !debouncedQ && categoryFilter === "ALL" && statusFilter === "ALL" ? (
              <Button type="button" onClick={() => fileRef.current?.click()}>
                <Upload strokeWidth={1.5} />
                Add photos
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
        <ul className="grid grid-cols-2 gap-admin-gap md:grid-cols-3 xl:grid-cols-4">
          {images.map((image) => {
            const src = mediaUrl(image.thumbUrl || image.url);
            const busy = busyId === image.id;
            const orderIndex = orderedIds.indexOf(image.id);
            const canMoveEarlier = orderIndex > 0;
            const canMoveLater = orderIndex >= 0 && orderIndex < orderedIds.length - 1;
            const tooSmall = !isPublicSized(image);
            return (
              <li
                key={image.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border bg-card",
                  !image.isActive && "opacity-70",
                )}
              >
                <button
                  type="button"
                  className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => openEdit(image)}
                  aria-label={`Edit ${image.alt || "portfolio image"}`}
                >
                  <div className="aspect-[4/5] bg-muted">
                    {src ? (
                      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Images className="h-8 w-8" aria-hidden />
                      </div>
                    )}
                  </div>
                </button>

                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {image.featured ? (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3" aria-hidden />
                      Featured
                    </Badge>
                  ) : null}
                  <ActiveBadge active={image.isActive} />
                  {tooSmall ? <Badge variant="destructive">Too small</Badge> : null}
                </div>

                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="secondary"
                        className="bg-background/90 shadow-sm"
                        aria-label={`Actions for ${image.alt || "image"}`}
                        disabled={busy}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(image)}>
                        <Pencil className="h-4 w-4" />
                        Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!canMoveEarlier || busy} onClick={() => void moveImage(image, -1)}>
                        <ArrowUp className="h-4 w-4" />
                        Move earlier
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!canMoveLater || busy} onClick={() => void moveImage(image, 1)}>
                        <ArrowDown className="h-4 w-4" />
                        Move later
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busy}
                        onClick={() => void toggleFlag(image, { featured: !image.featured })}
                      >
                        <Star className="h-4 w-4" />
                        {image.featured ? "Unfeature" : "Feature"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busy}
                        onClick={() => void toggleFlag(image, { isActive: !image.isActive })}
                      >
                        {image.isActive ? "Hide from site" : "Show on site"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={busy}
                        onClick={() => void removeImage(image)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1 border-t border-border p-admin-control">
                  <p className="truncate text-sm text-foreground">{image.alt || "Untitled"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {image.category}
                    {image.width && image.height ? ` · ${image.width}×${image.height}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
            {total ? ` · ${total} item${total === 1 ? "" : "s"}` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || listQuery.fetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount || listQuery.fetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </>
      )}

      <Dialog open={Boolean(editing && editForm)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit portfolio item</DialogTitle>
            <DialogDescription>
              Active items appear on the public portfolio. Featured ones can surface in homepage previews.
            </DialogDescription>
          </DialogHeader>
          {editing && editForm ? (
            <form className="space-y-admin-stack-sm" onSubmit={(event) => void saveEdit(event)}>
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={mediaUrl(editing.thumbUrl || editing.url)}
                  alt={editing.alt}
                  className="max-h-56 w-full object-contain"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-edit-alt">Alt text</Label>
                <Input
                  id="portfolio-edit-alt"
                  value={editForm.alt}
                  onChange={(event) => setEditForm({ ...editForm, alt: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-edit-category">Category</Label>
                <Input
                  id="portfolio-edit-category"
                  value={editForm.category}
                  onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                  list="portfolio-category-suggestions"
                  required
                />
              </div>
              {!isPublicSized(editing) ? (
                <p className="text-xs text-destructive">
                  This asset is under 64px on an edge and will be hidden from the public portfolio.
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm text-foreground">Featured</p>
                  <p className="text-xs text-muted-foreground">Prefer this shot in featured surfaces.</p>
                </div>
                <Switch
                  checked={editForm.featured}
                  onCheckedChange={(featured) => setEditForm({ ...editForm, featured })}
                  aria-label="Featured"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm text-foreground">Show on site</p>
                  <p className="text-xs text-muted-foreground">Inactive items stay in the desk but leave the public page.</p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(isActive) => setEditForm({ ...editForm, isActive })}
                  aria-label="Show on site"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEdit} disabled={editSaving}>
                  Cancel
                </Button>
                <Button type="submit" loading={editSaving}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
