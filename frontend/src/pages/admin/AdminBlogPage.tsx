import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileText, ImageIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
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
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDate } from "../../admin/lib/format";
import type { BlogPost } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/publicApi";

const PAGE_SIZE = 10;

export function AdminBlogPage() {
  const api = useAdminApi();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page") || "1") || 1);

  const [items, setItems] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.blog.list({ page, pageSize: PAGE_SIZE, q: q || undefined });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(errorMessage(err, "Could not load posts"));
    } finally {
      setLoading(false);
    }
  }, [api, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const published = useMemo(() => items.filter((row) => row.isPublished).length, [items]);

  function setPage(next: number) {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      if (next <= 1) copy.delete("page");
      else copy.set("page", String(next));
      return copy;
    });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      const next = searchDraft.trim();
      if (next) copy.set("q", next);
      else copy.delete("q");
      copy.delete("page");
      return copy;
    });
  }

  async function removePost(post: BlogPost) {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    setBusyId(post.id);
    try {
      await api.blog.remove(post.id);
      toast.success("Post deleted");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete post"));
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublish(post: BlogPost) {
    setBusyId(post.id);
    try {
      await api.blog.update(post.id, { isPublished: !post.isPublished });
      toast.success(post.isPublished ? "Unpublished" : "Published");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not update post"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pa-blog space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Blog
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Write and publish studio stories and tips.</p>
        </div>
        <Button type="button" asChild>
          <Link to="/admin/blog/new">
            <Plus strokeWidth={1.5} />
            New post
          </Link>
        </Button>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      <section className="grid gap-admin-gap sm:grid-cols-3" aria-label="Blog metrics">
        <StatCard label="Total posts" icon={FileText} tone="primary" loading={loading} value={total} />
        <StatCard label="On this page" icon={FileText} loading={loading} value={items.length} />
        <StatCard label="Published (page)" icon={FileText} loading={loading} value={published} />
      </section>

      <form className="flex flex-wrap gap-2" onSubmit={submitSearch}>
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search title or excerpt…"
          className="sm:max-w-sm"
          aria-label="Search posts"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q ? "No matches" : "No posts yet"}
          description={q ? "Try a different search." : "Create your first blog post."}
          action={
            !q ? (
              <Button type="button" asChild>
                <Link to="/admin/blog/new">
                  <Plus strokeWidth={1.5} />
                  New post
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((post) => {
                  const thumb = mediaUrl(post.coverImageUrl);
                  return (
                  <TableRow key={post.id} className={cn(!post.isPublished && "opacity-80")}>
                    <TableCell>
                      <div className="flex min-w-0 items-start gap-3">
                        <Link
                          to={`/admin/blog/${post.id}`}
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                          aria-label={`Edit ${post.title}`}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </Link>
                        <div className="min-w-0">
                          <Link
                            to={`/admin/blog/${post.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {post.title}
                          </Link>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {post.excerpt}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.isPublished ? "success" : "muted"}>
                        {post.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLagosDate(post.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions for ${post.title}`}
                            disabled={busyId === post.id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/blog/${post.id}`}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void togglePublish(post)}>
                            {post.isPublished ? "Unpublish" : "Publish"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void removePost(post)}
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

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
