import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type BookingSource = "ONLINE" | "WALK_IN" | "ADMIN";

export const ONLINE_DISCOUNT_RULE = "ONLINE_DISCOUNT";
export const ONLINE_DISCOUNT_SETTING = "policies.onlineDiscountPercent";
export const MAX_PRICING_RULE_BPS = 5000;

/** Bachs rejects an NGN checkout below 100.00. Customer online payments cannot go under this. */
export const MIN_CUSTOMER_TRANSACTION_KOBO = 10_000;

export function isBelowCustomerMinimum(amountKobo: number): boolean {
  return !Number.isInteger(amountKobo) || amountKobo < MIN_CUSTOMER_TRANSACTION_KOBO;
}

export function customerMinimumMessage(amountKobo?: number): string {
  const minimum = "₦100";
  if (amountKobo == null || !Number.isInteger(amountKobo)) {
    return `Online payments must be at least ${minimum}.`;
  }
  const naira = (amountKobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Online payments must be at least ${minimum}. This charge is ₦${naira}.`;
}

@Injectable()
export class PricingService implements OnModuleInit {
  private onlineDiscountBps = 0;
  private rescheduleFeeBps = 1500;
  /** Photo Arena operates a strict no-refund policy on cancellations (100% forfeit / non-refundable deposit). */
  private cancellationPenaltyBps = 10000;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh() {
    const rules = await this.prisma.pricingRule.findMany({
      where: { key: { in: [ONLINE_DISCOUNT_RULE, "RESCHEDULE_FEE", "CANCELLATION_PENALTY"] } },
    });
    this.onlineDiscountBps = 0;
    this.rescheduleFeeBps = 1500;
    this.cancellationPenaltyBps = 10000;
    for (const rule of rules) {
      if (!rule.isActive) continue;
      if (rule.key === ONLINE_DISCOUNT_RULE) this.onlineDiscountBps = rule.bps;
      if (rule.key === "RESCHEDULE_FEE") this.rescheduleFeeBps = rule.bps;
      if (rule.key === "CANCELLATION_PENALTY") this.cancellationPenaltyBps = rule.bps;
    }
  }

  async readOnlineDiscountBps() {
    const rule = await this.prisma.pricingRule.findUnique({
      where: { key: ONLINE_DISCOUNT_RULE },
      select: { bps: true, isActive: true },
    });
    return rule?.isActive ? rule.bps : 0;
  }

  getRescheduleFeeBps() {
    return this.rescheduleFeeBps;
  }

  getCancellationPenaltyBps() {
    return this.cancellationPenaltyBps;
  }

  calculatePayableKobo(basePriceKobo: number, source: BookingSource, discountBps = this.onlineDiscountBps): number {
    if (source !== "ONLINE") return basePriceKobo;
    return Math.floor((basePriceKobo * (10_000 - discountBps)) / 10_000);
  }

  calculateDiscountKobo(basePriceKobo: number, source: BookingSource, discountBps = this.onlineDiscountBps): number {
    return basePriceKobo - this.calculatePayableKobo(basePriceKobo, source, discountBps);
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
