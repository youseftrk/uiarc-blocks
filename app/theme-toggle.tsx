"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("theme", theme);
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => null);
  const dark = theme === "dark";
  return (
    <button type="button" className={className} onClick={() => applyTheme(dark ? "light" : "dark")} aria-pressed={dark} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} disabled={theme === null}>
      {dark ? <Sun size={15} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={15} strokeWidth={1.75} aria-hidden="true" />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
