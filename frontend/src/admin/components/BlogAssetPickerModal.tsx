import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Link as LinkIcon,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAdminApi } from "../lib/adminApi";
import { useQuery } from "../lib/useQuery";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/publicApi";

const MAX_BYTES = 15 * 1024 * 1024;
const PAGE_SIZE = 20;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  title?: string;
  description?: string;
  currentUrl?: string;
};

export function BlogAssetPickerModal({
  open,
  onOpenChange,
  onSelect,
  title = "Select Media Asset",
  description = "Choose an image from the media library or upload a new asset.",
  currentUrl,
}: Props) {
  const api = useAdminApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<string>("library");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState(currentUrl || "");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  useEffect(() => {
    if (open) {
      setPage(1);
      setSearch("");
      setDebouncedQ("");
      setManualUrl(currentUrl || "");
    }
  }, [open, currentUrl]);

  const galleryQuery = useQuery(
    () =>
      api.gallery.list({
        isActive: true,
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedQ ? { q: debouncedQ } : {}),
      }),
    [open, page, debouncedQ],
    { enabled: open },
  );

  const images = galleryQuery.data?.items ?? [];
  const total = galleryQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onFileUpload = useCallback(
    async (file: File) => {
      const type = file.type.toLowerCase();
      const valid =
        type === "image/jpeg" ||
        type === "image/png" ||
        type === "image/webp" ||
        /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!valid) {
        setUploadError("Only JPEG, PNG, or WebP images are allowed.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadError("Image file size must be 15 MB or smaller.");
        return;
      }

      setUploadError(null);
      setUploadProgress(0);
      try {
        const formData = new FormData();
        formData.append("kind", "CONTENT");
        formData.append("files", file);

        const uploadedList = await api.gallery.upload(formData, setUploadProgress);
        const first = uploadedList[0];
        if (first?.url) {
          onSelect(first.url);
          onOpenChange(false);
        }
      } catch (err) {
        setUploadError(errorMessage(err, "Failed to upload image"));
      } finally {
        setUploadProgress(null);
      }
    },
    [api, onOpenChange, onSelect],
  );

  function handleSelect(url: string) {
    onSelect(url);
    onOpenChange(false);
  }

  function handleManualSubmit() {
    if (manualUrl.trim()) {
      handleSelect(manualUrl.trim());
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <ImageIcon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="library" className="text-xs">
              Media Library
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              Upload New
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs">
              Direct URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search assets by caption or category…"
                  className="pl-8 text-xs h-8"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                onClick={() => void galleryQuery.refetch()}
                disabled={galleryQuery.loading}
                title="Refresh library"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", galleryQuery.loading && "animate-spin")} />
              </Button>
            </div>

            <div className="max-h-[340px] overflow-y-auto pr-1">
              {galleryQuery.loading ? (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : images.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No media assets found</p>
                  <p className="text-xs text-muted-foreground/75 mt-0.5">
                    {debouncedQ ? "Try a different search term" : "Upload an image in the Upload tab"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                  {images.map((image) => {
                    const isSelected = currentUrl === image.url;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => handleSelect(image.url)}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-lg border text-left transition-all hover:ring-2 hover:ring-primary focus:outline-none",
                          isSelected
                            ? "border-primary ring-2 ring-primary"
                            : "border-border hover:border-transparent",
                        )}
                      >
                        <img
                          src={mediaUrl(image.thumbUrl || image.url)}
                          alt={image.alt || "Asset thumbnail"}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 truncate bg-gradient-to-t from-black/80 to-transparent p-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {image.alt || image.category || "Media"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {total > 0 ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Page {page} of {pageCount}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page <= 1 || galleryQuery.fetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page >= pageCount || galleryQuery.fetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 pt-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFileUpload(file);
                }}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">Click to select image</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP up to 15 MB</p>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1.5 rounded-lg border border-border p-3 bg-card">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">Uploading image…</span>
                  <span className="text-muted-foreground">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {uploadError}
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">External or Direct Image URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg or /gallery/photo.webp"
                    className="pl-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleManualSubmit}
                  disabled={!manualUrl.trim()}
                >
                  Use URL
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paste a public image link or relative path.
              </p>
            </div>

            {manualUrl.trim() && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Image Preview</p>
                <div className="relative h-40 max-w-sm overflow-hidden rounded-lg border border-border bg-muted/20">
                  <img
                    src={mediaUrl(manualUrl.trim())}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
