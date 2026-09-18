---
name: production-readiness
description: Final Photo Arena production gate combining security, payments, booking, deployment, and acceptance journeys. Use for /production-readiness, Milestone 16, or final audit.
---

# Production Readiness

Do not declare complete because code exists. Implemented ≠ Verified.

## When to use

- End of rebuild, `/production-readiness`

## Prerequisites

- All project skills available
- Local stack running
- Docs folder writable

## Workflow

1. Run `/booking-qa` `/payment-qa` `/security-audit` `/database-review` `/admin-qa` `/calendar-qa` `/media-audit` `/responsive-qa` `/accessibility-audit` `/deployment-check` (or equivalent commands).
2. Customer journey: Home → Portfolio → Services → Book → pay → confirm → calendar.
3. Admin journey: login → booking → payment → customer → catalog → media → settings → users.
4. Security acceptance list from product brief (unauth admin, price tamp, webhook forge, etc.).
5. Write `docs/FINAL-PRODUCTION-AUDIT.md`, update `IMPLEMENTATION-STATUS.md`, `KNOWN-ISSUES.md`, `HUMAN-INPUT-REQUIRED.md`.
6. Fix remaining CRITICAL/HIGH before claiming ready.

## Expected results

Core booking+payment+admin trustworthy. Remaining items are credentials/DNS/client copy, not broken engines.

## Failure conditions

- Known broken core path
- Mock payments in production config
- Unauthenticated admin data
- Undocumented HIGH security issue

## Remediation

Fix and re-run the failing skill. Do not ship on “looks good”.

## Reporting format

Follow `docs/FINAL-PRODUCTION-AUDIT.md` sections: per-domain PASS/FAIL, blockers, commands for Emmanuel, manual checks.
