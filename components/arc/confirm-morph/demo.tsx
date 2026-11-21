"use client";

import { Trash2 } from "lucide-react";
import { ConfirmMorph } from "./confirm-morph";

export default function DeleteSelection() {
  return (
    <ConfirmMorph
      label="Delete files"
      icon={<Trash2 size={16} strokeWidth={1.75} />}
      prompt="Delete 3 files?"
      confirmMode="hold"
      onConfirm={() => new Promise((r) => setTimeout(r, 600))}
      onUndo={() => {}}
    />
  );
}
