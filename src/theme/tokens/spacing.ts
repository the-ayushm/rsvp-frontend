/** 4px spacing grid and layout constants — references to styles/tokens.css. */
export const spacing = {
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  8: "var(--space-8)",
  10: "var(--space-10)",
  12: "var(--space-12)",
} as const;

export const layout = {
  sidebarWidth: "var(--layout-sidebar-width)",
  sidebarCollapsed: "var(--layout-sidebar-collapsed)",
  topbarHeight: "var(--layout-topbar-height)",
  contentMax: "var(--layout-content-max)",
} as const;
