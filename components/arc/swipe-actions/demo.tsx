"use client";

import { SwipeActions, SwipeActionsRow } from "./swipe-actions";
import { Archive, MailOpen } from "lucide-react";

const MESSAGES = [
  { id: "m1", subject: "Design review notes", sender: "Elena Vance" },
  { id: "m2", subject: "Q4 infrastructure invoice", sender: "Stripe" },
  { id: "m3", subject: "Release v2.4 checklist", sender: "Marcus Chen" },
];

export default function Inbox() {
  return (
    <SwipeActions label="Inbox">
      {MESSAGES.map((message) => (
        <SwipeActionsRow
          key={message.id}
          label={message.subject}
          leading={[{ label: "Unread", icon: <MailOpen size={18} />, tone: "accent", keepRow: true, onSelect: () => {} }]}
          trailing={[{ label: "Archive", icon: <Archive size={18} />, tone: "danger", onSelect: () => {} }]}
        >
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{message.subject}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{message.sender}</div>
          </div>
        </SwipeActionsRow>
      ))}
    </SwipeActions>
  );
}
