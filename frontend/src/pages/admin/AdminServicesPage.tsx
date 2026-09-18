import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
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
import { MoneyInput } from "../../admin/components/ui/money-input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { ActiveBadge } from "../../admin/components/ui/status-badge";
import { Switch } from "../../admin/components/ui/switch";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { ServiceMediaPicker, type SelectedServiceMedia } from "../../admin/components/ServiceMediaPicker";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatNairaFromKobo, humanize, slugify } from "../../admin/lib/format";
import type { Service, ServiceKind } from "../../admin/lib/types";
import { SERVICE_KINDS } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { canManageBookings, useAuth } from "../../lib/auth";

export function AdminServicesPage() {
  const api = useAdminApi();
  const { user } = useAuth();
  const manage = canManageBookings(user?.role);
  const servicesQuery = useQuery(() => api.services.list(), []);
  const rulesQuery = useQuery(() => api.pricingRules.list(), []);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState<Service | null>(null);
  const [editService, setEditService] = useState<Service | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<ServiceKind, Service[]>();
    for (const kind of SERVICE_KINDS) map.set(kind, []);
    for (const s of servicesQuery.data ?? []) {
      const list = map.get(s.kind) ?? [];
      list.push(s);
      map.set(s.kind, list);
    }
    return map;
  }, [servicesQuery.data]);

  async function reorderServices(ids: string[]) {
    try {
      await api.services.reorder(ids);
      toast.success("Order saved");
      await servicesQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function move(service: Service, dir: -1 | 1) {
    const all = [...(servicesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = all.findIndex((s) => s.id === service.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= all.length) return;
    const next = [...all];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    void reorderServices(next.map((s) => s.id));
  }

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Services"
        description="Packages grouped by kind, with studio pricing rules."
        actions={
          manage ? (
            <Button onClick={() => { setEditService(null); setServiceOpen(true); }}>
              <Plus />
              Add service
            </Button>
          ) : null
        }
      />
      <ErrorBanner
        message={servicesQuery.error || rulesQuery.error}
        onRetry={() => {
          void servicesQuery.refetch();
          void rulesQuery.refetch();
        }}
        retrying={servicesQuery.fetching || rulesQuery.fetching}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rulesQuery.loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : !(rulesQuery.data?.length) ? (
            <p className="text-sm text-muted-foreground">No pricing rules configured.</p>
          ) : (
            rulesQuery.data.map((rule) => (
              <div key={rule.key} className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{humanize(rule.key)}</p>
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    Percent
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.01}
                      className="h-8 w-24"
                      defaultValue={(rule.bps / 100).toString()}
                      key={`${rule.key}-${rule.bps}`}
                      disabled={!manage}
                      onBlur={(event) => {
                        const percent = Number(event.target.value);
                        if (Number.isNaN(percent) || percent < 0 || percent > 50) {
                          toast.error("Enter 0–50");
                          return;
                        }
                        const bps = Math.round(percent * 100);
                        if (bps === rule.bps) return;
                        void api.pricingRules
                          .update(rule.key, { bps, isActive: rule.isActive })
                          .then(() => {
                            toast.success("Rule updated");
                            return rulesQuery.refetch();
                          })
                          .catch((err) => toast.error(errorMessage(err)));
                      }}
                    />
                  </label>
                </div>
                <Switch
                  checked={rule.isActive}
                  disabled={!manage}
                  onCheckedChange={(checked) => {
                    void api.pricingRules
                      .update(rule.key, { isActive: checked, bps: rule.bps })
                      .then(() => {
                        toast.success("Rule updated");
                        return rulesQuery.refetch();
                      })
                      .catch((err) => toast.error(errorMessage(err)));
                  }}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {servicesQuery.loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !(servicesQuery.data?.length) ? (
        <EmptyState title="No services" description="Add a session, set, booth or rental." />
      ) : (
        SERVICE_KINDS.map((kind) => {
          const items = grouped.get(kind) ?? [];
          if (!items.length) return null;
          return (
            <section key={kind} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{humanize(kind)}</h2>
              <div className="space-y-3">
                {items.map((service) => (
                  <Card key={service.id}>
                    <CardHeader className="flex flex-col items-stretch gap-3 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        {service.media?.url ? (
                          <img
                            src={service.media.thumbUrl || service.media.url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : null}
                        <div className="min-w-0">
                        <CardTitle className="text-base">{service.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          from {formatNairaFromKobo(service.startingPriceKobo)} · {service.slug}
                        </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <ActiveBadge active={service.isActive} />
                        {manage ? (
                          <>
                            <Button size="icon-sm" variant="ghost" onClick={() => move(service, -1)}>
                              <ArrowUp />
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => move(service, 1)}>
                              <ArrowDown />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditService(service);
                                setServiceOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button size="sm" onClick={() => setPackageOpen(service)}>
                              <Plus />
                              Package
                            </Button>
                            <ConfirmDialog
                              title="Remove service?"
                              description="Soft-deletes if bookings exist; otherwise hard delete."
                              confirmLabel="Remove"
                              destructive
                              successMessage="Service removed"
                              onConfirm={async () => {
                                await api.services.remove(service.id);
                                await servicesQuery.refetch();
                              }}
                              trigger={
                                <Button size="icon-sm" variant="ghost">
                                  <Trash2 className="text-destructive" />
                                </Button>
                              }
                            />
                          </>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {service.summary ? <p className="text-sm text-muted-foreground">{service.summary}</p> : null}
                      {(service.packages ?? []).map((pkg) => (
                        <div
                          key={pkg.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {pkg.durationMinutes} min · {formatNairaFromKobo(pkg.priceKobo)}
                            </p>
                          </div>
                          <ActiveBadge active={pkg.isActive} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}

      <ServiceDialog
        open={serviceOpen}
        onOpenChange={setServiceOpen}
        initial={editService}
        onSaved={async () => {
          setServiceOpen(false);
          await servicesQuery.refetch();
        }}
      />
      <PackageDialog
        service={packageOpen}
        onOpenChange={(open) => !open && setPackageOpen(null)}
        onSaved={async () => {
          setPackageOpen(null);
          await servicesQuery.refetch();
        }}
      />
    </div>
  );
}

function ServiceDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Service | null;
  onSaved: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ServiceKind>("SESSION");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [startingPriceKobo, setStartingPriceKobo] = useState<number | null>(0);
  const [media, setMedia] = useState<SelectedServiceMedia | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setKind(initial?.kind ?? "SESSION");
    setSummary(initial?.summary ?? "");
    setDescription(initial?.description ?? "");
    setStartingPriceKobo(initial?.startingPriceKobo ?? 0);
    setMedia(
      initial?.media
        ? {
            id: initial.media.id,
            url: initial.media.url,
            thumbUrl: initial.media.thumbUrl,
            alt: initial.media.alt,
          }
        : null,
    );
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit service" : "New service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Name" required>
            {(c) => <Input id={c.id} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Kind">
            {(c) => (
              <Select value={kind} onValueChange={(v) => setKind(v as ServiceKind)}>
                <SelectTrigger id={c.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {humanize(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Summary">
            {(c) => <Input id={c.id} value={summary} onChange={(e) => setSummary(e.target.value)} />}
          </FormField>
          <FormField label="Description" required>
            {(c) => <Textarea id={c.id} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>
          <FormField label="Starting price">
            {(c) => <MoneyInput id={c.id} valueKobo={startingPriceKobo} onChangeKobo={setStartingPriceKobo} />}
          </FormField>
          <ServiceMediaPicker enabled={open} value={media} onChange={setMedia} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              setPending(true);
              const body = {
                name,
                kind,
                summary: summary || undefined,
                description,
                startingPriceKobo: startingPriceKobo ?? 0,
                slug: initial?.slug ?? slugify(name),
                mediaId: media?.id ?? null,
              };
              const req = initial
                ? api.services.update(initial.id, body)
                : api.services.create(body);
              void req
                .then(() => {
                  toast.success(initial ? "Service updated" : "Service created");
                  return onSaved();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PackageDialog({
  service,
  onOpenChange,
  onSaved,
}: {
  service: Service | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [includes, setIncludes] = useState("");
  const [priceKobo, setPriceKobo] = useState<number | null>(0);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={!!service} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add package{service ? ` · ${service.name}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Name" required>
            {(c) => <Input id={c.id} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Duration (minutes)">
            {(c) => (
              <Input
                id={c.id}
                type="number"
                min={15}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            )}
          </FormField>
          <FormField label="Includes" required>
            {(c) => <Textarea id={c.id} rows={3} value={includes} onChange={(e) => setIncludes(e.target.value)} />}
          </FormField>
          <FormField label="Price">
            {(c) => <MoneyInput id={c.id} valueKobo={priceKobo} onChangeKobo={setPriceKobo} />}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              if (!service) return;
              setPending(true);
              void api.services
                .createPackage(service.id, {
                  name,
                  durationMinutes,
                  includes,
                  priceKobo: priceKobo ?? 0,
                })
                .then(() => {
                  toast.success("Package added");
                  setName("");
                  setIncludes("");
                  return onSaved();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Add package
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
