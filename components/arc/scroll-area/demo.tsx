"use client";

import { ScrollArea } from "./scroll-area";

const EVENTS = Array.from({ length: 16 }, (_, i) => ({
  id: `e-${i}`,
  text: `Deployment #${240 - i} completed in ${(18 + (i % 7) * 3)}s`,
}));

export default function ActivityPanel() {
  return (
    <ScrollArea maxHeight={220} label="Recent activity">
      <ul style={{ margin: 0, padding: "8px 16px", listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        {EVENTS.map((event) => (
          <li key={event.id}>{event.text}</li>
        ))}
      </ul>
    </ScrollArea>
  );
}
