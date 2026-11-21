"use client";

import { Gauge } from "./gauge";

export default function DiskUsage() {
  return (
    <Gauge
      label="Disk usage"
      value={72}
      detail="360 of 500 GB"
      thresholds={[
        { from: 0, tone: "success", label: "Healthy" },
        { from: 70, tone: "warning", label: "Filling up" },
        { from: 90, tone: "danger", label: "Critical" },
      ]}
    />
  );
}
