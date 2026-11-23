/** Preference identifiers only. Palette values belong to styles/themes.css. */
export const ACCENTS = {
  emerald: { label: "Emerald", color: "var(--palette-emerald)" },
  blue: { label: "Blue", color: "var(--palette-blue)" },
  violet: { label: "Violet", color: "var(--palette-violet)" },
  teal: { label: "Teal", color: "var(--palette-teal)" },
  amber: { label: "Amber", color: "var(--palette-amber)" },
} as const;
export type Accent = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: Accent = "emerald";
export const ACCENT_STORAGE_KEY = "app-accent";
export const THEME_STORAGE_KEY = "theme";
export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ACCENTS, value);
}
