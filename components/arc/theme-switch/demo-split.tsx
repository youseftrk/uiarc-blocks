"use client";

import { useState } from "react";
import { ThemeSwitch } from "./theme-switch";
import type { Theme } from "./theme-switch";

export default function ThemeSwitchSplitDemo() {
  const [theme, setTheme] = useState<Theme>("light");
  return (
    <ThemeSwitch
      theme={theme}
      onThemeChange={(next) => {
        setTheme(next);
        document.documentElement.dataset.theme = next;
      }}
    />
  );
}
