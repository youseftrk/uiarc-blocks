"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleCheck, CircleX, CornerDownRight, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import { PostgreSQLMark } from "../agent-loop/marks";
import { ClaudeMark, GeminiMark, GitHubMark, GptMark, NotionMark, WebSearchMark } from "./marks";
import styles from "./agent-timeline.module.css";

export type AgentTimelineSpanKind = "thinking" | "tool" | "waiting";

export interface AgentTimelineAgent {
  id: string;
  name: string;
  model?: string;
  role?: string;
  /** Defaults to neutral for the first agent and --series-1 to --series-4 after it. */
  color?: string;
  /** Inferred from the model name for Claude, GPT and Gemini. */
  mark?: ReactNode;
  /** Blended USD rate per million tokens, used for cost. */
  price?: number;
}

export interface AgentTimelineSpan {
  id?: string;
  agentId: string;
  kind: AgentTimelineSpanKind;
  /** Seconds from the start of the run. */
  start: number;
  /** Leave out while a span is open in a live run. */
  end?: number;
  label: string;
  detail?: string;
  tool?: string | { name: string; mark: ReactNode };
  tokens?: number;
  cost?: number;
  status?: "ok" | "failed";
  retry?: boolean;
}

export interface AgentTimelineHandoff {
  from: string;
  to: string;
  at: number;
  label?: string;
}

export interface AgentTimelineRun {
  title?: string;
  agents: AgentTimelineAgent[];
  spans: AgentTimelineSpan[];
  handoffs?: AgentTimelineHandoff[];
  duration?: number;
  /** Epoch ms, for live runs. */
  startedAt?: number;
}

export interface AgentTimelineProps {
  run?: AgentTimelineRun;
  agents?: AgentTimelineAgent[];
  spans?: AgentTimelineSpan[];
  handoffs?: AgentTimelineHandoff[];
  title?: string;
  autoPlay?: boolean;
  speed?: number;
  speeds?: number[];
  live?: boolean;
  onSpanSelect?: (span: AgentTimelineSpan | null) => void;
  onComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

export const sampleRun: AgentTimelineRun = {
  title: "Checkout conversion drop on Oct 14",
  agents: [
    { id: "lead", name: "Orchestrator", model: "Claude Opus 5.5", price: 10 },
    { id: "checker", name: "Checker", model: "GPT-6 Luna", price: 1 },
    { id: "researcher", name: "Researcher", model: "Claude Sonnet 5.5", price: 3 },
    { id: "analyst", name: "Analyst", model: "Claude Haiku 5.5", price: 0.2 },
    { id: "writer", name: "Writer", model: "Gemini 3.8 Flash", price: 0.3 },
  ],
  spans: [
  { agentId: "lead", kind: "thinking", start: 0.0, end: 2.0, label: "Split the investigation into three tracks", tokens: 1920 },
  { agentId: "lead", kind: "waiting", start: 2.0, end: 14.6, label: "Waiting on the analyst, researcher and checker" },
  { agentId: "lead", kind: "thinking", start: 14.6, end: 16.8, label: "Merged findings: PR #4812 broke address autofill in Safari", tokens: 4380 },
  { agentId: "lead", kind: "waiting", start: 16.8, end: 23.0, label: "Waiting on the writer" },
  { agentId: "lead", kind: "thinking", start: 23.0, end: 25.2, label: "Reviewed the draft and tightened the timeline", tokens: 3140 },
  { agentId: "lead", kind: "tool", start: 25.2, end: 26.4, label: "Published the summary to the incidents page", tool: "Notion", tokens: 260 },
  { agentId: "checker", kind: "thinking", start: 3.5, end: 4.1, label: "Listed outside causes to rule out", tokens: 480 },
  { agentId: "checker", kind: "tool", start: 4.1, end: 5.6, label: "Searched for payment provider incidents on Oct 14", tool: "Web search", tokens: 3920, detail: "No matching incidents" },
  { agentId: "checker", kind: "thinking", start: 5.6, end: 6.3, label: "Checked browser releases next", tokens: 610 },
  { agentId: "checker", kind: "tool", start: 6.3, end: 7.7, label: "Searched browser release notes for autofill changes", tool: "Web search", tokens: 4460 },
  { agentId: "checker", kind: "thinking", start: 7.7, end: 9.1, label: "Ruled out causes outside the codebase", tokens: 1180 },
  { agentId: "researcher", kind: "thinking", start: 2.9, end: 3.5, label: "Planned the code search", tokens: 620 },
  { agentId: "researcher", kind: "tool", start: 3.5, end: 4.8, label: "Listed 14 merged PRs touching checkout since Oct 10", tool: "GitHub", tokens: 2140 },
  { agentId: "researcher", kind: "thinking", start: 4.8, end: 5.5, label: "Narrowed to 3 PRs shipped Oct 13 and 14", tokens: 980 },
  { agentId: "researcher", kind: "tool", start: 5.5, end: 7.5, label: "Read the diff of PR #4812, an address autofill refactor", tool: "GitHub", tokens: 6850 },
  { agentId: "researcher", kind: "thinking", start: 7.5, end: 8.5, label: "Traced the change to the Safari autofill path", tokens: 1410 },
  { agentId: "researcher", kind: "tool", start: 8.5, end: 9.7, label: "Checked deploys: #4812 shipped Oct 13 at 21:40", tool: "GitHub", tokens: 1760 },
  { agentId: "researcher", kind: "thinking", start: 9.7, end: 11.9, label: "Wrote up the suspect change with evidence", tokens: 2230 },
  { agentId: "analyst", kind: "thinking", start: 2.3, end: 3.0, label: "Wrote a conversion query for Oct 7 to 15", tokens: 540 },
  { agentId: "analyst", kind: "tool", start: 3.0, end: 5.1, label: "Conversion query timed out", tool: "PostgreSQL", tokens: 410, status: "failed", detail: "Hit the 2s statement timeout on a full scan of orders" },
  { agentId: "analyst", kind: "thinking", start: 5.1, end: 5.7, label: "Rewrote the query to use the date index", tokens: 380 },
  { agentId: "analyst", kind: "tool", start: 5.7, end: 7.3, label: "Retried: conversion by day and platform", tool: "PostgreSQL", tokens: 1960, retry: true, detail: "Succeeded on the second attempt" },
  { agentId: "analyst", kind: "thinking", start: 7.3, end: 8.3, label: "Found the drop is Safari only, down 9.2%", tokens: 720 },
  { agentId: "analyst", kind: "tool", start: 8.3, end: 9.9, label: "Pulled checkout errors by step for Safari", tool: "PostgreSQL", tokens: 2310 },
  { agentId: "analyst", kind: "thinking", start: 9.9, end: 11.8, label: "Traced the failures to the address step", tokens: 860 },
  { agentId: "analyst", kind: "tool", start: 11.8, end: 13.0, label: "Counted affected orders: 1,284", tool: "PostgreSQL", tokens: 1140 },
  { agentId: "analyst", kind: "thinking", start: 13.0, end: 14.3, label: "Summarized the numbers", tokens: 640 },
  { agentId: "writer", kind: "thinking", start: 17.1, end: 17.9, label: "Read the merged findings", tokens: 1850 },
  { agentId: "writer", kind: "tool", start: 17.9, end: 18.8, label: "Pulled the PR #4812 description for context", tool: "GitHub", tokens: 1120 },
  { agentId: "writer", kind: "thinking", start: 18.8, end: 22.7, label: "Drafted the incident summary, 412 words", tokens: 2940 },
  ],
  handoffs: [
    { from: "lead", to: "analyst", at: 2, label: "Measure the drop by day and platform" },
    { from: "lead", to: "researcher", at: 2.6, label: "Find recent changes to checkout" },
    { from: "lead", to: "checker", at: 3.2, label: "Rule out outside causes" },
    { from: "checker", to: "lead", at: 9.4, label: "No outside incident on Oct 14" },
    { from: "researcher", to: "lead", at: 12.2, label: "PR #4812 is the likely cause" },
    { from: "analyst", to: "lead", at: 14.6, label: "Safari only, 1,284 orders affected" },
    { from: "lead", to: "writer", at: 16.8, label: "Draft the incident summary" },
    { from: "writer", to: "lead", at: 23, label: "Draft ready for review" },
  ],
};

const ROW = 44;
const BAR = 16;
const PAD = 6;
const AXIS_H = 30;
const CARD_W = 280;
const KIND_LABEL: Record<AgentTimelineSpanKind, string> = { thinking: "Thinking", tool: "Tool call", waiting: "Waiting" };
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const MORPH = motionTokens.spring.morph;
const number = new Intl.NumberFormat("en-US");

const secs = (value: number) => `${value.toFixed(1)}s`;
const money = (value: number) => `$${value.toFixed(2)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function modelMark(model?: string): ReactNode {
  if (!model) return null;
  if (/claude/i.test(model)) return <ClaudeMark />;
  if (/gpt|openai/i.test(model)) return <GptMark />;
  if (/gemini/i.test(model)) return <GeminiMark />;
  return null;
}

function toolMark(name: string): ReactNode {
  const key = name.toLowerCase();
  if (key === "github") return <GitHubMark />;
  if (key === "web search") return <WebSearchMark />;
  if (key === "postgresql" || key === "postgres") return <PostgreSQLMark style={{ color: "#4169E1" }} />;
  if (key === "notion") return <NotionMark />;
  return null;
}

interface NSpan extends AgentTimelineSpan {
  id: string;
  row: number;
  open: boolean;
  source: AgentTimelineSpan;
  toolName?: string;
  mark?: ReactNode;
  rate: number;
  notes: string[];
}

interface NLink {
  key: string;
  from: number;
  to: number;
  at: number;
  /** When the connector starts drawing. */
  show: number;
  x1: number;
  x2: number;
  shape: "out" | "in" | "line";
  dir: "down" | "up";
  color: string;
  top: number;
  height: number;
  portTop: number;
  fromSpan?: string;
  toSpan?: string;
}

function normalize(agents: AgentTimelineAgent[], rawSpans: AgentTimelineSpan[], rawHandoffs: AgentTimelineHandoff[], fixedDuration?: number) {
  const rows = agents.map((agent, index) => ({
    ...agent,
    color: agent.color ?? (index === 0 ? "var(--text-secondary)" : SERIES[(index - 1) % SERIES.length]),
    mark: agent.mark ?? modelMark(agent.model),
  }));
  const rowOf = new Map(rows.map((agent, index) => [agent.id, index]));
  const sorted = rawSpans
    .filter(span => rowOf.has(span.agentId))
    .map(span => ({ span, row: rowOf.get(span.agentId) as number }))
    .sort((a, b) => a.row - b.row || a.span.start - b.span.start);
  const closed = sorted.reduce((max, item) => Math.max(max, item.span.end ?? item.span.start), 0);
  const duration = fixedDuration ?? closed;
  const spans: NSpan[] = sorted.map(({ span, row }, index) => {
    const tool = span.kind === "tool" ? span.tool : undefined;
    const toolName = typeof tool === "string" ? tool : tool?.name;
    return {
      ...span,
      id: span.id ?? `${span.agentId}-${index}`,
      row,
      open: span.end == null,
      source: span,
      toolName,
      mark: typeof tool === "object" ? tool.mark : toolName ? toolMark(toolName) : undefined,
      rate: rows[row].price ?? 0,
      notes: [],
    };
  });
  const byRow = rows.map((_, row) => spans.filter(span => span.row === row));
  const endOf = (span: NSpan) => span.end ?? Infinity;
  const owner = (row: number, time: number, preferEnd: boolean) => {
    const list = byRow[row];
    const inside = list.find(span => span.start <= time && time < endOf(span));
    const ending = list.find(span => endOf(span) === time);
    return preferEnd ? ending ?? inside : inside ?? ending;
  };
  const attached = new Map<string, { text: string }[]>();
  const attach = (span: NSpan | undefined, text: string) => {
    if (!span) return;
    attached.set(span.id, [...(attached.get(span.id) ?? []), { text }]);
  };
  const links: NLink[] = [];
  rawHandoffs.forEach((handoff, index) => {
    const from = rowOf.get(handoff.from);
    const to = rowOf.get(handoff.to);
    if (from == null || to == null || from === to) return;
    const dispatch = from < to;
    const child = dispatch ? to : from;
    const down = to > from;
    let x1 = handoff.at;
    let x2 = handoff.at;
    if (dispatch) {
      const next = byRow[to].find(span => span.start >= handoff.at);
      if (next) x2 = next.start;
    } else {
      const last = [...byRow[from]].reverse().find(span => endOf(span) <= handoff.at);
      if (last) x1 = last.end as number;
    }
    const upper = Math.min(from, to);
    const lower = Math.max(from, to);
    const fromSpan = dispatch ? owner(from, handoff.at, false) : owner(from, x1, true);
    const toSpan = dispatch ? owner(to, x2, false) : owner(to, handoff.at, false);
    const fromName = rows[from].name.toLowerCase();
    const toName = rows[to].name.toLowerCase();
    if (handoff.label) {
      attach(fromSpan, `To ${toName}: ${handoff.label}`);
      attach(toSpan, `From ${fromName}: ${handoff.label}`);
    } else {
      attach(fromSpan, `Handed off to ${toName}`);
      attach(toSpan, `Handed off from ${fromName}`);
    }
    const shape = x1 === x2 ? "line" : dispatch ? "out" : "in";
    const barBottom = PAD + upper * ROW + (ROW + BAR) / 2;
    links.push({
      key: `${handoff.from}-${handoff.to}-${handoff.at}-${index}`,
      from,
      to,
      at: handoff.at,
      show: x1,
      x1,
      x2,
      shape,
      dir: (dispatch ? down : !down) ? "down" : "up",
      color: rows[child].color,
      top: barBottom,
      height: (lower - upper) * ROW - BAR / 2 + 0.75,
      portTop: (dispatch ? from : to) === upper ? barBottom : PAD + lower * ROW + (ROW - BAR) / 2,
      fromSpan: fromSpan?.id,
      toSpan: toSpan?.id,
    });
  });
  for (const span of spans) {
    const list = attached.get(span.id) ?? [];
    if (list.length > 1) span.notes = [`${list.length} handoffs during this span`];
    else if (list.length === 1) span.notes = [list[0].text];
  }
  const work = spans.reduce((sum, span) => (span.kind === "waiting" || span.end == null ? sum : sum + span.end - span.start), 0);
  return { rows, spans, byRow, links, duration, work };
}

type Model = ReturnType<typeof normalize>;

function totalsAt(model: Model, now: number) {
  let tokens = 0;
  let cost = 0;
  const working = new Set<number>();
  for (const span of model.spans) {
    if (now <= span.start) continue;
    const end = span.end ?? now;
    const length = Math.max(end - span.start, 0.0001);
    const share = clamp((now - span.start) / length, 0, 1);
    const spanTokens = (span.tokens ?? 0) * share;
    tokens += spanTokens;
    cost += span.cost != null ? span.cost * share : (spanTokens * span.rate) / 1_000_000;
    if (now < end && span.kind !== "waiting") working.add(span.row);
  }
  return { tokens: Math.round(tokens), cost, working: working.size };
}

function spanName(span: NSpan, agent: string, now: number) {
  const parts = [agent, KIND_LABEL[span.kind]];
  if (span.toolName) parts.push(span.toolName);
  if (span.status === "failed") parts.push("failed");
  const tokens = span.tokens ? `, ${number.format(span.tokens)} tokens` : "";
  return `${parts.join(", ")}: ${span.label}, ${secs(span.start)} to ${secs(span.end ?? now)}${tokens}`;
}

const SpanButton = memo(function SpanButton({ span, state, label, pressed, dim, tabbable, end }: { span: NSpan; state: "pending" | "active" | "done"; label: string; pressed: boolean; dim: boolean; tabbable: boolean; end: number }) {
  const failed = span.status === "failed" && state === "done";
  return (
    <button
      type="button"
      className={styles.span}
      data-kind={span.kind}
      data-state={state}
      data-span-id={span.id}
      data-failed={failed || undefined}
      data-dim={dim || undefined}
      aria-pressed={pressed}
      aria-label={label}
      tabIndex={tabbable ? 0 : -1}
      style={{ "--s": span.start, "--d": end - span.start } as CSSProperties}
    >
      {failed ? <CircleX className={styles.spanIcon} aria-hidden /> : span.retry && state === "done" ? <RotateCw className={styles.spanIcon} aria-hidden /> : null}
    </button>
  );
});

interface CardState {
  id: string;
  x: number;
  y: number;
  below: boolean;
}

/** A compact timeline of one orchestrated agent run, replayed on a shared time axis. */
export function AgentTimeline({ run, agents: agentsProp, spans: spansProp, handoffs: handoffsProp, title: titleProp, autoPlay, speed: speedProp = 1, speeds = [1, 2], live = false, onSpanSelect, onComplete, className, style }: AgentTimelineProps) {
  const sample = !run && !spansProp;
  const data = run ?? sampleRun;
  const agents = agentsProp ?? data.agents;
  const rawSpans = spansProp ?? data.spans;
  const rawHandoffs = handoffsProp ?? data.handoffs;
  const title = titleProp ?? data.title ?? "Agent run";
  const model = useMemo(() => normalize(agents, rawSpans, rawHandoffs ?? [], live ? undefined : data.duration), [agents, rawSpans, rawHandoffs, data.duration, live]);
  const duration = model.duration;
  const reduced = useReducedMotion() ?? false;
  const shouldAuto = (autoPlay ?? sample) && !live;
  const id = useId();

  const [now, setNow] = useState(() => (shouldAuto ? 0 : duration));
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(!shouldAuto);
  const [speed, setSpeed] = useState(speedProp);
  const [pinned, setPinned] = useState<string | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draw, setDraw] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [liveAxis, setLiveAxis] = useState(() => Math.max(duration, 10));

  const rootRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const clock = useRef(shouldAuto ? 0 : duration);
  const speedRef = useRef(speed);
  const inView = useRef(true);
  const autoDone = useRef(false);
  const userScroll = useRef(0);
  const completeRef = useRef(onComplete);
  const selectRef = useRef(onSpanSelect);
  const mountedAt = useRef(0);

  useEffect(() => {
    completeRef.current = onComplete;
    selectRef.current = onSpanSelect;
    speedRef.current = speed;
  });

  const axis = live ? Math.max(liveAxis, duration) : Math.max(duration, 0.001);
  const ended = !live && now >= duration;
  const finished = ended && !playing && started;
  const rowsH = PAD + model.rows.length * ROW;

  const paint = useCallback((value: number) => {
    clock.current = value;
    bodyRef.current?.style.setProperty("--now", String(value));
    plotRef.current?.style.setProperty("--now", value.toFixed(3));
  }, []);

  const seek = useCallback(
    (value: number) => {
      const next = clamp(value, 0, duration);
      paint(next);
      setNow(next);
      setStarted(true);
    },
    [duration, paint],
  );

  useLayoutEffect(() => {
    paint(clock.current);
  }, [paint, axis]);

  // The replay clock: one CSS variable per frame, React state about twenty times a second.
  useEffect(() => {
    if (!playing || live) return;
    let frame = 0;
    let last = performance.now();
    let lastCommit = 0;
    const tick = (time: number) => {
      const delta = Math.min(time - last, 100) / 1000;
      last = time;
      if (inView.current) {
        const next = Math.min(clock.current + delta * speedRef.current, duration);
        paint(next);
        if (next >= duration) {
          setNow(duration);
          setPlaying(false);
          setAnnouncement(`Finished: ${model.rows.length} agents, ${secs(duration)}`);
          completeRef.current?.();
          return;
        }
        if (time - lastCommit > 50) {
          lastCommit = time;
          setNow(next);
          const scroller = scrollerRef.current;
          const plot = plotRef.current;
          if (scroller && plot && scroller.scrollWidth > scroller.clientWidth && time - userScroll.current > 1500) {
            const x = plot.offsetLeft + (next / duration) * plot.offsetWidth;
            const labels = plot.offsetLeft;
            if (x > scroller.scrollLeft + scroller.clientWidth - 40 || x < scroller.scrollLeft + labels) scroller.scrollLeft = x - scroller.clientWidth + 80;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, live, duration, paint, model.rows.length]);

  // Live runs follow the wall clock.
  const wasLive = useRef(live);
  useEffect(() => {
    if (!live) {
      if (wasLive.current) {
        wasLive.current = false;
        const timer = window.setTimeout(() => {
          seek(duration);
          completeRef.current?.();
        }, 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    wasLive.current = true;
    if (!mountedAt.current) mountedAt.current = Date.now();
    const origin = data.startedAt ?? mountedAt.current;
    let frame = 0;
    let lastCommit = 0;
    const tick = (time: number) => {
      const value = Math.max(0, (Date.now() - origin) / 1000);
      paint(value);
      if (time - lastCommit > 50) {
        lastCommit = time;
        setNow(value);
        setStarted(true);
        setLiveAxis(current => (value > current * 0.92 ? Math.ceil((value * 1.25) / 5) * 5 : current));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, data.startedAt, duration, paint, seek]);

  const play = useCallback(
    (fromStart?: boolean) => {
      if (fromStart || clock.current >= duration) {
        paint(0);
        setNow(0);
      }
      setStarted(true);
      setDraw(true);
      setPlaying(true);
      setAnnouncement(fromStart || clock.current === 0 ? "Replaying" : "Playing");
    },
    [duration, paint],
  );

  const pause = useCallback(() => {
    setPlaying(false);
    setNow(clock.current);
    setAnnouncement("Paused");
  }, []);

  // Autoplay when scrolled into view; the clock only runs while visible.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      if (shouldAuto && !reduced && !autoDone.current) {
        autoDone.current = true;
        const timer = window.setTimeout(() => play(true), 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting;
        if (entry.isIntersecting && shouldAuto && !autoDone.current) {
          autoDone.current = true;
          if (reduced) seek(duration);
          else play(true);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldAuto, reduced, play, seek, duration]);

  const togglePlay = () => (playing ? pause() : play());
  const restart = () => play(true);
  const changeSpeed = (value: string) => setSpeed(Number(value));

  const totals = useMemo(() => totalsAt(model, live ? now : Math.min(now, duration)), [model, now, duration, live]);
  const finalTotals = useMemo(() => totalsAt(model, Infinity), [model]);
  const speedup = duration > 0 ? model.work / duration : 1;

  // Pinning and its handoff path.
  const path = useMemo(() => {
    if (!pinned) return null;
    const span = model.spans.find(item => item.id === pinned);
    if (!span) return null;
    const hot = new Set<string>();
    const lit = new Set<string>([span.id]);
    if (span.row === 0) {
      for (const link of model.links) {
        if (link.fromSpan !== span.id && link.toSpan !== span.id) continue;
        hot.add(link.key);
        const other = link.from === 0 ? link.to : link.from;
        for (const item of model.byRow[other]) lit.add(item.id);
      }
    } else {
      for (const item of model.byRow[span.row]) lit.add(item.id);
      for (const link of model.links) {
        if (link.from !== span.row && link.to !== span.row) continue;
        hot.add(link.key);
        const other = link.from === span.row ? link.toSpan : link.fromSpan;
        if (other) lit.add(other);
      }
    }
    return { hot, lit };
  }, [pinned, model]);

  const pin = useCallback(
    (spanId: string | null) => {
      setPinned(current => {
        const next = current === spanId ? null : spanId;
        const span = next ? model.spans.find(item => item.id === next) : null;
        window.setTimeout(() => selectRef.current?.(span ? span.source : null), 0);
        return next;
      });
    },
    [model],
  );

  const place = useCallback((target: HTMLElement, pointerX?: number) => {
    const root = rootRef.current;
    const spanId = target.dataset.spanId;
    if (!root || !spanId) return;
    const rootBox = root.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const width = Math.min(CARD_W, rootBox.width - 16);
    const anchor = pointerX ?? box.left + box.width / 2;
    const x = clamp(anchor - rootBox.left - 15.75, 8, Math.max(8, rootBox.width - 2 - width - 8));
    const above = box.top - rootBox.top - 8;
    const below = above < 132;
    setCard({ id: spanId, x, y: below ? box.bottom - rootBox.top + 6 : above, below });
  }, []);

  const spanTarget = (target: EventTarget | null) => (target instanceof HTMLElement ? target.closest<HTMLElement>("[data-span-id]") : null);

  const onPlotPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const target = spanTarget(event.target);
    if (target) {
      if (card?.id !== target.dataset.spanId) place(target, event.clientX);
    } else if (card && card.id !== pinned) setCard(null);
  };
  const onPlotPointerLeave = () => {
    if (!card) return;
    if (pinned) {
      const node = rootRef.current?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(pinned)}"]`);
      if (node && card.id !== pinned) place(node);
    } else setCard(null);
  };
  const onPlotClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = spanTarget(event.target);
    if (!target?.dataset.spanId) return;
    setFocusId(target.dataset.spanId);
    if (!card || card.id !== target.dataset.spanId) place(target, event.clientX || undefined);
    pin(target.dataset.spanId);
  };
  const onPlotFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = spanTarget(event.target);
    if (!target?.dataset.spanId) return;
    setFocusId(target.dataset.spanId);
    if (target.matches(":focus-visible")) place(target);
  };
  const onPlotBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (spanTarget(event.target) && !spanTarget(event.relatedTarget) && !pinned) setCard(null);
  };

  const visible = useMemo(() => model.spans.filter(span => now > span.start), [model, now]);
  const tabId = focusId && visible.some(span => span.id === focusId) ? focusId : visible[0]?.id ?? model.spans[0]?.id;

  const onPlotKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = spanTarget(event.target);
    if (!target) return;
    const current = model.spans.find(span => span.id === target.dataset.spanId);
    if (!current) return;
    if (event.key === "Escape") {
      if (pinned) {
        event.preventDefault();
        pin(pinned);
      }
      return;
    }
    const rowSpans = visible.filter(span => span.row === current.row);
    const index = rowSpans.findIndex(span => span.id === current.id);
    let next: NSpan | undefined;
    if (event.key === "ArrowRight") next = rowSpans[index + 1];
    else if (event.key === "ArrowLeft") next = rowSpans[index - 1];
    else if (event.key === "Home") next = rowSpans[0];
    else if (event.key === "End") next = rowSpans[rowSpans.length - 1];
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const step = event.key === "ArrowUp" ? -1 : 1;
      const middle = (current.start + (current.end ?? now)) / 2;
      for (let row = current.row + step; row >= 0 && row < model.rows.length && !next; row += step) {
        const list = visible.filter(span => span.row === row);
        next = list.reduce<NSpan | undefined>((best, span) => {
          const distance = Math.abs((span.start + (span.end ?? now)) / 2 - middle);
          const bestDistance = best ? Math.abs((best.start + (best.end ?? now)) / 2 - middle) : Infinity;
          return distance < bestDistance ? span : best;
        }, undefined);
      }
    } else return;
    event.preventDefault();
    if (!next) return;
    setFocusId(next.id);
    rootRef.current?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(next.id)}"]`)?.focus();
  };

  // Scrubber.
  const timeAt = (clientX: number) => {
    const plot = plotRef.current;
    if (!plot) return 0;
    const box = plot.getBoundingClientRect();
    return clamp(((clientX - box.left) / box.width) * axis, 0, duration);
  };
  const onAxisPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (live || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubbing(true);
    setPlaying(false);
    setDraw(false);
    seek(timeAt(event.clientX));
  };
  const onAxisPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubbing) seek(timeAt(event.clientX));
  };
  const onAxisPointerUp = () => setScrubbing(false);
  const onKnobKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    let next: number | null = null;
    const step = event.shiftKey ? 5 : 0.5;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = clock.current + step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = clock.current - step;
    else if (event.key === "PageUp") next = clock.current + 5;
    else if (event.key === "PageDown") next = clock.current - 5;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = duration;
    if (next == null) return;
    event.preventDefault();
    setPlaying(false);
    setDraw(false);
    seek(next);
  };

  const ticks = useMemo(() => {
    const step = axis <= 12 ? 2 : axis <= 40 ? 5 : axis <= 90 ? 10 : axis <= 240 ? 30 : 60;
    const list: number[] = [];
    for (let value = 0; value <= axis; value += step) list.push(value);
    return list;
  }, [axis]);

  const cardSpan = card ? model.spans.find(span => span.id === card.id) : undefined;
  const cardAgent = cardSpan ? model.rows[cardSpan.row] : undefined;
  const measureCard = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setCardHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const word = playing || live ? 0 : now <= 0 ? 2 : 1;
  const playLabel = playing ? "Pause" : ended ? "Replay" : "Play";
  const speedOptions = useMemo(() => speeds.map(value => ({ value: String(value), label: `${value}x` })), [speeds]);
  const bodyStyle = { "--axis": axis, "--rows-h": `${rowsH}px`, "--row": `${ROW}px`, "--bar": `${BAR}px`, "--pad": `${PAD}px`, "--axis-h": `${AXIS_H}px` } as CSSProperties;

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-labelledby={`${id}-title`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h3 className={styles.title} id={`${id}-title`}>{title}</h3>
          <div className={styles.status}>
            <p className={styles.layer} data-on={!finished || undefined} aria-hidden={finished || undefined}>
              <span className={styles.word}>
                <span className={styles.wordItem} data-on={word === 0 || undefined}><TextShimmer active={word === 0 && !reduced}>Running</TextShimmer></span>
                <span className={styles.wordItem} data-on={word === 1 || undefined}>Paused</span>
                <span className={styles.wordItem} data-on={word === 2 || undefined}>Ready</span>
              </span>
              <span className={styles.sep} aria-hidden="true">&nbsp;·</span>{" "}
              <span className={styles.part}>
                <span className={styles.count}>
                  {!live && <span className={styles.countSizer} aria-hidden="true">{secs(duration)}</span>}
                  <span className={styles.countValue}>{secs(live ? now : Math.min(now, duration))}</span>
                </span>
              </span>
              <span className={styles.sep} aria-hidden="true">&nbsp;·</span>{" "}
              <span className={styles.part}>
                <span className={styles.count}>
                  {!live && <span className={styles.countSizer} aria-hidden="true">{number.format(finalTotals.tokens)}</span>}
                  <span className={styles.countValue}>{number.format(totals.tokens)}</span>
                </span>{" "}
                <span className={styles.unit}>tokens</span>
              </span>
              <span className={styles.sep} aria-hidden="true">&nbsp;·</span>{" "}
              <span className={styles.part}>
                <span className={styles.count}>
                  <span className={styles.countValue}>{money(totals.cost)}</span>
                </span>
              </span>
              {totals.working > 0 && <span className={styles.srOnly}>, {totals.working} {totals.working === 1 ? "agent" : "agents"} working</span>}
            </p>
            <p className={styles.layer} data-on={finished || undefined} aria-hidden={!finished || undefined}>
              <CircleCheck className={styles.doneIcon} aria-hidden />
              <span className={styles.srOnly}>Finished: </span>
              <span className={styles.part}>{model.rows.length} {model.rows.length === 1 ? "agent" : "agents"}</span>
              <span className={styles.sep} aria-hidden="true">&nbsp;·</span>{" "}
              <span className={styles.part}>{secs(duration)}</span>
              {model.rows.length > 1 && speedup > 1.05 && (
                <>
                  <span className={styles.sep} aria-hidden="true">&nbsp;·</span>{" "}
                  <span className={styles.part}>{speedup.toFixed(1)}x faster than sequential</span>
                </>
              )}
              <span className={styles.sep} aria-hidden="true">&nbsp;·</span>{" "}
              <span className={styles.part}>{money(finalTotals.cost)}</span>
            </p>
          </div>
        </header>

        <div
          ref={scrollerRef}
          className={styles.scroller}
          data-scrolled={scrolled || undefined}
          onScroll={event => setScrolled(event.currentTarget.scrollLeft > 0)}
          onWheel={() => (userScroll.current = performance.now())}
          onTouchMove={() => (userScroll.current = performance.now())}
        >
          <div ref={bodyRef} className={styles.body} style={bodyStyle}>
            <div className={styles.labels}>
              {model.rows.map((agent, index) => (
                <div key={agent.id} className={styles.label} id={`${id}-row-${index}`} style={{ "--c": agent.color } as CSSProperties}>
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.labelText}>
                    <span className={styles.name}>{agent.name}</span>
                    {agent.model && (
                      <span className={styles.model}>
                        {agent.mark && <span className={styles.mark} aria-hidden="true">{agent.mark}</span>}
                        <span className={styles.modelName}>{agent.model}</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.track}>
              <div
                ref={plotRef}
                className={styles.plot}
                data-path={path ? "" : undefined}
                onPointerMove={onPlotPointerMove}
                onPointerLeave={onPlotPointerLeave}
                onClick={onPlotClick}
                onFocus={onPlotFocus}
                onBlur={onPlotBlur}
                onKeyDown={onPlotKeyDown}
              >
                <div className={styles.grid} aria-hidden="true">
                  {ticks.map(value => <span key={value} className={styles.gridline} style={{ left: `calc(${value} / var(--axis) * 100%)` }} />)}
                </div>
                <div className={styles.links} aria-hidden="true">
                  {model.links.map(link =>
                    now >= link.show ? (
                      <span
                        key={link.key}
                        className={styles.link}
                        data-shape={link.shape}
                        data-dir={link.dir}
                        data-draw={draw || undefined}
                        data-hot={path?.hot.has(link.key) || undefined}
                        style={{
                          "--c": link.color,
                          top: link.top,
                          height: link.height,
                          left: `calc(${link.x1} / var(--axis) * 100% - ${link.shape === "in" ? 0 : 0.75}px)`,
                          width: `calc(${link.x2 - link.x1} / var(--axis) * 100% + 0.75px)`,
                        } as CSSProperties}
                      />
                    ) : null,
                  )}
                </div>
                {model.byRow.map((list, row) => (
                  <div key={model.rows[row].id} className={styles.row} role="group" aria-labelledby={`${id}-row-${row}`} style={{ "--c": model.rows[row].color, top: PAD + row * ROW } as CSSProperties}>
                    {list.map(span => {
                      if (now <= span.start) return null;
                      const end = span.end ?? Math.max(now, span.start);
                      const state = now >= end && !span.open ? "done" : "active";
                      return (
                        <SpanButton
                          key={span.id}
                          span={span}
                          state={state}
                          end={span.open ? axis : end}
                          label={spanName(span, model.rows[row].name, span.open ? Math.round(now * 10) / 10 : now)}
                          pressed={pinned === span.id}
                          dim={path ? !path.lit.has(span.id) : false}
                          tabbable={tabId === span.id}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className={styles.ports} aria-hidden="true">
                  {model.links.map(link =>
                    now >= link.show ? (
                      <span
                        key={link.key}
                        className={styles.port}
                        data-draw={draw || undefined}
                        data-hot={path?.hot.has(link.key) || undefined}
                        style={{ "--c": link.color, top: link.portTop, left: `calc(${link.at} / var(--axis) * 100%)`, "--delay": link.shape === "in" ? "260ms" : "0ms" } as CSSProperties}
                      />
                    ) : null,
                  )}
                </div>
                <div className={styles.playhead} data-settled={finished || undefined} aria-hidden="true" />
                <div className={styles.axis} data-live={live || undefined} onPointerDown={onAxisPointerDown} onPointerMove={onAxisPointerMove} onPointerUp={onAxisPointerUp} onPointerCancel={onAxisPointerUp}>
                  {ticks.map(value => <span key={value} className={styles.tick} aria-hidden="true" style={{ left: `calc(${value} / var(--axis) * 100%)` }}>{value}s</span>)}
                  {!live && (
                    <span
                      className={styles.knob}
                      role="slider"
                      tabIndex={0}
                      aria-label="Run time"
                      aria-orientation="horizontal"
                      aria-valuemin={0}
                      aria-valuemax={Number(duration.toFixed(1))}
                      aria-valuenow={Number(Math.min(now, duration).toFixed(1))}
                      aria-valuetext={`${secs(Math.min(now, duration))} of ${secs(duration)}`}
                      data-active={scrubbing || undefined}
                      onKeyDown={onKnobKeyDown}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          {!live && (
            <div className={styles.controls}>
              <Button variant="secondary" size="sm" className={styles.iconButton} aria-label={playLabel} onClick={togglePlay}>
                <span className={styles.glyph} data-playing={playing || undefined} aria-hidden="true">
                  <Play className={styles.glyphPlay} />
                  <Pause className={styles.glyphPause} />
                </span>
              </Button>
              <Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Restart" onClick={restart}>
                <RotateCcw aria-hidden />
              </Button>
              {speedOptions.length > 1 && <SegmentedControl label="Playback speed" options={speedOptions} value={String(speed)} onValueChange={changeSpeed} />}
            </div>
          )}
          <ul className={styles.legend} aria-label="Legend">
            <li><span className={styles.swatch} data-kind="thinking" aria-hidden="true" />Thinking</li>
            <li><span className={styles.swatch} data-kind="tool" aria-hidden="true" />Tool call</li>
            <li><span className={styles.swatch} data-kind="waiting" aria-hidden="true" />Waiting</li>
            <li><CornerDownRight className={styles.legendIcon} aria-hidden />Handoff</li>
            <li><CircleX className={styles.legendFailed} aria-hidden />Failed</li>
          </ul>
        </footer>
      </div>

      <AnimatePresence>
        {card && cardSpan && cardAgent && (
          <motion.div
            key="card"
            className={styles.cardLayer}
            aria-hidden="true"
            initial={{ opacity: 0, x: card.x, y: card.y }}
            animate={{ opacity: 1, x: card.x, y: card.y }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : { x: MORPH, y: MORPH, opacity: { duration: motionTokens.duration.fast } }}
          >
            <div style={{ transform: card.below ? undefined : "translateY(-100%)" }}>
              <motion.div className={styles.card} initial={false} animate={cardHeight == null ? undefined : { height: cardHeight }} transition={reduced ? { duration: 0 } : MORPH}>
                <div ref={measureCard}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div key={cardSpan.id} className={styles.cardBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
                      <p className={styles.cardHead} style={{ "--c": cardAgent.color } as CSSProperties}>
                        <span className={styles.dot} />
                        <span className={styles.cardAgent}>{cardAgent.name}</span>
                        {cardAgent.model && <span className={styles.cardModel}>{cardAgent.model}</span>}
                      </p>
                      <p className={styles.cardLabel}>{cardSpan.label}</p>
                      <p className={styles.cardMeta}>
                        {cardSpan.toolName ? (
                          <span className={styles.cardTool}>
                            {cardSpan.mark && <span className={styles.mark}>{cardSpan.mark}</span>}
                            {cardSpan.toolName}
                          </span>
                        ) : (
                          <span>{KIND_LABEL[cardSpan.kind]}</span>
                        )}
                        <span className={styles.sep}>·</span>
                        <span className={styles.tabular}>{secs((cardSpan.end ?? now) - cardSpan.start)}</span>
                        {cardSpan.tokens ? (
                          <>
                            <span className={styles.sep}>·</span>
                            <span className={styles.tabular}>{number.format(cardSpan.tokens)} tokens</span>
                          </>
                        ) : null}
                      </p>
                      {cardSpan.status === "failed" ? (
                        <p className={styles.cardFailed}>
                          <CircleX />
                          <span>Failed{cardSpan.detail ? `: ${cardSpan.detail}` : ""}</span>
                        </p>
                      ) : cardSpan.detail ? (
                        <p className={styles.cardNote}>
                          {cardSpan.retry && <RotateCw />}
                          <span>{cardSpan.detail}</span>
                        </p>
                      ) : null}
                      {cardSpan.notes.map(note => (
                        <p key={note} className={styles.cardNote}>
                          <CornerDownRight />
                          <span>{note}</span>
                        </p>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </section>
  );
}

export default AgentTimeline;
