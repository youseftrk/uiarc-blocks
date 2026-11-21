"use client";

import { useState } from "react";
import { AnimatedCounter } from "./animated-counter";

export default function Raised() {
  const [amount, setAmount] = useState(128450);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <AnimatedCounter label="Raised" value={amount} prefix="$" />
      <button
        type="button"
        onClick={() => setAmount((a) => a + 4250)}
        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
      >
        +$4,250
      </button>
    </div>
  );
}
