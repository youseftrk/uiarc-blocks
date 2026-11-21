"use client";

import { useState } from "react";
import { MoneyInput } from "./money-input";

export default function TipAmount() {
  const [cents, setCents] = useState<number | null>(1500);
  return (
    <MoneyInput
      label="Amount"
      name="amount"
      value={cents}
      onValueChange={setCents}
      currencies={["USD"]}
      min={100}
      max={100_000}
      quickAdd={[5, 10, 20]}
    />
  );
}
