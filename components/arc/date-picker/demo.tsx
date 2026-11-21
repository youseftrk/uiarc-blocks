"use client";

import { useState } from "react";

import { DatePicker } from "./date-picker";

export default function StartDateField() {
  const [start, setStart] = useState<Date>();
  return (
    <DatePicker
      label="Start date"
      value={start}
      onChange={setStart}
      minDate={new Date()}
      showToday
    />
  );
}
