import "./load-env";
import { BookingStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stale = await prisma.booking.findMany({
    where: {
      OR: [
        { customer: { email: { startsWith: "flow-" } } },
        { customer: { email: { startsWith: "cal" } } },
        { customer: { email: { startsWith: "cala-" } } },
        { customer: { email: { startsWith: "calb-" } } },
        { customer: { email: { startsWith: "calwalk-" } } },
        { customer: { email: { startsWith: "cal90-" } } },
        { customer: { name: { startsWith: "Flow Test" } } },
        { customer: { name: { startsWith: "Cal" } } },
      ],
    },
    select: { id: true },
  });
  for (const b of stale) {
    await prisma.payment.deleteMany({ where: { bookingId: b.id } });
    try {
      await prisma.booking.delete({ where: { id: b.id } });
    } catch {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
      });
    }
  }
  console.log(`cleaned ${stale.length} test booking(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
