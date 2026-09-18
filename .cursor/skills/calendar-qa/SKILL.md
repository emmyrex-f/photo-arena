---
name: calendar-qa
description: Verifies Photo Arena Google Calendar links and RFC ICS generation only after verified CONFIRMED bookings, with 24h/2h reminders and idempotency. Use for /calendar-qa or Milestone 10.
---

# Calendar QA

Never create a calendar event before payment is genuinely confirmed.

## When to use

- Milestone 10, confirmation page changes, `/calendar-qa`

## Prerequisites

- A CONFIRMED booking (mock pay in dev)
- A TEMPORARY_HOLD booking for negative tests

## Workflow

1. Read confirmation page + any backend calendar helper.
2. Hold/pending/failed: no Google URL, no ICS download (or disabled).
3. CONFIRMED: Google Calendar URL contains title, start/end, location (Photo Arena, Port Harcourt), details, reference.
4. ICS: valid `VCALENDAR`/`VEVENT`, UTC or TZID, VALARM at 24h and 2h.
5. Duplicate webhook does not duplicate server-side calendar rows if any exist.
6. Fix and retest.

## Expected results

Idempotent. Reminders 24h and 2h. .ics opens in calendar apps.

## Failure conditions

- Event on unpaid hold
- Wrong timezone (not Lagos display / UTC store)
- Duplicate events
- Invalid ICS

## Remediation

Generate from CONFIRMED booking snapshot only. Backend may expose `GET /api/public/bookings/:ref/calendar.ics` if implemented — do not trust client-only times if server has the source of truth.

## Reporting format

Positive + negative cases, ICS snippet (no PII beyond test customer), Google URL query keys present.
