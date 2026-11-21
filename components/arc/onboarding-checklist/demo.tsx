"use client";

import { useState } from "react";
import { OnboardingChecklist } from "./onboarding-checklist";

export default function GettingStarted() {
  const [completed, setCompleted] = useState<string[]>(["profile"]);
  return (
    <OnboardingChecklist
      title="Set up your workspace"
      defaultCompleted={completed}
      onCompletedChange={setCompleted}
      steps={[
        { id: "invite", title: "Invite your team", actionLabel: "Invite", onAction: () => {} },
        { id: "connect", title: "Connect GitHub", description: "Sync issues and PRs.", actionLabel: "Connect", onAction: () => {} },
        { id: "profile", title: "Add a profile photo" },
      ]}
    />
  );
}
