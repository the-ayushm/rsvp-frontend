/** Type scale — `font` shorthands defined in styles/tokens.css. */
export const typography = {
  family: { sans: "var(--font-family-sans)", mono: "var(--font-family-mono)" },
  pageTitle: "var(--type-page-title)",
  sectionTitle: "var(--type-section-title)",
  cardTitle: "var(--type-card-title)",
  body: "var(--type-body)",
  secondary: "var(--type-secondary)",
  label: "var(--type-label)",
  meta: "var(--type-meta)",
  tracking: { tight: "var(--tracking-tight)", eyebrow: "var(--tracking-eyebrow)" },
} as const;
