"use client";

import { useState } from "react";

import { Checkbox } from "./checkbox";

export default function TermsCheckbox() {
  const [accepted, setAccepted] = useState(false);
  return (
    <Checkbox
      label="I agree to the terms"
      description="You can export your data at any time."
      checked={accepted}
      onCheckedChange={(next) => setAccepted(next === true)}
    />
  );
}
