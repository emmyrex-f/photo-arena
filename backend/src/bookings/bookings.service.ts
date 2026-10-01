import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BookingStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { newPaymentReference } from "../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublicService } from "../public/public.service";
import {
  addLagosDays,
  BOOKING_RULES,
  generateCandidateStartsForYmd,
  slotFits,
  startOfLagosDay,
  toLagosYmd,
} from "./availability";
import { blockingWhere, expiredHoldWhere } from "./blocking";
import { SLOT_TAKEN_MESSAGE, lockStudioResource, throwIfOverlap } from "./resource-lock";
import type { CreateAdminBookingDto } from "./dto/create-admin-booking.dto";
import type {
  CustomerCancelBookingDto,
  CustomerRescheduleBookingDto,
} from "./dto/customer-self-service.dto";
import { HOLD_ACTIVE_PER_PHONE } from "../common/rate-limit";
import { bookingNotifyEmail } from "../common/booking-contact";

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [user, domain] = parts;
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}${"*".repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}@${domain}`;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\s+/g, "");
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

function requireNotifyEmail(booking: {
  contactEmail?: string | null;
  customer: { email: string | null };
}): string {
  const email = bookingNotifyEmail(booking);
  if (!email) {
    throw new BadRequestException("This booking has no contact email for messaging");
  }
  return email;
}

function normalizeRequiredEmail(raw: string | undefined | null, label = "Email"): string {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) throw new BadRequestException(`${label} is required`);
  return email;
}

const bookingInclude = {
  customer: true,
  package: { include: { service: true } },
  payments: true,
} satisfies Prisma.BookingInclude;

const ALLOWED_STATUS: Record<BookingStatus, BookingStatus[]> = {
  TEMPORARY_HOLD: ["CANCELLED"],
  PENDING: ["CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    private readonly publicService: PublicService,
  ) {}

  /**
   * The studio is a single bookable resource: every availability and overlap check
   * is scoped to it. More than one active row would silently split those checks,
   * so refuse to serve bookings instead of picking an arbitrary studio.
   */
  async activeResource() {
    const resources = await this.prisma.studioResource.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    if (resources.length > 1) {
      this.logger.error(
        `Found ${resources.length} active studio resources; bookings are disabled until one remains active`,
      );
      throw new ConflictException("Studio availability is misconfigured");
    }
    return resources[0] ?? null;
  }

  private async requireActiveResource() {
    const resource = await this.activeResource();
    if (!resource) throw new BadRequestException("No studio resource is configured");
    return resource;
  }

  async getCmsHours(): Promise<Record<string, string>> {
    const rows = await this.prisma.businessSettings.findMany({
      where: { key: { in: ["site.hours.weekday", "site.hours.sunday"] } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async getHoldDurationMinutes(): Promise<number> {
    const row = await this.prisma.businessSettings.findUnique({
      where: { key: "site.booking.holdMinutes" },
    });
    if (row?.value) {
      const val = parseInt(row.value, 10);
      if (!Number.isNaN(val) && val >= 5 && val <= 120) {
        return val;
      }
    }
    return BOOKING_RULES.holdDurationMinutes;
  }

  async availability(ymd: string, durationMinutes: number, options?: { requireSameDayNotice?: boolean }) {
    const resource = await this.activeResource();
    const existing = resource
      ? await this.prisma.booking.findMany({
          where: { resourceId: resource.id, ...blockingWhere() },
          select: { startTime: true, endTime: true },
        })
      : [];

    const cmsHours = await this.getCmsHours();
    const now = new Date();
    const slots = generateCandidateStartsForYmd(ymd, cmsHours)
      .filter((start) => slotFits(start, durationMinutes, now, existing, { ...options, cmsHours }))
      .map((start) => start.toISOString());

    return {
      rules: BOOKING_RULES,
      date: ymd,
      durationMinutes,
      slots,
    };
  }

  async list(ymd: string) {
    const from = startOfLagosDay(ymd);
    const to = startOfLagosDay(addLagosDays(ymd, 1));
    return this.prisma.booking.findMany({
      where: { startTime: { gte: from, lt: to } },
      include: bookingInclude,
      orderBy: { startTime: "asc" },
    });
  }

  async listRange(fromYmd: string, toYmd: string, status?: string, q?: string) {
    const from = startOfLagosDay(fromYmd);
    const toExclusive = startOfLagosDay(addLagosDays(toYmd, 1));
    const where: Prisma.BookingWhereInput = {
      startTime: { gte: from, lt: toExclusive },
      ...(status ? { status: status as BookingStatus } : {}),
      ...(q
        ? {
            OR: [
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { customer: { phone: { contains: q } } },
              { customer: { email: { contains: q, mode: "insensitive" } } },
              { reference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { startTime: "asc" },
    });
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }

  async listPackages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      include: { service: true },
      orderBy: [{ service: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
  }

  async publicPackages() {
    return this.publicService.services();
  }

  async hold(input: {
    packageId: string;
    startTime: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
  }) {
    await this.pricing.refresh();
    const pkg = await this.prisma.package.findUnique({ where: { id: input.packageId } });
    if (!pkg?.isActive) throw new BadRequestException("Choose an active package");

    const resource = await this.requireActiveResource();

    const start = new Date(input.startTime);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Invalid start time");
    const end = new Date(start.getTime() + pkg.durationMinutes * 60_000);
    const holdMinutes = await this.getHoldDurationMinutes();
    const cmsHours = await this.getCmsHours();
    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000);
    const baseKobo = pkg.priceKobo;
    const discountKobo = this.pricing.calculateDiscountKobo(baseKobo, "ONLINE");
    const payableKobo = this.pricing.calculatePayableKobo(baseKobo, "ONLINE");
    const reference = newPaymentReference();

    const booking = await this.prisma.$transaction(async (tx) => {
      await lockStudioResource(tx, resource.id);

      const phone = input.customerPhone.trim();
      const activeHolds = await tx.booking.count({
        where: {
          status: BookingStatus.TEMPORARY_HOLD,
          holdExpiresAt: { gt: new Date() },
          customer: { phone },
        },
      });
      if (activeHolds >= HOLD_ACTIVE_PER_PHONE) {
        throw new ConflictException("Too many unpaid bookings for this phone number. Complete one payment first.");
      }

      const existing = await tx.booking.findMany({
        where: { resourceId: resource.id, ...blockingWhere() },
        select: { startTime: true, endTime: true },
      });
      if (!slotFits(start, pkg.durationMinutes, new Date(), existing, { requireSameDayNotice: true, cmsHours })) {
        throw new ConflictException(SLOT_TAKEN_MESSAGE);
      }

      const duplicate = await tx.booking.findFirst({
        where: {
          customer: { phone },
          startTime: start,
          OR: [
            { status: BookingStatus.CONFIRMED },
            { status: BookingStatus.TEMPORARY_HOLD, holdExpiresAt: { gt: new Date() } },
          ],
        },
      });
      if (duplicate) {
        throw new ConflictException("You already have an active booking or hold for this time slot");
      }


      const email = normalizeRequiredEmail(input.customerEmail, "Customer email");
      const name = input.customerName.trim();
      // Phone is the CRM key. Never overwrite an existing profile email — the typed address
      // is stored on the booking as contactEmail and used for reminders/receipts.
      const existingCustomer = await tx.customer.findUnique({ where: { phone } });
      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: { name },
          })
        : await tx.customer.create({
            data: { name, phone, email },
          });

      try {
        return await tx.booking.create({
          data: {
            customerId: customer.id,
            packageId: pkg.id,
            resourceId: resource.id,
            startTime: start,
            endTime: end,
            status: BookingStatus.TEMPORARY_HOLD,
            source: "ONLINE",
            holdExpiresAt,
            amountKobo: payableKobo,
            reference,
            contactEmail: email,
          },
          include: { package: true, customer: true },
        });
      } catch (error) {
        throwIfOverlap(error);
      }
    });

    return {
      bookingId: booking.id,
      reference,
      status: "TEMPORARY_HOLD" as const,
      holdExpiresAt: holdExpiresAt.toISOString(),
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      package: {
        id: booking.package.id,
        name: booking.package.name,
        durationMinutes: booking.package.durationMinutes,
      },
      pricing: {
        baseKobo,
        discountKobo,
        payableKobo,
        discountPercent: this.pricing.getOnlineDiscountBps() / 100,
      },
    };
  }

  /**
   * Public confirmation/status view. Requires the booking payment `reference`
   * (issued at hold / returned in the confirmation URL) — booking id alone is not enough.
   * Does not expose customer email or phone.
   */
  async publicStatus(id: string, reference?: string | null) {
    const provided = typeof reference === "string" ? reference.trim() : "";
    if (!provided) {
      throw new BadRequestException("Booking reference is required");
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        package: true,
        customer: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (!booking.reference || booking.reference !== provided) {
      throw new ForbiddenException("Booking reference does not match");
    }

    const payment = booking.payments[0] ?? null;
    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      package: {
        name: booking.package.name,
        durationMinutes: booking.package.durationMinutes,
      },
      customer: {
        name: booking.customer.name,
      },
      amountKobo: booking.amountKobo,
      payment: payment
        ? {
            status: payment.status,
            method: payment.method,
            provider: payment.provider,
            paidAt: payment.paidAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async createAdmin(dto: CreateAdminBookingDto) {
    await this.pricing.refresh();
    const pkg = await this.prisma.package.findUnique({ where: { id: dto.packageId } });
    if (!pkg?.isActive) throw new BadRequestException("Choose an active package");

    const resource = await this.requireActiveResource();

    const start = new Date(dto.startTime);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Invalid start time");
    const end = new Date(start.getTime() + pkg.durationMinutes * 60_000);
    const amountKobo = this.pricing.calculatePayableKobo(pkg.priceKobo, dto.source);
    const reference = newPaymentReference();
    const cmsHours = await this.getCmsHours();

    const booking = await this.prisma.$transaction(async (tx) => {
      await lockStudioResource(tx, resource.id);
      const existing = await tx.booking.findMany({
        where: { resourceId: resource.id, ...blockingWhere() },
        select: { startTime: true, endTime: true },
      });

      if (!slotFits(start, pkg.durationMinutes, new Date(), existing, { requireSameDayNotice: false, cmsHours })) {
        throw new ConflictException("That slot is not available");
      }

      const phone = dto.customerPhone.trim();
      const email = normalizeRequiredEmail(dto.customerEmail, "Customer email");
      const existingCustomer = await tx.customer.findUnique({ where: { phone } });
      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: { name: dto.customerName.trim() },
          })
        : await tx.customer.create({
            data: { name: dto.customerName.trim(), phone, email },
          });

      try {
        return await tx.booking.create({
          data: {
            customerId: customer.id,
            packageId: pkg.id,
            resourceId: resource.id,
            startTime: start,
            endTime: end,
            status: BookingStatus.PENDING,
            source: dto.source,
            notes: dto.notes?.trim() || null,
            amountKobo,
            reference,
            contactEmail: email,
          },
          include: bookingInclude,
        });
      } catch (error) {
        throwIfOverlap(error);
      }
    });

    void this.notifications.notifyEvent(
      "booking_created",
      {
        customerName: booking.customer.name,
        startTime: booking.startTime.toISOString(),
        reference,
        details: `Admin booking (${dto.source})`,
      },
      [requireNotifyEmail(booking)],
    );

    return booking;
  }

  /**
   * Studio Mark Paid — ignores any client amount. Charges the full outstanding
   * (frozen booking.amountKobo, else PricingService by source) and confirms only when paid in full.
   */
  async recordStudioPayment(
    id: string,
    opts?: {
      note?: string;
      amountKobo?: number;
      channel?: "CASH" | "POS" | "TRANSFER";
      reference?: string;
    },
  ): Promise<{ booking: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>; amountKobo: number }> {
    await this.pricing.refresh();
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { package: true, payments: true, customer: true },
      });
      if (!booking) throw new NotFoundException("Booking not found");
      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.status === BookingStatus.COMPLETED
      ) {
        throw new BadRequestException("Cannot record payment on a completed or cancelled booking");
      }

      const dueKobo =
        booking.amountKobo != null && booking.amountKobo > 0
          ? booking.amountKobo
          : this.pricing.calculatePayableKobo(booking.package.priceKobo, booking.source);
      if (dueKobo < 0) {
        throw new BadRequestException("Booking has no payable amount");
      }

      const paidKobo = booking.payments
        .filter((p) => p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amountKobo - (p.refundedAmountKobo ?? 0), 0);
      const openFees = booking.payments.filter(
        (p) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING,
      );
      const openFeeTotal = openFees.reduce((sum, p) => sum + p.amountKobo, 0);
      const outstandingBase = Math.max(0, dueKobo - paidKobo);
      const outstanding = outstandingBase + openFeeTotal;
      if (outstanding <= 0) {
        throw new BadRequestException("Nothing outstanding on this booking");
      }

      if (opts?.amountKobo && opts.amountKobo > outstanding) {
        throw new BadRequestException(
          `Payment amount exceeds outstanding balance of ₦${(outstanding / 100).toLocaleString("en-NG")}`,
        );
      }

      const amountKobo = opts?.amountKobo ?? outstanding;
      const channel = opts?.channel ?? "CASH";
      const reference = opts?.reference?.trim() || `studio_${booking.id}_${Date.now()}`;

      // Settle open fee / checkout lines so studio payment does not double-count them later.
      if (openFees.length > 0) {
        await tx.payment.updateMany({
          where: { id: { in: openFees.map((p) => p.id) } },
          data: { status: PaymentStatus.FAILED },
        });
      }

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amountKobo,
          currency: "NGN",
          status: PaymentStatus.SUCCESS,
          method: PaymentMethod.STUDIO,
          provider: `studio:${channel.toLowerCase()}`,
          channel,
          reference,
          paidAt: new Date(),
        },
      });

      if (opts?.note) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            notes: booking.notes ? `${booking.notes}\n${opts.note}` : opts.note,
          },
        });
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED },
        include: bookingInclude,
      });

      void this.notifications.notifyEvent(
        "payment_received",
        {
          customerName: booking.customer.name,
          reference: booking.reference ?? booking.id,
          amount: `₦${(amountKobo / 100).toLocaleString("en-NG")}`,
          startTime: booking.startTime.toISOString(),
        },
        [requireNotifyEmail(booking)],
      );
      void this.notifications.notifyEvent(
        "booking_confirmed",
        {
          customerName: booking.customer.name,
          reference: booking.reference ?? booking.id,
          startTime: booking.startTime.toISOString(),
        },
        [requireNotifyEmail(booking)],
      );

      return { booking: updated, amountKobo };
    });
  }

  async updateNotes(id: string, notes?: string) {
    await this.get(id);
    return this.prisma.booking.update({
      where: { id },
      data: { notes: notes ?? null },
      include: bookingInclude,
    });
  }

  async reschedule(id: string, startTimeIso: string) {
    await this.pricing.refresh();
    const booking = await this.get(id);
    if (
      !([BookingStatus.PENDING, BookingStatus.CONFIRMED] as BookingStatus[]).includes(booking.status)
    ) {
      throw new BadRequestException("Only pending or confirmed bookings can be rescheduled");
    }

    const start = new Date(startTimeIso);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Invalid start time");
    const end = new Date(start.getTime() + booking.package.durationMinutes * 60_000);
    const fee = this.pricing.calculateRescheduleFeeKobo(booking.package.priceKobo);
    const cmsHours = await this.getCmsHours();

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockStudioResource(tx, booking.resourceId);
      const existing = await tx.booking.findMany({
        where: { resourceId: booking.resourceId, ...blockingWhere(booking.id) },
        select: { startTime: true, endTime: true },
      });
      if (
        !slotFits(start, booking.package.durationMinutes, new Date(), existing, {
          requireSameDayNotice: false,
          cmsHours,
        })
      ) {
        throw new ConflictException("That slot is not available");
      }

      const snapshot = await tx.booking.create({
        data: {
          customerId: booking.customerId,
          packageId: booking.packageId,
          resourceId: booking.resourceId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: BookingStatus.CANCELLED,
          source: booking.source,
          notes: `Reschedule snapshot of ${booking.id}`,
          amountKobo: booking.amountKobo,
          reference: `${booking.reference ?? booking.id}-SNAP-${Date.now()}`,
          contactEmail: booking.contactEmail,
        },
      });

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amountKobo: fee,
          currency: "NGN",
          status: "PENDING",
          method: "STUDIO",
          provider: "studio",
          reference: `reschedule_${booking.id}_${Date.now()}`,
        },
      });

      try {
        return await tx.booking.update({
          where: { id: booking.id },
          data: {
            startTime: start,
            endTime: end,
            rescheduledFromId: snapshot.id,
          },
          include: bookingInclude,
        });
      } catch (error) {
        throwIfOverlap(error);
      }
    });

    void this.notifications.notifyEvent(
      "booking_rescheduled",
      {
        customerName: updated.customer.name,
        reference: updated.reference ?? updated.id,
        startTime: updated.startTime.toISOString(),
        details: fee > 0 ? `Reschedule fee pending: ₦${(fee / 100).toLocaleString()}` : "",
      },
      [requireNotifyEmail(updated)],
    );

    return updated;
  }

  private verifyCustomerMatch(
    booking: { contactEmail?: string | null; customer: { email: string | null; phone: string } },
    emailOrPhone?: string,
  ): boolean {
    if (!emailOrPhone) return true;
    const input = emailOrPhone.trim().toLowerCase();
    const phoneDigits = input.replace(/\D/g, "");
    const contact = (booking.contactEmail ?? "").toLowerCase();
    const custEmail = (booking.customer.email ?? "").toLowerCase();
    const custPhone = booking.customer.phone.replace(/\D/g, "");

    const emailMatches = Boolean(
      (contact && input === contact) || (custEmail && input === custEmail),
    );
    const phoneMatches = Boolean(
      phoneDigits && custPhone && (custPhone.endsWith(phoneDigits) || phoneDigits.endsWith(custPhone)),
    );

    return emailMatches || phoneMatches;
  }

  /** Resolve by booking reference/id, or by a linked payment reference. */
  private async findBookingByPublicReference(reference: string) {
    const ref = reference.trim();
    if (!ref) return null;

    const direct = await this.prisma.booking.findFirst({
      where: {
        OR: [
          { reference: { equals: ref, mode: "insensitive" } },
          { id: ref },
        ],
      },
      include: bookingInclude,
    });
    if (direct) return direct;

    const payment = await this.prisma.payment.findFirst({
      where: { reference: { equals: ref, mode: "insensitive" } },
      select: { bookingId: true },
    });
    if (!payment) return null;

    return this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: bookingInclude,
    });
  }

  /**
   * Public / Customer self-service booking lookup.
   * Returns rich details, status timeline, Lagos formatted times, and policies.
   */
  async customerLookup(reference: string, emailOrPhone?: string) {
    await this.pricing.refresh();
    const ref = reference?.trim();
    if (!ref) throw new BadRequestException("Booking reference is required");

    const booking = await this.findBookingByPublicReference(ref);

    if (!booking) {
      throw new NotFoundException(
        "No booking found for that reference. Use the booking code from your confirmation email (usually starts with PA-), or the payment reference from your receipt.",
      );
    }

    const isVerified = emailOrPhone
      ? this.verifyCustomerMatch(booking, emailOrPhone)
      : false;

    if (emailOrPhone && !isVerified) {
      throw new ForbiddenException("Customer email or phone does not match this booking record");
    }

    const now = Date.now();
    const startMs = booking.startTime.getTime();
    const hoursNotice = (startMs - now) / (3600 * 1000);

    const totalPaidKobo = booking.payments
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amountKobo, 0);

    const totalRefundedKobo = booking.payments
      .reduce((sum, p) => sum + (p.refundedAmountKobo ?? 0), 0);

    const pendingPayments = booking.payments.filter(
      (p) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING,
    );
    const pendingFeeTotal = pendingPayments.reduce((sum, p) => sum + p.amountKobo, 0);

    const baseDue = booking.amountKobo ?? this.payableKobo(booking.package.priceKobo, booking.source);
    const outstandingBase = Math.max(0, baseDue - totalPaidKobo);
    const totalOutstanding = outstandingBase + pendingFeeTotal;

    const rescheduleFeeKobo = this.pricing.calculateRescheduleFeeKobo(booking.package.priceKobo);
    const cancellationPenaltyKobo = this.pricing.calculateCancellationPenaltyKobo(booking.package.priceKobo);
    // Strict no-refund contract policy: eligible refund is always 0
    const eligibleRefundKobo = 0;

    const canCancel =
      ([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.TEMPORARY_HOLD] as BookingStatus[]).includes(
        booking.status,
      ) && startMs > now;

    const canReschedule =
      ([BookingStatus.PENDING, BookingStatus.CONFIRMED] as BookingStatus[]).includes(booking.status) &&
      startMs > now;

    return {
      id: booking.id,
      reference: booking.reference ?? booking.id,
      status: booking.status,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      notes: booking.notes,
      package: {
        id: booking.package.id,
        name: booking.package.name,
        durationMinutes: booking.package.durationMinutes,
        outfitCount: booking.package.outfitCount,
        backdropCount: booking.package.backdropCount,
        editedPhotoCount: booking.package.editedPhotoCount,
        priceKobo: booking.package.priceKobo,
        serviceName: booking.package.service?.name ?? "Photography",
      },
      customer: {
        name: booking.customer.name,
        maskedEmail: maskEmail(booking.contactEmail ?? booking.customer.email),
        maskedPhone: maskPhone(booking.customer.phone),
        isVerified,
      },
      pricing: {
        packagePriceKobo: booking.package.priceKobo,
        amountKobo: baseDue,
        paidKobo: totalPaidKobo,
        refundedKobo: totalRefundedKobo,
        outstandingKobo: totalOutstanding,
        rescheduleFeeKobo,
        cancellationPenaltyKobo,
        eligibleRefundKobo,
        hoursNotice: Math.max(0, Math.round(hoursNotice * 10) / 10),
      },
      payments: booking.payments.map((p) => ({
        id: p.id,
        amountKobo: p.amountKobo,
        status: p.status,
        method: p.method,
        channel: p.channel,
        reference: p.reference,
        paidAt: p.paidAt?.toISOString() ?? null,
        refundedAmountKobo: p.refundedAmountKobo,
        refundReason: p.refundReason,
      })),
      flags: {
        canCancel,
        canReschedule,
        hasOutstandingBalance: totalOutstanding > 0,
        isLateCancellation: hoursNotice < 24 && hoursNotice >= 0,
      },
      policy: {
        cancellationClause:
          "Photo Arena operates a strict no-refund policy on cancellations. All booking fees and deposits are non-refundable. Cancellations forfeit 100% of the session deposit.",
        rescheduleClause:
          "You may reschedule your session to a future available date/time for a 15% rescheduling fee rather than cancelling.",
      },
    };
  }

  /**
   * Customer online cancellation. Enforces strict no-refund contract policy.
   */
  async customerCancel(dto: CustomerCancelBookingDto) {
    await this.pricing.refresh();
    const ref = dto.reference?.trim();
    if (!ref) throw new BadRequestException("Booking reference is required");

    const booking = await this.findBookingByPublicReference(ref);

    if (!booking) throw new NotFoundException("Booking not found");

    if (!this.verifyCustomerMatch(booking, dto.emailOrPhone)) {
      throw new ForbiddenException("Customer email or phone does not match this booking record");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException("This booking is already cancelled");
    }

    if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.NO_SHOW) {
      throw new BadRequestException(`Cannot cancel a ${booking.status.toLowerCase()} booking`);
    }

    const now = Date.now();
    const startMs = booking.startTime.getTime();
    if (startMs <= now) {
      throw new BadRequestException("Cannot cancel past sessions");
    }

    const totalPaidKobo = booking.payments
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amountKobo, 0);

    const penaltyKobo = this.pricing.calculateCancellationPenaltyKobo(booking.package.priceKobo);
    const eligibleRefundKobo = 0; // Strict no-refund policy

    const reasonText = dto.reason?.trim() || "Customer requested online cancellation";
    const cancelNote = `[Cancelled by Customer on ${new Date().toISOString()}] Reason: ${reasonText} | Contract Policy: No refund (100% forfeit)`;

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        notes: booking.notes ? `${booking.notes}\n${cancelNote}` : cancelNote,
      },
      include: bookingInclude,
    });

    void this.notifications.notifyEvent(
      "booking_cancelled",
      {
        customerName: booking.customer.name,
        reference: booking.reference ?? booking.id,
        startTime: booking.startTime.toISOString(),
        details: `Cancellation Reason: ${reasonText}. Studio Policy: Strict no refund (deposit forfeited). Total paid: ₦${(totalPaidKobo / 100).toLocaleString()}.`,
      },
      [requireNotifyEmail(booking)],
    );

    return {
      success: true,
      bookingId: updated.id,
      reference: updated.reference,
      status: updated.status,
      penaltyKobo,
      eligibleRefundKobo,
      message: "Your booking has been cancelled in accordance with the studio contract policy (no refund).",
    };
  }

  /**
   * Customer online self-service reschedule with 15% reschedule fee.
   */
  async customerReschedule(dto: CustomerRescheduleBookingDto) {
    await this.pricing.refresh();
    const ref = dto.reference?.trim();
    if (!ref) throw new BadRequestException("Booking reference is required");

    const booking = await this.findBookingByPublicReference(ref);

    if (!booking) throw new NotFoundException("Booking not found");

    if (!this.verifyCustomerMatch(booking, dto.emailOrPhone)) {
      throw new ForbiddenException("Customer email or phone does not match this booking record");
    }

    if (
      !([BookingStatus.PENDING, BookingStatus.CONFIRMED] as BookingStatus[]).includes(booking.status)
    ) {
      throw new BadRequestException("Only pending or confirmed bookings can be rescheduled");
    }

    const start = new Date(dto.newStartTime);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Invalid start time");
    if (start.getTime() <= Date.now()) throw new BadRequestException("New start time must be in the future");

    const end = new Date(start.getTime() + booking.package.durationMinutes * 60_000);
    const fee = this.pricing.calculateRescheduleFeeKobo(booking.package.priceKobo);
    const cmsHours = await this.getCmsHours();

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockStudioResource(tx, booking.resourceId);
      const existing = await tx.booking.findMany({
        where: { resourceId: booking.resourceId, ...blockingWhere(booking.id) },
        select: { startTime: true, endTime: true },
      });
      if (
        !slotFits(start, booking.package.durationMinutes, new Date(), existing, {
          requireSameDayNotice: true,
          cmsHours,
        })
      ) {
        throw new ConflictException("That slot is not available");
      }

      const snapshot = await tx.booking.create({
        data: {
          customerId: booking.customerId,
          packageId: booking.packageId,
          resourceId: booking.resourceId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: BookingStatus.CANCELLED,
          source: booking.source,
          notes: `Customer reschedule snapshot of ${booking.id}. Reason: ${dto.reason ?? "Online self-service"}`,
          amountKobo: booking.amountKobo,
          reference: `${booking.reference ?? booking.id}-SNAP-${Date.now()}`,
          contactEmail: booking.contactEmail,
        },
      });

      if (fee > 0) {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amountKobo: fee,
            currency: "NGN",
            status: "PENDING",
            method: "STUDIO",
            provider: "studio",
            reference: `reschedule_${booking.id}_${Date.now()}`,
          },
        });
      }

      try {
        return await tx.booking.update({
          where: { id: booking.id },
          data: {
            startTime: start,
            endTime: end,
            rescheduledFromId: snapshot.id,
            notes: booking.notes
              ? `${booking.notes}\n[Rescheduled by customer to ${start.toISOString()}] Reason: ${dto.reason ?? "N/A"}`
              : `[Rescheduled by customer to ${start.toISOString()}] Reason: ${dto.reason ?? "N/A"}`,
          },
          include: bookingInclude,
        });
      } catch (error) {
        throwIfOverlap(error);
      }
    });

    void this.notifications.notifyEvent(
      "booking_rescheduled",
      {
        customerName: updated.customer.name,
        reference: updated.reference ?? updated.id,
        startTime: updated.startTime.toISOString(),
        details: fee > 0 ? `Reschedule fee pending: ₦${(fee / 100).toLocaleString()}` : "",
      },
      [requireNotifyEmail(updated)],
    );

    return {
      success: true,
      bookingId: updated.id,
      reference: updated.reference ?? updated.id,
      oldStartTime: booking.startTime.toISOString(),
      newStartTime: updated.startTime.toISOString(),
      newEndTime: updated.endTime.toISOString(),
      rescheduleFeeKobo: fee,
      message: fee > 0
        ? `Booking rescheduled successfully. A 15% reschedule fee of ₦${(fee / 100).toLocaleString()} can be paid online or at the studio.`
        : "Booking rescheduled successfully.",
    };
  }

  async updateStatus(id: string, status: "COMPLETED" | "NO_SHOW" | "CANCELLED") {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.status === status) {
      return this.prisma.booking.findUnique({
        where: { id },
        include: bookingInclude,
      });
    }

    const allowed = ALLOWED_STATUS[booking.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot change ${booking.status} to ${status}`);
    }
    if ((status === "COMPLETED" || status === "NO_SHOW") && booking.startTime.getTime() > Date.now()) {
      throw new BadRequestException(
        `Cannot mark a session as ${status === "COMPLETED" ? "completed" : "no-show"} before it starts`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status },
      include: bookingInclude,
    });

    if (status === "CANCELLED") {
      void this.notifications.notifyEvent(
        "booking_cancelled",
        {
          customerName: booking.customer.name,
          reference: booking.reference ?? booking.id,
          startTime: booking.startTime.toISOString(),
        },
        [requireNotifyEmail(booking)],
      );
    }

    return updated;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds() {
    const result = await this.prisma.booking.updateMany({
      where: expiredHoldWhere(),
      data: { status: BookingStatus.CANCELLED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} temporary hold(s)`);
    }
  }

  payableKobo(priceKobo: number, source: "ONLINE" | "WALK_IN" | "ADMIN") {
    return this.pricing.calculatePayableKobo(priceKobo, source);
  }

  todayYmd() {
    return toLagosYmd(new Date());
  }

  /** Desk KPI strip for Bookings page — Lagos day boundaries. */
  async deskStats() {
    await this.pricing.refresh();
    const todayYmd = toLagosYmd(new Date());
    const todayStart = startOfLagosDay(todayYmd);
    const tomorrowStart = startOfLagosDay(addLagosDays(todayYmd, 1));
    const yesterdayStart = startOfLagosDay(addLagosDays(todayYmd, -1));
    const d30Start = startOfLagosDay(addLagosDays(todayYmd, -29));
    const prev30Start = startOfLagosDay(addLagosDays(todayYmd, -59));

    const floor: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
    ];

    const [
      totalAll,
      totalLast30,
      totalPrev30,
      todayCount,
      yesterdayCount,
      todayRevenue,
      yesterdayRevenue,
      unpaidPool,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { status: { in: floor } },
      }),
      this.prisma.booking.count({
        where: { startTime: { gte: d30Start, lt: tomorrowStart }, status: { in: floor } },
      }),
      this.prisma.booking.count({
        where: { startTime: { gte: prev30Start, lt: d30Start }, status: { in: floor } },
      }),
      this.prisma.booking.count({
        where: { startTime: { gte: todayStart, lt: tomorrowStart }, status: { in: floor } },
      }),
      this.prisma.booking.count({
        where: { startTime: { gte: yesterdayStart, lt: todayStart }, status: { in: floor } },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: "SUCCESS",
          paidAt: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { amountKobo: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: "SUCCESS",
          paidAt: { gte: yesterdayStart, lt: todayStart },
        },
        _sum: { amountKobo: true },
      }),
      this.prisma.booking.findMany({
        where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
        include: { payments: true, package: true },
      }),
    ]);

    const todayRevenueKobo = todayRevenue._sum.amountKobo ?? 0;
    const yesterdayRevenueKobo = yesterdayRevenue._sum.amountKobo ?? 0;

    const unpaidCount = unpaidPool.filter((b) => {
      const due =
        b.amountKobo != null && b.amountKobo > 0
          ? b.amountKobo
          : this.pricing.calculatePayableKobo(b.package.priceKobo, b.source);
      const paid = b.payments
        .filter((p) => p.status === "SUCCESS")
        .reduce((s, p) => s + p.amountKobo, 0);
      return paid < due;
    }).length;

    const totalDeltaPct =
      totalPrev30 === 0 ? null : Math.round(((totalLast30 - totalPrev30) / totalPrev30) * 1000) / 10;
    const revenueDeltaPct =
      yesterdayRevenueKobo === 0
        ? null
        : Math.round(((todayRevenueKobo - yesterdayRevenueKobo) / yesterdayRevenueKobo) * 1000) / 10;

    return {
      totalAll: {
        count: totalAll,
      },
      totalLast30: {
        count: totalLast30,
        deltaPct: totalDeltaPct,
      },
      today: {
        count: todayCount,
        delta: todayCount - yesterdayCount,
      },
      todayRevenue: {
        totalKobo: todayRevenueKobo,
        deltaPct: revenueDeltaPct,
        deltaKobo: todayRevenueKobo - yesterdayRevenueKobo,
      },
      unpaid: {
        count: unpaidCount,
      },
    };
  }
}
