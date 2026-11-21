"use client";

import { useState } from "react";

import { Combobox } from "./combobox";

const timezones = [
  { value: "utc", label: "UTC" },
  { value: "cet", label: "Central European", keywords: ["zurich", "berlin"] },
  { value: "pst", label: "Pacific", keywords: ["san francisco"] },
];

export default function TimezoneField() {
  const [zone, setZone] = useState("");
  return <Combobox label="Time zone" options={timezones} value={zone} onValueChange={setZone} />;
}
