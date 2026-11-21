"use client";

import { HoverCard, HoverCardProfile } from "./hover-card";

export default function Mention() {
  return (
    <HoverCard
      content={<HoverCardProfile name="Maya Chen" role="Product designer, Payments" stats={[{ label: "Projects", value: 12 }]} />}
    >
      <button type="button">@maya</button>
    </HoverCard>
  );
}
