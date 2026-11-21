"use client";

import { Archive } from "lucide-react";
import { Tooltip } from "./tooltip";

export default function ArchiveButton() {
  return (
    <Tooltip content="Archive">
      <button
        type="button"
        aria-label="Archive"
        style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", display: "grid", placeItems: "center" }}
      >
        <Archive size={16} />
      </button>
    </Tooltip>
  );
}
