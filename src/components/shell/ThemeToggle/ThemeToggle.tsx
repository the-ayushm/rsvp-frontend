"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import IconButton from "@/components/ui/IconButton";

/** Light/dark switch. next-themes owns the `.dark` class on <html>. */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  return (
    <IconButton
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    />
  );
}

export { ThemeToggle };
