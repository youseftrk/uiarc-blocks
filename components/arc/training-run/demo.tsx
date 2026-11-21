"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { TrainingRun, type TrainingRunScenario } from "./training-run";
import styles from "./demo.module.css";

const SCENARIOS = [
  { value: "healthy", label: "Healthy run" },
  { value: "oom", label: "Out of memory" },
];

export default function Demo() {
  const [scenario, setScenario] = useState<TrainingRunScenario>("healthy");
  return (
    <div className={styles.demo}>
      <TrainingRun key={scenario} scenario={scenario} />
      <SegmentedControl label="Scenario" options={SCENARIOS} value={scenario} onValueChange={value => setScenario(value as TrainingRunScenario)} />
    </div>
  );
}
