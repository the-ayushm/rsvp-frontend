"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAppearance } from "@/theme/AppearanceProvider";

/** Canvas charts require resolved values; DOM and SVG styling can use var(). */
export function useChartPalette() {
  const { accent } = useAppearance();
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => {
      const style = getComputedStyle(document.documentElement);
      setPalette([1, 2, 3, 4, 5].map(index => style.getPropertyValue(`--chart-${index}`).trim()));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-accent", "style"] });
    return () => observer.disconnect();
  }, [accent, resolvedTheme]);
  return palette;
}
