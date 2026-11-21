"use client";

import { useState } from "react";
import { Archive, Check, CopyPlus, Link, Pin, Trash2 } from "lucide-react";
import { ButtonGroup } from "./button-group";

export default function DocumentActions() {
  const [copied, setCopied] = useState(false);
  return (
    <ButtonGroup
      label="Document actions"
      items={[
        {
          id: "share",
          label: copied ? "Copied" : "Share",
          reserve: ["Share", "Copied"],
          icon: copied ? <Check /> : <Link />,
          onSelect: async () => {
            await navigator.clipboard?.writeText("https://uiarc.dev/docs/arc").catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          },
        },
        { id: "duplicate", label: "Duplicate", icon: <CopyPlus />, onSelect: () => {} },
        { id: "archive", label: "Archive", icon: <Archive />, onSelect: () => {} },
      ]}
      menu={{
        label: "More actions",
        items: [
          { id: "pin", label: "Pin to sidebar", icon: <Pin />, onSelect: () => {} },
          { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true, onSelect: () => {} },
        ],
      }}
    />
  );
}
