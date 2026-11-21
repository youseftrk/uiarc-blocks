"use client";

import { useState } from "react";
import { TextShimmer } from "./text-shimmer";

export default function AssistantStatus() {
  const [busy, setBusy] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <TextShimmer active={busy}>
        {busy ? "Generating summary" : "Summary ready"}
      </TextShimmer>
      <button
        type="button"
        onClick={() => setBusy((b) => !b)}
        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
      >
        Toggle shimmer
      </button>
    </div>
  );
}
