import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import { Button } from "./ui/button";
import { ErrorBanner } from "./ui/error-banner";
import { Skeleton } from "./ui/skeleton";
import { useAdminApi } from "../lib/adminApi";
import type { GalleryImage } from "../lib/types";
import { useQuery } from "../lib/useQuery";
import { errorMessage } from "../../lib/api";
import { hasDeskPermission } from "../lib/permissions";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";

const MAX_BYTES = 15 * 1024 * 1024;
const PAGE_SIZE = 16;
const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type SelectedServiceMedia = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  alt: string;
};

type Props = {
  enabled: boolean;
  value: SelectedServiceMedia | null;
  onChange: (next: SelectedServiceMedia | null) => void;
  previewAlt?: string;
  hidePreview?: boolean;
  previewOnly?: boolean;
  className?: string;
};

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

function toSelected(image: Pick<GalleryImage, "id" | "url" | "thumbUrl" | "alt">): SelectedServiceMedia {
  return {
    id: image.id,
    url: image.url,
    thumbUrl: image.thumbUrl,
    alt: image.alt,
  };
}

export function ServiceMediaPicker({
  enabled,
  value,
  onChange,
  previewAlt,
  hidePreview = false,
  previewOnly = false,
  className,
}: Props) {
  const api = useAdminApi();
  const { user } = useAuth();
  const canLibrary = hasDeskPermission(user, "gallery");
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const query = useQuery(
    () => api.gallery.list({ isActive: true, page, pageSize: PAGE_SIZE }),
    [enabled, page],
    { enabled: enabled && canLibrary && !previewOnly },
  );

  const images = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const uploadFile = useCallback(
    async (file: File) => {
      if (!isAllowedImage(file)) {
        setUploadError("Only JPEG, PNG, or WebP images are allowed");
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadError("Each file must be 15 MB or smaller");
        return;
      }
      const form = new FormData();
      form.append("kind", "CONTENT");
      form.append("files", file);
      setUploadError(null);
      setProgress(0);
      try {
        const rows = await api.gallery.upload(form, setProgress);
        const uploaded = rows[0];
        if (uploaded) {
          onChange(toSelected(uploaded));
          setPage(1);
          await query.refetch();
        }
      } catch (err) {
        setUploadError(errorMessage(err));
      } finally {
        setProgress(null);
      }
    },
    [api, onChange, query],
  );

  if (previewOnly) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Service Thumbnail</h4>
            <p className="text-xs text-muted-foreground">Active cover image for this service.</p>
          </div>
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>

        {value ? (
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">
            <img
              src={value.thumbUrl || value.url}
              alt={value.alt || previewAlt || "Selected service image"}
              className="aspect-[16/10] w-full object-cover object-top"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/10] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground">
            <span>No thumbnail selected</span>
            <span className="mt-1 text-[11px] text-muted-foreground/70">Pick a photo from the gallery</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {!hidePreview ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Image</p>
              <p className="text-xs text-muted-foreground">Optional. Choose from the Media Library or upload there, then select.</p>
            </div>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            ) : null}
          </div>

          {value ? (
            <div className="overflow-hidden rounded-md border border-border bg-muted/40">
              <img
                src={value.thumbUrl || value.url}
                alt={value.alt || previewAlt || "Selected service image"}
                className="max-h-48 w-full object-cover object-top"
              />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              No image selected
            </div>
          )}
        </>
      ) : null}

      {canLibrary ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={progress != null}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload to library
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadFile(file);
                  event.target.value = "";
                }}
              />
            </div>
            {progress != null ? <span className="text-xs text-muted-foreground">Uploading {progress}%</span> : null}
          </div>
          {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
          <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />
          {query.loading ? (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-md" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active images in the library yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-6 p-0.5">
                {images.map((image) => {
                  const selected = value?.id === image.id;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      className={cn(
                        "group relative overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all cursor-pointer",
                        selected ? "border-primary ring-2 ring-primary/60 shadow-xs" : "border-border/80 hover:border-primary/40",
                      )}
                      onClick={() => onChange(toSelected(image))}
                      aria-pressed={selected}
                      aria-label={image.alt || image.filename || "Select image"}
                    >
                      <img src={image.thumbUrl || image.url} alt="" className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    </button>
                  );
                })}
              </div>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                  <p className="text-[11px] text-muted-foreground">
                    Page {page} of {pageCount}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={page <= 1 || query.fetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={page >= pageCount || query.fetching}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Media Library access is required to browse or upload images. You can still remove the current image.
        </p>
      )}
    </div>
  );
}
