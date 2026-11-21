"use client";

import { useState } from "react";
import { TicketTear } from "./ticket-tear";

export default function TicketTearDemo() {
  const [torn, setTorn] = useState(false);

  return (
    <TicketTear
      torn={torn}
      onTornChange={setTorn}
      label="Tear off stub to check in"
      stub={
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)" }}>
            ADMIT ONE
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            Row F · 12
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pull →</span>
        </div>
      }
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--accent)" }}>
        ARC CONF 2026
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
        Teatro Tivoli, Lisbon
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        {torn ? "Checked in · Enjoy the show" : "Oct 14 · Doors open 09:00"}
      </div>
    </TicketTear>
  );
}
