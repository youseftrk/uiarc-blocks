"use client";

import { CopyButton } from "./copy-button";

export default function ApiKeyRow() {
  const apiKey = "arc_live_94f82c1e0b7a4d2c";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <code style={{ fontSize: 13 }}>{apiKey}</code>
      <CopyButton value={apiKey} label="Copy key" iconOnly />
    </div>
  );
}
