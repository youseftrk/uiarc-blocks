"use client";

import { useState } from "react";
import { TextMorph } from "./text-morph";

const STATES = ["Publish", "Publishing", "Published"] as const;

export default function PublishButton() {
  const [idx, setIdx] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setIdx((i) => (i + 1) % STATES.length)}
      style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}
    >
      <TextMorph>{STATES[idx]}</TextMorph>
    </button>
  );
}
