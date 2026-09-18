import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Images, Trash2, Upload } from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Switch } from "../../admin/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "../../admin/components/ui/tabs";
import { toast } from "../../admin/components/ui/toaster";
import { ServiceMediaPicker, type SelectedServiceMedia } from "../../admin/components/ServiceMediaPicker";
import { useAdminApi } from "../../admin/lib/adminApi";
import { mediaInUseFromError, type MediaInUseConflict } from "../../admin/lib/media-usage";
import type { GalleryImage, MediaKind } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";

const KINDS: Array<{ value: "ALL" | MediaKind; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "GALLERY", label: "Gallery" },
  { value: "BLOG", label: "Blog" },
  { value: "CONTENT", label: "Content" },
];

const MAX_FILES = 10;
const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

type KindFilter = "ALL" | MediaKind;
type ActiveFilter = "all" | "active" | "inactive";

function kindLabel(kind: MediaKind) {
  if (kind === "GALLERY") return "Gallery";
  if (kind === "BLOG") return "Blog";
  return "Content";
}

function displayName(image: GalleryImage) {
  if (image.filename?.trim()) return image.filename.trim();
  const path = (image.url || "").split("/").pop();
  return path || image.category || "Untitled";
}

function previewSrc(image: GalleryImage) {
  return image.media?.thumbUrl || image.media?.url || image.thumbUrl || image.url;
}

function dimensions(image: GalleryImage) {
  if (typeof image.width === "number" && image.width > 0 && typeof image.height === "number" && image.height > 0) {
    return `${image.width}×${image.height}`;
  }
  return null;
}

export function AdminGalleryPage({ purpose = "library" }: { purpose?: "library" | "portfolio" }) {
  const api = useAdminApi();
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);
  const isPortfolio = purpose === "portfolio";
  const [kindFilter, setKindFilter] = useState<KindFilter>(isPortfolio ? "GALLERY" : "ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [uploadKind, setUploadKind] = useState<MediaKind>("GALLERY");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [edit, setEdit] = useState<GalleryImage | null>(null);

  useEffect(() => {
    if (kindFilter !== "ALL") setUploadKind(kindFilter);
  }, [kindFilter]);

  const query = useQuery(
    () =>
      api.gallery.list({
        kind: isPortfolio ? "GALLERY" : kindFilter === "ALL" ? undefined : kindFilter,
        isActive: activeFilter === "all" ? undefined : activeFilter === "active",
      }),
    [kindFilter, activeFilter, isPortfolio],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const allowed = list.filter((file) => {
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
      });
      if (!allowed.length) {
        setUploadError("Only JPEG, PNG, or WebP images are allowed");
        toast.error("Only JPEG, PNG, or WebP images are allowed");
        return;
      }
      if (allowed.some((file) => file.size > MAX_BYTES)) {
        setUploadError("Each file must be 15 MB or smaller");
        toast.error("Each file must be 15 MB or smaller");
        return;
      }
      const batch = allowed.slice(0, MAX_FILES);
      const form = new FormData();
      form.append("kind", uploadKind);
      for (const file of batch) form.append("files", file);
      setUploadError(null);
      setProgress(0);
      try {
        await api.gallery.upload(form, setProgress);
        toast.success(`Uploaded ${batch.length} image${batch.length === 1 ? "" : "s"}`);
        await query.refetch();
      } catch (err) {
        const message = errorMessage(err);
        setUploadError(message);
        toast.error(message);
      } finally {
        setProgress(null);
      }
    },
    [api, query, uploadKind],
  );

  const emptyHint = useMemo(() => {
    if (isPortfolio) {
      return "Upload a gallery image in the Media Library, or add one here. Then attach a library asset if you want to replace the displayed photo.";
    }
    if (kindFilter !== "ALL" || activeFilter !== "all") {
      return "No assets match these filters. Clear filters or upload a new image.";
    }
    return "Upload images once here, then reuse them across gallery, services, and other CMS sections.";
  }, [kindFilter, activeFilter, isPortfolio]);

  return (
    <div className="min-w-0 space-y-admin overflow-x-hidden">
      <PageHeader
        eyebrow={isPortfolio ? "Public site" : "Central library"}
        title={isPortfolio ? "Portfolio" : "Media Library"}
        description={
          isPortfolio
            ? "Each gallery item on the public portfolio. Attach a Media Library image to replace what visitors see, or leave it empty to keep the original file."
            : "Upload once and reuse across the desk. Assets stay in this library even when a page stops using them."
        }
      />
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isPortfolio ? (
          <p className="text-sm text-muted-foreground">Gallery items shown on the public portfolio.</p>
        ) : (
          <Tabs value={kindFilter} onValueChange={(value) => setKindFilter(value as KindFilter)}>
            <TabsList className="flex h-auto min-w-0 flex-wrap justify-start gap-1">
              {KINDS.map((kind) => (
                <TabsTrigger key={kind.value} value={kind.value} className="px-2.5 sm:px-3">
                  {kind.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as ActiveFilter)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Active filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {manage ? (
        <div
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-4 py-8 text-center transition",
            dragOver && "border-primary bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop images here or browse</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Up to {MAX_FILES} files · 15 MB each · JPEG, PNG, or WebP. Stored in the library for later reuse.
          </p>
          <div className="flex w-full min-w-0 max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {isPortfolio ? null : (
              <Select value={uploadKind} onValueChange={(value) => setUploadKind(value as MediaKind)}>
                <SelectTrigger className="w-full sm:w-36" aria-label="Upload kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GALLERY">Gallery</SelectItem>
                  <SelectItem value="BLOG">Blog</SelectItem>
                  <SelectItem value="CONTENT">Content</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
              <label className="cursor-pointer">
                <ImagePlus />
                Choose files
                <input
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) void uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
          {progress != null ? (
            <div className="mt-1 w-full max-w-xs">
              <div className="h-2 overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Uploading {progress}%</p>
            </div>
          ) : null}
          {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
        </div>
      ) : null}

      {query.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : !query.data?.length ? (
        <EmptyState icon={Images} title="No media yet" description={emptyHint} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {query.data.map((img) => (
            <button
              key={img.id}
              type="button"
              className="group min-w-0 overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setEdit(img)}
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={isPortfolio ? previewSrc(img) : img.thumbUrl || img.url}
                  alt={img.alt || ""}
                  className={cn("h-full w-full object-cover", !img.isActive && "opacity-50")}
                />
                <div className="absolute left-1.5 top-1.5 flex max-w-[calc(100%-0.75rem)] flex-wrap gap-1">
                  {isPortfolio ? null : (
                    <Badge variant="secondary" className="text-[10px]">
                      {kindLabel(img.kind)}
                    </Badge>
                  )}
                  {isPortfolio && img.media ? (
                    <Badge variant="default" className="text-[10px]">
                      Library
                    </Badge>
                  ) : null}
                  {img.featured ? (
                    <Badge variant="default" className="text-[10px]">
                      Featured
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 space-y-1 px-2 py-1.5">
                <p className="truncate text-xs font-medium text-foreground">{displayName(img)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{img.category || "Uncategorised"}</p>
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <ActiveBadge active={img.isActive} className="text-[10px]" />
                  {dimensions(img) ? (
                    <span className="truncate text-[10px] text-muted-foreground">{dimensions(img)}</span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <EditImageDialog
        image={edit}
        manage={manage}
        attachMedia={isPortfolio}
        onOpenChange={(open) => !open && setEdit(null)}
        onSaved={async (updated) => {
          query.setData((current) =>
            current ? current.map((row) => (row.id === updated.id ? updated : row)) : current,
          );
          setEdit(updated);
          await query.refetch();
        }}
        onDeleted={(id) => {
          query.setData((current) => (current ? current.filter((row) => row.id !== id) : current));
          setEdit(null);
        }}
      />
    </div>
  );
}

function EditImageDialog({
  image,
  manage,
  attachMedia = false,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  image: GalleryImage | null;
  manage: boolean;
  attachMedia?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (image: GalleryImage) => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const api = useAdminApi();
  const [alt, setAlt] = useState("");
  const [category, setCategory] = useState("");
  const [featured, setFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [media, setMedia] = useState<SelectedServiceMedia | null>(null);
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<MediaInUseConflict | null>(null);

  useEffect(() => {
    if (!image) return;
    setAlt(image.alt ?? "");
    setCategory(image.category ?? "");
    setFeatured(image.featured);
    setIsActive(image.isActive);
    setSortOrder(String(image.sortOrder ?? 0));
    setMedia(
      image.media
        ? {
            id: image.media.id,
            url: image.media.url,
            thumbUrl: image.media.thumbUrl,
            alt: image.media.alt,
          }
        : null,
    );
    setConflict(null);
  }, [image]);

  return (
    <Dialog open={!!image} onOpenChange={onOpenChange}>
      <DialogContent className={attachMedia ? "max-w-2xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{attachMedia ? "Portfolio item" : "Media details"}</DialogTitle>
        </DialogHeader>
        {image ? (
          <div className="min-w-0 space-y-3">
            {attachMedia ? null : (
              <img
                src={image.thumbUrl || image.url}
                alt=""
                className="max-h-48 w-full rounded-md object-cover"
              />
            )}
            <p className="truncate text-xs text-muted-foreground">
              {kindLabel(image.kind)}
              {dimensions(image) ? ` · ${dimensions(image)}` : ""}
              {image.filename ? ` · ${image.filename}` : ""}
            </p>
            {conflict ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
              >
                <p className="font-medium text-foreground">
                  This asset cannot be deleted while it is attached elsewhere.
                </p>
                <p className="mt-1 text-muted-foreground">{conflict.message}</p>
                {conflict.usages.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {conflict.usages.map((usage) => (
                      <li key={usage.id || `${usage.usageType}-${usage.entityId}`}>
                        {usage.usageType} · {usage.entityId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {conflict.count} attachment{conflict.count === 1 ? "" : "s"} still reference this file.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Detach it from those places first. The library will not remove usages for you.
                </p>
              </div>
            ) : null}
            {attachMedia ? (
              <ServiceMediaPicker enabled={!!image} value={media} onChange={setMedia} />
            ) : null}
            <FormField label="Alt text">
              {(c) => <Input id={c.id} value={alt} onChange={(e) => setAlt(e.target.value)} disabled={!manage} />}
            </FormField>
            <FormField label="Category">
              {(c) => (
                <Input id={c.id} value={category} onChange={(e) => setCategory(e.target.value)} disabled={!manage} />
              )}
            </FormField>
            <FormField label="Sort order">
              {(c) => (
                <Input
                  id={c.id}
                  type="number"
                  min={0}
                  step={1}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  disabled={!manage}
                />
              )}
            </FormField>
            <FormField label="Featured" inline>
              {() => <Switch checked={featured} onCheckedChange={setFeatured} disabled={!manage} />}
            </FormField>
            <FormField label="Active" inline>
              {() => <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!manage} />}
            </FormField>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          {manage && image ? (
            <ConfirmDialog
              title="Delete this asset?"
              description="Removes the file from disk. This is blocked if the image is still attached to CMS content."
              confirmLabel="Delete"
              destructive
              successMessage="Asset deleted"
              onConfirm={async () => {
                try {
                  await api.gallery.remove(image.id);
                  onDeleted(image.id);
                } catch (err) {
                  const inUse = mediaInUseFromError(err);
                  if (inUse) setConflict(inUse);
                  throw err;
                }
              }}
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 />
                  Delete
                </Button>
              }
            />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {manage ? (
              <Button
                loading={pending}
                onClick={() => {
                  if (!image) return;
                  const order = Number(sortOrder);
                  if (!Number.isInteger(order) || order < 0) {
                    toast.error("Sort order must be a whole number of 0 or more");
                    return;
                  }
                  setPending(true);
                  void api.gallery
                    .update(image.id, {
                      alt,
                      category,
                      featured,
                      isActive,
                      sortOrder: order,
                      ...(attachMedia ? { mediaId: media?.id ?? null } : {}),
                    })
                    .then((updated) => {
                      toast.success(attachMedia ? "Portfolio item updated" : "Asset updated");
                      return onSaved(updated);
                    })
                    .catch((err) => toast.error(errorMessage(err)))
                    .finally(() => setPending(false));
                }}
              >
                Save
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
