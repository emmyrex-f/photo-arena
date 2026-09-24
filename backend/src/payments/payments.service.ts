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
import { PrismaService } from "../prisma/prisma.service";
import { BookingsService } from "../bookings/bookings.service";
import { isPaymentsMockEnabled } from "../common/payments-mock";
import { assertCheckoutRedirectUrl } from "../common/site-origins";
import { blockingWhere } from "../bookings/blocking";
import { lockStudioResource, throwIfOverlap } from "../bookings/resource-lock";
import { slotFits } from "../bookings/availability";
import { PAYMENT_PROVIDER } from "./payment.constants";
import type { PaymentProvider, WebhookParseInput } from "./payment-provider";
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
        "refund.paid",
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
    const email = booking.customer.email ?? "guest@photoarenang.com";
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
    const customerEmail = [b.customer.email ?? ""].filter(Boolean);

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
    }
    // abandoned / underpaid / expired / refund.* → acknowledge only; booking stays unpaid/pending

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
}
