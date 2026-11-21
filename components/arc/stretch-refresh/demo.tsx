"use client";

import { useState } from "react";
import { StretchRefresh } from "./stretch-refresh";

interface InboxItem {
  id: string;
  sender: string;
  subject: string;
  time: string;
}

const INITIAL: InboxItem[] = [
  { id: "1", sender: "Elena Park", subject: "Design review notes for Q3", time: "2m" },
  { id: "2", sender: "GitHub", subject: "PR #418 merged into main", time: "14m" },
  { id: "3", sender: "Stripe", subject: "Payout of $4,820.00 succeeded", time: "1h" },
  { id: "4", sender: "Linear", subject: "ARC-204 assigned to you", time: "3h" },
];

export default function StretchRefreshDemo() {
  const [items, setItems] = useState(INITIAL);
  const [counter, setCounter] = useState(5);

  return (
    <StretchRefresh
      title="Inbox"
      items={items}
      getKey={(m) => m.id}
      renderItem={(m) => (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "11px 16px",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              {m.sender}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {m.subject}
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", flex: "none" }}>
            {m.time}
          </span>
        </div>
      )}
      onRefresh={async () => {
        await new Promise((r) => setTimeout(r, 650));
        const id = String(counter);
        setCounter((c) => c + 1);
        setItems((prev) => [
          {
            id,
            sender: "Arc Updates",
            subject: `Fresh activity item #${id}`,
            time: "now",
          },
          ...prev,
        ]);
        return "1 new message";
      }}
    />
  );
}
