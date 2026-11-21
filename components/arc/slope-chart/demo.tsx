"use client";

import { SlopeChart } from "./slope-chart";

const channels = [
  { key: "email", label: "Email", start: 3.1, end: 4.6 },
  { key: "search", label: "Organic search", start: 3.4, end: 3.6 },
  { key: "social", label: "Paid social", start: 1.9, end: 1.3 },
];

export default function Channels() {
  return <SlopeChart data={channels} label="Conversion by channel" startLabel="Q1" endLabel="Q2" highlightKey="email" formatValue={value => `${value.toFixed(1)}%`} />;
}
