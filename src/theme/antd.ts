import type { ThemeConfig } from "antd";

/** Ant Design consumes the resolved CSS source instead of maintaining a second palette. */
export function readAntTokens(): ThemeConfig["token"] {
  const style = getComputedStyle(document.documentElement);
  const value = (name: string) => style.getPropertyValue(name).trim();
  return {
    colorPrimary: value("--primary"), colorPrimaryHover: value("--primary-hover"),
    colorPrimaryBg: value("--accent-subtle"), colorPrimaryText: value("--accent-text"),
    colorBgBase: value("--background"), colorBgContainer: value("--card"), colorBgElevated: value("--popover"),
    colorText: value("--foreground"), colorTextSecondary: value("--muted-foreground"), colorBorder: value("--border"),
    colorSuccess: value("--success"), colorWarning: value("--warning"), colorError: value("--destructive"), colorInfo: value("--info"),
    fontFamily: value("--font-body"), borderRadius: Number.parseFloat(value("--radius-control")),
  };
}
