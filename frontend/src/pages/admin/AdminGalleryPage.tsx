import { useCallback, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
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
import type { GalleryImage, MediaKind } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/publicApi";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const KIND_OPTIONS: Array<{ value: MediaKind; label: string }> = [
  { value: "GALLERY", label: "Gallery" },
  { value: "CONTENT", label: "Content" },
  { value: "BLOG", label: "Blog" },
];

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

function kindLabel(kind: MediaKind): string {
  const match = KIND_OPTIONS.find((row) => row.value === kind);
  return match?.label ?? kind;
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

type EditForm = {
  alt: string;
  category: string;
  featured: boolean;
  isActive: boolean;
};

export function AdminGalleryPage() {
  const api = useAdminApi();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kindFilter, setKindFilter] = useState<"ALL" | MediaKind>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [uploadKind, setUploadKind] = useState<MediaKind>("GALLERY");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const listQuery = useQuery(
    () =>
      api.gallery.list({
        ...(kindFilter !== "ALL" ? { kind: kindFilter } : {}),
        ...(statusFilter === "active" ? { isActive: true } : {}),
        ...(statusFilter === "inactive" ? { isActive: false } : {}),
      }),
    [kindFilter, statusFilter],
  );

  const images = listQuery.data ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>(SUGGESTED_CATEGORIES);
    for (const image of images) {
      if (image.category?.trim()) set.add(image.category.trim().toLowerCase());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [images]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return images.filter((image) => {
      if (categoryFilter !== "ALL" && image.category.toLowerCase() !== categoryFilter) return false;
      if (!q) return true;
      return (
        image.alt.toLowerCase().includes(q) ||
        (image.filename ?? "").toLowerCase().includes(q) ||
        image.category.toLowerCase().includes(q)
      );
    });
  }, [images, categoryFilter, query]);

  const orderedIds = useMemo(
    () => [...images].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id),
    [images],
  );

  const stats = useMemo(() => {
    const total = images.length;
    const active = images.filter((row) => row.isActive).length;
    const featured = images.filter((row) => row.featured).length;
    const inactive = total - active;
    return { total, active, featured, inactive };
  }, [images]);

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
      form.append("kind", uploadKind);
      form.append("category", uploadCategory.trim() || "general");
      for (const file of files) form.append("files", file);

      setProgress(0);
      try {
        const rows = await api.gallery.upload(form, setProgress);
        listQuery.setData((current) => {
          const next = current ? [...rows, ...current.filter((row) => !rows.some((r) => r.id === row.id))] : rows;
          return next.sort((a, b) => a.sortOrder - b.sortOrder);
        });
        toast.success(rows.length === 1 ? "Image uploaded" : `${rows.length} images uploaded`);
      } catch (err) {
        toast.error(errorMessage(err, "Upload failed"));
      } finally {
        setProgress(null);
      }
    },
    [api, listQuery, uploadCategory, uploadKind],
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
        current ? current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) : [updated],
      );
      toast.success("Image updated");
      closeEdit();
    } catch (err) {
      toast.error(errorMessage(err, "Could not update image"));
      setEditSaving(false);
    }
  }

  async function toggleFlag(image: GalleryImage, patch: Partial<Pick<GalleryImage, "featured" | "isActive">>) {
    setBusyId(image.id);
    try {
      const updated = await api.gallery.update(image.id, patch);
      listQuery.setData((current) =>
        current ? current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) : [updated],
      );
    } catch (err) {
      toast.error(errorMessage(err, "Could not update image"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeImage(image: GalleryImage) {
    if (!window.confirm(`Delete “${image.alt || image.filename || "this image"}”? This cannot be undone.`)) {
      return;
    }
    setBusyId(image.id);
    try {
      await api.gallery.remove(image.id);
      listQuery.setData((current) => (current ? current.filter((row) => row.id !== image.id) : []));
      if (editing?.id === image.id) closeEdit();
      toast.success("Image deleted");
    } catch (err) {
      const conflict = mediaInUseFromError(err);
      if (conflict) {
        const detail = conflict.usages
          .slice(0, 3)
          .map((u) => `${usageTypeLabel(u.usageType)} (${u.entityId.slice(0, 8)}…)`)
          .join(", ");
        toast.error(
          detail
            ? `${conflict.message} In use: ${detail}`
            : conflict.message,
        );
      } else {
        toast.error(errorMessage(err, "Could not delete image"));
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

    const next = [...ordered];
    const [removed] = next.splice(index, 1);
    next.splice(swapIndex, 0, removed);
    const ids = next.map((row) => row.id);

    setBusyId(image.id);
    try {
      await api.gallery.reorder(ids);
      listQuery.setData(
        next.map((row, sortOrder) => ({
          ...row,
          sortOrder,
        })),
      );
    } catch (err) {
      toast.error(errorMessage(err, "Could not reorder"));
      await listQuery.refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pa-gallery space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Media Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload and manage images for the portfolio, services, and content.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={progress != null}
          loading={progress != null}
        >
          <Upload strokeWidth={1.5} />
          Upload images
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
      </header>

      <ErrorBanner message={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.fetching} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Library metrics">
        <StatCard label="Total assets" icon={ImageIcon} tone="primary" loading={listQuery.loading} value={stats.total} />
        <StatCard label="Active" icon={ImageIcon} loading={listQuery.loading} value={stats.active} />
        <StatCard label="Featured" icon={Star} tone="primary" loading={listQuery.loading} value={stats.featured} />
        <StatCard label="Inactive" icon={ImageIcon} loading={listQuery.loading} value={stats.inactive} />
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
            <p className="text-sm font-medium text-foreground">Drop images here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, or WebP · up to {MAX_FILES} files · 15 MB each
              {progress != null ? ` · Uploading ${progress}%` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-admin-gap">
            <div className="space-y-1.5">
              <Label htmlFor="upload-kind">Kind</Label>
              <Select value={uploadKind} onValueChange={(value) => setUploadKind(value as MediaKind)}>
                <SelectTrigger id="upload-kind" className="w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-category">Category</Label>
              <Input
                id="upload-category"
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value)}
                className="w-[10rem]"
                list="gallery-category-suggestions"
                placeholder="general"
              />
            </div>
          </div>
        </div>
        <datalist id="gallery-category-suggestions">
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
          aria-label="Search media"
        />
        <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as "ALL" | MediaKind)}>
          <SelectTrigger className="w-[9.5rem]" aria-label="Filter by kind">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All kinds</SelectItem>
            {KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as "ALL" | "active" | "inactive")}
        >
          <SelectTrigger className="w-[9.5rem]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={images.length ? "No matches" : "No images yet"}
          description={
            images.length
              ? "Try a different search or filter."
              : "Upload JPEG, PNG, or WebP files to start building the library."
          }
          action={
            !images.length ? (
              <Button type="button" onClick={() => fileRef.current?.click()}>
                <Upload strokeWidth={1.5} />
                Upload images
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-admin-gap md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((image) => {
            const src = mediaUrl(image.thumbUrl || image.url);
            const busy = busyId === image.id;
            const orderIndex = orderedIds.indexOf(image.id);
            const canMoveEarlier = orderIndex > 0;
            const canMoveLater = orderIndex >= 0 && orderIndex < orderedIds.length - 1;
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
                  aria-label={`Edit ${image.alt || "image"}`}
                >
                  <div className="aspect-[4/5] bg-muted">
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8" aria-hidden />
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
                      <DropdownMenuItem
                        disabled={!canMoveEarlier || busy}
                        onClick={() => void moveImage(image, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                        Move earlier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canMoveLater || busy}
                        onClick={() => void moveImage(image, 1)}
                      >
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
                    {image.category} · {kindLabel(image.kind)}
                    {image.width && image.height ? ` · ${image.width}×${image.height}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(editing && editForm)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit image</DialogTitle>
            <DialogDescription>Update alt text, category, and visibility. Kind is set at upload.</DialogDescription>
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
                <Label htmlFor="edit-alt">Alt text</Label>
                <Input
                  id="edit-alt"
                  value={editForm.alt}
                  onChange={(event) => setEditForm({ ...editForm, alt: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                  list="gallery-category-suggestions"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Kind: {kindLabel(editing.kind)}
                {editing.filename ? ` · ${editing.filename}` : ""}
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm text-foreground">Featured</p>
                  <p className="text-xs text-muted-foreground">Highlight on public surfaces that use featured media.</p>
                </div>
                <Switch
                  checked={editForm.featured}
                  onCheckedChange={(featured) => setEditForm({ ...editForm, featured })}
                  aria-label="Featured"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm text-foreground">Active</p>
                  <p className="text-xs text-muted-foreground">Inactive assets stay in the library but are hidden from picks.</p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(isActive) => setEditForm({ ...editForm, isActive })}
                  aria-label="Active"
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
