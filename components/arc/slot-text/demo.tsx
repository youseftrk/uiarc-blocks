"use client";

import { useState } from "react";
import { SlotText } from "./slot-text";

export default function SlotTextDemo() {
  const [revenue, setRevenue] = useState(48290);
  const [live, setLive] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>
        <SlotText
          value={revenue}
          format={(value) => `$${Number(value).toLocaleString("en-US")}`}
          announce
        />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>
        <SlotText value={live ? "Live now" : "Soon"} spins={2} />
      </div>
      <button
        type="button"
        onClick={() => {
          setRevenue((r) => r + 1375);
          setLive((l) => !l);
        }}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12.5,
          cursor: "pointer",
        }}
      >
        Spin values
      </button>
    </div>
  );
}
