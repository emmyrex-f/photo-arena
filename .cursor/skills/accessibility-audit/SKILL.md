---
name: accessibility-audit
description: Audits Photo Arena keyboard, focus, ARIA, forms, lightbox, contrast, and reduced-motion behavior. Use for /accessibility-audit, Milestone 14, or gallery/nav work.
---

# Accessibility Audit

Fix old-site a11y failures in the React app. No emoji icons.

## When to use

- Milestone 14, lightbox/nav/forms, `/accessibility-audit`

## Prerequisites

- Frontend running
- Keyboard-only pass in browser

## Workflow

1. Tab through header, skip link, mobile menu (`aria-expanded`, `aria-controls`, `aria-current`).
2. Forms: labels, `aria-invalid`, `aria-describedby`, error summary.
3. Lightbox: focus trap, Escape, restore focus, accessible names, keyboard next/prev.
4. `prefers-reduced-motion` respected (Framer Motion).
5. Contrast on muted text vs `#0B0D0F` / surfaces.
6. Fix and retest.

## Expected results

Full keyboard path for book + portfolio lightbox. Visible focus. Touch 44px. Screen-reader names on icon buttons.

## Failure conditions

- Focus lost in modal
- Menu not closable with Escape
- Unlabelled inputs
- Color-only selected package state

## Remediation

Prefer Radix primitives already in admin; match on public modals.

## Reporting format

WCAG-oriented list: issue, location, fix, retest PASS/FAIL.
