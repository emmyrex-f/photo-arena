import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Quote,
  Star,
  Trash2,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import {
  ServiceMediaPicker,
  type SelectedServiceMedia,
} from "../../admin/components/ServiceMediaPicker";
import { useAdminApi } from "../../admin/lib/adminApi";
import type { Testimonial } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/publicApi";

type StatusFilter = "ALL" | "published" | "draft";

type EditorForm = {
  quote: string;
  name: string;
  role: string;
  rating: string;
  isPublished: boolean;
  media: SelectedServiceMedia | null;
};

const EMPTY_FORM: EditorForm = {
  quote: "",
  name: "",
  role: "",
  rating: "",
  isPublished: false,
  media: null,
};

function toMedia(testimonial: Testimonial): SelectedServiceMedia | null {
  if (!testimonial.media) return null;
  return {
    id: testimonial.media.id,
    url: testimonial.media.url,
    thumbUrl: testimonial.media.thumbUrl,
    alt: testimonial.media.alt,
  };
}

function ratingLabel(rating: number | null | undefined): string {
  if (rating == null) return "—";
  return `${rating}/5`;
}

function Stars({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-primary" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn("h-3.5 w-3.5", index < rating ? "fill-current" : "text-muted-foreground/40")}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function AdminTestimonialsPage() {
  const api = useAdminApi();
  const modal = useModal();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const listQuery = useQuery(() => api.testimonials.list(), []);
  const rows = listQuery.data ?? [];

  const orderedIds = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "published" && !row.isPublished) return false;
      if (statusFilter === "draft" && row.isPublished) return false;
      if (!q) return true;
      return (
        row.quote.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        (row.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, query]);

  const stats = useMemo(() => {
    const total = rows.length;
    const published = rows.filter((row) => row.isPublished).length;
    const withPhoto = rows.filter((row) => Boolean(row.media)).length;
    const drafts = total - published;
    return { total, published, drafts, withPhoto };
  }, [rows]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((row: Testimonial) => {
    setEditing(row);
    setForm({
      quote: row.quote,
      name: row.name,
      role: row.role ?? "",
      rating: row.rating != null ? String(row.rating) : "",
      isPublished: row.isPublished,
      media: toMedia(row),
    });
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaving(false);
  }, []);

  async function saveEditor(event: FormEvent) {
    event.preventDefault();
    const quote = form.quote.trim();
    const name = form.name.trim();
    if (!quote || !name) {
      toast.error("Quote and name are required");
      return;
    }

    const rating =
      form.rating === "" ? null : Math.min(5, Math.max(1, Number.parseInt(form.rating, 10) || 1));
    const mediaId = form.media?.id ?? null;

    setSaving(true);
    try {
      if (editing) {
        const updated = await api.testimonials.update(editing.id, {
          quote,
          name,
          role: form.role.trim() || "",
          isPublished: form.isPublished,
          mediaId,
          ...(rating != null ? { rating } : {}),
        });
        listQuery.setData((current) =>
          current ? current.map((row) => (row.id === updated.id ? updated : row)) : [updated],
        );
        toast.success("Testimonial updated");
      } else {
        const created = await api.testimonials.create({
          quote,
          name,
          role: form.role.trim() || null,
          rating,
          isPublished: form.isPublished,
          sortOrder: rows.length,
          mediaId,
        });
        listQuery.setData((current) => (current ? [...current, created] : [created]));
        toast.success(form.isPublished ? "Testimonial published" : "Draft saved");
      }
      closeEditor();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save testimonial"));
      setSaving(false);
    }
  }

  async function togglePublished(row: Testimonial) {
    setBusyId(row.id);
    try {
      const updated = await api.testimonials.update(row.id, { isPublished: !row.isPublished });
      listQuery.setData((current) =>
        current ? current.map((item) => (item.id === updated.id ? updated : item)) : [updated],
      );
      toast.success(updated.isPublished ? "Published" : "Unpublished");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update status"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeRow(row: Testimonial) {
    const ok = await modal.confirm({
      title: "Delete Testimonial",
      description: `Are you sure you want to delete the testimonial from ${row.name}?`,
      confirmLabel: "Delete testimonial",
      destructive: true,
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await api.testimonials.remove(row.id);
      listQuery.setData((current) => (current ? current.filter((item) => item.id !== row.id) : []));
      if (editing?.id === row.id) closeEditor();
      toast.success("Testimonial deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete"));
    } finally {
      setBusyId(null);
    }
  }

  async function moveRow(row: Testimonial, direction: -1 | 1) {
    const ordered = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((item) => item.id === row.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const next = [...ordered];
    const [removed] = next.splice(index, 1);
    next.splice(swapIndex, 0, removed);
    const ids = next.map((item) => item.id);

    setBusyId(row.id);
    try {
      const refreshed = await api.testimonials.reorder(ids);
      listQuery.setData(Array.isArray(refreshed) ? refreshed : next.map((item, sortOrder) => ({ ...item, sortOrder })));
    } catch (err) {
      toast.error(errorMessage(err, "Could not reorder"));
      await listQuery.refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pa-testimonials space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Testimonials
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and publish client quotes. Unpublished items stay on the desk only.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus strokeWidth={1.5} />
          New testimonial
        </Button>
      </header>

      <ErrorBanner message={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.fetching} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="Testimonial metrics">
        <StatCard label="Total" icon={Quote} tone="primary" loading={listQuery.loading} value={stats.total} />
        <StatCard label="Published" icon={Quote} loading={listQuery.loading} value={stats.published} />
        <StatCard label="Drafts" icon={Quote} loading={listQuery.loading} value={stats.drafts} />
        <StatCard label="With photo" icon={Star} tone="primary" loading={listQuery.loading} value={stats.withPhoto} />
      </section>

      <section className="flex flex-col gap-admin-gap sm:flex-row sm:flex-wrap sm:items-center" aria-label="Filters">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search quote, name, or role…"
          className="sm:max-w-sm"
          aria-label="Search testimonials"
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-[10.5rem]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {listQuery.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Quote}
          title={rows.length ? "No matches" : "No testimonials yet"}
          description={
            rows.length
              ? "Try a different search or filter."
              : "Add a quote to review on the desk. Publish when you are ready for the site."
          }
          action={
            !rows.length ? (
              <Button type="button" onClick={openCreate}>
                <Plus strokeWidth={1.5} />
                New testimonial
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Quote</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const busy = busyId === row.id;
                const orderIndex = orderedIds.indexOf(row.id);
                const thumb = mediaUrl(row.media?.thumbUrl || row.media?.url);
                return (
                  <TableRow key={row.id} className={cn(!row.isPublished && "opacity-80")}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="mt-0.5 h-10 w-10 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Quote className="h-4 w-4" aria-hidden />
                          </div>
                        )}
                        <p className="line-clamp-2 text-sm text-foreground">{row.quote}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.role || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Stars rating={row.rating} />
                      <span className="sr-only">{ratingLabel(row.rating)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.isPublished ? "success" : "muted"}>
                        {row.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions for ${row.name}`}
                            disabled={busy}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={orderIndex <= 0 || busy}
                            onClick={() => void moveRow(row, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                            Move earlier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={orderIndex < 0 || orderIndex >= orderedIds.length - 1 || busy}
                            onClick={() => void moveRow(row, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                            Move later
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => void togglePublished(row)}>
                            {row.isPublished ? "Unpublish" : "Publish"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={busy}
                            onClick={() => void removeRow(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit testimonial" : "New testimonial"}</DialogTitle>
            <DialogDescription>
              Drafts stay off the public site until you publish. Photo is optional.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-admin-stack-sm" onSubmit={(event) => void saveEditor(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="testimonial-quote">Quote</Label>
              <Textarea
                id="testimonial-quote"
                value={form.quote}
                onChange={(event) => setForm({ ...form, quote: event.target.value })}
                rows={4}
                required
              />
            </div>
            <div className="grid gap-admin-gap sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="testimonial-name">Name</Label>
                <Input
                  id="testimonial-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="testimonial-role">Role / session</Label>
                <Input
                  id="testimonial-role"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  placeholder="e.g. Birthday Shoot"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="testimonial-rating">Rating</Label>
              <Select
                value={form.rating || "none"}
                onValueChange={(value) => setForm({ ...form, rating: value === "none" ? "" : value })}
              >
                <SelectTrigger id="testimonial-rating" className="w-full sm:w-[12rem]">
                  <SelectValue placeholder="No rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rating</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                  <SelectItem value="4">4 stars</SelectItem>
                  <SelectItem value="3">3 stars</SelectItem>
                  <SelectItem value="2">2 stars</SelectItem>
                  <SelectItem value="1">1 star</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm text-foreground">Published</p>
                <p className="text-xs text-muted-foreground">Show this quote on the public site.</p>
              </div>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(isPublished) => setForm({ ...form, isPublished })}
                aria-label="Published"
              />
            </div>
            <ServiceMediaPicker
              enabled={editorOpen}
              value={form.media}
              onChange={(media) => setForm({ ...form, media })}
              previewAlt={form.name || "Testimonial photo"}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditor} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
