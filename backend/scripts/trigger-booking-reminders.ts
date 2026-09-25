/**
 * One-shot: force-send 24h + 2h booking_reminder emails for a booking reference.
 * Usage: npx tsx scripts/trigger-booking-reminders.ts PA-FF08ACAFBE
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { buildEventEmail } from "../src/notifications/email-templates";

async function main() {
  const reference = (process.argv[2] ?? "").trim().toUpperCase();
  if (!reference) {
    console.error("Usage: npx tsx scripts/trigger-booking-reminders.ts <REFERENCE>");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const booking = await prisma.booking.findFirst({
      where: { reference },
      include: { customer: true, package: true },
    });
    if (!booking) {
      console.error(`No booking found for reference ${reference}`);
      process.exitCode = 1;
      return;
    }

    const customerEmail = (booking.contactEmail || booking.customer.email || "").trim().toLowerCase();
    if (!customerEmail) {
      console.error("Booking has no contact email — cannot send reminders.");
      process.exitCode = 1;
      return;
    }
    const recipientsRow = await prisma.businessSettings.findUnique({
      where: { key: "notifications.recipients" },
    });
    const deskRecipients = (recipientsRow?.value || process.env.NOTIFICATION_EMAIL_RECIPIENTS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && !/@example\.com$/i.test(e));

    const to = [...new Set([customerEmail, ...deskRecipients])];
    const resendKey = (process.env.RESEND_API_KEY ?? "").trim();
    const smtpHost = (process.env.SMTP_HOST ?? "").trim();
    const provider = resendKey ? "resend" : smtpHost ? "smtp" : "dry-run";
    const from =
      (process.env.RESEND_FROM ?? "").trim() ||
      (process.env.SMTP_FROM ?? "").trim() ||
      "Photo Arena <noreply@photoarenang.com>";

    console.log(
      JSON.stringify(
        {
          reference: booking.reference,
          id: booking.id,
          status: booking.status,
          startTime: booking.startTime.toISOString(),
          customerEmail: customerEmail || null,
          to,
          provider,
        },
        null,
        2,
      ),
    );

    if (!to.length) {
      console.error("No recipients (customer email empty and no desk recipients).");
      process.exitCode = 1;
      return;
    }

    const vars = {
      customerName: booking.customer.name,
      startTime: booking.startTime.toISOString(),
      reference: booking.reference ?? booking.id,
      details: `Package: ${booking.package.name}`,
    };
    const built = buildEventEmail("booking_reminder", vars);

    async function deliver() {
      if (provider === "resend") {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from,
          to,
          subject: built.subject,
          text: built.text,
          html: built.html,
        });
      } else if (provider === "smtp") {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: false,
          auth: {
            user: process.env.SMTP_USER || undefined,
            pass: process.env.SMTP_PASS || undefined,
          },
        });
        await transporter.sendMail({
          from,
          to: to.join(", "),
          subject: built.subject,
          text: built.text,
          html: built.html,
        });
      } else {
        console.info("[email:dry-run] booking_reminder", to.join(","));
      }
    }

    for (const kind of ["24h", "2h"] as const) {
      console.log(`Sending ${kind} booking_reminder…`);
      await deliver();
      await prisma.notificationLog.create({
        data: {
          event: "booking_reminder",
          channel: `email:${provider}`,
          to: to.join(","),
          payload: JSON.stringify({
            event: "booking_reminder",
            kind,
            bookingId: booking.id,
            reference: booking.reference,
            subject: built.subject,
            to,
          }),
        },
      });
      await prisma.notificationLog.create({
        data: {
          event: kind === "24h" ? "booking_reminder_24h" : "booking_reminder_2h",
          channel: `email:${provider}`,
          to: to[0] ?? "(none)",
          payload: JSON.stringify({ bookingId: booking.id, kind, forced: true }),
        },
      });
      console.log(`  ✓ ${kind} reminder logged via ${provider}`);
    }

    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
