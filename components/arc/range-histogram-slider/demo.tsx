"use client";

import { useState } from "react";
import { RangeHistogramSlider } from "./range-histogram-slider";

const PRICES = [
  45, 55, 60, 75, 85, 90, 95, 110, 120, 125, 130, 140, 150, 155, 160,
  170, 175, 180, 190, 200, 210, 220, 235, 250, 265, 280, 310, 340, 390, 440,
];

export default function PriceFilter() {
  const [range, setRange] = useState<[number, number]>([80, 320]);
  return (
    <RangeHistogramSlider
      label="Price per night"
      data={PRICES}
      min={0}
      max={500}
      step={5}
      bins={25}
      value={range}
      onValueChange={setRange}
      format={(value) => `$${value}`}
    />
  );
}
