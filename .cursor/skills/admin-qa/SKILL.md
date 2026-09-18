---
name: admin-qa
description: End-to-end QA of the Photo Arena admin CMS/CRM including RBAC, catalog, media, settings, and public-site reflection. Use for /admin-qa, Milestone 7, or admin portal work.
---

# Admin QA

Admin must run the business without source edits. Public site must reflect CMS changes.

## When to use

- Milestone 6–7, `/admin-qa`

## Prerequisites

- Seeded OWNER
- Browser + API
- Staff login link not on public site; `/admin/login` may exist unadvertised

## Workflow

1. Unauthenticated `/admin` → login, no dashboard data.
2. Login OWNER. Walk nav: Dashboard, Bookings, Calendar, Payments, Customers, Enquiries, Services, Content, Packages, Portfolio, Gallery, Testimonials, Messages, Notifications, Settings, Users/Roles.
3. CRUD: service, package, price, discount setting, portfolio, homepage gallery, testimonial, content, users.
4. Confirm public `/`, `/services`, `/portfolio`, `/book` update without reload hacks (refetch/cache).
5. STAFF cannot hit OWNER-only APIs (403).
6. Deactivated user cannot login.

Required nav that is missing as its own route must be implemented or clearly grouped (e.g. Packages under Services) — product must still support the operations.

## Expected results

Every required operation works. Audit log for price/settings/users. Discount changes do not rewrite historical `amountKobo`.

## Failure conditions

- Public nav to staff login
- Unauthenticated admin API data
- Hardcoded services/prices on public site
- Deactivate service still bookable

## Remediation

Fix API guards and admin UI. Keep public data from `/api/public/*`.

## Reporting format

Journey checklist with PASS/FAIL and whether public site reflected the change.
