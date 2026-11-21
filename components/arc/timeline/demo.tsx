"use client";

import { Timeline } from "./timeline";

const events = [
  { id: "e1", at: "2026-09-22T09:12:00Z", actor: "Maya", title: "merged Checkout redesign into main", meta: "PR #482" },
  { id: "e2", at: "2026-09-22T08:40:00Z", title: "Deploy failed", tone: "danger" as const, detail: <pre>Build step exited 1</pre> },
];

export default function Activity() {
  return <Timeline events={events} now={Date.UTC(2026, 8, 22, 10, 0, 0)} label="Project activity" maxHeight={420} />;
}
