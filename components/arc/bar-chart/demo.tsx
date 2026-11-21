"use client";

import { BarChart } from "./bar-chart";

const week = [
  { key: "2026-09-14", label: "Mon, Sep 14", axisLabel: "M", value: 32 },
  { key: "2026-09-15", label: "Tue, Sep 15", axisLabel: "T", value: 48 },
  { key: "2026-09-16", label: "Wed, Sep 16", axisLabel: "W", value: 27 },
];

export default function ActiveMinutes() {
  return <BarChart data={week} label="Active minutes" period="Sep 14–16, 2026" unit="min" />;
}
