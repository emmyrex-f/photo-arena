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
} from "../bookings/availability";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { toCsv } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";

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

  @Get("summary")
  async summary(@Query("from") from?: string, @Query("to") to?: string) {
    const where: Prisma.PaymentWhereInput = {
      ...this.dateWhere(from, to),
      status: PaymentStatus.SUCCESS,
    };
    const rows = await this.prisma.payment.findMany({
      where,
      select: { amountKobo: true, method: true },
    });
    const byMethod = { STUDIO: 0, ONLINE_BACHS: 0 };
    let totalKobo = 0;
    for (const row of rows) {
      totalKobo += row.amountKobo;
      if (row.method === PaymentMethod.STUDIO) byMethod.STUDIO += row.amountKobo;
      if (row.method === PaymentMethod.ONLINE_BACHS) byMethod.ONLINE_BACHS += row.amountKobo;
    }
    return { totalKobo, count: rows.length, byMethod };
  }

  @Get()
  async list(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
    @Query("method") method?: string,
    @Query("page") pageRaw?: string,
  ) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(undefined, 20);
    const where: Prisma.PaymentWhereInput = {
      ...this.dateWhere(from, to),
      ...(status ? { status: status as PaymentStatus } : {}),
      ...(method ? { method: method as PaymentMethod } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          booking: { include: { customer: true, package: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  private dateWhere(from?: string, to?: string): Prisma.PaymentWhereInput {
    if (!from && !to) return {};
    const gte = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? startOfLagosDay(from) : undefined;
    const lt =
      to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? startOfLagosDay(addLagosDays(to, 1)) : undefined;
    return { createdAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } };
  }
}
