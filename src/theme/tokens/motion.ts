/**
 * Motion — styles/tokens.css. Animate transform/opacity; `prefers-reduced-
 * motion` is honoured globally in styles/base.css.
 */
export const motion = {
  fast: "var(--motion-fast)",
  normal: "var(--motion-normal)",
  slow: "var(--motion-slow)",
  duration: { fast: 120, base: 180, slow: 260 },
  easing: {
    out: "var(--ease-out)",
    inOut: "var(--ease-in-out)",
    emphasized: "var(--ease-emphasized)",
  },
} as const;
