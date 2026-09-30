# Booking QA scenarios

Use Lagos local dates. Convert to UTC ISO for API bodies.

## Catalog

1. `GET /api/public/services` — only active services; packages include duration, includes, `priceKobo`, online payable from server.
2. Deactivate a service in admin; it disappears from public list and cannot be held.
3. Packages visually grouped on `/book` (not one undifferentiated list).

## Availability

4. Slots on 30-minute grid inside opening hours (Mon–Sat 08:00–18:00, Sun 12:00–18:00 unless settings say otherwise).
5. Package duration occupies the full window (90 min package blocks 90 min).
6. Same-day: first slot is the next 30-minute start that has not begun; started slots and past dates are refused.
7. Occupied interval hidden/rejected for TEMPORARY_HOLD, PENDING, CONFIRMED.

## Hold

8. `POST` hold creates TEMPORARY_HOLD, `holdExpiresAt` ≈ now+15m, frozen `amountKobo`.
9. Second hold on overlapping window fails.
10. Concurrent double-hold: only one succeeds (transaction + lock).
11. After expiry, slot is bookable again.
12. Hold body cannot set amount/discount/price.

## Admin / walk-in

13. OWNER/ADMIN walk-in → PENDING (studio pay), no Bachs required.
14. Admin reservations follow the same rule as online: any unstarted slot, never a started or past one.
15. Customer has no cancel endpoint; admin cancel → CANCELLED, not NO_SHOW.
16. NO_SHOW is a distinct status.

## Reschedule / payment

17. Reschedule fee 15% of original package price (not discounted online price unless code documents otherwise).
18. Confirmed booking has Payment SUCCESS (online) or studio method recorded (walk-in).
19. Confirmation page calendar actions only when status is CONFIRMED.
