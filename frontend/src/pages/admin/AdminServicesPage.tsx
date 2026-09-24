import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ExternalLink,
  ImageIcon,
  Package as PackageIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
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
import { ServiceMediaPicker } from "../../admin/components/ServiceMediaPicker";
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

type TabKey = "packages" | "description" | "media" | "settings";

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
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180];
const COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 20, 24, 30];

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
  const [params, setParams] = useSearchParams();

  const selectedId = params.get("id");
  const tab = (params.get("tab") as TabKey | null) || "packages";
  const editingPackageId = params.get("pkg");

  const [services, setServices] = useState<Service[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [packageForm, setPackageForm] = useState<PackageForm | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm | null>(null);
  const [creatingService, setCreatingService] = useState(false);
  const [newService, setNewService] = useState({
    name: "",
    summary: "",
    description: "",
    kind: "SESSION" as ServiceKind,
    startingPriceNaira: "20000",
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

  useEffect(() => {
    if (!selected) {
      setServiceForm(null);
      setPackageForm(null);
      return;
    }
    setServiceForm({
      name: selected.name,
      summary: selected.summary ?? "",
      description: selected.description,
      kind: selected.kind,
      isActive: selected.isActive,
    });
    if (editingPackageId === "new") {
      setPackageForm(emptyPackageForm());
      return;
    }
    if (editingPackageId) {
      const pkg = selected.packages?.find((p) => p.id === editingPackageId);
      setPackageForm(pkg ? formFromPackage(pkg) : null);
      return;
    }
    setPackageForm(null);
  }, [selected, editingPackageId]);

  const onlineDiscountBps = useMemo(() => {
    const rule = pricingRules.find((r) => r.key === "ONLINE_DISCOUNT" && r.isActive);
    return rule?.bps ?? 500;
  }, [pricingRules]);

  const packages = useMemo(
    () => [...(selected?.packages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selected],
  );

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
    if (!window.confirm(`Delete package “${packageLabel(pkg)}”?`)) return;
    setSaving(true);
    try {
      await api.services.removePackage(pkg.id);
      toast.success("Package removed");
      setParam({ pkg: null });
      await refreshKeepSelection();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(service: Service) {
    if (!window.confirm(`Delete service “${service.name}”?`)) return;
    setSaving(true);
    try {
      await api.services.remove(service.id);
      toast.success("Service removed");
      setParam({ id: null, pkg: null, tab: null });
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
    const outfitCount = Number(packageForm.outfitCount);
    const backdropCount = Number(packageForm.backdropCount);
    const editedPhotoCount = Number(packageForm.editedPhotoCount);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      toast.error("Duration must be at least 15 minutes");
      return;
    }
    const name =
      Number.isFinite(outfitCount) && outfitCount > 0
        ? `${outfitCount} Outfit${outfitCount === 1 ? "" : "s"}`
        : `${durationMinutes} min`;
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
      setParam({ pkg: null });
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
      });
      toast.success("Service created");
      setCreatingService(false);
      setNewService({
        name: "",
        summary: "",
        description: "",
        kind: "SESSION",
        startingPriceNaira: "20000",
      });
      await load();
      setParam({ id: created.id, tab: "packages", pkg: null });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pa-services space-y-admin-stack">
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
          <Button type="button" variant="outline" asChild>
            <Link to="/services" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              View Public Site
            </Link>
          </Button>
          <Button type="button" onClick={() => setCreatingService(true)}>
            <Plus strokeWidth={1.5} />
            Add Service
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} retrying={loading} />

      {creatingService ? (
        <Card>
          <CardHeader className="p-admin-card-sm">
            <CardTitle className="font-display text-lg font-normal">New Service</CardTitle>
          </CardHeader>
          <CardContent className="p-admin-card-sm pt-0">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void createService(e)}>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-service-name">Name</Label>
                <Input
                  id="new-service-name"
                  value={newService.name}
                  onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Personal / Birthday Shoots"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={newService.kind}
                  onValueChange={(v) => setNewService((s) => ({ ...s, kind: v as ServiceKind }))}
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-service-summary">Summary</Label>
                <Input
                  id="new-service-summary"
                  value={newService.summary}
                  onChange={(e) => setNewService((s) => ({ ...s, summary: e.target.value }))}
                  placeholder="Short card copy"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-service-description">Description</Label>
                <Textarea
                  id="new-service-description"
                  rows={3}
                  value={newService.description}
                  onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
                  required
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setCreatingService(false)}>
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

      <div className="grid gap-admin-stack xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
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
                    onClick={() => setParam({ id: service.id, pkg: null, tab: "packages" })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-muted/40",
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {service.media?.thumbUrl || service.media?.url ? (
                        <img
                          src={service.media.thumbUrl || service.media.url}
                          alt=""
                          className="h-full w-full object-cover"
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
                <CardContent className="flex flex-col gap-4 p-admin-card-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {selected.media?.thumbUrl || selected.media?.url ? (
                        <img
                          src={selected.media.thumbUrl || selected.media.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl font-normal leading-tight">
                          {selected.name}
                        </h2>
                        <ActiveBadge active={selected.isActive} />
                        {selected.isProvisional ? (
                          <Badge variant="warning">Provisional</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selected.summary ||
                          `${selected.description.slice(0, 120)}${
                            selected.description.length > 120 ? "…" : ""
                          }`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setParam({ tab: "settings", pkg: null })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Service
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div
                role="tablist"
                aria-label="Service sections"
                className="flex flex-wrap gap-1 border-b border-border"
              >
                {(
                  [
                    ["packages", "Packages"],
                    ["description", "Description"],
                    ["media", "Media"],
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
                          pkg: key === "packages" ? editingPackageId : null,
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
                      onClick={() => setParam({ pkg: "new", tab: "packages" })}
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
                            {packages.map((pkg) => (
                              <TableRow
                                key={pkg.id}
                                className={cn(editingPackageId === pkg.id && "bg-muted/40")}
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
                                      onClick={() => setParam({ pkg: pkg.id, tab: "packages" })}
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
                  </CardContent>
                </Card>
              ) : null}

              {tab === "packages" && packageForm ? (
                <Card>
                  <CardHeader className="p-admin-card-sm">
                    <CardTitle className="font-display text-lg font-normal">
                      {packageForm.id ? "Edit Package" : "Add Package"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Online price is calculated automatically (
                      {percentFromBps(onlineDiscountBps)} off) by the system. Do not enter it here.
                    </p>
                  </CardHeader>
                  <CardContent className="p-admin-card-sm pt-0">
                    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void savePackage(e)}>
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
                        <Label>Duration (minutes)</Label>
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
                                {n}
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
                      <div className="flex gap-2 sm:col-span-2">
                        <Button type="button" variant="outline" onClick={() => setParam({ pkg: null })}>
                          Cancel
                        </Button>
                        <Button type="submit" loading={saving}>
                          Save Changes
                        </Button>
                      </div>
                    </form>
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

              {tab === "media" ? (
                <Card>
                  <CardContent className="space-y-4 p-admin-card-sm">
                    <ServiceMediaPicker
                      enabled={tab === "media"}
                      value={
                        selected.media
                          ? {
                              id: selected.media.id,
                              url: selected.media.url,
                              thumbUrl: selected.media.thumbUrl,
                              alt: selected.media.alt,
                            }
                          : null
                      }
                      onChange={(next) => {
                        void (async () => {
                          setSaving(true);
                          try {
                            await api.services.update(selected.id, {
                              mediaId: next?.id ?? null,
                            });
                            toast.success(next ? "Media attached" : "Media removed");
                            await refreshKeepSelection();
                          } catch (err) {
                            toast.error(errorMessage(err));
                          } finally {
                            setSaving(false);
                          }
                        })();
                      }}
                      previewAlt={selected.name}
                    />
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
                      className="grid gap-3 sm:grid-cols-2"
                      onSubmit={(e) => void saveServiceDetails(e)}
                    >
                      <div className="space-y-1.5 sm:col-span-2">
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
                      <div className="space-y-1.5">
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
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Active</p>
                          <p className="text-xs text-muted-foreground">Visible for booking</p>
                        </div>
                        <Switch
                          checked={serviceForm.isActive}
                          onCheckedChange={(v) =>
                            setServiceForm((f) => (f ? { ...f, isActive: v } : f))
                          }
                        />
                      </div>
                      <div className="flex gap-2 sm:col-span-2">
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
                  {selected.media?.url ? (
                    <img src={selected.media.url} alt="" className="h-full w-full object-cover" />
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
                  <Button type="button" className="w-full" asChild>
                    <Link
                      to={`/book?service=${encodeURIComponent(selected.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Book Now
                    </Link>
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

              <Card>
                <CardHeader className="p-admin-card-sm pb-2">
                  <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-admin-card-sm pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setParam({ tab: "media", pkg: null })}
                  >
                    <PackageIcon className="h-4 w-4" />
                    Manage Media
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => void deleteService(selected)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Service
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
