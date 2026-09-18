import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Calendar } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { formatLagosDateTime, formatLagosRange } from "../lib/datetime";
import { downloadIcs, googleCalendarUrl } from "../lib/calendar";
import {
  completeMockPayment,
  fetchBookingStatus,
  formatNairaFromKobo,
  verifyPayment,
  type BookingStatusResponse,
} from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { site } from "../lib/site";

/**
 * Mirrors backend truth only. The browser returning from Bachs is never treated as proof of payment.
 *  - success       booking CONFIRMED (webhook/server verification succeeded)
 *  - pending       payment not yet settled; poll briefly
 *  - failed        payment FAILED
 *  - expired       hold expired / booking CANCELLED before payment
 *  - paid_unplaced payment SUCCESS but slot could not be confirmed (taken meanwhile) — studio follows up
 */
type UiState = "loading" | "success" | "pending" | "failed" | "expired" | "paid_unplaced";

const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 2500;

/** Bachs appends `?checkout_id=…` to success_url; tolerate a naive append onto an existing query string. */
function cleanParam(value: string | null): string {
  return (value ?? "").split("?")[0]?.trim() ?? "";
}

function deriveState(status: BookingStatusResponse): Exclude<UiState, "loading"> {
  if (status.status === "CONFIRMED") return "success";
  if (status.payment?.status === "SUCCESS") return "paid_unplaced";
  if (status.payment?.status === "FAILED") return "failed";
  if (status.status === "CANCELLED") return "expired";
  return "pending";
}

const COPY: Record<Exclude<UiState, "loading">, { title: string; description: string }> = {
  success: {
    title: "You’re booked",
    description: "Your session is confirmed. We’ve noted the details below — add it to your calendar.",
  },
  pending: {
    title: "Payment pending",
    description:
      "We’re waiting for the payment provider to confirm. This usually takes a few seconds. If it stays pending, contact the studio with your reference — do not pay again.",
  },
  failed: {
    title: "Payment failed",
    description: "The payment did not go through and nothing was charged. You can try booking again.",
  },
  expired: {
    title: "Booking not completed",
    description:
      "This hold expired before payment was confirmed, so the slot was released. If you believe you were charged, contact the studio with your reference.",
  },
  paid_unplaced: {
    title: "Payment received — slot unavailable",
    description:
      "Your payment arrived after the hold expired and the slot was taken in the meantime. Your booking is not confirmed yet; the studio will contact you to reschedule.",
  },
};

export function BookConfirmationPage() {
  const [params] = useSearchParams();
  const reference = cleanParam(params.get("reference"));
  const bookingId = cleanParam(params.get("bookingId"));
  const isMock = params.get("mock") === "1";

  const [state, setState] = useState<UiState>("loading");
  const [booking, setBooking] = useState<BookingStatusResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function loadOnce(): Promise<BookingStatusResponse | null> {
      if (isMock && reference) {
        try {
          await completeMockPayment(reference);
        } catch {
          /* verify may still succeed if already completed */
        }
      }

      if (reference) {
        try {
          return await verifyPayment(reference);
        } catch {
          /* fall through to booking status */
        }
      }
      if (bookingId) {
        return fetchBookingStatus(bookingId);
      }
      return null;
    }

    async function run() {
      if (!reference && !bookingId) {
        setState("failed");
        setMessage("Missing booking reference.");
        return;
      }

      try {
        const status = await loadOnce();
        if (cancelled) return;
        if (!status) {
          setState("failed");
          setMessage(
            "We could not verify this payment. If you were charged, contact the studio with your reference.",
          );
          return;
        }

        setBooking(status);
        const next = deriveState(status);
        setState(next);
        if (next !== "pending") return;

        // Webhook / server-side verification is the source of truth — poll briefly while Bachs settles.
        if (attempts < MAX_POLL_ATTEMPTS) {
          attempts += 1;
          timer = window.setTimeout(() => {
            void run();
          }, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          setState("failed");
          setMessage(
            "Booking API unavailable while verifying payment. Please contact the studio with your reference.",
          );
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [reference, bookingId, isMock]);

  return (
    <>
      <Seo title="Booking confirmation" path="/book/confirmation" noIndex />
      <PageHeader
        eyebrow="Booking"
        title={state === "loading" ? "Confirming…" : state === "failed" && message ? "Something went wrong" : COPY[state].title}
        description={
          state === "loading"
            ? "Checking payment status…"
            : state === "failed" && message
              ? message
              : COPY[state].description
        }
      />
      <Section>
        <Container className="max-w-xl">
          {state === "loading" ? <p className="text-text-secondary">Please wait…</p> : null}

          {booking && state !== "loading" ? (
            <dl className="pa-card space-y-stack-sm text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Reference</dt>
                <dd>{booking.reference ?? booking.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Package</dt>
                <dd className="text-right">{booking.package.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">When (Lagos)</dt>
                <dd className="text-right">
                  {formatLagosDateTime(booking.startTime)}
                  <br />
                  {formatLagosRange(booking.startTime, booking.endTime)}
                </dd>
              </div>
              {booking.amountKobo != null ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Amount</dt>
                  <dd>{formatNairaFromKobo(booking.amountKobo)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Booking status</dt>
                <dd>{booking.status}</dd>
              </div>
              {booking.payment ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Payment status</dt>
                  <dd>{booking.payment.status}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-stack-lg flex flex-wrap gap-control">
            {state === "success" && booking ? (
              <>
                <Button
                  type="button"
                  onClick={() =>
                    window.open(
                      googleCalendarUrl(booking, site.address.full),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Google Calendar
                </Button>
                <Button type="button" variant="secondary" onClick={() => downloadIcs(booking, site.address.full)}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download .ics
                </Button>
              </>
            ) : null}
            <Button to="/" variant="secondary">
              Home
            </Button>
            {state === "failed" || state === "expired" ? (
              <Button to="/book" variant="ghost">
                Try booking again
              </Button>
            ) : null}
          </div>

          <p className="mt-stack-lg text-sm text-text-muted">
            Questions?{" "}
            <a href={site.phoneHref} className="text-accent">
              {site.phone}
            </a>{" "}
            ·{" "}
            <Link to="/contact" className="text-accent">
              Contact
            </Link>
          </p>
        </Container>
      </Section>
    </>
  );
}
