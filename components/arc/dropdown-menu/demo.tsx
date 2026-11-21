"use client";

import { DropdownMenu } from "./dropdown-menu";
import { Pencil, Copy, Trash2 } from "lucide-react";

export default function ProjectActions() {
  return (
    <DropdownMenu
      label="Actions"
      items={[
        { label: "Rename", icon: <Pencil size={15} />, onSelect: () => {} },
        { label: "Duplicate", icon: <Copy size={15} />, onSelect: () => {} },
        { label: "Delete", icon: <Trash2 size={15} />, onSelect: () => {}, destructive: true, separatorBefore: true },
      ]}
    />
  );
}
