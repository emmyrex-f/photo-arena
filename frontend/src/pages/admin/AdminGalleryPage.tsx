import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
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
import { useModal } from "../../admin/components/ui/confirm-dialog";
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
const PAGE_SIZE = 24;
const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type MediaHubTab = "all" | "portfolio" | "services" | "content" | "blog";

const TABS: Array<{
  id: MediaHubTab;
  label: string;
  description: string;
  kind?: MediaKind;
  category?: string;
  usageType?: string;
}> = [
  { id: "all", label: "All Media", description: "Central asset store for all studio images across every department." },
  { id: "portfolio", label: "Portfolio Showcase", description: "Manage photos displayed in the client-facing portfolio and homepage highlight reel.", kind: "GALLERY" },
  { id: "services", label: "Services", description: "Thumbnails, covers, and promotional visuals linked to studio services.", usageType: "service", category: "services", kind: "CONTENT" },
  { id: "content", label: "Website Content", description: "Hero banners, tour clips, promotional graphics, and about section assets.", kind: "CONTENT" },
  { id: "blog", label: "Blog Assets", description: "Featured visuals and supporting graphics for blog articles.", kind: "BLOG" },
];

const KIND_OPTIONS: Array<{ value: MediaKind; label: string }> = [
  { value: "GALLERY", label: "Gallery / Portfolio" },
  { value: "CONTENT", label: "Website Content" },
  { value: "BLOG", label: "Blog Asset" },
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

/** Public site hides images under 64px on either edge. */
function isPublicSized(image: GalleryImage): boolean {
  if (image.width == null && image.height == null) return true;
  if (image.width != null && image.width < 64) return false;
  if (image.height != null && image.height < 64) return false;
  return true;
}

function isMediaHubTab(val: string | null): val is MediaHubTab {
  return TABS.some((t) => t.id === val);
}

type EditForm = {
  alt: string;
  category: string;
  featured: boolean;
  isActive: boolean;
  kind?: MediaKind;
};

export function AdminGalleryPage() {
  const api = useAdminApi();
  const modal = useModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [params, setParams] = useSearchParams();

  const tabParam = params.get("tab");
  const tab: MediaHubTab = isMediaHubTab(tabParam) ? tabParam : "all";

  const activeTabConfig = TABS.find((t) => t.id === tab) ?? TABS[0];

  const [kindFilter, setKindFilter] = useState<"ALL" | MediaKind>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive" | "featured">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Sync tab changes to URL params
  const setTab = useCallback(
    (next: MediaHubTab) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next === "all") copy.delete("tab");
          else copy.set("tab", next);
          return copy;
        },
        { replace: true },
      );
      setPage(1);
    },
    [setParams],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [tab, kindFilter, statusFilter, categoryFilter, debouncedQ]);

  // Compute effective kind from active tab or explicit dropdown
  const effectiveKind: MediaKind | undefined = useMemo(() => {
    if (tab === "portfolio") return "GALLERY";
    if (tab === "content" || tab === "services") return "CONTENT";
    if (tab === "blog") return "BLOG";
    return kindFilter !== "ALL" ? kindFilter : undefined;
  }, [tab, kindFilter]);

  const listQuery = useQuery(
    () =>
      api.gallery.list({
        page,
        pageSize: PAGE_SIZE,
        ...(effectiveKind ? { kind: effectiveKind } : {}),
        ...(activeTabConfig.usageType ? { usageType: activeTabConfig.usageType } : {}),
        ...(statusFilter === "active" ? { isActive: true } : {}),
        ...(statusFilter === "inactive" ? { isActive: false } : {}),
        ...(statusFilter === "featured" ? { featured: true, isActive: true } : {}),
        ...(categoryFilter !== "ALL"
          ? { category: categoryFilter }
          : activeTabConfig.category
            ? { category: activeTabConfig.category }
            : {}),
        ...(debouncedQ ? { q: debouncedQ } : {}),
      }),
    [effectiveKind, activeTabConfig, statusFilter, categoryFilter, debouncedQ, page],
  );

  const pageData = listQuery.data;
  const images = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const counts = pageData?.counts ?? { active: 0, featured: 0, inactive: 0 };
  const pageCount = Math.max(1, Math.ceil(total / (pageData?.pageSize ?? PAGE_SIZE)));

  const categories = useMemo(() => {
    const set = new Set<string>(SUGGESTED_CATEGORIES);
    for (const image of images) {
      if (image.category?.trim()) set.add(image.category.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [images]);

  const orderedIds = useMemo(
    () => [...images].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id),
    [images],
  );

  const openEdit = useCallback((image: GalleryImage) => {
    setEditing(image);
    setEditForm({
      alt: image.alt,
      category: image.category,
      featured: image.featured,
      isActive: image.isActive,
      kind: image.kind,
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
      const targetKind =
        activeTabConfig.kind ?? (tab === "portfolio" ? "GALLERY" : tab === "blog" ? "BLOG" : "CONTENT");
      form.append("kind", targetKind);
      form.append("category", activeTabConfig.category ?? (tab === "services" ? "Service/general" : "general"));
      for (const file of files) form.append("files", file);

      setProgress(0);
      try {
        const rows = await api.gallery.upload(form, setProgress);
        setPage(1);
        await listQuery.refetch();
        toast.success(rows.length === 1 ? "Image uploaded" : `${rows.length} images uploaded`);
      } catch (err) {
        toast.error(errorMessage(err, "Upload failed"));
      } finally {
        setProgress(null);
      }
    },
    [activeTabConfig.category, activeTabConfig.kind, api, listQuery, tab],
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
      toast.success("Image updated");
      if (updated.featured && counts.featured >= 14) {
        toast.warning(
          `You now have ${counts.featured + 1} featured images. Having 15 or more may slow down homepage loading.`,
        );
      }
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
        current
          ? {
              ...current,
              items: current.items.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
            }
          : current,
      );
      await listQuery.refetch();
      if (patch.featured === true && counts.featured >= 14) {
        toast.warning(
          `You have ${counts.featured + 1} featured images. Consider keeping it to 8–12 for optimal homepage loading speed.`,
        );
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not update image"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeImage(image: GalleryImage) {
    const ok = await modal.confirm({
      title: "Delete Image",
      description: `Delete “${image.alt || image.filename || "this image"}”? This action cannot be undone.`,
      confirmLabel: "Delete image",
      destructive: true,
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setBusyId(image.id);
    try {
      await api.gallery.remove(image.id);
      if (editing?.id === image.id) closeEdit();
      toast.success("Image deleted");
      if (images.length <= 1 && page > 1) setPage((p) => p - 1);
      else await listQuery.refetch();
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
    <div className="pa-gallery space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
              Media Hub
            </h1>
            <Badge variant="outline" className="text-xs font-normal">
              {activeTabConfig.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTabConfig.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </header>

      {/* Media Hub Tab Switcher */}
      <div
        role="tablist"
        aria-label="Media Hub categories"
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
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
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

      <ErrorBanner message={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.fetching} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Library metrics">
        <StatCard label="Total assets" icon={ImageIcon} tone="primary" loading={listQuery.loading} value={total} />
        <StatCard label="Active" icon={ImageIcon} loading={listQuery.loading} value={counts.active} />
        <StatCard label="Featured" icon={Star} tone="primary" loading={listQuery.loading} value={counts.featured} />
        <StatCard label="Inactive" icon={ImageIcon} loading={listQuery.loading} value={counts.inactive} />
      </section>

      {counts.featured >= 15 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="font-semibold text-foreground">
              High Number of Featured Images ({counts.featured})
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You have {counts.featured} images marked as featured. All of them will be displayed on the homepage portfolio preview. Having 15 or more may affect page load speed. We recommend keeping featured items to 8–12 images for optimal curation and fast loading.
            </p>
          </div>
        </div>
      ) : null}


      <section className="flex flex-col gap-admin-gap sm:flex-row sm:flex-wrap sm:items-center" aria-label="Filters">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search alt text, filename, or category…"
          className="sm:max-w-sm"
          aria-label="Search media"
        />
        {tab === "all" ? (
          <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as "ALL" | MediaKind)}>
            <SelectTrigger className="w-[10.5rem]" aria-label="Filter by kind">
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
        ) : null}
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as "ALL" | "active" | "inactive" | "featured")}
        >
          <SelectTrigger className="w-[9.5rem]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="featured">Featured only</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[12rem]" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            <SelectItem value="services">All Services (Service/*)</SelectItem>
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
          icon={ImageIcon}
          title={total || debouncedQ || categoryFilter !== "ALL" ? "No matches" : `No ${activeTabConfig.label} images yet`}
          description={
            total || debouncedQ || categoryFilter !== "ALL"
              ? "Try a different search or filter."
              : `Upload JPEG, PNG, or WebP files to add to ${activeTabConfig.label.toLowerCase()}.`
          }
          action={
            !total && !debouncedQ && categoryFilter === "ALL" ? (
              <Button type="button" onClick={() => fileRef.current?.click()}>
                <Upload strokeWidth={1.5} />
                Upload images
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
            const publicSized = isPublicSized(image);

            return (
              <li
                key={image.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
                  !image.isActive ? "border-border/60 opacity-60" : "border-border",
                )}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                  <img
                    src={src}
                    alt={image.alt || "Studio asset"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <ActiveBadge active={image.isActive} />
                    {image.featured ? (
                      <Badge variant="warning" className="gap-1 bg-amber-500/90 text-white hover:bg-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        Featured
                      </Badge>
                    ) : null}
                    {tab === "all" ? (
                      <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm">
                        {kindLabel(image.kind)}
                      </Badge>
                    ) : null}
                    {tab === "portfolio" && !publicSized ? (
                      <Badge variant="destructive" className="text-[10px]" title="Image smaller than 64px on one edge; hidden on public portfolio">
                        Too small
                      </Badge>
                    ) : null}
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-sm"
                          disabled={busy}
                          aria-label="Image actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(image)}>
                          <Pencil className="h-4 w-4" />
                          Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void toggleFlag(image, { featured: !image.featured })}>
                          <Star className="h-4 w-4" />
                          {image.featured ? "Unfeature" : "Mark featured"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void toggleFlag(image, { isActive: !image.isActive })}>
                          <ActiveBadge active={!image.isActive} />
                          {image.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void removeImage(image)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-2 p-3 text-xs">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium text-foreground" title={image.alt}>
                      {image.alt || <span className="text-muted-foreground italic">No caption</span>}
                    </p>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                      {image.category?.startsWith("Service/") ? (
                        <span
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 truncate max-w-[170px]"
                          title={image.category}
                        >
                          {image.category}
                        </span>
                      ) : (
                        <span className="capitalize truncate max-w-[150px]">{image.category}</span>
                      )}
                      {image.width && image.height ? (
                        <span className="shrink-0 text-[10px]">
                          {image.width}×{image.height}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2">
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy || !canMoveEarlier}
                        onClick={() => void moveImage(image, -1)}
                        title="Move earlier"
                        aria-label="Move earlier"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy || !canMoveLater}
                        onClick={() => void moveImage(image, 1)}
                        title="Move later"
                        aria-label="Move later"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void toggleFlag(image, { featured: !image.featured })}
                      disabled={busy}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors",
                        image.featured
                          ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                      title={image.featured ? "Featured on homepage" : "Click to feature"}
                    >
                      <Star className={cn("h-3.5 w-3.5", image.featured && "fill-current")} />
                      <span>{image.featured ? "Featured" : "Feature"}</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Page {page} of {pageCount} ({total} total assets)
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || listQuery.fetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
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
        ) : null}
        </>
      )}

      {/* Edit Image Details Dialog */}
      <Dialog open={editing != null} onOpenChange={(open) => (!open ? closeEdit() : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Image Details</DialogTitle>
            <DialogDescription>
              Update the caption, category tag, and display options.
            </DialogDescription>
          </DialogHeader>

          {editing && editForm ? (
            <form onSubmit={(e) => void saveEdit(e)} className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-border bg-muted/40 aspect-[4/3]">
                <img
                  src={mediaUrl(editing.thumbUrl || editing.url)}
                  alt={editing.alt || "Editing asset"}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-alt">Caption / Alt text</Label>
                <Input
                  id="edit-alt"
                  value={editForm.alt}
                  onChange={(e) => setEditForm({ ...editForm, alt: e.target.value })}
                  placeholder="Describe this image"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  list="edit-category-suggestions"
                  placeholder="e.g. portraits, birthdays"
                />
                <datalist id="edit-category-suggestions">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-featured" className="text-sm font-medium">
                    Featured on Homepage
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Shows in the homepage portfolio preview highlight reel.
                  </p>
                </div>
                <Switch
                  id="edit-featured"
                  checked={editForm.featured}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, featured: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-active" className="text-sm font-medium">
                    Active Status
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Controls whether this asset is visible on the site.
                  </p>
                </div>
                <Switch
                  id="edit-active"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closeEdit}>
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
