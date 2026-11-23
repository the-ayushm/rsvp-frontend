/**
 * Typed references to the color tokens in styles/tokens.css.
 *
 * Values are `var(--…)` references, never literals: tokens.css (light + dark
 * blocks) is the only place colors are defined. Use these in inline styles,
 * SVG attributes and chart configs that accept CSS colors. Canvas-based
 * charts must resolve them first — see `readCssColor` / `useChartTheme`.
 */
const v = <T extends string>(name: T) => `var(--${name})` as const;

export const colors = {
  brand: {
    primary: v("color-primary"),
    primaryHover: v("color-primary-hover"),
    primaryActive: v("color-primary-active"),
    primaryForeground: v("color-primary-foreground"),
    primaryText: v("color-primary-text"),
    primaryLight: v("color-primary-light"),
    primaryLighter: v("color-primary-lighter"),
    primarySoft: v("color-primary-soft"),
    primaryRing: v("color-primary-ring"),
    /** Vivid brand for indicators, progress and charts */
    accent: v("color-brand"),
  },
  surface: {
    background: v("color-background"),
    sidebar: v("color-sidebar"),
    header: v("color-header"),
    /** Neutral large panes (inbox columns) */
    panel: v("color-panel"),
    card: v("color-surface"),
    elevated: v("color-surface-elevated"),
    muted: v("color-surface-muted"),
    hover: v("color-surface-hover"),
    active: v("color-surface-active"),
    input: v("color-input"),
    overlay: v("color-overlay"),
  },
  border: {
    default: v("color-border"),
    subtle: v("color-border-subtle"),
    strong: v("color-border-strong"),
  },
  text: {
    primary: v("color-text"),
    secondary: v("color-text-secondary"),
    muted: v("color-text-muted"),
    disabled: v("color-text-disabled"),
  },
  semantic: {
    success: v("color-success"),
    successBg: v("color-success-bg"),
    successBorder: v("color-success-border"),
    warning: v("color-warning"),
    warningBg: v("color-warning-bg"),
    warningBorder: v("color-warning-border"),
    error: v("color-error"),
    errorBg: v("color-error-bg"),
    errorBorder: v("color-error-border"),
    info: v("color-info"),
    infoBg: v("color-info-bg"),
    infoBorder: v("color-info-border"),
  },
  chart: [v("chart-1"), v("chart-2"), v("chart-3"), v("chart-4"), v("chart-5"), v("chart-6")],
  chat: {
    canvas: v("chat-canvas"),
    outgoing: v("bubble-out-bg"),
    incoming: v("bubble-in-bg"),
    tickRead: v("tick-read"),
  },
} as const;

/** CSS variable names, for `readCssColor("--color-…")`. */
export type ColorToken = `--${string}`;
