import {
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import {
  addLagosDays,
  startOfLagosDay,
  toLagosYmd,
} from "../bookings/availability";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { toCsv } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@Controller("admin/payments")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("payments")
export class AdminPaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  @Get("integration")
  integration() {
    return this.payments.integrationStatus();
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="payments.csv"')
  async exportCsv(@Query("from") from?: string, @Query("to") to?: string) {
    const where = this.dateWhere(from, to);
    const rows = await this.prisma.payment.findMany({
      where,
      include: {
        booking: { include: { customer: true, package: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return toCsv([
      [
        "id",
        "reference",
        "status",
        "method",
        "provider",
        "amountKobo",
        "paidAt",
        "customer",
        "package",
      ],
      ...rows.map((p) => [
        p.id,
        p.reference,
        p.status,
        p.method,
        p.provider,
        String(p.amountKobo),
        p.paidAt?.toISOString() ?? "",
        p.booking.customer.name,
        p.booking.package.name,
      ]),
    ]);
  }

  /**
   * Desk KPI strip + legacy summary fields.
   * Range is Lagos calendar days on `createdAt`. Prior period = same-length window immediately before `from`.
   */
  @Get("summary")
  async summary(@Query("from") from?: string, @Query("to") to?: string) {
    const range = this.resolveRange(from, to);
    const currentWhere = this.dateWhere(range.from, range.to);
    const priorWhere = this.dateWhere(range.priorFrom, range.priorTo);

    const [currentRows, priorRows] = await Promise.all([
      this.prisma.payment.findMany({
        where: currentWhere,
        select: { amountKobo: true, method: true, status: true },
      }),
      this.prisma.payment.findMany({
        where: priorWhere,
        select: { amountKobo: true, status: true },
      }),
    ]);

    const byMethod = { STUDIO: 0, ONLINE_BACHS: 0 };
    let totalKobo = 0;
    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    for (const row of currentRows) {
      if (row.status === PaymentStatus.SUCCESS) {
        totalKobo += row.amountKobo;
        successCount += 1;
        if (row.method === PaymentMethod.STUDIO) byMethod.STUDIO += row.amountKobo;
        if (row.method === PaymentMethod.ONLINE_BACHS) byMethod.ONLINE_BACHS += row.amountKobo;
      } else if (row.status === PaymentStatus.PENDING || row.status === PaymentStatus.PROCESSING) {
        pendingCount += 1;
      } else if (row.status === PaymentStatus.FAILED) {
        failedCount += 1;
      }
    }

    let priorRevenueKobo = 0;
    let priorSuccess = 0;
    let priorPending = 0;
    let priorFailed = 0;
    for (const row of priorRows) {
      if (row.status === PaymentStatus.SUCCESS) {
        priorRevenueKobo += row.amountKobo;
        priorSuccess += 1;
      } else if (row.status === PaymentStatus.PENDING || row.status === PaymentStatus.PROCESSING) {
        priorPending += 1;
      } else if (row.status === PaymentStatus.FAILED) {
        priorFailed += 1;
      }
    }

    return {
      // Legacy shape (SUCCESS-only totals for the selected range)
      totalKobo,
      count: successCount,
      byMethod,
      // Desk KPIs
      range: { from: range.from, to: range.to, priorFrom: range.priorFrom, priorTo: range.priorTo },
      revenue: {
        totalKobo,
        deltaPct: pctChange(totalKobo, priorRevenueKobo),
        deltaKobo: totalKobo - priorRevenueKobo,
      },
      successful: {
        count: successCount,
        deltaPct: pctChange(successCount, priorSuccess),
      },
      pending: {
        count: pendingCount,
        deltaPct: pctChange(pendingCount, priorPending),
      },
      failed: {
        count: failedCount,
        deltaPct: pctChange(failedCount, priorFailed),
      },
    };
  }

  @Get()
  async list(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
    @Query("method") method?: string,
    @Query("q") q?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(pageSizeRaw, 20);
    const query = q?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...this.dateWhere(from, to),
      ...(status ? { status: status as PaymentStatus } : {}),
      ...(method ? { method: method as PaymentMethod } : {}),
      ...(query
        ? {
            OR: [
              { reference: { contains: query, mode: "insensitive" } },
              { booking: { customer: { name: { contains: query, mode: "insensitive" } } } },
              { booking: { customer: { phone: { contains: query } } } },
              { booking: { customer: { email: { contains: query, mode: "insensitive" } } } },
              { booking: { reference: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          booking: {
            include: {
              customer: true,
              package: { include: { service: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  private resolveRange(from?: string, to?: string): {
    from: string;
    to: string;
    priorFrom: string;
    priorTo: string;
  } {
    const today = toLagosYmd(new Date());
    const toYmd = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
    const fromYmd =
      from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : addLagosDays(toYmd, -6);

    // Inclusive day span length
    const fromMs = startOfLagosDay(fromYmd).getTime();
    const toMs = startOfLagosDay(toYmd).getTime();
    const daySpan = Math.max(1, Math.round((toMs - fromMs) / 86_400_000) + 1);
    const priorTo = addLagosDays(fromYmd, -1);
    const priorFrom = addLagosDays(priorTo, -(daySpan - 1));

    return { from: fromYmd, to: toYmd, priorFrom, priorTo };
  }

  private dateWhere(from?: string, to?: string): Prisma.PaymentWhereInput {
    if (!from && !to) return {};
    const gte = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? startOfLagosDay(from) : undefined;
    const lt =
      to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? startOfLagosDay(addLagosDays(to, 1)) : undefined;
    return { createdAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } };
  }
}
