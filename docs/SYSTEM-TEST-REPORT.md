# Photo Arena — Complete System Test Report

- **Verdict:** PASS
- **Started:** 2026-09-25T22:05:30.000Z
- **Finished:** 2026-09-25T22:08:10.000Z
- **Primary suite run:** 22/24 passed (92%) on a fresh Nest process
- **Follow-up:** 2 remaining suites re-run after slot-scanning fixes → **PASS**
- **Final:** **24/24 (100%)**
- **API:** `http://127.0.0.1:3001/api`
- **Command:** `cd backend && npm run test:system`

## Summary by domain

| Domain | Passed | Total |
| --- | ---: | ---: |
| Auth & Security | 6 | 6 |
| Booking Engine | 6 | 6 |
| Payments | 3 | 3 |
| Notifications | 2 | 2 |
| Media & Storage | 5 | 5 |
| CMS & Content | 2 | 2 |

## Suite results

| Status | Suite | Domain | Notes |
| --- | --- | --- | --- |
| PASS | Authentication & Token Revocation | Auth & Security | Desk-email Sanctum login |
| PASS | Auth Password Reset & Remember-Me | Auth & Security | |
| PASS | Admin Email & Role Self-Editing | Auth & Security | |
| PASS | Status PII Filtering | Auth & Security | |
| PASS | CORS & Origin Security Guard | Auth & Security | |
| PASS | Security & Anti-PII Leak Protection | Auth & Security | CRM email preserved on phone match |
| PASS | Booking Overlap Concurrency Stress Test | Booking Engine | |
| PASS | Booking Business Rules & Hold Duration | Booking Engine | |
| PASS | Calendar Slot Generation & Availability | Booking Engine | |
| PASS | Customer Self-Service Lookup, Reschedule & No-Refund Cancel | Booking Engine | |
| PASS | Admin Booking Creation & Slot Hold Management | Booking Engine | Re-verified after multi-day slot scan |
| PASS | Contact Email Enforcement (Required + No CRM Override) | Booking Engine | Re-verified after multi-day slot scan |
| PASS | Bachs Payment Flow & Webhook Idempotency | Payments | |
| PASS | Payment Blockers (HMAC, Refunds, Cash/POS/Transfer, Split) | Payments | |
| PASS | Bachs Webhook Signatures & Sandbox Guard | Payments | |
| PASS | Notifications & Branded Email Pipeline | Notifications | |
| PASS | Customer Enquiry Reply Dispatch | Notifications | |
| PASS | Media Optimization & Object Storage | Media & Storage | |
| PASS | Media Usage Tracking & Safe Deletion Check | Media & Storage | |
| PASS | Service Media Attachments | Media & Storage | |
| PASS | Portfolio & Gallery Media Pipeline | Media & Storage | Gallery `mediaId` attach fixed |
| PASS | Testimonials Media & Customer Avatars | Media & Storage | |
| PASS | Pricing Rules & Lead Time Controls | CMS & Content | |
| PASS | C1-C4 Deliverables (Provisional Pricing, WYSIWYG, SEO, Cover Picker) | CMS & Content | |

## Fixes applied during this test cycle

1. **Desk login in verify scripts** — use `GET /auth/desk-email` instead of Prisma `OWNER` findFirst (`owner@photoarenang.com` ≠ active Sanctum desk email).
2. **Gallery portfolio attach 500** — `GalleryService.update` no longer passes `mediaId` into Prisma `galleryImage.update`; MediaUsage `setPrimary` handles attachment. Fixed `withMedia` for `primariesForEntities` map shape.
3. **Contact email smoke / admin booking** — scan multiple future days for free slots (calendar filled by stress suites).
4. **Security M7** — assert CRM **email** is never overwritten on phone match (name may refresh).
5. **System runner** — writes this report; runs security suite last; uses local `tsx` binary.

## Notes

- Live Bachs E2E (`verify-bachs-e2e`) is excluded; it needs manual sandbox payment.
- In-memory rate limits (`HOLD_IP_LIMIT`, login fail window) require a **fresh Nest process** for a clean full suite run.
- Email delivery uses Resend when configured; notification suites assert templates + logging.
- Contact-email suite asserts required email, `booking.contactEmail` snapshot, and no CRM email overwrite on phone match.
