"use client";

import { ActionSwap } from "./action-swap";
import { Send, Check } from "lucide-react";

export default function SendInvite() {
  return (
    <ActionSwap
      states={[
        { id: "idle", label: "Send invite", icon: <Send size={16} /> },
        { id: "sent", label: "Sent", icon: <Check size={16} />, tone: "success", pendingLabel: "Sending", holdFor: 2000 },
      ]}
      onAction={(next) => (next.id === "sent" ? new Promise((r) => setTimeout(r, 700)) : undefined)}
    />
  );
}
