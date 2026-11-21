"use client";

import { useState } from "react";
import { Globe, Lock, Mail, MessageSquare } from "lucide-react";
import { ShareSheet } from "./share-sheet";

const PEOPLE = [
  { id: "ana", name: "Ana Ruiz" },
  { id: "sam", name: "Sam Lee" },
  { id: "maya", name: "Maya Patel" },
  { id: "liam", name: "Liam Chen" },
];

export default function ShareSheetDemo() {
  const [shouldFail, setShouldFail] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        minHeight: 380,
        paddingTop: 12,
      }}
    >
      <ShareSheet
        title="Q3 roadmap"
        link="https://uiarc.dev/d/q3-roadmap"
        align="center"
        people={PEOPLE}
        access={[
          {
            value: "team",
            label: "Team",
            description: "Anyone on the team can view",
            icon: <Lock size={15} />,
          },
          {
            value: "public",
            label: "Anyone with the link",
            description: "Can view and comment",
            icon: <Globe size={15} />,
          },
        ]}
        channels={[
          {
            id: "slack",
            label: "Slack",
            doneLabel: "Posted",
            icon: <MessageSquare size={14} />,
          },
          {
            id: "email",
            label: "Email",
            doneLabel: "Sent",
            icon: <Mail size={14} />,
          },
        ]}
        onSend={async () => {
          await new Promise((r) => setTimeout(r, 650));
          if (shouldFail) {
            throw new Error("Could not reach workspace. Try again.");
          }
        }}
        onChannel={async () => {
          await new Promise((r) => setTimeout(r, 600));
          if (shouldFail) throw new Error("Failed");
        }}
      />

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setShouldFail(false)}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: !shouldFail ? "var(--accent)" : "var(--surface)",
            color: !shouldFail ? "var(--accent-contrast)" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Send works
        </button>
        <button
          type="button"
          onClick={() => setShouldFail(true)}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: shouldFail ? "var(--accent)" : "var(--surface)",
            color: shouldFail ? "var(--accent-contrast)" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Send fails
        </button>
      </div>
    </div>
  );
}
