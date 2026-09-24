/**
 * Photo Arena design tokens.
 * Hex values live here once. Components consume semantic CSS variables / Tailwind aliases.
 *
 * Palette from the studio brand board (Desert Torchwood):
 * amber #EBBC71, sage #BCBDA6, olive #BBA350, brown #573418, ink #201F1F.
 */

export const palette = {
  amber: "#EBBC71",
  sage: "#BCBDA6",
  olive: "#BBA350",
  brown: "#573418",
  ink: "#201F1F",
  white: "#FFFFFF",
} as const;

export const colors = {
  palette,
  background: {
    base: "color-mix(in srgb, #BCBDA6 5%, white)",
    surface: "color-mix(in srgb, #BCBDA6 9%, white)",
    elevated: "color-mix(in srgb, #BCBDA6 14%, white)",
    dark: palette.ink,
    darkDeep: palette.ink,
    overlay: "rgba(32, 31, 31, 0.72)",
  },
  text: {
    primary: palette.ink,
    secondary: palette.brown,
    muted: "color-mix(in srgb, #573418 72%, #BCBDA6)",
    inverse: palette.sage,
    inverseMuted: "color-mix(in srgb, #BCBDA6 70%, #201F1F)",
    onAccent: palette.ink,
    accent: palette.amber,
  },
  border: {
    subtle: "color-mix(in srgb, #573418 18%, #BCBDA6)",
    default: "color-mix(in srgb, #573418 28%, #BCBDA6)",
    strong: palette.brown,
    onDark: "rgba(188, 189, 166, 0.22)",
    focus: palette.amber,
  },
  action: {
    primary: palette.amber,
    primaryHover: palette.olive,
    champagne: palette.amber,
  },
  status: {
    success: "#6FA58A",
    warning: palette.olive,
    error: "#D97878",
  },
} as const;

export const typography = {
  fontFamily: {
    heading: '"EB Garamond", Georgia, serif',
    subtitle: '"Overpass Mono", ui-monospace, monospace',
    body: '"Libre Baskerville", Georgia, serif',
    button: '"Overpass Mono", ui-monospace, monospace',
    display: '"EB Garamond", Georgia, serif',
    hero: '"EB Garamond", Georgia, serif',
  },
  fontWeight: {
    heading: 500,
    subtitle: 400,
    paragraph: 400,
    button: 500,
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
  "--color-sage": palette.sage,
  "--color-brown": palette.brown,
  "--color-olive": palette.olive,
  "--color-ink": palette.ink,
  "--color-border": colors.border.default,
  "--color-border-subtle": colors.border.subtle,
  "--color-border-strong": colors.border.strong,
  "--color-border-on-dark": colors.border.onDark,
  "--color-success": colors.status.success,
  "--color-warning": colors.status.warning,
  "--color-error": colors.status.error,
} as const;
