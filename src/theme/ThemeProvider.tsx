"use client";

import { ThemeProvider as ModeProvider } from "next-themes";
import { ReactNode } from "react";
import { ThemeColorProvider } from "./ThemeColorProvider";

/**
 * The one theme provider for the app:
 *  - light/dark mode (next-themes, persisted as `theme`, applied as `.dark`
 *    on <html>; the pre-paint script in app/layout.tsx reads the same key)
 *  - the brand color (ThemeColorProvider → CSS source variables on <html>)
 *
 * Both only write to <html>; every surface, text and brand token in
 * styles/tokens.css re-derives from that, so switching never re-renders the
 * page tree.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ModeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ThemeColorProvider>{children}</ThemeColorProvider>
    </ModeProvider>
  );
}
