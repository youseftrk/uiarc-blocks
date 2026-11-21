"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleAlert, CircleSlash, Clock3, FlaskConical, Info, Pause, Play, Rocket, RotateCcw, Save, TriangleAlert, X } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { useReducedMotion } from "../use-reduced-motion";
import { HuggingFaceMark, QwenColorMark } from "./marks";
import styles from "./training-run.module.css";

export { HuggingFaceMark, QwenColorMark };

export type TrainingRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type TrainingEventKind = "start" | "checkpoint" | "eval" | "epoch" | "info" | "warning" | "error" | "done";
export type TrainingRunScenario = "healthy" | "oom";
export interface TrainingLossSample { step: number; train?: number; val?: number }
export interface TrainingEvent { id: string; kind: TrainingEventKind; label: string; step?: number }
export interface TrainingMetric { label: string; value: string; hint?: string }

export interface TrainingRunProps {
  /** Where the job is. Leave it out to play the built in simulation. */
  status?: TrainingRunStatus;
  name?: string;
  model?: { name: string; mark?: ReactNode };
  details?: string[];
  dataset?: { name: string; examples?: number; mark?: ReactNode };
  step?: number;
  totalSteps?: number;
  epochs?: number;
  loss?: TrainingLossSample[];
  learningRate?: number;
  elapsed?: number;
  eta?: number;
  events?: TrainingEvent[];
  metrics?: TrainingMetric[];
  activity?: string;
  error?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRestart?: () => void;
  onDeploy?: (signal: AbortSignal) => Promise<{ endpoint?: string } | void>;
  notice?: string;
  /** Demo only, when status is left out. */
  scenario?: TrainingRunScenario;
  className?: string;
}

const number = new Intl.NumberFormat("en-US");
const two = (value: number) => String(value).padStart(2, "0");

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m ${two(total % 60)}s`;
  return `${Math.floor(total / 3600)}h ${two(Math.floor((total % 3600) / 60))}m`;
}

function formatRate(rate: number) {
  if (!rate) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(rate)));
  let mantissa = rate / 10 ** exponent;
  let power = exponent;
  if (Number(mantissa.toFixed(2)) >= 10) { mantissa /= 10; power += 1; }
  return `${mantissa.toFixed(2)}e${power < 0 ? "-" : "+"}${Math.abs(power)}`;
}

const formatLoss = (value: number | undefined) => (value === undefined ? "0.000" : value.toFixed(3));

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

const SIM_TOTAL = 1860;
const SIM_EPOCHS = 3;
const SIM_SECONDS_PER_STEP = 1120 / SIM_TOTAL;
const SIM_STEPS_PER_MS = 0.133;
const SIM_QUEUE_MS = 1250;
const SIM_START_MS = 900;
const SIM_OOM_STEP = 940;
const SIM_ENDPOINT = "ft:qwen3.8-max:arcwork:support-triage-v3";
const SIM_SUFFIX = "Simulated, nothing was sent.";

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIM_LOSS: TrainingLossSample[] = (() => {
  const random = seeded(18);
  const samples: TrainingLossSample[] = [];
  for (let step = 0; step <= SIM_TOTAL; step += 5) {
    const base = 0.262 + 1.773 * Math.exp(-step / 308);
    const noise = (random() - 0.5) * (0.05 + 0.16 * Math.exp(-step / 500));
    const sample: TrainingLossSample = { step, train: Math.max(0.05, base + (step === 0 ? 0 : noise)) };
    if (step % 30 === 0) sample.val = 0.471 + 1.449 * Math.exp(-step / 313);
    samples.push(sample);
  }
  return samples;
})();

const SIM_EVENTS: TrainingEvent[] = [
  { id: "start", kind: "start", label: "Training started on 8× H200", step: 0 },
  { id: "eval-1", kind: "eval", label: "Eval: 0.71 accuracy", step: 310 },
  { id: "checkpoint-1", kind: "checkpoint", label: "Checkpoint saved · epoch 1", step: 620 },
  { id: "eval-2", kind: "eval", label: "Eval: 0.82 accuracy", step: 930 },
  { id: "checkpoint-2", kind: "checkpoint", label: "Checkpoint saved · epoch 2", step: 1240 },
  { id: "eval-3", kind: "eval", label: "Eval: 0.86 accuracy", step: 1550 },
  { id: "done", kind: "done", label: "Training complete · 0.86 accuracy", step: 1860 },
];

const SIM_METRICS: TrainingMetric[] = [
  { label: "Validation loss", value: "0.474", hint: "from 1.92" },
  { label: "Eval accuracy", value: "0.86", hint: "from 0.58" },
  { label: "Train loss", value: "0.262", hint: "smoothed" },
  { label: "Cost", value: "$9.70", hint: "Sample" },
];

function simRate(step: number) {
  if (step <= 0) return 0;
  if (step < 60) return Math.max(2e-5, (2e-4 * step) / 60);
  return 2e-5 + 1.8e-4 * 0.5 * (1 + Math.cos((Math.PI * (step - 60)) / (SIM_TOTAL - 60)));
}

interface SimState {
  status: TrainingRunStatus;
  /** Milliseconds spent in the queue and in start up. */
  wait: number;
  started: boolean;
  step: number;
  events: TrainingEvent[];
  extra: number;
  failedOnce: boolean;
  notice?: string;
  error?: string;
}

const simInitial = (notice?: string): SimState => ({ status: "queued", wait: 0, started: false, step: 0, events: [], extra: 0, failedOnce: false, notice });

function simAdvance(state: SimState, ms: number, scenario: TrainingRunScenario): SimState {
  if (state.status === "queued") {
    const wait = state.wait + ms;
    return wait >= SIM_QUEUE_MS ? { ...state, status: "running", wait: SIM_QUEUE_MS } : { ...state, wait };
  }
  if (state.status !== "running") return state;
  if (!state.started) {
    const wait = state.wait + ms;
    if (wait < SIM_QUEUE_MS + SIM_START_MS) return { ...state, wait };
    return { ...state, wait, started: true, events: [SIM_EVENTS[0]] };
  }
  const limit = scenario === "oom" && !state.failedOnce ? SIM_OOM_STEP : SIM_TOTAL;
  const step = Math.min(limit, state.step + ms * SIM_STEPS_PER_MS);
  const crossed = SIM_EVENTS.filter(event => (event.step ?? 0) > state.step && (event.step ?? 0) <= step);
  let events = crossed.length ? [...state.events, ...crossed.map(event => ({ ...event, id: `${event.id}-${state.extra}` }))] : state.events;
  if (step >= limit && limit === SIM_OOM_STEP) {
    events = [...events, { id: `oom-${state.extra}`, kind: "error", label: "Out of memory · GPU 3", step: SIM_OOM_STEP }];
    return { ...state, step, events, status: "failed", failedOnce: true, extra: state.extra + 1, error: `CUDA out of memory on GPU 3 at step ${SIM_OOM_STEP}`, notice: `Run failed at step ${SIM_OOM_STEP}. ${SIM_SUFFIX}` };
  }
  if (step >= SIM_TOTAL) return { ...state, step, events, status: "completed" };
  return { ...state, step, events };
}

/** The hook behind the demo. Returns every TrainingRun prop for a simulated run. */
export function useTrainingRunSimulation({ scenario = "healthy", active = true }: { scenario?: TrainingRunScenario; active?: boolean } = {}): TrainingRunProps {
  const [state, setState] = useState<SimState>(() => simInitial());
  const moving = active && (state.status === "queued" || state.status === "running");

  useEffect(() => {
    if (!moving) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const ms = Math.min(120, now - last);
      last = now;
      setState(current => simAdvance(current, ms, scenario));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving, scenario]);

  const step = Math.floor(state.step);
  const count = state.started ? Math.floor(step / 5) + 1 : 0;
  const loss = useMemo(() => SIM_LOSS.slice(0, count), [count]);

  const onPause = useCallback(() => setState(current => current.status === "running" ? { ...current, status: "paused", notice: `Paused at step ${number.format(Math.floor(current.step))}. ${SIM_SUFFIX}` } : current), []);
  const onResume = useCallback(() => setState(current => current.status === "paused" ? { ...current, status: "running", notice: `Resumed. ${SIM_SUFFIX}` } : current), []);
  const onCancel = useCallback(() => setState(current => ({
    ...current,
    status: "cancelled",
    extra: current.extra + 1,
    events: [...current.events, { id: `cancel-${current.extra}`, kind: "warning", label: "Cancelled · last checkpoint kept", step: Math.floor(current.step) }],
    notice: `Run cancelled. ${SIM_SUFFIX}`,
  })), []);
  const onRetry = useCallback(() => setState(current => {
    const checkpoint = Math.floor(current.step / 620) * 620;
    return {
      ...current,
      status: "running",
      step: checkpoint,
      error: undefined,
      extra: current.extra + 1,
      events: [...current.events, { id: `resume-${current.extra}`, kind: "info", label: `Resumed from checkpoint · epoch ${Math.max(1, checkpoint / 620)}`, step: checkpoint }],
      notice: `Retrying from step ${number.format(checkpoint)}. ${SIM_SUFFIX}`,
    };
  }), []);
  const onRestart = useCallback(() => setState(simInitial(`Run queued again. ${SIM_SUFFIX}`)), []);
  const onDeploy = useCallback((signal: AbortSignal) => new Promise<{ endpoint: string }>((resolve, reject) => {
    const timer = setTimeout(() => resolve({ endpoint: SIM_ENDPOINT }), 1100);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  }), []);

  const stopped = state.status === "failed" || state.status === "cancelled";
  return {
    status: state.status,
    name: "support-triage-v3",
    model: SIM_MODEL,
    details: SIM_DETAILS,
    dataset: SIM_DATASET,
    step,
    totalSteps: SIM_TOTAL,
    epochs: SIM_EPOCHS,
    loss,
    learningRate: simRate(step),
    elapsed: step * SIM_SECONDS_PER_STEP,
    eta: stopped ? undefined : (SIM_TOTAL - step) * SIM_SECONDS_PER_STEP,
    events: state.events,
    metrics: SIM_METRICS,
    activity: state.status === "queued" ? "Waiting for 8× H200 · 2nd in queue" : "Loading weights · 48,210 examples",
    error: state.error,
    notice: state.notice,
    onPause,
    onResume,
    onCancel,
    onRetry,
    onRestart,
    onDeploy,
  };
}

const SIM_MODEL = { name: "Qwen3.8 Max", mark: <QwenColorMark /> };
const SIM_DETAILS = ["LoRA r16", "8× H200"];
const SIM_DATASET = { name: "arcwork/support-tickets-oct", examples: 48210, mark: <HuggingFaceMark /> };

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Swap({ id, className, reduced, children }: { id: string; className?: string; reduced: boolean; children: ReactNode }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.16, ease: "easeOut" } }}
          exit={{ opacity: reduced ? 1 : 0, transition: { duration: reduced ? 0 : 0.1, ease: "easeOut" } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Spinner() {
  return (
    <svg className={styles.spinner} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6" className={styles.spinnerTrack} />
      <path d="M8 2a6 6 0 0 1 6 6" className={styles.spinnerArc} />
    </svg>
  );
}

const EVENT_ICONS: Record<TrainingEventKind, typeof Play> = {
  start: Play,
  checkpoint: Save,
  eval: FlaskConical,
  epoch: Clock3,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  done: CheckCircle2,
};

const PLOT_HEIGHT = 156;
const PLOT_LEFT = 32;
const PLOT_RIGHT = 6;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 150;

interface Point { step: number; train?: number; raw?: number; val?: number }

function niceStep(value: number) {
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function buildPath(points: { step: number; value: number }[], upTo: number, x: (step: number) => number, y: (value: number) => number) {
  if (!points.length) return "";
  let d = "";
  let previous = points[0];
  for (const point of points) {
    if (point.step <= upTo) {
      d += `${d ? "L" : "M"}${x(point.step).toFixed(1)} ${y(point.value).toFixed(1)}`;
      previous = point;
      continue;
    }
    const span = point.step - previous.step;
    const ratio = span > 0 ? (upTo - previous.step) / span : 0;
    if (ratio > 0) d += `L${x(upTo).toFixed(1)} ${y(previous.value + (point.value - previous.value) * ratio).toFixed(1)}`;
    break;
  }
  if (!d.includes("L")) d += `L${d.slice(1)}`;
  return d;
}

function valueAt(points: { step: number; value: number }[], at: number) {
  if (!points.length) return undefined;
  let previous = points[0];
  for (const point of points) {
    if (point.step > at) {
      const span = point.step - previous.step;
      return span > 0 ? previous.value + ((point.value - previous.value) * Math.max(0, at - previous.step)) / span : previous.value;
    }
    previous = point;
  }
  return previous.value;
}

function smoothPoints(loss: TrainingLossSample[]): Point[] {
  let smooth: number | undefined;
  return loss.map(sample => {
    if (sample.train !== undefined) smooth = smooth === undefined ? sample.train : smooth + (sample.train - smooth) * 0.3;
    return { step: sample.step, raw: sample.train, train: sample.train === undefined ? undefined : smooth, val: sample.val };
  });
}

/** Eases a number toward its target every frame; a drop (rollback or reset) jumps. */
function useEased(target: number, reduced: boolean) {
  const [eased, setEased] = useState(target);
  const jump = reduced || target < eased;
  useEffect(() => {
    if (jump) {
      const frame = requestAnimationFrame(() => setEased(target));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      let done = false;
      setEased(current => {
        const next = current + (target - current) * (1 - Math.exp(-dt / 120));
        done = Math.abs(target - next) < 0.05;
        return done ? target : next;
      });
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, jump]);
  return jump ? target : eased;
}

/* ------------------------------------------------------------------ */
/* TrainingRun                                                         */
/* ------------------------------------------------------------------ */

export function TrainingRun(props: TrainingRunProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const simulated = props.status === undefined;
  const sim = useTrainingRunSimulation({ scenario: props.scenario ?? "healthy", active: simulated && visible });
  const merged = simulated ? { ...sim, ...Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) } as TrainingRunProps : props;
  const {
    status = "queued", name = "Fine-tuning job", model = SIM_MODEL, details = [], dataset, step = 0, totalSteps = 1, epochs = 1,
    loss = [], learningRate, elapsed, eta, events = [], metrics, activity, error, onPause, onResume, onCancel, onRetry, onRestart, onDeploy, notice, className,
  } = merged;
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => setVisible(entries[entries.length - 1].isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Chart size */
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(598);
  useEffect(() => {
    const node = plotRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(120, Math.round(entries[0].contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Series */
  const points = useMemo<Point[]>(() => {
    return smoothPoints(loss);
  }, [loss]);
  const series = useMemo(() => ({
    raw: points.filter(point => point.raw !== undefined).map(point => ({ step: point.step, value: point.raw as number })),
    train: points.filter(point => point.train !== undefined).map(point => ({ step: point.step, value: point.train as number })),
    val: points.filter(point => point.val !== undefined).map(point => ({ step: point.step, value: point.val as number })),
  }), [points]);
  const first = loss.slice(0, 8);
  const peak = first.reduce((max, sample) => Math.max(max, sample.train ?? 0, sample.val ?? 0), 0);
  const top = peak > 0 ? Math.ceil((peak * 1.2) / (niceStep(peak) / 2)) * (niceStep(peak) / 2) : 2.5;
  const tickStep = niceStep(top / 2.5);
  const ticks: number[] = [];
  for (let tick = 0; tick < top - tickStep * 0.01; tick += tickStep) ticks.push(tick);

  const total = Math.max(1, totalSteps);
  const x = (at: number) => PLOT_LEFT + (Math.min(total, Math.max(0, at)) / total) * (width - PLOT_LEFT - PLOT_RIGHT);
  const y = (value: number) => PLOT_BOTTOM - (Math.min(top, Math.max(0, value)) / top) * (PLOT_BOTTOM - PLOT_TOP);

  const latest = points.length ? points[points.length - 1].step : 0;
  const shown = useEased(latest, reduced);
  const progress = useEased(step, reduced);
  const empty = points.length === 0;

  /* Inspection */
  const [inspected, setInspected] = useState<number | null>(null);
  const index = inspected === null || empty ? null : Math.min(points.length - 1, inspected);
  const at = index === null ? latest : points[index].step;
  const trainNow = empty ? undefined : valueAt(series.train, at);
  const lastVal = series.val.filter(point => point.step <= at).pop() ?? series.val[0];
  const valNow = empty ? undefined : lastVal?.value;
  const headStep = index === null ? shown : at;
  const headValue = valueAt(series.train, headStep);

  const inspectAt = (clientX: number) => {
    const node = plotRef.current;
    if (!node || empty) return;
    const rect = node.getBoundingClientRect();
    const ratio = (clientX - rect.left - PLOT_LEFT) / (rect.width - PLOT_LEFT - PLOT_RIGHT);
    const target = Math.min(1, Math.max(0, ratio)) * total;
    let best = 0;
    points.forEach((point, i) => { if (Math.abs(point.step - target) < Math.abs(points[best].step - target)) best = i; });
    setInspected(best);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => { if (event.pointerType === "mouse" || event.buttons > 0 || event.pointerType === "touch") inspectAt(event.clientX); };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (empty) return;
    const last = points.length - 1;
    const current = index ?? last;
    const jump = event.shiftKey ? 10 : 1;
    const next = event.key === "ArrowLeft" ? current - jump : event.key === "ArrowRight" ? current + jump : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (event.key === "Escape") { if (inspected !== null) { event.preventDefault(); setInspected(null); } return; }
    if (next === null) return;
    event.preventDefault();
    setInspected(Math.min(last, Math.max(0, next)));
  };

  /* Cancel confirmation */
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);
  const cancellable = status === "queued" || status === "running" || status === "paused";
  const isConfirming = confirming && cancellable;

  /* Deploy */
  const [deploy, setDeploy] = useState<{ state: "idle" | "loading" | "done" | "error"; endpoint?: string; message?: string }>({ state: "idle" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (status === "completed") return;
    controller.current?.abort();
    controller.current = null;
    const frame = requestAnimationFrame(() => setDeploy({ state: "idle" }));
    return () => cancelAnimationFrame(frame);
  }, [status]);
  const runDeploy = () => {
    if (!onDeploy || deploy.state === "loading") return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setDeploy({ state: "loading" });
    onDeploy(abort.signal).then(
      result => { if (!abort.signal.aborted) setDeploy({ state: "done", endpoint: result?.endpoint }); },
      (reason: unknown) => { if (!abort.signal.aborted) setDeploy({ state: "error", message: reason instanceof Error && reason.message ? reason.message : "Deploy failed" }); },
    );
  };
  const deployed = status === "completed" && deploy.state === "done";

  /* Derived labels */
  const starting = status === "running" && empty;
  const badge = deployed ? { id: "deployed", tone: "success", label: "Deployed", icon: <Rocket size={14} strokeWidth={1.75} /> }
    : status === "completed" ? { id: "completed", tone: "success", label: "Completed", icon: <CheckCircle2 size={14} strokeWidth={1.75} /> }
    : status === "queued" ? { id: "queued", tone: "quiet", label: "Queued", icon: <Clock3 size={14} strokeWidth={1.75} /> }
    : status === "paused" ? { id: "paused", tone: "quiet", label: "Paused", icon: <Pause size={14} strokeWidth={1.75} /> }
    : status === "cancelled" ? { id: "cancelled", tone: "quiet", label: "Cancelled", icon: <CircleSlash size={14} strokeWidth={1.75} /> }
    : status === "failed" ? { id: "failed", tone: "danger", label: "Failed", icon: <CircleAlert size={14} strokeWidth={1.75} /> }
    : starting ? { id: "starting", tone: "live", label: "Starting", icon: <Spinner /> }
    : { id: "training", tone: "live", label: "Training", icon: <Spinner /> };
  const tone = status === "completed" ? "done" : status === "failed" ? "danger" : status === "running" ? "live" : "quiet";

  const perEpoch = total / Math.max(1, epochs);
  const epochNow = empty && status !== "completed" ? 0 : Math.min(epochs, Math.floor(step / perEpoch) + 1);
  const stopped = status === "failed" || status === "cancelled";
  const liveStats: TrainingMetric[] = [
    { label: "Epoch", value: `${epochNow} of ${epochs}` },
    { label: "Learning rate", value: learningRate === undefined ? "–" : formatRate(learningRate) },
    { label: "Elapsed", value: elapsed === undefined ? "–" : formatDuration(elapsed) },
    { label: "ETA", value: stopped ? "Stopped" : eta === undefined ? "–" : status === "queued" ? `About ${formatDuration(eta)}` : formatDuration(eta) },
  ];
  const finalTrain = series.train.length ? series.train[series.train.length - 1].value : undefined;
  const finalVal = series.val.length ? series.val[series.val.length - 1].value : undefined;
  const results: TrainingMetric[] = (metrics ?? [
    { label: "Train loss", value: formatLoss(finalTrain) },
    { label: "Validation loss", value: formatLoss(finalVal) },
    { label: "Steps", value: number.format(step) },
    { label: "Duration", value: elapsed === undefined ? "–" : formatDuration(elapsed) },
  ]).slice(0, 4);
  const stats = status === "completed" ? results : liveStats;
  const tabular = status !== "completed";

  const recent = events.slice(-4).reverse();
  const showStep = index === null ? step : at;

  const info = deployed && deploy.endpoint ? { id: "endpoint", tone: "plain" }
    : status === "completed" && deploy.state === "error" ? { id: "deploy-error", tone: "danger" }
    : status === "failed" && error ? { id: "error", tone: "danger" }
    : { id: "dataset", tone: "plain" };

  const left = cancellable && onCancel
    ? { variant: isConfirming ? "danger" as const : "secondary" as const, onClick: () => { if (isConfirming) { setConfirming(false); onCancel(); } else setConfirming(true); }, content: isConfirming ? "Confirm cancel" : <><X size={16} strokeWidth={1.75} />Cancel</> }
    : !cancellable && onRestart
      ? { variant: status === "cancelled" ? "primary" as const : "secondary" as const, onClick: onRestart, content: status === "cancelled" ? <><RotateCcw size={16} strokeWidth={1.75} />Run again</> : "Run again" }
      : null;
  const right = status === "running" && onPause ? { variant: "secondary" as const, action: "pause" as const, loading: false, content: <><Pause size={16} strokeWidth={1.75} />Pause</> }
    : status === "paused" && onResume ? { variant: "primary" as const, action: "resume" as const, loading: false, content: <><Play size={16} strokeWidth={1.75} />Resume</> }
    : status === "failed" && onRetry ? { variant: "primary" as const, action: "retry" as const, loading: false, content: <><RotateCcw size={16} strokeWidth={1.75} />Retry from checkpoint</> }
    : status === "completed" && onDeploy && deploy.state !== "done"
      ? { variant: "primary" as const, action: "deploy" as const, loading: deploy.state === "loading", content: deploy.state === "loading" ? <><Rocket size={16} strokeWidth={1.75} />Deploying</> : deploy.state === "error" ? <><RotateCcw size={16} strokeWidth={1.75} />Retry deploy</> : <><Rocket size={16} strokeWidth={1.75} />Deploy</> }
      : null;

  const extras = [isConfirming ? "Press Confirm cancel to stop the run." : "", status === "failed" && error ? `${error}.` : "", notice ?? ""].filter(Boolean);
  const announcement = `${name}: ${badge.label}${extras.length ? `. ${extras.join(" ")}` : ""}`;
  const chartLabel = empty
    ? "Loss curve, no samples yet"
    : `Loss curve, step ${number.format(showStep)} of ${number.format(total)}. Train loss ${formatLoss(trainNow)}, validation loss ${formatLoss(valNow)}. Use the arrow keys to inspect steps.`;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} data-status={status}>
      <header className={styles.header}>
        {model.mark ? <span className={styles.mark} aria-hidden="true">{model.mark}</span> : null}
        <div className={styles.heading}>
          <h3 className={styles.title}>{name}</h3>
          <p className={styles.meta}>{[model.name, ...details].join(" · ")}</p>
        </div>
        <Swap id={badge.id} className={styles.badgeSlot} reduced={reduced}>
          <span className={styles.badge} data-tone={badge.tone}>{badge.icon}<span>{badge.label}</span></span>
        </Swap>
      </header>

      <section className={styles.curve} aria-label="Loss">
        <div className={styles.legend}>
          <span className={styles.key}>
            <span className={styles.swatch} data-series="train" aria-hidden="true" />
            <span>Train</span>
            <span className={styles.num} data-empty={empty || undefined}>{formatLoss(trainNow)}</span>
          </span>
          <span className={styles.key}>
            <span className={styles.swatch} data-series="val" aria-hidden="true" />
            <span><span className={styles.long}>Validation</span><span className={styles.short}>Val</span></span>
            <span className={styles.num} data-empty={empty || undefined}>{formatLoss(valNow)}</span>
          </span>
          <span className={styles.stepText}>Step <span className={styles.num}>{number.format(showStep)}</span> / <span className={styles.num}>{number.format(total)}</span></span>
        </div>
        <div className={styles.chart} data-tone={tone}>
          <div
            ref={plotRef}
            className={styles.plot}
            style={{ height: PLOT_HEIGHT }}
            tabIndex={empty ? -1 : 0}
            role="group"
            aria-label={chartLabel}
            onKeyDown={onKeyDown}
            onPointerMove={onPointerMove}
            onPointerDown={event => inspectAt(event.clientX)}
            onPointerLeave={() => setInspected(null)}
            onPointerCancel={() => setInspected(null)}
            onBlur={() => setInspected(null)}
          >
            <svg className={styles.svg} width={width} height={PLOT_HEIGHT} viewBox={`0 0 ${width} ${PLOT_HEIGHT}`} aria-hidden="true">
              {ticks.map(tick => (
                <g key={tick}>
                  <line className={styles.grid} x1={PLOT_LEFT} x2={width - PLOT_RIGHT} y1={y(tick)} y2={y(tick)} />
                  <text className={styles.tick} x={24} y={y(tick)} dy=".34em" textAnchor="end">{tick.toFixed(1)}</text>
                </g>
              ))}
              {Array.from({ length: Math.max(0, epochs - 1) }, (_, i) => (
                <line key={i} className={styles.boundary} x1={x(perEpoch * (i + 1))} x2={x(perEpoch * (i + 1))} y1={PLOT_TOP} y2={PLOT_BOTTOM} />
              ))}
              {empty ? null : (
                <>
                  <path className={styles.raw} d={buildPath(series.raw, shown, x, y)} />
                  <path className={styles.val} d={buildPath(series.val, shown, x, y)} />
                  <path className={styles.train} d={buildPath(series.train, shown, x, y)} />
                  <g className={styles.head} data-inspecting={index !== null || undefined} transform={`translate(${x(headStep).toFixed(1)} 0)`}>
                    <line x1="0" x2="0" y1={PLOT_TOP} y2={PLOT_BOTTOM} />
                    <circle cx="0" cy={y(headValue ?? 0).toFixed(1)} r="3.5" />
                  </g>
                </>
              )}
            </svg>
            <AnimatePresence initial={false}>
              {empty && activity ? (
                <motion.div key="overlay" className={styles.overlay} style={{ left: PLOT_LEFT }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.16 }}>
                  <span className={styles.overlayBox}>
                    <span className={styles.overlayText} data-shimmer="">{activity}</span>
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className={styles.epochs} style={{ paddingLeft: PLOT_LEFT, paddingRight: PLOT_RIGHT }} aria-hidden="true">
            {Array.from({ length: Math.max(1, epochs) }, (_, i) => (
              <span key={i} className={styles.epoch}>
                <span className={styles.epochTrack}>
                  <span className={styles.epochFill} style={{ transform: `scaleX(${Math.min(1, Math.max(0, (progress - perEpoch * i) / perEpoch)).toFixed(4)})` }} />
                </span>
                <span className={styles.epochLabel}>Epoch {i + 1}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <Swap id={status === "completed" ? "results" : "live"} className={styles.statsSlot} reduced={reduced}>
        <dl className={styles.stats}>
          {stats.map(stat => (
            <div key={stat.label} className={styles.stat}>
              <dt>{stat.label}</dt>
              <dd>
                <span className={tabular && stat.label !== "Learning rate" ? styles.num : undefined}>{stat.value}</span>
                {stat.hint ? <span className={styles.hint}>{stat.hint}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </Swap>

      <section className={styles.events} aria-label="Events">
        <ol className={styles.eventList}>
          <AnimatePresence initial={false}>
            {recent.map((event, i) => {
              const Icon = EVENT_ICONS[event.kind] ?? Info;
              return (
                <motion.li
                  key={event.id}
                  className={styles.event}
                  data-kind={event.kind}
                  aria-hidden={i > 2 || undefined}
                  initial={{ opacity: 0, y: reduced ? i * 32 : i * 32 - 12 }}
                  animate={{ opacity: i > 2 ? 0 : 1, y: i * 32 }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.24, bounce: 0 }}
                >
                  <Icon className={styles.eventIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.truncate}>{event.label}</span>
                  {event.step === undefined ? null : <span className={styles.eventStep}>Step {number.format(event.step)}</span>}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </section>

      <footer className={styles.footer}>
        <Swap id={info.id} className={styles.infoSlot} reduced={reduced}>
          <span className={styles.info} data-tone={info.tone}>
            {info.id === "endpoint" ? (
              <>
                <CheckCircle2 className={styles.infoIcon} data-tone="success" size={14} strokeWidth={1.75} aria-hidden="true" />
                <code className={`${styles.truncate} ${styles.endpoint}`}>{deploy.endpoint}</code>
                <CopyButton value={deploy.endpoint ?? ""} label="Copy endpoint" iconOnly variant="plain" className={styles.copy} />
              </>
            ) : info.id === "dataset" ? (
              dataset ? (
                <>
                  {dataset.mark ? <span className={styles.datasetMark} aria-hidden="true">{dataset.mark}</span> : null}
                  <span className={styles.truncate}>{dataset.name}</span>
                  {dataset.examples === undefined ? null : <span className={styles.muted}>{number.format(dataset.examples)} examples</span>}
                </>
              ) : null
            ) : (
              <>
                <CircleAlert className={styles.infoIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.truncate}>{info.id === "error" ? error : deploy.message}</span>
              </>
            )}
          </span>
        </Swap>
        <div className={styles.actions}>
          <AnimatePresence initial={false} mode="popLayout">
            {left ? (
              <motion.span key="left" className={styles.slot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>
                <Button variant={left.variant} size="sm" onClick={left.onClick}>{left.content}</Button>
              </motion.span>
            ) : null}
            {right ? (
              <motion.span key="right" className={styles.slot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>
                <Button variant={right.variant} size="sm" loading={right.loading} onClick={() => { const action = right.action; if (action === "pause") onPause?.(); else if (action === "resume") onResume?.(); else if (action === "retry") onRetry?.(); else runDeploy(); }}>{right.content}</Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </footer>
      <span className={styles.srOnly} role="status">{announcement}</span>
    </div>
  );
}

export default TrainingRun;
