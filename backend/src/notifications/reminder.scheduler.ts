import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BookingStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleReminders() {
    const settings = await this.prisma.businessSettings.findMany({
      where: { key: { in: ["notifications.reminder24h", "notifications.reminder2h"] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const enable24 = (map["notifications.reminder24h"] ?? "true") === "true";
    const enable2 = (map["notifications.reminder2h"] ?? "true") === "true";
    if (!enable24 && !enable2) return;

    const now = Date.now();
    const windowMs = 15 * 60_000; // 15-minute lead buffer for scheduler restarts
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startTime: {
          gte: new Date(now),
          lte: new Date(now + 26 * 60 * 60_000),
        },
      },
      include: { customer: true, package: true },
    });

    const recipients = await this.notifications.getRecipients();

    for (const booking of bookings) {
      const msUntil = booking.startTime.getTime() - now;
      const vars = {
        customerName: booking.customer.name,
        startTime: booking.startTime.toISOString(),
        reference: booking.reference ?? booking.id,
        details: `Package: ${booking.package.name}`,
      };

      // 24h reminder: eligible from (24h + 15m) down to 2h before session
      if (enable24 && msUntil <= 24 * 60 * 60_000 + windowMs && msUntil >= 2 * 60 * 60_000) {
        if (!(await this.notifications.hasReminderBeenSent(booking.id, "24h"))) {
          await this.notifications.notifyEvent("booking_reminder", vars, [
            booking.customer.email ?? "",
          ].filter(Boolean));
          await this.notifications.markReminder(booking.id, "24h", recipients);
          this.logger.log(`Sent 24h reminder for booking ${booking.id} (${booking.customer.name})`);
        }
      }

      // 2h reminder: eligible from (2h + 15m) down to shoot start
      if (enable2 && msUntil <= 2 * 60 * 60_000 + windowMs && msUntil > 0) {
        if (!(await this.notifications.hasReminderBeenSent(booking.id, "2h"))) {
          await this.notifications.notifyEvent("booking_reminder", vars, [
            booking.customer.email ?? "",
          ].filter(Boolean));
          await this.notifications.markReminder(booking.id, "2h", recipients);
          this.logger.log(`Sent 2h reminder for booking ${booking.id} (${booking.customer.name})`);
        }
      }
    }
  }
}
