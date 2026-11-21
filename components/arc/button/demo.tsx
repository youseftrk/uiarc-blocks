"use client";

import { useState } from "react";
import { Button } from "./button";

export default function SaveBar() {
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1100);
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button variant="primary" loading={saving} onClick={save}>
        Save changes
      </Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="ghost">Reset</Button>
    </div>
  );
}
