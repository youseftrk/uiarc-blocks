"use client";

import { useState } from "react";

import { Select } from "./select";

export default function RegionSelect() {
  const [region, setRegion] = useState("eu");
  return (
    <Select
      label="Region"
      value={region}
      onValueChange={setRegion}
      options={[
        { value: "us", label: "United States" },
        { value: "eu", label: "Europe" },
        { value: "ap", label: "Asia Pacific", disabled: true },
      ]}
    />
  );
}
