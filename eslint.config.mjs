import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/*
 * Design-system guardrail: colors come from src/styles/tokens.css only.
 * Shared UI, the app shell and feature modules may not hardcode color
 * literals or raw Tailwind palette classes — use token utilities instead
 * (bg-primary, text-muted-foreground, border-border, text-success…).
 */
const COLOR_LITERAL = "#[0-9a-fA-F]{3,8}\\b|\\brgba?\\(\\s*\\d|\\bhsla?\\(\\s*\\d";
const PALETTE_CLASS =
  "\\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b";
const designSystemGuard = {
  files: [
    "src/app/**/*.{ts,tsx}",
    "src/components/ui/**/*.{ts,tsx}",
    "src/components/shell/**/*.{ts,tsx}",
    "src/components/shared/**/*.{ts,tsx}",
    "src/components/PlanCheckWrapper.tsx",
    "src/components/TeamRouteGuard.tsx",
    "src/features/**/*.{ts,tsx}",
  ],
  // Dead files pending deletion (no importers) are excluded until removed.
  ignores: [
    "src/app/api/**",
    "src/app/user/campaigns/EditCampaignForm.tsx",
    "src/app/user/contacts/countryCodeDropdown.tsx",
    "src/components/shared/{StatCard,StatusBadge,CreditBalanceCard,UserMenu}.tsx",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: `Literal[value=/${COLOR_LITERAL}/]`,
        message: "Hardcoded color. Use a design token (var(--color-…)) or a token utility class.",
      },
      {
        selector: `TemplateElement[value.raw=/${COLOR_LITERAL}/]`,
        message: "Hardcoded color. Use a design token (var(--color-…)) or a token utility class.",
      },
      {
        selector: `Literal[value=/${PALETTE_CLASS}/]`,
        message: "Raw Tailwind palette class. Use token utilities (bg-primary, text-success, bg-surface…).",
      },
      {
        selector: `TemplateElement[value.raw=/${PALETTE_CLASS}/]`,
        message: "Raw Tailwind palette class. Use token utilities (bg-primary, text-success, bg-surface…).",
      },
    ],
  },
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  designSystemGuard,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-user/**",
      ".next-admin/**",
      ".tmp/**",
      ".local/**",
      "audit/**",
      "coverage/**",
      "dist/**",
      "logs/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
