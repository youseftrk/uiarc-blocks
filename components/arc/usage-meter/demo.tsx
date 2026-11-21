"use client";

import { UsageMeter } from "./usage-meter";

export default function StorageCard() {
  return (
    <UsageMeter
      label="Workspace storage"
      unit="GB"
      limit={50}
      segments={[
        { id: "files", label: "Files", value: 21.4 },
        { id: "media", label: "Media", value: 14.2 },
        { id: "backups", label: "Backups", value: 6.8 },
      ]}
    />
  );
}
