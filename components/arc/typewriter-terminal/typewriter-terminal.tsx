"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, Pause, Play, RotateCcw, TriangleAlert, X } from "lucide-react";
import { CopyButton } from "../copy-button/copy-button";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./typewriter-terminal.module.css";

export type TypewriterTerminalTone = "default" | "muted" | "success" | "warning" | "danger" | "accent";

export type TypewriterTerminalOutput =
  | string
  | { text: string; tone?: TypewriterTerminalTone; delay?: number }
  | { kind: "progress"; label: string; duration?: number }
  | { kind: "task"; label: string; done?: string; duration?: number };

export interface TypewriterTerminalStep {
  command: string;
  output?: TypewriterTerminalOutput[];
  /** Working directory shown in this prompt and every later one. */
  cwd?: string;
  /** Rest in seconds after the output. */
  pause?: number;
}

export interface TypewriterTerminalProps {
  steps?: TypewriterTerminalStep[];
  title?: string;
  cwd?: string;
  symbol?: string;
  speed?: number;
  paused?: boolean;
  loop?: boolean;
  rows?: number;
  copyable?: boolean;
  accent?: string;
  label?: string;
  caption?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_STEPS: TypewriterTerminalStep[] = [
  {
    command: "npx create-next-app@latest acme --ts --app",
    output: [
      { text: "Creating a new Next.js app in ~/acme", tone: "muted" },
      { kind: "progress", label: "Installing dependencies", duration: 1.7 },
      { text: "Success! Created acme in 6.4s", tone: "success" },
    ],
  },
  {
    command: "cd acme && npx shadcn@latest add @uiarc/button",
    output: [
      { kind: "task", label: "Resolving @uiarc/button", done: "0.4s", duration: 0.7 },
      { kind: "task", label: "Writing components/button.tsx", done: "0.2s", duration: 0.5 },
      { text: "Added 2 files to registry/components", tone: "success" },
    ],
  },
  {
    command: "npm run dev",
    cwd: "~/acme",
    output: [
      { text: "Next.js 16.0 with Turbopack", tone: "muted", delay: 0.4 },
      { text: "Local: http://localhost:3000" },
      { text: "Ready in 812ms", tone: "success", delay: 0.4 },
    ],
  },
];

type TokenKind = "program" | "plain" | "path" | "flag" | "op" | "string" | "env";

/** Colors one command as shell syntax, one kind per character. */
function tokenize(command: string): TokenKind[] {
  const kinds: TokenKind[] = [];
  let expectProgram = true;
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (/\s/.test(ch)) { kinds.push("plain"); i += 1; continue; }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < command.length && command[j] !== ch) j += 1;
      j = Math.min(command.length, j + 1);
      for (let k = i; k < j; k += 1) kinds.push("string");
      i = j;
      expectProgram = false;
      continue;
    }
    const op = /^(&&|\|\||[|;><&])/.exec(command.slice(i));
    if (op) {
      for (let k = 0; k < op[0].length; k += 1) kinds.push("op");
      i += op[0].length;
      expectProgram = op[0] !== ">" && op[0] !== "<";
      continue;
    }
    let j = i;
    while (j < command.length && !/[\s|;&><]/.test(command[j])) j += 1;
    const word = command.slice(i, j);
    let kind: TokenKind;
    if (expectProgram && /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) kind = "env";
    else if (expectProgram) { kind = "program"; expectProgram = false; }
    else if (word.startsWith("-")) kind = "flag";
    else if (/[/@~]|\.\w/.test(word)) kind = "path";
    else kind = "plain";
    for (let k = i; k < j; k += 1) kinds.push(kind);
    i = j;
  }
  return kinds;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Line =
  | { type: "prompt"; step: number; cwd: string; command: string; kinds: TokenKind[]; at: number; keys: number[] }
  | { type: "text"; step: number; text: string; tone: TypewriterTerminalTone; at: number }
  | { type: "progress"; step: number; label: string; at: number; duration: number }
  | { type: "task"; step: number; label: string; done?: string; at: number; duration: number };

interface Session {
  lines: Line[];
  groups: number[][];
  starts: number[];
  total: number;
  commands: string[];
}

const THINK_FIRST = 1.07;
const THINK = 0.6;
const ENTER = 0.5;
const GAP_TEXT = 0.16;
const GAP_LIVE = 0.08;
const REST = 0.82;
const TAIL = 0.18;

function buildSession(steps: TypewriterTerminalStep[], cwd: string): Session {
  const lines: Line[] = [];
  const groups: number[][] = [];
  const starts: number[] = [];
  let t = 0;
  let dir = cwd;
  steps.forEach((step, index) => {
    if (step.cwd) dir = step.cwd;
    const random = seeded(hash(`${index}:${step.command}`));
    const group: number[] = [];
    starts.push(t);
    const at = t;
    t += index === 0 ? THINK_FIRST : THINK;
    const keys: number[] = [];
    for (let i = 0; i < step.command.length; i += 1) {
      const ch = step.command[i];
      const previous = step.command[i - 1];
      if (i > 0) {
        let gap = 0.026 + random() * 0.03;
        if (previous === " ") gap += 0.03 + random() * 0.08;
        if (ch === " ") gap += random() * 0.04;
        if (/[A-Z@&|"'_~!$*(){}<>?+:]/.test(ch) && ch !== previous) gap += 0.03 + random() * 0.06;
        if (random() < 0.05) gap += 0.1 + random() * 0.15;
        t += gap;
      }
      keys.push(t);
    }
    group.push(lines.length);
    lines.push({ type: "prompt", step: index, cwd: dir, command: step.command, kinds: tokenize(step.command), at, keys });
    t += ENTER;
    let first = true;
    for (const item of step.output ?? []) {
      const output = typeof item === "string" ? { text: item } : item;
      group.push(lines.length);
      if ("kind" in output) {
        if (!first) t += GAP_LIVE;
        const duration = Math.max(0.1, output.duration ?? (output.kind === "progress" ? 1.2 : 0.6));
        if (output.kind === "progress") lines.push({ type: "progress", step: index, label: output.label, at: t, duration });
        else lines.push({ type: "task", step: index, label: output.label, done: output.done, at: t, duration });
        t += duration;
      } else {
        if (!first) t += GAP_TEXT;
        t += Math.max(0, output.delay ?? 0);
        lines.push({ type: "text", step: index, text: output.text, tone: output.tone ?? "default", at: t });
      }
      first = false;
    }
    t += Math.max(0, step.pause ?? REST);
    groups.push(group);
  });
  groups.push([lines.length]);
  lines.push({ type: "prompt", step: steps.length, cwd: dir, command: "", kinds: [], at: t, keys: [] });
  return { lines, groups, starts, total: t + TAIL, commands: steps.map(step => step.command) };
}

const CURVE: [number, number][] = [[0, 0], [0.15, 33], [0.21, 35], [0.39, 50], [0.46, 50], [0.63, 56], [0.82, 90], [1, 100]];
/** Quick start, a stall around the middle, a steady finish. */
function progressAt(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 100;
  for (let i = 1; i < CURVE.length; i += 1) {
    if (x <= CURVE[i][0]) {
      const [x0, y0] = CURVE[i - 1];
      const [x1, y1] = CURVE[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 100;
}

const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function describe(line: Line): string {
  if (line.type === "text") return line.text;
  if (line.type === "progress") return `${line.label}, complete.`;
  if (line.type === "task") return `${line.label}, done.`;
  return "";
}

function ToneIcon({ tone }: { tone: TypewriterTerminalTone }) {
  if (tone === "success") return <span className={styles.glyph}><Check size={14} strokeWidth={2} /></span>;
  if (tone === "warning") return <span className={styles.glyph}><TriangleAlert size={14} strokeWidth={2} /></span>;
  if (tone === "danger") return <span className={styles.glyph}><X size={14} strokeWidth={2} /></span>;
  return null;
}

export function TypewriterTerminal({
  steps = DEFAULT_STEPS,
  title = "zsh",
  cwd = "~",
  symbol = "$",
  speed = 1,
  paused = false,
  loop = true,
  rows = 11,
  copyable = true,
  accent,
  label = "Terminal session",
  caption,
  className,
  style,
}: TypewriterTerminalProps) {
  const reduced = useReducedMotion();
  const session = useMemo(() => buildSession(steps, cwd), [steps, cwd]);
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLSpanElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);

  const engine = useRef({
    time: 0,
    rate: 0,
    playing: true,
    dragging: false,
    glide: null as null | { from: number; to: number; elapsed: number; duration: number; then: boolean },
    hold: 0,
    clearing: 0,
    y: 0,
    vy: 0,
    targetY: 0,
    visible: true,
    counts: [] as number[],
    shown: [] as boolean[],
    done: [] as boolean[],
    pct: [] as number[],
    spin: [] as number[],
    caret: -1,
    typing: false,
    second: -1,
    stepIndex: -2,
    dirty: true,
  });
  const propsRef = useRef({ speed, paused, loop, reduced, session });
  useEffect(() => {
    propsRef.current = { speed, paused, loop, reduced, session };
  });

  const stepAt = useCallback((time: number) => {
    let index = -1;
    for (let i = 0; i < session.starts.length; i += 1) if (time >= session.starts[i] - 1e-6) index = i;
    return index;
  }, [session]);

  const valueText = useCallback((time: number) => {
    const index = stepAt(time);
    if (time <= 0.001 || index < 0) return "Start";
    return `Step ${index + 1} of ${session.commands.length}: ${session.commands[index]}`;
  }, [session, stepAt]);

  /** Writes the screen for one session time, touching only what changed. */
  const paint = useCallback((time: number) => {
    const state = engine.current;
    const content = contentRef.current;
    if (!content) return;
    const nodes = content.querySelectorAll<HTMLElement>("[data-line]");
    let caret = -1;
    let typing = false;
    session.lines.forEach((line, index) => {
      const node = nodes[index];
      if (!node) return;
      const on = time >= line.at;
      if (state.shown[index] !== on) {
        state.shown[index] = on;
        node.toggleAttribute("data-on", on);
        state.dirty = true;
      }
      if (line.type === "prompt") {
        if (on) caret = index;
        let count = 0;
        while (count < line.keys.length && line.keys[count] <= time) count += 1;
        if (on && line.keys.length && time >= line.keys[0] - 0.12 && time <= line.keys[line.keys.length - 1] + 0.18 && caret === index) typing = true;
        const previous = state.counts[index] ?? 0;
        if (previous !== count) {
          const chars = node.querySelector("[data-cmd]")?.children;
          if (chars) for (let i = Math.min(previous, count); i < Math.max(previous, count); i += 1) chars[i]?.toggleAttribute("data-on", i < count);
          state.counts[index] = count;
          state.dirty = true;
        }
      } else if (line.type === "progress") {
        const pct = Math.round(progressAt((time - line.at) / line.duration));
        if (state.pct[index] !== pct) {
          state.pct[index] = pct;
          const fill = node.querySelector<HTMLElement>("[data-fill]");
          const text = node.querySelector<HTMLElement>("[data-pct]");
          if (fill) fill.style.transform = `translate3d(${pct - 100}%, 0, 0)`;
          if (text) text.textContent = `${pct}%`;
        }
        const done = time >= line.at + line.duration;
        if (state.done[index] !== done) { state.done[index] = done; node.toggleAttribute("data-done", done); }
      } else if (line.type === "task") {
        const done = time >= line.at + line.duration;
        if (state.done[index] !== done) { state.done[index] = done; node.toggleAttribute("data-done", done); state.dirty = true; }
        const frame = done ? state.spin[index] ?? 0 : Math.floor(Math.max(0, time - line.at) * 12.5) % BRAILLE.length;
        if (state.spin[index] !== frame) {
          state.spin[index] = frame;
          const spin = node.querySelector<HTMLElement>("[data-spin]");
          if (spin) spin.textContent = BRAILLE[frame];
        }
      }
    });
    if (state.caret !== caret) {
      if (state.caret >= 0) nodes[state.caret]?.querySelector("[data-cmd]")?.removeAttribute("data-caret");
      if (caret >= 0) nodes[caret]?.querySelector("[data-cmd]")?.setAttribute("data-caret", "true");
      state.caret = caret;
    }
    if (state.typing !== typing) {
      state.typing = typing;
      content.toggleAttribute("data-typing", typing);
    }
    const fraction = session.total > 0 ? Math.min(1, Math.max(0, time / session.total)) : 0;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${fraction.toFixed(4)})`;
    if (railRef.current) railRef.current.style.transform = `translate3d(${(fraction * 100).toFixed(3)}cqw, 0, 0)`;
    const second = Math.floor(time);
    if (state.second !== second) {
      state.second = second;
      if (clockRef.current) clockRef.current.textContent = `${clockText(time)} / ${clockText(session.total)}`;
      scrubberRef.current?.setAttribute("aria-valuenow", String(second));
    }
    const stepIndex = time <= 0.001 ? -1 : stepAt(time);
    if (state.stepIndex !== stepIndex) {
      state.stepIndex = stepIndex;
      scrubberRef.current?.setAttribute("aria-valuetext", valueText(time));
    }
    if (state.dirty) {
      state.dirty = false;
      const viewport = viewportRef.current;
      if (viewport) state.targetY = Math.max(0, content.offsetHeight - viewport.clientHeight);
    }
  }, [session, stepAt, valueText]);

  // One rAF loop derives the whole screen from a single session time.
  useEffect(() => {
    const state = engine.current;
    state.counts = [];
    state.shown = [];
    state.done = [];
    state.pct = [];
    state.spin = [];
    state.caret = -1;
    state.second = -1;
    state.stepIndex = -2;
    state.dirty = true;
    contentRef.current?.querySelectorAll("[data-on],[data-caret],[data-done]").forEach(node => {
      node.removeAttribute("data-on");
      node.removeAttribute("data-caret");
      node.removeAttribute("data-done");
    });
    if (reduced) {
      state.time = session.total;
      state.playing = false;
      queueMicrotask(() => { setPlaying(false); setEnded(true); });
    } else {
      state.time = Math.min(state.time, session.total);
    }
    paint(state.time);
    state.y = state.targetY;
    if (contentRef.current) contentRef.current.style.transform = `translate3d(0, ${-state.y}px, 0)`;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = propsRef.current;
      const total = current.session.total;
      const content = contentRef.current;
      if (state.glide) {
        const glide = state.glide;
        glide.elapsed += dt;
        const x = Math.min(1, glide.elapsed / glide.duration);
        state.time = glide.from + (glide.to - glide.from) * easeInOut(x);
        if (x >= 1) {
          state.glide = null;
          if (glide.then) { state.playing = true; setPlaying(true); setEnded(false); }
        }
      } else if (state.clearing > 0) {
        state.clearing += dt;
        const x = Math.min(1, state.clearing / 0.7);
        state.time = total * (1 - easeInOut(x));
        if (content) content.style.opacity = String(Math.max(0, 1 - x * 2.2));
        if (x >= 1) {
          state.clearing = 0;
          state.time = 0;
          state.hold = 0;
          state.y = 0;
          state.vy = 0;
          if (content) content.style.opacity = "";
        }
      } else if (!state.dragging) {
        const target = state.playing && !current.paused && !current.reduced ? 1 : 0;
        state.rate += (target - state.rate) * (1 - Math.exp(-dt * 14));
        if (Math.abs(target - state.rate) < 0.002) state.rate = target;
        if (state.rate > 0) state.time = Math.min(total, state.time + dt * state.rate * Math.max(0.05, current.speed));
        if (state.time >= total && state.playing && !current.paused) {
          if (current.loop && !current.reduced) {
            state.hold += dt;
            if (state.hold > 1.4) state.clearing = 0.0001;
          } else {
            state.playing = false;
            setPlaying(false);
            setEnded(true);
          }
        }
      }
      if (state.clearing > 0) {
        // Clear upward: only the scrubber follows time; the screen keeps its last frame as it fades.
        const fraction = Math.min(1, Math.max(0, state.time / total));
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${fraction.toFixed(4)})`;
        if (railRef.current) railRef.current.style.transform = `translate3d(${(fraction * 100).toFixed(3)}cqw, 0, 0)`;
        state.y += dt * 60;
      } else {
        paint(state.time);
        if (current.reduced || state.dragging) {
          state.y = state.targetY;
          state.vy = 0;
        } else {
          // Critically damped spring toward the newest line.
          const stiffness = 170;
          const damping = 2 * Math.sqrt(stiffness);
          state.vy += (stiffness * (state.targetY - state.y) - damping * state.vy) * dt;
          state.y += state.vy * dt;
          if (Math.abs(state.targetY - state.y) < 0.05 && Math.abs(state.vy) < 0.05) { state.y = state.targetY; state.vy = 0; }
        }
      }
      if (content) content.style.transform = `translate3d(0, ${(-state.y).toFixed(2)}px, 0)`;
    };
    const start = () => {
      if (frame || !state.visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined" && rootRef.current) {
      observer = new IntersectionObserver(entries => {
        state.visible = entries[entries.length - 1]?.isIntersecting ?? true;
        if (state.visible) start(); else stop();
      });
      observer.observe(rootRef.current);
    }
    start();
    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, reduced, paint]);

  const seek = useCallback((time: number, glide: boolean, thenPlay = false) => {
    const state = engine.current;
    const target = Math.min(session.total, Math.max(0, time));
    state.clearing = 0;
    state.hold = 0;
    if (contentRef.current) contentRef.current.style.opacity = "";
    if (glide && !propsRef.current.reduced) {
      state.glide = { from: state.time, to: target, elapsed: 0, duration: thenPlay ? Math.min(0.9, 0.35 + Math.abs(state.time - target) * 0.04) : 0.45, then: thenPlay };
    } else {
      state.glide = null;
      state.time = target;
      if (thenPlay && !propsRef.current.reduced) { state.playing = true; setPlaying(true); }
    }
    setEnded(target >= session.total && !thenPlay);
  }, [session]);

  const toggle = useCallback(() => {
    const state = engine.current;
    if (propsRef.current.reduced) return;
    if (state.time >= session.total && !state.playing) {
      seek(0, true, true);
      setAnnouncement("Replaying from the start");
      return;
    }
    state.playing = !state.playing;
    state.hold = 0;
    setPlaying(state.playing);
    setAnnouncement(state.playing ? "Playing" : "Paused");
  }, [session, seek]);

  const replay = useCallback(() => {
    seek(0, true, true);
    setAnnouncement("Replaying from the start");
  }, [seek]);

  const jump = useCallback((direction: -1 | 1 | "start" | "end") => {
    const state = engine.current;
    const now = state.glide ? state.glide.to : state.time;
    let target: number;
    if (direction === "start") target = 0;
    else if (direction === "end") target = session.total;
    else if (direction === 1) target = session.starts.find(start => start > now + 0.05) ?? session.total;
    else target = [...session.starts].reverse().find(start => start < now - 0.05) ?? 0;
    seek(target, true);
    setAnnouncement(target >= session.total ? valueText(target) : target <= 0.001 ? "Start" : valueText(target + 0.01));
  }, [session, seek, valueText]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === "ArrowRight" || key === "ArrowUp" || key === "PageUp") jump(1);
    else if (key === "ArrowLeft" || key === "ArrowDown" || key === "PageDown") jump(-1);
    else if (key === "Home") jump("start");
    else if (key === "End") jump("end");
    else if (key === " " || key === "k" || key === "K") toggle();
    else return;
    event.preventDefault();
  };

  const timeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { rect, time: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))) * session.total };
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const state = engine.current;
    state.dragging = true;
    state.glide = null;
    state.clearing = 0;
    state.hold = 0;
    if (contentRef.current) contentRef.current.style.opacity = "";
    state.time = timeFromPointer(event).time;
    setEnded(false);
    if (propsRef.current.reduced) paint(state.time);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = engine.current;
    if (!state.dragging) return;
    state.time = timeFromPointer(event).time;
    if (propsRef.current.reduced) paint(state.time);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = engine.current;
    if (!state.dragging) return;
    state.dragging = false;
    const { rect, time } = timeFromPointer(event);
    const near = session.starts.find(start => Math.abs((start - time) / session.total) * rect.width <= 6);
    state.time = near ?? time;
    state.rate = 0;
    if (propsRef.current.reduced) paint(state.time);
    setEnded(state.time >= session.total && !state.playing);
    setAnnouncement(valueText(state.time + 0.01));
  };

  const transcript = useMemo(() => session.groups.slice(0, -1).map(group => {
    const [head, ...rest] = group.map(index => session.lines[index]);
    return { command: head.type === "prompt" ? head.command : "", output: rest.map(describe).join(" ") };
  }), [session]);

  const rootStyle = { "--tt-rows": rows, ...(accent ? { "--tt-accent": accent } : null), ...style } as CSSProperties;
  const showPause = playing && !paused && !reduced;
  const playLabel = showPause ? "Pause typing" : ended ? "Replay typing" : "Play typing";

  return (
    <figure ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} aria-label={label}>
      <div className={styles.window}>
        <div className={styles.bar}>
          <span className={styles.lights} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.title}>{title}</span>
          <span className={styles.barEnd}>
            {copyable && <CopyButton value={session.commands.join("\n")} label="Copy commands" iconOnly variant="plain" />}
          </span>
        </div>
        <div ref={viewportRef} className={styles.viewport} aria-hidden="true">
          <div ref={contentRef} className={styles.content}>
            {session.groups.map((group, groupIndex) => (
              <div key={groupIndex} className={styles.group}>
                {group.map(index => {
                  const line = session.lines[index];
                  if (line.type === "prompt") {
                    return (
                      <div key={index} data-line="true" className={styles.promptLine}>
                        <span className={styles.cwd}>{line.cwd}</span>
                        <span className={styles.symbol}>{symbol}</span>
                        <span data-cmd="true" className={styles.cmd}>
                          {[...line.command].map((ch, i) => <span key={i} className={styles[line.kinds[i] ?? "plain"]}>{ch}</span>)}
                        </span>
                      </div>
                    );
                  }
                  if (line.type === "progress") {
                    return (
                      <div key={index} data-line="true" className={`${styles.out} ${styles.progress}`}>
                        <span className={styles.progressLabel}>{line.label}</span>
                        <span className={styles.bar2}><span data-fill="true" className={styles.fill} style={{ transform: "translate3d(-100%, 0, 0)" }} /></span>
                        <span data-pct="true" className={styles.pct}>0%</span>
                      </div>
                    );
                  }
                  if (line.type === "task") {
                    return (
                      <div key={index} data-line="true" className={`${styles.out} ${styles.task}`}>
                        <span className={styles.glyph}><span data-spin="true" className={styles.spin}>{BRAILLE[0]}</span><Check size={14} strokeWidth={2} className={styles.tick} /></span>
                        <span>{line.label}</span>
                        {line.done && <span className={styles.took}>{line.done}</span>}
                      </div>
                    );
                  }
                  return (
                    <div key={index} data-line="true" className={styles.out} data-tone={line.tone}>
                      <ToneIcon tone={line.tone} />
                      <span className={styles.text}>
                        {line.text === "" ? "\u00a0" : line.text.split(URL_PATTERN).map((part, i) => (i % 2 ? <span key={i} className={styles.link}>{part}</span> : part))}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.button} aria-label={playLabel} onClick={toggle}>
          <span className={styles.icon} data-show={showPause ? "" : undefined}><Pause size={16} strokeWidth={1.75} /></span>
          <span className={styles.icon} data-show={showPause ? undefined : ""}><Play size={16} strokeWidth={1.75} /></span>
        </button>
        <div
          ref={scrubberRef}
          className={styles.scrubber}
          role="slider"
          tabIndex={0}
          aria-label="Session position"
          aria-valuemin={0}
          aria-valuemax={Math.round(session.total)}
          aria-valuenow={0}
          aria-valuetext="Start"
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={styles.track}>
            <span ref={fillRef} className={styles.trackFill} style={{ transform: "scaleX(0)" }} />
            {session.starts.slice(1).map((start, index) => <span key={index} className={styles.mark} style={{ left: `${(start / session.total) * 100}%` }} />)}
            <span ref={railRef} className={styles.thumbRail}><span className={styles.thumb} /></span>
          </div>
        </div>
        <span ref={clockRef} className={styles.clock} aria-hidden="true">{`0:00 / ${clockText(session.total)}`}</span>
        <button type="button" className={styles.button} aria-label="Replay from the start" onClick={replay}>
          <RotateCcw size={16} strokeWidth={1.75} />
        </button>
      </div>
      <ol className={styles.srOnly}>
        {transcript.map((entry, index) => <li key={index}>Command: {entry.command}. {entry.output}</li>)}
      </ol>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

export default TypewriterTerminal;
