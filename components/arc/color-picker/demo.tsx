"use client";

import { useState } from "react";
import { ColorPicker } from "./color-picker";
import type { ColorSwatch } from "./color-picker";

export default function BrandColor() {
  const [color, setColor] = useState("#2F6BFF");
  const [swatches, setSwatches] = useState<ColorSwatch[]>([
    { id: "ink", color: "#17171A" },
    { id: "sky", color: "#3A8DFF" },
  ]);

  return (
    <ColorPicker
      label="Accent"
      value={color}
      onValueChange={setColor}
      background="#FFFFFF"
      swatches={swatches}
      onSwatchesChange={setSwatches}
    />
  );
}
