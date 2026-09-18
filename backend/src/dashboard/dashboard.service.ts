import { Injectable } from "@nestjs/common";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import {
  addLagosDays,
  startOfLagosDay,
  toLagosYmd,
} from "../bookings/availability";
import { PrismaService } from "../prisma/prisma.service";

const bookingInclude = {
  customer: true,
  package: { include: { service: true } },
  payments: true,
} satisfies Prisma.BookingInclude;

const FLOOR_STATUSES: BookingStatus[] = [
  BookingStatus.TEMPORARY_HOLD,
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const todayYmd = toLagosYmd(new Date());
    const todayStart = startOfLagosDay(todayYmd);
    const tomorrowStart = startOfLagosDay(addLagosDays(todayYmd, 1));
    const weekStart = startOfLagosDay(addLagosDays(todayYmd, -6));
    const monthStart = startOfLagosDay(`${todayYmd.slice(0, 8)}01`);
    const upcomingEnd = startOfLagosDay(addLagosDays(todayYmd, 8));
    const seriesStart = startOfLagosDay(addLagosDays(todayYmd, -29));

    const [
      todayBookings,
      pendingPayments,
      activeHolds,
      upcoming7d,
      newEnquiries,
      customers,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      seriesBookings,
      seriesPayments,
      recentEnquiries,
      recentPayments,
    ] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          startTime: { gte: todayStart, lt: tomorrowStart },
          status: { in: FLOOR_STATUSES },
        },
        include: bookingInclude,
        orderBy: { startTime: "asc" },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.TEMPORARY_HOLD,
          holdExpiresAt: { gt: new Date() },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          startTime: { gte: tomorrowStart, lt: upcomingEnd },
        },
      }),
      this.prisma.enquiry.count({ where: { status: "NEW" } }),
      this.prisma.customer.count(),
      this.sumRevenue(todayStart, tomorrowStart),
      this.sumRevenue(weekStart, tomorrowStart),
      this.sumRevenue(monthStart, tomorrowStart),
      this.prisma.booking.findMany({
        where: { startTime: { gte: seriesStart, lt: tomorrowStart } },
        select: { startTime: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          paidAt: { gte: seriesStart, lt: tomorrowStart },
        },
        select: { paidAt: true, amountKobo: true },
      }),
      this.prisma.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          booking: {
            include: { customer: true, package: true },
          },
        },
      }),
    ]);

    const seriesMap = new Map<string, { date: string; bookings: number; revenueKobo: number }>();
    for (let i = 0; i < 30; i++) {
      const date = addLagosDays(todayYmd, -29 + i);
      seriesMap.set(date, { date, bookings: 0, revenueKobo: 0 });
    }
    for (const b of seriesBookings) {
      const date = toLagosYmd(b.startTime);
      const row = seriesMap.get(date);
      if (row) row.bookings += 1;
    }
    for (const p of seriesPayments) {
      if (!p.paidAt) continue;
      const date = toLagosYmd(p.paidAt);
      const row = seriesMap.get(date);
      if (row) row.revenueKobo += p.amountKobo;
    }

    return {
      today: { date: todayYmd, bookings: todayBookings, count: todayBookings.length },
      counts: {
        pendingPayments,
        activeHolds,
        upcoming7d,
        newEnquiries,
        customers,
      },
      revenue: {
        todayKobo: todayRevenue,
        weekKobo: weekRevenue,
        monthKobo: monthRevenue,
      },
      series: [...seriesMap.values()],
      recentEnquiries,
      recentPayments,
    };
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
