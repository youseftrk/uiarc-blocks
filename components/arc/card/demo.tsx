"use client";

import { Card } from "./card";
import { Avatar } from "../avatar/avatar";

export default function ProjectCard() {
  return (
    <Card
      title="Harbour redesign"
      description="New booking flow and room pages."
      media={<img src="/harbour.jpg" alt="" />}
      avatar={<Avatar name="Maya Chen" size="sm" />}
      meta="Maya Chen"
      status="Updated 2 hours ago"
      details={<p>Scope, milestones, and open questions.</p>}
    />
  );
}
