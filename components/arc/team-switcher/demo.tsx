"use client";

import { useState } from "react";
import { TeamSwitcher, type TeamWorkspace } from "./team-switcher";

const INITIAL: TeamWorkspace[] = [
  { id: "acme", name: "Acme Corp", plan: "Enterprise", members: 214, role: "Admin" },
  { id: "acme-labs", name: "Acme Labs", plan: "Pro", members: 12, role: "Owner" },
  { id: "personal", name: "Personal", plan: "Free", members: 1, role: "Owner" },
];

export default function TeamSwitcherDemo() {
  const [workspaces, setWorkspaces] = useState(INITIAL);
  const [selected, setSelected] = useState("acme");

  return (
    <div style={{ minHeight: 240, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <TeamSwitcher
        workspaces={workspaces}
        value={selected}
        onValueChange={setSelected}
        onSwitch={async () => {
          await new Promise((r) => setTimeout(r, 260));
        }}
        onCreate={(name) => {
          const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
          setWorkspaces((prev) => [
            ...prev,
            { id, name, plan: "Pro", members: 1, role: "Owner" },
          ]);
          setSelected(id);
        }}
      />
    </div>
  );
}
