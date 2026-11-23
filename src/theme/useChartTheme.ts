"use client";

import { useEffect, useState } from "react";
import { readCssColor } from "./colors";

/**
 * Resolved theme colors for canvas-based charts (Chart.js cannot read CSS
 * variables). Values come from the centralized tokens in styles/tokens.css and are
 * re-read only when <html> changes class (light/dark) or style (brand color).
 */
export interface ChartTheme {
  isDark: boolean;
  primary: string;
  series: string[];
  success: string;
  error: string;
  warning: string;
  info: string;
  text: string;
  textMuted: string;
  grid: string;
  surface: string;
  border: string;
}

const TOKENS = {
  primary: "--color-brand",
  success: "--color-success",
  error: "--color-error",
  warning: "--color-warning",
  info: "--color-info",
  text: "--color-text",
  textMuted: "--color-text-muted",
  grid: "--color-border-subtle",
  surface: "--color-surface",
  border: "--color-border",
} as const;

const SERIES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];

const FALLBACK: ChartTheme = {
  isDark: false,
  primary: "rgba(37, 211, 102, 1)",
  series: ["rgba(37, 211, 102, 1)"],
  success: "rgba(22, 163, 74, 1)",
  error: "rgba(220, 38, 38, 1)",
  warning: "rgba(217, 119, 6, 1)",
  info: "rgba(37, 99, 235, 1)",
  text: "rgba(22, 25, 29, 1)",
  textMuted: "rgba(115, 122, 130, 1)",
  grid: "rgba(239, 241, 243, 1)",
  surface: "rgba(255, 255, 255, 1)",
  border: "rgba(230, 232, 235, 1)",
};

function readTheme(): ChartTheme {
  const out = { ...FALLBACK } as ChartTheme;
  for (const [key, cssVar] of Object.entries(TOKENS)) {
    (out as unknown as Record<string, string>)[key] = readCssColor(cssVar);
  }
  out.series = SERIES.map((v) => readCssColor(v));
  out.isDark = document.documentElement.classList.contains("dark");
  return out;
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTheme(readTheme()));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return theme;
}
