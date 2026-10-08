"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { t } from "@/lib/i18n";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyThemeClass(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(t);
  root.style.colorScheme = t;
  // Persist in cookie for SSR layout matching
  document.cookie = `kz-theme=${t}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // 1. Read stored preference or system preference
    const stored = localStorage.getItem("kz-theme") as Theme | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme: Theme = stored === "light" || stored === "dark" ? stored : systemPrefersDark ? "dark" : "light";

    setThemeState(initialTheme);
    applyThemeClass(initialTheme);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("kz-theme", t);
    applyThemeClass(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("kz-theme", next);
      applyThemeClass(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
      title={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white dark:hover:text-white hover:light:text-black transition-all hover:scale-105 active:scale-95 shadow-xs ${className}`}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-violet-400" />
    </button>
  );
}
