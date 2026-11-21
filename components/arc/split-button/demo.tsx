"use client";

import { SplitButton } from "./split-button";

export default function MergeButton() {
  return (
    <SplitButton
      label="Merge pull request"
      onClick={() => {}}
      actions={[
        { label: "Squash and merge", onSelect: () => {} },
        { label: "Rebase and merge", onSelect: () => {} },
        { label: "Close pull request", onSelect: () => {}, destructive: true },
      ]}
    />
  );
}
