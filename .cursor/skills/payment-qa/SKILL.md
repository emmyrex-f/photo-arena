---
name: payment-qa
description: Runs Photo Arena Bachs/mock payment QA including checkout, webhooks, idempotency, amount/currency mismatch, and reconciliation. Use for /payment-qa, payment bugs, or Milestone 5.
---

# Payment QA

Authority is Bachs webhook + server-side verify. Never treat the frontend success URL as proof of payment. Domain law: `.cursor/rules/payment-security.mdc`.

## When to use

- After changes in `backend/src/payments/` or checkout in bookings
- Before Milestone 5 VERIFIED
- User invokes `/payment-qa`

## Prerequisites

- Backend running; `PAYMENTS_MOCK=true` only when `NODE_ENV` is not `production`
- For sandbox Bachs: `BACHS_API_KEY` + `BACHS_WEBHOOK_SECRET` in `backend/.env` (do not print values)
- `PUBLIC_SITE_ORIGINS` allowlists return URLs

## Workflow

1. Read `docs/PAYMENT-FLOW.md` and `payments.service.ts`.
2. Run `npm run verify:payment-flow` and `npm run verify:bachs-webhook`.
3. Run listed scenarios against the API (mock in dev; sandbox e2e only if key present).
4. Confirm frontend confirmation page still calls verify and does not flip status itself.
5. Fix failures in the payment service; retest; document.

## Commands

From `backend/`:

```bash
npm run verify:payment-flow
npm run verify:bachs-webhook
npm run verify:bachs-e2e
```

`verify:bachs-e2e` creates a real sandbox checkout when `BACHS_API_KEY` is set. Skip if no key; record BLOCKED in HUMAN-INPUT-REQUIRED.

## Test scenarios

1. checkout creation
2. successful payment
3. failed payment
4. cancelled payment
5. expired checkout
6. duplicate webhook
7. invalid signature
8. replay attempt
9. mismatched payment amount
10. mismatched currency
11. mismatched booking reference
12. payment after hold expiration
13. payment for cancelled booking
14. payment success where slot has already been taken
15. retry/reconciliation
16. client-supplied amount ignored (price=1 / discount=100)

Details: [references/scenarios.md](references/scenarios.md)

## Expected results

- Amount/currency taken from frozen payment/booking rows, not request body.
- Duplicate webhook: one SUCCESS, one calendar path, 2xx without double side effects.
- Invalid signature: 4xx, no status change.
- Expired hold / cancelled booking / stolen slot: payment not confirmed; admin notified if inconsistent.
- Production boot fails if mock is on or Bachs key missing.

## Failure conditions

- Frontend query `status=success` confirms booking.
- Mock complete public in production or when Bachs configured.
- Double-confirm / double calendar event.
- Amount 1 kobo from client is charged.

## Remediation

Keep provider abstraction. Fix verify + webhook handlers. Add reconciliation notes for admin. Never log secrets.

## Reporting format

```markdown
## Payment QA
Provider mode: mock | sandbox | blocked
| Scenario | Result | Evidence |
Inconsistencies found:
Reconciliation behavior:
```
