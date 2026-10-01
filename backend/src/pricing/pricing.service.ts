import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type BookingSource = "ONLINE" | "WALK_IN" | "ADMIN";

@Injectable()
export class PricingService implements OnModuleInit {
  private onlineDiscountBps = 500;
  private rescheduleFeeBps = 1500;
  /** Photo Arena operates a strict no-refund policy on cancellations (100% forfeit / non-refundable deposit). */
  private cancellationPenaltyBps = 10000;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh() {
    this.onlineDiscountBps = 0;
    this.rescheduleFeeBps = 1500;
    this.cancellationPenaltyBps = 10000;
    const rules = await this.prisma.pricingRule.findMany({
      where: { key: { in: ["ONLINE_DISCOUNT", "RESCHEDULE_FEE", "CANCELLATION_PENALTY"] } },
    });
    for (const rule of rules) {
      if (!rule.isActive) continue;
      if (rule.key === "ONLINE_DISCOUNT") this.onlineDiscountBps = rule.bps;
      if (rule.key === "RESCHEDULE_FEE") this.rescheduleFeeBps = rule.bps;
      if (rule.key === "CANCELLATION_PENALTY") this.cancellationPenaltyBps = rule.bps;
    }
  }

  getOnlineDiscountBps() {
    return this.onlineDiscountBps;
  }

  getRescheduleFeeBps() {
    return this.rescheduleFeeBps;
  }

  getCancellationPenaltyBps() {
    return this.cancellationPenaltyBps;
  }

  calculatePayableKobo(basePriceKobo: number, source: BookingSource): number {
    if (source === "ONLINE") {
      return Math.floor((basePriceKobo * (10_000 - this.onlineDiscountBps)) / 10_000);
    }
    return basePriceKobo;
  }

  calculateDiscountKobo(basePriceKobo: number, source: BookingSource): number {
    return basePriceKobo - this.calculatePayableKobo(basePriceKobo, source);
  }

  calculateRescheduleFeeKobo(originalPackagePriceKobo: number): number {
    return Math.floor((originalPackagePriceKobo * this.rescheduleFeeBps) / 10_000);
  }

  calculateCancellationPenaltyKobo(originalPackagePriceKobo: number): number {
    // Strict no-refund contract policy: 100% of the session fee is forfeited on cancellation
    return Math.floor((originalPackagePriceKobo * this.cancellationPenaltyBps) / 10_000);
  }

  toBachsAmount(kobo: number): string {
    return (kobo / 100).toFixed(2);
  }
}
