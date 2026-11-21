"use client";

import { useState } from "react";
import { Building2, Sparkles, Zap } from "lucide-react";
import { SocialProofToast, type SocialProofEvent } from "./social-proof-toast";

const DEMO_EVENTS: SocialProofEvent[] = [
  {
    id: "1",
    name: "Sofia",
    action: "started a Pro trial",
    meta: "Madrid",
    time: "2m ago",
    verified: "Verified by Stripe",
  },
  {
    id: "2",
    name: "Linear",
    action: "upgraded to Business",
    meta: "48 seats",
    time: "4m ago",
    logo: <Zap size={16} />,
    verified: "Verified by Stripe",
  },
  {
    id: "3",
    name: "Marcus Chen",
    action: "purchased Arc Pro",
    meta: "San Francisco",
    time: "7m ago",
    verified: true,
  },
  {
    id: "4",
    name: "Raycast",
    action: "renewed Team plan",
    meta: "22 seats",
    time: "11m ago",
    logo: <Sparkles size={16} />,
    verified: "Verified by Stripe",
  },
  {
    id: "5",
    name: "Northwind",
    action: "upgraded to Enterprise",
    meta: "120 seats",
    time: "18m ago",
    logo: <Building2 size={16} />,
    verified: "Verified by Stripe",
  },
];

export default function SocialProofToastDemo() {
  const [pos, setPos] = useState<"bottom-left" | "bottom-right">("bottom-left");

  return (
    <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 10 }}>
      <SocialProofToast events={DEMO_EVENTS} position={pos} />
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {(["bottom-left", "bottom-right"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPos(p)}
            style={{
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: pos === p ? "var(--accent)" : "var(--surface)",
              color: pos === p ? "var(--accent-contrast)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
