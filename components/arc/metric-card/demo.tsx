"use client";

import { MetricCard } from "./metric-card";

export default function Uptime() {
  return <MetricCard label="Uptime" value={99.9} suffix="%" context="Last 30 days" change="+0.2%" />;
}
