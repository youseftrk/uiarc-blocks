"use client";

import { useState } from "react";

import SegmentedControl from "./segmented-control";

export default function RangeToggle() {
  const [range, setRange] = useState("week");
  return (
    <SegmentedControl
      label="Range"
      value={range}
      onValueChange={setRange}
      options={[
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ]}
    />
  );
}
