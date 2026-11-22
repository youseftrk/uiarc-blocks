"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./cube-mascot.module.css";

export type CubeStatus = "idle" | "thinking" | "writing" | "done" | "error";

export interface CubeMascotProps {
  /** What the assistant is doing. Leave unset to play through every state on a loop. */
  status?: CubeStatus;
  /** Width and height in px. Below 56 a compact drawing takes over. */
  size?: number;
  /** Any CSS color for the cube body. Defaults to the accent. */
  color?: string;
  /** Any CSS color for the eyes, brows and mouth. */
  faceColor?: string;
  /** The contact shadow and the lines printed while writing. Drawn at 56px and up. */
  ground?: boolean;
  /** Freeze on the current frame. */
  paused?: boolean;
  /** Used in the accessible label, for example "Atlas, thinking". */
  name?: string;
  /** Overrides the whole accessible label. */
  label?: string;
  /** Announce status changes in a polite live region. */
  announce?: boolean;
  /** Called when the self-playing loop (status unset) moves to the next state. */
  onStatusChange?: (status: CubeStatus) => void;
  className?: string;
  style?: CSSProperties;
}

const ORDER: CubeStatus[] = ["idle", "thinking", "writing", "done", "error"];
const DWELL: Record<CubeStatus, number> = { idle: 2400, thinking: 2750, writing: 3200, done: 2320, error: 1700 };
const WORDS: Record<CubeStatus, string> = { idle: "ready", thinking: "thinking", writing: "writing", done: "done", error: "something went wrong" };

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const CAMERA = 32;
const LIGHT = [-0.4516, 0.7526, 0.4792];
const TONE_TOP = 0.8678;
const TONE_FRONT = 0.2321;
const TONE_SIDE = -0.3991;
const LINE_EVERY = 0.36;
const LINE_LIFE = 1.44;
const LINE_LENGTHS = [29.8, 23.8, 30, 28.2, 15.5, 27.4, 30.9, 22];
const SIDES: { n: number[]; x: number[] }[] = [
  { n: [0, 0, 1], x: [1, 0, 0] },
  { n: [1, 0, 0], x: [0, 0, -1] },
  { n: [0, 0, -1], x: [-1, 0, 0] },
  { n: [-1, 0, 0], x: [0, 0, 1] },
];

/** Every value the drawing depends on. Status changes blend these numbers. */
interface Pose {
  yaw: number; roll: number; pitch: number;
  dx: number; dy: number;
  gx: number; look: number; open: number; closed: number; squint: number; brow: number;
  mouthW: number; mouthC: number; mouthY: number;
  lines: number; spark: number;
}
const POSE_KEYS: (keyof Pose)[] = ["yaw", "roll", "pitch", "dx", "dy", "gx", "look", "open", "closed", "squint", "brow", "mouthW", "mouthC", "mouthY", "lines", "spark"];

const STILL: Record<CubeStatus, Pose> = {
  idle: { yaw: 30, roll: 1.47, pitch: 1.7, dx: 0, dy: 0, gx: 0.38, look: 0.41, open: 1, closed: 0, squint: 0, brow: 0, mouthW: 5.35, mouthC: 2.5, mouthY: 11.63, lines: 0, spark: 0 },
  thinking: { yaw: 30, roll: 0, pitch: -2.5, dx: 0, dy: -0.48, gx: 1.76, look: -2.24, open: 0.95, closed: 0, squint: 0, brow: 0, mouthW: 3.7, mouthC: 0.36, mouthY: 10.8, lines: 0, spark: 0 },
  writing: { yaw: 30, roll: 0, pitch: 5, dx: 0, dy: 0, gx: 0, look: 2.94, open: 0.8, closed: 0, squint: 0, brow: 0, mouthW: 3.98, mouthC: 0.71, mouthY: 13.31, lines: 1, spark: 0 },
  done: { yaw: 30, roll: -1.5, pitch: 0, dx: 0, dy: 0, gx: 0, look: -0.35, open: 0.8, closed: 1, squint: 1, brow: 0, mouthW: 7, mouthC: 7.16, mouthY: 10.17, lines: 0, spark: 1 },
  error: { yaw: 30, roll: -2.5, pitch: 2, dx: 0, dy: 0, gx: 0, look: 1.05, open: 0.72, closed: 0, squint: 0, brow: 1, mouthW: 4.53, mouthC: -5.72, mouthY: 13.85, lines: 0, spark: 0 },
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const f2 = (v: number) => String(Math.round(v * 100) / 100);

/** Live pose of a state. `t` is seconds since the state began, `clock` the cube's own running clock. */
function livePose(status: CubeStatus, t: number, clock: number): Pose {
  const pose = { ...STILL[status] };
  if (status === "idle") {
    pose.roll = 2.6 * Math.sin((TAU * clock) / 5.25);
    pose.yaw = 30 + 4.5 * Math.sin((TAU * clock) / 7.2);
    pose.pitch = 1.8 * Math.sin((TAU * clock) / 6.1);
    pose.dy = 1.08 * Math.sin((TAU * clock) / 3.6);
    pose.gx = -0.55 + 1.15 * Math.sin((TAU * clock) / 6.4 + 1.1);
    pose.look = 0.5 * Math.sin((TAU * clock) / 8.3 + 2.2);
    pose.mouthY = 11.2 + pose.look;
  } else if (status === "thinking") {
    const phase = t % 1.3;
    const e = phase < 0.5 ? 0 : easeInOut((phase - 0.5) / 0.8);
    pose.yaw = 30 + 90 * e;
    pose.roll = -2.5 * Math.sin(Math.PI * e);
    pose.dy = -0.48 - 1.44 * Math.sin(Math.PI * e);
  } else if (status === "writing") {
    pose.pitch = 5 + Math.cos((TAU * t) / LINE_LIFE);
    pose.yaw = 30 + 2 * Math.sin((TAU * t) / 4.32);
    pose.roll = -0.6 * (pose.yaw - 30);
    pose.dy = 0.72 * Math.sin((TAU * t) / 3.47);
    pose.gx = 1.6 * Math.sin((TAU * t) / LINE_LIFE);
  } else if (status === "done") {
    const dip = t < 0.6 ? 1.3 * Math.pow(Math.sin((Math.PI * t) / 0.6), 2) : 0;
    pose.dy = dip - (t > 0.5 ? 0.36 * Math.sin((TAU * (t - 0.5)) / 4.2) : 0);
  } else {
    const p = clamp01(t / 0.56);
    const shake = -7 * Math.sin(TAU * 3.5 * p) * (1 - p) * (1 - p);
    pose.yaw = 30 + shake;
    pose.dx = -0.35 * shake;
  }
  return pose;
}

interface FaceFrame {
  display: "inline" | "none";
  opacity?: string; transform?: string;
  eyes?: { x: string; y: string; width: string; height: string; rx: string; opacity: string }[];
  arcs?: { d: string; opacity: string; strokeWidth: string }[];
  brows?: { d: string; opacity: string; strokeWidth: string }[];
  mouth?: { display: "inline" | "none"; d: string; strokeWidth: string };
}
interface Frame {
  clip: string;
  shadow: { display: "inline" | "none"; d: string; opacity: string };
  fills: { display: "inline" | "none"; d?: string; tone?: string }[];
  faces: FaceFrame[];
  lines: { display: "inline" | "none"; d?: string; opacity?: string }[];
  sparks: { display: "inline" | "none"; opacity?: string; transform?: string; d?: string }[];
}

function roundedPolygon(points: number[][], radius: number): string {
  const n = points.length;
  let d = "";
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i + n - 1) % n], cur = points[i], next = points[(i + 1) % n];
    const ax = prev[0] - cur[0], ay = prev[1] - cur[1], bx = next[0] - cur[0], by = next[1] - cur[1];
    const al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
    const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl))));
    const cut = Math.min(radius / Math.tan(angle / 2), al / 2, bl / 2);
    d += `${i === 0 ? "M" : "L"}${f2(cur[0] + (ax / al) * cut)} ${f2(cur[1] + (ay / al) * cut)}Q${f2(cur[0])} ${f2(cur[1])} ${f2(cur[0] + (bx / bl) * cut)} ${f2(cur[1] + (by / bl) * cut)}`;
  }
  return `${d}Z`;
}

function convexHull(input: number[][]): number[][] {
  const pts = [...input].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0.01) lower.pop(); lower.push(p); }
  const upper: number[][] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0.01) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function sparkPath(r: number) {
  const k = f2(r), c = f2(r * 0.16);
  return `M0 -${k}Q${c} -${c} ${k} 0Q${c} ${c} 0 ${k}Q-${c} ${c} -${k} 0Q-${c} -${c} 0 -${k}Z`;
}

function toneOf(depthLight: number): string {
  if (depthLight >= TONE_FRONT) {
    const pct = Math.round(clamp01((depthLight - TONE_FRONT) / (TONE_TOP - TONE_FRONT)) * 100);
    return pct === 0 ? "var(--cube-front)" : `color-mix(in oklab, var(--cube-front), var(--cube-top) ${pct}%)`;
  }
  const pct = Math.round(clamp01((TONE_FRONT - depthLight) / (TONE_FRONT - TONE_SIDE)) * 100);
  return pct === 0 ? "var(--cube-front)" : `color-mix(in oklab, var(--cube-front), var(--cube-side) ${pct}%)`;
}

/** Projects the cube and paints the face for one pose. */
function buildFrame(pose: Pose, compact: boolean, ground: boolean, sparkTime: number, lineTime: number): Frame {
  const L = compact ? 56 : 48;
  const unit = L / 48;
  const cx = 50 + pose.dx * unit;
  const cy = (compact ? 51 : 47.6) + pose.dy * unit;
  const yaw = pose.yaw * RAD, roll = pose.roll * RAD, tilt = (CAMERA + pose.pitch) * RAD;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll), ct = Math.cos(tilt), st = Math.sin(tilt);
  const m1 = [cr * cyw, -sr, -cr * syw];
  const m2 = [sr * cyw, cr, -sr * syw];
  const m3 = [syw, 0, cyw];
  const r1 = m1;
  const r2 = [ct * m2[0] - st * m3[0], ct * m2[1] - st * m3[1], ct * m2[2] - st * m3[2]];
  const r3 = [st * m2[0] + ct * m3[0], st * m2[1] + ct * m3[1], st * m2[2] + ct * m3[2]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const project = (p: number[]) => [cx + dot(r1, p), cy - dot(r2, p)];
  const view = (n: number[]) => [dot(r1, n), dot(r2, n), dot(r3, n)];
  const h = L / 2;

  const corners: number[][] = [];
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) corners.push(project([x, y, z]));
  const clip = roundedPolygon(convexHull(corners), compact ? 8.4 : 6.23);

  const fills: Frame["fills"] = [];
  const faces: FaceFrame[] = [];
  const quad = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${f2(p[0])} ${f2(p[1])}`).join("") + "Z";

  SIDES.forEach((side, index) => {
    const nv = view(side.n);
    if (nv[2] <= 0.02) { fills.push({ display: "none" }); faces.push({ display: "none" }); return; }
    const c = [side.n[0] * h, side.n[1] * h, side.n[2] * h];
    const at = (u: number, v: number) => project([c[0] + side.x[0] * u * h, c[1] - v * h, c[2] + side.x[2] * u * h]);
    const tl = at(-1, -1), tr = at(1, -1), br = at(1, 1), bl = at(-1, 1);
    fills.push({ display: "inline", d: quad([tl, tr, br, bl]), tone: toneOf(dot(nv, LIGHT)) });

    // Angle of this face against the resting front (30 degrees): leaving faces fade, arriving faces open their eyes.
    let angle = (((pose.yaw - 90 * index) % 360) + 360) % 360;
    if (angle > 180) angle -= 360;
    const opacity = angle > 30 ? clamp01((85 - angle) / 20) : clamp01((angle + 10) / 20);
    if (opacity <= 0) { faces.push({ display: "none" }); return; }
    const wake = angle < 30 ? clamp01((angle - 4) / 26) : 1;

    const center = project(c);
    const s = compact ? 1.4 : 1;
    const eyeX = compact ? 16 : 14, eyeW = compact ? 14 : 10;
    const gx = pose.gx * (compact ? 0.75 : 1);
    const ey = compact ? -4 + 0.857 * pose.look : -8 + pose.look;
    const openH = (compact ? 24 : 17) * pose.open, shutH = compact ? 4.2 : 3;
    const shut = Math.max(pose.closed, 1 - wake);
    const eyeH = openH + (shutH - openH) * shut;
    const q = pose.squint;
    const arcY = ey + (1.08 + 2.52 * q) * s, arcC = ey - (2.64 + 6.16 * q) * s, arcW = 6.6 * s;
    const browY = ey - 13.66 * s, browW = compact ? 9.8 : 7;
    const signs = [-1, 1];
    faces.push({
      display: "inline",
      opacity: f2(opacity),
      transform: `matrix(${((tr[0] - tl[0]) / 100).toFixed(4)} ${((tr[1] - tl[1]) / 100).toFixed(4)} ${((bl[0] - tl[0]) / 100).toFixed(4)} ${((bl[1] - tl[1]) / 100).toFixed(4)} ${center[0].toFixed(4)} ${center[1].toFixed(4)})`,
      eyes: signs.map((sign) => ({ x: f2(sign * eyeX + gx - eyeW / 2), y: f2(ey - eyeH / 2), width: String(eyeW), height: f2(eyeH), rx: String(eyeW / 2), opacity: f2(1 - pose.squint) })),
      arcs: signs.map((sign) => { const ex = sign * eyeX + gx; return { d: `M${f2(ex - arcW)} ${f2(arcY)}Q${f2(ex)} ${f2(arcC)} ${f2(ex + arcW)} ${f2(arcY)}`, opacity: f2(q), strokeWidth: compact ? "6.9" : "3.91" }; }),
      brows: signs.map((sign) => { const ex = sign * eyeX + gx; return { d: `M${f2(ex + sign * browW)} ${f2(browY + 1.76 * pose.brow)}L${f2(ex - sign * browW)} ${f2(browY - 3.74 * pose.brow)}`, opacity: f2(pose.brow), strokeWidth: compact ? "6" : "3.4" }; }),
      mouth: { display: compact ? "none" : "inline", d: `M${f2(gx / 2 - pose.mouthW)} ${f2(pose.mouthY)}Q${f2(gx / 2)} ${f2(pose.mouthY + pose.mouthC)} ${f2(gx / 2 + pose.mouthW)} ${f2(pose.mouthY)}`, strokeWidth: "3.4" },
    });
  });

  const topView = view([0, 1, 0]);
  fills.push(topView[2] > 0.02
    ? { display: "inline", d: quad([project([-h, h, -h]), project([h, h, -h]), project([h, h, h]), project([-h, h, h])]), tone: toneOf(dot(topView, LIGHT)) }
    : { display: "none" });

  // Contact shadow: the footprint on the ground plane, seen through the fixed camera.
  const cam = CAMERA * RAD, g = 0.54 * L;
  const floor = (x: number, z: number) => [50 + (x * cyw - z * syw) * g, 69.17 + (x * syw + z * cyw) * g * Math.sin(cam)];
  const shadow = {
    display: (ground && !compact ? "inline" : "none") as "inline" | "none",
    d: roundedPolygon([floor(-1, 1), floor(1, 1), floor(1, -1), floor(-1, -1)], 6.23),
    opacity: f2(Math.max(0.6, Math.min(1, 1 + 0.08 * (pose.dy - 0.36)))),
  };

  const lines: Frame["lines"] = [{ display: "none" }, { display: "none" }, { display: "none" }, { display: "none" }];
  if (ground && !compact && pose.lines > 0.004) {
    const newest = Math.floor(lineTime / LINE_EVERY);
    for (let n = newest; n > newest - 4 && n >= 0; n -= 1) {
      const age = lineTime - n * LINE_EVERY;
      const alpha = Math.min(clamp01(age / 0.25), clamp01((1.4 - age) / 0.45)) * pose.lines;
      if (age >= LINE_LIFE || alpha <= 0.004) continue;
      const x = 18.1 - 8.4 * age, y = 79.3 + 6.45 * age, len = LINE_LENGTHS[n % LINE_LENGTHS.length];
      lines[n % 4] = { display: "inline", d: `M${f2(x)} ${f2(y)}L${f2(x + len * 0.956)} ${f2(y + len * 0.293)}`, opacity: f2(alpha) };
    }
  }

  const sparks: Frame["sparks"] = [{ display: "none" }, { display: "none" }];
  if (pose.spark > 0.004) {
    const defs = compact ? [{ x: 83.6, y: 12.92, r: 10.64, delay: 0.1, phase: 0 }] : [{ x: 82.4, y: 11.6, r: 10.08, delay: 0.1, phase: 0 }, { x: 95.12, y: 24.08, r: 4.56, delay: 0.2, phase: Math.PI / 2 }];
    defs.forEach((def, i) => {
      const local = sparkTime - def.delay;
      if (local <= 0) return;
      const grow = easeOut(clamp01(local / 0.35));
      const twinkle = 1 + 0.07 * Math.sin((TAU * Math.max(0, sparkTime - 0.45)) / 2.4 + def.phase) * grow;
      sparks[i] = {
        display: "inline",
        opacity: f2(clamp01(local / 0.2) * pose.spark),
        transform: `translate(${def.x} ${def.y}) rotate(${f2(-60 * (1 - grow))}) scale(${(grow * twinkle).toFixed(3)})`,
        d: sparkPath(def.r),
      };
    });
  }

  return { clip, shadow, fills, faces, lines, sparks };
}

const STILL_TIME = 1000;
function stillFrame(status: CubeStatus, compact: boolean, ground: boolean) {
  const frame = buildFrame(STILL[status], compact, ground, 0.45 + 2.4 * STILL_TIME, 0.91);
  if (status === "writing" && ground && !compact) {
    frame.lines = [
      { display: "inline", d: "M17.16 80.49L45.64 89.21", opacity: "0.78" },
      { display: "inline", d: "M14.4 83.03L37.09 89.97", opacity: "1" },
      { display: "inline", d: "M11.64 85.56L40.27 94.32", opacity: "1" },
      { display: "none" },
    ];
  }
  return frame;
}

function setAttr(node: Element | null, name: string, value: string | undefined) {
  if (!node) return;
  if (value === undefined) { if (node.hasAttribute(name)) node.removeAttribute(name); return; }
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function paint(svg: SVGSVGElement, frame: Frame) {
  setAttr(svg.querySelector("[data-clip]"), "d", frame.clip);
  setAttr(svg.querySelector("[data-under]"), "d", frame.clip);
  const shadow = svg.querySelector("[data-shadow]");
  setAttr(shadow, "display", frame.shadow.display); setAttr(shadow, "d", frame.shadow.d); setAttr(shadow, "opacity", frame.shadow.opacity);
  svg.querySelectorAll<SVGPathElement>("[data-fill]").forEach((node, i) => {
    const fill = frame.fills[i];
    setAttr(node, "display", fill.display);
    if (fill.display === "none") return;
    setAttr(node, "d", fill.d);
    if (node.getAttribute("data-tone") !== fill.tone) { node.setAttribute("data-tone", fill.tone ?? ""); node.style.fill = fill.tone ?? ""; }
  });
  svg.querySelectorAll("[data-feat]").forEach((group, i) => {
    const face = frame.faces[i];
    setAttr(group, "display", face.display);
    if (face.display === "none") return;
    setAttr(group, "opacity", face.opacity); setAttr(group, "transform", face.transform);
    group.querySelectorAll("[data-eye]").forEach((node, k) => { const eye = face.eyes![k]; setAttr(node, "x", eye.x); setAttr(node, "y", eye.y); setAttr(node, "width", eye.width); setAttr(node, "height", eye.height); setAttr(node, "rx", eye.rx); setAttr(node, "opacity", eye.opacity); });
    group.querySelectorAll("[data-arc]").forEach((node, k) => { const arc = face.arcs![k]; setAttr(node, "d", arc.d); setAttr(node, "opacity", arc.opacity); setAttr(node, "stroke-width", arc.strokeWidth); });
    group.querySelectorAll("[data-brow]").forEach((node, k) => { const brow = face.brows![k]; setAttr(node, "d", brow.d); setAttr(node, "opacity", brow.opacity); setAttr(node, "stroke-width", brow.strokeWidth); });
    const mouth = group.querySelector("[data-mouth]");
    setAttr(mouth, "display", face.mouth!.display); setAttr(mouth, "d", face.mouth!.d); setAttr(mouth, "stroke-width", face.mouth!.strokeWidth);
  });
  svg.querySelectorAll("[data-line]").forEach((node, i) => {
    const line = frame.lines[i];
    setAttr(node, "display", line.display);
    if (line.display === "none") return;
    setAttr(node, "d", line.d); setAttr(node, "opacity", line.opacity);
  });
  [svg.querySelector("[data-spark]"), svg.querySelector("[data-spark2]")].forEach((group, i) => {
    const spark = frame.sparks[i];
    setAttr(group, "display", spark.display);
    if (!group || spark.display === "none") return;
    setAttr(group, "opacity", spark.opacity); setAttr(group, "transform", spark.transform);
    setAttr(group.firstElementChild, "d", spark.d);
  });
}

interface Runtime {
  clock: number;
  status: CubeStatus;
  since: number;
  from: Pose | null;
  blendStart: number;
  blendLength: number;
  last: Pose;
  blinkAt: number;
  blinkStart: number;
  blinkTwice: boolean;
  sparkStart: number;
  lineStart: number;
}

/**
 * CubeMascot: an isometric cube drawn in SVG from real 3D math. Three shaded faces and a painted-on
 * face show what the assistant is doing.
 */
export function CubeMascot({ status, size = 96, color, faceColor, ground = true, paused = false, name = "Assistant", label, announce = false, onStatusChange, className, style }: CubeMascotProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const clipId = `cube-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const [auto, setAuto] = useState<CubeStatus>("idle");
  const current = status ?? auto;
  const compact = size < 56;
  const [initial] = useState(() => stillFrame(current, compact, ground));
  const runtime = useRef<Runtime | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  // Self-playing loop when status is unset.
  const selfPlaying = status === undefined;
  useEffect(() => {
    if (!selfPlaying || paused) return;
    const timer = window.setTimeout(() => {
      const next = ORDER[(ORDER.indexOf(auto) + 1) % ORDER.length];
      setAuto(next);
      onStatusChangeRef.current?.(next);
    }, DWELL[auto]);
    return () => window.clearTimeout(timer);
  }, [selfPlaying, paused, auto]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (reduceMotion) { runtime.current = null; paint(svg, stillFrame(current, compact, ground)); return; }
    let rt = runtime.current;
    if (!rt) {
      rt = { clock: 0, status: current, since: 0, from: null, blendStart: 0, blendLength: 0.42, last: STILL[current], blinkAt: 1.6, blinkStart: -1, blinkTwice: false, sparkStart: -0.6, lineStart: 0 };
      runtime.current = rt;
    } else if (rt.status !== current) {
      const from = { ...rt.last };
      if (rt.status === "thinking" && from.yaw > 40) from.yaw -= 90;
      rt.from = from;
      rt.blendStart = rt.clock;
      rt.blendLength = current === "error" ? 0.24 : 0.42;
      rt.status = current;
      rt.since = rt.clock;
      if (current === "done") rt.sparkStart = rt.clock;
      if (current === "writing") rt.lineStart = rt.clock;
      if (current === "idle") rt.blinkAt = rt.clock + 1.2 + Math.random() * 1.2;
    }
    const state = rt;
    const draw = () => {
      const pose = livePose(state.status, state.clock - state.since, state.clock);
      if (state.status === "idle") {
        if (state.blinkStart < 0 && state.clock >= state.blinkAt) { state.blinkStart = state.clock; }
        if (state.blinkStart >= 0) {
          const p = (state.clock - state.blinkStart) / 0.17;
          if (p >= 1) {
            state.blinkStart = -1;
            if (!state.blinkTwice && Math.random() < 0.25) { state.blinkTwice = true; state.blinkAt = state.clock + 0.16; }
            else { state.blinkTwice = false; state.blinkAt = state.clock + 2.6 + Math.random() * 2.3; }
          } else pose.closed = Math.max(pose.closed, clamp01(Math.min(p / 0.3, (1 - p) / 0.3)));
        }
      } else state.blinkStart = -1;
      if (state.from) {
        const p = (state.clock - state.blendStart) / state.blendLength;
        if (p >= 1) state.from = null;
        else { const e = easeInOut(clamp01(p)); for (const key of POSE_KEYS) pose[key] = state.from[key] + (pose[key] - state.from[key]) * e; }
      }
      state.last = pose;
      paint(svg, buildFrame(pose, compact, ground, state.clock - state.sparkStart, state.clock - state.lineStart));
    };
    draw();
    if (paused) return;

    let raf = 0;
    let previous = 0;
    let visible = true;
    const tick = (now: number) => {
      if (previous) state.clock += Math.min(0.1, (now - previous) / 1000);
      previous = now;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !raf) { previous = 0; raf = requestAnimationFrame(tick); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; sync(); });
    if (observer && rootRef.current) observer.observe(rootRef.current);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", sync); if (raf) cancelAnimationFrame(raf); };
  }, [current, compact, ground, paused, reduceMotion]);

  const text = label ?? `${name}, ${WORDS[current]}`;
  const vars = { width: size, height: size, ...(color ? { "--cube-body": color } : null), ...(faceColor ? { "--cube-ink": faceColor } : null), ...style } as CSSProperties;

  return (
    <span ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={vars} data-status={current}>
      <svg ref={svgRef} className={styles.svg} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={text}>
        <defs><clipPath id={clipId}><path data-clip="true" d={initial.clip} /></clipPath></defs>
        <path data-shadow="true" className={styles.shadow} display={initial.shadow.display} d={initial.shadow.d} opacity={initial.shadow.opacity} />
        <g clipPath={`url(#${clipId})`}>
          <path data-under="true" className={styles.under} d={initial.clip} />
          {initial.fills.map((fill, i) => (
            <path key={i} data-fill={i} className={styles.fill} display={fill.display} d={fill.d} data-tone={fill.tone} style={fill.tone ? { fill: fill.tone } : undefined} />
          ))}
          {initial.faces.map((face, i) => (
            <g key={i} data-feat={i} display={face.display} opacity={face.opacity} transform={face.transform}>
              {[0, 1].map((k) => <rect key={k} data-eye="true" className={styles.eye} {...face.eyes?.[k]} />)}
              {[0, 1].map((k) => <path key={k} data-arc="true" className={styles.stroke} {...face.arcs?.[k]} />)}
              {[0, 1].map((k) => <path key={k} data-brow="true" className={styles.stroke} {...face.brows?.[k]} />)}
              <path data-mouth="true" className={styles.stroke} {...face.mouth} />
            </g>
          ))}
        </g>
        {initial.lines.map((line, i) => <path key={i} data-line="true" className={styles.line} display={line.display} d={line.d} opacity={line.opacity} />)}
        <g data-spark="true" display={initial.sparks[0].display} opacity={initial.sparks[0].opacity} transform={initial.sparks[0].transform}><path className={styles.spark} d={initial.sparks[0].d} /></g>
        <g data-spark2="true" display={initial.sparks[1].display} opacity={initial.sparks[1].opacity} transform={initial.sparks[1].transform}><path className={styles.spark} d={initial.sparks[1].d} /></g>
      </svg>
      {announce ? <span className={styles.live} role="status" aria-live="polite">{text}</span> : null}
    </span>
  );
}

export default CubeMascot;
