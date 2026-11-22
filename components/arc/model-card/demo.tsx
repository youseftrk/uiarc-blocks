"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { ModelCard, type ModelBenchmark, type ModelInfo } from "./model-card";
import styles from "./model-card.module.css";

const ANTHROPIC_MARK = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15.4 5h-2.5l5 14h2.5l-5-14ZM8.6 5 3.6 19h2.6l1-3h5.4l1 3h2.6L11.2 5H8.6Zm-.5 8.8 1.8-5.4 1.8 5.4H8.1Z"
      fill="currentColor"
    />
  </svg>
);

const OPENAI_MARK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M4.6 7.8l14.8 8.4M19.4 7.8 4.6 16.2" />
  </svg>
);

const GOOGLE_MARK = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3c.7 4.4 4.6 8.3 9 9-4.4.7-8.3 4.6-9 9-.7-4.4-4.6-8.3-9-9 4.4-.7 8.3-4.6 9-9Z"
      fill="currentColor"
    />
  </svg>
);

const MODELS: ModelInfo[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    mark: ANTHROPIC_MARK,
    summary:
      "Anthropic's most capable model for long running agents, complex coding and deep research.",
    modalities: ["text", "image", "pdf", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "Mar 2026",
    pricing: { input: 5.0, output: 25.0, cached: 0.5 },
    scores: { swebench: 86.4, gpqa: 89.2, terminal: 68.3 },
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    mark: ANTHROPIC_MARK,
    summary:
      "Balanced intelligence and speed for everyday engineering, code review, and tool-heavy workflows.",
    modalities: ["text", "image", "pdf", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    knowledgeCutoff: "Feb 2026",
    pricing: { input: 3.0, output: 15.0, cached: 0.3 },
    scores: { swebench: 83.2, gpqa: 86.5, terminal: 64.1 },
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    mark: OPENAI_MARK,
    summary:
      "Multimodal flagship with native audio understanding, fast reasoning traces, and broad tool reliability.",
    modalities: ["text", "image", "audio", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "Jan 2026",
    pricing: { input: 4.0, output: 24.0, cached: 0.4 },
    scores: { swebench: 84.1, gpqa: 90.1, terminal: 63.9 },
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "Google DeepMind",
    mark: GOOGLE_MARK,
    summary:
      "Long-context native multimodal model spanning video, audio, documents, and large repository indexing.",
    modalities: ["text", "image", "pdf", "audio", "video", "tools", "reasoning"],
    contextWindow: 2_000_000,
    maxOutput: 64_000,
    knowledgeCutoff: "Feb 2026",
    pricing: { input: 2.5, output: 12.0, cached: 0.25 },
    scores: { swebench: 81.8, gpqa: 88.4, terminal: 61.5 },
  },
];

const BENCHMARKS: ModelBenchmark[] = [
  {
    id: "swebench",
    label: "SWE-bench",
    description: "SWE-bench Verified, real GitHub issues resolved.",
    max: 100,
    unit: "%",
  },
  {
    id: "gpqa",
    label: "GPQA",
    description: "GPQA Diamond, graduate-level science reasoning.",
    max: 100,
    unit: "%",
  },
  {
    id: "terminal",
    label: "Terminal-Bench",
    description: "Terminal-Bench 2.0, end-to-end command-line tasks.",
    max: 100,
    unit: "%",
  },
];

export default function ModelCardDemo() {
  const [activeId, setActiveId] = useState(MODELS[0].id);
  const [loading, setLoading] = useState(false);

  const model = MODELS.find((m) => m.id === activeId) ?? MODELS[0];
  const rivals = MODELS.filter((m) => m.id !== model.id);

  const triggerReload = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 900);
  };

  return (
    <div className={styles.demo}>
      <div className={styles.controls}>
        <SegmentedControl
          aria-label="Choose model"
          value={activeId}
          onValueChange={(v: string) => setActiveId(v)}
          options={[
            { value: "claude-opus-5-5", label: "Opus 5.5" },
            { value: "claude-sonnet-5-5", label: "Sonnet 5.5" },
            { value: "gpt-6-1-sol", label: "GPT-6.1" },
            { value: "gemini-4-argon", label: "Gemini 4" },
          ]}
        />
        <button type="button" className={styles.reloadBtn} onClick={triggerReload}>
          <RotateCw size={13} strokeWidth={1.8} aria-hidden="true" />
          <span>Reload</span>
        </button>
      </div>

      <ModelCard
        model={model}
        rivals={rivals}
        benchmarks={BENCHMARKS}
        defaultCompareWith="gpt-6-1-sol"
        loading={loading}
        sample
      />
    </div>
  );
}
