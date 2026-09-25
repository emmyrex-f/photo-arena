import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Container } from "../components/ui/Container";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/Dialog";
import { Section } from "../components/ui/Section";
import { downloadIcs, googleCalendarUrl } from "../lib/calendar";
import {
  addDaysToKey,
  formatDateKey,
  formatDuration,
  formatLagosDateTime,
  formatLagosRange,
  formatLagosTime,
  lagosToday,
} from "../lib/datetime";
import {
  customerBalanceCheckout,
  customerCancelBooking,
  customerRescheduleBooking,
  fetchBookingLookup,
  fetchPublicAvailability,
  formatNairaFromKobo,
  formatPackageDeliverables,
  PublicApiError,
  type CustomerBookingLookupResponse,
} from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { useSiteInfo } from "../lib/settings";

function statusBadgeClass(status: CustomerBookingLookupResponse["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "PENDING":
    case "TEMPORARY_HOLD":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border border-rose-200";
    case "COMPLETED":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    case "NO_SHOW":
      return "bg-zinc-100 text-zinc-600 border border-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-600 border border-zinc-200";
  }
}

export function BookingLookupPage() {
  const [params, setParams] = useSearchParams();
  const info = useSiteInfo();

  const [referenceInput, setReferenceInput] = useState(params.get("reference")?.trim() ?? "");
  const [emailOrPhoneInput, setEmailOrPhoneInput] = useState(
    params.get("emailOrPhone")?.trim() ?? "",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<CustomerBookingLookupResponse | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => addDaysToKey(lagosToday(), 1));
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleSlotIso, setRescheduleSlotIso] = useState<string>("");
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<{
    message: string;
    feeKobo: number;
    newStartTime: string;
  } | null>(null);
  const [studioPayAck, setStudioPayAck] = useState(false);

  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  /** Real email/phone for verified self-service actions — never use masked lookup values. */
  const verifiedContact =
    emailOrPhoneInput.trim() || params.get("emailOrPhone")?.trim() || "";

  const doLookup = async (ref: string, creds?: string, opts?: { keepRescheduleSuccess?: boolean }) => {
    const cleanRef = ref.trim();
    if (!cleanRef) return;
    setLoading(true);
    setError(null);
    if (!opts?.keepRescheduleSuccess) {
      setRescheduleSuccess(null);
      setStudioPayAck(false);
    }
    try {
      const res = await fetchBookingLookup(cleanRef, creds?.trim() || undefined);
      setBooking(res);
      setDetailsOpen(true);
      const nextParams = new URLSearchParams();
      nextParams.set("reference", cleanRef);
      if (creds?.trim()) nextParams.set("emailOrPhone", creds.trim());
      setParams(nextParams, { replace: true });
    } catch (err) {
      setBooking(null);
      setDetailsOpen(false);
      if (err instanceof PublicApiError) {
        setError(err.message);
      } else {
        setError("Unable to find booking. Please check your reference code and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial lookup if param is in URL
  useEffect(() => {
    const ref = params.get("reference")?.trim();
    const creds = params.get("emailOrPhone")?.trim();
    if (ref) {
      void doLookup(ref, creds || undefined);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void doLookup(referenceInput, emailOrPhoneInput);
  };

  // Reschedule slot fetching — auto-select first available slot
  useEffect(() => {
    if (!showRescheduleModal || !booking) return;
    let active = true;
    setRescheduleLoadingSlots(true);
    setRescheduleSlotIso("");
    setRescheduleError(null);

    fetchPublicAvailability(rescheduleDate, booking.package.durationMinutes)
      .then((data) => {
        if (!active) return;
        const slots = data.slots || [];
        setRescheduleSlots(slots);
        if (slots[0]) setRescheduleSlotIso(slots[0]);
      })
      .catch((err) => {
        if (active) {
          setRescheduleSlots([]);
          setRescheduleError(
            err instanceof PublicApiError ? err.message : "Failed to load slots for this date.",
          );
        }
      })
      .finally(() => {
        if (active) setRescheduleLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [showRescheduleModal, rescheduleDate, booking]);

  const handleConfirmCancel = async () => {
    if (!booking || !cancelAcknowledged) return;
    if (!verifiedContact) {
      setCancelError(
        "Enter your email or phone on the lookup form to verify ownership before cancelling.",
      );
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await customerCancelBooking({
        reference: booking.reference,
        emailOrPhone: verifiedContact,
        reason: cancelReason.trim() || undefined,
      });
      setShowCancelModal(false);
      void doLookup(booking.reference, verifiedContact);
    } catch (err) {
      setCancelError(
        err instanceof PublicApiError ? err.message : "Failed to cancel booking. Please try again.",
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!booking) return;
    if (!verifiedContact) {
      setRescheduleError(
        "Enter your email or phone on the lookup form to verify ownership before rescheduling.",
      );
      return;
    }
    if (!rescheduleSlotIso) {
      setRescheduleError("Select an available time slot before confirming.");
      return;
    }
    setRescheduling(true);
    setRescheduleError(null);
    try {
      const res = await customerRescheduleBooking({
        reference: booking.reference,
        emailOrPhone: verifiedContact,
        newStartTime: rescheduleSlotIso,
        reason: rescheduleReason.trim() || undefined,
      });
      setShowRescheduleModal(false);
      setStudioPayAck(false);
      setRescheduleSuccess({
        message: res.message,
        feeKobo: res.rescheduleFeeKobo,
        newStartTime: res.newStartTime ?? rescheduleSlotIso,
      });
      void doLookup(booking.reference, verifiedContact, { keepRescheduleSuccess: true });
    } catch (err) {
      setRescheduleError(
        err instanceof PublicApiError ? err.message : "Failed to reschedule. Please choose another slot.",
      );
    } finally {
      setRescheduling(false);
    }
  };

  const handlePayBalanceOrFee = async () => {
    if (!booking) return;
    if (!verifiedContact) {
      setCheckoutError(
        "Enter your email or phone on the lookup form to verify ownership before paying online.",
      );
      return;
    }
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const returnUrl = `${window.location.origin}/book/confirmation`;
      const cancelUrl = `${window.location.origin}/booking/lookup?reference=${encodeURIComponent(
        booking.reference,
      )}&emailOrPhone=${encodeURIComponent(verifiedContact)}`;

      const res = await customerBalanceCheckout({
        reference: booking.reference,
        emailOrPhone: verifiedContact,
        returnUrl,
        cancelUrl,
      });

      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setCheckoutError("Checkout did not return a payment link. Please try again or pay at the studio.");
        setCheckingOut(false);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof PublicApiError
          ? err.message
          : "Unable to initialize checkout. Please contact the studio.",
      );
      setCheckingOut(false);
    }
  };

  return (
    <>
      <Seo
        title="Manage Your Booking | Photo Arena Port Harcourt"
        description="Look up your studio session, check status, pay outstanding balances, or reschedule your appointment at Photo Arena."
      />

      <PageHeader
        eyebrow="Customer Self-Service"
        title="Manage Your Booking"
        description="Enter your booking reference and contact details to check session status, view studio contract policies, pay balances, or reschedule."
      />

      <Section className="tone-dark py-12 md:py-16">
        <Container>
          {/* Lookup Input Card */}
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md md:p-8 shadow-xl">
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="booking-reference"
                  className="block text-xs uppercase tracking-wider font-subtitle text-text-secondary mb-1.5"
                >
                  Booking Reference Number <span className="text-accent">*</span>
                </label>
                <div className="relative">
                  <input
                    id="booking-reference"
                    type="text"
                    required
                    placeholder="e.g. PA-A1B2C3D4E5 from your confirmation email"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-border bg-bg/80 px-4 py-3 pr-11 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Search className="absolute right-4 top-3.5 h-4 w-4 text-text-muted" aria-hidden="true" />
                </div>
                <p className="mt-1.5 text-xs text-text-muted">
                  Use the booking code from your confirmation email or SMS (usually starts with{" "}
                  <span className="font-mono text-text-secondary">PA-</span>
                  ). Payment receipt codes also work.
                </p>
              </div>

              <div>
                <label
                  htmlFor="booking-creds"
                  className="block text-xs uppercase tracking-wider font-subtitle text-text-secondary mb-1.5"
                >
                  Email or Phone Number (Verification)
                </label>
                <div className="relative">
                  <input
                    id="booking-creds"
                    type="text"
                    placeholder="e.g. 08012345678 or customer@example.com"
                    value={emailOrPhoneInput}
                    onChange={(e) => setEmailOrPhoneInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg/80 px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <Lock className="absolute right-4 top-3.5 h-4 w-4 text-text-muted" />
                </div>
                <p className="mt-1.5 text-xs text-text-muted">
                  Required to verify ownership before making changes, rescheduling, or viewing unmasked details.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading || !referenceInput.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <CameraSpinner /> Finding Booking...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" /> Look Up Booking
                    </>
                  )}
                </Button>
              </div>
            </form>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold text-rose-900">Unable to find booking</p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-800">{error}</p>
                </div>
              </div>
            )}

            {booking && !detailsOpen ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 p-3">
                <p className="min-w-0 truncate text-sm text-text-secondary">
                  Found <span className="font-mono text-text">{booking.reference}</span>
                </p>
                <Button type="button" variant="secondary" onClick={() => setDetailsOpen(true)}>
                  View booking
                </Button>
              </div>
            ) : null}
          </div>

          {/* Booking details open in a dialog after a successful lookup */}
        </Container>
      </Section>

      <Dialog
        open={detailsOpen && Boolean(booking)}
        onOpenChange={(open) => {
          setDetailsOpen(open);
        }}
      >
        <DialogContent aria-describedby="booking-details-desc">
          {booking ? (
            <>
              <DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 pr-2">
                    <DialogTitle className="font-mono text-lg tracking-wide sm:text-xl">
                      {booking.reference}
                    </DialogTitle>
                    <DialogDescription id="booking-details-desc" className="mt-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${statusBadgeClass(
                            booking.status,
                          )}`}
                        >
                          {booking.status}
                        </span>
                        {booking.customer.isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified Client
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-2 block text-xs text-zinc-600">
                        {booking.package.serviceName} · {booking.package.name}
                      </span>
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={googleCalendarUrl(
                        {
                          id: booking.id,
                          reference: booking.reference,
                          startTime: booking.startTime,
                          endTime: booking.endTime,
                          package: booking.package,
                        },
                        info.address,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:border-amber-700/40 hover:text-amber-800"
                    >
                      <Calendar className="h-3.5 w-3.5" /> Google Calendar
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        downloadIcs(
                          {
                            id: booking.id,
                            reference: booking.reference,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            package: booking.package,
                          },
                          info.address,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:border-amber-700/40 hover:text-amber-800"
                    >
                      <Download className="h-3.5 w-3.5" /> .ICS File
                    </button>
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-6">
              {rescheduleSuccess && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-900">Session Rescheduled Successfully!</p>
                    <p className="mt-1 text-xs text-emerald-800">
                      New time: {formatLagosDateTime(rescheduleSuccess.newStartTime)}.
                      {rescheduleSuccess.feeKobo > 0
                        ? ` A 15% reschedule fee of ₦${formatNairaFromKobo(rescheduleSuccess.feeKobo)} is due — pay online now or at the studio.`
                        : null}
                    </p>
                    {rescheduleSuccess.feeKobo > 0 ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          onClick={handlePayBalanceOrFee}
                          disabled={checkingOut}
                          className="h-9 px-4 py-2 text-xs"
                        >
                          {checkingOut ? <CameraSpinner /> : <CreditCard className="h-3.5 w-3.5" />}
                          Pay online (₦{formatNairaFromKobo(rescheduleSuccess.feeKobo)})
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setStudioPayAck(true)}
                          className="h-9 border-zinc-300 px-4 py-2 text-xs text-zinc-800"
                        >
                          Pay at the studio
                        </Button>
                      </div>
                    ) : null}
                    {studioPayAck ? (
                      <p className="mt-2 text-xs text-emerald-800">
                        Noted — please settle ₦{formatNairaFromKobo(rescheduleSuccess.feeKobo)} at the
                        studio before or during your session.
                      </p>
                    ) : null}
                    {checkoutError ? (
                      <p className="mt-2 text-xs text-rose-700">{checkoutError}</p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-5 lg:col-span-7">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="font-subtitle mb-4 text-xs uppercase tracking-wider text-amber-800">
                      Session Details
                    </h3>
                    <div className="space-y-3.5 text-sm">
                      <div className="flex items-start gap-3">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                        <div>
                          <p className="font-medium text-zinc-900">
                            {formatLagosDateTime(booking.startTime)}
                          </p>
                          <p className="text-xs text-zinc-600">
                            Time Slot: {formatLagosRange(booking.startTime, booking.endTime)} (Lagos
                            Time)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                        <div>
                          <p className="font-medium text-zinc-900">
                            {booking.package.name} ({formatDuration(booking.package.durationMinutes)})
                          </p>
                          <p className="text-xs text-zinc-600">
                            {formatPackageDeliverables(booking.package) || "Studio Portrait Session"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                        <div>
                          <p className="font-medium text-zinc-900">Photo Arena Studio</p>
                          <p className="text-xs text-zinc-600">{info.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="font-subtitle mb-4 text-xs uppercase tracking-wider text-amber-800">
                      Client Information
                    </h3>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-zinc-500">Client Name</p>
                        <p className="mt-0.5 font-medium text-zinc-900">{booking.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Contact Phone</p>
                        <p className="mt-0.5 font-medium text-zinc-900">{booking.customer.maskedPhone}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-zinc-500">Email Address</p>
                        <p className="mt-0.5 font-medium text-zinc-900">{booking.customer.maskedEmail}</p>
                      </div>
                    </div>

                    {!booking.customer.isVerified ? (
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <span>Details masked for privacy. Enter email or phone on the form to verify.</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h3 className="font-subtitle text-xs uppercase tracking-wider text-amber-800">
                        Payment & Accounting
                      </h3>
                      {booking.pricing.outstandingKobo > 0 ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Balance Due: ₦{formatNairaFromKobo(booking.pricing.outstandingKobo)}
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Fully Settled
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b border-zinc-100 py-1">
                        <span className="text-zinc-600">Package Amount</span>
                        <span className="font-mono text-zinc-900">
                          ₦{formatNairaFromKobo(booking.pricing.packagePriceKobo)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-100 py-1">
                        <span className="text-zinc-600">Total Settled / Paid</span>
                        <span className="font-mono font-medium text-emerald-700">
                          ₦{formatNairaFromKobo(booking.pricing.paidKobo)}
                        </span>
                      </div>
                      {booking.pricing.outstandingKobo > 0 ? (
                        <div className="flex justify-between py-1.5 font-medium">
                          <span className="text-amber-800">Outstanding Balance</span>
                          <span className="font-mono text-base text-amber-800">
                            ₦{formatNairaFromKobo(booking.pricing.outstandingKobo)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {booking.pricing.outstandingKobo > 0 && booking.status !== "CANCELLED" ? (
                      <div className="mt-5">
                        <Button
                          type="button"
                          onClick={handlePayBalanceOrFee}
                          disabled={checkingOut}
                          className="w-full"
                        >
                          {checkingOut ? <CameraSpinner /> : <CreditCard className="h-4 w-4" />}
                          Pay Outstanding Balance (₦
                          {formatNairaFromKobo(booking.pricing.outstandingKobo)})
                        </Button>
                        {checkoutError ? (
                          <p className="mt-2 text-xs text-rose-600">{checkoutError}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {booking.payments.length > 0 ? (
                      <div className="mt-6 border-t border-zinc-100 pt-4">
                        <p className="font-subtitle mb-2 text-xs uppercase tracking-wider text-zinc-500">
                          Transactions Log ({booking.payments.length})
                        </p>
                        <div className="space-y-2">
                          {booking.payments.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                            >
                              <div>
                                <span className="font-medium text-zinc-900">{p.method}</span>
                                <span className="ml-2 text-zinc-500">
                                  {p.paidAt ? formatLagosDateTime(p.paidAt) : p.status}
                                </span>
                              </div>
                              <span className="font-mono text-zinc-900">
                                ₦{formatNairaFromKobo(p.amountKobo)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 lg:col-span-5">
                  <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-3 flex items-center gap-2.5 text-amber-800">
                      <ShieldAlert className="h-5 w-5" />
                      <h3 className="font-subtitle text-xs font-semibold uppercase tracking-wider">
                        Studio Contract Policies
                      </h3>
                    </div>

                    <div className="space-y-4 text-xs leading-relaxed text-zinc-600">
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-rose-900">
                        <p className="mb-1 flex items-center gap-1.5 font-medium text-rose-800">
                          <XCircle className="h-4 w-4 text-rose-600" /> Strict No-Refund Policy
                        </p>
                        <p>
                          Photo Arena operates a strict no-refund policy. All booking deposits and fees
                          are non-refundable. Cancellations forfeit 100% of fees paid (₦0 refund) as
                          studio resources and staff are reserved exclusively for your session.
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
                        <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-900">
                          <RefreshCw className="h-4 w-4 text-amber-800" /> 15% Rescheduling Option
                        </p>
                        <p>
                          Rather than cancelling and forfeiting your deposit, you can reschedule your
                          session to any available studio slot for a 15% rescheduling fee (₦
                          {formatNairaFromKobo(booking.pricing.rescheduleFeeKobo)}).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="font-subtitle mb-3 text-xs uppercase tracking-wider text-zinc-500">
                      Booking Actions
                    </h3>

                    {booking.status === "CANCELLED" ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-800">
                        This session has been cancelled. Your slot has been released.
                      </div>
                    ) : booking.flags.canReschedule || booking.flags.canCancel ? (
                      <>
                        {booking.flags.canReschedule ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              const contact =
                                emailOrPhoneInput.trim() ||
                                params.get("emailOrPhone")?.trim() ||
                                "";
                              if (!booking.customer.isVerified || !contact) {
                                setDetailsOpen(false);
                                setError(
                                  "Please provide your email or phone number above to verify ownership before rescheduling.",
                                );
                                return;
                              }
                              if (!emailOrPhoneInput.trim() && contact) {
                                setEmailOrPhoneInput(contact);
                              }
                              setRescheduleError(null);
                              setRescheduleReason("");
                              setShowRescheduleModal(true);
                            }}
                            className="w-full justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 text-amber-800" /> Reschedule Session
                            </span>
                            <span className="font-mono text-xs text-amber-800">15% fee</span>
                          </Button>
                        ) : null}

                        {booking.flags.canCancel ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!booking.customer.isVerified) {
                                setDetailsOpen(false);
                                setError(
                                  "Please provide your email or phone number above to verify ownership before cancelling.",
                                );
                                return;
                              }
                              setShowCancelModal(true);
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 transition-colors hover:border-rose-300 hover:bg-rose-100"
                          >
                            <span className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-rose-600" /> Cancel Booking
                            </span>
                            <span className="text-xs text-rose-600">No refund</span>
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600">
                        {booking.status === "COMPLETED" || booking.status === "NO_SHOW" ? (
                          <p>
                            This session is marked {booking.status.replace("_", " ").toLowerCase()}.
                            Reschedule and cancel are no longer available.
                          </p>
                        ) : (
                          <p>
                            Reschedule and cancel are only available{" "}
                            <strong className="font-medium text-zinc-800">before your session starts</strong>
                            . This booking&apos;s start time has already passed. Contact the studio if you
                            need help.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="border-t border-zinc-100 pt-3 text-center">
                      <Link
                        to="/book"
                        className="inline-flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-amber-800"
                      >
                        Book a new studio session <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              </DialogBody>

              {/* Nested dialogs — must live inside DialogContent so Radix pointer-events work */}
              <Dialog
                open={showRescheduleModal}
                onOpenChange={(open) => {
                  if (!open) setShowRescheduleModal(false);
                }}
              >
                <DialogContent
                  className="max-w-lg max-h-[min(90vh,40rem)]"
                  aria-describedby="reschedule-desc"
                >
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-sans text-base font-semibold sm:text-base">
                      <RefreshCw className="h-5 w-5 text-amber-800" />
                      Reschedule Session
                    </DialogTitle>
                    <DialogDescription id="reschedule-desc" className="sr-only">
                      Choose a new date and time for your session. A 15% reschedule fee applies.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogBody className="space-y-5 bg-white">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                      <p className="font-medium text-amber-900">Rescheduling Fee: 15%</p>
                      <p className="mt-1">
                        A 15% reschedule fee of{" "}
                        <strong className="font-mono text-zinc-900">
                          ₦{formatNairaFromKobo(booking.pricing.rescheduleFeeKobo)}
                        </strong>{" "}
                        will be applied. Your current booking slot will be released and shifted to
                        the newly selected time.
                      </p>
                    </div>

                    <div>
                      <label className="font-subtitle mb-2 block text-xs uppercase tracking-wider text-zinc-500">
                        Select New Date
                      </label>
                      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-2">
                        {Array.from({ length: 14 }, (_, i) => {
                          const key = addDaysToKey(lagosToday(), i + 1);
                          const isSelected = key === rescheduleDate;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setRescheduleDate(key)}
                              className={`flex min-w-[70px] shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2 text-xs transition-colors ${
                                isSelected
                                  ? "border-amber-800 bg-amber-800 text-white"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-amber-700/50"
                              }`}
                            >
                              <span className="font-medium">
                                {formatDateKey(key, { weekday: "short" })}
                              </span>
                              <span className="text-sm font-semibold">
                                {formatDateKey(key, { day: "numeric" })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="font-subtitle mb-2 block text-xs uppercase tracking-wider text-zinc-500">
                        Select Available Slot
                      </label>
                      {rescheduleLoadingSlots ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500">
                          <CameraSpinner /> Checking studio availability...
                        </div>
                      ) : rescheduleSlots.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center text-xs text-zinc-500">
                          No slots available on this date. Please pick another date.
                        </div>
                      ) : (
                        <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-1">
                          {rescheduleSlots.map((slotIso) => {
                            const isSelected = slotIso === rescheduleSlotIso;
                            return (
                              <button
                                key={slotIso}
                                type="button"
                                onClick={() => setRescheduleSlotIso(slotIso)}
                                className={`rounded-xl border px-3 py-2 text-center text-xs font-medium transition-colors ${
                                  isSelected
                                    ? "border-amber-800 bg-amber-800 text-white"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-amber-700/50"
                                }`}
                              >
                                {formatLagosTime(slotIso)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="font-subtitle mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
                        Reason for Rescheduling (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="e.g. Schedule conflict, traveling, etc."
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-700 focus:outline-none"
                      />
                    </div>

                    {rescheduleError ? (
                      <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                        {rescheduleError}
                      </p>
                    ) : null}

                    {!rescheduleLoadingSlots && rescheduleSlots.length > 0 && !rescheduleSlotIso ? (
                      <p className="text-xs text-amber-800">Select a time slot to enable confirm.</p>
                    ) : null}

                    {!rescheduleLoadingSlots && rescheduleSlots.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        Pick another date with available slots, then confirm.
                      </p>
                    ) : null}

                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowRescheduleModal(false)}
                        className="flex-1 text-xs"
                      >
                        Dismiss
                      </Button>
                      <Button
                        type="button"
                        disabled={rescheduling || !rescheduleSlotIso || rescheduleLoadingSlots}
                        onClick={() => void handleConfirmReschedule()}
                        className="flex-1 text-xs"
                      >
                        {rescheduling ? <CameraSpinner /> : <CheckCircle2 className="h-4 w-4" />}
                        Confirm Reschedule
                      </Button>
                    </div>
                  </DialogBody>
                </DialogContent>
              </Dialog>

              <Dialog
                open={showCancelModal}
                onOpenChange={(open) => {
                  if (!open) setShowCancelModal(false);
                }}
              >
                <DialogContent className="max-w-md" aria-describedby="cancel-desc">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 font-sans text-base font-semibold text-rose-800 sm:text-base">
                      <span className="rounded-full bg-rose-50 p-2">
                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-zinc-900">Cancel Booking</span>
                        <span className="mt-0.5 block font-mono text-xs font-normal text-rose-700">
                          {booking.reference}
                        </span>
                      </span>
                    </DialogTitle>
                    <DialogDescription id="cancel-desc" className="sr-only">
                      Confirm cancellation. All payments are non-refundable.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogBody className="space-y-4 bg-white">
                    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                      <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-rose-800">
                        <ShieldAlert className="h-4 w-4 text-rose-600" /> Strict No-Refund Contract
                        Policy
                      </p>
                      <p>
                        By proceeding with this cancellation, you acknowledge that{" "}
                        <strong className="text-rose-950">
                          100% of all payments made (₦
                          {formatNairaFromKobo(booking.pricing.paidKobo)}) are non-refundable and
                          will be forfeited
                        </strong>
                        .
                      </p>
                      <p className="text-rose-800">
                        You will receive <strong className="text-rose-950">₦0 in refund</strong>.
                        Your slot will be released immediately for other studio clients.
                      </p>
                    </div>

                    <div>
                      <label className="font-subtitle mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
                        Cancellation Reason (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Please tell us why you are cancelling..."
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-rose-400 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <label className="flex cursor-pointer select-none items-start gap-2.5 text-xs text-zinc-800">
                        <input
                          type="checkbox"
                          checked={cancelAcknowledged}
                          onChange={(e) => setCancelAcknowledged(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-300 text-rose-600 focus:ring-rose-500/20"
                        />
                        <span className="leading-snug">
                          I understand that I am forfeiting 100% of my session deposit/payment and
                          will receive <strong>NO refund (₦0)</strong>.
                        </span>
                      </label>
                    </div>

                    {cancelError ? (
                      <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                        {cancelError}
                      </p>
                    ) : null}

                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowCancelModal(false)}
                        className="flex-1 text-xs"
                      >
                        Keep Booking
                      </Button>
                      <button
                        type="button"
                        disabled={cancelling || !cancelAcknowledged}
                        onClick={handleConfirmCancel}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cancelling ? <CameraSpinner /> : <XCircle className="h-4 w-4" />}
                        Confirm Cancellation
                      </button>
                    </div>
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
