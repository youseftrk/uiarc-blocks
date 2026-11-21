"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./ai-mascot.module.css";

export type MascotStatus = "idle" | "listening" | "thinking" | "writing" | "done" | "error";
export type MascotTone = "accent" | "ink" | "soft";

export interface AiMascotProps {
  /** What the assistant is doing. Leave unset to play through every state on a loop. */
  status?: MascotStatus;
  size?: number;
  tone?: MascotTone;
  color?: string;
  eyeColor?: string;
  followPointer?: boolean | "page";
  companion?: boolean;
  ground?: boolean;
  paused?: boolean;
  name?: string;
  label?: string;
  announce?: boolean;
  onStatusChange?: (status: MascotStatus) => void;
  className?: string;
  style?: CSSProperties;
}

export const MASCOT_STATUSES: MascotStatus[] = ["idle", "listening", "thinking", "writing", "done", "error"];


interface Geo {
  compact: boolean; view: string; eyeW: number; eyeL: number; gazeX: number; gazeY: number; dotR: number; starS: number;
  orbit: { cx: number; cy: number; rx: number; ry: number };
  home: [number, number]; listen: [number, number]; done: [number, number]; err: [number, number]; x0: number; x1: number; ly: number;
}
interface Pose {
  bx: number; by: number; brot: number; bsx: number; bsy: number; gx: number; gy: number; gk: number; pointer: number; eyeS: number; happy: number; worry: number;
  blinkable: number; dx: number; dy: number; dr: number; dop: number; back: number; star: number; srot: number; star2: number; lx: number; lop: number;
}
interface PoseInput { t: number; te: number; geo: Geo; glance: [number, number]; still: boolean }

const LABELS: Record<MascotStatus, string> = { idle: "Ready", listening: "Listening", thinking: "Thinking", writing: "Writing", done: "Done", error: "Something went wrong" };
const FULL: Geo = { compact: false, view: "4 8 112 112", eyeW: 8, eyeL: 8, gazeX: 8, gazeY: 6, dotR: 4.5, starS: 1, orbit: { cx: 60, cy: 25, rx: 46, ry: 9 }, home: [94, 24], listen: [91, 20], done: [95, 23], err: [93, 32], x0: 36, x1: 84, ly: 115 };
const COMPACT: Geo = { compact: true, view: "18 16 84 84", eyeW: 10.5, eyeL: 6.5, gazeX: 6.5, gazeY: 4.5, dotR: 7, starS: 1.4, orbit: { cx: 60, cy: 26, rx: 35, ry: 6.5 }, home: [92, 26], listen: [90, 24], done: [90, 27], err: [91, 31], x0: 38, x1: 82, ly: 111 };
const TAU = 2 * Math.PI;
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const easeInOut = (value: number) => (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);

function poseFor(status: MascotStatus, { t, te, geo, glance, still }: PoseInput): Pose {
  const breath = still ? 0 : Math.sin((TAU * t) / 3.6);
  const sway = still ? 0 : Math.sin((TAU * t) / 7.2);
  const drift = still ? 0 : Math.sin((TAU * t) / 4.8);
  const base: Pose = {
    bx: 0, by: -1.3 * breath, brot: 0.8 * sway, bsx: 1 - 0.012 * breath, bsy: 1 + 0.018 * breath, gx: 0, gy: 0, gk: 260, pointer: 1, eyeS: 1, happy: 0, worry: 0, blinkable: 1,
    dx: geo.home[0] + 1.2 * drift, dy: geo.home[1] + 1.8 * Math.sin((TAU * t) / 3.6 + 1.1) * +!still, dr: 1, dop: 1, back: 0, star: 0, srot: 0, star2: 0, lx: geo.x0, lop: 0,
  };
  switch (status) {
    case "idle":
      return { ...base, gx: glance[0] * geo.gazeX, gy: glance[1] * geo.gazeY, gk: 900 };
    case "listening": {
      const level = still ? 0.4 : 0.5 + 0.5 * (0.55 * Math.sin(7.1 * t) + 0.3 * Math.sin(11.3 * t + 1.3) + 0.15 * Math.sin(3.7 * t));
      return { ...base, by: -1 - (still ? 0 : 0.55 * Math.sin((TAU * t) / 1.7)), brot: 0, bsx: 1.03 - 0.008 * breath, bsy: 1.04 + 0.012 * breath, gx: 0, gy: 0.08 * geo.gazeY, gk: 220, eyeS: 1.16, dx: geo.listen[0], dy: geo.listen[1], dr: 0.92 + 0.3 * level };
    }
    case "thinking": {
      const { cx, cy, rx, ry } = geo.orbit;
      const angle = still ? 0.7 * Math.PI : -0.5 + (TAU / 2.4) * te;
      const sine = Math.sin(angle);
      const x = cx + rx * Math.cos(angle);
      return { ...base, by: -1 - 0.8 * breath, brot: 3 + (still ? 0 : 0.6 * Math.sin((TAU * t) / 4)), gx: ((x - cx) / rx) * geo.gazeX * 0.55, gy: -geo.gazeY + 0.8 * sine, gk: 70, pointer: 0, dx: x, dy: cy + ry * sine, dr: 0.84 + 0.16 * sine, dop: 0.8 + (0.2 * (sine + 1)) / 2, back: clamp(0.5 - 4 * sine) };
    }
    case "writing": {
      let x: number;
      let y: number;
      let lineX: number;
      let lineOpacity: number;
      const phase = still ? 0.804 : te % 1.75;
      if (phase < 1.34) {
        const p = phase / 1.34;
        const eased = -(Math.cos(Math.PI * p) - 1) / 2 + 0.012 * Math.sin(4 * TAU * p);
        x = geo.x0 + (geo.x1 - geo.x0) * eased;
        y = geo.ly + 0.5 * Math.sin(7 * TAU * p);
        lineX = x;
        lineOpacity = clamp((x - geo.x0) / 4);
      } else {
        const p = (phase - 1.34) / (1.75 - 1.34);
        x = geo.x1 + (geo.x0 - geo.x1) * easeInOut(p);
        y = geo.ly - 7 * Math.sin(Math.PI * p);
        lineX = geo.x1;
        lineOpacity = 1 - (1 - (1 - p) * (1 - p));
      }
      const compact = geo.compact;
      return { ...base, by: -0.6 * breath + (still ? 0 : 0.7 * Math.sin((TAU * te) / 0.875)), brot: (x - 60) * 0.045, gx: ((x - 60) / ((geo.x1 - geo.x0) / 2)) * geo.gazeX * 0.5, gy: 0.75 * geo.gazeY, gk: 520, pointer: 0, dx: x, dy: y, dop: +!compact, dr: compact ? 0.6 : 1, lx: compact ? geo.x0 : lineX, lop: compact ? 0 : lineOpacity };
    }
    case "done":
      return { ...base, by: -1.5 - 1.1 * breath, bsy: 1.015 + 0.016 * breath, gx: 0, gy: -0.25 * geo.gazeY, gk: 160, eyeS: 1.04, happy: 1, blinkable: 0, dx: geo.done[0], dy: geo.done[1], dr: 1 + (still ? 0 : 0.07 * Math.sin((TAU * t) / 2.2)), star: 1, srot: still ? 0 : 10 * Math.sin((TAU * t) / 3.2), star2: +!geo.compact };
    case "error":
      return { ...base, by: 1 - 0.5 * breath, brot: 0, bsx: 1.01 - 0.006 * breath, bsy: 0.985 + 0.01 * breath, gx: 0, gy: 0.42 * geo.gazeY, gk: 220, pointer: 0.6, eyeS: 0.86, worry: 1, dx: geo.err[0], dy: geo.err[1], dop: 0.55, dr: 0.85 };
  }
}

const BODY_PATH = "M60 28C84 28 96 44 96 64C96 84 82 96 60 96C38 96 24 84 24 64C24 44 36 28 60 28Z";
const STAR_PATH = "M0 -7C.9 -1.6 1.6 -.9 7 0C1.6 .9 .9 1.6 0 7C-.9 1.6 -1.6 .9 -7 0C-1.6 -.9 -.9 -1.6 0 -7Z";
const num = (value: number) => (Math.round(100 * value) / 100).toString();

function frameFor(pose: Pose, gaze: [number, number], blink: number, geo: Geo) {
  const { bx, by, brot, bsx, bsy } = pose;
  const body = `translate(${num(bx)} ${num(by)}) translate(60 96) rotate(${num(brot)}) scale(${num(bsx)} ${num(bsy)}) translate(-60 -96)`;
  const happy = clamp(pose.happy);
  const open = Math.max(0.06, blink * clamp(1 - 2 * happy)) * pose.eyeS;
  const smile = clamp(2 * happy - 1);
  const pill = [0, 1].map(side => {
    const x = 47 + 26 * side + gaze[0] + (side === 0 ? -1 : 1) * (pose.eyeS - 1) * 3;
    const y = 60 + gaze[1];
    return `translate(${num(x)} ${num(y)}) scale(${num(pose.eyeS)} ${num(open)})`;
  });
  const arc = [0, 1].map(side => {
    const x = 47 + 26 * side + 0.4 * gaze[0];
    const y = 59 + 0.4 * gaze[1];
    return `translate(${num(x)} ${num(y)}) scale(${num(pose.eyeS)} ${num(Math.max(0.06, smile))})`;
  });
  const worry = clamp(pose.worry);
  const brows = `translate(${num(0.5 * gaze[0])} ${num(0.4 * gaze[1] + (1 - worry) * 3)})`;
  const dotR = geo.dotR * pose.dr * clamp(1 - pose.star);
  const back = clamp(pose.back);
  const dotOpacity = clamp(pose.dop);
  const over = clamp((1.1 - (((pose.dx - 60) / 36) ** 2 + ((pose.dy - 62 - by) / 34) ** 2)) / 0.3);
  const starScale = geo.starS * pose.dr * clamp(pose.star);
  const star = `translate(${num(pose.dx)} ${num(pose.dy)}) rotate(${num(pose.srot)}) scale(${num(Math.max(0.001, starScale))})`;
  const second = clamp(pose.star2);
  const star2 = `translate(${num(pose.dx + 11)} ${num(pose.dy + 15)}) rotate(${num(-(1.4 * pose.srot))}) scale(${num(Math.max(0.001, 0.5 * second * (2 - pose.dr)))})`;
  const lift = -by;
  const shadow = `translate(60 104) scale(${num((1 - 0.018 * lift) * bsx)} 1)`;
  return {
    body, pill, arc, arcOpacity: num(clamp((happy - 0.45) / 0.15)), brows, browOpacity: num(worry),
    dotFront: { cx: num(pose.dx), cy: num(pose.dy), r: num(dotR), opacity: num(dotOpacity * (1 - back)), on: num(over * dotOpacity * (1 - back)) },
    dotBack: { cx: num(pose.dx), cy: num(pose.dy), r: num(dotR), opacity: num(dotOpacity * back) },
    star, starOpacity: num(clamp(4 * pose.star) * dotOpacity), star2, star2Opacity: num(clamp(3 * second)),
    line: { x2: num(Math.max(geo.x0, pose.lx)), opacity: num(clamp(pose.lop) * clamp((pose.lx - geo.x0) / 4)) }, shadow,
  };
}
type Frame = ReturnType<typeof frameFor>;

const TOUR: [MascotStatus, number][] = [["idle", 2.6], ["listening", 2.3], ["thinking", 2.6], ["writing", 3.5], ["done", 2.3], ["idle", 1.8], ["thinking", 1.7], ["error", 2], ["idle", 1.4]];
const between = (low: number, high: number) => low + Math.random() * (high - low);

interface EngineState {
  clock: number;
  current: { status: MascotStatus; start: number };
  from: { kind: "snap"; pose: Pose } | { kind: "live"; status: MascotStatus; start: number } | null;
  transStart: number;
  pose: Pose;
  gaze: [number, number];
  velocity: [number, number];
  blinkAt: number;
  blinkStart: number;
  glance: [number, number];
  glanceAt: number;
  autoIndex: number;
  autoAt: number;
  pointer: { active: boolean; gx: number; gy: number; weight: number };
  dirty: boolean;
}

function mixPose(from: Pose, to: Pose, amount: number): Pose {
  const out = {} as Pose;
  for (const key in from) {
    const name = key as keyof Pose;
    out[name] = from[name] + (to[name] - from[name]) * amount;
  }
  return out;
}

export function AiMascot({
  status,
  size = 96,
  tone = "accent",
  color,
  eyeColor,
  followPointer = true,
  companion = true,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: AiMascotProps) {
  const clipId = `mascot-${useId().replace(/:/g, "")}`;
  const geo = size < 56 ? COMPACT : FULL;
  const grounded = ground && !geo.compact;
  const [auto, setAuto] = useState<MascotStatus>(TOUR[0][0]);
  const current = status ?? auto;
  const rootRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const pillA = useRef<SVGGElement>(null);
  const pillB = useRef<SVGGElement>(null);
  const arcA = useRef<SVGGElement>(null);
  const arcB = useRef<SVGGElement>(null);
  const browsRef = useRef<SVGGElement>(null);
  const dotFrontRef = useRef<SVGCircleElement>(null);
  const dotBackRef = useRef<SVGCircleElement>(null);
  const glintRef = useRef<SVGCircleElement>(null);
  const starRef = useRef<SVGPathElement>(null);
  const star2Ref = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const pills = [pillA, pillB];
  const arcs = [arcA, arcB];
  const [first] = useState(() => {
    const pose = poseFor(current, { t: 0, te: 10, geo, glance: [0, 0], still: true });
    return { pose, status: current };
  });
  const restPose = poseFor(current, { t: 0, te: 10, geo, glance: [0, 0], still: true });
  const rest = frameFor(restPose, [restPose.gx, restPose.gy], 1, geo);
  const live = useRef({ status, geo, paused, onStatusChange, followPointer });
  useLayoutEffect(() => {
    live.current = { status, geo, paused, onStatusChange, followPointer };
  });
  const kick = useRef(() => {});
  const engine = useRef<EngineState | null>(null);
  const getEngine = () => {
    if (!engine.current)
      engine.current = {
        clock: 0, current: { status: first.status, start: -10 }, from: { kind: "snap", pose: first.pose }, transStart: 0, pose: first.pose, gaze: [first.pose.gx, first.pose.gy], velocity: [0, 0],
        blinkAt: 2.2, blinkStart: -1, glance: [0, 0], glanceAt: 1.4, autoIndex: 0, autoAt: TOUR[0][1], pointer: { active: false, gx: 0, gy: 0, weight: 0 }, dirty: true,
      };
    return engine.current;
  };
  const apply = (frame: Frame) => {
    bodyRef.current?.setAttribute("transform", frame.body);
    pills.forEach((ref, index) => ref.current?.setAttribute("transform", frame.pill[index]));
    arcs.forEach((ref, index) => {
      ref.current?.setAttribute("transform", frame.arc[index]);
      ref.current?.setAttribute("opacity", frame.arcOpacity);
    });
    browsRef.current?.setAttribute("transform", frame.brows);
    browsRef.current?.setAttribute("opacity", frame.browOpacity);
    const front = dotFrontRef.current;
    if (front) {
      front.setAttribute("cx", frame.dotFront.cx);
      front.setAttribute("cy", frame.dotFront.cy);
      front.setAttribute("r", frame.dotFront.r);
      front.setAttribute("opacity", frame.dotFront.opacity);
    }
    const glint = glintRef.current;
    if (glint) {
      glint.setAttribute("cx", frame.dotFront.cx);
      glint.setAttribute("cy", frame.dotFront.cy);
      glint.setAttribute("r", frame.dotFront.r);
      glint.setAttribute("opacity", frame.dotFront.on);
    }
    const back = dotBackRef.current;
    if (back) {
      back.setAttribute("cx", frame.dotBack.cx);
      back.setAttribute("cy", frame.dotBack.cy);
      back.setAttribute("r", frame.dotBack.r);
      back.setAttribute("opacity", frame.dotBack.opacity);
    }
    starRef.current?.setAttribute("transform", frame.star);
    starRef.current?.setAttribute("opacity", frame.starOpacity);
    star2Ref.current?.setAttribute("transform", frame.star2);
    star2Ref.current?.setAttribute("opacity", frame.star2Opacity);
    lineRef.current?.setAttribute("x2", frame.line.x2);
    lineRef.current?.setAttribute("opacity", frame.line.opacity);
    shadowRef.current?.setAttribute("transform", frame.shadow);
  };
  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    getEngine().dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = getEngine();
    let raf = 0;
    let last = 0;
    let inView = true;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 50) / 1000 : 0;
      last = now;
      s.clock += dt;
      const clock = s.clock;
      const { geo: g, status: wanted } = live.current;
      if (wanted === undefined && clock >= s.autoAt) {
        s.autoIndex = (s.autoIndex + 1) % TOUR.length;
        const [next, hold] = TOUR[s.autoIndex];
        s.autoAt = clock + hold;
        setAuto(next);
        live.current.onStatusChange?.(next);
      }
      const target = wanted ?? TOUR[s.autoIndex][0];
      if (target !== s.current.status) {
        const midway = s.from !== null && clock - s.transStart < 0.42;
        s.from = reduced ? null : midway && s.pose ? { kind: "snap", pose: s.pose } : { kind: "live", status: s.current.status, start: s.current.start };
        s.transStart = clock;
        s.current = { status: target, start: clock };
        s.dirty = true;
      }
      if (reduced) {
        if (!s.dirty) return;
        s.dirty = false;
        const still = poseFor(s.current.status, { t: clock, te: 10, geo: g, glance: [0, 0], still: true });
        s.pose = still;
        s.gaze = [still.gx, still.gy];
        applyRef.current(frameFor(still, s.gaze, 1, g));
        return;
      }
      if (clock >= s.glanceAt) {
        s.glance = Math.random() < 0.35 ? [0, 0] : [between(-0.9, 0.9), between(-0.75, 0.55)];
        s.glanceAt = clock + between(1.1, 3.2);
      }
      if (clock >= s.blinkAt) {
        s.blinkStart = clock;
        s.blinkAt = clock + (Math.random() < 0.2 ? 0.3 : between(2.4, 5.2));
      }
      const input: PoseInput = { t: clock, te: clock - s.current.start, geo: g, glance: s.glance, still: false };
      let pose = poseFor(s.current.status, input);
      if (s.from) {
        const amount = easeInOut(clamp((clock - s.transStart) / 0.42));
        if (amount >= 1) s.from = null;
        else pose = mixPose(s.from.kind === "live" ? poseFor(s.from.status, { ...input, te: clock - s.from.start }) : s.from.pose, pose, amount);
      }
      if (s.current.status === "error") {
        const age = clock - s.current.start - 0.06;
        const shake = age <= 0 || age > 1 ? 0 : 3.2 * Math.exp(-(6 * age)) * Math.sin(age * TAU * 5.5);
        pose = { ...pose, bx: pose.bx + shake, brot: pose.brot + 0.5 * shake };
      }
      s.pose = pose;
      const pointer = s.pointer;
      pointer.weight += (+pointer.active - pointer.weight) * (1 - Math.exp(-(10 * dt)));
      const pull = pointer.weight * clamp(pose.pointer);
      const gx = pose.gx + (pointer.gx * g.gazeX - pose.gx) * pull;
      const gy = pose.gy + (pointer.gy * g.gazeY - pose.gy) * pull;
      const stiffness = pose.gk;
      const damping = 2 * Math.sqrt(stiffness);
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        s.velocity[0] += (stiffness * (gx - s.gaze[0]) - damping * s.velocity[0]) * step;
        s.velocity[1] += (stiffness * (gy - s.gaze[1]) - damping * s.velocity[1]) * step;
        s.gaze[0] += s.velocity[0] * step;
        s.gaze[1] += s.velocity[1] * step;
      }
      const blinkAge = clock - s.blinkStart;
      let closed = 0;
      if (blinkAge >= 0 && blinkAge < 0.16) closed = blinkAge < 0.06 ? Math.sin(((blinkAge / 0.06) * Math.PI) / 2) : Math.cos((((blinkAge - 0.06) / 0.1) * Math.PI) / 2);
      const blink = 1 - closed * clamp(pose.blinkable);
      applyRef.current(frameFor(pose, s.gaze, blink, g));
    };
    const sync = () => {
      const run = inView && !live.current.paused && document.visibilityState === "visible";
      if (run && !raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
      if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }, { rootMargin: "48px" });
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    kick.current = sync;
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(raf);
      raf = 0;
      kick.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    kick.current();
  }, [paused]);

  const [seen, setSeen] = useState(status);
  if (status !== seen) {
    setSeen(status);
    if (status !== undefined && TOUR.some(([name]) => name === status)) setAuto(status);
  }
  const wasControlled = useRef(status !== undefined);
  useEffect(() => {
    const s = getEngine();
    const released = status === undefined && wasControlled.current;
    wasControlled.current = status !== undefined;
    if (status === undefined) {
      if (released) s.autoAt = s.clock + Math.min(1.2, TOUR[s.autoIndex][1]);
      return;
    }
    const index = TOUR.findIndex(([name]) => name === status);
    if (index >= 0) {
      s.autoIndex = index;
      s.autoAt = s.clock + TOUR[index][1];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const look = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw] = live.current.geo.view.split(" ").map(Number);
    const cx = rect.left + ((60 - vx) / vw) * rect.width;
    const cy = rect.top + ((62 - vy) / vw) * rect.height;
    const range = 0.7 * Math.max(rect.width, 40);
    const dx = (clientX - cx) / range;
    const dy = (clientY - cy) / range;
    const pointer = getEngine().pointer;
    pointer.gx = clamp((dx / Math.sqrt(1 + dx * dx)) * 1.3, -1, 1);
    pointer.gy = clamp((dy / Math.sqrt(1 + dy * dy)) * 1.3, -1, 1);
    pointer.active = true;
  };
  const lookRef = useRef(look);
  useLayoutEffect(() => {
    lookRef.current = look;
  });

  useEffect(() => {
    if (followPointer !== "page" || reduced) return;
    const pointer = getEngine().pointer;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") lookRef.current(event.clientX, event.clientY);
    };
    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      pointer.active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followPointer, reduced]);

  const local = followPointer === true && !reduced;
  const spoken = label ?? `${name}, ${LABELS[current].toLowerCase()}`;
  const rootStyle = { width: size, height: size, ...(color ? { "--mascot-body": color } : null), ...(eyeColor ? { "--mascot-eye": eyeColor } : null), ...style } as CSSProperties;
  const eyeWidth = geo.eyeW;
  const arcWidth = geo.compact ? 5.4 : 4;
  const browWidth = geo.compact ? 4.4 : 3.2;

  return (
    <span
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-tone={color ? "custom" : tone}
      data-status={current}
      style={rootStyle}
      onPointerMove={event => {
        if (local && event.pointerType !== "touch") look(event.clientX, event.clientY);
      }}
      onPointerLeave={() => {
        if (followPointer !== "page") getEngine().pointer.active = false;
      }}
    >
      <svg ref={svgRef} className={styles.svg} viewBox={geo.view} width={size} height={size} role="img" aria-label={spoken} focusable="false">
        <defs>
          <clipPath id={clipId}>
            <path d={BODY_PATH} />
          </clipPath>
        </defs>
        {grounded && <ellipse ref={shadowRef} className={styles.ground} cx={0} cy={0} rx={29} ry={3.2} transform={rest.shadow} />}
        {grounded && companion && <line ref={lineRef} className={styles.line} x1={geo.x0} y1={geo.ly} x2={rest.line.x2} y2={geo.ly} strokeWidth={2.6} strokeDasharray="9 5.5 4.5 5.5 12 5.5 6 5.5 10 5.5" opacity={rest.line.opacity} />}
        {companion && <circle ref={dotBackRef} className={styles.dot} cx={rest.dotBack.cx} cy={rest.dotBack.cy} r={rest.dotBack.r} opacity={rest.dotBack.opacity} />}
        <g ref={bodyRef} transform={rest.body}>
          <g clipPath={`url(#${clipId})`}>
            <path className={styles.shade} d={BODY_PATH} />
            <path className={styles.body} d={BODY_PATH} transform="translate(-2.5 -4)" />
          </g>
          {tone === "soft" && !color && <path className={styles.outline} d={BODY_PATH} />}
          <g className={styles.eyes}>
            {[0, 1].map(side => (
              <g key={`pill-${side}`} ref={pills[side]} transform={rest.pill[side]}>
                <line x1={0} y1={-geo.eyeL / 2} x2={0} y2={geo.eyeL / 2} strokeWidth={eyeWidth} />
              </g>
            ))}
            {[0, 1].map(side => (
              <g key={`arc-${side}`} ref={arcs[side]} transform={rest.arc[side]} opacity={rest.arcOpacity}>
                <path d="M-6.5 2.5Q0 -5.5 6.5 2.5" strokeWidth={arcWidth} fill="none" />
              </g>
            ))}
            <g ref={browsRef} transform={rest.brows} opacity={rest.browOpacity}>
              <line x1={40.5} y1={46.5} x2={52} y2={43} strokeWidth={browWidth} />
              <line x1={68} y1={43} x2={79.5} y2={46.5} strokeWidth={browWidth} />
            </g>
          </g>
        </g>
        {companion && (
          <>
            <g opacity={1}>
              <circle ref={dotFrontRef} className={styles.dot} cx={rest.dotFront.cx} cy={rest.dotFront.cy} r={rest.dotFront.r} opacity={rest.dotFront.opacity} />
              <circle ref={glintRef} className={styles.glint} cx={rest.dotFront.cx} cy={rest.dotFront.cy} r={rest.dotFront.r} opacity={rest.dotFront.on} />
            </g>
            <path ref={starRef} className={styles.dot} d={STAR_PATH} transform={rest.star} opacity={rest.starOpacity} />
            {!geo.compact && <path ref={star2Ref} className={styles.dot} d={STAR_PATH} transform={rest.star2} opacity={rest.star2Opacity} />}
          </>
        )}
      </svg>
      {announce && <span className={styles.srOnly} aria-live="polite">{spoken}</span>}
    </span>
  );
}

export default AiMascot;
