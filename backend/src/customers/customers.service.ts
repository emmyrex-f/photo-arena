import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { toCsv } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";

const MS_DAY = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_DAYS = 180;
const UPCOMING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING,
  BookingStatus.TEMPORARY_HOLD,
];

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function activeCutoff(now = new Date()) {
  return new Date(now.getTime() - ACTIVE_WINDOW_DAYS * MS_DAY);
}

function deriveNextBookingAt(
  bookings: { startTime: Date; status: BookingStatus }[],
  now: Date,
): Date | null {
  const upcoming = bookings
    .filter((b) => b.startTime >= now && UPCOMING_STATUSES.includes(b.status))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return upcoming[0]?.startTime ?? null;
}

function deriveIsActive(
  bookings: { startTime: Date; status: BookingStatus }[],
  now: Date,
): boolean {
  const cutoff = activeCutoff(now);
  if (bookings.some((b) => b.startTime >= now && UPCOMING_STATUSES.includes(b.status))) {
    return true;
  }
  return bookings.some((b) => b.startTime >= cutoff);
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * MS_DAY);
    const d60 = new Date(now.getTime() - 60 * MS_DAY);

    const [total, newLast30, newPrior30, upcomingNow, upcomingPrior] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.customer.count({ where: { createdAt: { gte: d60, lt: d30 } } }),
      this.prisma.booking.count({
        where: {
          startTime: { gte: now },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
      }),
      this.prisma.booking.count({
        where: {
          startTime: { gte: d30, lt: now },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.COMPLETED] },
        },
      }),
    ]);

    const totalPrior = Math.max(0, total - newLast30);

    return {
      total: {
        count: total,
        deltaPct: pctChange(total, totalPrior),
      },
      newCustomers: {
        count: newLast30,
        deltaPct: pctChange(newLast30, newPrior30),
      },
      upcomingBookings: {
        count: upcomingNow,
        deltaPct: pctChange(upcomingNow, upcomingPrior),
      },
    };
  }

  async list(
    q?: string,
    pageRaw?: string,
    pageSizeRaw?: string,
    tag?: string,
    statusRaw?: string,
  ) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(pageSizeRaw);
    const now = new Date();
    const cutoff = activeCutoff(now);
    const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;

    const activityFilter: Prisma.CustomerWhereInput | undefined =
      status === "active"
        ? {
            bookings: {
              some: {
                OR: [
                  { startTime: { gte: cutoff } },
                  {
                    startTime: { gte: now },
                    status: { in: UPCOMING_STATUSES },
                  },
                ],
              },
            },
          }
        : status === "inactive"
          ? {
              bookings: {
                none: {
                  OR: [
                    { startTime: { gte: cutoff } },
                    {
                      startTime: { gte: now },
                      status: { in: UPCOMING_STATUSES },
                    },
                  ],
                },
              },
            }
          : undefined;

    const where: Prisma.CustomerWhereInput = {
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(activityFilter ?? {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          bookings: {
            include: { payments: true },
            orderBy: { startTime: "desc" },
          },
        },
      }),
    ]);

    const items = rows.map((c) => {
      const totalPaidKobo = c.bookings.reduce(
        (sum, b) =>
          sum +
          b.payments
            .filter((p) => p.status === PaymentStatus.SUCCESS)
            .reduce((s, p) => s + p.amountKobo, 0),
        0,
      );
      const nextBookingAt = deriveNextBookingAt(c.bookings, now);
      const isActive = deriveIsActive(c.bookings, now);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        tags: c.tags,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        bookingCount: c.bookings.length,
        lastBookingAt: c.bookings[0]?.startTime ?? null,
        nextBookingAt,
        isActive,
        totalPaidKobo,
      };
    });
    return paginate(items, total, page, pageSize);
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        bookings: {
          include: {
            package: { include: { service: true } },
            payments: true,
          },
          orderBy: { startTime: "desc" },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const now = new Date();
    const totalPaidKobo = customer.bookings.reduce(
      (sum, b) =>
        sum +
        b.payments
          .filter((p) => p.status === PaymentStatus.SUCCESS)
          .reduce((s, p) => s + p.amountKobo, 0),
      0,
    );
    const upcoming = customer.bookings.filter(
      (b) => b.startTime >= now && UPCOMING_STATUSES.includes(b.status),
    );
    const completed = customer.bookings.filter((b) => b.status === BookingStatus.COMPLETED);

    return {
      ...customer,
      bookingCount: customer.bookings.length,
      totalPaidKobo,
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      nextBookingAt: deriveNextBookingAt(customer.bookings, now),
      isActive: deriveIsActive(customer.bookings, now),
    };
  }

  async update(id: string, data: { name?: string; email?: string; notes?: string; tags?: string[] }) {
    const existing = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Customer not found");
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined
          ? {
              email: (() => {
                const next = data.email.trim().toLowerCase();
                if (!next) throw new BadRequestException("Customer email is required");
                return next;
              })(),
            }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
    });
  }

  async exportCsv() {
    const now = new Date();
    const rows = await this.prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: { include: { payments: true }, orderBy: { startTime: "desc" } },
      },
    });
    const csv = toCsv([
      [
        "id",
        "name",
        "phone",
        "email",
        "tags",
        "bookingCount",
        "lastBookingAt",
        "nextBookingAt",
        "isActive",
        "totalPaidKobo",
        "notes",
      ],
      ...rows.map((c) => {
        const totalPaidKobo = c.bookings.reduce(
          (sum, b) =>
            sum +
            b.payments
              .filter((p) => p.status === PaymentStatus.SUCCESS)
              .reduce((s, p) => s + p.amountKobo, 0),
          0,
        );
        return [
          c.id,
          c.name,
          c.phone,
          c.email ?? "",
          c.tags.join("|"),
          String(c.bookings.length),
          c.bookings[0]?.startTime?.toISOString() ?? "",
          deriveNextBookingAt(c.bookings, now)?.toISOString() ?? "",
          deriveIsActive(c.bookings, now) ? "active" : "inactive",
          String(totalPaidKobo),
          c.notes ?? "",
        ];
      }),
    ]);
    return csv;
  }
}
