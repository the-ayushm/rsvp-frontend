"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { ConfigProvider, theme as antTheme, type ThemeConfig } from "antd";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccent, type Accent } from "./config";
import { readAntTokens } from "./antd";

const AppearanceContext = createContext<{ accent: Accent; setAccent: (value: Accent) => void }>({ accent: DEFAULT_ACCENT, setAccent: () => {} });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [accent, updateAccent] = useState<Accent>(DEFAULT_ACCENT);
  const [tokens, setTokens] = useState<ThemeConfig["token"]>();
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const restore = () => {
      let value: unknown = document.documentElement.dataset.accent;
      try { value = localStorage.getItem(ACCENT_STORAGE_KEY) || value; } catch { /* Storage may be unavailable. */ }
      const next = isAccent(value) ? value : DEFAULT_ACCENT;
      updateAccent(next);
      document.documentElement.dataset.accent = next;
    };
    restore();
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, []);
  useEffect(() => {
    const refresh = () => setTokens(readAntTokens());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-accent", "style"] });
    return () => observer.disconnect();
  }, [accent, resolvedTheme]);
  const setAccent = (value: Accent) => {
    if (!isAccent(value)) return;
    document.documentElement.dataset.accent = value;
    updateAccent(value);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, value); } catch { /* Use the in-memory preference. */ }
  };
  return <AppearanceContext.Provider value={{ accent, setAccent }}>
    <ConfigProvider theme={{ algorithm: resolvedTheme === "dark" ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm, token: tokens }}>
      {children}
    </ConfigProvider>
  </AppearanceContext.Provider>;
}
export function useAppearance() { return useContext(AppearanceContext); }
