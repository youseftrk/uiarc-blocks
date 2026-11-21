"use client";

import { useState } from "react";

import { Input } from "./input";

export default function EmailField() {
  const [email, setEmail] = useState("");
  return (
    <Input
      label="Email"
      type="email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
      description="We only use this for receipts."
      error={email && !email.includes("@") ? "Enter a valid email" : undefined}
    />
  );
}
