import { PricingService } from "../src/pricing/pricing.service";
import {
  generateCandidateStartsForYmd,
  slotFits,
  toLagosHour,
} from "../src/bookings/availability";

const pricing = new PricingService();
const base = 6_000_000;
const online = pricing.calculatePayableKobo(base, "ONLINE");
const studio = pricing.calculatePayableKobo(base, "WALK_IN");
const fee = pricing.calculateRescheduleFeeKobo(base);

if (online !== 5_700_000) throw new Error(`Expected online 5700000, got ${online}`);
if (studio !== base) throw new Error("Studio price must stay full");
if (fee !== 900_000) throw new Error(`Expected reschedule 900000, got ${fee}`);
if (pricing.toBachsAmount(online) !== "57000.00") throw new Error("Bachs decimal conversion failed");

const sundayStarts = generateCandidateStartsForYmd("2026-09-13");
if (toLagosHour(sundayStarts[0]!) !== 12) throw new Error("Sunday must start at 12:00");

const saturdayStarts = generateCandidateStartsForYmd("2026-09-12");
if (toLagosHour(saturdayStarts[0]!) !== 8) throw new Error("Weekday must start at 08:00");

const now = new Date("2026-09-12T10:00:00+01:00");
const tooSoon = new Date("2026-09-12T11:00:00+01:00");
const ok = new Date("2026-09-12T13:00:00+01:00");
if (slotFits(tooSoon, 60, now, [])) throw new Error("Same-day 2-hour notice failed");
if (!slotFits(ok, 60, now, [])) throw new Error("Valid same-day slot rejected");
if (slotFits(ok, 60, now, [{ startTime: ok, endTime: new Date(ok.getTime() + 60 * 60_000) }])) {
  throw new Error("Overlap check failed");
}
if (!slotFits(tooSoon, 60, now, [], { requireSameDayNotice: false })) {
  throw new Error("Admin walk-in should skip the 2-hour online notice");
}

console.log("Pricing and availability rules verified.");
