"use client";

import { ActionButton } from "./action-button";

export default function PublishButton() {
  return (
    <ActionButton
      label="Publish"
      pendingLabel="Publishing"
      successLabel="Published"
      onAction={() => new Promise((r) => setTimeout(r, 900))}
    />
  );
}
