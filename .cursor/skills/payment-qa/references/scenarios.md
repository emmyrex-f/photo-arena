# Payment QA scenario notes

## Checkout

- `POST /api/bookings/:id/checkout` requires hold ownership binding (reference match).
- `returnUrl` / `cancelUrl` must be on `PUBLIC_SITE_ORIGINS`.
- Response checkout URL is provider-hosted; amount is server amount.

## Webhook

- Signature HMAC over raw body; timestamp skew enforced.
- `ProcessedWebhookEvent.id` unique — second delivery is no-op.
- Replay with new id but same checkout: still idempotent on payment row.

## Mismatch

- Provider amount ≠ `Payment.amountKobo` → do not SUCCESS; log/reconcile.
- Currency ≠ NGN → reject.
- Unknown booking/reference → reject; do not create orphan SUCCESS.

## Late / conflict

- Hold expired: do not confirm; release or leave FAILED; slot may be taken.
- Booking CANCELLED: do not resurrect to CONFIRMED without explicit admin policy (default: reject).
- Slot taken by another CONFIRMED booking: do not double-book; flag reconciliation.

## Reconciliation fields

Payment must have: internal id, bookingId, provider, providerSessionId, transactionId (if any), reference, amountKobo, currency, status, timestamps.
