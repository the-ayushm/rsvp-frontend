// Runtime theme — the ONE place the brand color is managed.
// Server components (app/layout.tsx) must import "@/theme/colors" directly.
export { ThemeProvider } from "./ThemeProvider";
export { ThemeColorProvider, useThemeColors, DEFAULT_PRIMARY } from "./ThemeColorProvider";
export {
  BRAND_ROLES,
  GROUP_LABELS,
  MODE_ROLES,
  SEMANTIC_ROLES,
  auditContrast,
  contrastRatio,
  countOverrides,
  isDefaultConfig,
  readRoleColor,
  readRoleColors,
  readableOn,
  type ContrastCheck,
  type RoleGroup,
  type ThemeConfig,
  type ThemeModeName,
  type ThemeRole,
} from "./themeConfig";
export * from "./tokens";
export { useChartTheme, type ChartTheme } from "./useChartTheme";
export {
  applyBrandVars,
  getBrandVars,
  hexToRgb,
  normalizeHex,
  readCssColor,
  rgbToHsl,
  withAlpha,
} from "./colors";
