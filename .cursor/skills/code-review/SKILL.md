---
name: code-review
description: Reviews Photo Arena code for bugs, regressions, security, and missing tests using project architecture rules. Use for /code-review, PRs, or after a milestone implementation.
---

# Code Review

Findings first, ordered by severity. Do not rewrite working domain logic. Prefer `/review-bugbot` on the diff after this pass.

## When to use

- After implementing a milestone
- User invokes `/code-review`

## Prerequisites

- Diff or specified files
- Architecture/payment/booking/security rules

## Workflow

1. Identify the change set (`git diff` if a repo).
2. Review correctness, security, authorization, payment/booking invariants.
3. Check tests/verify scripts updated.
4. Check no frontend price math for charging.
5. Output findings; only edit if the user asked for fixes in the same turn.

## Commands

```bash
git status
git diff
cd backend && npm run verify:rules
```

## Expected results

No CRITICAL/HIGH left undocumented. New endpoints have guards + DTO validation.

## Failure conditions

- Trusting client amounts
- Admin API without Jwt+Roles
- Secrets logged
- Duplicate booking/payment modules

## Remediation

If this session is BUILD+FIX, fix CRITICAL/HIGH and retest. Otherwise report only.

## Reporting format

CRITICAL / HIGH / MEDIUM / LOW with file:line, impact, fix sketch.
