"use client";

import { useMemo, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import {
  AiWorkflow,
  workflowSampleSteps,
  type WorkflowStep,
} from "./ai-workflow";
import styles from "./ai-workflow.module.css";

type PreviewMode = "passes" | "fails" | "loading" | "empty";

function buildFailingSteps(): WorkflowStep[] {
  return workflowSampleSteps.map((step) => {
    if (step.kind !== "branch" || !step.paths) return step;
    return {
      ...step,
      paths: step.paths.map((p) =>
        p.id === "urgent"
          ? {
              ...p,
              steps: p.steps.map((sub) =>
                sub.id === "action-linear"
                  ? {
                      ...sub,
                      error:
                        "Linear returned 429 rate limit exceeded. Wait a moment and retry.",
                    }
                  : sub,
              ),
            }
          : p,
      ),
    };
  });
}

export default function Demo() {
  const [mode, setMode] = useState<PreviewMode>("passes");
  const failingSteps = useMemo(() => buildFailingSteps(), []);

  return (
    <div className={styles.demo}>
      <SegmentedControl
        label="Preview state"
        value={mode}
        onValueChange={(v) => setMode(v as PreviewMode)}
        options={[
          { value: "passes", label: "Passes" },
          { value: "fails", label: "Fails" },
          { value: "loading", label: "Loading" },
          { value: "empty", label: "Empty" },
        ]}
      />

      <AiWorkflow
        key={mode}
        defaultSteps={
          mode === "empty"
            ? []
            : mode === "fails"
              ? failingSteps
              : workflowSampleSteps
        }
        loading={mode === "loading"}
        autoPlay={mode === "passes" || mode === "fails"}
      />
    </div>
  );
}
