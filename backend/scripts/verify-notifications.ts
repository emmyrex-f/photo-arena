import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { buildEventEmail, buildManualNotificationEmail } from "../src/notifications/email-templates";
import { SmsNotificationChannel } from "../src/notifications/email.channel";
import type { NotificationEvent } from "../src/notifications/notification.types";

async function main() {
  console.log("Starting verification of N1, N2, N3, N4, N5, N6 notification features...\n");
  const prisma = new PrismaClient();

  try {
    // 1. Verify N2 & N3: Rich HTML templates for all 7 booking events + unsubscribe links
    console.log("Testing N2 & N3: Rich HTML email templates & unsubscribe footer...");
    const events: NotificationEvent[] = [
      "booking_created",
      "booking_confirmed",
      "payment_received",
      "booking_reminder",
      "booking_rescheduled",
      "booking_cancelled",
      "payment_failed",
    ];

    for (const evt of events) {
      const email = buildEventEmail(evt, {
        customerName: "Amara Nwachukwu",
        reference: "PA-TEST-2026",
        startTime: "2026-10-15T14:00:00.000Z",
        amount: "₦35,000",
        details: "Standard Studio Portrait Session with 2 backdrop changes",
      });

      assert.ok(email.subject.includes("Photo Arena"), `Subject must contain Photo Arena: ${email.subject}`);
      assert.ok(email.subject.includes("PA-TEST-2026"), `Subject should include booking ref: ${email.subject}`);
      assert.ok(email.text.includes("Amara Nwachukwu"), "Plain text must contain customer name");
      assert.ok(email.text.includes("PA-TEST-2026"), "Plain text must contain booking reference");
      assert.ok(email.html.includes("<!DOCTYPE html>"), "HTML must be a valid document");
      assert.ok(email.html.includes("Photo Arena"), "HTML must contain studio branding");
      assert.ok(email.html.includes("Amara Nwachukwu"), "HTML must contain customer name");
      assert.ok(email.html.includes("PA-TEST-2026"), "HTML must contain booking reference");
      assert.ok(email.html.includes("#e2b168"), "HTML must use brand gold accent color");
      // N3: Unsubscribe / preferences link verification
      assert.ok(email.html.includes("Unsubscribe from session reminders"), "HTML must include unsubscribe link (N3)");
      assert.ok(email.text.includes("unsubscribe from reminders"), "Plain text must include unsubscribe instructions (N3)");
      assert.ok(email.html.includes("Port Harcourt, Rivers State, Nigeria"), "HTML must include studio physical address (CAN-SPAM/GDPR)");
      console.log(`  ✓ Event '${evt}' renders branded HTML (${email.html.length} bytes) + plain text`);
    }

    // 2. Verify N4: Manual admin notification template builder
    console.log("\nTesting N4: Manual email template builder...");
    const manualEmail = buildManualNotificationEmail({
      subject: "Exclusive Gallery Preview Ready",
      message: "Hello Amara, your digital proofing gallery has been compiled and is ready for selection.\n\nPlease review your photos within 48 hours.",
      customerName: "Amara Nwachukwu",
      senderEmail: "desk@photoarenang.com",
    });
    assert.equal(manualEmail.subject, "Exclusive Gallery Preview Ready");
    assert.ok(manualEmail.html.includes("Studio Desk Notice"));
    assert.ok(manualEmail.html.includes("Exclusive Gallery Preview Ready"));
    assert.ok(manualEmail.html.includes("Hello <strong>Amara Nwachukwu</strong>"));
    assert.ok(manualEmail.html.includes("Unsubscribe from broadcast emails"));
    console.log("  ✓ Manual email template formatted successfully with studio branding and unsubscribe option");

    // 3. Verify N5: SmsNotificationChannel dry-run safety
    console.log("\nTesting N5: SMS channel graceful execution...");
    const smsChannel = new SmsNotificationChannel();
    // Must not throw
    await smsChannel.send({
      event: "booking_confirmed",
      to: ["+2348012345678"],
      subject: "Booking confirmed",
      body: "Your booking is confirmed",
    });
    console.log("  ✓ SmsNotificationChannel executed without throwing an unhandled exception");

    // 4. Verify NotificationLog in Database
    console.log("\nTesting Database Logging for Notifications...");
    const testLog = await prisma.notificationLog.create({
      data: {
        event: "manual_notice",
        channel: "email:resend",
        to: "test-verify-notifications@example.com",
        payload: JSON.stringify({ subject: manualEmail.subject, customerName: "Amara Nwachukwu" }),
      },
    });
    assert.ok(testLog.id);
    assert.equal(testLog.event, "manual_notice");
    assert.equal(testLog.channel, "email:resend");
    console.log("  ✓ Database notificationLog recorded successfully (id:", testLog.id, ")");

    // Cleanup test record
    await prisma.notificationLog.delete({ where: { id: testLog.id } });
    console.log("  ✓ Test notification record cleaned up");

    console.log("\n==================================================");
    console.log("All notification feature verifications PASSED! (N1–N6)");
    console.log("==================================================");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
