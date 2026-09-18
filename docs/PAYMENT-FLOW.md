# Photo Arena — Payment Flow

**Updated:** 2026-09-14  
**Status:** Confirmed rules + provider abstraction + Bachs sandbox contract verified

---

## 1. Confirmed payment rules

| Rule | Value |
|---|---|
| Online amount | Full package price minus 5% |
| Discount authority | Backend `PricingService` only |
| Online confirmation | After successful Bachs payment |
| Slot hold | 15 minutes from slot selection |
| Walk-in / admin reservation | No online payment required |
| Walk-in initial booking status | `PENDING` |
| Studio payment | Admin records payment received |
| Refunds | Not offered. No refund feature. Admin handles exceptions offline. |
| Reschedule fee | 15% of original package price (future implementation) |

Not every booking requires online payment.

---

## 2. Two payment flows

### Flow A — Online customer

```text
1. Customer selects package and slot
2. Backend creates TEMPORARY_HOLD (15 minutes)
3. Backend calculates:
     base = package.priceKobo (from database)
     onlinePrice = base - 5%
4. Backend creates Payment (PENDING) with onlinePrice
5. Backend creates Bachs checkout session (or Mock in development)
6. Customer pays on Bachs
7. Bachs webhook is the source of truth
8. On success:
     Payment → SUCCESS
     Booking → CONFIRMED
     Notifications sent
9. On failure / expiry:
     Payment → FAILED (or hold expires)
     Booking hold released
```

### Flow B — Walk-in / future reservation

```text
1. OWNER or ADMIN creates booking
2. Booking status = PENDING
3. Slot is blocked immediately (same availability engine)
4. Customer pays at the studio (cash / transfer / other)
5. Admin marks payment received
6. Backend creates/updates Payment SUCCESS
7. Booking → CONFIRMED
```

---

## 3. Pricing

```text
online_final = floor(base_price_kobo * 0.95)
studio_final = base_price_kobo
reschedule_fee = floor(original_package_price_kobo * 0.15)
```

- Prices come from the database, not the frontend.
- Seed prices from the old site are **provisional**.
- Admin can update services/packages later.
- Do not invent new prices.

---

## 4. Payment model

```text
PaymentStatus: PENDING | PROCESSING | SUCCESS | FAILED
PaymentMethod: ONLINE_BACHS | STUDIO
```

`Booking` and `Payment` are separate. A booking can exist without a successful payment.

Statuses that block availability:

- `TEMPORARY_HOLD`
- `PENDING`
- `CONFIRMED`

---

## 5. Bachs integration

Official docs: https://docs.bachs.io/introduction

| Environment | Key prefix | Base URL |
|---|---|---|
| Sandbox | `sk_sandbox_...` | `https://sandbox-api.bachs.io` |
| Live | `sk_live_...` | `https://api.bachs.io` |

**Safety rules**

- Never store the secret key in frontend code or documentation.
- Detect environment from the key prefix only.
- Build and test against sandbox until live status is verified.
- Do not charge real cards until `sk_live_` is confirmed and the owner approves going live.
- Treat webhooks (e.g. `collection.succeeded`) as the source of truth, not the browser redirect.
- Bachs money format is a decimal string at currency precision (example `"60000.00"`) plus ISO currency. Do not send kobo to Bachs.
- Internal storage remains integer kobo. The Bachs adapter converts at the API boundary.
- Sandbox and live webhook destinations are separate — configure both when going live.

### Hosted checkout

```text
POST /v1/checkout-sessions
Authorization: Bearer <secret>
Idempotency-Key: <booking reference>

Body (ad-hoc amount — no Bachs product catalog required):
{
  "pricing": { "amount": "57000.00", "currency": "NGN" },
  "billing_currency": "NGN",
  "customer": { "email", "name", "phone_number?" },
  "success_url": "<confirmation page with bookingId + reference>",
  "cancel_url": "<book page>",
  "reference": "PA-…",
  "metadata": { "reference": "PA-…" },
  "expires_in_minutes": 15
}
```

Response (`201`) stores `checkout_url` (redirect) and `checkout_id` (`chk_…`) on `Payment.providerSessionId`.
`success_url` is the primary field (`return_url` is a deprecated alias). Bachs appends `?checkout_id=<id>` to it.
`reference` is unique per Bachs account — a second session for the same reference returns `409`; the API maps
that to `409 Conflict` for the customer. Upstream `4xx/5xx` map to `502 Bad Gateway` with a safe message
(provider body is logged server-side only; never the key).

Contract verified 2026-09-14 against docs.bachs.io (checkout-sessions guide, create/get reference, webhook
overview, `collection.succeeded` / `collection.failed` / `checkout.completed` event pages).

Customer journey on Photo Arena (not a shopping cart):

```text
/book → package → date → time → details → hold (15 min) → Bachs hosted checkout → /book/confirmation
```

### Webhook endpoint

```text
POST /api/payments/webhook/bachs          (NestJS :3001 — not the Vite dev server)
```

Envelope: `{ id: "evt_…", type, created_at, organization_id, data }`. Parse leniently — Bachs may add fields.

| Event (official) | `data` fields read | Photo Arena action |
|---|---|---|
| `collection.succeeded` | `charge_id`, `checkout_id`, `reference`, `metadata`, `amount`, `currency` | amount/currency must equal frozen `Payment` → Payment SUCCESS, Booking CONFIRMED (or `PAID_UNPLACED` if the slot was taken), notify |
| `checkout.completed` | `checkout_id`, `reference`, `payment_status`, `amount`, `currency`, `charge.id` | Treated as success **only when `payment_status === "paid"`**; `no_payment_required` never confirms |
| `collection.failed` | `checkout_id`, `reference` | Payment → FAILED; booking stays an unpaid hold until expiry |
| `collection.underpaid` / `checkout.expired` | — | Acknowledge only; booking remains unpaid/pending |
| `refund.paid` | — | Acknowledge only (refunds are handled offline) |

`collection.abandoned` does not exist in Bachs; it is still accepted as acknowledge-only for the local scripts.

Signing secret → `BACHS_WEBHOOK_SECRET`.

Verification (required before any status change — implemented in `bachs-webhook.ts`, `parse-bachs-webhook.ts`, `payments.service.ts`):

1. Prefer `X-Bachs-Signature-V2` (`t=…,v1=…`, one `v1=` per valid secret); fall back to `X-Bachs-Signature` + `X-Bachs-Timestamp`
2. HMAC-SHA256 of `{timestamp}.{raw_body}` with the destination signing secret (`timingSafeEqual`)
3. Reject if timestamp skew > 300 s → `401`
4. Deduplicate with envelope `id` (`ProcessedWebhookEvent`) → `{ received: true, duplicate: true }`
5. Resolve `Payment` by `data.reference` / `metadata.reference`, else `data.checkout_id` → `Payment.providerSessionId`
6. **Amount integrity:** `data.amount` (decimal string → kobo, no floats) and `data.currency` must equal `Payment.amountKobo` / `NGN`. Mismatch → Payment stays unconfirmed, booking note `AMOUNT_MISMATCH`, studio notified, event recorded, response `{ received: true, ignored: "amount_mismatch" }`. Events without amount/currency (Bachs test tool) are judged on the signed type alone.
7. Confirm inside one transaction with the studio-resource lock and a fresh `slotFits` check (late-payment protection).

`GET /api/payments/verify?reference=` remains a server-side fallback when the customer returns before the webhook
arrives: it calls `GET /v1/checkout-sessions/{checkout_id}` and applies the same amount/currency check.
**The browser redirect is never the payment authority.**

### Confirmation page states (`/book/confirmation`)

Derived from the backend status only:

| Backend | UI |
|---|---|
| booking `CONFIRMED` | You’re booked (+ calendar) |
| payment `SUCCESS`, booking ≠ `CONFIRMED` | Payment received — slot unavailable (studio follows up) |
| payment `FAILED` | Payment failed |
| booking `CANCELLED`, not paid | Booking not completed (hold expired) |
| otherwise | Payment pending — polls `verify` every 2.5 s, up to 12× |

### Local sandbox E2E (no tunnel required)

The webhook must reach **NestJS** (`:3001`), not Vite. Bachs ships a CLI that forwards signed sandbox events over an
outbound connection — no public URL, no ngrok/cloudflared, and each session has its own signing secret:

```bash
pip install bachs-cli                      # https://pypi.org/project/bachs-cli/ · docs.bachs.io/developer-portal/local-testing
bachs login --api-key sk_sandbox_…         # or set BACHS_API_KEY in the shell instead of writing it to disk
bachs listen --forward-to localhost:3001/api/payments/webhook/bachs
#  → "Your webhook signing secret is whsec_…"  → put it in backend/.env BACHS_WEBHOOK_SECRET
```

The key prefix selects the environment (`sk_sandbox_` → sandbox); there is no `--env` flag. CLI-session deliveries are
**not retried**, so keep the API up while paying; `bachs events replay <evt_id>` re-sends a past event (the
`ProcessedWebhookEvent` dedupe makes replays safe — see T2).

`backend/.env` for a sandbox run:

```text
PAYMENTS_MOCK=false
BACHS_API_KEY=sk_sandbox_…        # secret
BACHS_WEBHOOK_SECRET=whsec_…      # secret — the CLI session secret (or the registered destination's)
BACHS_BASE_URL=https://sandbox-api.bachs.io
PUBLIC_SITE_ORIGINS=http://localhost:5173
```

Bachs rejects a loopback `success_url` / `cancel_url`. The adapter still allowlists `http://localhost:5173`
for the checkout request, then **omits** those fields when talking to Bachs (they are optional). After a
sandbox payment the customer is not redirected back to Vite; confirmation is the webhook plus
`GET /payments/verify`. Production sends `https://…` URLs and Bachs redirects normally.

Restart the API (one instance only on :3001), then:

```bash
npm run verify:bachs-e2e          # creates a REAL sandbox checkout, prints the URL, waits for you to pay
```

Alternative when a URL destination is preferred: run an https tunnel to `localhost:3001` (not 5173), set
`PUBLIC_API_URL=https://<tunnel-host>`, register `PUBLIC_API_URL + /api/payments/webhook/bachs` in
Developer Portal → Webhooks with the events above, and use that destination's secret. Never expose the database port.

### Go-live checklist

1. Sandbox key `sk_sandbox_…` + CLI forwarding (or sandbox destination) + secret; `PAYMENTS_MOCK=false`
2. `npm run verify:rules`, `verify:bachs-webhook`, `verify:payment-flow`, `verify:security`, `verify:bachs-e2e` all green
3. Complete one real sandbox payment on the hosted page; confirm `CONFIRMED` + `payment_received` / `booking_confirmed` notifications
4. Owner approval
5. Live key `sk_live_…` + **separate** live webhook destination (https, `PUBLIC_API_URL`) + live secret; `PUBLIC_SITE_ORIGINS` = https site origin
6. Production refuses to boot with `PAYMENTS_MOCK=true` or a missing `BACHS_API_KEY` — there is no silent mock fallback

Local development without Bachs credentials: `PAYMENTS_MOCK=true` (non-production only) and any non-empty
`BACHS_WEBHOOK_SECRET` so the verify scripts can send signed webhooks. Admin → Payments shows connection status,
the event list, and the webhook URL.

---

## 6. Provider abstraction

```typescript
interface PaymentProvider {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyTransaction(input: { reference: string; providerSessionId?: string | null }): Promise<PaymentVerification>;
  parseWebhook(input: WebhookParseInput): Promise<PaymentWebhookEvent>;
}
```

Implementations:

- `MockPaymentProvider` — development and tests. Never claims to be Bachs.
- `BachsPaymentProvider` — real API when credentials and environment are verified.

Webhook handling must be idempotent (payment already SUCCESS + processed event id).

---

## 7. Remaining payment questions

These are not blocking foundation work:

- Exact customer receipt / confirmation copy
- Whether Bachs currently issued a sandbox or live key (confirm prefix; do not paste the key)
- Optional later: map packages to Bachs catalog products instead of ad-hoc `pricing`
