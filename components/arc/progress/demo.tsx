"use client";

import { useState } from "react";
import { Progress } from "./progress";

export default function UploadProgress() {
  const [sent, setSent] = useState(64);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}>
      <Progress label="Uploading report.pdf" value={sent} max={100} showValue />
      <button
        type="button"
        onClick={() => setSent((s) => (s >= 100 ? 15 : Math.min(100, s + 20)))}
        style={{ alignSelf: "flex-start", padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
      >
        Advance
      </button>
    </div>
  );
}
