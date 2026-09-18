/**
 * Photo Arena design tokens.
 * Hex values live here once. Components consume semantic CSS variables / Tailwind aliases.
 *
 * Palette: charcoal editorial photography brand, champagne accent.
 */

export const palette = {
  background: "#0B0D0F",
  backgroundSecondary: "#111417",
  surface: "#181C20",
  elevated: "#22272C",
  border: "#30363D",
  textMuted: "#9CA3AA",
  textSecondary: "#C5CAD0",
  textPrimary: "#F3F4F6",
  white: "#FFFFFF",
  accent: "#C8B89A",
  accentHover: "#D8C9AD",
  success: "#6FA58A",
  error: "#D97878",
  warning: "#D1A65A",
} as const;

export const colors = {
  palette,
  background: {
    base: palette.background,
    surface: palette.surface,
    elevated: palette.elevated,
    dark: palette.backgroundSecondary,
    darkDeep: palette.background,
    overlay: "rgba(11, 13, 15, 0.72)",
  },
  text: {
    primary: palette.textPrimary,
    secondary: palette.textSecondary,
    muted: palette.textMuted,
    inverse: palette.textPrimary,
    inverseMuted: palette.textMuted,
    onAccent: palette.background,
    accent: palette.accent,
  },
  border: {
    subtle: "rgba(48, 54, 61, 0.7)",
    default: palette.border,
    strong: "#3D444D",
    onDark: "rgba(243, 244, 246, 0.12)",
    focus: palette.accent,
  },
  action: {
    primary: palette.accent,
    primaryHover: palette.accentHover,
    champagne: palette.accent,
  },
  status: {
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
  },
} as const;

export const typography = {
  fontFamily: {
    display: '"Manrope", "Inter", system-ui, sans-serif',
    hero: '"Playfair Display", Georgia, serif',
    body: '"Inter", system-ui, -apple-system, sans-serif',
  },
} as const;

export const layout = {
  maxWidth: "72rem",
  spacing: {
    /** Page/container horizontal padding — 20px mobile, 32px from 640px. */
    gutter: "1.25rem",
    gutterSm: "2rem",
    /** Section vertical padding — 80px mobile, 112px from 768px. */
    section: "5rem",
    sectionMd: "7rem",
    /** Inner page-header vertical padding — 64px / 80px. */
    pageHeader: "4rem",
    pageHeaderMd: "5rem",
    /** Footer block padding. */
    footerY: "2.5rem",
    /** Label → control. */
    label: "0.5rem",
    /** Eyebrow → heading. */
    eyebrow: "0.75rem",
    /** Related lines of copy. */
    stackSm: "1rem",
    /** Heading → body copy. */
    stack: "1.25rem",
    /** CTA / image after copy. */
    stackLg: "2rem",
    /** Section heading block → grid/content. */
    stackXl: "3rem",
    /** Large stacked articles. */
    stack2xl: "3.5rem",
    /** Label/control gap inside a field. */
    control: "0.75rem",
    /** Form field groups. */
    form: "1.25rem",
    /** Compact card / nested panel. */
    cardSm: "1rem",
    /** Default card padding. */
    card: "1.5rem",
    /** Featured / editorial tile padding (2rem, 2.5rem from 768px). */
    cardLg: "2rem",
    cardLgMd: "2.5rem",
    /** Compact image-grid gap. */
    gridTight: "0.5rem",
    /** Standard two-column / card grid. */
    grid: "1.5rem",
    gridLg: "3rem",
    /** Admin page gutter — 16px mobile, 24px from 640px. */
    adminGutter: "1rem",
    adminGutterSm: "1.5rem",
    /** Admin main vertical padding. */
    adminPageY: "1.5rem",
    /** Admin header bar height. */
    adminHeader: "3.5rem",
    /** Admin page stack (header → filters → content). */
    adminStack: "1.25rem",
    /** Admin compact stack (forms, related controls). */
    adminStackSm: "1rem",
    /** Admin card padding. */
    adminCard: "1.5rem",
    adminCardSm: "1rem",
    /** Admin label → control. */
    adminControl: "0.5rem",
    /** Admin action/chip gap. */
    adminGap: "0.75rem",
  },
} as const;

export const cssVariables = {
  "--color-bg": colors.background.base,
  "--color-surface": colors.background.surface,
  "--color-elevated": colors.background.elevated,
  "--color-dark": colors.background.dark,
  "--color-dark-deep": colors.background.darkDeep,
  "--color-overlay": colors.background.overlay,
  "--color-text": colors.text.primary,
  "--color-text-secondary": colors.text.secondary,
  "--color-text-muted": colors.text.muted,
  "--color-text-inverse": colors.text.inverse,
  "--color-text-inverse-muted": colors.text.inverseMuted,
  "--color-on-accent": colors.text.onAccent,
  "--color-accent": colors.action.primary,
  "--color-accent-hover": colors.action.primaryHover,
  "--color-champagne": colors.action.champagne,
  "--color-border": colors.border.default,
  "--color-border-subtle": colors.border.subtle,
  "--color-border-strong": colors.border.strong,
  "--color-border-on-dark": colors.border.onDark,
  "--color-success": colors.status.success,
  "--color-warning": colors.status.warning,
  "--color-error": colors.status.error,
} as const;
