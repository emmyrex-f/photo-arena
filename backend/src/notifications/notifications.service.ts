import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";
import { buildEventEmail, buildManualNotificationEmail } from "./email-templates";
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
  {
    event: "checkout_abandoned",
    subject: "Photo Arena — checkout abandoned (hold released)",
    bodyPreview: "Checkout for {{customerName}} was abandoned. The temporary hold for {{startTime}} has been released.",
  },
];

@Injectable()
export class NotificationsService {
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const resendApiKey = this.config.get<string>("RESEND_API_KEY")?.trim();
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
    }

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

  isConfigured(): boolean {
    return Boolean(this.resend || this.transporter);
  }

  emailProvider(): "resend" | "smtp" | "dry-run" {
    if (this.resend) return "resend";
    if (this.transporter) return "smtp";
    return "dry-run";
  }

  smtpConfigured() {
    return this.isConfigured();
  }

  fromAddress() {
    return (
      this.config.get<string>("RESEND_FROM")?.trim() ||
      this.config.get<string>("SMTP_FROM")?.trim() ||
      "Photo Arena <noreply@photoarenang.com>"
    );
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
    const provider = this.emailProvider();
    const channel = `email:${provider}`;
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

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: this.fromAddress(),
          to,
          subject: message.subject,
          text: message.body,
          html: message.html,
        });
      } catch (err) {
        console.error("[resend:error]", err);
        throw err;
      }
    } else if (this.transporter) {
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to: to.join(", "),
        subject: message.subject,
        text: message.body,
        html: message.html,
      });
    } else {
      // No Resend/SMTP — log only. Password-reset links are included so local desk recovery can be tested.
      console.info("[email:dry-run]", message.event, to.join(","));
      if (message.event === "password_reset") {
        const link = message.body.match(/https?:\/\/\S*reset-password\S*/i)?.[0];
        if (link) {
          console.info("[email:dry-run] password reset link (not emailed):", link);
        }
      }
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

  async sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
    const subject = "Reset your Photo Arena desk password";
    const text = `Hello ${name},\n\nWe received a request to reset the password for your Photo Arena desk account.\n\nClick the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 60 minutes. If you did not request this, you can safely ignore this email.\n\n— Photo Arena Team`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#0b0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0f6fc;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;margin:0 auto;background-color:#11161d;border:1px solid #252d3a;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
    <tr>
      <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #252d3a;text-align:center;">
        <h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:0.05em;color:#e2b168;text-transform:uppercase;">Photo Arena</h1>
        <p style="margin:4px 0 0 0;font-size:12px;color:#8b949e;letter-spacing:0.15em;text-transform:uppercase;">Studio Desk</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:500;color:#ffffff;">Password Reset Request</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#c9d1d9;">Hello <strong>${name}</strong>,</p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#c9d1d9;">
          We received a request to reset the password for your desk account (<span style="color:#e2b168;">${email}</span>). Click the button below to choose a new password:
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;">
          <tr>
            <td align="center">
              <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;background-color:#e2b168;color:#0b0e14;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 8px 0;font-size:13px;line-height:1.5;color:#8b949e;">
          This link will expire in <strong>60 minutes</strong> and can only be used once.
        </p>
        <p style="margin:0 0 24px 0;font-size:13px;line-height:1.5;color:#8b949e;">
          If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
        </p>
        <hr style="border:none;border-top:1px solid #252d3a;margin:24px 0;" />
        <p style="margin:0;font-size:12px;line-height:1.5;color:#6e7681;word-break:break-all;">
          If the button above does not work, copy and paste this URL into your browser:<br/>
          <a href="${resetUrl}" style="color:#58a6ff;text-decoration:underline;">${resetUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background-color:#0b0e14;border-top:1px solid #252d3a;text-align:center;">
        <p style="margin:0;font-size:12px;color:#6e7681;">
          Photo Arena Studio · Port Harcourt, Rivers State, Nigeria
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    await this.send({
      event: "password_reset",
      to: [email],
      subject,
      body: text,
      html,
    });
  }

  async notifyEvent(
    event: NotificationEvent,
    vars: Record<string, string>,
    extraTo: string[] = [],
  ) {
    const tpl = TEMPLATES.find((t) => t.event === event) ?? TEMPLATES[0];
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
    const recipients = [...new Set([...(await this.getRecipients()), ...extraTo.map((e) => e.toLowerCase())])];

    const built = buildEventEmail(event, vars);
    const subject = built.subject || fill(tpl.subject);
    const body = built.text || (fill(tpl.bodyPreview) + (vars.details ? `\n\n${vars.details}` : ""));

    await this.send({
      event,
      to: recipients,
      subject,
      body,
      html: built.html,
    });
  }

  async sendManualNotification(input: {
    to: string;
    subject: string;
    message: string;
    customerName?: string;
    senderEmail?: string;
  }) {
    const built = buildManualNotificationEmail({
      subject: input.subject,
      message: input.message,
      customerName: input.customerName,
      senderEmail: input.senderEmail,
    });
    await this.send({
      event: "manual_notice",
      to: [input.to.trim().toLowerCase()],
      subject: built.subject,
      body: built.text,
      html: built.html,
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
    const channel = "email:" + this.emailProvider();
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
