"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Brain,
  Check,
  ChevronDown,
  FileText,
  Film,
  Image as ImageIcon,
  Mic,
  Type,
  Wrench,
} from "lucide-react";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Slider } from "../slider/slider";
import Switch from "../switch/switch";
import styles from "./model-card.module.css";

export type ModelModality = "text" | "image" | "pdf" | "audio" | "video" | "tools" | "reasoning";

export interface ModelPricing {
  input: number;
  output: number;
  cached?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  mark?: ReactNode;
  summary: string;
  modalities: ModelModality[];
  contextWindow: number;
  maxOutput: number;
  knowledgeCutoff: string;
  pricing: ModelPricing;
  scores: Record<string, number | undefined>;
}

export interface ModelBenchmark {
  id: string;
  label: string;
  description?: string;
  max?: number;
  unit?: string;
}

export type ModelCardView = "details" | "compare";

export interface ModelCardLabels {
  compare?: string;
  select?: string;
  selected?: string;
  retry?: string;
  errorTitle?: string;
}

export interface ModelCardProps {
  model: ModelInfo;
  rivals?: ModelInfo[];
  benchmarks?: ModelBenchmark[];
  view?: ModelCardView;
  defaultView?: ModelCardView;
  onViewChange?: (view: ModelCardView) => void;
  compareWith?: string;
  defaultCompareWith?: string;
  onCompareWithChange?: (id: string) => void;
  benchmark?: string;
  defaultBenchmark?: string;
  onBenchmarkChange?: (id: string) => void;
  monthlyTokens?: number;
  defaultMonthlyTokens?: number;
  onMonthlyTokensChange?: (millions: number) => void;
  inputShare?: number;
  currency?: string;
  sample?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCopyId?: (id: string) => void;
  onSelect?: (model: ModelInfo) => void;
  selected?: boolean;
  labels?: ModelCardLabels;
  className?: string;
  style?: CSSProperties;
}

const ALL_MODALITIES: { key: ModelModality; label: string; icon: ReactNode }[] = [
  { key: "text", label: "Text", icon: <Type size={13} strokeWidth={1.8} /> },
  { key: "image", label: "Image", icon: <ImageIcon size={13} strokeWidth={1.8} /> },
  { key: "pdf", label: "PDF", icon: <FileText size={13} strokeWidth={1.8} /> },
  { key: "audio", label: "Audio", icon: <Mic size={13} strokeWidth={1.8} /> },
  { key: "video", label: "Video", icon: <Film size={13} strokeWidth={1.8} /> },
  { key: "tools", label: "Tools", icon: <Wrench size={13} strokeWidth={1.8} /> },
  { key: "reasoning", label: "Reasoning", icon: <Brain size={13} strokeWidth={1.8} /> },
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseCutoffMonths(cutoff: string): number | null {
  const m = cutoff.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[1].toLowerCase()];
  if (!mon) return null;
  return Number(m[2]) * 12 + mon;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M tokens`;
  }
  if (n >= 1_000) {
    const v = Math.round(n / 1_000);
    return `${v}K tokens`;
  }
  return `${n} tokens`;
}

function formatMoney(n: number, currency: string, decimals = 2): string {
  if (decimals === 0) {
    return `${currency}${Math.round(n).toLocaleString("en-US")}`;
  }
  return `${currency}${n.toFixed(decimals)}`;
}

function RollingNumber({
  value,
  format,
  className,
  reduced,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduced || fromRef.current === value) {
      fromRef.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const startVal = fromRef.current;
    const delta = value - startVal;
    const duration = 260;
    let startTime = 0;
    let raf = 0;
    const step = (now: number) => {
      if (!startTime) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = startVal + delta * eased;
      fromRef.current = cur;
      setShown(cur);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  return <span className={[styles.number, className].filter(Boolean).join(" ")}>{format(shown)}</span>;
}

function Swap({
  valueKey,
  children,
  block = false,
  reduced,
}: {
  valueKey: string;
  children: ReactNode;
  block?: boolean;
  reduced: boolean;
}) {
  return (
    <span className={block ? styles.swapBlock : styles.swap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={valueKey}
          className={styles.swapItem}
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3 }}
          transition={{ duration: reduced ? 0.01 : 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ModelCard({
  model,
  rivals = [],
  benchmarks = [],
  view: controlledView,
  defaultView = "details",
  onViewChange,
  compareWith: controlledCompareWith,
  defaultCompareWith,
  onCompareWithChange,
  benchmark: controlledBenchmark,
  defaultBenchmark,
  onBenchmarkChange,
  monthlyTokens: controlledMonthlyTokens,
  defaultMonthlyTokens = 100,
  onMonthlyTokensChange,
  inputShare = 0.75,
  currency = "$",
  sample = false,
  loading = false,
  error = null,
  onRetry,
  onCopyId,
  onSelect,
  selected = false,
  labels,
  className,
  style,
}: ModelCardProps) {
  const reduced = Boolean(useReducedMotion());
  const headingId = useId();

  const [uncontrolledView, setUncontrolledView] = useState<ModelCardView>(defaultView);
  const view = controlledView ?? uncontrolledView;
  const setView = (next: ModelCardView) => {
    if (controlledView === undefined) setUncontrolledView(next);
    onViewChange?.(next);
  };

  const validRivals = useMemo(() => rivals.filter((r) => r.id !== model.id), [rivals, model.id]);

  const [uncontrolledCompareWith, setUncontrolledCompareWith] = useState<string>(
    defaultCompareWith ?? validRivals[0]?.id ?? ""
  );
  const compareId = controlledCompareWith ?? uncontrolledCompareWith;
  const rival =
    validRivals.find((r) => r.id === compareId) ?? validRivals[0] ?? null;

  const setCompareId = (id: string) => {
    if (controlledCompareWith === undefined) setUncontrolledCompareWith(id);
    onCompareWithChange?.(id);
  };

  const [uncontrolledBench, setUncontrolledBench] = useState<string>(
    defaultBenchmark ?? benchmarks[0]?.id ?? ""
  );
  const benchId = controlledBenchmark ?? uncontrolledBench;
  const activeBench =
    benchmarks.find((b) => b.id === benchId) ?? benchmarks[0] ?? null;
  const setBenchId = (id: string) => {
    if (controlledBenchmark === undefined) setUncontrolledBench(id);
    onBenchmarkChange?.(id);
  };

  const [uncontrolledMonthly, setUncontrolledMonthly] = useState<number>(defaultMonthlyTokens);
  const monthly = controlledMonthlyTokens ?? uncontrolledMonthly;
  const setMonthly = (val: number) => {
    if (controlledMonthlyTokens === undefined) setUncontrolledMonthly(val);
    onMonthlyTokensChange?.(val);
  };

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");

  const activePanel: "loading" | "error" | "details" | "compare" = loading
    ? "loading"
    : error
      ? "error"
      : view === "compare" && rival
        ? "compare"
        : "details";

  const estimateCost = (m: ModelInfo) =>
    monthly * (inputShare * m.pricing.input + (1 - inputShare) * m.pricing.output);

  const modelCost = estimateCost(model);
  const rivalCost = rival ? estimateCost(rival) : 0;

  const maxContext = useMemo(() => {
    return Math.max(model.contextWindow, ...validRivals.map((r) => r.contextWindow), 1);
  }, [model.contextWindow, validRivals]);

  const approxPages = Math.round(model.contextWindow / 667);

  // Benchmark rows: primary model + up to 2 rivals
  const barModels = useMemo(() => [model, ...validRivals.slice(0, 2)], [model, validRivals]);

  // Comparison tally calculation
  const comparison = useMemo(() => {
    if (!rival) return null;
    let aWins = 0;
    let bWins = 0;
    let total = 0;

    const record = (winner: "a" | "b" | null) => {
      total += 1;
      if (winner === "a") aWins += 1;
      if (winner === "b") bWins += 1;
    };

    // Context window
    const ctxWinner =
      model.contextWindow > rival.contextWindow
        ? "a"
        : rival.contextWindow > model.contextWindow
          ? "b"
          : null;
    record(ctxWinner);

    // Max output
    const outWinner =
      model.maxOutput > rival.maxOutput
        ? "a"
        : rival.maxOutput > model.maxOutput
          ? "b"
          : null;
    record(outWinner);

    // Knowledge cutoff
    const cutA = parseCutoffMonths(model.knowledgeCutoff);
    const cutB = parseCutoffMonths(rival.knowledgeCutoff);
    const cutDiff = cutA !== null && cutB !== null ? cutA - cutB : 0;
    const cutWinner = cutDiff > 0 ? "a" : cutDiff < 0 ? "b" : null;
    record(cutWinner);

    // Input price (lower is better)
    const inWinner =
      model.pricing.input < rival.pricing.input
        ? "a"
        : rival.pricing.input < model.pricing.input
          ? "b"
          : null;
    const inPct =
      inWinner === "a"
        ? Math.round(((rival.pricing.input - model.pricing.input) / rival.pricing.input) * 100)
        : inWinner === "b"
          ? Math.round(((model.pricing.input - rival.pricing.input) / model.pricing.input) * 100)
          : 0;
    record(inWinner);

    // Output price (lower is better)
    const outPWinner =
      model.pricing.output < rival.pricing.output
        ? "a"
        : rival.pricing.output < model.pricing.output
          ? "b"
          : null;
    const outPPct =
      outPWinner === "a"
        ? Math.round(((rival.pricing.output - model.pricing.output) / rival.pricing.output) * 100)
        : outPWinner === "b"
          ? Math.round(((model.pricing.output - rival.pricing.output) / model.pricing.output) * 100)
          : 0;
    record(outPWinner);

    // Monthly cost (lower is better)
    const costWinner =
      modelCost < rivalCost ? "a" : rivalCost < modelCost ? "b" : null;
    const costPct =
      costWinner === "a"
        ? Math.round(((rivalCost - modelCost) / rivalCost) * 100)
        : costWinner === "b"
          ? Math.round(((modelCost - rivalCost) / modelCost) * 100)
          : 0;
    record(costWinner);

    // Benchmarks
    const benchRows = benchmarks.map((b) => {
      const sa = model.scores[b.id];
      const sb = rival.scores[b.id];
      const w =
        sa !== undefined && sb !== undefined
          ? sa > sb
            ? ("a" as const)
            : sb > sa
              ? ("b" as const)
              : null
          : null;
      const diff =
        sa !== undefined && sb !== undefined ? Math.abs(sa - sb).toFixed(1) : "";
      record(w);
      return { bench: b, sa, sb, winner: w, diff };
    });

    return {
      aWins,
      bWins,
      total,
      ctxWinner,
      outWinner,
      cutWinner,
      cutDiff: Math.abs(cutDiff),
      inWinner,
      inPct,
      outPWinner,
      outPPct,
      costWinner,
      costPct,
      benchRows,
    };
  }, [model, rival, benchmarks, modelCost, rivalCost]);

  const panelTransition = {
    duration: reduced ? 0.01 : 0.18,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  const renderBetter = (active: boolean, deltaText: string) => (
    <span className={styles.betterSlot}>
      {active && (
        <span className={styles.better}>
          <Check size={14} strokeWidth={2.2} aria-hidden="true" />
          <span className={styles.srOnly}>, better by {deltaText}</span>
          {deltaText && (
            <span className={styles.delta} aria-hidden="true">
              {deltaText}
            </span>
          )}
        </span>
      )}
    </span>
  );

  return (
    <article
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
    >
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.identitySlot}>
          {loading ? (
            <div className={styles.identity}>
              <span className={styles.bone} style={{ width: 28, height: 28, borderRadius: 8 }} />
              <div className={styles.titles}>
                <span className={styles.bone} style={{ width: 140, height: 18 }} />
                <span className={styles.bone} style={{ width: 84, height: 14 }} />
              </div>
            </div>
          ) : (
            <div className={styles.identity}>
              {model.mark && (
                <span className={`${styles.mark} ${styles.headMark}`} aria-hidden="true">
                  <Swap valueKey={model.id} reduced={reduced}>
                    {model.mark}
                  </Swap>
                </span>
              )}
              <div className={styles.titles}>
                <h3 id={headingId} className={styles.name}>
                  <Swap valueKey={model.id} reduced={reduced}>
                    <span className={styles.ellipsis}>{model.name}</span>
                  </Swap>
                </h3>
                <p className={styles.provider}>
                  <Swap valueKey={model.id} reduced={reduced}>
                    <span className={styles.ellipsis}>{model.provider}</span>
                  </Swap>
                </p>
              </div>
            </div>
          )}
        </div>

        {validRivals.length > 0 && !loading && !error && (
          <div className={styles.compareSwitch}>
            <Switch
              label={labels?.compare ?? "Compare"}
              checked={view === "compare"}
              onCheckedChange={(checked: boolean) => {
                const next = checked ? "compare" : "details";
                setView(next);
                setLiveMsg(
                  next === "compare" && rival
                    ? `Comparing ${model.name} with ${rival.name}`
                    : `Showing ${model.name} details`
                );
              }}
            />
          </div>
        )}
      </header>

      {/* Stacked fixed-size stage */}
      <div className={styles.stage}>
        {/* Details Panel */}
        <motion.div
          className={`${styles.panel} ${styles.details}`}
          data-active={activePanel === "details" ? "" : undefined}
          animate={{ opacity: activePanel === "details" ? 1 : 0 }}
          initial={false}
          transition={panelTransition}
          // @ts-expect-error inert is supported in React 19
          inert={activePanel !== "details" ? "" : undefined}
          aria-hidden={activePanel !== "details" ? true : undefined}
        >
          <div className={styles.summary}>
            <Swap valueKey={model.id} block reduced={reduced}>
              {model.summary}
            </Swap>
          </div>

          <ul className={styles.chips} aria-label="Supported modalities">
            {ALL_MODALITIES.map((mod) => {
              const supported = model.modalities.includes(mod.key);
              return (
                <li
                  key={mod.key}
                  className={styles.chip}
                  data-off={supported ? undefined : ""}
                >
                  <span aria-hidden="true">{mod.icon}</span>
                  <span>{mod.label}</span>
                  <span className={styles.srOnly}>
                    {supported ? ", supported" : ", not supported"}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Limits */}
          <div className={styles.limits}>
            <dl className={styles.specs}>
              <div className={styles.spec}>
                <dt className={styles.specLabel}>Context window</dt>
                <dd className={styles.specValue}>
                  <RollingNumber
                    value={model.contextWindow}
                    format={formatTokens}
                    reduced={reduced}
                  />
                </dd>
              </div>
              <div className={styles.spec}>
                <dt className={styles.specLabel}>Max output</dt>
                <dd className={styles.specValue}>
                  <RollingNumber
                    value={model.maxOutput}
                    format={formatTokens}
                    reduced={reduced}
                  />
                </dd>
              </div>
              <div className={styles.spec}>
                <dt className={styles.specLabel}>Knowledge cutoff</dt>
                <dd className={styles.specValue}>
                  <Swap valueKey={`${model.id}-cut`} reduced={reduced}>
                    {model.knowledgeCutoff}
                  </Swap>
                </dd>
              </div>
            </dl>
            <div className={styles.contextRow}>
              <span className={`${styles.track} ${styles.contextTrack}`} data-primary="">
                <motion.span
                  className={styles.fill}
                  animate={{ scaleX: Math.min(1, model.contextWindow / maxContext) }}
                  initial={false}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: "spring", visualDuration: 0.35, bounce: 0 }
                  }
                />
              </span>
              <span className={styles.pages}>
                Fits about {approxPages.toLocaleString("en-US")} pages
              </span>
            </div>
          </div>

          {/* Pricing & Monthly Cost Estimator */}
          <div className={styles.section}>
            <dl className={styles.specs}>
              <div className={styles.spec}>
                <dt className={styles.specLabel}>Input per 1M</dt>
                <dd className={styles.specValue}>
                  <RollingNumber
                    value={model.pricing.input}
                    format={(v) => formatMoney(v, currency, 2)}
                    reduced={reduced}
                  />
                </dd>
              </div>
              <div className={styles.spec}>
                <dt className={styles.specLabel}>Output per 1M</dt>
                <dd className={styles.specValue}>
                  <RollingNumber
                    value={model.pricing.output}
                    format={(v) => formatMoney(v, currency, 2)}
                    reduced={reduced}
                  />
                </dd>
              </div>
              <div className={styles.spec}>
                <dt className={styles.specLabel}>Cached per 1M</dt>
                <dd className={styles.specValue}>
                  {model.pricing.cached !== undefined ? (
                    <RollingNumber
                      value={model.pricing.cached}
                      format={(v) => formatMoney(v, currency, 2)}
                      reduced={reduced}
                    />
                  ) : (
                    <span className={styles.missing}>—</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className={styles.estimator}>
              <div className={styles.slider}>
                <Slider
                  label="Monthly volume"
                  value={monthly}
                  onValueChange={(v) => setMonthly(Array.isArray(v) ? v[0] : v)}
                  min={10}
                  max={1000}
                  step={10}
                  largeStep={100}
                  showValue
                  format={(v) => `${v}M tokens`}
                />
              </div>
              <div className={styles.estimate}>
                <span className={styles.estimateLabel}>Estimated cost</span>
                <span className={styles.estimateValue}>
                  <RollingNumber
                    value={modelCost}
                    format={(v) => formatMoney(v, currency, 0)}
                    className={styles.costNumber}
                    reduced={reduced}
                  />
                  <span className={styles.unit}>/mo</span>
                </span>
              </div>
            </div>
          </div>

          {/* Benchmarks */}
          {benchmarks.length > 0 && activeBench && (
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <h4 className={styles.sectionTitle}>Benchmarks</h4>
                <div className={styles.benchTabs}>
                  <SegmentedControl
                    aria-label="Benchmark"
                    value={activeBench.id}
                    onValueChange={(v: string) => setBenchId(v)}
                    options={benchmarks.map((b) => ({ value: b.id, label: b.label }))}
                  />
                </div>
              </div>

              <ul
                className={styles.bars}
                data-hovering={hoveredRow ? "" : undefined}
                onPointerLeave={() => setHoveredRow(null)}
              >
                {barModels.map((bm) => {
                  const raw = bm.scores[activeBench.id];
                  const maxVal = activeBench.max ?? 100;
                  const ratio = raw !== undefined ? Math.max(0, Math.min(1, raw / maxVal)) : 0;
                  const isPrimary = bm.id === model.id;
                  const isActive = hoveredRow === bm.id;

                  return (
                    <li
                      key={bm.id}
                      tabIndex={0}
                      className={styles.barRow}
                      data-primary={isPrimary ? "" : undefined}
                      data-active={isActive ? "" : undefined}
                      onPointerEnter={() => setHoveredRow(bm.id)}
                      onFocus={() => setHoveredRow(bm.id)}
                      onBlur={() => setHoveredRow(null)}
                    >
                      <span className={styles.mark} aria-hidden="true">
                        {bm.mark}
                      </span>
                      <span className={styles.barName}>
                        <span className={styles.ellipsis}>{bm.name}</span>
                      </span>
                      <span className={styles.track} data-primary={isPrimary ? "" : undefined}>
                        <motion.span
                          className={styles.fill}
                          animate={{ scaleX: activePanel === "details" ? ratio : 0 }}
                          initial={false}
                          transition={
                            reduced
                              ? { duration: 0 }
                              : { type: "spring", visualDuration: 0.36, bounce: 0 }
                          }
                        />
                      </span>
                      <span className={styles.score}>
                        {raw !== undefined ? (
                          <>
                            <RollingNumber
                              value={raw}
                              format={(v) => v.toFixed(1)}
                              reduced={reduced}
                            />
                            <span className={styles.unit}>{activeBench.unit ?? "%"}</span>
                          </>
                        ) : (
                          <span className={styles.missing}>—</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className={styles.readout}>
                {activeBench.description}
                {sample ? " Prices and scores are samples, not official." : ""}
              </p>
            </div>
          )}
        </motion.div>

        {/* Compare Panel */}
        {rival && comparison && (
          <motion.div
            className={`${styles.panel} ${styles.compare}`}
            data-active={activePanel === "compare" ? "" : undefined}
            animate={{ opacity: activePanel === "compare" ? 1 : 0 }}
            initial={false}
            transition={panelTransition}
            // @ts-expect-error inert is supported in React 19
            inert={activePanel !== "compare" ? "" : undefined}
            aria-hidden={activePanel !== "compare" ? true : undefined}
          >
            <div className={styles.cmpTable} role="table" aria-label="Model comparison">
              {/* Header row */}
              <div className={`${styles.cmpRow} ${styles.cmpHead}`} role="row">
                <span className={styles.cmpCorner} role="columnheader">
                  Metric
                </span>
                <div className={styles.cmpModel} role="columnheader">
                  {model.mark && (
                    <span className={`${styles.mark} ${styles.cmpMark}`} aria-hidden="true">
                      {model.mark}
                    </span>
                  )}
                  <span className={styles.ellipsis}>{model.name}</span>
                </div>
                <div className={styles.picker} role="columnheader">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" className={styles.pickerTrigger}>
                        {rival.mark && (
                          <span className={`${styles.mark} ${styles.cmpMark}`} aria-hidden="true">
                            {rival.mark}
                          </span>
                        )}
                        <span className={styles.ellipsis}>{rival.name}</span>
                        <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className={styles.pickerMenu}
                        sideOffset={6}
                        align="start"
                      >
                        {validRivals.map((cand) => (
                          <DropdownMenu.Item
                            key={cand.id}
                            className={styles.pickerItem}
                            onSelect={() => {
                              setCompareId(cand.id);
                              setLiveMsg(`Comparing ${model.name} with ${cand.name}`);
                            }}
                          >
                            {cand.mark && (
                              <span className={`${styles.mark} ${styles.cmpMark}`} aria-hidden="true">
                                {cand.mark}
                              </span>
                            )}
                            <span className={styles.ellipsis}>{cand.name}</span>
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>

              {/* Modalities */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Modalities
                </span>
                {[model, rival].map((m) => (
                  <div key={m.id} className={styles.cmpCell} role="cell">
                    <span className={styles.modIcons} aria-hidden="true">
                      {ALL_MODALITIES.map((mod) => (
                        <span
                          key={mod.key}
                          style={{ display: "inline-flex" }}
                          data-off={m.modalities.includes(mod.key) ? undefined : ""}
                        >
                          {mod.icon}
                        </span>
                      ))}
                    </span>
                    <span className={styles.srOnly}>
                      {ALL_MODALITIES.filter((mod) => m.modalities.includes(mod.key))
                        .map((mod) => mod.label)
                        .join(", ")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Context window */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Context window
                </span>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.ctxWinner === "a" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>{formatTokens(model.contextWindow)}</span>
                  {renderBetter(
                    comparison.ctxWinner === "a",
                    `${(model.contextWindow / Math.max(rival.contextWindow, 1)).toFixed(1)}×`
                  )}
                </div>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.ctxWinner === "b" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>{formatTokens(rival.contextWindow)}</span>
                  {renderBetter(
                    comparison.ctxWinner === "b",
                    `${(rival.contextWindow / Math.max(model.contextWindow, 1)).toFixed(1)}×`
                  )}
                </div>
              </div>

              {/* Max output */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Max output
                </span>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.outWinner === "a" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>{formatTokens(model.maxOutput)}</span>
                  {renderBetter(
                    comparison.outWinner === "a",
                    `${(model.maxOutput / Math.max(rival.maxOutput, 1)).toFixed(1)}×`
                  )}
                </div>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.outWinner === "b" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>{formatTokens(rival.maxOutput)}</span>
                  {renderBetter(
                    comparison.outWinner === "b",
                    `${(rival.maxOutput / Math.max(model.maxOutput, 1)).toFixed(1)}×`
                  )}
                </div>
              </div>

              {/* Knowledge cutoff */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Knowledge cutoff
                </span>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.cutWinner === "a" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>{model.knowledgeCutoff}</span>
                  {renderBetter(comparison.cutWinner === "a", `+${comparison.cutDiff} mo`)}
                </div>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.cutWinner === "b" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>{rival.knowledgeCutoff}</span>
                  {renderBetter(comparison.cutWinner === "b", `+${comparison.cutDiff} mo`)}
                </div>
              </div>

              {/* Input price */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Input price
                </span>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.inWinner === "a" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>
                    {formatMoney(model.pricing.input, currency, 2)}
                  </span>
                  {renderBetter(comparison.inWinner === "a", `${comparison.inPct}%`)}
                </div>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.inWinner === "b" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>
                    {formatMoney(rival.pricing.input, currency, 2)}
                  </span>
                  {renderBetter(comparison.inWinner === "b", `${comparison.inPct}%`)}
                </div>
              </div>

              {/* Output price */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Output price
                </span>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.outPWinner === "a" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>
                    {formatMoney(model.pricing.output, currency, 2)}
                  </span>
                  {renderBetter(comparison.outPWinner === "a", `${comparison.outPPct}%`)}
                </div>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.outPWinner === "b" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>
                    {formatMoney(rival.pricing.output, currency, 2)}
                  </span>
                  {renderBetter(comparison.outPWinner === "b", `${comparison.outPPct}%`)}
                </div>
              </div>

              {/* Cost at monthly volume */}
              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">
                  Cost at {monthly}M/mo
                </span>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.costWinner === "a" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>
                    {formatMoney(modelCost, currency, 0)}
                  </span>
                  {renderBetter(comparison.costWinner === "a", `${comparison.costPct}%`)}
                </div>
                <div
                  className={styles.cmpCell}
                  data-better={comparison.costWinner === "b" ? "" : undefined}
                  role="cell"
                >
                  <span className={styles.cmpValue}>
                    {formatMoney(rivalCost, currency, 0)}
                  </span>
                  {renderBetter(comparison.costWinner === "b", `${comparison.costPct}%`)}
                </div>
              </div>

              {/* Benchmark rows */}
              {comparison.benchRows.map(({ bench, sa, sb, winner, diff }) => {
                const maxV = bench.max ?? 100;
                return (
                  <div key={bench.id} className={styles.cmpRow} role="row">
                    <span className={styles.cmpLabel} role="rowheader">
                      {bench.label}
                    </span>
                    <div
                      className={styles.cmpCell}
                      data-better={winner === "a" ? "" : undefined}
                      role="cell"
                    >
                      <span className={styles.cmpScore}>
                        <span className={styles.number}>
                          {sa !== undefined ? `${sa.toFixed(1)}${bench.unit ?? "%"}` : "—"}
                        </span>
                        <span className={`${styles.track} ${styles.miniTrack}`} data-primary={winner === "a" ? "" : undefined}>
                          <motion.span
                            className={styles.fill}
                            animate={{ scaleX: sa !== undefined ? sa / maxV : 0 }}
                            initial={false}
                            transition={{ duration: reduced ? 0 : 0.3 }}
                          />
                        </span>
                      </span>
                      {renderBetter(winner === "a", `+${diff}`)}
                    </div>
                    <div
                      className={styles.cmpCell}
                      data-better={winner === "b" ? "" : undefined}
                      role="cell"
                    >
                      <span className={styles.cmpScore}>
                        <span className={styles.number}>
                          {sb !== undefined ? `${sb.toFixed(1)}${bench.unit ?? "%"}` : "—"}
                        </span>
                        <span className={`${styles.track} ${styles.miniTrack}`} data-primary={winner === "b" ? "" : undefined}>
                          <motion.span
                            className={styles.fill}
                            animate={{ scaleX: sb !== undefined ? sb / maxV : 0 }}
                            initial={false}
                            transition={{ duration: reduced ? 0 : 0.3 }}
                          />
                        </span>
                      </span>
                      {renderBetter(winner === "b", `+${diff}`)}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className={styles.tally}>
              {comparison.aWins === comparison.bWins
                ? `${model.name} and ${rival.name} tie at ${comparison.aWins} of ${comparison.total} each.`
                : comparison.aWins > comparison.bWins
                  ? `${model.name} leads on ${comparison.aWins} of ${comparison.total}, ${rival.name} on ${comparison.bWins}.`
                  : `${rival.name} leads on ${comparison.bWins} of ${comparison.total}, ${model.name} on ${comparison.aWins}.`}
            </p>
            <p className={styles.caption}>
              Prices per 1M tokens. Cost assumes {Math.round(inputShare * 100)}% input. A check
              marks the better value.{sample ? " Sample figures, not official." : ""}
            </p>
          </motion.div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className={`${styles.panel} ${styles.skeleton}`} data-active="">
            <div className={styles.boneLines}>
              <span className={styles.bone} style={{ width: "92%", height: 14 }} />
              <span className={styles.bone} style={{ width: "68%", height: 14 }} />
            </div>
            <div className={styles.boneRow}>
              {[58, 66, 52, 62, 60, 58, 84].map((w, i) => (
                <span
                  key={i}
                  className={styles.bone}
                  style={{ width: w, height: 28, borderRadius: 999 }}
                />
              ))}
            </div>
            <div className={styles.boneGrid}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.boneCell}>
                  <span className={styles.bone} style={{ width: "60%", height: 12 }} />
                  <span className={styles.bone} style={{ width: "80%", height: 16 }} />
                </div>
              ))}
            </div>
            <div className={styles.boneGrid}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.boneCell}>
                  <span className={styles.bone} style={{ width: "60%", height: 12 }} />
                  <span className={styles.bone} style={{ width: "55%", height: 16 }} />
                </div>
              ))}
            </div>
            <div>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.boneBar}>
                  <span className={styles.bone} style={{ width: 16, height: 16, borderRadius: 4 }} />
                  <span className={styles.bone} style={{ width: 110, height: 13 }} />
                  <span className={styles.bone} style={{ flex: 1, height: 6 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error panel */}
        {error && !loading && (
          <div className={`${styles.panel} ${styles.error}`} data-active="" role="alert">
            <AlertCircle size={18} className={styles.errorIcon} aria-hidden="true" />
            <div className={styles.errorText}>
              <p className={styles.errorTitle}>{labels?.errorTitle ?? "Couldn't load model details"}</p>
              <p className={styles.errorMessage}>{error}</p>
            </div>
            {onRetry && (
              <button type="button" className={styles.retryBtn} onClick={onRetry}>
                {labels?.retry ?? "Retry"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerSlot}>
          {loading ? (
            <div className={styles.footerRow}>
              <span className={styles.bone} style={{ width: 140, height: 16 }} />
              <span className={styles.bone} style={{ width: 110, height: 32 }} />
            </div>
          ) : (
            <div className={styles.footerRow}>
              <code className={styles.modelId}>
                <Swap valueKey={model.id} reduced={reduced}>
                  <span className={styles.ellipsis}>{model.id}</span>
                </Swap>
              </code>
              <div className={styles.actions}>
                <CopyButton
                  value={model.id}
                  label="Copy model id"
                  onCopied={() => onCopyId?.(model.id)}
                />
                {onSelect && (
                  <button
                    type="button"
                    className={styles.selectBtn}
                    data-selected={selected ? "" : undefined}
                    onClick={() => onSelect(model)}
                  >
                    <span className={styles.selectSlot}>
                      <span data-on={!selected ? "" : undefined}>
                        {labels?.select ?? "Use model"}
                      </span>
                      <span data-on={selected ? "" : undefined}>
                        <Check size={14} strokeWidth={2.2} aria-hidden="true" />
                        {labels?.selected ?? "Selected"}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {liveMsg}
      </span>
    </article>
  );
}

export default ModelCard;
