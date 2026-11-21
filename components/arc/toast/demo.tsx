"use client";

import { useState } from "react";

import Toast from "./toast";

export default function SavedToast() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Save</button>
      <Toast open={open} onOpenChange={setOpen} title="Changes saved" description="Synced to all devices." />
    </>
  );
}
