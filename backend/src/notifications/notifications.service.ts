import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { PrismaService } from "../prisma/prisma.service";
import type { NotificationEvent, NotificationMessage } from "./notification.types";

const TEMPLATES: Array<{ event: NotificationEvent; subject: string; bodyPreview: string }> = [
  {
    event: "booking_created",
    subject: "Photo Arena — booking hold created",
    bodyPreview: "A temporary hold was placed for {{customerName}} on {{startTime}}.",
  },
  {
    event: "booking_confirmed",
    subject: "Photo Arena — booking confirmed",
    bodyPreview: "Booking {{reference}} is confirmed for {{customerName}}.",
  },
  {
    event: "payment_received",
    subject: "Photo Arena — payment received",
    bodyPreview: "Payment {{reference}} of {{amount}} was received.",
  },
  {
    event: "booking_cancelled",
    subject: "Photo Arena — booking cancelled",
    bodyPreview: "Booking {{reference}} was cancelled.",
  },
  {
    event: "booking_rescheduled",
    subject: "Photo Arena — booking rescheduled",
    bodyPreview: "Booking {{reference}} moved to {{startTime}}.",
  },
  {
    event: "payment_failed",
    subject: "Photo Arena — payment failed",
    bodyPreview: "Payment {{reference}} failed.",
  },
  {
    event: "booking_reminder",
    subject: "Photo Arena — session reminder",
    bodyPreview: "Reminder: {{customerName}} is booked at {{startTime}}.",
  },
];

@Injectable()
export class NotificationsService {
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get<string>("SMTP_HOST")?.trim();
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>("SMTP_PORT") ?? 587),
        secure: false,
        auth: {
          user: this.config.get<string>("SMTP_USER") ?? undefined,
          pass: this.config.get<string>("SMTP_PASS") ?? undefined,
        },
      });
    }
  }

  smtpConfigured() {
    return Boolean(this.config.get<string>("SMTP_HOST")?.trim());
  }

  fromAddress() {
    return this.config.get<string>("SMTP_FROM") ?? "Photo Arena <noreply@photoarenang.com>";
  }

  templates() {
    return TEMPLATES;
  }

  async getRecipients(): Promise<string[]> {
    const row = await this.prisma.businessSettings.findUnique({
      where: { key: "notifications.recipients" },
    });
    const raw = (row?.value || this.config.get<string>("NOTIFICATION_EMAIL_RECIPIENTS") || "").trim();
    return raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  async send(message: NotificationMessage) {
    const channel = this.transporter ? "email" : "email:dry-run";
    const to = message.to.length ? message.to : await this.getRecipients();
    if (!to.length) {
      await this.prisma.notificationLog.create({
        data: {
          event: message.event,
          channel,
          to: "(none)",
          payload: JSON.stringify({ ...message, skipped: "no recipients" }),
        },
      });
      return;
    }

    if (this.transporter) {
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to: to.join(", "),
        subject: message.subject,
        text: message.body,
      });
    } else {
      console.info("[email:dry-run]", message.event, to.join(","));
    }

    for (const addr of to) {
      await this.prisma.notificationLog.create({
        data: {
          event: message.event,
          channel,
          to: addr,
          payload: JSON.stringify(message),
        },
      });
    }
  }

  async notifyEvent(
    event: NotificationEvent,
    vars: Record<string, string>,
    extraTo: string[] = [],
  ) {
    const tpl = TEMPLATES.find((t) => t.event === event) ?? TEMPLATES[0];
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
    const recipients = [...new Set([...(await this.getRecipients()), ...extraTo.map((e) => e.toLowerCase())])];
    await this.send({
      event,
      to: recipients,
      subject: fill(tpl.subject),
      body: fill(tpl.bodyPreview) + (vars.details ? `\n\n${vars.details}` : ""),
    });
  }

  async hasReminderBeenSent(bookingId: string, kind: "24h" | "2h") {
    const event = kind === "24h" ? "booking_reminder_24h" : "booking_reminder_2h";
    const existing = await this.prisma.notificationLog.findFirst({
      where: { event, payload: { contains: bookingId } },
    });
    return Boolean(existing);
  }

  async markReminder(bookingId: string, kind: "24h" | "2h", to: string[]) {
    const event = kind === "24h" ? "booking_reminder_24h" : "booking_reminder_2h";
    const channel = this.transporter ? "email" : "email:dry-run";
    for (const addr of to.length ? to : ["(none)"]) {
      await this.prisma.notificationLog.create({
        data: {
          event,
          channel,
          to: addr,
          payload: JSON.stringify({ bookingId, kind }),
        },
      });
    }
  }
}
