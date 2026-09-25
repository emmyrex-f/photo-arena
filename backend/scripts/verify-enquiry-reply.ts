import assert from "node:assert/strict";
import { PrismaClient, EnquiryStatus } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = "http://localhost:3001/api";

async function main() {
  console.log("=== Verifying Enquiry Email Reply Dispatch (C5) ===");

  // 1. Authenticate as owner
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "saviorisrael@gmail.com", password: "changeme" }),
  });
  assert.ok(loginRes.ok, `Login failed: ${loginRes.status}`);
  const { token } = await loginRes.json();
  console.log("✓ Owner authenticated");

  // 2. Create a test enquiry with customer email
  const testEmail = `client-${Date.now()}@example.com`;
  const enquiry = await prisma.enquiry.create({
    data: {
      name: "Tariere Amadi",
      email: testEmail,
      phone: "08034567890",
      sessionType: "Birthday Studio Session Inquiry",
      message: "Do you have any outdoor props or only indoor sets?",
      status: EnquiryStatus.NEW,
    },
  });
  console.log(`✓ Test enquiry created with ID: ${enquiry.id}`);

  // 3. Test sending reply
  const replyMessage = "Hello Tariere, thank you for contacting Photo Arena! We offer both indoor architectural sets and portable outdoor equipment upon request.";
  const replyRes = await fetch(`${API_URL}/admin/enquiries/${enquiry.id}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyMessage,
      subject: "Photo Arena — Re: Birthday Studio Session Inquiry",
    }),
  });

  const replyText = await replyRes.text();
  assert.equal(replyRes.status, 201, `Reply failed: ${replyRes.status} ${replyText}`);
  const updatedEnquiry = JSON.parse(replyText);
  assert.equal(updatedEnquiry.status, EnquiryStatus.REPLIED);
  assert.ok(updatedEnquiry.internalNote.includes(replyMessage), "Internal note does not contain reply message");
  console.log("✓ Enquiry marked as REPLIED and reply logged in internal note");

  // 4. Verify notification log entry was created
  const notifLog = await prisma.notificationLog.findFirst({
    where: {
      to: testEmail,
      event: "manual_notice",
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(notifLog, "Notification log entry was not found for the customer reply email");
  console.log(`✓ Notification log verified (ID: ${notifLog.id}, to: ${notifLog.to})`);

  // 5. Test validation: empty reply message -> 400
  const invalidRes = await fetch(`${API_URL}/admin/enquiries/${enquiry.id}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyMessage: "   " }),
  });
  assert.equal(invalidRes.status, 400, "Expected 400 for empty reply message");
  console.log("✓ Empty reply message rejected with 400 Bad Request");

  // 6. Cleanup
  await prisma.notificationLog.deleteMany({ where: { to: testEmail } });
  await prisma.enquiry.delete({ where: { id: enquiry.id } });
  console.log("✓ Test cleanup completed");

  console.log("\n✅ C5 ENQUIRY EMAIL REPLY DISPATCH VERIFIED 100%");
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
