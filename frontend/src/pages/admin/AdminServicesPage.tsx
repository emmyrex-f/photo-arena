import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { useModal } from "../../admin/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { Pagination } from "../../admin/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
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
import { CreateBookingDialog } from "../../components/admin/CreateBookingDialog";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatLagosDate,
  formatNairaFromKobo,
  koboToNairaInput,
  nairaInputToKobo,
  slugify,
} from "../../admin/lib/format";
import {
  SERVICE_KINDS,
  type Package,
  type PricingRule,
  type Service,
  type ServiceKind,
} from "../../admin/lib/types";
import { ApiError, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDuration } from "../../lib/datetime";
import { serviceHeroSrc } from "../../data/serviceMedia";

type TabKey = "packages" | "description" | "settings";

type PackageForm = {
  id: string | null;
  outfitCount: string;
  backdropCount: string;
  editedPhotoCount: string;
  durationMinutes: string;
  priceNaira: string;
  isActive: boolean;
};

type ServiceForm = {
  name: string;
  summary: string;
  description: string;
  kind: ServiceKind;
  isActive: boolean;
  media: SelectedServiceMedia | null;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480];
const COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 20, 24, 30];
const PACKAGES_PAGE_SIZE = 7;

/** Display-only mirror of PricingService for ONLINE — never used to charge. */
function onlinePriceKobo(studioKobo: number, discountBps: number): number {
  if (discountBps <= 0) return studioKobo;
  return Math.floor((studioKobo * (10_000 - discountBps)) / 10_000);
}

function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

function packageLabel(pkg: Package): string {
  if (pkg.outfitCount != null && pkg.outfitCount > 0) {
    return `${pkg.outfitCount} Outfit${pkg.outfitCount === 1 ? "" : "s"}`;
  }
  return pkg.name;
}

function durationLabel(minutes: number): string {
  return `${minutes} min${minutes === 1 ? "" : "s"}`;
}

/** Display mirror of the backend rule — rentals, booths and backdrops are hired by time. */
function usesOutfits(kind: ServiceKind): boolean {
  return kind === "SESSION" || kind === "SET";
}

function kindLabel(kind: ServiceKind): string {
  switch (kind) {
    case "SESSION":
      return "Photography";
    case "SET":
      return "Set hire";
    case "BOOTH":
      return "Booth";
    case "BACKDROP":
      return "Backdrop";
    case "RENTAL":
      return "Rental";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function emptyPackageForm(): PackageForm {
  return {
    id: null,
    outfitCount: "1",
    backdropCount: "1",
    editedPhotoCount: "3",
    durationMinutes: "15",
    priceNaira: "20000",
    isActive: true,
  };
}

function formFromPackage(pkg: Package): PackageForm {
  return {
    id: pkg.id,
    outfitCount: String(pkg.outfitCount ?? 1),
    backdropCount: String(pkg.backdropCount ?? 0),
    editedPhotoCount: String(pkg.editedPhotoCount ?? 0),
    durationMinutes: String(pkg.durationMinutes),
    priceNaira: koboToNairaInput(pkg.priceKobo),
    isActive: pkg.isActive,
  };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function AdminServicesPage() {
  const api = useAdminApi();
  const modal = useModal();
  const [params, setParams] = useSearchParams();

  const selectedId = params.get("id");
  const tab = (params.get("tab") as TabKey | null) || "packages";

  const [services, setServices] = useState<Service[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [packageForm, setPackageForm] = useState<PackageForm | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm | null>(null);
  const [creatingService, setCreatingService] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [newService, setNewService] = useState<{
    name: string;
    summary: string;
    description: string;
    kind: ServiceKind;
    startingPriceNaira: string;
    media: SelectedServiceMedia | null;
  }>({
    name: "",
    summary: "",
    description: "",
    kind: "SESSION",
    startingPriceNaira: "20000",
    media: null,
  });

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, rules] = await Promise.all([
        api.services.list(),
        api.pricingRules.list().catch(() => [] as PricingRule[]),
      ]);
      setServices(list);
      setPricingRules(rules);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => {
    if (!services.length) return null;
    if (selectedId) return services.find((s) => s.id === selectedId) ?? services[0] ?? null;
    return services[0] ?? null;
  }, [services, selectedId]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setParam({ id: selected.id });
  }, [selected, selectedId, setParam]);

  // Clean up any legacy pkg param from URL
  useEffect(() => {
    if (params.has("pkg")) {
      setParam({ pkg: null });
    }
  }, [params, setParam]);

  useEffect(() => {
    if (!selected) {
      setServiceForm(null);
      return;
    }
    setServiceForm({
      name: selected.name,
      summary: selected.summary ?? "",
      description: selected.description,
      kind: selected.kind,
      isActive: selected.isActive,
      media: selected.media
        ? {
            id: selected.media.id,
            url: selected.media.url,
            thumbUrl: selected.media.thumbUrl,
            alt: selected.media.alt,
          }
        : null,
    });
  }, [selected]);

  const onlineDiscountBps = useMemo(() => {
    const rule = pricingRules.find((r) => r.key === "ONLINE_DISCOUNT" && r.isActive);
    return rule?.bps ?? 500;
  }, [pricingRules]);

  const packages = useMemo(
    () => [...(selected?.packages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selected],
  );

  const [packagesPage, setPackagesPage] = useState(1);

  useEffect(() => {
    setPackageForm(null);
    setPackagesPage(1);
  }, [selected?.id]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(packages.length / PACKAGES_PAGE_SIZE));
    if (packagesPage > totalPages) {
      setPackagesPage(totalPages);
    }
  }, [packages.length, packagesPage]);

  const paginatedPackages = useMemo(() => {
    const start = (packagesPage - 1) * PACKAGES_PAGE_SIZE;
    return packages.slice(start, start + PACKAGES_PAGE_SIZE);
  }, [packages, packagesPage]);

  const lowestStudioKobo = useMemo(() => {
    const active = packages.filter((p) => p.isActive);
    if (!active.length) return selected?.startingPriceKobo ?? 0;
    return Math.min(...active.map((p) => p.priceKobo));
  }, [packages, selected]);

  async function refreshKeepSelection() {
    const id = selected?.id;
    await load();
    if (id) setParam({ id });
  }

  async function toggleServiceActive(service: Service, next: boolean) {
    setSaving(true);
    try {
      await api.services.update(service.id, { isActive: next });
      toast.success(next ? "Service activated" : "Service deactivated");
      await refreshKeepSelection();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePackageActive(pkg: Package, next: boolean) {
    setSaving(true);
    try {
      await api.services.updatePackage(pkg.id, { isActive: next });
      toast.success(next ? "Package activated" : "Package deactivated");
      await refreshKeepSelection();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deletePackage(pkg: Package) {
    const ok = await modal.confirm({
      title: "Delete Package",
      description: `Are you sure you want to delete package “${packageLabel(pkg)}”?`,
      confirmLabel: "Delete package",
      destructive: true,
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api.services.removePackage(pkg.id);
      toast.success("Package removed");
      if (packageForm?.id === pkg.id) {
        setPackageForm(null);
      }
      await refreshKeepSelection();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(service: Service) {
    const ok = await modal.confirm({
      title: "Delete Service",
      description: `Are you sure you want to delete service “${service.name}” and all associated packages?`,
      confirmLabel: "Delete service",
      destructive: true,
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api.services.remove(service.id);
      toast.success("Service removed");
      setPackageForm(null);
      setParam({ id: null, tab: null });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function savePackage(e: FormEvent) {
    e.preventDefault();
    if (!selected || !packageForm) return;
    const priceKobo = nairaInputToKobo(packageForm.priceNaira);
    if (priceKobo == null || priceKobo < 0) {
      toast.error("Enter a valid studio price in naira");
      return;
    }
    const durationMinutes = Number(packageForm.durationMinutes);
    const outfitCount = usesOutfits(selected.kind) ? Number(packageForm.outfitCount) : NaN;
    const backdropCount = Number(packageForm.backdropCount);
    const editedPhotoCount = Number(packageForm.editedPhotoCount);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      toast.error("Duration must be at least 15 minutes");
      return;
    }
    const name =
      Number.isFinite(outfitCount) && outfitCount > 0
        ? `${outfitCount} Outfit${outfitCount === 1 ? "" : "s"}`
        : formatDuration(durationMinutes);
    const includes = [
      Number.isFinite(outfitCount) && outfitCount > 0
        ? `${outfitCount} outfit${outfitCount === 1 ? "" : "s"}`
        : null,
      Number.isFinite(backdropCount) && backdropCount > 0
        ? `${backdropCount} backdrop${backdropCount === 1 ? "" : "s"}`
        : null,
      Number.isFinite(editedPhotoCount) && editedPhotoCount > 0
        ? `${editedPhotoCount} photo${editedPhotoCount === 1 ? "" : "s"}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    setSaving(true);
    try {
      const body = {
        name,
        durationMinutes,
        outfitCount: Number.isFinite(outfitCount) ? outfitCount : null,
        backdropCount: Number.isFinite(backdropCount) ? backdropCount : null,
        editedPhotoCount: Number.isFinite(editedPhotoCount) ? editedPhotoCount : null,
        includes,
        priceKobo,
        isActive: packageForm.isActive,
      };
      if (packageForm.id) {
        await api.services.updatePackage(packageForm.id, body);
        toast.success("Package updated");
      } else {
        await api.services.createPackage(selected.id, body);
        toast.success("Package created");
      }
      setPackageForm(null);
      await refreshKeepSelection();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveServiceDetails(e: FormEvent) {
    e.preventDefault();
    if (!selected || !serviceForm) return;
    setSaving(true);
    try {
      await api.services.update(selected.id, {
        name: serviceForm.name.trim(),
        summary: serviceForm.summary.trim() || null,
        description: serviceForm.description.trim(),
        kind: serviceForm.kind,
        isActive: serviceForm.isActive,
        mediaId: serviceForm.media?.id ?? null,
        startingPriceKobo: lowestStudioKobo || selected.startingPriceKobo,
      });
      toast.success("Service saved");
      await refreshKeepSelection();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createService(e: FormEvent) {
    e.preventDefault();
    const startingPriceKobo = nairaInputToKobo(newService.startingPriceNaira);
    if (!newService.name.trim() || !newService.description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    if (startingPriceKobo == null) {
      toast.error("Enter a starting price");
      return;
    }
    setSaving(true);
    try {
      const created = await api.services.create({
        name: newService.name.trim(),
        slug: slugify(newService.name),
        kind: newService.kind,
        summary: newService.summary.trim() || undefined,
        description: newService.description.trim(),
        startingPriceKobo,
        isActive: true,
        mediaId: newService.media?.id ?? null,
      });
      toast.success("Service created");
      setCreatingService(false);
      setNewService({
        name: "",
        summary: "",
        description: "",
        kind: "SESSION",
        startingPriceNaira: "20000",
        media: null,
      });
      await load();
      setParam({ id: created.id, tab: "packages" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const [approving, setApproving] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  const anyProvisionalInCatalog = useMemo(
    () => services.some((s) => s.isProvisional || s.packages?.some((p) => p.isProvisional)),
    [services],
  );

  async function onApproveServicePricing(serviceId: string) {
    setApproving(true);
    try {
      const updated = await api.services.approvePricing(serviceId);
      setServices((prev) => prev.map((s) => (s.id === serviceId ? updated : s)));
      toast.success("Final pricing confirmed for this service and its packages");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to confirm pricing"));
    } finally {
      setApproving(false);
    }
  }

  async function onApproveAllPricing() {
    setApprovingAll(true);
    try {
      await api.services.approveAllPricing();
      await load();
      toast.success("All catalog services and packages confirmed as final pricing");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to confirm catalog pricing"));
    } finally {
      setApprovingAll(false);
    }
  }

  return (
    <div className="pa-services space-y-admin-stack">
      {anyProvisionalInCatalog && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 sm:flex-row sm:items-center sm:justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Catalog Prices are Provisional:</strong> Seed or newly imported packages are marked as provisional. You can confirm all prices for public launch with one click.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs shrink-0"
            disabled={approvingAll}
            onClick={() => void onApproveAllPricing()}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {approvingAll ? "Confirming…" : "Confirm All Catalog Pricing"}
          </Button>
        </div>
      )}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Services &amp; Packages
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your photography services, package options, pricing and availability.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setCreatingService(true)}>
            <Plus strokeWidth={1.5} />
            Add Service
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      {creatingService ? (
        <Card className="overflow-hidden border-border shadow-md animate-in fade-in-0 duration-200">
          <CardHeader className="border-b border-border bg-muted/20 p-admin-card-sm">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-xl font-normal">New Service</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Create a new photography service or studio session category with custom details and thumbnail.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreatingService(false)}
                className="text-muted-foreground"
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-admin-card-sm sm:p-admin-card">
            <form onSubmit={(e) => void createService(e)}>
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Left Column: Core Service Details */}
                <div className="space-y-4 lg:col-span-7">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-service-name">Service Name</Label>
                    <Input
                      id="new-service-name"
                      value={newService.name}
                      onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                      placeholder="e.g. Personal / Birthday Shoots"
                      required
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Category Type</Label>
                      <Select
                        value={newService.kind}
                        onValueChange={(v) =>
                          setNewService((s) => ({ ...s, kind: v as ServiceKind }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_KINDS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {kindLabel(k)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-service-price">Starting price (₦)</Label>
                      <Input
                        id="new-service-price"
                        inputMode="numeric"
                        value={newService.startingPriceNaira}
                        onChange={(e) =>
                          setNewService((s) => ({ ...s, startingPriceNaira: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-service-summary">Summary / Tagline</Label>
                    <Input
                      id="new-service-summary"
                      value={newService.summary}
                      onChange={(e) => setNewService((s) => ({ ...s, summary: e.target.value }))}
                      placeholder="Short card copy shown in previews"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-service-description">Full Description</Label>
                    <Textarea
                      id="new-service-description"
                      rows={4}
                      value={newService.description}
                      onChange={(e) =>
                        setNewService((s) => ({ ...s, description: e.target.value }))
                      }
                      placeholder="Detailed overview of what clients get in this shoot category..."
                      required
                    />
                  </div>
                </div>

                {/* Right Column: Thumbnail Media & File Picker */}
                <div className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-5">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Service Thumbnail</h4>
                    <p className="text-xs text-muted-foreground">
                      Upload a new photo or select an existing image from your media library.
                    </p>
                  </div>
                  <ServiceMediaPicker
                    enabled={creatingService}
                    value={newService.media}
                    onChange={(next) => setNewService((s) => ({ ...s, media: next }))}
                    previewAlt={newService.name || "New service thumbnail"}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreatingService(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Create Service
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-admin-stack lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_18rem] items-start">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border p-admin-card-sm">
            <CardTitle className="text-sm font-medium">All Services</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : services.length === 0 ? (
              <EmptyState
                compact
                className="border-0 bg-transparent"
                title="No services"
                description="Create your first service to manage packages."
              />
            ) : (
              services.map((service) => {
                const active = service.id === selected?.id;
                const count = service.packages?.length ?? 0;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setParam({ id: service.id, tab: "packages" })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-muted/40",
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {serviceHeroSrc(service) ? (
                        <img
                          src={serviceHeroSrc(service)}
                          alt=""
                          className="h-full w-full object-cover object-top"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{service.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {count} package{count === 1 ? "" : "s"}
                        {!service.isActive ? " · Inactive" : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {loading && !selected ? (
            <Skeleton className="h-40 w-full" />
          ) : !selected ? (
            <EmptyState
              title="Select a service"
              description="Choose a service from the list or add a new one."
            />
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted border border-border/40">
                      {serviceHeroSrc(selected) ? (
                        <img
                          src={serviceHeroSrc(selected)}
                          alt=""
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl font-normal leading-tight text-foreground">
                          {selected.name}
                        </h2>
                        <ActiveBadge active={selected.isActive} />
                        {selected.isProvisional ? (
                          <Badge variant="warning">Provisional</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {selected.summary ||
                          `${selected.description.slice(0, 120)}${
                            selected.description.length > 120 ? "…" : ""
                          }`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                    {selected.isProvisional || selected.packages?.some((p) => p.isProvisional) ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
                        disabled={approving}
                        onClick={() => void onApproveServicePricing(selected.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {approving ? "Confirming…" : "Confirm Final Pricing"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setParam({ tab: "settings" })}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit Service
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div
                role="tablist"
                aria-label="Service sections"
                className="flex flex-wrap items-center gap-1 border-b border-border"
              >
                {(
                  [
                    ["packages", "Packages"],
                    ["description", "Description"],
                    ["settings", "Settings"],
                  ] as const
                ).map(([key, label]) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        "relative px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() =>
                        setParam({
                          tab: key,
                        })
                      }
                    >
                      {label}
                      {active ? (
                        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {tab === "packages" ? (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-admin-card-sm py-3">
                    <div>
                      <p className="text-sm font-medium">Package Options</p>
                      <p className="text-xs text-muted-foreground">
                        Studio prices only — online is {percentFromBps(onlineDiscountBps)} off
                        (server).
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setPackageForm(emptyPackageForm())}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Package
                    </Button>
                  </div>
                  <CardContent className="p-0">
                    {packages.length === 0 ? (
                      <EmptyState
                        compact
                        className="m-admin-card-sm border-0 bg-transparent"
                        title="No packages"
                        description="Add outfit / duration options for this service."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Outfit</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead className="hidden sm:table-cell">Backdrops</TableHead>
                              <TableHead className="hidden md:table-cell">Photos</TableHead>
                              <TableHead>Studio Price</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedPackages.map((pkg) => (
                              <TableRow
                                key={pkg.id}
                                className={cn(packageForm?.id === pkg.id && "bg-muted/40")}
                              >
                                <TableCell className="font-medium">{packageLabel(pkg)}</TableCell>
                                <TableCell>{durationLabel(pkg.durationMinutes)}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  {pkg.backdropCount ?? "—"}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {pkg.editedPhotoCount ?? "—"}
                                </TableCell>
                                <TableCell className="font-medium tabular-nums">
                                  {formatNairaFromKobo(pkg.priceKobo)}
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={pkg.isActive}
                                    disabled={saving}
                                    aria-label={`Toggle ${packageLabel(pkg)}`}
                                    onCheckedChange={(v) => void togglePackageActive(pkg, v)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Edit ${packageLabel(pkg)}`}
                                      onClick={() => setPackageForm(formFromPackage(pkg))}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Delete ${packageLabel(pkg)}`}
                                      onClick={() => void deletePackage(pkg)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {packages.length > PACKAGES_PAGE_SIZE ? (
                      <div className="border-t border-border px-admin-card-sm py-3">
                        <Pagination
                          page={packagesPage}
                          pageSize={PACKAGES_PAGE_SIZE}
                          total={packages.length}
                          onPageChange={setPackagesPage}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}



              {tab === "description" && serviceForm ? (
                <Card>
                  <CardHeader className="p-admin-card-sm">
                    <CardTitle className="font-display text-lg font-normal">Description</CardTitle>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm pt-0">
                    <form className="space-y-3" onSubmit={(e) => void saveServiceDetails(e)}>
                      <div className="space-y-1.5">
                        <Label htmlFor="svc-summary">Summary</Label>
                        <Input
                          id="svc-summary"
                          value={serviceForm.summary}
                          onChange={(e) =>
                            setServiceForm((f) => (f ? { ...f, summary: e.target.value } : f))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="svc-description">Full description</Label>
                        <Textarea
                          id="svc-description"
                          rows={8}
                          value={serviceForm.description}
                          onChange={(e) =>
                            setServiceForm((f) => (f ? { ...f, description: e.target.value } : f))
                          }
                        />
                      </div>
                      <Button type="submit" loading={saving}>
                        Save Description
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}



              {tab === "settings" && serviceForm ? (
                <Card>
                  <CardHeader className="p-admin-card-sm">
                    <CardTitle className="font-display text-lg font-normal">Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm pt-0">
                    <form
                      className="space-y-6"
                      onSubmit={(e) => void saveServiceDetails(e)}
                    >
                      <div className="grid gap-6 lg:grid-cols-12 items-start">
                        {/* Left Column: Details + Media Library Gallery */}
                        <div className="space-y-6 lg:col-span-7">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="space-y-1.5 sm:col-span-5">
                              <Label htmlFor="svc-name">Name</Label>
                              <Input
                                id="svc-name"
                                value={serviceForm.name}
                                onChange={(e) =>
                                  setServiceForm((f) => (f ? { ...f, name: e.target.value } : f))
                                }
                                required
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-4">
                              <Label>Type</Label>
                              <Select
                                value={serviceForm.kind}
                                onValueChange={(v) =>
                                  setServiceForm((f) => (f ? { ...f, kind: v as ServiceKind } : f))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SERVICE_KINDS.map((k) => (
                                    <SelectItem key={k} value={k}>
                                      {kindLabel(k)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-3">
                              <div className="flex h-9 items-center justify-between gap-2.5 rounded-lg border border-border px-3 py-1.5 bg-muted/20">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium leading-none">Active</p>
                                  <p className="text-[10px] text-muted-foreground truncate">Visible for booking</p>
                                </div>
                                <Switch
                                  checked={serviceForm.isActive}
                                  onCheckedChange={(v) =>
                                    setServiceForm((f) => (f ? { ...f, isActive: v } : f))
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Gallery Picker moved to the left */}
                          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">Media Library</h4>
                              <p className="text-xs text-muted-foreground">
                                Choose an image from the library or upload a new photo.
                              </p>
                            </div>
                            <ServiceMediaPicker
                              enabled={true}
                              value={serviceForm.media}
                              onChange={(next) =>
                                setServiceForm((f) => (f ? { ...f, media: next } : f))
                              }
                              hidePreview={true}
                            />
                          </div>
                        </div>

                        {/* Right Column: Service Thumbnail Preview */}
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-5 sticky top-4">
                          <ServiceMediaPicker
                            enabled={true}
                            value={serviceForm.media}
                            onChange={(next) =>
                              setServiceForm((f) => (f ? { ...f, media: next } : f))
                            }
                            previewAlt={serviceForm.name || selected.name}
                            previewOnly={true}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <Button type="submit" loading={saving}>
                          Save Settings
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => void deleteService(selected)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Service
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {selected ? (
            <>
              <Card className="overflow-hidden">
                <div className="relative aspect-[4/3] bg-muted">
                  {serviceHeroSrc(selected) ? (
                    <img src={serviceHeroSrc(selected)} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="font-display text-lg text-white">{selected.name}</p>
                    <p className="text-sm text-white/80">
                      From {formatNairaFromKobo(lowestStudioKobo)}
                    </p>
                  </div>
                </div>
                <CardContent className="space-y-3 p-admin-card-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Service Preview
                  </p>
                  <ul className="space-y-1.5">
                    {packages
                      .filter((p) => p.isActive)
                      .slice(0, 4)
                      .map((pkg) => (
                        <li
                          key={pkg.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate text-muted-foreground">
                            {packageLabel(pkg)} · {durationLabel(pkg.durationMinutes)}
                          </span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {formatNairaFromKobo(pkg.priceKobo)}
                          </span>
                        </li>
                      ))}
                    {!packages.some((p) => p.isActive) ? (
                      <li className="text-sm text-muted-foreground">No active packages</li>
                    ) : null}
                  </ul>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => setBookModalOpen(true)}
                  >
                    Book Now
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-admin-card-sm pb-2">
                  <CardTitle className="text-sm font-medium">Service Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-admin-card-sm pt-0 text-sm">
                  <InfoRow label="Service Type" value={kindLabel(selected.kind)} />
                  <InfoRow label="Status" value={selected.isActive ? "Active" : "Inactive"} />
                  <InfoRow
                    label="Created"
                    value={selected.createdAt ? formatLagosDate(selected.createdAt) : "—"}
                  />
                  <InfoRow
                    label="Last Updated"
                    value={selected.updatedAt ? formatLagosDate(selected.updatedAt) : "—"}
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Visibility</span>
                    <Switch
                      checked={selected.isActive}
                      disabled={saving}
                      aria-label="Toggle service active"
                      onCheckedChange={(v) => void toggleServiceActive(selected, v)}
                    />
                  </div>
                </CardContent>
              </Card>

            </>
          ) : null}
        </div>
      </div>

      {selected ? (
        <CreateBookingDialog
          open={bookModalOpen}
          onOpenChange={setBookModalOpen}
          defaultServiceId={selected.id}
          defaultPackageId={packages.find((p) => p.isActive)?.id}
          onSuccess={() => {
            toast.success("Booking created successfully!");
          }}
        />
      ) : null}
      {/* Edit / Add Package Dialog */}
      <Dialog
        open={Boolean(packageForm)}
        onOpenChange={(open) => {
          if (!open) {
            setPackageForm(null);
          }
        }}
      >
        <DialogContent
          className="max-w-xl sm:max-w-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {packageForm ? (
            <form onSubmit={(e) => void savePackage(e)} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {packageForm.id ? "Edit Package" : "Add Package"}
                </DialogTitle>
                <DialogDescription>
                  Online price is calculated automatically ({percentFromBps(onlineDiscountBps)} off) by the system. Do not enter it here.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2 py-2">
                {selected && usesOutfits(selected.kind) ? (
                <div className="space-y-1.5">
                  <Label>Outfit Count</Label>
                  <Select
                    value={packageForm.outfitCount}
                    onValueChange={(v) =>
                      setPackageForm((f) => (f ? { ...f, outfitCount: v } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNT_OPTIONS.filter((n) => n >= 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="pkg-price">Studio Price (₦)</Label>
                  <Input
                    id="pkg-price"
                    inputMode="numeric"
                    value={packageForm.priceNaira}
                    onChange={(e) =>
                      setPackageForm((f) => (f ? { ...f, priceNaira: e.target.value } : f))
                    }
                    required
                  />
                  {nairaInputToKobo(packageForm.priceNaira) != null ? (
                    <p className="text-[11px] text-muted-foreground">
                      Online preview:{" "}
                      {formatNairaFromKobo(
                        onlinePriceKobo(
                          nairaInputToKobo(packageForm.priceNaira)!,
                          onlineDiscountBps,
                        ),
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Select
                    value={packageForm.durationMinutes}
                    onValueChange={(v) =>
                      setPackageForm((f) => (f ? { ...f, durationMinutes: v } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {formatDuration(n)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={packageForm.isActive ? "active" : "inactive"}
                    onValueChange={(v) =>
                      setPackageForm((f) => (f ? { ...f, isActive: v === "active" } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Backdrop Count</Label>
                  <Select
                    value={packageForm.backdropCount}
                    onValueChange={(v) =>
                      setPackageForm((f) => (f ? { ...f, backdropCount: v } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Edited Photo Count</Label>
                  <Select
                    value={packageForm.editedPhotoCount}
                    onValueChange={(v) =>
                      setPackageForm((f) => (f ? { ...f, editedPhotoCount: v } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNT_OPTIONS.filter((n) => n >= 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPackageForm(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
