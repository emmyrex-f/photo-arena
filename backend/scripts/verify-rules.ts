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

const now = new Date("2026-09-12T10:10:00+01:00");
const started = new Date("2026-09-12T10:00:00+01:00");
const nextHalfHour = new Date("2026-09-12T10:30:00+01:00");
const pastDay = new Date("2026-09-11T13:00:00+01:00");
const ok = new Date("2026-09-12T13:00:00+01:00");
if (slotFits(started, 60, now, [])) throw new Error("Slot that already started must be rejected");
if (slotFits(started, 60, now, [], { requireSameDayNotice: false })) {
  throw new Error("Admin bookings must also reject slots that already started");
}
if (slotFits(pastDay, 60, now, [], { requireSameDayNotice: false })) {
  throw new Error("Past-day slot must be rejected");
}
if (!slotFits(nextHalfHour, 60, now, [])) throw new Error("Next half-hour must be bookable (no same-day notice)");
if (!slotFits(started, 60, now, [], { allowStarted: true })) {
  throw new Error("Payment confirmation must still place a hold whose start just passed");
}
if (!slotFits(ok, 60, now, [])) throw new Error("Valid same-day slot rejected");
if (slotFits(ok, 60, now, [{ startTime: ok, endTime: new Date(ok.getTime() + 60 * 60_000) }])) {
  throw new Error("Overlap check failed");
}
const booked = [{ startTime: ok, endTime: new Date(ok.getTime() + 60 * 60_000) }];
if (slotFits(new Date(ok.getTime() - 30 * 60_000), 120, now, booked)) {
  throw new Error("Longer package overlapping a booking must be rejected");
}
if (!slotFits(new Date(ok.getTime() + 60 * 60_000), 60, now, booked)) {
  throw new Error("Back-to-back slot after a booking must be bookable");
}

console.log("Pricing and availability rules verified.");
