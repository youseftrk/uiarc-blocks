"use client";

import { HoldToConfirm } from "./hold-to-confirm";

export default function DeleteProject() {
  return (
    <HoldToConfirm
      label="Hold to delete project"
      confirmedLabel="Deleted"
      duration={1500}
      onConfirm={() => {}}
    />
  );
}
