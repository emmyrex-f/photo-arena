# Photo Arena — Booking Flow

**Updated:** 2026-09-12  
**Status:** Confirmed operating rules

---

## 1. Confirmed booking rules

### Hours

| Day | Hours |
|---|---|
| Monday–Saturday | 8:00 AM – 6:00 PM |
| Sunday | 12:00 PM – 6:00 PM |

Timezone: Africa/Lagos. Store UTC.

### Capacity

- One location
- One client / session at a time
- No buffer between sessions
- Slot increment: 30 minutes
- A package occupies its full duration (90 minutes = 90-minute block)

### Same-day online

Allowed for any slot that has not started yet (no minimum notice, D-30). Past dates and started slots are never offered or accepted.

### Sources

```text
ONLINE | WALK_IN | ADMIN
```

Walk-in / future reservations may only be created by OWNER or ADMIN.

---

## 2. Status model

```text
TEMPORARY_HOLD   online checkout hold (15 minutes)
PENDING          admin/walk-in reserved, unpaid
CONFIRMED        payment received (online or studio)
COMPLETED        session finished
CANCELLED        cancelled by admin
NO_SHOW          customer did not attend
```

`NO_SHOW` must never be merged into `CANCELLED`.

Statuses that block availability: `TEMPORARY_HOLD`, `PENDING`, `CONFIRMED`.

Statuses that do not block: `CANCELLED`, expired holds, `COMPLETED`, `NO_SHOW`. `COMPLETED` / `NO_SHOW` can only be set once the session has started (D-31), so they never reopen a future slot.

---

## 3. Online flow

```text
1. Customer selects service/package
2. Frontend requests available slots
3. Backend generates 30-minute start times inside operating hours
4. Each candidate occupies [start, start + package.duration)
5. Reject if it overruns closing time, overlaps a blocking booking, or has already started
6. Customer selects a slot
7. Backend creates TEMPORARY_HOLD (15 minutes)
8. Backend PricingService applies 5% online discount
9. Customer pays via Bachs
10. Webhook success → Payment SUCCESS, Booking CONFIRMED
11. Customer + two staff recipients notified
```

If the hold expires or payment fails, the slot is released.

---

## 4. Walk-in / future reservation flow

```text
1. OWNER or ADMIN creates a booking for a future slot
2. Same availability engine as online
3. Booking source = WALK_IN or ADMIN
4. Status = PENDING
5. Slot is blocked immediately
6. Customer pays at the studio
7. Admin records payment
8. Booking → CONFIRMED
```

---

## 5. Reschedule and no-show

Reschedule (later):

```text
fee = original_package_price * 15%
new slot must be available
history/audit recorded
no refunds
```

No-show:

```text
Admin marks NO_SHOW
Customer may contact admin later
If they reschedule, 15% fee applies
```

Customers cannot self-cancel. Admin handles exceptions.

---

## 6. Availability algorithm

Inputs: date, package duration, resource id, operating hours, existing blocking bookings, active holds, now (starts must be after now).

Database backstop: the `Booking_no_overlap` exclusion constraint (`prisma/sql/booking-overlap-exclude.sql`, applied with `npm run prisma:constraints`) rejects overlapping `TEMPORARY_HOLD` / `PENDING` / `CONFIRMED` rows on the same resource. Because it counts holds regardless of expiry, `lockStudioResource` cancels expired holds before each booking write.

Conflict:

```text
existing.start < requested.end AND existing.end > requested.start
```

Safety:

1. Check before insert
2. Wrap check + insert in a Prisma transaction
3. Optional later: PostgreSQL `EXCLUDE USING gist`

---

## 7. Reminders

- 24 hours before start
- 2 hours before start
- Email channel first
- SMS channel later (no provider yet)
