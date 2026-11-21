"use client";

import { useState } from "react";

import { ElasticSlider } from "./elastic-slider";
import { Volume1, Volume2 } from "lucide-react";

export default function VolumeControl() {
  const [volume, setVolume] = useState(60);
  return (
    <ElasticSlider
      label="Volume"
      value={volume}
      onValueChange={setVolume}
      marks={[0, { value: 50, label: "50%" }, 100]}
      format={value => `${value}%`}
      startIcon={<Volume1 size={16} />}
      endIcon={<Volume2 size={16} />}
    />
  );
}
