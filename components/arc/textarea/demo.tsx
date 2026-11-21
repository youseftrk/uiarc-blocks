"use client";

import { useState } from "react";

import { Textarea } from "./textarea";

export default function BioField() {
  const [bio, setBio] = useState("");
  return (
    <Textarea
      label="Bio"
      rows={4}
      value={bio}
      onChange={(event) => setBio(event.target.value)}
      description={`${280 - bio.length} characters left`}
    />
  );
}
