---
name: database-review
description: Reviews Photo Arena Prisma/PostgreSQL schema, migrations, indexes, locks, payment uniqueness, and booking overlap protection. Use for /database-review, Milestone 13, or before schema changes.
---

# Database Review

Prisma schema is not the whole domain. Rules live in NestJS services. Schema must still prevent corruption.

## When to use

- Before/after Prisma schema or SQL constraint changes
- Milestone 13
- User invokes `/database-review`

## Prerequisites

- Access to `backend/prisma/schema.prisma` and `backend/prisma/sql/`
- Optional: `npx prisma migrate status` with DATABASE_URL (do not print URL)

## Workflow

1. Read schema + SQL extras (`user-token-version.sql` and any exclusion/lock SQL).
2. Trace booking create/hold in `bookings.service.ts` + `resource-lock.ts` for transaction + lock.
3. Check Payment.reference unique, ProcessedWebhookEvent.id unique.
4. Identify cascade/orphan risks (Customer, Booking, Payment, GalleryImage).
5. Confirm historical amounts are stored (amountKobo, not recalculated from current discount).
6. Report corruption paths; fix CRITICAL/HIGH with coordinated migration (parent agent owns schema).

## Commands

```bash
cd backend
npx prisma validate
npx prisma migrate status
```

Inspect indexes: `Booking (resourceId, startTime)`, payments, webhooks.

## Inspect

Prisma schema, migrations, indexes, constraints, transactions, locking, relationships, deletion behavior, uniqueness, payment records, booking records, audit records.

## Expected results

- No two active blocking bookings on the same resource/time under concurrency.
- Webhook events and payment references unique.
- FKs present; no silent orphan payments.
- Soft flags (`isActive`) used where public catalog must hide rows.

## Failure conditions

- Overlap possible without DB/transaction guard
- Missing unique on payment reference / webhook id
- Cascade deletes that wipe audit or payments unexpectedly
- Discount stored only globally so history mutates

## Remediation

Coordinate one migration. Add constraints/locks in SQL if Prisma cannot express exclusion constraints. Keep services transactional.

## Reporting format

```markdown
## Database review
Corruption paths:
Constraints missing:
Locks:
Migration needed?:
```
