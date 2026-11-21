"use client";

import { ExpandableCard } from "./expandable-card";

export default function PlanDetails() {
  return (
    <ExpandableCard title="Pro plan" description="Billed yearly, renews March 4" width={400} expandedWidth={600}>
      <ul>
        <li>Unlimited projects</li>
        <li>Priority support</li>
      </ul>
    </ExpandableCard>
  );
}
