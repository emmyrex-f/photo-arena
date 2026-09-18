# Photo Arena — Client Questions

**Updated:** 2026-09-12  
**Purpose:** Track answered vs remaining business questions.  
**Rule:** Do not put secrets in this file.

---

## ANSWERED

| # | Question | Answer |
|---|---|---|
| 1 | Operating days / hours | Open every day. Mon–Sat 8:00 AM–6:00 PM. Sunday 12:00 PM–6:00 PM. |
| 2 | Capacity / rooms | One location. One session at a time. |
| 3 | Slot increment | 30 minutes. |
| 4 | Buffer between bookings | None. |
| 5 | Package duration | Occupies the full package duration. |
| 6 | Same-day online booking | Yes. Minimum 2 hours notice. |
| 7 | Online payment amount | Full payment minus 5% online discount. |
| 8 | Confirmation rule | Slot selection temporarily reserves (15 minutes). Confirmed after successful Bachs payment. |
| 9 | Walk-in reservation status | Starts as PENDING. Slot is blocked. Customer pays at studio. Admin records payment. |
| 10 | Who can create walk-in reservations | OWNER and ADMIN only. |
| 11 | Refunds | Non-refundable. No customer self-cancel. Admin handles exceptions. |
| 12 | Rescheduling | 15% additional charge. |
| 13 | No-show | Separate `NO_SHOW` status. Customer may contact admin or reschedule (15% fee). |
| 14 | Notification recipients | Two email recipients. Same content. Configurable. |
| 15 | Reminders | 24 hours and 2 hours before appointment. Email now. SMS later. |
| 16 | Customer accounts | Guest booking only. |
| 17 | Business name | Photo Arena |
| 18 | Address | 10 Prof Okujagu Street, off Peter Odili Road, Port Harcourt |
| 19 | Domain | photoarenang.com |
| 20 | Hosting | VPS |
| 21 | Contact form | Keep Web3Forms for now |
| 22 | Typography | Playfair Display + Inter |
| 23 | Homepage IA | Hero → Portfolio preview → Services preview → Booking CTA → optional Testimonials → Footer |
| 24 | Gallery placement | Curated preview on Home. Full gallery on Portfolio. |
| 25 | Testimonials | Only real/approved. Do not fabricate. |

---

## BLOCKING FOR SPECIFIC FEATURES

These do **not** block the whole project. Use temporary architecture until answered.

### Booking calendar details — mostly answered

Slot increment, buffer, same-day rule, hold duration, and confirmation rule are answered. Remaining only if the owner later wants holidays / closed dates.

| ID | Question | Blocks | Temporary default |
|---|---|---|---|
| Q-CLOSED | Are there holidays or closed dates? | Holiday calendar | None. Studio assumed open every day. |

### Payments

| ID | Question | Blocks | Temporary default |
|---|---|---|---|
| Q-BACHS-ENV | Is the received Bachs key sandbox (`sk_sandbox_`) or live (`sk_live_`)? Confirm prefix only. | Live charges | Sandbox / mock until prefix is verified |
| Q-BACHS-PRODUCTS | Should each package exist as a Bachs product, or send ad-hoc checkout amounts? | Bachs catalog mapping | Ad-hoc checkout amount from PricingService |
| Q-RECEIPT | What exactly should the customer receive by email after booking? | Email templates | Standard confirmation: date, time, package, amount paid, studio address |
| Q-STAFF-EMAIL | What should the two staff recipients receive? | Staff notification copy | Same confirmation summary plus customer contact details |
| Q-RECIPIENTS | What are the two notification email addresses? | Live notifications | Settings / env placeholders |

### Pricing

| ID | Question | Blocks | Temporary default |
|---|---|---|---|
| Q-PRICES | What is the final approved service / package / price list? | Production pricing | Old-site prices as provisional seed. Admin-editable. Clearly marked provisional. |

### Content

| ID | Question | Blocks | Temporary default |
|---|---|---|---|
| Q-TESTIMONIALS | Are the four old-site quotes approved for publication? | Homepage testimonials | Seeded as unpublished drafts in admin; owner toggles publish |
| Q-TIKTOK | TikTok profile URL (and confirm Instagram / Facebook URLs) | Footer social icons | TikTok icon disabled until supplied; set in Admin → Content → Site settings |
| Q-ANALYTICS | GA4 measurement ID and/or Meta Pixel ID? | Analytics after cookie consent | Empty; nothing loads |
| Q-TOUR-VIDEO | Is `video_mp4.mp4` the studio tour footage? Provide a higher-quality cut if available. | Home studio tour section | Used as-is at `/tour.mp4` |
| Q-HERO-VIDEO | Can the owner provide `LANDSCAPE.mp4`? | Hero video | Static hero image |
| Q-GALLERY-ORIGINALS | Will high-resolution originals replace extracted images? | Image quality | Extracted old-site images |
| Q-MAP | Google Maps embed, OpenStreetMap, or static map? | Contact map | OpenStreetMap embed (no API key) |

---

## IMPORTANT BEFORE LAUNCH (not blocking foundation)

26. Confirm official phone `09059813823` and email `photoarenang@gmail.com`.
27. Confirm Instagram / Facebook / WhatsApp links.
28. CAC registration number if required for payment verification.
29. Late-arrival policy.
30. Image delivery policy (FAQ currently says 24–72 hours; passport same day).
31. Photo usage / promo consent.
32. Who approves final website copy.
33. Backup frequency and who has access.

---

## NON-BLOCKING

- Customer self-service booking link later
- Admin CSV export
- Promo codes
- Seasonal packages
- Multiple locations later (`StudioResource` already prepared)
- SMS provider selection
