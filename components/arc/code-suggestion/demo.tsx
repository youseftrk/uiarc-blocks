"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { CodeSuggestion } from "./code-suggestion";
import styles from "./code-suggestion.module.css";

const states = [
  { value: "live", label: "Suggestion" },
  { value: "empty", label: "No changes" },
  { value: "error", label: "Error" },
];

export default function Demo() {
  const [state, setState] = useState("live");
  const [run, setRun] = useState(0);
  return (
    <div className={styles.demo}>
      <SegmentedControl className={styles.control} label="Suggestion state" options={states} value={state} onValueChange={setState} />
      {state === "live" && <CodeSuggestion key={`live-${run}`} />}
      {state === "empty" && <CodeSuggestion key={`empty-${run}`} instruction="Use the shared fetch client" hunks={[]} filePath="src/billing" onRegenerate={() => setRun((r) => r + 1)} />}
      {state === "error" && <CodeSuggestion key="error" hunks={[]} status="error" filePath="src/billing" onRegenerate={() => setState("live")} />}
    </div>
  );
}
