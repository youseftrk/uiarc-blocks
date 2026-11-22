"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, ChevronDown, RotateCcw, Square } from "lucide-react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import styles from "./generation-stats.module.css";

export type GenerationStatus = "idle" | "waiting" | "streaming" | "done" | "stopped" | "error";

export type GenerationProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "mistral"
  | "deepseek"
  | "meta"
  | "qwen";

export interface GenerationModel {
  name: string;
  provider: GenerationProvider;
  id?: string;
}

export interface GenerationUsage {
  inputTokens?: number;
  cachedTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  ttftMs?: number;
  durationMs?: number;
  tokensPerSecond?: number;
  costUsd?: number;
}

export interface GenerationPricing {
  input: number;
  cachedInput?: number;
  output: number;
}

export interface GenerationSampleRun {
  model: GenerationModel;
  pricing: GenerationPricing;
  inputTokens: number;
  cachedTokens: number;
  reasoningTokens?: number;
  targetOutputTokens: number;
  ttftMs: number;
  targetTps: number;
  failAtTokens?: number;
  errorMessage?: string;
}

export interface GenerationStatsProps {
  status?: GenerationStatus;
  model?: GenerationModel;
  startedAt?: number;
  usage?: GenerationUsage;
  pricing?: GenerationPricing;
  speedSamples?: number[];
  error?: string;
  onRetry?: () => void;
  variant?: "card" | "inline";
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  note?: ReactNode;
  className?: string;
}

export const generationSampleRuns: GenerationSampleRun[] = [
  {
    model: { name: "Claude Sonnet 5.5", provider: "anthropic", id: "claude-sonnet-5-5" },
    pricing: { input: 3, cachedInput: 0.3, output: 15 },
    inputTokens: 4820,
    cachedTokens: 3200,
    targetOutputTokens: 284,
    ttftMs: 412,
    targetTps: 88,
  },
  {
    model: { name: "GPT-6.1 Sol", provider: "openai", id: "gpt-6.1-sol" },
    pricing: { input: 2.5, cachedInput: 0.625, output: 12 },
    inputTokens: 6140,
    cachedTokens: 4100,
    reasoningTokens: 164,
    targetOutputTokens: 312,
    ttftMs: 690,
    targetTps: 108,
  },
  {
    model: { name: "Gemini 3.8 Flash", provider: "google", id: "gemini-3.8-flash" },
    pricing: { input: 0.5, cachedInput: 0.125, output: 3 },
    inputTokens: 3920,
    cachedTokens: 2400,
    targetOutputTokens: 340,
    ttftMs: 268,
    targetTps: 162,
  },
  {
    model: { name: "Mistral Large 4", provider: "mistral", id: "mistral-large-4" },
    pricing: { input: 2, cachedInput: 0.5, output: 6 },
    inputTokens: 4210,
    cachedTokens: 1850,
    targetOutputTokens: 248,
    ttftMs: 520,
    targetTps: 94,
    failAtTokens: 96,
    errorMessage: "Upstream stream dropped after 96 tokens (502 Bad Gateway).",
  },
];

export interface SimulationFrame {
  model: GenerationModel;
  pricing: GenerationPricing;
  status: GenerationStatus;
  startedAt: number;
  usage: GenerationUsage;
  error?: string;
}

export interface UseGenerationSimulationOptions {
  runs?: GenerationSampleRun[];
  active?: boolean;
  hold?: boolean;
  loop?: boolean;
}

export function useGenerationSimulation({
  runs = generationSampleRuns,
  active = true,
  hold = false,
  loop = true,
}: UseGenerationSimulationOptions = {}) {
  const reduced = Boolean(useReducedMotion());
  const [runIdx, setRunIdx] = useState(0);
  const [cueOpen, setCueOpen] = useState(false);

  const run = runs[runIdx % runs.length] ?? generationSampleRuns[0];
  const failedOnceRef = useRef(false);
  const simRef = useRef({
    phase: (reduced ? "done" : "waiting") as GenerationStatus,
    elapsedMs: reduced ? run.ttftMs + Math.round((run.targetOutputTokens / run.targetTps) * 1000) : 0,
    outputTokens: reduced ? run.targetOutputTokens : 0,
    startedAt: 0,
    holdMs: 0,
    chunkAccum: 0,
    lastTps: reduced ? run.targetTps : 0,
  });

  const [frame, setFrame] = useState<SimulationFrame>(() => ({
    model: run.model,
    pricing: run.pricing,
    status: reduced ? "done" : "waiting",
    startedAt: Date.now(),
    usage: reduced
      ? {
          inputTokens: run.inputTokens,
          cachedTokens: run.cachedTokens,
          outputTokens: run.targetOutputTokens,
          reasoningTokens: run.reasoningTokens,
          ttftMs: run.ttftMs,
          durationMs: run.ttftMs + Math.round((run.targetOutputTokens / run.targetTps) * 1000),
          tokensPerSecond: run.targetTps,
        }
      : {
          inputTokens: run.inputTokens,
          cachedTokens: run.cachedTokens,
          outputTokens: 0,
          reasoningTokens: run.reasoningTokens ? 0 : undefined,
        },
  }));

  const startRun = useCallback(
    (idx: number, resetFailFlag: boolean) => {
      const target = runs[idx % runs.length] ?? generationSampleRuns[0];
      if (resetFailFlag) failedOnceRef.current = false;
      const now = Date.now();
      simRef.current = {
        phase: reduced ? "done" : "waiting",
        elapsedMs: reduced
          ? target.ttftMs + Math.round((target.targetOutputTokens / target.targetTps) * 1000)
          : 0,
        outputTokens: reduced ? target.targetOutputTokens : 0,
        startedAt: now,
        holdMs: 0,
        chunkAccum: 0,
        lastTps: reduced ? target.targetTps : 0,
      };
      setFrame({
        model: target.model,
        pricing: target.pricing,
        status: reduced ? "done" : "waiting",
        startedAt: now,
        usage: reduced
          ? {
              inputTokens: target.inputTokens,
              cachedTokens: target.cachedTokens,
              outputTokens: target.targetOutputTokens,
              reasoningTokens: target.reasoningTokens,
              ttftMs: target.ttftMs,
              durationMs:
                target.ttftMs + Math.round((target.targetOutputTokens / target.targetTps) * 1000),
              tokensPerSecond: target.targetTps,
            }
          : {
              inputTokens: target.inputTokens,
              cachedTokens: target.cachedTokens,
              outputTokens: 0,
              reasoningTokens: target.reasoningTokens ? 0 : undefined,
            },
      });
    },
    [runs, reduced],
  );

  const retry = useCallback(() => {
    failedOnceRef.current = true;
    startRun(runIdx, false);
  }, [runIdx, startRun]);

  const next = useCallback(() => {
    const nextIdx = (runIdx + 1) % runs.length;
    setRunIdx(nextIdx);
    startRun(nextIdx, true);
  }, [runIdx, runs.length, startRun]);

  useEffect(() => {
    if (!active || reduced) return;

    const TICK = 40;
    const id = window.setInterval(() => {
      const s = simRef.current;
      const r = runs[runIdx % runs.length] ?? generationSampleRuns[0];

      if (s.phase === "waiting") {
        s.elapsedMs += TICK;
        if (s.elapsedMs >= r.ttftMs) {
          s.phase = "streaming";
          s.outputTokens = 4;
          s.lastTps = Math.round(r.targetTps * 0.72);
          setFrame({
            model: r.model,
            pricing: r.pricing,
            status: "streaming",
            startedAt: s.startedAt,
            usage: {
              inputTokens: r.inputTokens,
              cachedTokens: r.cachedTokens,
              outputTokens: s.outputTokens,
              reasoningTokens: r.reasoningTokens ? Math.min(r.reasoningTokens, 12) : undefined,
              ttftMs: r.ttftMs,
              tokensPerSecond: s.lastTps,
            },
          });
        }
        return;
      }

      if (s.phase === "streaming") {
        s.elapsedMs += TICK;
        const genSec = Math.max(0.04, (s.elapsedMs - r.ttftMs) / 1000);
        const ramp = Math.min(1, 0.72 + genSec * 0.35);
        const wave = 1 + Math.sin(genSec * 4.2) * 0.06 + Math.cos(genSec * 2.1) * 0.04;
        const instantTps = r.targetTps * ramp * wave;
        s.chunkAccum += instantTps * (TICK / 1000);

        if (s.chunkAccum >= 4) {
          const add = Math.floor(s.chunkAccum);
          s.chunkAccum -= add;
          s.outputTokens = Math.min(r.targetOutputTokens, s.outputTokens + add);
          s.lastTps = Math.round(s.outputTokens / genSec);

          if (r.failAtTokens && !failedOnceRef.current && s.outputTokens >= r.failAtTokens) {
            s.phase = "error";
            s.holdMs = 0;
            failedOnceRef.current = true;
            setFrame({
              model: r.model,
              pricing: r.pricing,
              status: "error",
              startedAt: s.startedAt,
              error: r.errorMessage ?? "Stream interrupted.",
              usage: {
                inputTokens: r.inputTokens,
                cachedTokens: r.cachedTokens,
                outputTokens: s.outputTokens,
                reasoningTokens: r.reasoningTokens
                  ? Math.round((s.outputTokens / r.targetOutputTokens) * r.reasoningTokens)
                  : undefined,
                ttftMs: r.ttftMs,
                durationMs: s.elapsedMs,
                tokensPerSecond: s.lastTps,
              },
            });
            return;
          }

          if (s.outputTokens >= r.targetOutputTokens) {
            s.phase = "done";
            s.holdMs = 0;
            const totalMs = s.elapsedMs;
            const avgTps = Math.round(r.targetOutputTokens / Math.max(0.1, (totalMs - r.ttftMs) / 1000));
            setFrame({
              model: r.model,
              pricing: r.pricing,
              status: "done",
              startedAt: s.startedAt,
              usage: {
                inputTokens: r.inputTokens,
                cachedTokens: r.cachedTokens,
                outputTokens: r.targetOutputTokens,
                reasoningTokens: r.reasoningTokens,
                ttftMs: r.ttftMs,
                durationMs: totalMs,
                tokensPerSecond: avgTps,
              },
            });
            return;
          }

          setFrame({
            model: r.model,
            pricing: r.pricing,
            status: "streaming",
            startedAt: s.startedAt,
            usage: {
              inputTokens: r.inputTokens,
              cachedTokens: r.cachedTokens,
              outputTokens: s.outputTokens,
              reasoningTokens: r.reasoningTokens
                ? Math.round((s.outputTokens / r.targetOutputTokens) * r.reasoningTokens)
                : undefined,
              ttftMs: r.ttftMs,
              tokensPerSecond: s.lastTps,
            },
          });
        }
        return;
      }

      if (s.phase === "error") {
        s.holdMs += TICK;
        if (!hold && s.holdMs >= 2600) {
          startRun(runIdx, false);
        }
        return;
      }

      if (s.phase === "done") {
        if (hold) return;
        s.holdMs += TICK;
        if (s.holdMs >= 2400 && s.holdMs < 2400 + TICK) {
          setCueOpen(true);
        }
        if (s.holdMs >= 3200) {
          setCueOpen(false);
          if (loop || runIdx < runs.length - 1) {
            const nextIdx = (runIdx + 1) % runs.length;
            setRunIdx(nextIdx);
            startRun(nextIdx, true);
          }
        }
      }
    }, TICK);

    return () => window.clearInterval(id);
  }, [active, reduced, hold, loop, runIdx, runs, startRun]);

  return { frame, cueOpen, retry, next };
}

function ProviderMark({ provider, className }: { provider: GenerationProvider; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    width: 16,
    height: 16,
    className,
    "aria-hidden": true as const,
    focusable: false as const,
  };

  switch (provider) {
    case "openai":
      return (
        <svg {...common}>
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
      );
    case "anthropic":
      return (
        <svg {...common}>
          <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 10.405L8.453 8.117 6.205 13.925h4.496z" />
        </svg>
      );
    case "google":
      return (
        <svg {...common}>
          <path d="M12 2c.72 5.14 4.86 9.28 10 10-5.14.72-9.28 4.86-10 10-.72-5.14-4.86-9.28-10-10 5.14-.72 9.28-4.86 10-10z" />
        </svg>
      );
    case "mistral":
      return (
        <svg {...common}>
          <path d="M3 4h3.6v3.6H3V4zm14.4 0H21v3.6h-3.6V4zM3 7.6h7.2v3.6H3V7.6zm10.8 0H21v3.6h-7.2V7.6zM3 11.2h18v3.6H3v-3.6zm0 3.6h3.6v3.6H3v-3.6zm7.2 0h3.6v3.6h-3.6v-3.6zm7.2 0H21v3.6h-3.6v-3.6zM3 18.4h7.2V22H3v-3.6zm10.8 0H21V22h-7.2v-3.6z" />
        </svg>
      );
    case "xai":
      return (
        <svg {...common}>
          <path d="M3.5 3.5h3.7l4.8 6.7 4.9-6.7h3.6l-6.7 9 7 8h-3.7l-5.1-6.9-5.2 6.9H3.2l7-9.2-6.7-7.8z" />
        </svg>
      );
    case "deepseek":
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm0 3.2a5.8 5.8 0 0 1 5.4 3.7c-1.8-.3-3.5.3-4.8 1.5-1.4 1.3-2.9 1.6-4.7 1.1A5.8 5.8 0 0 1 12 6.2zm0 11.6a5.8 5.8 0 0 1-5.1-3.1c1.9.4 3.9-.1 5.5-1.6 1.2-1.1 2.7-1.5 4.4-1.2a5.8 5.8 0 0 1-4.8 5.9z" />
        </svg>
      );
    case "meta":
      return (
        <svg {...common}>
          <path d="M6.8 6.5c-2.6 0-4.8 2.6-4.8 5.9 0 3.1 1.7 5.1 4 5.1 1.8 0 3.2-1.2 4.7-3.7l1.3-2.2 1.3 2.2c1.5 2.5 2.9 3.7 4.7 3.7 2.3 0 4-2 4-5.1 0-3.3-2.2-5.9-4.8-5.9-2.1 0-3.6 1.4-5.2 4-1.6-2.6-3.1-4-5.2-4zm0 2.4c1.2 0 2.3 1.1 3.5 3.1l-.9 1.5c-1.1 1.8-2 2.6-3.1 2.6-1.2 0-2-1.1-2-3.2 0-2.3 1.1-4 2.5-4zm10.4 0c1.4 0 2.5 1.7 2.5 4 0 2.1-.8 3.2-2 3.2-1.1 0-2-.8-3.1-2.6l-.9-1.5c1.2-2 2.3-3.1 3.5-3.1z" />
        </svg>
      );
    case "qwen":
      return (
        <svg {...common}>
          <path d="M12 2.5 20.2 7.2v9.6L12 21.5l-8.2-4.7V7.2L12 2.5zm0 3.1L6.6 8.7v6.6l5.4 3.1 5.4-3.1V8.7L12 5.6zm0 3.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z" />
        </svg>
      );
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatRate(perM: number): string {
  return `$${perM >= 10 ? perM.toFixed(0) : Number(perM.toFixed(2))}/M`;
}

function GlidingNumber({
  value,
  format,
  reduced,
}: {
  value: number | null;
  format: (v: number) => string;
  reduced: boolean;
}) {
  const [shown, setShown] = useState<number | null>(value);
  const prevRef = useRef<number | null>(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (value === null || prev === null || reduced || value <= prev) {
      setShown(value);
      return;
    }
    const ctrl = animate(prev, value, {
      duration: 0.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => ctrl.stop();
  }, [value, reduced]);

  return <span className={styles.num}>{shown === null ? "—" : format(shown)}</span>;
}

function Sparkline({ samples, live }: { samples: number[]; live: boolean }) {
  const W = 56;
  const H = 20;
  const padX = 2.5;
  const padY = 2.5;
  const baseY = H - padY;

  if (samples.length < 2) {
    return (
      <svg className={styles.spark} width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
        <line x1={padX} x2={W - padX} y1={baseY} y2={baseY} className={styles.sparkBase} />
      </svg>
    );
  }

  const max = Math.max(...samples, 1);
  const min = Math.min(...samples, 0);
  const span = Math.max(1, max - min);
  const denom = Math.max(samples.length - 1, 22);
  const stepX = (W - padX * 2) / denom;

  const pts: [number, number][] = samples.map((v, i) => {
    const x = padX + i * stepX;
    const norm = (v - min) / span;
    const y = baseY - 2 - norm * (H - padY * 2 - 4);
    return [x, y];
  });

  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const last = pts[pts.length - 1];

  return (
    <svg className={styles.spark} width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
      <line x1={padX} x2={W - padX} y1={baseY} y2={baseY} className={styles.sparkBase} />
      <path d={d} className={styles.sparkLine} />
      {last && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2}
          className={styles.sparkDot}
          data-live={live ? "true" : undefined}
        />
      )}
    </svg>
  );
}

export function GenerationStats({
  status: statusProp,
  model: modelProp,
  startedAt: startedAtProp,
  usage: usageProp,
  pricing: pricingProp,
  speedSamples: speedSamplesProp,
  error: errorProp,
  onRetry: onRetryProp,
  variant = "card",
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  note: noteProp,
  className,
}: GenerationStatsProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const panelId = `${uid}-panel`;
  const reduced = Boolean(useReducedMotion());

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isOpen = expandedProp !== undefined ? expandedProp : internalExpanded;

  const setOpen = useCallback(
    (next: boolean) => {
      if (expandedProp === undefined) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedProp, onExpandedChange],
  );

  // Observe visibility to pause simulation off-screen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isSimulated = statusProp === undefined;
  const sim = useGenerationSimulation({
    active: isSimulated && inView,
    hold: isOpen,
    loop: true,
  });

  const status = statusProp ?? sim.frame.status;
  const model = modelProp ?? sim.frame.model;
  const startedAt = startedAtProp ?? sim.frame.startedAt;
  const usage = usageProp ?? sim.frame.usage;
  const pricing = pricingProp ?? (isSimulated ? sim.frame.pricing : undefined);
  const error = errorProp ?? (isSimulated ? sim.frame.error : undefined);
  const onRetry = onRetryProp ?? (isSimulated ? sim.retry : undefined);
  const note =
    noteProp !== undefined
      ? noteProp
      : isSimulated
        ? "Simulated run with sample rates. Nothing was sent."
        : undefined;

  // Live clock while waiting or streaming
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "waiting" && status !== "streaming") return;
    if (reduced) return;
    let raf = 0;
    const tick = () => {
      setNowMs(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, reduced]);

  // Derived metrics
  const elapsedLive = startedAt ? Math.max(0, nowMs - startedAt) : 0;
  const ttftMs =
    usage.ttftMs !== undefined
      ? usage.ttftMs
      : status === "waiting" && startedAt
        ? elapsedLive
        : null;

  const totalDurationMs =
    usage.durationMs !== undefined
      ? usage.durationMs
      : status === "streaming" && startedAt
        ? elapsedLive
        : ttftMs;

  const outputTokens = usage.outputTokens ?? null;
  const reasoningTokens = usage.reasoningTokens ?? 0;
  const inputTokens = usage.inputTokens ?? 0;
  const cachedTokens = Math.min(usage.cachedTokens ?? 0, inputTokens);
  const freshInputTokens = Math.max(0, inputTokens - cachedTokens);

  const computedTps = useMemo(() => {
    if (usage.tokensPerSecond !== undefined) return usage.tokensPerSecond;
    if (outputTokens === null || outputTokens <= 0) return null;
    if (totalDurationMs === null || ttftMs === null) return null;
    const genSec = Math.max(0.05, (totalDurationMs - ttftMs) / 1000);
    return Math.round(outputTokens / genSec);
  }, [usage.tokensPerSecond, outputTokens, totalDurationMs, ttftMs]);

  const computedCost = useMemo(() => {
    if (usage.costUsd !== undefined) return usage.costUsd;
    if (!pricing) return null;
    const cachedRate = pricing.cachedInput ?? pricing.input;
    const inCost = (freshInputTokens / 1_000_000) * pricing.input;
    const cacheCost = (cachedTokens / 1_000_000) * cachedRate;
    const outCost = (((outputTokens ?? 0) + reasoningTokens) / 1_000_000) * pricing.output;
    return inCost + cacheCost + outCost;
  }, [usage.costUsd, pricing, freshInputTokens, cachedTokens, outputTokens, reasoningTokens]);

  // Internal speed sampling every 160ms while streaming, capped at 48 points
  const [internalSamples, setInternalSamples] = useState<number[]>([]);
  const latestTpsRef = useRef<number | null>(computedTps);
  useEffect(() => {
    latestTpsRef.current = computedTps;
  }, [computedTps]);

  useEffect(() => {
    if (speedSamplesProp !== undefined) return;
    if (status !== "streaming") return;

    const pushSample = (reset = false) => {
      const val = latestTpsRef.current;
      if (val === null || val <= 0) {
        if (reset) setInternalSamples([]);
        return;
      }
      setInternalSamples((prev) => {
        const base = reset ? [] : prev;
        const smoothed = base.length > 0 ? base[base.length - 1] * 0.45 + val * 0.55 : val;
        const next = [...base, smoothed];
        if (next.length <= 48) return next;
        // Compress by averaging adjacent pairs to keep the whole run's shape
        const compressed: number[] = [];
        for (let i = 0; i < next.length; i += 2) {
          const a = next[i];
          const b = next[i + 1] ?? a;
          compressed.push((a + b) / 2);
        }
        return compressed;
      });
    };

    const firstTimer = window.setTimeout(() => pushSample(true), 0);
    const id = window.setInterval(() => pushSample(false), 160);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(id);
    };
  }, [status, speedSamplesProp, model.name]);

  const samples =
    speedSamplesProp ??
    (status === "waiting" || status === "idle" ? [] : internalSamples);

  // Status label & icon
  const statusText = useMemo(() => {
    switch (status) {
      case "idle":
        return "Idle";
      case "waiting":
        return "Waiting";
      case "streaming":
        return "Streaming";
      case "done":
        return totalDurationMs !== null ? `Done in ${formatMs(totalDurationMs)}` : "Done";
      case "stopped":
        return totalDurationMs !== null ? `Stopped at ${formatMs(totalDurationMs)}` : "Stopped";
      case "error":
        return "Failed";
    }
  }, [status, totalDurationMs]);

  // Polite announcement
  const announcement = useMemo(() => {
    if (isSimulated) return "Simulated run with sample rates. Nothing was sent.";
    if (status === "done") {
      const parts = [
        `${model.name} done${totalDurationMs !== null ? ` in ${formatMs(totalDurationMs)}` : ""}`,
      ];
      if (outputTokens !== null) {
        parts.push(
          `${outputTokens.toLocaleString()} output tokens${computedTps !== null ? ` at ${computedTps} tokens per second` : ""}`,
        );
      }
      if (computedCost !== null) parts.push(formatUsd(computedCost));
      return parts.join(", ");
    }
    if (status === "error") return `${model.name} failed${error ? `: ${error}` : ""}`;
    if (status === "stopped") {
      return `${model.name} stopped${totalDurationMs !== null ? ` at ${formatMs(totalDurationMs)}` : ""}`;
    }
    return "";
  }, [isSimulated, status, model.name, totalDurationMs, outputTokens, computedTps, computedCost, error]);

  // JSON payload for CopyButton
  const copyPayload = useMemo(
    () =>
      JSON.stringify(
        {
          model: { name: model.name, provider: model.provider, ...(model.id ? { id: model.id } : {}) },
          status,
          latencyMs: {
            ttft: ttftMs !== null ? Math.round(ttftMs) : null,
            generation:
              totalDurationMs !== null && ttftMs !== null
                ? Math.max(0, Math.round(totalDurationMs - ttftMs))
                : null,
            total: totalDurationMs !== null ? Math.round(totalDurationMs) : null,
          },
          tokens: {
            input: freshInputTokens,
            cachedInput: cachedTokens,
            output: outputTokens ?? 0,
            ...(reasoningTokens > 0 ? { reasoning: reasoningTokens } : {}),
            total: inputTokens + (outputTokens ?? 0) + reasoningTokens,
          },
          tokensPerSecond: computedTps,
          costUsd: computedCost !== null ? Number(computedCost.toFixed(6)) : null,
        },
        null,
        2,
      ),
    [
      model,
      status,
      ttftMs,
      totalDurationMs,
      freshInputTokens,
      cachedTokens,
      outputTokens,
      reasoningTokens,
      inputTokens,
      computedTps,
      computedCost,
    ],
  );

  const genMs =
    totalDurationMs !== null && ttftMs !== null ? Math.max(0, totalDurationMs - ttftMs) : 0;
  const barTotal = Math.max(1, (ttftMs ?? 0) + genMs);
  const ttftGrow = (ttftMs ?? 0) / barTotal;
  const genGrow = genMs / barTotal;

  const springHeight = reduced
    ? { duration: 0 }
    : { type: "spring" as const, visualDuration: 0.26, bounce: 0 };

  const totalTokens = inputTokens + (outputTokens ?? 0) + reasoningTokens;
  const cachedRate = pricing ? (pricing.cachedInput ?? pricing.input) : undefined;

  return (
    <div
      ref={rootRef}
      className={[
        styles.root,
        variant === "inline" ? styles.inline : styles.card,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={status}
      data-open={isOpen ? "" : undefined}
      role="group"
      aria-labelledby={labelId}
    >
      <div className={styles.head}>
        <ProviderMark provider={model.provider} className={styles.mark} />
        <span id={labelId} className={styles.model}>
          {model.name}
          <span className={styles.srOnly}> stats</span>
        </span>
        <span className={styles.status}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              className={styles.statusInner}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1 } }}
              transition={reduced ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.statusIcon} data-status={status}>
                {(status === "waiting" || status === "streaming") && (
                  <svg
                    className={styles.spinner}
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeOpacity=".22"
                      strokeWidth="2"
                    />
                    <path
                      d="M8 2a6 6 0 0 1 6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {status === "done" && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <motion.path
                      d="M3.2 8.4 6.4 11.6 12.8 4.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>
                )}
                {status === "error" && <AlertCircle size={14} strokeWidth={1.8} aria-hidden="true" />}
                {status === "stopped" && <Square size={10} fill="currentColor" aria-hidden="true" />}
              </span>
              <span className={styles.statusLabel}>{statusText}</span>
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <dl className={styles.stats}>
        <div className={styles.cell}>
          <dt className={styles.label}>First token</dt>
          <dd className={styles.value}>
            <GlidingNumber value={ttftMs} format={formatMs} reduced={reduced} />
            <span className={styles.unitInline}>to first token</span>
          </dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.label}>Speed</dt>
          <dd className={styles.value}>
            <GlidingNumber
              value={computedTps}
              format={(v) => String(Math.round(v))}
              reduced={reduced}
            />
            <span className={styles.unit}>tok/s</span>
            <Sparkline samples={samples} live={status === "streaming"} />
          </dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.label}>Output tokens</dt>
          <dd className={styles.value}>
            <GlidingNumber
              value={outputTokens}
              format={(v) => Math.round(v).toLocaleString()}
              reduced={reduced}
            />
            <span className={styles.unitInline}>tokens</span>
          </dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.label}>Cost</dt>
          <dd className={styles.value}>
            <GlidingNumber value={computedCost} format={formatUsd} reduced={reduced} />
          </dd>
        </div>
      </dl>

      <Button
        variant="ghost"
        size="sm"
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? "Hide details" : "Show details"}
        onClick={() => setOpen(!isOpen)}
      >
        <span className={styles.toggleLabel}>Details</span>
        <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
      </Button>

      {/* Error row */}
      <AnimatePresence initial={false}>
        {status === "error" && (
          <motion.div
            key="error"
            className={styles.errorClip}
            initial={reduced ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
            transition={{ height: springHeight, opacity: { duration: reduced ? 0 : 0.16 } }}
          >
            <div className={styles.error}>
              <AlertCircle size={16} strokeWidth={1.75} className={styles.errorIcon} aria-hidden="true" />
              <p className={styles.errorText}>{error ?? "Generation failed."}</p>
              {onRetry && (
                <Button variant="secondary" size="sm" className={styles.retry} onClick={onRetry}>
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                  <span>Retry</span>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable breakdown panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="panel"
            id={panelId}
            className={styles.panelClip}
            initial={reduced ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
            transition={{ height: springHeight, opacity: { duration: reduced ? 0 : 0.16 } }}
          >
            <div className={styles.panel}>
              {/* Latency breakdown bar */}
              <div className={styles.latency}>
                <div className={styles.bar} aria-hidden="true">
                  <div className={styles.segTtft} style={{ flexGrow: Math.max(0.02, ttftGrow) }} />
                  <div className={styles.segGen} style={{ flexGrow: Math.max(0.02, genGrow) }} />
                </div>
                <dl className={styles.legend}>
                  <div className={styles.legendItem}>
                    <dt>
                      <span className={styles.swatchTtft} aria-hidden="true" />
                      First token
                    </dt>
                    <dd className={styles.num}>{ttftMs !== null ? formatMs(ttftMs) : "—"}</dd>
                  </div>
                  <div className={styles.legendItem}>
                    <dt>
                      <span className={styles.swatchGen} aria-hidden="true" />
                      Generation
                    </dt>
                    <dd className={styles.num}>{totalDurationMs !== null ? formatMs(genMs) : "—"}</dd>
                  </div>
                  <div className={styles.legendItem}>
                    <dt>Total</dt>
                    <dd className={styles.num}>
                      {totalDurationMs !== null ? formatMs(totalDurationMs) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Token & cost table */}
              <table className={styles.table}>
                <caption className={styles.srOnly}>{model.name} token and cost breakdown</caption>
                <thead>
                  <tr>
                    <th scope="col">Tokens</th>
                    <th scope="col">Count</th>
                    {pricing && (
                      <th scope="col" className={styles.rateCol}>
                        Rate
                      </th>
                    )}
                    {(pricing || usage.costUsd !== undefined) && <th scope="col">Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Input</th>
                    <td className={styles.num}>{freshInputTokens.toLocaleString()}</td>
                    {pricing && <td className={`${styles.num} ${styles.rateCol}`}>{formatRate(pricing.input)}</td>}
                    {(pricing || usage.costUsd !== undefined) && (
                      <td className={styles.num}>
                        {pricing ? formatUsd((freshInputTokens / 1_000_000) * pricing.input) : "—"}
                      </td>
                    )}
                  </tr>
                  {cachedTokens > 0 && (
                    <tr>
                      <th scope="row">Cached input</th>
                      <td className={styles.num}>{cachedTokens.toLocaleString()}</td>
                      {pricing && cachedRate !== undefined && (
                        <td className={`${styles.num} ${styles.rateCol}`}>{formatRate(cachedRate)}</td>
                      )}
                      {(pricing || usage.costUsd !== undefined) && (
                        <td className={styles.num}>
                          {pricing && cachedRate !== undefined
                            ? formatUsd((cachedTokens / 1_000_000) * cachedRate)
                            : "—"}
                        </td>
                      )}
                    </tr>
                  )}
                  <tr>
                    <th scope="row">Output</th>
                    <td className={styles.num}>{(outputTokens ?? 0).toLocaleString()}</td>
                    {pricing && <td className={`${styles.num} ${styles.rateCol}`}>{formatRate(pricing.output)}</td>}
                    {(pricing || usage.costUsd !== undefined) && (
                      <td className={styles.num}>
                        {pricing ? formatUsd(((outputTokens ?? 0) / 1_000_000) * pricing.output) : "—"}
                      </td>
                    )}
                  </tr>
                  {reasoningTokens > 0 && (
                    <tr>
                      <th scope="row">Reasoning</th>
                      <td className={styles.num}>{reasoningTokens.toLocaleString()}</td>
                      {pricing && <td className={`${styles.num} ${styles.rateCol}`}>{formatRate(pricing.output)}</td>}
                      {(pricing || usage.costUsd !== undefined) && (
                        <td className={styles.num}>
                          {pricing ? formatUsd((reasoningTokens / 1_000_000) * pricing.output) : "—"}
                        </td>
                      )}
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className={styles.num}>{totalTokens.toLocaleString()}</td>
                    {pricing && <td className={styles.rateCol} />}
                    {(pricing || usage.costUsd !== undefined) && (
                      <td className={styles.num}>
                        {computedCost !== null ? formatUsd(computedCost) : "—"}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>

              <div className={styles.foot}>
                <p className={styles.note}>{note ?? ""}</p>
                <CopyButton
                  value={copyPayload}
                  label="Copy stats as JSON"
                  iconOnly
                  variant="plain"
                  className={styles.copy}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

export default GenerationStats;
