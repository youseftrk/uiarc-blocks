"use client";

import { ContextMenu } from "./context-menu";
import { Copy, Trash2 } from "lucide-react";

export default function FileTile() {
  return (
    <ContextMenu
      label="Actions for roadmap.pdf"
      items={[
        { id: "copy", label: "Copy link", icon: <Copy size={15} />, onSelect: () => {} },
        { id: "delete", label: "Delete file", icon: <Trash2 size={15} />, destructive: true, onSelect: () => {} },
      ]}
    >
      <div
        style={{
          padding: "24px 32px",
          borderRadius: 12,
          border: "1px dashed var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 13.5,
          textAlign: "center",
        }}
      >
        Right-click anywhere here (roadmap.pdf)
      </div>
    </ContextMenu>
  );
}
