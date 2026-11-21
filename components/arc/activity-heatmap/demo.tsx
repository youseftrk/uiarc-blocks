"use client";

import { useState } from "react";
import { ActivityHeatmap } from "./activity-heatmap";

const DAYS = Array.from({ length: 140 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  const iso = d.toISOString().slice(0, 10);
  const count = (i * 7 + (i % 5) * 3) % 9;
  return { date: iso, count };
});

export default function Contributions() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ActivityHeatmap days={DAYS} label="Contributions in 2026" period="2026" selectedDate={selected} onSelectDate={setSelected} />
  );
}
