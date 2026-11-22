"use client";

import { useSyncExternalStore } from "react";
import { ThemeSwitch } from "./theme-switch";
import type { Theme } from "./theme-switch";

function readDocumentTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeDocumentTheme(listener: () => void) {
  const observer = new MutationObserver(() => listener());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export default function AppearanceToggle() {
  const theme = useSyncExternalStore(
    subscribeDocumentTheme,
    readDocumentTheme,
    () => "light" as Theme
  );
  return (
    <ThemeSwitch
      theme={theme}
      onThemeChange={(next) => {
        document.documentElement.dataset.theme = next;
        window.localStorage.setItem("theme", next);
      }}
    />
  );
}
