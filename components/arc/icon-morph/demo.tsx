"use client";

import { useState } from "react";
import { IconMorph } from "./icon-morph";

export default function MenuToggle() {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <IconMorph name="menu" state={open} size={20} />
    </button>
  );
}
