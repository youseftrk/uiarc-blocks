"use client";

import { UpgradePrompt } from "./upgrade-prompt";

export default function UpgradePromptDemo() {
  return (
    <UpgradePrompt
      used={50}
      limit={50}
      resetsOn="Nov 1"
      onUpgrade={async () => {
        await new Promise((r) => setTimeout(r, 600));
      }}
    />
  );
}
