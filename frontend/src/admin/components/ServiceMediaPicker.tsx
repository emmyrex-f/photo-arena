import { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
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

export function ServiceMediaPicker({ enabled, value, onChange, previewAlt }: Props) {
  const api = useAdminApi();
  const { user } = useAuth();
  const canLibrary = hasDeskPermission(user, "gallery");
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const query = useQuery(
    () => api.gallery.list({ isActive: true }),
    [enabled],
    { enabled: enabled && canLibrary },
  );

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
          query.setData((current) => (current ? [uploaded, ...current.filter((row) => row.id !== uploaded.id)] : [uploaded]));
        }
      } catch (err) {
        setUploadError(errorMessage(err));
      } finally {
        setProgress(null);
      }
    },
    [api, onChange, query],
  );

  return (
    <div className="space-y-3">
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

      {canLibrary ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={progress != null}>
              <Upload className="h-3.5 w-3.5" />
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
            {progress != null ? <span className="text-xs text-muted-foreground">Uploading {progress}%</span> : null}
          </div>
          {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
          <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />
          {query.loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : !(query.data?.length) ? (
            <p className="text-xs text-muted-foreground">No active images in the library yet.</p>
          ) : (
            <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {query.data.map((image) => {
                const selected = value?.id === image.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    className={cn(
                      "overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
                    )}
                    onClick={() => onChange(toSelected(image))}
                    aria-pressed={selected}
                    aria-label={image.alt || image.filename || "Select image"}
                  >
                    <img src={image.thumbUrl || image.url} alt="" className="aspect-square w-full object-cover" />
                  </button>
                );
              })}
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
