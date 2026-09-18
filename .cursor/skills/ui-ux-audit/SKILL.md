---
name: ui-ux-audit
description: Audits Photo Arena public site and booking UX for premium photography-brand hierarchy, design tokens, empty/error/loading states, and package presentation. Use for /ui-ux-audit or visual redesign work.
---

# UI/UX Audit

Premium dark editorial photography brand — not generic SaaS. Palette via CSS variables / Tailwind tokens only. No scattered hex. No emoji as icons (Lucide).

## When to use

- Milestones 1–2, Book Now package UX, `/ui-ux-audit`

## Prerequisites

- `frontend/src/index.css` tokens
- Browser on public pages

## Workflow

1. Check tokens match: background `#0B0D0F`, surface `#181C20`, accent `#C8B89A`, etc. mapped to `--background`, `--accent`, …
2. Walk Home → Portfolio → Services → Book → Contact.
3. Booking: packages visually separated (name, duration, price, online price, includes, selected state).
4. Loading/empty/error/success states present.
5. Staff/admin link absent from public chrome.
6. Fix visual issues; verify in browser (not screenshot-only).

## Expected results

Photography-first, consistent spacing, champagne accent used sparingly, forms usable, packages scannable on mobile.

## Failure conditions

- Green leftover palette
- Raw hex in many components
- Package list undifferentiated
- Admin link in footer
- Dead buttons / missing error text

## Remediation

Update tokens and components. Keep admin shadcn look distinct from public editorial site if needed, but tokens still semantic.

## Reporting format

Page-by-page: hierarchy, contrast, states, booking UX, screenshots only as support.
