"use client";

import { useState } from "react";
import { ScrubInput } from "./scrub-input";

export default function LayerInspector() {
  const [width, setWidth] = useState(240);
  const [opacity, setOpacity] = useState(100);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <ScrubInput label="W" value={width} onValueChange={setWidth} min={0} units={["px", "%"]} resetValue={240} />
      <ScrubInput label="Opacity" value={opacity} onValueChange={setOpacity} min={0} max={100} unit="%" />
    </div>
  );
}
