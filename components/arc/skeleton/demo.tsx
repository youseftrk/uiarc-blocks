"use client";

import { useState } from "react";
import { Skeleton } from "./skeleton";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
      <Skeleton avatar lines={2} loading={loading}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
            AV
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Ada Lovelace</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Analytical Engine Lead</div>
          </div>
        </div>
      </Skeleton>
      <button
        type="button"
        onClick={() => setLoading((l) => !l)}
        style={{ alignSelf: "flex-start", padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
      >
        {loading ? "Show loaded" : "Show skeleton"}
      </button>
    </div>
  );
}
