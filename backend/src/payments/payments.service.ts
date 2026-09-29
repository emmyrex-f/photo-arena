import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { bookingNotifyEmail } from "../common/booking-contact";
import { PrismaService } from "../prisma/prisma.service";
import { BookingsService } from "../bookings/bookings.service";
import { isPaymentsMockEnabled } from "../common/payments-mock";
import { assertCheckoutRedirectUrl } from "../common/site-origins";
import { blockingWhere } from "../bookings/blocking";
import { lockStudioResource, throwIfOverlap } from "../bookings/resource-lock";
import { slotFits } from "../bookings/availability";
import { PAYMENT_PROVIDER } from "./payment.constants";
import type { PaymentProvider, WebhookParseInput } from "./payment-provider";
import { AuditService } from "../audit/audit.service";
import { MockPaymentProvider } from "./mock-payment.provider";
import { providerAmountMatches } from "./payment-amount";

const HOLD_MINUTES = 15;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bookings: BookingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  isMockProvider() {
    return isPaymentsMockEnabled() && this.provider instanceof MockPaymentProvider;
  }

  /** Desk-facing status for go-live (Steps 9–12). Never returns secret values. */
  integrationStatus() {
    const apiKey = (this.config.get<string>("BACHS_API_KEY") ?? "").trim();
    const webhookSecret = (this.config.get<string>("BACHS_WEBHOOK_SECRET") ?? "").trim();
    const configuredBase = (this.config.get<string>("BACHS_BASE_URL") ?? "").trim();
    const publicBase =
      (this.config.get<string>("PUBLIC_API_URL") ?? "").trim() ||
      `http://localhost:${this.config.get<string>("PORT") ?? "3001"}`;

    let environment: "mock" | "sandbox" | "live" = "mock";
    if (apiKey.startsWith("sk_live_")) environment = "live";
    else if (apiKey.startsWith("sk_sandbox_") || apiKey) environment = "sandbox";

    return {
      provider: this.isMockProvider() ? ("mock" as const) : ("bachs" as const),
      environment,
      apiKeyConfigured: Boolean(apiKey),
      webhookSecretConfigured: Boolean(webhookSecret),
      baseUrl:
        environment === "live"
          ? "https://api.bachs.io"
          : configuredBase || "https://sandbox-api.bachs.io",
      webhookPath: "/api/payments/webhook/bachs",
      webhookUrl: `${publicBase.replace(/\/$/, "")}/api/payments/webhook/bachs`,
      events: [
        "collection.succeeded",
        "collection.failed",
        "collection.abandoned",
        "collection.underpaid",
        "checkout.completed",
        "checkout.expired",
      ] as const,
      mockCheckout: this.isMockProvider(),
      readyForSandboxWebhooks: Boolean(webhookSecret),
      readyForLive:
        apiKey.startsWith("sk_live_") && Boolean(webhookSecret) && !this.isMockProvider(),
    };
  }

  async checkout(bookingId: string, returnUrl: string, cancelUrl: string, reference: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, package: true, payments: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (!reference || booking.reference !== reference) {
      throw new BadRequestException("Booking reference does not match");
    }
    if (booking.status !== BookingStatus.TEMPORARY_HOLD) {
      throw new BadRequestException("Checkout requires an active temporary hold");
    }
    if (!booking.holdExpiresAt || booking.holdExpiresAt.getTime() < Date.now()) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
      });
      throw new GoneException("Hold has expired");
    }

    let safeReturn: string;
    let safeCancel: string;
    try {
      safeReturn = assertCheckoutRedirectUrl(returnUrl, "return");
      safeCancel = assertCheckoutRedirectUrl(cancelUrl, "cancel");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid checkout URL");
    }

    if (!booking.reference) {
      throw new BadRequestException("Booking reference is missing");
    }
    const amountKobo = booking.amountKobo ?? booking.package.priceKobo;
    const paymentReference = booking.reference;
    const email = bookingNotifyEmail(booking);
    if (!email) throw new BadRequestException("Booking contact email is required for checkout");
    const remainingHoldMinutes = Math.max(
      1,
      Math.ceil((booking.holdExpiresAt.getTime() - Date.now()) / 60_000),
    );
    const expiresInMinutes = Math.min(HOLD_MINUTES, remainingHoldMinutes);

    const existingPending = booking.payments.find(
      (p) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING,
    );

    const session = await this.provider.createCheckoutSession({
      reference: existingPending?.reference ?? paymentReference,
      amountKobo: existingPending?.amountKobo ?? amountKobo,
      currency: "NGN",
      customerEmail: email,
      customerName: booking.customer.name,
      customerPhone: booking.customer.phone,
      returnUrl: safeReturn,
      cancelUrl: safeCancel,
      expiresInMinutes,
    });

    if (existingPending) {
      await this.prisma.payment.update({
        where: { id: existingPending.id },
        data: {
          status: PaymentStatus.PROCESSING,
          provider: session.provider,
          providerSessionId: session.providerSessionId ?? existingPending.providerSessionId,
        },
      });
      return {
        provider: session.provider as "mock" | "bachs",
        checkoutUrl: session.checkoutUrl,
        reference: existingPending.reference,
      };
    }

    await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amountKobo,
        currency: "NGN",
        status: PaymentStatus.PROCESSING,
        method: "ONLINE_BACHS",
        provider: session.provider,
        reference: paymentReference,
        providerSessionId: session.providerSessionId,
      },
    });

    return {
      provider: session.provider as "mock" | "bachs",
      checkoutUrl: session.checkoutUrl,
      reference: paymentReference,
    };
  }

  async statusByBookingId(bookingId: string, reference: string) {
    return this.bookings.publicStatus(bookingId, reference);
  }

  async customerBalanceCheckout(
    reference: string,
    emailOrPhone: string,
    returnUrl: string,
    cancelUrl: string,
  ) {
    const ref = reference?.trim();
    if (!ref) throw new BadRequestException("Booking reference is required");

    const booking = await this.prisma.booking.findFirst({
      where: {
        OR: [
          { reference: { equals: ref, mode: "insensitive" } },
          { id: ref },
        ],
      },
      include: { customer: true, package: true, payments: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");

    // Verify customer ownership (booking contact email OR CRM email OR phone)
    const input = (emailOrPhone ?? "").trim().toLowerCase();
    const phoneDigits = input.replace(/\D/g, "");
    const contactEmail = bookingNotifyEmail(booking);
    const custEmail = (booking.customer.email ?? "").toLowerCase();
    const custPhone = booking.customer.phone.replace(/\D/g, "");

    const matchesEmail = Boolean(
      (contactEmail && input === contactEmail) || (custEmail && input === custEmail),
    );
    const matchesPhone = Boolean(phoneDigits && custPhone && (custPhone.endsWith(phoneDigits) || phoneDigits.endsWith(custPhone)));

    if (!matchesEmail && !matchesPhone) {
      throw new ForbiddenException("Email or phone number does not match this booking record");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException("Cannot pay for a cancelled booking");
    }

    const totalPaidKobo = booking.payments
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amountKobo, 0);

    const pendingFees = booking.payments.filter((p) => p.status === PaymentStatus.PENDING);
    const processingOnline = booking.payments.filter(
      (p) => p.status === PaymentStatus.PROCESSING && p.method === "ONLINE_BACHS",
    );
    const pendingFeeTotal = pendingFees.reduce((sum, p) => sum + p.amountKobo, 0);

    const baseDue = booking.amountKobo ?? booking.package.priceKobo;
    const outstandingBase = Math.max(0, baseDue - totalPaidKobo);
    const totalOutstanding = outstandingBase + pendingFeeTotal;

    if (totalOutstanding <= 0 && processingOnline.length === 0) {
      throw new BadRequestException("No outstanding balance on this booking");
    }

    let safeReturn: string;
    let safeCancel: string;
    try {
      safeReturn = assertCheckoutRedirectUrl(returnUrl, "return");
      safeCancel = assertCheckoutRedirectUrl(cancelUrl, "cancel");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid checkout URL");
    }

    // Reuse an in-flight online balance checkout when it already covers the open amount.
    const reusable = processingOnline.find((p) => p.amountKobo === totalOutstanding && totalOutstanding > 0)
      ?? (totalOutstanding <= 0 ? processingOnline[0] : undefined);
    if (reusable) {
      const reuseEmail = bookingNotifyEmail(booking);
      if (!reuseEmail) throw new BadRequestException("Booking contact email is required for checkout");
      const session = await this.provider.createCheckoutSession({
        reference: reusable.reference,
        amountKobo: reusable.amountKobo,
        currency: "NGN",
        customerEmail: reuseEmail,
        customerName: booking.customer.name,
        customerPhone: booking.customer.phone,
        returnUrl: safeReturn,
        cancelUrl: safeCancel,
        expiresInMinutes: 30,
      });
      await this.prisma.payment.update({
        where: { id: reusable.id },
        data: {
          provider: session.provider,
          providerSessionId: session.providerSessionId ?? reusable.providerSessionId,
        },
      });
      return {
        provider: session.provider as "mock" | "bachs",
        checkoutUrl: session.checkoutUrl,
        reference: reusable.reference,
        amountKobo: reusable.amountKobo,
      };
    }

    if (totalOutstanding <= 0) {
      throw new BadRequestException("No outstanding balance on this booking");
    }

    const checkoutRef = `bal_${booking.reference ?? booking.id}_${Date.now()}`;
    const balanceEmail = bookingNotifyEmail(booking);
    if (!balanceEmail) throw new BadRequestException("Booking contact email is required for checkout");
    const session = await this.provider.createCheckoutSession({
      reference: checkoutRef,
      amountKobo: totalOutstanding,
      currency: "NGN",
      customerEmail: balanceEmail,
      customerName: booking.customer.name,
      customerPhone: booking.customer.phone,
      returnUrl: safeReturn,
      cancelUrl: safeCancel,
      expiresInMinutes: 30,
    });

    // Supersede pending studio fee lines — collected via this single online checkout.
    if (pendingFees.length > 0) {
      await this.prisma.payment.updateMany({
        where: { id: { in: pendingFees.map((p) => p.id) } },
        data: { status: PaymentStatus.FAILED },
      });
    }
    // Drop stale processing checkouts that no longer match the due amount.
    if (processingOnline.length > 0) {
      await this.prisma.payment.updateMany({
        where: { id: { in: processingOnline.map((p) => p.id) } },
        data: { status: PaymentStatus.FAILED },
      });
    }

    await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amountKobo: totalOutstanding,
        currency: "NGN",
        status: PaymentStatus.PROCESSING,
        method: "ONLINE_BACHS",
        provider: session.provider,
        reference: checkoutRef,
        providerSessionId: session.providerSessionId,
      },
    });

    return {
      provider: session.provider as "mock" | "bachs",
      checkoutUrl: session.checkoutUrl,
      reference: checkoutRef,
      amountKobo: totalOutstanding,
    };
  }

  private async resolvePaymentByWebhook(reference: string, providerSessionId?: string) {
    if (reference) {
      const byRef = await this.prisma.payment.findUnique({
        where: { reference },
        include: { booking: { include: { customer: true, package: true } } },
      });
      if (byRef) return byRef;
    }
    if (providerSessionId) {
      return this.prisma.payment.findFirst({
        where: { providerSessionId },
        include: { booking: { include: { customer: true, package: true } } },
      });
    }
    return null;
  }

  /**
   * Desk note when Bachs reports a different amount/currency than the frozen Payment.
   * Does not change payment or booking status — confirmation must not proceed.
   */
  private async flagAmountMismatch(bookingId: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { notes: true },
    });
    if (!booking) return;
    const marker = "AMOUNT_MISMATCH";
    if (booking.notes?.includes(marker)) return;
    const notes = [booking.notes, marker, reason].filter(Boolean).join("\n");
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { notes },
    });
  }

  /**
   * Online Bachs confirmation only. Studio Mark Paid uses BookingsService.recordStudioPayment.
   * Provider amount/currency (when present) must match the frozen Payment row before SUCCESS.
   */
  private async confirmPayment(
    reference: string,
    opts?: {
      transactionId?: string;
      providerSessionId?: string;
      amount?: string;
      currency?: string;
    },
  ) {
    const transactionId = opts?.transactionId;
    const providerSessionId = opts?.providerSessionId;

    const payment =
      (await this.prisma.payment.findUnique({
        where: { reference },
        include: { booking: { include: { customer: true, package: true } } },
      })) ??
      (providerSessionId
        ? await this.prisma.payment.findFirst({
            where: { providerSessionId },
            include: { booking: { include: { customer: true, package: true } } },
          })
        : null);

    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.SUCCESS) {
      return this.bookings.publicStatus(payment.bookingId, payment.reference);
    }

    const amountCheck = providerAmountMatches(
      { amountKobo: payment.amountKobo, currency: payment.currency },
      opts?.amount,
      opts?.currency,
    );
    if (!amountCheck.ok) {
      await this.flagAmountMismatch(payment.bookingId, amountCheck.reason);
      throw new BadRequestException(`Payment amount mismatch: ${amountCheck.reason}`);
    }

    type ConfirmResult = "already" | "confirmed" | "unplaced";

    const cmsHours = await this.bookings.getCmsHours();
    let outcome: ConfirmResult = "already";
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await lockStudioResource(tx, payment.booking.resourceId);

        const result = await tx.payment.updateMany({
          where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
          data: {
            status: PaymentStatus.SUCCESS,
            transactionId: transactionId ?? payment.transactionId,
            providerSessionId: providerSessionId ?? payment.providerSessionId,
            paidAt: new Date(),
          },
        });
        if (result.count === 0) return "already" as const;

        const booking = await tx.booking.findUnique({
          where: { id: payment.bookingId },
          include: { package: true },
        });
        if (!booking) return "already" as const;

        if (booking.status === BookingStatus.CONFIRMED) {
          return "already" as const;
        }
        if (
          booking.status === BookingStatus.COMPLETED ||
          booking.status === BookingStatus.NO_SHOW
        ) {
          return "unplaced" as const;
        }

        const existing = await tx.booking.findMany({
          where: { resourceId: booking.resourceId, ...blockingWhere(booking.id) },
          select: { startTime: true, endTime: true },
        });
        const duration =
          booking.package.durationMinutes ||
          Math.max(1, Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 60_000));
        const free = slotFits(booking.startTime, duration, new Date(), existing, {
          requireSameDayNotice: false,
          cmsHours,
        });

        if (free) {
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.CONFIRMED,
              holdExpiresAt: null,
            },
          });
          return "confirmed" as const;
        }

        const marker = "PAID_UNPLACED";
        const notes = booking.notes?.includes(marker)
          ? booking.notes
          : [booking.notes, marker, "Payment received after the slot was taken."].filter(Boolean).join("\n");
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status:
              booking.status === BookingStatus.TEMPORARY_HOLD
                ? BookingStatus.CANCELLED
                : booking.status,
            holdExpiresAt: null,
            notes,
          },
        });
        return "unplaced" as const;
      });
    } catch (error) {
      throwIfOverlap(error);
    }

    if (outcome === "already") {
      return this.bookings.publicStatus(payment.bookingId, payment.reference);
    }

    const b = payment.booking;
    const publicRef = payment.reference;
    const customerEmail = [bookingNotifyEmail(b)].filter(Boolean);

    void this.notifications.notifyEvent(
      "payment_received",
      {
        customerName: b.customer.name,
        reference: publicRef,
        amount: `₦${(payment.amountKobo / 100).toLocaleString("en-NG")}`,
        startTime: b.startTime.toISOString(),
        details: outcome === "unplaced" ? "PAID_UNPLACED: slot was taken before confirmation." : "",
      },
      outcome === "unplaced" ? [] : customerEmail,
    );

    if (outcome === "confirmed") {
      void this.notifications.notifyEvent(
        "booking_confirmed",
        {
          customerName: b.customer.name,
          reference: b.reference ?? b.id,
          startTime: b.startTime.toISOString(),
        },
        customerEmail,
      );
    }

    return this.bookings.publicStatus(payment.bookingId, payment.reference);
  }

  async mockComplete(reference: string) {
    if (!this.isMockProvider()) {
      throw new ForbiddenException("Mock completion is disabled");
    }
    if (!reference) throw new BadRequestException("reference is required");
    if (this.provider instanceof MockPaymentProvider) {
      this.provider.markCompleted(reference);
    }
    return this.confirmPayment(reference);
  }

  async verify(reference: string) {
    if (!reference) throw new BadRequestException("reference is required");
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.SUCCESS) {
      return this.bookings.publicStatus(payment.bookingId, payment.reference);
    }

    const result = await this.provider.verifyTransaction({
      reference,
      providerSessionId: payment.providerSessionId,
    });
    if (result.success) {
      const amountCheck = providerAmountMatches(
        { amountKobo: payment.amountKobo, currency: payment.currency },
        result.amount,
        result.currency,
      );
      if (!amountCheck.ok) {
        await this.flagAmountMismatch(payment.bookingId, amountCheck.reason);
        return this.bookings.publicStatus(payment.bookingId, payment.reference);
      }
      return this.confirmPayment(reference, {
        transactionId: result.transactionId,
        providerSessionId: result.providerSessionId,
        amount: result.amount,
        currency: result.currency,
      });
    }
    return this.bookings.publicStatus(payment.bookingId, payment.reference);
  }

  async handleBachsWebhook(input: WebhookParseInput) {
    let event;
    try {
      event = await this.provider.parseWebhook(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook rejected";
      if (message.toLowerCase().includes("signature") || message.toLowerCase().includes("secret")) {
        throw new UnauthorizedException(message);
      }
      throw new BadRequestException(message);
    }

    if (event.eventId) {
      const seen = await this.prisma.processedWebhookEvent.findUnique({
        where: { id: event.eventId },
      });
      if (seen) {
        return { received: true as const, duplicate: true as const };
      }
    }

    const payment = await this.resolvePaymentByWebhook(event.reference, event.providerSessionId);

    let ignored: "amount_mismatch" | undefined;

    if (event.success) {
      if (!payment) {
        throw new NotFoundException("Payment not found for webhook reference");
      }
      const amountCheck = providerAmountMatches(
        { amountKobo: payment.amountKobo, currency: payment.currency },
        event.amount,
        event.currency,
      );
      if (!amountCheck.ok) {
        await this.flagAmountMismatch(payment.bookingId, amountCheck.reason);
        ignored = "amount_mismatch";
      } else {
        try {
          await this.confirmPayment(payment.reference, {
            transactionId: event.transactionId,
            providerSessionId: event.providerSessionId,
            amount: event.amount,
            currency: event.currency,
          });
        } catch (error) {
          if (error instanceof BadRequestException) {
            const msg = error.message ?? "";
            if (msg.includes("Payment amount mismatch")) {
              ignored = "amount_mismatch";
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    } else if (event.failed && payment && payment.status !== PaymentStatus.SUCCESS) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerSessionId: event.providerSessionId ?? payment.providerSessionId,
        },
      });
      void this.notifications.notifyEvent("payment_failed", {
        customerName: payment.booking.customer.name,
        reference: payment.reference,
        startTime: payment.booking.startTime.toISOString(),
      });
    } else if (event.abandoned && payment) {
      if (payment.status !== PaymentStatus.SUCCESS) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            providerSessionId: event.providerSessionId ?? payment.providerSessionId,
          },
        });
      }

      if (
        payment.booking.status === BookingStatus.TEMPORARY_HOLD ||
        payment.booking.status === BookingStatus.PENDING
      ) {
        await this.prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CANCELLED },
        });
      }

      // Notify customer and studio admin on abandon process
      void this.notifications.notifyEvent(
        "checkout_abandoned",
        {
          customerName: payment.booking.customer.name,
          reference: payment.booking.reference ?? payment.booking.id,
          startTime: payment.booking.startTime.toISOString(),
          details: `Checkout incomplete (${event.rawType}). The temporary booking hold has been released.`,
        },
        [bookingNotifyEmail(payment.booking)].filter(Boolean),
      );

      await this.audit.log({
        userEmail: "webhook@bachs.io",
        action: "payment.abandon_webhook",
        entity: "payment",
        entityId: payment.id,
        meta: {
          event: event.rawType,
          bookingId: payment.bookingId,
          reference: payment.reference,
        },
      });
    }

    if (event.eventId) {
      try {
        await this.prisma.processedWebhookEvent.create({
          data: {
            id: event.eventId,
            provider: "bachs",
            type: event.rawType,
            reference: payment?.reference ?? (event.reference || null),
          },
        });
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String((error as { code?: string }).code)
            : "";
        if (code === "P2002") {
          return { received: true as const, duplicate: true as const, ...(ignored ? { ignored } : {}) };
        }
        throw error;
      }
    }

    return { received: true as const, ...(ignored ? { ignored } : {}) };
  }

  async refundPayment(
    paymentId: string,
    actorId: string,
    actorEmail: string,
    dto: { amountKobo?: number; reason: string },
  ) {
    throw new BadRequestException(
      "Photo Arena operates a strict no-refund policy. Refunds are not supported.",
    );
  }
}
