"use client";

import { useState } from "react";
import { Link2, MessageCircle, Play, Redo2, Undo2 } from "lucide-react";
import { FloatingButtonGroup } from "./floating-button-group";

export default function BoardToolbar() {
  const [copied, setCopied] = useState(false);
  const [presenting, setPresenting] = useState(false);
  return (
    <FloatingButtonGroup
      label="Board actions"
      variant="floating"
      items={[
        { id: "undo", label: "Undo", icon: <Undo2 />, iconOnly: true, shortcut: "⌘Z", onSelect: () => {} },
        { id: "redo", label: "Redo", icon: <Redo2 />, iconOnly: true, shortcut: "⇧⌘Z", onSelect: () => {} },
        { type: "separator" },
        { id: "comment", label: "Comment", icon: <MessageCircle />, shortcut: "C" },
        {
          id: "share",
          label: copied ? "Copied" : "Share",
          reserveLabels: ["Share", "Copied"],
          icon: <Link2 />,
          onSelect: () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
        },
        { type: "separator" },
        {
          id: "present",
          label: presenting ? "Stop" : "Present",
          reserveLabels: ["Present", "Stop"],
          icon: <Play />,
          pressed: presenting,
          onSelect: () => setPresenting((p) => !p),
        },
      ]}
    />
  );
}
