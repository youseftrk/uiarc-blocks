"use client";

import { useState } from "react";
import { SlideToConfirm } from "./slide-to-confirm";

export default function SlideToConfirmDemo() {
  const [outcome, setOutcome] = useState<"succeed" | "fail">("succeed");
  const [instanceKey, setInstanceKey] = useState(0);

  return (
    <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-resting)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              Emily Parker
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Concert tickets
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            $240.00
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "12px 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>From</span>
            <span style={{ fontWeight: 500, color: "var(--text)" }}>Everyday debit ··4821</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Arrives</span>
            <span style={{ fontWeight: 500, color: "var(--text)" }}>Instantly</span>
          </div>
        </div>

        <SlideToConfirm
          key={instanceKey}
          label="Slide to send $240"
          pendingLabel="Sending"
          confirmedLabel="Sent"
          errorLabel="Not sent, slide to retry"
          onConfirm={async () => {
            await new Promise((r) => setTimeout(r, 900));
            if (outcome === "fail") {
              throw new Error("Declined");
            }
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setOutcome("succeed")}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: outcome === "succeed" ? "var(--accent)" : "var(--surface)",
            color: outcome === "succeed" ? "var(--accent-contrast)" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Succeed
        </button>
        <button
          type="button"
          onClick={() => setOutcome("fail")}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: outcome === "fail" ? "var(--accent)" : "var(--surface)",
            color: outcome === "fail" ? "var(--accent-contrast)" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Fail
        </button>
        <button
          type="button"
          onClick={() => setInstanceKey((k) => k + 1)}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
