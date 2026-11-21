"use client";

import { useState } from "react";

import { Slider } from "./slider";

export default function PriceFilter() {
  const [range, setRange] = useState<[number, number]>([20, 80]);
  return (
    <Slider
      label="Price"
      value={range}
      onValueChange={setRange}
      step={5}
      format={(v) => `$${v}`}
      thumbLabels={["Minimum price", "Maximum price"]}
    />
  );
}
