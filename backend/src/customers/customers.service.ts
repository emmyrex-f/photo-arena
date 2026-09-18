import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { toCsv } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string, pageRaw?: string, pageSizeRaw?: string, tag?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(pageSizeRaw);
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
    return customer;
  }

  async update(id: string, data: { name?: string; email?: string; notes?: string; tags?: string[] }) {
    await this.get(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim().toLowerCase() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
    });
  }

  async exportCsv() {
    const rows = await this.prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: { include: { payments: true }, orderBy: { startTime: "desc" } },
      },
    });
    const csv = toCsv([
      ["id", "name", "phone", "email", "tags", "bookingCount", "lastBookingAt", "totalPaidKobo", "notes"],
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
          String(totalPaidKobo),
          c.notes ?? "",
        ];
      }),
    ]);
    return csv;
  }
}
