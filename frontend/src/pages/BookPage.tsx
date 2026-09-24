import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { BOOK_PAGE_HEADER } from "../data/headerStills";
import { serviceHeroSrc } from "../data/serviceMedia";
import {
  addDaysToKey,
  formatCountdown,
  formatDateKey,
  formatDuration,
  formatLagosTime,
  lagosToday,
  msUntil,
} from "../lib/datetime";
import {
  createHold,
  fetchAvailability,
  fetchServices,
  formatNairaFromKobo,
  formatOutfitCount,
  formatPackageDeliverables,
  groupServicesByKind,
  PublicApiError,
  SERVICE_KIND_LABELS,
  sortPublicPackages,
  startCheckout,
  type HoldResponse,
  type PublicPackage,
  type PublicService,
} from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { usePolicyValues } from "../lib/policies";
import { useSiteInfo } from "../lib/settings";
import { usePublicData } from "../lib/usePublicData";

type Step = "package" | "schedule" | "details" | "hold";

type FlatPackage = PublicPackage & { serviceName: string; serviceSlug: string };

function flattenPackages(services: PublicService[]): FlatPackage[] {
  return services.flatMap((service) =>
    service.packages.map((pkg) => ({
      ...pkg,
      serviceName: service.name,
      serviceSlug: service.slug,
    })),
  );
}

export function BookPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const info = useSiteInfo();
  const policies = usePolicyValues();
  const { data: services, loading } = usePublicData(() => fetchServices(), []);
  const packages = useMemo(() => flattenPackages(services ?? []), [services]);

  const packageParam = params.get("package")?.trim() ?? "";
  const serviceParam = params.get("service")?.trim() ?? "";
  const [step, setStep] = useState<Step>("package");
  const [packageId, setPackageId] = useState(packageParam);

  useEffect(() => {
    if (packageParam) {
      setPackageId(packageParam);
      return;
    }
    if (!serviceParam || packages.length === 0) return;
    const fromService = packages.find((pkg) => pkg.serviceSlug === serviceParam);
    if (fromService) setPackageId(fromService.id);
  }, [packageParam, serviceParam, packages]);
  const [date, setDate] = useState(lagosToday());
  const [slotIso, setSlotIso] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  const selected = packages.find((pkg) => pkg.id === packageId) ?? null;
  const selectedService =
    (services ?? []).find((service) => service.slug === selected?.serviceSlug) ?? null;
  const selectedHeroSrc = selectedService ? serviceHeroSrc(selectedService) : undefined;
  const onlinePriceKobo = selected?.onlinePriceKobo ?? null;
  const selectedDeliverables = selected ? formatPackageDeliverables(selected) : null;
  const showSummary = step === "details" || step === "hold";

  useEffect(() => {
    if (!selected || step !== "schedule") return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlotIso("");
    fetchAvailability(date, selected.durationMinutes)
      .then((response) => {
        if (!cancelled) setSlots(response.slots);
      })
      .catch((error) => {
        if (cancelled) return;
        setSlots([]);
        setSlotsError(
          error instanceof PublicApiError
            ? error.message
            : "Booking API unavailable — live slots could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, selected, step]);

  useEffect(() => {
    if (!hold?.holdExpiresAt) return;
    const tick = () => setRemainingMs(msUntil(hold.holdExpiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hold]);

  const dateOptions = useMemo(() => {
    const today = lagosToday();
    return Array.from({ length: 28 }, (_, i) => addDaysToKey(today, i));
  }, []);

  async function onHold(event: FormEvent) {
    event.preventDefault();
    if (!selected || !slotIso) return;
    setSubmitting(true);
    setHoldError(null);
    try {
      const result = await createHold({
        packageId: selected.id,
        startTime: slotIso,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
      });
      setHold(result);
      setStep("hold");
    } catch (error) {
      if (error instanceof PublicApiError) {
        setHoldError(error.message);
      } else {
        setHoldError("Booking API unavailable. Please try again later or call the studio.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onCheckout() {
    if (!hold) return;
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const origin = window.location.origin;
      const returnUrl = `${origin}/book/confirmation?bookingId=${encodeURIComponent(hold.bookingId)}&reference=${encodeURIComponent(hold.reference)}`;
      const cancelUrl = `${origin}/book?cancelled=1`;
      const checkout = await startCheckout(hold.bookingId, hold.reference, returnUrl, cancelUrl);
      if (checkout.provider === "mock") {
        navigate(
          `/book/confirmation?bookingId=${encodeURIComponent(hold.bookingId)}&reference=${encodeURIComponent(checkout.reference)}&mock=1`,
        );
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof PublicApiError
          ? error.message
          : "Checkout could not start. Booking API may be unavailable.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Seo
        title="Book"
        description={`Reserve a Photo Arena session online and receive ${policies.onlineDiscountPercent}% off. Port Harcourt studio.`}
        path="/book"
      />
      <PageHeader
        eyebrow="Book Now"
        title="Reserve a session"
        image={BOOK_PAGE_HEADER.src}
        objectPosition={BOOK_PAGE_HEADER.objectPosition}
      />
      <Section className="pt-0">
        <Container className={showSummary ? "grid min-w-0 gap-grid-lg lg:grid-cols-[1.2fr_0.8fr]" : "min-w-0"}>
          <div className="min-w-0">
            <ol className="mb-stack-xl flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.16em] text-text-muted">
              {(
                [
                  ["package", "1 · Package"],
                  ["schedule", "2 · Date & time"],
                  ["details", "3 · Details"],
                  ["hold", "4 · Pay"],
                ] as const
              ).map(([key, label]) => (
                <li
                  key={key}
                  className={step === key ? "text-accent" : undefined}
                  aria-current={step === key ? "step" : undefined}
                >
                  {label}
                </li>
              ))}
            </ol>

            {loading ? <CameraSpinner label="Loading packages" caption="Loading packages…" /> : null}

            {step === "package" ? (
              <div className="min-w-0 space-y-stack-xl overflow-x-hidden">
                {groupServicesByKind(services ?? []).map((group) => (
                  <section
                    key={group.kind}
                    aria-labelledby={`book-kind-${group.kind}`}
                    className="min-w-0"
                  >
                    <h2
                      id={`book-kind-${group.kind}`}
                      className="mb-1 font-display text-2xl text-text"
                    >
                      {SERVICE_KIND_LABELS[group.kind].title}
                    </h2>
                    <p className="mb-4 text-sm text-text-secondary">
                      {SERVICE_KIND_LABELS[group.kind].blurb}
                    </p>
                    <div className="w-full overflow-x-hidden">
                      <div className="pa-package-rail">
                        {group.services.map((service) => {
                          const options = sortPublicPackages(service.packages);
                          const selectedPkg = options.find((pkg) => pkg.id === packageId) ?? null;
                          const active = Boolean(selectedPkg);
                          const media = serviceHeroSrc(service);
                          const online = selectedPkg?.onlinePriceKobo;
                          const discount =
                            selectedPkg &&
                            typeof selectedPkg.discountPercent === "number" &&
                            selectedPkg.discountPercent > 0
                              ? selectedPkg.discountPercent
                              : null;
                          const usesOutfits = options.some((pkg) => pkg.outfitCount != null);
                          const selectedDeliverables = selectedPkg
                            ? formatPackageDeliverables(selectedPkg)
                            : null;
                          return (
                            <article
                              key={service.id}
                              className={`border p-card-sm ${
                                active ? "border-accent bg-elevated" : "border-elevated bg-surface"
                              }`}
                            >
                              {media ? (
                                <img
                                  src={media}
                                  alt={`${service.name} at Photo Arena`}
                                  className="mb-3 aspect-[4/3] w-full object-cover object-top"
                                />
                              ) : null}
                              <h3 className="font-display text-xl text-text">{service.name}</h3>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {options.map((pkg) => {
                                  const pressed = pkg.id === packageId;
                                  return (
                                    <button
                                      key={pkg.id}
                                      type="button"
                                      aria-pressed={pressed}
                                      onClick={() => setPackageId(pkg.id)}
                                      className={`min-h-11 rounded-full px-3 text-sm transition ${
                                        pressed
                                          ? "border border-accent bg-accent text-text-on-accent"
                                          : "border border-elevated text-text-secondary hover:border-accent hover:text-text"
                                      }`}
                                    >
                                      {packageChipLabel(pkg)}
                                      <span className="sr-only">, {service.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedPkg ? (
                                <>
                                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                                    {formatDuration(selectedPkg.durationMinutes)}
                                    {selectedDeliverables ? ` → ${selectedDeliverables}` : ""}
                                  </p>
                                  {selectedPkg.includes ? (
                                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                                      {selectedPkg.includes}
                                    </p>
                                  ) : null}
                                  <p className="mt-3 font-medium text-text">
                                    {formatNairaFromKobo(selectedPkg.priceKobo)}
                                    <span className="ml-2 text-xs font-normal text-text-muted">
                                      studio
                                    </span>
                                  </p>
                                  {online != null && online !== selectedPkg.priceKobo ? (
                                    <p className="mt-1 text-sm text-accent">
                                      {formatNairaFromKobo(online)} online
                                      {discount != null ? ` (${discount}% off)` : ""}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-xs text-text-muted">
                                      Online discount is applied when you hold the slot.
                                    </p>
                                  )}
                                  <Button
                                    type="button"
                                    className="mt-stack-sm w-full"
                                    onClick={() => setStep("schedule")}
                                  >
                                    Continue
                                    <span className="sr-only">
                                      {" "}
                                      with {service.name}, {packageChipLabel(selectedPkg)}
                                    </span>
                                  </Button>
                                </>
                              ) : (
                                <p className="mt-3 text-sm text-text-muted">
                                  From {formatNairaFromKobo(service.startingPriceKobo)}
                                  {usesOutfits ? " · choose an outfit" : ""}
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {step === "schedule" && selected ? (
              <div className="space-y-form">
                <article className="max-w-md border border-elevated bg-surface p-card-sm">
                  {selectedHeroSrc ? (
                    <img
                      src={selectedHeroSrc}
                      alt={`${selected.serviceName} at Photo Arena`}
                      className="mb-3 aspect-[4/3] w-full max-w-md object-cover object-top"
                    />
                  ) : null}
                  <h2 className="font-display text-xl text-text">{selected.serviceName}</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {selected.outfitCount != null ? `${formatOutfitCount(selected.outfitCount)} · ` : ""}
                    {formatDuration(selected.durationMinutes)}
                  </p>
                  {selectedDeliverables ? (
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {selectedDeliverables}
                    </p>
                  ) : null}
                  {selected.includes ? (
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {selected.includes}
                    </p>
                  ) : null}
                  <p className="mt-3 font-medium text-text">
                    {formatNairaFromKobo(selected.priceKobo)}
                    <span className="ml-2 text-xs font-normal text-text-muted">studio</span>
                  </p>
                  {onlinePriceKobo != null && onlinePriceKobo !== selected.priceKobo ? (
                    <p className="mt-1 text-sm text-accent">
                      {formatNairaFromKobo(onlinePriceKobo)} online
                      {typeof selected.discountPercent === "number" && selected.discountPercent > 0
                        ? ` (${selected.discountPercent}% off)`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-text-muted">
                      Online discount is applied when you hold the slot.
                    </p>
                  )}
                </article>
                <div>
                  <label htmlFor="book-date" className="pa-label">
                    Date (Lagos)
                  </label>
                  <select
                    id="book-date"
                    className="pa-input"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  >
                    {dateOptions.map((key) => (
                      <option key={key} value={key}>
                        {formatDateKey(key, { weekday: "long", day: "numeric", month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="pa-label">Available times</p>
                  {slotsLoading ? (
                    <CameraSpinner size="sm" label="Checking availability" caption="Checking availability…" />
                  ) : null}
                  {slotsError ? <p className="text-sm text-error">{slotsError}</p> : null}
                  {!slotsLoading && !slotsError && slots.length === 0 ? (
                    <p className="text-sm text-text-muted">No open slots on this date. Try another day.</p>
                  ) : null}
                  <div className="grid grid-cols-3 gap-grid-tight sm:grid-cols-4">
                    {slots.map((iso) => (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSlotIso(iso)}
                        className={`min-h-11 border px-2 text-sm ${
                          slotIso === iso
                            ? "border-accent bg-accent/15 text-text"
                            : "border-elevated text-text-secondary hover:border-accent"
                        }`}
                      >
                        {formatLagosTime(iso)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-control">
                  <Button type="button" variant="ghost" onClick={() => setStep("package")}>
                    Back
                  </Button>
                  <Button type="button" disabled={!slotIso} onClick={() => setStep("details")}>
                    Continue
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "details" ? (
              <form onSubmit={onHold} className="space-y-form">
                <div>
                  <label htmlFor="customerName" className="pa-label">
                    Full name
                  </label>
                  <input
                    id="customerName"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pa-input"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="pa-label">
                    Phone
                  </label>
                  <input
                    id="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pa-input"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="pa-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pa-input"
                  />
                </div>
                {holdError ? <p className="text-sm text-error">{holdError}</p> : null}
                <div className="flex flex-wrap gap-control">
                  <Button type="button" variant="ghost" onClick={() => setStep("schedule")}>
                    Back
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Holding slot…" : "Hold slot & see price"}
                  </Button>
                </div>
              </form>
            ) : null}

            {step === "hold" && hold ? (
              <div className="space-y-form">
                <div className="pa-card">
                  <p className="text-xs uppercase tracking-[0.16em] text-accent">Hold active</p>
                  <p className="mt-2 font-display text-3xl text-text">{formatCountdown(remainingMs)}</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Complete payment before the hold expires or the slot is released.
                  </p>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Studio price</dt>
                    <dd>{formatNairaFromKobo(hold.pricing.baseKobo)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Online discount ({hold.pricing.discountPercent}%)</dt>
                    <dd>−{formatNairaFromKobo(hold.pricing.discountKobo)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-elevated pt-3 text-base">
                    <dt className="text-text">Payable now</dt>
                    <dd className="text-accent">{formatNairaFromKobo(hold.pricing.payableKobo)}</dd>
                  </div>
                </dl>
                {checkoutError ? <p className="text-sm text-error">{checkoutError}</p> : null}
                <div className="flex flex-wrap gap-control">
                  <Button type="button" disabled={submitting || remainingMs <= 0} onClick={onCheckout}>
                    {submitting ? "Starting checkout…" : "Pay now"}
                  </Button>
                </div>
                {remainingMs <= 0 ? (
                  <p className="text-sm text-warning">Hold expired. Go back and choose a new time.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {showSummary ? (
            <aside className="pa-card h-fit">
              <h2 className="font-display text-2xl">Summary</h2>
              {selected ? (
                <dl className="mt-6 space-y-control text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Package</dt>
                    <dd className="text-right">{selected.serviceName}</dd>
                  </div>
                  {selected.outfitCount != null ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Outfits</dt>
                      <dd>{formatOutfitCount(selected.outfitCount)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Duration</dt>
                    <dd>{formatDuration(selected.durationMinutes)}</dd>
                  </div>
                  {selectedDeliverables ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Includes</dt>
                      <dd className="text-right">{selectedDeliverables}</dd>
                    </div>
                  ) : null}
                  {slotIso ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">When</dt>
                      <dd className="text-right">
                        {formatDateKey(date)} · {formatLagosTime(slotIso)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Studio price</dt>
                    <dd>{formatNairaFromKobo(selected.priceKobo)}</dd>
                  </div>
                  {onlinePriceKobo != null && !hold ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Online price</dt>
                      <dd className="text-accent">{formatNairaFromKobo(onlinePriceKobo)}</dd>
                    </div>
                  ) : null}
                  {hold ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Server total</dt>
                      <dd className="text-accent">{formatNairaFromKobo(hold.pricing.payableKobo)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              <p className="mt-6 text-xs leading-relaxed text-text-muted">
                Display estimates are not final. The backend sets the charged amount at hold. Bookings are
                non-refundable; rescheduling attracts {policies.reschedulePercent}%. Times are Africa/Lagos.
              </p>
              <p className="mt-3 text-xs text-text-muted">
                Prefer to talk? Call{" "}
                <a href={info.phoneHref} className="text-accent">
                  {info.phone}
                </a>
                .
              </p>
            </aside>
          ) : null}
        </Container>
      </Section>
    </>
  );
}

function packageChipLabel(pkg: PublicPackage): string {
  return pkg.outfitCount != null ? formatOutfitCount(pkg.outfitCount) : formatDuration(pkg.durationMinutes);
}
