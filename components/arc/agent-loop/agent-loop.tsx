"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleCheck, FileText, Layers, ListChecks, LoaderCircle, MessageSquareText, Pause, Play, RotateCcw, StepForward, Wrench, X } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import { ClaudeMark, GitHubMark, LinearMark, PostgreSQLMark, SlackMark } from "./marks";
import styles from "./agent-loop.module.css";

export type AgentLoopStation = "gather" | "act" | "verify";

export interface AgentLoopGather {
  label: string;
  detail?: string;
  tokens: number;
  mark?: ReactNode;
}

export interface AgentLoopCall {
  tool: string;
  mark?: ReactNode;
  action: string;
  result: string;
  status?: "success" | "error";
}

export interface AgentLoopVerify {
  passed: boolean;
  note: string;
}

export interface AgentLoopIteration {
  gather: AgentLoopGather;
  calls: AgentLoopCall[];
  verify: AgentLoopVerify;
}

export interface AgentLoopProps {
  iterations?: AgentLoopIteration[];
  task?: string;
  summary?: string;
  model?: { name: string; mark?: ReactNode } | null;
  title?: string;
  stationLabels?: Partial<Record<AgentLoopStation, string>>;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  defaultSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  controls?: boolean;
  onStationChange?: (station: AgentLoopStation, iteration: number) => void;
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
}

const SAMPLE: AgentLoopIteration[] = [
  {
    gather: { label: "Task from Maya", detail: "EU card declines at checkout", tokens: 1200, mark: <MessageSquareText aria-hidden /> },
    calls: [{ tool: "GitHub", mark: <GitHubMark />, action: "Read issue #312", result: "EU cards, since Oct 18" }],
    verify: { passed: false, note: "No root cause yet" },
  },
  {
    gather: { label: "Issue #312", detail: "14 comments, opened Oct 18", tokens: 6400, mark: <GitHubMark /> },
    calls: [
      { tool: "PostgreSQL", mark: <PostgreSQLMark />, action: "Run query", result: "Timed out after 30s", status: "error" },
      { tool: "PostgreSQL", mark: <PostgreSQLMark />, action: "Narrow to 72 hours", result: "1,284 declines, all 3DS" },
    ],
    verify: { passed: true, note: "3DS times out at 5s" },
  },
  {
    gather: { label: "Query result", detail: "1,284 declined orders", tokens: 9800, mark: <PostgreSQLMark /> },
    calls: [
      { tool: "Linear", mark: <LinearMark />, action: "Update status", result: "PAY-118 now in progress" },
      { tool: "Slack", mark: <SlackMark />, action: "Post update", result: "Posted in #payments" },
    ],
    verify: { passed: true, note: "Ticket and team updated" },
  },
];
const SAMPLE_SUMMARY = "EU declines come from 3DS checks timing out after 5 seconds. PAY-118 is in progress and the plan is posted in #payments.";
const DEFAULT_MODEL = { name: "Claude Opus 5.5", mark: <ClaudeMark /> };
const DEFAULT_LABELS: Record<AgentLoopStation, string> = { gather: "Gather context", act: "Take action", verify: "Verify" };
const STATION_ICONS = { gather: Layers, act: Wrench, verify: ListChecks };
const STATIONS: AgentLoopStation[] = ["gather", "act", "verify"];
const SPEEDS = [{ value: "0.5", label: "0.5×" }, { value: "1", label: "1×" }, { value: "2", label: "2×" }];
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const DROP = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

/* ── Timeline ─────────────────────────────────────────────────────────── */

type Beat =
  | { t: number; kind: "station"; station: AgentLoopStation; iteration: number }
  | { t: number; kind: "leave"; station: AgentLoopStation; iteration: number }
  | { t: number; kind: "block"; iteration: number; stop: true; say: string }
  | { t: number; kind: "call"; iteration: number; call: number }
  | { t: number; kind: "result"; iteration: number; call: number; stop: true; say: string }
  | { t: number; kind: "check"; iteration: number; stop: true; say: string }
  | { t: number; kind: "end"; stop: true; say: string };

interface Travel { from: number; to: number; a0: number; a1: number }

interface Timeline { beats: Beat[]; travels: Travel[]; end: number }

/** Station angles in thirds of a turn; the real angles come from the layout. */
function buildTimeline(iterations: AgentLoopIteration[], summary: string): Timeline {
  const beats: Beat[] = [];
  const travels: Travel[] = [];
  let t = 0;
  iterations.forEach((iteration, i) => {
    beats.push({ t, kind: "station", station: "gather", iteration: i });
    beats.push({ t: t + 130, kind: "block", iteration: i, stop: true, say: `Loop ${i + 1}. Gathered context: ${iteration.gather.label}` });
    t += 850;
    beats.push({ t, kind: "leave", station: "gather", iteration: i });
    travels.push({ from: t, to: t + 665, a0: i, a1: i + 1 / 3 });
    t += 700;
    beats.push({ t, kind: "station", station: "act", iteration: i });
    t += 100;
    iteration.calls.slice(0, 3).forEach((call, c) => {
      beats.push({ t, kind: "call", iteration: i, call: c });
      t += 750;
      const failed = call.status === "error";
      beats.push({ t, kind: "result", iteration: i, call: c, stop: true, say: `${call.tool} ${failed ? "failed" : "returned"}: ${call.result}` });
      t += 400;
    });
    t += 100;
    if (!iteration.calls.length) t += 400;
    beats.push({ t, kind: "leave", station: "act", iteration: i });
    travels.push({ from: t, to: t + 465, a0: i + 1 / 3, a1: i + 2 / 3 });
    t += 500;
    beats.push({ t, kind: "station", station: "verify", iteration: i });
    const last = i === iterations.length - 1;
    const { passed, note } = iteration.verify;
    beats.push({ t: t + 100, kind: "check", iteration: i, stop: true, say: passed ? `Check passed: ${note}` : last ? `Check failed: ${note}` : `Retry: ${note}. The loop runs again` });
    t += 950;
    beats.push({ t, kind: "leave", station: "verify", iteration: i });
    travels.push({ from: t, to: t + 685, a0: i + 2 / 3, a1: i + 1 });
    t += 700;
  });
  if (iterations.length) beats.push({ t, kind: "end", stop: true, say: summary });
  return { beats, travels, end: t };
}

interface Frame {
  iteration: number;
  active: AgentLoopStation | null;
  visited: Record<AgentLoopStation, boolean>;
  blocks: number;
  call: { iteration: number; call: number; resolved: boolean } | null;
  check: number | null;
  /** Which lane spoke last, for the single lane layout. */
  latest: "act" | "verify" | null;
  ended: boolean;
}

function frameAt(beats: Beat[], count: number): Frame {
  const frame: Frame = { iteration: 0, active: null, visited: { gather: false, act: false, verify: false }, blocks: 0, call: null, check: null, latest: null, ended: false };
  for (let i = 0; i < count; i++) {
    const beat = beats[i];
    if (beat.kind === "station") {
      if (beat.station === "gather") frame.visited = { gather: false, act: false, verify: false };
      frame.iteration = beat.iteration;
      frame.active = beat.station;
    } else if (beat.kind === "leave") {
      frame.active = null;
      frame.visited = { ...frame.visited, [beat.station]: true };
    } else if (beat.kind === "block") frame.blocks = beat.iteration + 1;
    else if (beat.kind === "call") { frame.call = { iteration: beat.iteration, call: beat.call, resolved: false }; frame.latest = "act"; }
    else if (beat.kind === "result") frame.call = { iteration: beat.iteration, call: beat.call, resolved: true };
    else if (beat.kind === "check") { frame.check = beat.iteration; frame.latest = "verify"; }
    else frame.ended = true;
  }
  return frame;
}

/* ── Geometry ─────────────────────────────────────────────────────────── */

interface Geometry {
  width: number; height: number; svgHeight: number; cx: number; cy: number; r: number; compact: boolean; angle: number;
  points: Record<AgentLoopStation, { x: number; y: number }>;
  gap: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const pointAt = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.sin(rad(deg)), y: cy - r * Math.cos(rad(deg)) });

function layout(width: number): Geometry {
  const compact = width < 360;
  const top = compact ? 30 : 34;
  const room = compact ? 77.4 : 120;
  const cx = Math.round(width / 2);
  const wide = (cx - room) / Math.sin(rad(120));
  const angle = wide >= 64 ? 120 : 140;
  const r = angle === 120 ? Math.min(94, Math.round(wide)) : Math.max(54, Math.round((cx - room) / Math.sin(rad(140))));
  const cy = top + r;
  const height = top + 2 * r + 6;
  return {
    width, height, svgHeight: height + 14, cx, cy, r, compact, angle, gap: compact ? 13 : 14,
    points: { gather: pointAt(cx, cy, r, 0), act: pointAt(cx, cy, r, angle), verify: pointAt(cx, cy, r, 360 - angle) },
  };
}

/** Thirds of a turn (timeline) to degrees on this ring. */
function toDegrees(turns: number, angle: number) {
  const whole = Math.floor(turns + 1e-9);
  const part = turns - whole;
  const third = Math.round(part * 3);
  return whole * 360 + (third === 0 ? 0 : third === 1 ? angle : 360 - angle);
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function headAt(travels: Travel[], t: number, angle: number, reduced: boolean) {
  let deg = 0, trail = 0;
  for (const travel of travels) {
    if (t < travel.from) break;
    const a0 = toDegrees(travel.a0, angle), a1 = toDegrees(travel.a1, angle);
    if (t >= travel.to || reduced) { deg = a1; trail = 0; continue; }
    const p = (t - travel.from) / (travel.to - travel.from);
    deg = a0 + (a1 - a0) * easeInOut(p);
    trail = 72 * Math.sin(Math.PI * p) * ((a1 - a0) / 120);
  }
  return { deg, trail };
}

function formatTokens(value: number) {
  return value < 1000 ? String(Math.round(value)) : `${(value / 1000).toFixed(1)}K`;
}

/* ── Small parts ──────────────────────────────────────────────────────── */

function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id} className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: EASE }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  return (
    <span className={styles.roll} style={{ "--digits": String(value).length } as CSSProperties}>
      <AnimatePresence initial={false}>
        <motion.span
          key={value} className={styles.rollItem}
          initial={reduced ? false : { y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { y: "-100%", opacity: 0 }}
          transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TokenCount({ value, reduced }: { value: number; reduced: boolean }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const from = shown.current, start = performance.now();
    if (reduced || from === value) { shown.current = value; el.textContent = formatTokens(value); return; }
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 260);
      shown.current = from + (value - from) * (1 - Math.pow(1 - p, 3));
      el.textContent = formatTokens(shown.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span ref={node} className={styles.tokenValue}>{formatTokens(value)}</span>;
}

function Pop({ id, origin, children, reduced }: { id: string; origin: number; children: ReactNode; reduced: boolean }) {
  return (
    <motion.div
      key={id} className={styles.pop} style={{ transformOrigin: `${origin}px 0px` }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.08 } }} transition={reduced ? { duration: 0 } : DROP}
    >
      {children}
    </motion.div>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */

export function AgentLoop({
  iterations = SAMPLE, task = "Find out why EU cards are declined at checkout, then update the team.", summary: summaryProp, model = DEFAULT_MODEL,
  title = "Agent loop", stationLabels, autoPlay = true, loop = false, speed: speedProp, defaultSpeed = 1, onSpeedChange, controls = true,
  onStationChange, onDone, className, style,
}: AgentLoopProps) {
  const reduced = !!useReducedMotion();
  const id = useId();
  const labels = { ...DEFAULT_LABELS, ...stationLabels };
  const empty = iterations.length === 0;
  const lastPassed = empty ? true : iterations[iterations.length - 1].verify.passed;
  const callCount = iterations.reduce((sum, iteration) => sum + Math.min(3, iteration.calls.length), 0);
  const summary = summaryProp ?? (iterations === SAMPLE ? SAMPLE_SUMMARY
    : lastPassed ? `Finished in ${iterations.length} loop${iterations.length === 1 ? "" : "s"} with ${callCount} tool call${callCount === 1 ? "" : "s"}.`
    : `Stopped after ${iterations.length} loop${iterations.length === 1 ? "" : "s"}: the last check did not pass.`);
  const timeline = useMemo(() => buildTimeline(iterations, summary), [iterations, summary]);

  const [speedState, setSpeedState] = useState(defaultSpeed);
  const speed = speedProp ?? speedState;
  const [count, setCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [width, setWidth] = useState(0);
  const [seenReduced, setSeenReduced] = useState(false);
  /* Reduced motion opens on the done state. */
  if (reduced && !seenReduced) { setSeenReduced(true); setCount(timeline.beats.length); setStarted(true); }

  const time = useRef(0);
  const stopAt = useRef<number | null>(null);
  const counted = useRef(0);
  const speedRef = useRef(speed);
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onStationChange, onDone });
  useEffect(() => { callbacks.current = { onStationChange, onDone }; speedRef.current = speed; });

  const geometry = useMemo(() => layout(width || 457), [width]);
  const frame = useMemo(() => frameAt(timeline.beats, count), [timeline, count]);
  const ended = frame.ended;
  const status = empty ? "ready" : ended ? (lastPassed ? "done" : "stopped") : playing ? "running" : started ? "paused" : "ready";

  useLayoutEffect(() => {
    const node = ringRef.current;
    if (!node) return;
    const read = () => setWidth(node.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  /* The head and trail are written straight to the SVG. */
  const draw = useCallback((t: number) => {
    const { cx, cy, r, angle } = geometry;
    const { deg, trail } = headAt(timeline.travels, t, angle, reduced);
    const head = pointAt(cx, cy, r, deg);
    headRef.current?.setAttribute("transform", `translate(${head.x.toFixed(2)} ${head.y.toFixed(2)})`);
    const path = trailRef.current, gradient = gradientRef.current;
    if (!path || !gradient) return;
    if (trail < 0.5) { path.setAttribute("d", ""); return; }
    const tail = pointAt(cx, cy, r, deg - trail);
    path.setAttribute("d", `M ${tail.x.toFixed(2)} ${tail.y.toFixed(2)} A ${r} ${r} 0 0 1 ${head.x.toFixed(2)} ${head.y.toFixed(2)}`);
    gradient.setAttribute("x1", tail.x.toFixed(2)); gradient.setAttribute("y1", tail.y.toFixed(2));
    gradient.setAttribute("x2", head.x.toFixed(2)); gradient.setAttribute("y2", head.y.toFixed(2));
  }, [geometry, timeline, reduced]);

  useLayoutEffect(() => {
    if (reduced && count === timeline.beats.length) time.current = timeline.end;
    draw(time.current);
  }, [draw, count, reduced, timeline]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const limit = stopAt.current ?? timeline.end;
      time.current = Math.min(limit, time.current + dt * speedRef.current);
      const t = time.current;
      draw(t);
      let next = counted.current;
      while (next < timeline.beats.length && timeline.beats[next].t <= t) {
        const beat = timeline.beats[next];
        if (beat.kind === "station") callbacks.current.onStationChange?.(beat.station, beat.iteration);
        if (beat.kind === "end") { callbacks.current.onDone?.(); setAnnounce(beat.say); }
        next += 1;
      }
      if (next !== counted.current) { counted.current = next; setCount(next); }
      if (t >= timeline.end) { stopAt.current = null; setPlaying(false); return; }
      if (stopAt.current != null && t >= stopAt.current) {
        const beat = timeline.beats[next - 1];
        stopAt.current = null;
        setPlaying(false);
        if (beat && "say" in beat) setAnnounce(beat.say);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline, draw]);

  const reset = useCallback(() => {
    time.current = 0; counted.current = 0; stopAt.current = null;
    setCount(0); setPlaying(false); setStarted(false); setAnnounce("");
  }, []);
  const play = useCallback(() => {
    if (empty) return;
    if (counted.current >= timeline.beats.length || time.current >= timeline.end) { time.current = 0; counted.current = 0; setCount(0); }
    stopAt.current = null;
    setStarted(true); setPlaying(true); setAnnounce("");
  }, [empty, timeline]);

  /* Rebuild when the run changes. */
  const [seenTimeline, setSeenTimeline] = useState(timeline);
  if (seenTimeline !== timeline) { setSeenTimeline(timeline); setCount(reduced ? timeline.beats.length : 0); setPlaying(false); setStarted(reduced); }
  useEffect(() => {
    if (!reduced) { time.current = 0; counted.current = 0; }
    else { time.current = timeline.end; counted.current = timeline.beats.length; }
  }, [timeline, reduced]);

  /* Autoplay once, when the card is mostly in view. */
  const auto = useRef(false);
  useEffect(() => {
    const node = rootRef.current;
    if (!autoPlay || reduced || empty || auto.current || !node) return;
    if (typeof IntersectionObserver === "undefined") { auto.current = true; const timer = window.setTimeout(play, 0); return () => window.clearTimeout(timer); }
    const io = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !auto.current) { auto.current = true; io.disconnect(); play(); }
    }, { threshold: 0.6 });
    io.observe(node);
    return () => io.disconnect();
  }, [autoPlay, reduced, empty, play]);

  useEffect(() => {
    if (!loop || !ended || reduced) return;
    const timer = window.setTimeout(() => { reset(); window.setTimeout(play, 190); }, 4000);
    return () => window.clearTimeout(timer);
  }, [loop, ended, reduced, reset, play]);

  const togglePlay = () => {
    if (playing) {
      stopAt.current = null;
      setPlaying(false);
      const beat = [...timeline.beats.slice(0, counted.current)].reverse().find(item => "say" in item);
      setAnnounce(beat && "say" in beat ? beat.say : "Paused");
    } else play();
  };
  const step = () => {
    if (empty || ended) return;
    const next = timeline.beats.find((beat, index) => index >= counted.current && "stop" in beat);
    if (!next) return;
    stopAt.current = next.t;
    setStarted(true); setPlaying(true);
    if (next.kind === "end") window.setTimeout(() => restartRef.current?.focus(), 0);
  };
  const restart = () => {
    reset();
    if (!reduced) window.setTimeout(play, 190);
  };
  const changeSpeed = (value: string) => {
    const next = Number(value);
    if (speedProp === undefined) setSpeedState(next);
    onSpeedChange?.(next);
  };

  /* Derived view. */
  const { cx, cy, r, compact, points, gap, svgHeight, angle } = geometry;
  const W = geometry.width;
  const split = !compact;
  const circle = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  const arrows = [angle / 2, 180, 360 - angle / 2];
  const stateOf = (station: AgentLoopStation) => (ended ? "visited" : frame.active === station ? "active" : frame.visited[station] ? "visited" : "idle");
  const tokens = iterations.slice(0, frame.blocks).reduce((sum, iteration) => sum + iteration.gather.tokens, 0);
  const call = frame.call ? iterations[frame.call.iteration]?.calls[frame.call.call] : null;
  const check = frame.check != null ? iterations[frame.check]?.verify : null;
  const checkLast = frame.check === iterations.length - 1;
  const laneWidth = split ? (W - 12) / 2 : W;

  const callChip = call && frame.call ? (
    <div className={styles.chip} data-state={!frame.call.resolved ? "running" : call.status === "error" ? "error" : "success"}>
      <span className={styles.chipHead}>
        <span className={styles.chipMark}>{call.mark ?? <Wrench aria-hidden />}</span>
        <span className={styles.chipTitle}>{call.action}</span>
        <Swap id={frame.call.resolved ? "result" : "running"} className={styles.chipIcon} reduced={reduced}>
          {!frame.call.resolved ? <LoaderCircle className={styles.spin} aria-hidden /> : call.status === "error" ? <X aria-hidden /> : <Check aria-hidden />}
        </Swap>
      </span>
      <Swap id={frame.call.resolved ? "result" : "running"} className={styles.chipBody} reduced={reduced}>
        {frame.call.resolved ? (
          <span className={styles.chipText}><span className={styles.srOnly}>{call.tool} {call.status === "error" ? "failed" : "returned"}: </span>{call.result}</span>
        ) : <span className={styles.chipText}>Calling {call.tool}</span>}
      </Swap>
    </div>
  ) : null;
  const checkChip = check ? (
    <div className={styles.chip} data-state={check.passed ? "passed" : "retry"}>
      <span className={styles.chipHead}>
        <span className={styles.chipMark} data-tone={check.passed ? "success" : "warning"}>
          {check.passed ? <CircleCheck aria-hidden /> : checkLast ? <CircleAlert aria-hidden /> : <RotateCcw aria-hidden />}
        </span>
        <span className={styles.chipTitle}>{check.passed ? "Check passed" : checkLast ? "Check failed" : "Retry"}</span>
      </span>
      <span className={styles.chipBody}><span className={styles.chipText}>{check.note}</span></span>
    </div>
  ) : null;
  const callKey = frame.call ? `call-${frame.call.iteration}-${frame.call.call}` : "empty";
  const checkKey = frame.check != null ? `check-${frame.check}` : "empty";
  const emptyLane = (text: string) => <div className={styles.laneEmpty}>{text}</div>;
  const lanes: { key: string; station: "act" | "verify"; live: boolean; id: string; origin: number; body: ReactNode }[] = split
    ? [
      { key: "verify", station: "verify", live: frame.active === "verify", id: checkKey, origin: points.verify.x, body: checkChip ?? emptyLane("Checks land here") },
      { key: "act", station: "act", live: frame.active === "act", id: callKey, origin: points.act.x - (laneWidth + 12), body: callChip ?? emptyLane("Tool calls land here") },
    ]
    : [frame.latest === "verify"
      ? { key: "one", station: "verify", live: frame.active === "verify", id: checkKey, origin: points.verify.x, body: checkChip }
      : { key: "one", station: "act", live: frame.active === "act", id: callKey, origin: points.act.x, body: callChip ?? emptyLane("Tool calls land here") }];
  const pins = split ? (["verify", "act"] as const) : ([lanes[0].station] as const);
  const pinKey = (station: "act" | "verify") => (station === "act" ? callKey : checkKey);

  const statusNode = status === "ready" ? <span>Ready</span>
    : status === "running" ? <span className={styles.statusItem}><LoaderCircle className={styles.spin} aria-hidden />Running</span>
    : status === "paused" ? <span className={styles.statusItem}><Pause aria-hidden />Paused</span>
    : status === "done" ? <span className={styles.statusItem}><CircleCheck aria-hidden />Done</span>
    : <span className={styles.statusItem}><CircleAlert aria-hidden />Stopped</span>;
  const tone = status === "running" ? "accent" : status === "done" ? "success" : status === "stopped" ? "warning" : "muted";
  const loops = iterations.length;
  const playLabel = playing ? "Pause" : ended ? "Play again" : "Play";

  return (
    <div
      ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} role="group" aria-labelledby={`${id}-title`}
      data-measured={width ? "" : undefined} data-compact={compact ? "true" : undefined} data-ready={status === "ready" ? "true" : undefined}
      data-done={status === "done" ? "true" : undefined} data-ended={ended ? "true" : undefined}
    >
      <div className={styles.header}>
        <h3 className={styles.title} id={`${id}-title`}>{title}</h3>
        <span className={styles.status} data-tone={tone}>
          <Swap id={status} className={styles.statusSwap} reduced={reduced}>{statusNode}</Swap>
        </span>
        <p className={styles.caption}><Swap id={ended ? "summary" : "task"} reduced={reduced}>{ended ? summary : task}</Swap></p>
        <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
      </div>
      <div className={styles.stage}>
        <div className={styles.loop}>
          <div ref={ringRef} className={styles.ring} style={{ height: geometry.height }}>
            <svg className={styles.svg} width={W} height={svgHeight} viewBox={`0 0 ${W} ${svgHeight}`} aria-hidden="true">
              <defs>
                <linearGradient ref={gradientRef} id={`${id}-trail`} gradientUnits="userSpaceOnUse">
                  <stop className={styles.trailStop} offset="0" stopOpacity="0" />
                  <stop className={styles.trailStop} offset="1" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              {pins.map(station => {
                const d = `M ${points[station].x} ${points[station].y + 9} V ${svgHeight}`;
                const key = pinKey(station);
                return (
                  <g key={station}>
                    <path className={styles.pin} d={d} />
                    {key !== "empty" && (
                      <motion.path
                        key={key} className={styles.pinLive} d={d} data-live={frame.active === station ? "true" : undefined}
                        initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
                      />
                    )}
                  </g>
                );
              })}
              <path className={styles.track} d={circle} />
              {arrows.map(deg => {
                const p = pointAt(cx, cy, r, deg);
                return <path key={deg} className={styles.arrow} d="M -2.75 -4 L 1.75 0 L -2.75 4" transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${deg})`} />;
              })}
              <path className={styles.doneLine} d={circle} pathLength={1} />
              <path ref={trailRef} className={styles.trail} stroke={`url(#${id}-trail)`} />
              {STATIONS.map(station => (
                <g key={station} transform={`translate(${points[station].x.toFixed(2)} ${points[station].y.toFixed(2)})`}>
                  <circle className={styles.nodeRing} r="10.5" data-on={!ended && frame.active === station ? "true" : undefined} />
                  <circle className={styles.node} r="5" data-state={stateOf(station)} />
                </g>
              ))}
              <g ref={headRef} className={styles.headGroup}><circle className={styles.head} r="5" /></g>
            </svg>
            {STATIONS.map(station => {
              const Icon = STATION_ICONS[station];
              const p = points[station];
              const pos = station === "gather" ? { left: p.x, top: p.y - gap, maxWidth: W }
                : station === "act" ? { left: p.x + gap, top: p.y, maxWidth: Math.max(0, W - p.x - gap) }
                : { left: p.x - gap, top: p.y, maxWidth: Math.max(0, p.x - gap) };
              return (
                <span key={station} className={styles.station} data-key={station} data-state={stateOf(station)} style={pos}>
                  <Icon aria-hidden />
                  <TextShimmer className={styles.stationText} active={!ended && frame.active === station && playing}>{labels[station]}</TextShimmer>
                </span>
              );
            })}
            <div className={styles.center} style={{ left: cx, top: cy, maxWidth: r * 1.7 }}>
              {model?.mark && <span className={styles.centerMark}>{model.mark}</span>}
              {model && <span className={styles.centerName} title={model.name}>{model.name}</span>}
              <Swap id={ended ? "end" : status === "ready" ? "ready" : "count"} className={styles.centerLine} reduced={reduced}>
                {ended ? (
                  <span className={styles.centerEnd} data-tone={lastPassed ? "success" : "warning"}>
                    {lastPassed ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
                    <span><span className={styles.centerLead}>{lastPassed ? "Done in " : "Stopped after "}</span>{loops} {loops === 1 ? "loop" : "loops"}</span>
                  </span>
                ) : status === "ready" ? <span>{loops} {loops === 1 ? "loop" : "loops"}</span> : (
                  <span className={styles.centerCount}>Loop <Roll value={frame.iteration + 1} reduced={reduced} /></span>
                )}
              </Swap>
            </div>
          </div>
          <div className={styles.lanes} data-split={split ? "true" : undefined}>
            {lanes.map(lane => (
              <div key={lane.key} className={styles.lane} data-live={lane.live ? "true" : undefined}>
                <AnimatePresence initial={false}>
                  <Pop key={`${lane.station}-${lane.id}`} id={`${lane.station}-${lane.id}`} origin={lane.origin} reduced={reduced}>{lane.body}</Pop>
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.context}>
          <div className={styles.contextHead}>
            <span className={styles.contextTitle}>Context</span>
            <span className={styles.tokens}><TokenCount value={tokens} reduced={reduced} /> tokens</span>
          </div>
          <ol className={styles.blocks} style={{ "--slots": Math.max(1, loops), "--rows": Math.max(1, Math.ceil(loops / 2)) } as CSSProperties} aria-label="Context blocks">
            <AnimatePresence initial={false}>
              {frame.blocks === 0 && (
                <motion.li key="empty" className={styles.blocksEmpty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
                  Fills as the agent gathers context
                </motion.li>
              )}
              {iterations.slice(0, frame.blocks).map((iteration, index) => (
                <motion.li
                  key={index} className={styles.block} data-fresh={index === frame.blocks - 1 && frame.active === "gather" ? "true" : undefined}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
                  transition={reduced ? { duration: 0 } : DROP}
                >
                  <span className={styles.blockMark}>{iteration.gather.mark ?? <FileText aria-hidden />}</span>
                  <span className={styles.blockLabel}>{iteration.gather.label}</span>
                  <span className={styles.blockTokens}>{formatTokens(iteration.gather.tokens)}<span className={styles.srOnly}> tokens</span></span>
                  {iteration.gather.detail && <span className={styles.blockDetail}>{iteration.gather.detail}</span>}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </div>
      {controls && (
        <div className={styles.footer}>
          <div className={styles.buttons}>
            <Tooltip content={playLabel}>
              <Button variant="secondary" size="sm" className={styles.iconButton} aria-label={playLabel} disabled={empty} onClick={togglePlay}>
                <span className={styles.glyph}><Play aria-hidden data-on={!playing} /><Pause aria-hidden data-on={playing} /></span>
              </Button>
            </Tooltip>
            <Tooltip content="Next step">
              <Button variant="secondary" size="sm" className={styles.iconButton} aria-label="Next step" disabled={empty || ended} onClick={step}><StepForward aria-hidden /></Button>
            </Tooltip>
            <Tooltip content="Restart">
              <Button ref={restartRef} variant="secondary" size="sm" className={styles.iconButton} aria-label="Restart" disabled={empty} onClick={restart}><RotateCcw aria-hidden /></Button>
            </Tooltip>
          </div>
          <div className={styles.speed}>
            <span className={styles.speedLabel} aria-hidden="true">Speed</span>
            <SegmentedControl label="Speed" options={SPEEDS} value={String(speed)} onValueChange={changeSpeed} />
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentLoop;
