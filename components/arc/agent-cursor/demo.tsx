"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { AgentCursor } from "./agent-cursor";
import styles from "./agent-cursor.module.css";

const OUTCOMES = [
  { value: "edits", label: "Edits land" },
  { value: "error", label: "Connection drops" },
];

function dropConnection(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Connection lost")), 450);
    signal.addEventListener("abort", () => window.clearTimeout(timer));
  });
}

export default function Demo() {
  const [outcome, setOutcome] = useState("edits");
  return (
    <div className={styles.demo}>
      {outcome === "edits" ? <AgentCursor key="edits" /> : <AgentCursor key="error" run={dropConnection} loop simulated />}
      <SegmentedControl label="Run outcome" options={OUTCOMES} value={outcome} onValueChange={setOutcome} />
    </div>
  );
}
