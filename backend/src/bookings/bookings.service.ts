import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BookingStatus, Prisma } from "@prisma/client";
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
import { blockingWhere } from "./blocking";
import { lockStudioResource, throwIfOverlap } from "./resource-lock";
import type { CreateAdminBookingDto } from "./dto/create-admin-booking.dto";
import { HOLD_ACTIVE_PER_PHONE } from "../common/rate-limit";

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

  async availability(ymd: string, durationMinutes: number, options?: { requireSameDayNotice?: boolean }) {
    const resource = await this.prisma.studioResource.findFirst({ where: { isActive: true } });
    const existing = resource
      ? await this.prisma.booking.findMany({
          where: { resourceId: resource.id, ...blockingWhere() },
          select: { startTime: true, endTime: true },
        })
      : [];

    const now = new Date();
    const slots = generateCandidateStartsForYmd(ymd)
      .filter((start) => slotFits(start, durationMinutes, now, existing, options))
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

    const resource = await this.prisma.studioResource.findFirst({ where: { isActive: true } });
    if (!resource) throw new BadRequestException("No studio resource is configured");

    const start = new Date(input.startTime);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Invalid start time");
    const end = new Date(start.getTime() + pkg.durationMinutes * 60_000);
    const holdMinutes = BOOKING_RULES.holdDurationMinutes;
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
        throw new ConflictException("Too many active holds for this phone number");
      }

      const existing = await tx.booking.findMany({
        where: { resourceId: resource.id, ...blockingWhere() },
        select: { startTime: true, endTime: true },
      });
      if (!slotFits(start, pkg.durationMinutes, new Date(), existing, { requireSameDayNotice: true })) {
        throw new ConflictException("That slot is not available");
      }

      const email = input.customerEmail.trim().toLowerCase();
      const name = input.customerName.trim();
      const existingCustomer = await tx.customer.findUnique({ where: { phone } });
      const customer = existingCustomer
        ? existingCustomer
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
          },
          include: { package: true, customer: true },
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
        details: `Hold until ${holdExpiresAt.toISOString()}`,
      },
      [booking.customer.email ?? ""],
    );

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

  async publicStatus(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        package: true,
        customer: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");
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
        email: booking.customer.email,
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

    const resource = await this.prisma.studioResource.findFirst({ where: { isActive: true } });
    if (!resource) throw new BadRequestException("No studio resource is configured");

    const start = new Date(dto.startTime);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Invalid start time");
    const end = new Date(start.getTime() + pkg.durationMinutes * 60_000);
    const amountKobo = this.pricing.calculatePayableKobo(pkg.priceKobo, dto.source);
    const reference = newPaymentReference();

    const booking = await this.prisma.$transaction(async (tx) => {
      await lockStudioResource(tx, resource.id);
      const existing = await tx.booking.findMany({
        where: { resourceId: resource.id, ...blockingWhere() },
        select: { startTime: true, endTime: true },
      });

      if (!slotFits(start, pkg.durationMinutes, new Date(), existing, { requireSameDayNotice: false })) {
        throw new ConflictException("That slot is not available");
      }

      const phone = dto.customerPhone.trim();
      const email = dto.customerEmail?.trim().toLowerCase() || null;
      const customer = await tx.customer.upsert({
        where: { phone },
        create: { name: dto.customerName.trim(), phone, email },
        update: {
          name: dto.customerName.trim(),
          email: email ?? undefined,
        },
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
          },
          include: bookingInclude,
        });
      } catch (error) {
        throwIfOverlap(error);
      }
    });

    void this.notifications.notifyEvent("booking_created", {
      customerName: booking.customer.name,
      startTime: booking.startTime.toISOString(),
      reference,
      details: `Admin booking (${dto.source})`,
    });

    return booking;
  }

  async recordStudioPayment(id: string, opts?: { amountKobo?: number; note?: string }) {
    await this.pricing.refresh();
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { package: true, payments: true, customer: true },
      });
      if (!booking) throw new NotFoundException("Booking not found");
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException("Only pending reservations can take a studio payment");
      }

      const amountKobo =
        opts?.amountKobo ??
        booking.amountKobo ??
        this.pricing.calculatePayableKobo(booking.package.priceKobo, booking.source);

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amountKobo,
          currency: "NGN",
          status: "SUCCESS",
          method: "STUDIO",
          provider: "studio",
          reference: `studio_${booking.id}_${Date.now()}`,
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
        [booking.customer.email ?? ""].filter(Boolean),
      );
      void this.notifications.notifyEvent(
        "booking_confirmed",
        {
          customerName: booking.customer.name,
          reference: booking.reference ?? booking.id,
          startTime: booking.startTime.toISOString(),
        },
        [booking.customer.email ?? ""].filter(Boolean),
      );

      return updated;
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

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockStudioResource(tx, booking.resourceId);
      const existing = await tx.booking.findMany({
        where: { resourceId: booking.resourceId, ...blockingWhere(booking.id) },
        select: { startTime: true, endTime: true },
      });
      if (
        !slotFits(start, booking.package.durationMinutes, new Date(), existing, {
          requireSameDayNotice: false,
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
      },
      [updated.customer.email ?? ""].filter(Boolean),
    );

    return updated;
  }

  async updateStatus(id: string, status: "COMPLETED" | "NO_SHOW" | "CANCELLED") {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");

    const allowed = ALLOWED_STATUS[booking.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot change ${booking.status} to ${status}`);
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
        [booking.customer.email ?? ""].filter(Boolean),
      );
    }

    return updated;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds() {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.TEMPORARY_HOLD,
        holdExpiresAt: { lt: new Date() },
        NOT: { payments: { some: { status: "SUCCESS" } } },
      },
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
}
