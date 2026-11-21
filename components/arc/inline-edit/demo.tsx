"use client";

import { useState } from "react";
import { InlineEdit } from "./inline-edit";

export default function ProjectTitle() {
  const [name, setName] = useState("Arc Design System");
  return (
    <InlineEdit
      as="h1"
      label="Project name"
      value={name}
      validate={(next) => (next.trim() ? null : "Name can’t be empty")}
      onSave={async (next) => {
        setName(next);
      }}
    />
  );
}
