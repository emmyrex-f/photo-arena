---
name: booking-qa
description: Runs Photo Arena booking-domain QA against the live NestJS API and booking UI. Use when verifying service/package selection, availability, 30-minute slots, 2-hour notice, holds, overlap, reschedule, no-show, cancellation, or /booking-qa.
---

# Booking QA

Photo Arena studio booking engine. Domain law: `.cursor/rules/booking-domain.mdc`. Do not recompute prices or occupancy in React.

## When to use

- After any change in `backend/src/bookings/`, `pricing/`, `catalog/`, or `frontend/src/pages/BookPage.tsx`
- Before marking Milestone 4 VERIFIED
- When the user invokes `/booking-qa`

## Prerequisites

- PostgreSQL up (`docker compose up -d` from project root)
- Backend on `http://localhost:3001`
- Seeded catalog (`npm run prisma:seed` in `backend/`)
- Frontend on `http://localhost:5173` for UI checks
- `Africa/Lagos` for displayed times; store UTC

## Workflow

1. Read `docs/BOOKING-FLOW.md` and `backend/src/bookings/bookings.service.ts`.
2. Run API scenarios (scripts + curl). Do not stop at source inspection.
3. Exercise Book Now in the browser (desktop + one mobile width).
4. Classify each scenario: PASS / FAIL / BLOCKED.
5. On FAIL: reproduce, diagnose, fix in backend (not React), retest, record.
6. Write results into `docs/IMPLEMENTATION-STATUS.md` (Milestone 4) and failures into `docs/KNOWN-ISSUES.md`.

## Commands

From `backend/`:

```bash
npm run verify:rules
```

Optional focused hold/overlap checks: inspect `backend/scripts/verify-rules.ts` and extend rather than duplicating.

Health:

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/public/services
```

## Test scenarios

Must actually run:

- service selection
- package selection
- pricing
- online discount (from settings/PricingRule, not hardcoded 5)
- date selection
- available times
- 30-minute increments
- 2-hour minimum notice
- same-day booking
- temporary hold
- hold expiration
- overlapping bookings
- concurrent bookings
- package duration
- walk-ins
- admin bookings
- future reservations
- rescheduling
- cancellation restriction (customer cannot cancel/refund)
- no-show
- payment relationship
- confirmation
- calendar creation only after CONFIRMED

Details: [references/scenarios.md](references/scenarios.md)

## Expected results

- One studio resource; overlapping CONFIRMED/PENDING/TEMPORARY_HOLD rejected.
- Hold expires in 15 minutes and releases the slot.
- Online amount = package price minus configured discount bps, frozen on `Booking.amountKobo`.
- Client-supplied `price` / `amount` / `discount` ignored.
- Deactivated services/packages not bookable.
- Calendar/.ics only after verified payment → CONFIRMED.

## Failure conditions

- Two confirmed bookings on the same resource/time.
- Slot shown available but hold fails, or hold succeeds on occupied slot.
- Discount hardcoded in frontend used for charging.
- Hold survives expiry.
- Customer cancel/refund endpoint exists and works.
- Calendar event before CONFIRMED.

## Remediation

1. Reproduce with API timestamps (Lagos).
2. Fix in NestJS service + Prisma transaction/lock (`resource-lock.ts`).
3. Re-run `verify:rules` and the failing scenario.
4. Do not “fix” by hiding slots only in React.

## Reporting format

```markdown
## Booking QA
Date:
API: http://localhost:3001/api
| Scenario | Result | Evidence | Notes |
| ... | PASS/FAIL/BLOCKED | command or URL | |
Failures:
Fixes applied:
Retest:
```
