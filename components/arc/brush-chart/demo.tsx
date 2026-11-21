"use client";

import { useState } from "react";
import { BrushChart } from "./brush-chart";

const DAYS = Array.from({ length: 120 }, (_, i) => ({
  date: Date.UTC(2026, 0, 1 + i),
  value: Math.round(1400 + Math.sin(i * 0.18) * 320 + i * 7),
}));

export default function ActiveUsers() {
  const [range, setRange] = useState<[number, number]>([DAYS[DAYS.length - 60].date, DAYS[DAYS.length - 1].date]);
  return (
    <BrushChart
      data={DAYS}
      label="Daily active users"
      unit="users"
      range={range}
      onRangeChange={setRange}
      annotations={[{ date: Date.UTC(2026, 2, 24), label: "v2", description: "Offline mode and shared spaces" }]}
    />
  );
}
