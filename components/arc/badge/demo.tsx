"use client";

import { Check } from "lucide-react";
import { Badge } from "./badge";

export default function DeployStatus() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge tone="success" icon={<Check size={12} />}>Live</Badge>
      <Badge tone="neutral">Draft</Badge>
      <Badge tone="warning">Pending</Badge>
      <Badge tone="danger">Failed</Badge>
    </div>
  );
}
