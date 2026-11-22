"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import styles from "./model-training.module.css";

export interface ModelTrainingStep {
  title: string;
  caption: string;
}

export interface ModelTrainingLabels {
  trainingSet?: string;
  heldOutSet?: string;
  unit?: string;
  inputLayer?: string;
  hiddenLayer?: string;
  outputLayer?: string;
  loss?: string;
  epoch?: string;
  evaluation?: string;
  target?: string;
  waiting?: string;
  running?: string;
  passed?: string;
}

export interface ModelTrainingProps {
  classes?: string[];
  inputs?: number;
  hiddenLayers?: number[];
  samples?: number;
  heldOutSamples?: number;
  batchSize?: number;
  epochs?: number;
  lossRange?: [number, number];
  accuracy?: number;
  target?: number;
  labels?: ModelTrainingLabels;
  steps?: ModelTrainingStep[];
  defaultStep?: number;
  caption?: boolean;
  controls?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_STEPS: ModelTrainingStep[] = [
  {
    title: "Batch",
    caption:
      "A batch of 32 labeled reviews leaves the training set. Each feature feeds one input.",
  },
  {
    title: "Forward",
    caption:
      "Signals flow through the hidden layers, combining weights into class probabilities.",
  },
  {
    title: "Backward",
    caption:
      "Prediction error propagates backward, nudging each connection to reduce loss.",
  },
  {
    title: "Converge",
    caption:
      "Across epochs, useful pathways strengthen while training loss curves steadily down.",
  },
  {
    title: "Evaluate",
    caption:
      "Unseen held-out reviews run through the trained model to verify target accuracy.",
  },
];

// Deterministic pseudo-random helper so SSR and client match cleanly
function seeded(i: number, j: number, l: number): number {
  const x = Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233 + (l + 1) * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

const STAGE_DURATION = 2.8; // seconds per stage at 1x speed

export function ModelTraining({
  classes = ["Positive", "Negative"],
  inputs = 4,
  hiddenLayers = [5, 4],
  samples = 12800,
  heldOutSamples = 1600,
  batchSize = 32,
  epochs = 12,
  lossRange = [0.69, 0.16],
  accuracy = 0.94,
  target = 0.9,
  labels,
  steps = DEFAULT_STEPS,
  defaultStep = 0,
  caption = true,
  controls = true,
  speed = 1,
  paused: controlledPaused,
  accent,
  label = "Neural network training diagram showing batches flowing from the training set through input, hidden, and output layers, error backpropagation, loss curve convergence, and held-out evaluation",
  className,
  style,
}: ModelTrainingProps) {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(640);
  const [internalPaused, setInternalPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);

  const isPaused = (controlledPaused ?? internalPaused) || hoverPaused || reduced;

  const totalSteps = Math.max(1, steps.length);
  const [timeline, setTimeline] = useState(() =>
    Math.max(0, Math.min(totalSteps - 0.01, defaultStep + (reduced ? 0.55 : 0)))
  );

  // Measure container width for responsive SVG layout
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setStageWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Single rAF loop
  useEffect(() => {
    if (isPaused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setTimeline((prev) => {
        const next = prev + (dt * speed) / STAGE_DURATION;
        return next >= totalSteps ? next - totalSteps : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPaused, speed, totalSteps]);

  const stepIndex = Math.min(totalSteps - 1, Math.floor(timeline));
  const stepProgress = timeline - stepIndex;

  // Overall learning progress 0..1 across stages 0..4
  const learnProgress = useMemo(() => {
    if (stepIndex === 0) return 0;
    if (stepIndex === 1) return 0.08 * stepProgress;
    if (stepIndex === 2) return 0.08 + 0.16 * stepProgress;
    if (stepIndex === 3) return 0.24 + 0.76 * stepProgress;
    return 1;
  }, [stepIndex, stepProgress]);

  const currentEpoch = Math.min(epochs, Math.round(learnProgress * epochs));
  const [lossStart, lossEnd] = lossRange;
  const currentLoss =
    lossEnd + (lossStart - lossEnd) * Math.exp(-3.2 * learnProgress);

  const evalState: "waiting" | "running" | "passed" =
    stepIndex < 4
      ? "waiting"
      : stepProgress < 0.65
        ? "running"
        : "passed";

  // Class probabilities converge as model trains
  const primaryProb =
    stepIndex === 0
      ? 0.5
      : 0.5 + (accuracy - 0.5) * Math.min(1, learnProgress * 1.15);
  const probs = classes.map((_, idx) => {
    if (idx === 0) return primaryProb;
    const rem = Math.max(0, 1 - primaryProb);
    return rem / Math.max(1, classes.length - 1);
  });

  // Geometry
  const narrow = stageWidth < 460;
  const vbW = narrow ? 380 : 620;
  const vbH = narrow ? 370 : 310;

  const layers = useMemo(
    () => [inputs, ...hiddenLayers, classes.length],
    [inputs, hiddenLayers, classes.length]
  );

  const layout = useMemo(() => {
    const netLeft = narrow ? 36 : 168;
    const netRight = narrow ? 286 : 492;
    const netTop = narrow ? 104 : 46;
    const netBottom = narrow ? 334 : 268;
    const layerCount = layers.length;

    const nodes = layers.map((count, lIdx) => {
      const x =
        layerCount === 1
          ? (netLeft + netRight) / 2
          : netLeft + ((netRight - netLeft) * lIdx) / (layerCount - 1);
      const span = netBottom - netTop;
      const stepY = span / Math.max(count, 1);
      const pts = Array.from({ length: count }, (_, nIdx) => ({
        x,
        y: netTop + stepY * (nIdx + 0.5),
      }));
      return { x, pts };
    });

    const edges: {
      l: number;
      i: number;
      j: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      strength: number;
    }[] = [];

    for (let l = 0; l < nodes.length - 1; l++) {
      const from = nodes[l].pts;
      const to = nodes[l + 1].pts;
      for (let i = 0; i < from.length; i++) {
        for (let j = 0; j < to.length; j++) {
          edges.push({
            l,
            i,
            j,
            x1: from[i].x,
            y1: from[i].y,
            x2: to[j].x,
            y2: to[j].y,
            strength: seeded(i, j, l),
          });
        }
      }
    }

    return { nodes, edges, netLeft, netRight, netTop, netBottom };
  }, [layers, narrow]);

  // Loss curve points
  const chartPoints = useMemo(() => {
    const count = 24;
    const w = 196;
    const h = 72;
    const padX = 8;
    const padY = 8;
    const maxPts = Math.max(2, Math.round(learnProgress * count));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= maxPts; i++) {
      const u = i / count;
      const l = lossEnd + (lossStart - lossEnd) * Math.exp(-3.2 * u);
      const norm = (l - lossEnd) / Math.max(0.01, lossStart - lossEnd);
      const x = padX + u * (w - padX * 2);
      const y = padY + (1 - norm) * (h - padY * 2);
      // Invert Y so higher loss is at top
      pts.push({ x, y: h - y + padY });
    }
    return { pts, w, h, padX, padY };
  }, [learnProgress, lossStart, lossEnd]);

  const chartPath = chartPoints.pts
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const lastPt = chartPoints.pts[chartPoints.pts.length - 1];

  const unitWord = labels?.unit ?? "reviews";
  const lossStatus =
    stepIndex === 0
      ? "Waiting for a batch"
      : stepIndex === 1
        ? "Forward pass"
        : stepIndex === 2
          ? "Updating weights"
          : stepIndex === 3
            ? "Converging"
            : evalState === "passed"
              ? `Held-out ${Math.round(accuracy * 100)}%`
              : "Evaluating held-out set";

  // Coordinates for Training / Held-out stacks
  const trainStackPos = narrow ? { x: 24, y: 18 } : { x: 22, y: 66 };
  const heldStackPos = narrow ? { x: 204, y: 18 } : { x: 22, y: 186 };

  const activeStep = steps[stepIndex] ?? steps[0];

  const selectStep = (idx: number) => {
    setTimeline(idx + (reduced ? 0.55 : 0.02));
  };

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{
        ...(accent ? ({ "--mt-accent": accent } as CSSProperties) : undefined),
        ...style,
      }}
      onPointerEnter={() => setHoverPaused(true)}
      onPointerLeave={() => setHoverPaused(false)}
    >
      <div className={styles.body}>
        {/* Neural network SVG stage */}
        <div
          ref={stageRef}
          className={styles.stage}
          role="img"
          aria-label={label}
        >
          <svg
            className={styles.svg}
            viewBox={`0 0 ${vbW} ${vbH}`}
            aria-hidden="true"
          >
            {/* Layer headings */}
            {layout.nodes.map((layer, lIdx) => {
              const title =
                lIdx === 0
                  ? labels?.inputLayer ?? "Input"
                  : lIdx === layout.nodes.length - 1
                    ? labels?.outputLayer ?? "Output"
                    : labels?.hiddenLayer ?? "Hidden";
              return (
                <text
                  key={`lh-${lIdx}`}
                  x={layer.x}
                  y={narrow ? 88 : 26}
                  textAnchor="middle"
                  className={styles.layerLabel}
                >
                  {title}
                </text>
              );
            })}

            {/* Training set stack */}
            <g transform={`translate(${trainStackPos.x}, ${trainStackPos.y})`}>
              <rect x={8} y={6} width={96} height={54} rx={8} className={styles.stackCard} opacity={0.5} />
              <rect x={4} y={3} width={96} height={54} rx={8} className={styles.stackCard} opacity={0.75} />
              <rect x={0} y={0} width={96} height={54} rx={8} className={styles.stackCard} />
              <line x1={12} y1={16} x2={54} y2={16} className={styles.stackLine} />
              <line x1={12} y1={26} x2={76} y2={26} className={styles.stackLine} />
              <line x1={12} y1={36} x2={42} y2={36} className={styles.stackLine} />
              <text x={0} y={74} className={styles.stackTitle}>
                {labels?.trainingSet ?? "Training set"}
              </text>
              <text x={0} y={89} className={styles.stackSub}>
                {samples.toLocaleString("en-US")} {unitWord}
              </text>
            </g>

            {/* Held-out set stack */}
            <g transform={`translate(${heldStackPos.x}, ${heldStackPos.y})`}>
              <rect x={6} y={4} width={96} height={50} rx={8} className={styles.stackCardHeldout} opacity={0.6} />
              <rect x={0} y={0} width={96} height={50} rx={8} className={styles.stackCardHeldout} />
              <line x1={12} y1={16} x2={60} y2={16} className={styles.stackLine} />
              <line x1={12} y1={26} x2={44} y2={26} className={styles.stackLine} />
              <text x={0} y={69} className={styles.stackTitle}>
                {labels?.heldOutSet ?? "Held-out set"}
              </text>
              <text x={0} y={84} className={styles.stackSub}>
                {heldOutSamples.toLocaleString("en-US")} {unitWord}
              </text>
            </g>

            {/* Base edges */}
            {layout.edges.map((e) => {
              const learnedWeight =
                e.strength > 0.45 ? learnProgress * e.strength : learnProgress * 0.12;
              const strokeWidth = 0.85 + learnedWeight * 1.45;
              return (
                <line
                  key={`e-${e.l}-${e.i}-${e.j}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  strokeWidth={strokeWidth}
                  className={styles.edge}
                  style={{ "--w": learnedWeight.toFixed(3) } as CSSProperties}
                />
              );
            })}

            {/* Batch flight packets (stage 0) */}
            {stepIndex === 0 &&
              layout.nodes[0].pts.map((pt, idx) => {
                const t = Math.max(0, Math.min(1, stepProgress * 1.35 - idx * 0.08));
                const sx = trainStackPos.x + 96;
                const sy = trainStackPos.y + 27;
                const px = sx + (pt.x - sx) * t;
                const py = sy + (pt.y - sy) * t;
                return (
                  <g key={`bp-${idx}`}>
                    <line
                      x1={sx}
                      y1={sy}
                      x2={px}
                      y2={py}
                      className={styles.forward}
                      strokeWidth={1.6}
                      opacity={0.45}
                    />
                    <circle cx={px} cy={py} r={3.5} className={styles.packet} />
                  </g>
                );
              })}

            {/* Forward signal ripple (stages 1, 3, 4) */}
            {(stepIndex === 1 || stepIndex === 3 || (stepIndex === 4 && evalState === "running")) &&
              layout.edges.map((e) => {
                const segCount = layout.nodes.length - 1;
                const wave =
                  stepIndex === 3
                    ? (stepProgress * 3) % 1
                    : stepProgress;
                const segStart = e.l / segCount;
                const segEnd = (e.l + 1) / segCount;
                const localT = (wave - segStart) / (segEnd - segStart);
                if (localT < 0 || localT > 1 || e.strength < 0.35) return null;
                const px = e.x1 + (e.x2 - e.x1) * localT;
                const py = e.y1 + (e.y2 - e.y1) * localT;
                return (
                  <circle
                    key={`fp-${e.l}-${e.i}-${e.j}`}
                    cx={px}
                    cy={py}
                    r={2.4}
                    className={stepIndex === 4 ? styles.packetEval : styles.packet}
                    opacity={0.9}
                  />
                );
              })}

            {/* Held-out flight into inputs (stage 4 running) */}
            {stepIndex === 4 &&
              evalState === "running" &&
              layout.nodes[0].pts.map((pt, idx) => {
                const t = Math.min(1, (stepProgress * 2.2) % 1);
                const sx = heldStackPos.x + 96;
                const sy = heldStackPos.y + 25;
                const px = sx + (pt.x - sx) * t;
                const py = sy + (pt.y - sy) * t;
                return (
                  <circle
                    key={`ep-${idx}`}
                    cx={px}
                    cy={py}
                    r={3}
                    className={styles.packetEval}
                  />
                );
              })}

            {/* Backward error propagation (stage 2) */}
            {stepIndex === 2 &&
              layout.edges.map((e) => {
                const segCount = layout.nodes.length - 1;
                const revLayer = segCount - 1 - e.l;
                const segStart = revLayer / segCount;
                const segEnd = (revLayer + 1) / segCount;
                const localT = (stepProgress - segStart) / (segEnd - segStart);
                if (localT < 0 || localT > 1 || e.strength < 0.4) return null;
                const px = e.x2 + (e.x1 - e.x2) * localT;
                const py = e.y2 + (e.y1 - e.y2) * localT;
                return (
                  <g key={`bw-${e.l}-${e.i}-${e.j}`}>
                    <line
                      x1={e.x2}
                      y1={e.y2}
                      x2={px}
                      y2={py}
                      className={styles.backward}
                      strokeWidth={1.6}
                      opacity={0.75}
                    />
                    <circle cx={px} cy={py} r={2.5} fill="var(--danger)" />
                  </g>
                );
              })}

            {/* Network nodes */}
            {layout.nodes.map((layer, lIdx) =>
              layer.pts.map((pt, nIdx) => {
                const segCount = layout.nodes.length;
                const forwardHit =
                  (stepIndex === 1 && Math.floor(stepProgress * segCount) === lIdx) ||
                  (stepIndex === 0 && lIdx === 0 && stepProgress > 0.6) ||
                  (stepIndex === 3 && learnProgress > 0.3 && (lIdx + nIdx) % 2 === 0);
                const backwardHit =
                  stepIndex === 2 &&
                  segCount - 1 - Math.floor(stepProgress * segCount) === lIdx;

                return (
                  <circle
                    key={`n-${lIdx}-${nIdx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={narrow ? 6.5 : 8}
                    className={[
                      styles.node,
                      backwardHit
                        ? styles.nodeError
                        : forwardHit
                          ? styles.nodeActive
                          : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                );
              })
            )}

            {/* Output class labels and probability bars */}
            {layout.nodes[layout.nodes.length - 1].pts.map((pt, idx) => {
              const prob = probs[idx] ?? 0;
              const labelX = pt.x + (narrow ? 14 : 18);
              const barW = narrow ? 62 : 94;
              return (
                <g key={`out-${idx}`} transform={`translate(${labelX}, ${pt.y - 12})`}>
                  <text x={0} y={10} className={styles.className}>
                    {classes[idx]}
                  </text>
                  <text
                    x={barW}
                    y={10}
                    textAnchor="end"
                    className={styles.classProb}
                  >
                    {prob.toFixed(2)}
                  </text>
                  <rect
                    x={0}
                    y={16}
                    width={barW}
                    height={5}
                    rx={2.5}
                    className={styles.probTrack}
                  />
                  <rect
                    x={0}
                    y={16}
                    width={Math.max(3, barW * prob)}
                    height={5}
                    rx={2.5}
                    className={styles.probFill}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Readout panel */}
        <aside className={styles.panel} aria-label="Training metrics">
          <div className={styles.stats}>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{labels?.loss ?? "Loss"}</span>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{currentLoss.toFixed(2)}</span>
              </div>
              <span className={styles.statNote}>{lossStatus}</span>
            </div>

            <div className={styles.chartWrap}>
              <svg
                className={styles.chartSvg}
                viewBox={`0 0 ${chartPoints.w} ${chartPoints.h + 10}`}
                aria-hidden="true"
              >
                <line
                  x1={chartPoints.padX}
                  y1={20}
                  x2={chartPoints.w - chartPoints.padX}
                  y2={20}
                  className={styles.chartGrid}
                />
                <line
                  x1={chartPoints.padX}
                  y1={46}
                  x2={chartPoints.w - chartPoints.padX}
                  y2={46}
                  className={styles.chartGrid}
                />
                <line
                  x1={chartPoints.padX}
                  y1={chartPoints.h}
                  x2={chartPoints.w - chartPoints.padX}
                  y2={chartPoints.h}
                  className={styles.chartAxis}
                />
                {chartPoints.pts.length > 1 && (
                  <path d={chartPath} className={styles.chartLine} />
                )}
                {lastPt && (
                  <circle cx={lastPt.x} cy={lastPt.y} r={3.5} className={styles.chartHead} />
                )}
                {evalState === "passed" && lastPt && (
                  <circle cx={lastPt.x} cy={lastPt.y - 6} r={3.5} className={styles.chartVal} />
                )}
              </svg>
            </div>

            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{labels?.epoch ?? "Epoch"}</span>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{currentEpoch}</span>
                <span className={styles.statUnit}>of {epochs}</span>
              </div>
            </div>
          </div>

          <div className={styles.evalRow}>
            <div className={styles.evalHead}>
              <span className={styles.evalTitle}>
                {labels?.evaluation ?? "Evaluation"}
              </span>
              <span className={styles.evalTarget}>
                {labels?.target ?? "Target"} {Math.round(target * 100)}%
              </span>
            </div>
            <div className={styles.evalStates}>
              {(["waiting", "running", "passed"] as const).map((state) => {
                const text =
                  state === "waiting"
                    ? labels?.waiting ?? "Waiting"
                    : state === "running"
                      ? labels?.running ?? "Running"
                      : labels?.passed ?? "Passed";
                return (
                  <span
                    key={state}
                    className={styles.evalBadge}
                    data-active={evalState === state ? state : undefined}
                  >
                    <span className={styles.evalDot} aria-hidden="true" />
                    <span>{text}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {controls && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.playBtn}
            aria-label={isPaused ? "Play animation" : "Pause animation"}
            aria-pressed={isPaused}
            onClick={() => setInternalPaused((p) => !p)}
          >
            {isPaused ? (
              <Play size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Pause size={14} strokeWidth={2} aria-hidden="true" />
            )}
          </button>

          <div className={styles.steps} role="group" aria-label="Training stages">
            {steps.map((s, idx) => {
              const current = idx === stepIndex;
              const fill =
                idx < stepIndex ? 1 : current ? stepProgress : 0;
              return (
                <button
                  key={s.title}
                  type="button"
                  className={styles.stepBtn}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Step ${idx + 1}: ${s.title}`}
                  onClick={() => selectStep(idx)}
                >
                  <span className={styles.stepHeader}>
                    <span className={styles.stepNum}>{idx + 1}</span>
                    <span className={styles.stepName}>{s.title}</span>
                  </span>
                  <span className={styles.stepTrack} aria-hidden="true">
                    <span
                      className={styles.stepFill}
                      style={{ transform: `scaleX(${fill})` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {caption && activeStep && (
        <p className={styles.caption}>
          <span className={styles.captionLead}>{activeStep.title}.</span>{" "}
          {activeStep.caption.replace("32", String(batchSize))}
        </p>
      )}
    </div>
  );
}

export default ModelTraining;
