"use client";

import { useState } from "react";
import { DateRangePicker } from "./date-range-picker";
import type { DateRange } from "./date-range-picker";

export default function ReportRange() {
  const [range, setRange] = useState<DateRange | null>(null);
  return (
    <DateRangePicker
      label="Report period"
      value={range}
      onChange={setRange}
      weekStartsOn={1}
      maxDate={new Date()}
    />
  );
}
