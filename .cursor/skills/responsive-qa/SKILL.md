---
name: responsive-qa
description: Tests Photo Arena public and admin layouts at 320–1920px for overflow, touch targets, navigation, booking, and tables. Use for /responsive-qa, Milestone 14, or after CSS/layout changes.
---

# Responsive QA

Use cursor-ide-browser. A single desktop screenshot is not verification.

## When to use

- After visual/layout changes, Milestone 14, `/responsive-qa`

## Prerequisites

- Frontend `http://localhost:5173`, backend API healthy
- Browser MCP available

## Workflow

1. Lock browser tab; set viewport widths: 320, 375, 390, 414, 768, 1024, 1280, 1440, 1920.
2. Exercise: nav, hero, gallery, portfolio, services, book, forms, confirmation, admin dashboard, tables, calendars, modals, uploads, buttons, cards, typography.
3. Hunt horizontal overflow (`document.documentElement.scrollWidth > innerWidth`).
4. Fix CSS/components; re-check the failing width and a neighboring width.
5. Record in IMPLEMENTATION-STATUS.

## Commands

Dev server already running. In browser, evaluate:

```js
document.documentElement.scrollWidth > window.innerWidth
```

## Expected results

No accidental horizontal scroll. Touch targets ≥ 44px on primary controls. Admin tables scroll internally, not the page. Booking steps usable on 320px.

## Failure conditions

- Page-level horizontal scroll
- Unreadable type or overlapping CTAs
- Modals off-screen on mobile
- Sticky nav covering content / unclosable menu

## Remediation

Fix tokens/layout in the failing component. Do not add random `overflow-x: hidden` on body to hide bugs.

## Reporting format

Per breakpoint: routes checked, overflow Y/N, issues, fixes, retest.
