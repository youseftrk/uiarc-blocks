"use client";

import { PasswordField } from "./password-field";

export default function SignInPassword() {
  return (
    <PasswordField
      label="Password"
      name="password"
      autoComplete="current-password"
      required
    />
  );
}
