/** Elevation — styles/tokens.css (dark mode swaps in deeper shadows). */
export const shadows = {
  xs: "var(--elevation-xs)",
  sm: "var(--elevation-sm)",
  md: "var(--elevation-md)",
  lg: "var(--elevation-lg)",
  xl: "var(--elevation-xl)",
} as const;

export const zIndex = {
  sticky: "var(--z-sticky)",
  header: "var(--z-header)",
  dropdown: "var(--z-dropdown)",
  overlay: "var(--z-overlay)",
  modal: "var(--z-modal)",
  popover: "var(--z-popover)",
  toast: "var(--z-toast)",
  tooltip: "var(--z-tooltip)",
} as const;
