import { BadRequestException, Injectable } from "@nestjs/common";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import {
  addLagosDays,
  lagosWeekday,
  startOfLagosDay,
  toLagosYmd,
} from "../bookings/availability";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";

const bookingInclude = {
  customer: true,
  package: { include: { service: true } },
  payments: true,
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** Floor statuses that count toward “today’s bookings” (excludes unpaid holds). */
const FLOOR_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** How far back the revenue chart can navigate (inclusive of current week). */
const REVENUE_WEEKS_BACK = 52;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function mondayOfWeek(ymd: string): string {
  const wd = lagosWeekday(ymd); // 0 = Sun … 6 = Sat
  const daysFromMonday = wd === 0 ? 6 : wd - 1;
  return addLagosDays(ymd, -daysFromMonday);
}

function paidSuccessKobo(booking: BookingWithRelations): number {
  return booking.payments
    .filter((p) => p.status === PaymentStatus.SUCCESS)
    .reduce((sum, p) => sum + p.amountKobo, 0);
}

function displayPaymentStatus(
  booking: BookingWithRelations,
  due: number,
): "PAID" | "UNPAID" | "PARTIAL" {
  const paid = paidSuccessKobo(booking);
  if (paid <= 0) return "UNPAID";
  if (paid >= due) return "PAID";
  return "PARTIAL";
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  private amountDueKobo(booking: BookingWithRelations): number {
    if (booking.amountKobo != null && booking.amountKobo > 0) return booking.amountKobo;
    return this.pricing.calculatePayableKobo(booking.package.priceKobo, booking.source);
  }

  private outstandingKobo(booking: BookingWithRelations): number {
    return Math.max(0, this.amountDueKobo(booking) - paidSuccessKobo(booking));
  }

  private resolveWeekWindow(weekStartRaw?: string) {
    const todayYmd = toLagosYmd(new Date());
    const latestWeekStart = mondayOfWeek(todayYmd);
    const earliestWeekStart = addLagosDays(latestWeekStart, -(REVENUE_WEEKS_BACK - 1) * 7);

    let weekStart = latestWeekStart;
    if (weekStartRaw != null && weekStartRaw.trim() !== "") {
      const raw = weekStartRaw.trim();
      if (!YMD_RE.test(raw)) {
        throw new BadRequestException("weekStart must be YYYY-MM-DD");
      }
      weekStart = mondayOfWeek(raw);
      if (weekStart < earliestWeekStart) weekStart = earliestWeekStart;
      if (weekStart > latestWeekStart) weekStart = latestWeekStart;
    }

    const weekEnd = addLagosDays(weekStart, 6);
    const rangeStart = startOfLagosDay(weekStart);
    const rangeEndExclusive = startOfLagosDay(addLagosDays(weekStart, 7));
    const priorWeekStart = addLagosDays(weekStart, -7);
    const priorRangeStart = startOfLagosDay(priorWeekStart);

    return {
      weekStart,
      weekEnd,
      rangeStart,
      rangeEndExclusive,
      priorRangeStart,
      earliestWeekStart,
      latestWeekStart,
      canGoBack: weekStart > earliestWeekStart,
      canGoForward: weekStart < latestWeekStart,
      isCurrentWeek: weekStart === latestWeekStart,
    };
  }

  private async buildWeeklyRevenue(weekStartRaw?: string) {
    const window = this.resolveWeekWindow(weekStartRaw);

    const [weekPayments, priorWeekRevenue] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          paidAt: { gte: window.rangeStart, lt: window.rangeEndExclusive },
        },
        select: { paidAt: true, amountKobo: true },
      }),
      this.sumRevenue(window.priorRangeStart, window.rangeStart),
    ]);

    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      dailyMap.set(addLagosDays(window.weekStart, i), 0);
    }
    for (const p of weekPayments) {
      if (!p.paidAt) continue;
      const key = toLagosYmd(p.paidAt);
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + p.amountKobo);
      }
    }

    const totalKobo = [...dailyMap.values()].reduce((a, b) => a + b, 0);
    const daily = [...dailyMap.entries()].map(([date, revenueKobo], index) => ({
      date,
      label: DAY_LABELS[index] ?? date,
      revenueKobo,
    }));

    return {
      totalKobo,
      deltaPct: pctChange(totalKobo, priorWeekRevenue),
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      earliestWeekStart: window.earliestWeekStart,
      latestWeekStart: window.latestWeekStart,
      canGoBack: window.canGoBack,
      canGoForward: window.canGoForward,
      isCurrentWeek: window.isCurrentWeek,
      daily,
    };
  }

  async get(weekStart?: string) {
    await this.pricing.refresh();

    const todayYmd = toLagosYmd(new Date());
    const todayStart = startOfLagosDay(todayYmd);
    const tomorrowYmd = addLagosDays(todayYmd, 1);
    const tomorrowStart = startOfLagosDay(tomorrowYmd);
    const dayAfterTomorrowStart = startOfLagosDay(addLagosDays(todayYmd, 2));
    const upcomingHorizonStart = tomorrowStart;
    const upcomingHorizonEnd = startOfLagosDay(addLagosDays(todayYmd, 8));
    const attentionWindowStart = startOfLagosDay(addLagosDays(todayYmd, -30));
    const yesterdayYmd = addLagosDays(todayYmd, -1);
    const yesterdayStart = startOfLagosDay(yesterdayYmd);

    const [
      todayBookings,
      yesterdayBookingsCount,
      tomorrowBookings,
      upcomingBookings,
      unpaidPool,
      newEnquiries,
      failedPayments,
      noShowFollowUp,
      todayRevenue,
      yesterdayRevenue,
      weeklyRevenue,
    ] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          startTime: { gte: todayStart, lt: tomorrowStart },
          status: { in: FLOOR_STATUSES },
        },
        include: bookingInclude,
        orderBy: { startTime: "asc" },
      }),
      this.prisma.booking.count({
        where: {
          startTime: { gte: yesterdayStart, lt: todayStart },
          status: { in: FLOOR_STATUSES },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          startTime: { gte: tomorrowStart, lt: dayAfterTomorrowStart },
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
        include: bookingInclude,
        orderBy: { startTime: "asc" },
      }),
      this.prisma.booking.findMany({
        where: {
          startTime: { gte: upcomingHorizonStart, lt: upcomingHorizonEnd },
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
        include: bookingInclude,
        orderBy: { startTime: "asc" },
        take: 40,
      }),
      this.prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
        include: bookingInclude,
        orderBy: { startTime: "asc" },
      }),
      this.prisma.enquiry.count({ where: { status: "NEW" } }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.FAILED,
          createdAt: { gte: attentionWindowStart },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.NO_SHOW,
          startTime: { gte: attentionWindowStart, lt: tomorrowStart },
        },
      }),
      this.sumRevenue(todayStart, tomorrowStart),
      this.sumRevenue(yesterdayStart, todayStart),
      this.buildWeeklyRevenue(weekStart),
    ]);

    const unpaidAll = unpaidPool
      .map((b) => ({ booking: b, outstanding: this.outstandingKobo(b) }))
      .filter((row) => row.outstanding > 0);
    const unpaidBookings = unpaidAll.slice(0, 12);
    const unpaidTotal = unpaidAll.length;

    const todosTotal = unpaidTotal + newEnquiries + noShowFollowUp + failedPayments;
    const bookingsDelta = todayBookings.length - yesterdayBookingsCount;
    const revenueDeltaKobo = todayRevenue - yesterdayRevenue;
    const revenueDeltaPct = pctChange(todayRevenue, yesterdayRevenue);

    return {
      today: {
        date: todayYmd,
        bookingsCount: todayBookings.length,
        bookingsDelta,
        revenueTotalKobo: todayRevenue,
        revenueDeltaKobo,
        revenueDeltaPct,
        todos: {
          unpaidBookings: unpaidTotal,
          newEnquiries,
          noShowFollowUp,
          failedPayments,
          total: todosTotal,
        },
        upcomingTomorrowCount: tomorrowBookings.length,
      },
      todaysBookings: todayBookings.map((b) => {
        const due = this.amountDueKobo(b);
        return {
          id: b.id,
          startTime: b.startTime.toISOString(),
          customerName: b.customer.name,
          serviceName: b.package.service?.name ?? b.package.name,
          status: b.status,
          paymentStatus: displayPaymentStatus(b, due),
          reference: b.reference,
        };
      }),
      weeklyRevenue,
      needsAttention: unpaidBookings.map(({ booking: b, outstanding }) => ({
        bookingId: b.id,
        customerName: b.customer.name,
        amountDueKobo: outstanding,
        reference: b.reference ?? b.id.slice(0, 8).toUpperCase(),
        status: b.status,
        canMarkPaid: b.status === BookingStatus.PENDING && outstanding > 0,
        startTime: b.startTime.toISOString(),
      })),
      tomorrowsBookings: tomorrowBookings.map((b) => ({
        id: b.id,
        startTime: b.startTime.toISOString(),
        customerName: b.customer.name,
        serviceName: b.package.service?.name ?? b.package.name,
      })),
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        startTime: b.startTime.toISOString(),
        customerName: b.customer.name,
        serviceName: b.package.service?.name ?? b.package.name,
      })),
    };
  }

  /** Lightweight chart-only refresh when navigating weeks. */
  async getWeeklyRevenue(weekStart?: string) {
    return this.buildWeeklyRevenue(weekStart);
  }

  private async sumRevenue(from: Date, to: Date) {
    const agg = await this.prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        paidAt: { gte: from, lt: to },
      },
      _sum: { amountKobo: true },
    });
    return agg._sum.amountKobo ?? 0;
  }
}
