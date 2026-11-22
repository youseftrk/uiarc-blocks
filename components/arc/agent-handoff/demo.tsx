"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { AgentHandoff } from "./agent-handoff";
import type { HandoffScenario } from "./agent-handoff";
import styles from "./agent-handoff.module.css";

const STORIES = [
  { value: "handoff", label: "Person joins" },
  { value: "unavailable", label: "No one available" },
];

export default function Demo() {
  const [scenario, setScenario] = useState<HandoffScenario>("handoff");
  return (
    <div className={styles.demo}>
      <SegmentedControl label="Demo story" options={STORIES} value={scenario} onValueChange={value => setScenario(value as HandoffScenario)} />
      <AgentHandoff scenario={scenario} />
    </div>
  );
}
