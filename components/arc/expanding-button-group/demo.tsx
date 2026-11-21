"use client";

import { Archive, Clock3, Forward, Reply, Trash2 } from "lucide-react";
import { ExpandingButtonGroup } from "./expanding-button-group";

export default function MessageActions() {
  return (
    <ExpandingButtonGroup
      label="Message actions"
      defaultExpanded="reply"
      items={[
        { id: "reply", label: "Reply", icon: <Reply />, onSelect: () => {} },
        { id: "forward", label: "Forward", icon: <Forward />, onSelect: () => {} },
        { id: "archive", label: "Archive", doneLabel: "Archived", icon: <Archive />, onSelect: () => {} },
        { id: "snooze", label: "Snooze", doneLabel: "Snoozed", icon: <Clock3 />, onSelect: () => {} },
        { id: "delete", label: "Delete", doneLabel: "Deleted", tone: "danger", icon: <Trash2 />, onSelect: () => {} },
      ]}
    />
  );
}
