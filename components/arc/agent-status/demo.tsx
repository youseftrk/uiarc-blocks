"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { AgentStatus, useAgentRunSimulation } from "./agent-status";
import type { AgentRunScenarioId } from "./agent-status";
import styles from "./agent-status.module.css";

const SCENARIOS = [
  { value: "coding", label: "Coding agent" },
  { value: "research", label: "Research agent" },
];

export default function Demo() {
  const [scenarioId, setScenarioId] = useState<AgentRunScenarioId>("coding");
  const { replay, ...run } = useAgentRunSimulation({ scenarioId });
  return (
    <div className={styles.demo} data-canvas="wide">
      <div className={styles.stage}>
        <AgentStatus key={scenarioId} {...run} />
      </div>
      <div className={styles.controls}>
        <SegmentedControl label="Scenario" options={SCENARIOS} value={scenarioId} onValueChange={value => setScenarioId(value as AgentRunScenarioId)} />
        <Button variant="secondary" size="sm" onClick={replay}>
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden />Replay
        </Button>
      </div>
    </div>
  );
}
