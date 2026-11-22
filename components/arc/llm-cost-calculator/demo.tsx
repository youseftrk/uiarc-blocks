"use client";

import { useState } from "react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { LlmCostCalculator, llmCostSampleModels } from "./llm-cost-calculator";
import styles from "./llm-cost-calculator.module.css";

type PreviewState = "ready" | "loading" | "error" | "empty";

export default function LlmCostCalculatorDemo() {
  const [previewState, setPreviewState] = useState<PreviewState>("ready");

  return (
    <div className={styles.demo}>
      <LlmCostCalculator
        models={previewState === "empty" ? [] : llmCostSampleModels}
        loading={previewState === "loading"}
        error={previewState === "error" ? "Could not reach the pricing feed. Check your connection and try again." : undefined}
        onRetry={() => setPreviewState("ready")}
      />

      <SegmentedControl
        className={styles.states}
        label="Preview state"
        options={[
          { value: "ready", label: "Ready" },
          { value: "loading", label: "Loading" },
          { value: "error", label: "Error" },
          { value: "empty", label: "Empty" },
        ]}
        value={previewState}
        onValueChange={(v) => setPreviewState(v as PreviewState)}
      />
    </div>
  );
}
