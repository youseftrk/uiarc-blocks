"use client";

import { useState } from "react";

import { NumberField } from "./number-field";

export default function SeatsField() {
  const [seats, setSeats] = useState(5);
  return (
    <NumberField
      label="Seats"
      value={seats}
      onValueChange={setSeats}
      min={1}
      max={500}
      suffix={(n) => (n === 1 ? " seat" : " seats")}
      scrub
    />
  );
}
