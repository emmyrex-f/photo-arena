import { Injectable, NotFoundException } from "@nestjs/common";
import { EnquiryStatus, Prisma } from "@prisma/client";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";

const MS_DAY = 24 * 60 * 60 * 1000;

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function parseStatus(raw?: string): EnquiryStatus | undefined {
  if (raw === EnquiryStatus.NEW || raw === EnquiryStatus.REPLIED || raw === EnquiryStatus.CLOSED) {
    return raw;
  }
  return undefined;
}

@Injectable()
export class EnquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * MS_DAY);
    const d60 = new Date(now.getTime() - 60 * MS_DAY);

    const [
      total,
      createdLast30,
      newCount,
      repliedCount,
      closedCount,
      newLast30,
      newPrior30,
      repliedLast30,
      repliedPrior30,
      closedLast30,
      closedPrior30,
    ] = await Promise.all([
      this.prisma.enquiry.count(),
      this.prisma.enquiry.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.enquiry.count({ where: { status: EnquiryStatus.NEW } }),
      this.prisma.enquiry.count({ where: { status: EnquiryStatus.REPLIED } }),
      this.prisma.enquiry.count({ where: { status: EnquiryStatus.CLOSED } }),
      this.prisma.enquiry.count({
        where: { status: EnquiryStatus.NEW, createdAt: { gte: d30 } },
      }),
      this.prisma.enquiry.count({
        where: { status: EnquiryStatus.NEW, createdAt: { gte: d60, lt: d30 } },
      }),
      this.prisma.enquiry.count({
        where: { status: EnquiryStatus.REPLIED, updatedAt: { gte: d30 } },
      }),
      this.prisma.enquiry.count({
        where: { status: EnquiryStatus.REPLIED, updatedAt: { gte: d60, lt: d30 } },
      }),
      this.prisma.enquiry.count({
        where: { status: EnquiryStatus.CLOSED, updatedAt: { gte: d30 } },
      }),
      this.prisma.enquiry.count({
        where: { status: EnquiryStatus.CLOSED, updatedAt: { gte: d60, lt: d30 } },
      }),
    ]);

    const totalPrior = Math.max(0, total - createdLast30);

    return {
      total: { count: total, deltaPct: pctChange(total, totalPrior) },
      new: { count: newCount, deltaPct: pctChange(newLast30, newPrior30) },
      replied: { count: repliedCount, deltaPct: pctChange(repliedLast30, repliedPrior30) },
      closed: { count: closedCount, deltaPct: pctChange(closedLast30, closedPrior30) },
      tabs: {
        all: total,
        new: newCount,
        replied: repliedCount,
        closed: closedCount,
      },
    };
  }

  async list(statusRaw?: string, pageRaw?: string, pageSizeRaw?: string, q?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(pageSizeRaw, 8);
    const status = parseStatus(statusRaw);
    const query = q?.trim();

    const where: Prisma.EnquiryWhereInput = {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
              { message: { contains: query, mode: "insensitive" } },
              { sessionType: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.enquiry.count({ where }),
      this.prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return paginate(items, total, page, pageSize);
  }

  async get(id: string) {
    const row = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Enquiry not found");
    return row;
  }

  async update(id: string, data: { status?: EnquiryStatus; internalNote?: string }) {
    await this.get(id);
    return this.prisma.enquiry.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.internalNote !== undefined ? { internalNote: data.internalNote || null } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.enquiry.delete({ where: { id } });
    return { ok: true as const };
  }
}
