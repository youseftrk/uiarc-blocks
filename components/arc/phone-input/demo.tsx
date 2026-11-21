"use client";

import { useState } from "react";
import { PhoneInput } from "./phone-input";

export default function ContactPhone() {
  const [phone, setPhone] = useState("");
  const [valid, setValid] = useState(false);
  return (
    <PhoneInput
      label="Phone number"
      name="phone"
      value={phone}
      onValueChange={(value, details) => { setPhone(value); setValid(details.valid); }}
      defaultCountry="GB"
      preferredCountries={["GB", "IE", "US"]}
      description={valid ? undefined : "We only text about your order"}
    />
  );
}
