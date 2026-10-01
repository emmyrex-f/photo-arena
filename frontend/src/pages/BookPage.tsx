import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { BOOK_PAGE_SLIDES } from "../data/headerStills";
import { serviceHeroSrc } from "../data/serviceMedia";
import { VideoReelsRateCard } from "../components/booking/VideoReelsRateCard";
import {
  addDaysToKey,
  formatDateKey,
  formatDuration,
  formatLagosTime,
  lagosToday,
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
  type PublicPackage,
  type PublicService,
} from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { usePolicyValues } from "../lib/policies";
import { useSiteInfo } from "../lib/settings";
import { usePublicData } from "../lib/usePublicData";

type Step = "package" | "schedule" | "details";

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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = packages.find((pkg) => pkg.id === packageId) ?? null;
  const selectedService =
    (services ?? []).find((service) => service.slug === selected?.serviceSlug) ?? null;
  const selectedHeroSrc = selectedService ? serviceHeroSrc(selectedService) : undefined;
  const onlinePriceKobo = selected?.onlinePriceKobo ?? null;
  const selectedDeliverables = selected ? formatPackageDeliverables(selected) : null;
  const showSummary = step === "details";

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

  const dateOptions = useMemo(() => {
    const today = lagosToday();
    return Array.from({ length: 28 }, (_, i) => addDaysToKey(today, i));
  }, []);

  function validateBookingPhone(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return "Phone number is required.";
    if (/[a-zA-Z]/.test(trimmed)) return "Phone number cannot contain letters.";
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 8) return "Phone number must have at least 8 digits.";
    if (digits.length > 16) return "Phone number cannot exceed 16 digits.";

    if (trimmed.startsWith("0")) {
      if (digits.length !== 11) {
        return "Nigerian local numbers (0...) must have exactly 11 digits (e.g. 0803 123 4567).";
      }
    } else if (trimmed.startsWith("+234") || trimmed.startsWith("234")) {
      const localPart = trimmed.startsWith("+234") ? digits.slice(3) : digits.slice(3);
      if (localPart.length !== 10) {
        return "Nigerian numbers with +234 must have 10 digits after the country code.";
      }
    }
    return null;
  }

  async function onSubmitBooking(event: FormEvent) {
    event.preventDefault();
    if (!selected || !slotIso) return;
    const phoneErr = validateBookingPhone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setSubmitting(true);
    setBookingError(null);
    try {
      const holdResult = await createHold({
        packageId: selected.id,
        startTime: slotIso,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
      });

      const origin = window.location.origin;
      const returnUrl = `${origin}/book/confirmation?bookingId=${encodeURIComponent(holdResult.bookingId)}&reference=${encodeURIComponent(holdResult.reference)}`;
      const cancelUrl = `${origin}/book?cancelled=1`;
      const checkout = await startCheckout(holdResult.bookingId, holdResult.reference, returnUrl, cancelUrl);
      if (checkout.provider === "mock") {
        navigate(
          `/book/confirmation?bookingId=${encodeURIComponent(holdResult.bookingId)}&reference=${encodeURIComponent(checkout.reference)}&mock=1`,
        );
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      if (error instanceof PublicApiError) {
        setBookingError(error.message);
        if (error.status === 409) {
          setSlots((current) => current.filter((iso) => iso !== slotIso));
          setSlotIso("");
          setStep("schedule");
        }
      } else {
        setBookingError("Checkout could not start. Please try again or contact the studio.");
      }
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
        slides={BOOK_PAGE_SLIDES}
        slidesSettingKey="site.header.book"
      />
      <Section className="pt-6 sm:pt-10 lg:pt-12">
        <Container className={showSummary ? "grid min-w-0 gap-grid-lg lg:grid-cols-[1.2fr_0.8fr]" : "min-w-0"}>
          <div className="min-w-0">
            <div className="mb-stack-lg flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-elevated pb-5">
              <ol className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em]">
                {(
                  [
                    ["package", "1. Package"],
                    ["schedule", "2. Date & Time"],
                    ["details", "3. Details & Pay"],
                  ] as const
                ).map(([key, label], idx) => {
                  const isCurrent = step === key;
                  const stepOrder = ["package", "schedule", "details"];
                  const isCompleted = stepOrder.indexOf(step) > stepOrder.indexOf(key);
                  return (
                    <li key={key} className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 font-medium transition ${
                          isCurrent
                            ? "bg-accent text-ink font-semibold shadow-xs"
                            : isCompleted
                            ? "bg-surface border border-elevated text-text"
                            : "text-text-muted"
                        }`}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        {label}
                      </span>
                      {idx < 2 ? <span className="text-text-muted/40">/</span> : null}
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-text-muted">
                Already booked?{" "}
                <Link to="/booking/lookup" className="font-medium text-accent underline-offset-2 hover:underline ml-1">
                  Look up booking →
                </Link>
              </p>
            </div>

            {loading ? <CameraSpinner label="Loading packages" caption="Loading packages…" /> : null}

            {step === "package" ? (
              <div className="min-w-0 space-y-14 sm:space-y-10 overflow-x-hidden">
                {groupServicesByKind(services ?? []).map((group, groupIdx) => {
                  const isAlt = groupIdx % 2 === 1;
                  const groupServices =
                    group.kind === "SESSION"
                      ? group.services.filter((s) => s.slug !== "video-reels")
                      : group.services;
                  const videoReelsService =
                    group.kind === "SESSION"
                      ? group.services.find((s) => s.slug === "video-reels")
                      : null;

                  return (
                    <div key={group.kind} className="space-y-14 sm:space-y-10">
                      <section
                        aria-labelledby={`book-kind-${group.kind}`}
                        className={`min-w-0 transition-all sm:rounded-lg sm:border sm:p-7 sm:shadow-xs md:p-8 ${
                          isAlt
                            ? "sm:border-border/40 sm:bg-[#f6f6f4] sm:dark:bg-stone-950/70"
                            : "sm:border-border/30 sm:bg-white sm:dark:bg-stone-900"
                        }`}
                      >
                        <div className="mb-5 sm:mb-6">
                          <p className="font-subtitle mb-1 text-xs uppercase tracking-[0.18em] text-accent">
                            {SERVICE_KIND_LABELS[group.kind].eyebrow}
                          </p>
                          <h2
                            id={`book-kind-${group.kind}`}
                            className="font-display text-2xl sm:text-3xl text-text"
                          >
                            {SERVICE_KIND_LABELS[group.kind].title}
                          </h2>
                          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                            {SERVICE_KIND_LABELS[group.kind].blurb}
                          </p>
                        </div>
                        <div className="w-full overflow-x-hidden">
                          <div className="pa-package-rail">
                            {groupServices.map((service) => {
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
                                  className={`flex flex-col justify-between rounded-md border p-card-sm transition-shadow ${
                                    active
                                      ? "border-accent bg-elevated shadow-sm ring-1 ring-accent/30"
                                      : isAlt
                                      ? "border-border sm:border-border/40 lg:border-transparent bg-white dark:bg-stone-900"
                                      : "border-border sm:border-elevated lg:border-transparent bg-[#fbfbf9] dark:bg-stone-900/60"
                                  }`}
                                >
                              <div>
                                {media ? (
                                  <img
                                    src={media}
                                    alt={`${service.name} at Photo Arena`}
                                    className="mb-3 aspect-[4/3] w-full rounded-xs object-cover object-top"
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
                                        className={`min-h-10 rounded-full px-3 text-xs font-medium transition ${
                                          pressed
                                            ? "border border-accent bg-accent text-text-on-accent font-semibold"
                                            : "border border-elevated text-text-secondary hover:border-accent hover:text-text"
                                        }`}
                                      >
                                        {packageChipLabel(pkg)}
                                        <span className="sr-only">, {service.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="mt-auto pt-4">
                                {selectedPkg ? (
                                  <>
                                    <p className="text-sm leading-relaxed text-text-secondary">
                                      {formatDuration(selectedPkg.durationMinutes)}
                                      {selectedDeliverables ? ` → ${selectedDeliverables}` : ""}
                                    </p>
                                    {selectedPkg.includes &&
                                    selectedPkg.includes !== selectedDeliverables &&
                                    !selectedDeliverables?.includes(selectedPkg.includes) ? (
                                      <p className="mt-1 text-xs leading-relaxed text-text-muted">
                                        {selectedPkg.includes}
                                      </p>
                                    ) : null}
                                    {online != null && online !== selectedPkg.priceKobo ? (
                                      <div className="mt-3 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-display text-2xl font-bold text-emerald-800 dark:text-emerald-400">
                                            {formatNairaFromKobo(online)}
                                          </span>
                                          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-900/80 dark:text-emerald-300">
                                            online
                                          </span>
                                          {discount != null && discount > 0 ? (
                                            <span className="inline-flex items-center rounded-md bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950 px-2 py-0.5 text-xs font-bold tracking-wide shadow-sm">
                                              {discount}% OFF
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="text-xs text-text-muted">
                                          Studio price: <span className="line-through decoration-text-muted/70">{formatNairaFromKobo(selectedPkg.priceKobo)}</span>
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="mt-3 font-medium text-text">
                                        {formatNairaFromKobo(selectedPkg.priceKobo)}
                                        <span className="ml-2 text-xs font-normal text-text-muted">
                                          studio
                                        </span>
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
                                  <p className="text-sm text-text-muted">
                                    From {formatNairaFromKobo(service.startingPriceKobo)}
                                    {usesOutfits ? " · choose an outfit" : ""}
                                  </p>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {videoReelsService ? (
                    <VideoReelsRateCard
                      service={videoReelsService}
                      selectedPackageId={packageId}
                      onSelectPackage={setPackageId}
                      onContinue={() => setStep("schedule")}
                      mode="book"
                    />
                  ) : null}
                </div>
              );
            })}
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
                  {onlinePriceKobo != null && onlinePriceKobo !== selected.priceKobo ? (
                    <div className="mt-3 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-2xl font-bold text-emerald-800 dark:text-emerald-400">
                          {formatNairaFromKobo(onlinePriceKobo)}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-900/80 dark:text-emerald-300">
                          online
                        </span>
                        {typeof selected.discountPercent === "number" && selected.discountPercent > 0 ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950 px-2 py-0.5 text-xs font-bold tracking-wide shadow-sm">
                            {selected.discountPercent}% OFF
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-text-muted">
                        Studio price: <span className="line-through decoration-text-muted/70">{formatNairaFromKobo(selected.priceKobo)}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 font-medium text-text">
                      {formatNairaFromKobo(selected.priceKobo)}
                      <span className="ml-2 text-xs font-normal text-text-muted">studio</span>
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
                  {bookingError ? <p className="text-sm text-error" role="alert">{bookingError}</p> : null}
                  {!slotsLoading && !slotsError && slots.length === 0 ? (
                    <p className="text-sm text-text-muted">No open slots on this date. Try another day.</p>
                  ) : null}
                  <div className="grid grid-cols-3 gap-grid-tight sm:grid-cols-4">
                    {slots.map((iso) => (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => {
                          setSlotIso(iso);
                          setBookingError(null);
                        }}
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
              <form onSubmit={onSubmitBooking} className="space-y-form">
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
                    placeholder="e.g. Chisom Adeleke"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="pa-label">
                    Phone number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) {
                        setPhoneError(validateBookingPhone(e.target.value));
                      }
                    }}
                    onBlur={() => {
                      if (phone) {
                        setPhoneError(validateBookingPhone(phone));
                      }
                    }}
                    placeholder="e.g. 0803 123 4567 or +234 803 123 4567"
                    className={`pa-input ${phoneError ? "border-error focus:border-error" : ""}`}
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby={phoneError ? "phone-error" : "phone-hint"}
                  />
                  {phoneError ? (
                    <p id="phone-error" className="mt-1 text-xs text-error font-medium">
                      {phoneError}
                    </p>
                  ) : (
                    <p id="phone-hint" className="mt-1 text-xs text-text-muted">
                      For booking confirmation & shoot reminders (SMS / WhatsApp).
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="pa-label">
                    Email <span className="text-error">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pa-input"
                    placeholder="e.g. chisom@example.com"
                    autoComplete="email"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Required for booking confirmation and shoot reminders.
                  </p>
                </div>

                {selected ? (
                  <div className="rounded-xl border border-elevated bg-surface/80 p-4 space-y-2.5 text-sm mt-4">
                    <div className="flex justify-between gap-4 text-text-muted">
                      <span>Studio price</span>
                      <span className="line-through">{formatNairaFromKobo(selected.priceKobo)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Online discount ({policies.onlineDiscountPercent}%)</span>
                      <span>−{formatNairaFromKobo(selected.priceKobo - (onlinePriceKobo ?? selected.priceKobo))}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-elevated pt-2.5 text-base font-semibold text-text">
                      <span>Total payable</span>
                      <span className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNairaFromKobo(onlinePriceKobo ?? selected.priceKobo)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {bookingError ? <p className="text-sm text-error">{bookingError}</p> : null}

                <div className="flex flex-wrap gap-control pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep("schedule")}>
                    Back
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Redirecting to payment…" : "Proceed to payment →"}
                  </Button>
                </div>
              </form>
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
                  <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400 font-medium">
                    <dt>Online discount ({policies.onlineDiscountPercent}%)</dt>
                    <dd>−{formatNairaFromKobo(selected.priceKobo - (onlinePriceKobo ?? selected.priceKobo))}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-elevated pt-2.5 text-base font-semibold text-text">
                    <dt>Total payable</dt>
                    <dd className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNairaFromKobo(onlinePriceKobo ?? selected.priceKobo)}
                    </dd>
                  </div>
                </dl>
              ) : null}
              <p className="mt-6 text-xs leading-relaxed text-text-muted">
                Bookings are non-refundable; rescheduling attracts {policies.reschedulePercent}%. Times are Africa/Lagos.
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
