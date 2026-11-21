"use client";

import { useState } from "react";
import { RulerSlider } from "./ruler-slider";

export default function HeightField() {
  const [height, setHeight] = useState(172);
  return (
    <RulerSlider
      label="Height"
      unit="cm"
      min={120}
      max={220}
      value={height}
      onValueChange={setHeight}
    />
  );
}
