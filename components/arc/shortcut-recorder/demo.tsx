"use client";

import { useState } from "react";
import { ShortcutRecorder } from "./shortcut-recorder";

export default function SearchShortcut() {
  const [shortcut, setShortcut] = useState<string | null>("mod+k");
  return (
    <ShortcutRecorder
      label="Open search"
      value={shortcut}
      onValueChange={setShortcut}
      resetValue="mod+k"
      bindings={[{ shortcut: "mod+p", label: "Print" }]}
    />
  );
}
