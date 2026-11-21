"use client";

import { useState } from "react";

import { PasswordStrength } from "./password-strength";

export default function NewPasswordField() {
  const [strong, setStrong] = useState(false);
  return (
    <PasswordStrength
      label="New password"
      name="password"
      autoComplete="new-password"
      onValueChange={(_, strength) => setStrong(strength.level >= 3)}
    />
  );
}
