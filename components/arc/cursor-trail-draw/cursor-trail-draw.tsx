"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { PenLine, Shapes, Sparkles, Trash2, Undo2, Wand } from "lucide-react";
import { outline, pathLength, recognize, resample, type Pt, type WhiteboardShape } from "./geometry";
import styles from "./cursor-trail-draw.module.css";

export type { WhiteboardShape } from "./geometry";
export type WhiteboardTool = "pen" | "laser";

export interface WhiteboardColor {
  id: string;
  label: string;
  /** Any CSS color. */
  value: string;
}

export interface WhiteboardItem {
  id: string;
  shape: WhiteboardShape;
  /** Id of the color it was drawn with. */
  color: string;
  /** Stroke width in board units. */
  width: number;
  /** Centerline in board units; the board is 1000 units wide. */
  points: [number, number][];
}

export interface CursorTrailDrawProps {
  /** Heading and accessible name of the board. */
  label?: string;
  /** Ink colors in the toolbar. The first one is selected first. */
  colors?: WhiteboardColor[];
  defaultTool?: WhiteboardTool;
  /** Whether rough shapes snap clean. */
  defaultSnap?: boolean;
  /** Pen size in CSS pixels at half pressure. */
  size?: number;
  /** How much the ink trails the pointer, from 0 (raw) to 1 (very smooth). */
  smoothing?: number;
  /** How long the laser trail takes to fade, in milliseconds. */
  laserFade?: number;
  /** Plays a short sketch once, the first time the board is in view. */
  intro?: boolean;
  /** Multiplies the speed of the snap spring, the laser fade and the intro. */
  speed?: number;
  /** Stops all animation. Drawing still works. */
  paused?: boolean;
  /** Any CSS color for the accent ink, the laser and the selected tool. */
  accent?: string;
  /** Line shown on the empty board. Pass an empty string to hide it. */
  hint?: string;
  onChange?: (items: WhiteboardItem[]) => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_COLORS: WhiteboardColor[] = [
  { id: "ink", label: "Ink", value: "var(--foreground)" },
  { id: "accent", label: "Accent", value: "var(--ctd-accent)" },
  { id: "red", label: "Red", value: "var(--danger)" },
];

const MORPH_POINTS = 96;
const CHIP_MS = 4400;
const LEAVE_MS = 180;

interface BoardItem extends WhiteboardItem {
  mode: "ink" | "clean";
  /** Path data: a filled outline for ink, a stroked centerline for clean shapes. */
  d: string;
  cssColor: string;
  rawPoints: Pt[];
  rawWidths: number[];
  snap?: { shape: Exclude<WhiteboardShape, "stroke">; d: string; target: Pt[] };
  leaving?: boolean;
}

interface Morph { id: string; from: Pt[]; to: Pt[]; fromW: number[]; toW: number[]; x: number; v: number; done: () => void }
interface IntroStep { kind: "wait" | "move" | "draw" | "laser"; ms: number; to?: Pt; path?: Pt[]; color?: number }

interface Engine {
  raf: number; last: number; unit: number; height: number; visible: boolean;
  pointer: Pt; tip: Pt; down: boolean; tool: WhiteboardTool; color: string; cssColor: string;
  points: Pt[]; widths: number[]; pressure: number; realPressure: number | null;
  laser: { p: Pt; t: number }[]; laserNow: number;
  morphs: Morph[]; keys: Set<string>; keyboard: boolean;
  intro: { steps: IntroStep[]; index: number; t: number; from: Pt } | null; introDone: boolean;
  show: boolean;
}

const f1 = (n: number) => Math.round(n * 10) / 10;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const shapeWord = (shape: WhiteboardShape, many: boolean) => (shape === "quadrilateral" ? (many ? "four sided shapes" : "four sided shape") : shape + (many ? "s" : ""));

function introSteps(height: number, colors: WhiteboardColor[]): IntroStep[] {
  const narrow = height > 900;
  const k = narrow ? height / 1250.5 : height / 623.7;
  const circle = narrow ? { cx: 506.45, cy: 376.8 * k, r: 130.4 } : { cx: 236.45, cy: 288.4 * k, r: 120.2 * Math.min(1.1, k) };
  const rect = narrow ? { x0: 293, x1: 703.4, y0: 739.8 * k, y1: 961.6 * k } : { x0: 590.5, x1: 885.7, y0: 191.2 * k, y1: 382.4 * k };
  const line: [Pt, Pt] = narrow ? [[500, 527.2 * k], [500, 713.3 * k]] : [[379.5, 286.9 * k], [567.8, 286.9 * k]];
  const laser: [Pt, Pt] = narrow ? [[323.6, 1013.3 * k], [676.4, 1009.3 * k]] : [[613.8, 441.7 * k], [865.2, 437.7 * k]];

  const circlePath: Pt[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, a = (-113 + 391 * t) * (Math.PI / 180);
    const r = circle.r * (1 + 0.035 * Math.sin(a * 2 + 0.6) - 0.03 * (1 - t) + 0.025 * t);
    circlePath.push([circle.cx + r * Math.cos(a), circle.cy + r * Math.sin(a)]);
  }
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  const corners: Pt[] = [[rect.x0 - 0.02 * w, rect.y0 + 0.02 * h], [rect.x1 + 0.02 * w, rect.y0 - 0.02 * h], [rect.x1 - 0.02 * w, rect.y1 + 0.02 * h], [rect.x0 + 0.02 * w, rect.y1 - 0.02 * h], [rect.x0 - 0.02 * w, rect.y0 + 0.035 * h]];
  const rectPath: Pt[] = [];
  for (let side = 0; side < 4; side++) for (let i = 0; i < 20; i++) {
    const t = i / 20, a = corners[side], b = corners[side + 1], bow = Math.sin(Math.PI * t) * 0.012 * (side % 2 ? w : h);
    rectPath.push([a[0] + (b[0] - a[0]) * t + (side % 2 ? bow : 0), a[1] + (b[1] - a[1]) * t + (side % 2 ? 0 : -bow)]);
  }
  rectPath.push(corners[4]);
  const linePath: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, bow = Math.sin(Math.PI * t) * 4;
    linePath.push(narrow ? [line[0][0] + bow, line[0][1] + (line[1][1] - line[0][1]) * t] : [line[0][0] + (line[1][0] - line[0][0]) * t, line[0][1] + bow]);
  }
  const laserPath: Pt[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; laserPath.push([laser[0][0] + (laser[1][0] - laser[0][0]) * t, laser[0][1] + (laser[1][1] - laser[0][1]) * t + 7 * Math.sin(Math.PI * 2 * t) * (1 - t * 0.4)]); }
  const accent = Math.min(1, colors.length - 1);
  return [
    { kind: "wait", ms: 500 },
    { kind: "move", ms: 0, to: circlePath[0] },
    { kind: "draw", ms: 1065, path: circlePath, color: 0 },
    { kind: "move", ms: 470, to: rectPath[0] }, { kind: "wait", ms: 100 },
    { kind: "draw", ms: 1270, path: rectPath, color: 0 },
    { kind: "move", ms: 470, to: linePath[0] }, { kind: "wait", ms: 110 },
    { kind: "draw", ms: 540, path: linePath, color: accent },
    { kind: "move", ms: 470, to: laserPath[0] }, { kind: "wait", ms: 150 },
    { kind: "laser", ms: 770, path: laserPath },
  ];
}

function along(path: Pt[], t: number): Pt {
  const x = Math.min(1, Math.max(0, t)) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(x)), f = x - i;
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
}

export function CursorTrailDraw({
  label = "Whiteboard", colors = DEFAULT_COLORS, defaultTool = "pen", defaultSnap = true, size = 4, smoothing = 0.5, laserFade = 700,
  intro = true, speed = 1, paused = false, accent, hint = "Draw a rough circle, box or line. It snaps clean.", onChange, className, style,
}: CursorTrailDrawProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const still = reduced || paused;
  const [items, setItems] = useState<BoardItem[]>([]);
  const [tool, setTool] = useState<WhiteboardTool>(defaultTool);
  const [colorId, setColorId] = useState(colors[0]?.id ?? "ink");
  const [snap, setSnap] = useState(defaultSnap);
  const [chip, setChip] = useState<{ id: string; shape: string } | null>(null);
  const [status, setStatus] = useState("");
  const [height, setHeight] = useState(625);
  const [measured, setMeasured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unitState, setUnitState] = useState(1.6);

  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<SVGPathElement>(null);
  const laserRef = useRef<SVGPathElement>(null);
  const nibRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const itemsRef = useRef<BoardItem[]>([]);
  const engineRef = useRef<Engine | null>(null);
  const tickRef = useRef<(dt: number, now: number) => boolean>(() => false);
  const live = useRef({ tool, colorId, snap, colors, size, smoothing, laserFade, speed, still, onChange });
  useLayoutEffect(() => { live.current = { tool, colorId, snap, colors, size, smoothing, laserFade, speed, still, onChange }; });

  const color = colors.find(c => c.id === colorId) ?? colors[0] ?? DEFAULT_COLORS[0];
  const getEngine = useCallback((): Engine => {
    if (!engineRef.current) {
      engineRef.current = {
        raf: 0, last: 0, unit: 1.3, height: 625, visible: true, pointer: [500, 300], tip: [500, 300], down: false, tool: "pen", color: "", cssColor: "",
        points: [], widths: [], pressure: 0.6, realPressure: null, laser: [], laserNow: 0, morphs: [], keys: new Set(), keyboard: false, intro: null, introDone: false, show: false,
      };
    }
    return engineRef.current;
  }, []);

  const commit = useCallback((next: BoardItem[], notify = true) => {
    itemsRef.current = next;
    setItems(next);
    if (notify) live.current.onChange?.(next.filter(item => !item.leaving).map(({ id, shape, color: c, width, points }) => ({ id, shape, color: c, width, points: points.map(p => [p[0], p[1]]) })));
  }, []);

  const showChip = useCallback((next: { id: string; shape: string } | null, ms = CHIP_MS) => {
    if (chipTimer.current) clearTimeout(chipTimer.current);
    chipTimer.current = null;
    setChip(next);
    if (next && ms > 0) chipTimer.current = setTimeout(() => setChip(null), ms);
  }, []);

  const paintNib = useCallback(() => {
    const e = getEngine(), nib = nibRef.current, ring = ringRef.current;
    if (!nib || !ring) return;
    const laser = e.tool === "laser", x = String(f1(e.tip[0])), y = String(f1(e.tip[1]));
    const s = live.current.size;
    nib.setAttribute("cx", x); nib.setAttribute("cy", y); nib.setAttribute("r", String(f1((laser ? 4.54 : s * 0.6) * e.unit)));
    ring.setAttribute("cx", x); ring.setAttribute("cy", y); ring.setAttribute("r", String(f1((laser ? 11 : 6 + s * 0.6) * e.unit)));
    ring.setAttribute("stroke-width", String(f1(1.27 * e.unit)));
    for (const el of [nib, ring]) {
      el.setAttribute("data-tool", e.tool);
      el.style.color = laser ? "var(--ctd-accent)" : e.cssColor;
      if (e.show) el.setAttribute("data-show", ""); else el.removeAttribute("data-show");
    }
    if (e.down) ring.setAttribute("data-down", ""); else ring.removeAttribute("data-down");
  }, [getEngine]);

  const start = useCallback(() => {
    const e = getEngine();
    if (e.raf || !e.visible) return;
    e.last = performance.now();
    const frame = (now: number) => {
      e.raf = 0;
      const dt = Math.min(48, now - e.last);
      e.last = now;
      if (tickRef.current(dt, now)) e.raf = requestAnimationFrame(frame);
    };
    e.raf = requestAnimationFrame(frame);
  }, [getEngine]);

  const penDown = useCallback((toolNow: WhiteboardTool, cssColor: string, id: string) => {
    const e = getEngine();
    e.down = true; e.tool = toolNow; e.cssColor = cssColor; e.color = id;
    e.tip = [e.pointer[0], e.pointer[1]]; e.points = [[e.tip[0], e.tip[1]]]; e.widths = [live.current.size * e.unit * 0.45]; e.pressure = 0.6;
    if (toolNow === "laser") e.laser.push({ p: [e.tip[0], e.tip[1]], t: e.laserNow });
    if (activeRef.current) activeRef.current.style.color = cssColor;
    e.show = true;
    setBusy(true);
  }, [getEngine]);

  const land = useCallback((fromIntro: boolean) => {
    const e = getEngine(), l = live.current;
    e.down = false;
    if (e.tool === "laser") { paintNib(); start(); return; }
    const pts = e.points, widths = e.widths;
    const end = e.pointer;
    if (pts.length && Math.hypot(end[0] - pts[pts.length - 1][0], end[1] - pts[pts.length - 1][1]) > 0.5 * e.unit) { pts.push([end[0], end[1]]); widths.push(widths[widths.length - 1]); }
    if (activeRef.current) activeRef.current.setAttribute("d", "");
    e.points = []; e.widths = [];
    if (pts.length < 2) { pts.push([pts[0][0] + 0.01, pts[0][1]]); widths.push(widths[0]); }
    const total = pathLength(pts), taper = 12 * e.unit;
    let walked = 0;
    const tapered = widths.map((w, i) => {
      if (i) walked += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return w * Math.min(1, 0.45 + (0.55 * Math.min(walked, total - walked)) / taper);
    });
    const id = `${uid}s${++counter.current}`;
    const width = f1(l.size * 0.85 * e.unit);
    const found = l.snap ? recognize(pts, e.unit, MORPH_POINTS) : null;
    const item: BoardItem = {
      id, shape: found ? found.shape : "stroke", color: e.color, cssColor: e.cssColor, width, mode: "ink", d: outline(pts, tapered),
      points: (found ? found.target : pts).map(p => [f1(p[0]), f1(p[1])] as [number, number]), rawPoints: pts, rawWidths: tapered, snap: found ?? undefined,
    };
    if (found) {
      const settle = () => commit(itemsRef.current.map(it => (it.id === id && it.snap ? { ...it, mode: "clean" as const, d: it.snap.d } : it)), false);
      if (l.still) { item.mode = "clean"; item.d = found.d; }
      else {
        const from = resample(pts, MORPH_POINTS, tapered);
        e.morphs.push({ id, from: from.pts, to: found.target, fromW: from.values, toW: from.values.map(() => width), x: 0, v: 0, done: settle });
      }
      setStatus(`Snapped to ${shapeWord(found.shape, false)}`);
      if (!fromIntro || !chipTimer.current) showChip({ id, shape: shapeWord(found.shape, false) }, fromIntro ? 0 : CHIP_MS);
    } else setStatus("Stroke added");
    commit([...itemsRef.current, item]);
    setBusy(false);
    paintNib(); start();
  }, [commit, getEngine, paintNib, showChip, start, uid]);

  const tick = useCallback((dt: number, now: number): boolean => {
    const e = getEngine(), l = live.current;
    let active = false;
    const rate = l.speed > 0 ? l.speed : 1;
    e.laserNow += dt;

    if (e.intro) {
      active = true;
      const run = e.intro, step = run.steps[run.index];
      run.t += dt * rate;
      const t = step.ms ? Math.min(1, run.t / step.ms) : 1;
      if (step.kind === "move" && step.to) {
        const k = easeInOut(t);
        e.pointer = [run.from[0] + (step.to[0] - run.from[0]) * k, run.from[1] + (step.to[1] - run.from[1]) * k];
        e.tip = [e.pointer[0], e.pointer[1]]; e.show = true;
      } else if ((step.kind === "draw" || step.kind === "laser") && step.path) {
        if (!e.down) {
          e.pointer = [step.path[0][0], step.path[0][1]];
          const c = l.colors[step.color ?? 0] ?? DEFAULT_COLORS[0];
          penDown(step.kind === "laser" ? "laser" : "pen", c.value, c.id);
        }
        e.pointer = along(step.path, t * t * (3 - 2 * t));
      }
      if (t >= 1) {
        if (e.down) land(true);
        run.from = [e.pointer[0], e.pointer[1]]; run.index++; run.t = 0;
        if (run.index >= run.steps.length) {
          e.intro = null; e.introDone = true; e.show = false; e.tool = l.tool;
          e.cssColor = (l.colors.find(c => c.id === l.colorId) ?? l.colors[0] ?? DEFAULT_COLORS[0]).value;
          showChip(null);
        }
      }
    }

    if (e.keyboard && e.keys.size) {
      active = true;
      const pace = (e.keys.has("Shift") ? 60 : 260) * e.unit * (dt / 1000);
      const dx = (e.keys.has("ArrowRight") ? 1 : 0) - (e.keys.has("ArrowLeft") ? 1 : 0), dy = (e.keys.has("ArrowDown") ? 1 : 0) - (e.keys.has("ArrowUp") ? 1 : 0);
      e.pointer = [Math.min(1000, Math.max(0, e.pointer[0] + dx * pace)), Math.min(e.height, Math.max(0, e.pointer[1] + dy * pace))];
      if (!e.down) e.tip = [e.pointer[0], e.pointer[1]];
    }

    if (e.down) {
      active = true;
      const steps = Math.max(1, Math.ceil(dt / 4)), alpha = 1 - Math.min(0.96, Math.max(0, l.smoothing)) * 0.72;
      for (let i = 0; i < steps; i++) {
        const px = e.tip[0], py = e.tip[1];
        e.tip = [px + (e.pointer[0] - px) * alpha, py + (e.pointer[1] - py) * alpha];
        const lastPt = e.points[e.points.length - 1], moved = Math.hypot(e.tip[0] - lastPt[0], e.tip[1] - lastPt[1]);
        if (moved < 0.6 * e.unit) continue;
        if (e.tool === "laser") { e.points.push([e.tip[0], e.tip[1]]); e.laser.push({ p: [e.tip[0], e.tip[1]], t: e.laserNow }); continue; }
        const velocity = moved / e.unit / (dt / steps);
        const want = e.realPressure ?? Math.min(0.85, Math.max(0.2, 0.8 - 0.32 * velocity));
        e.pressure += (want - e.pressure) * 0.18;
        e.points.push([e.tip[0], e.tip[1]]); e.widths.push(l.size * e.unit * (0.5 + e.pressure));
      }
      if (e.tool === "pen" && activeRef.current) {
        const count = e.points.length, taper = 12 * e.unit;
        let walked = 0;
        const shown = e.widths.map((w, i) => { if (i) walked += Math.hypot(e.points[i][0] - e.points[i - 1][0], e.points[i][1] - e.points[i - 1][1]); return w * Math.min(1, 0.45 + (0.55 * walked) / taper); });
        if (count > 1) shown[count - 1] *= 0.5;
        activeRef.current.setAttribute("d", count > 1 ? outline(e.points, shown) : "");
      }
    }

    if (laserRef.current) {
      const fade = Math.max(1, l.laserFade / rate);
      while (e.laser.length && e.laserNow - e.laser[0].t > fade) e.laser.shift();
      if (e.laser.length > 1 && !l.still) {
        active = true;
        const head = 11 * e.unit;
        laserRef.current.setAttribute("d", outline(e.laser.map(s => s.p), e.laser.map(s => head * (0.3 + 0.7 * Math.max(0, 1 - (e.laserNow - s.t) / fade)))));
      } else { laserRef.current.setAttribute("d", ""); if (!e.down) e.laser.length = 0; }
    }

    if (e.morphs.length) {
      active = true;
      const sub = Math.max(1, Math.ceil(dt / 4)), h = ((dt / sub) / 1000) * rate;
      e.morphs = e.morphs.filter(m => {
        for (let i = 0; i < sub; i++) { m.v += (-190 * (m.x - 1) - 19 * m.v) * h; m.x += m.v * h; }
        const el = pathRefs.current.get(m.id);
        if (Math.abs(m.x - 1) < 0.002 && Math.abs(m.v) < 0.05) { m.done(); return false; }
        if (el) el.setAttribute("d", outline(m.from.map((p, i) => [p[0] + (m.to[i][0] - p[0]) * m.x, p[1] + (m.to[i][1] - p[1]) * m.x]), m.fromW.map((w, i) => w + (m.toW[i] - w) * Math.min(1, Math.max(0, m.x)))));
        return true;
      });
    }
    void now;
    paintNib();
    return active;
  }, [getEngine, land, paintNib, penDown, showChip]);
  useLayoutEffect(() => { tickRef.current = tick; });

  const takeOver = useCallback(() => {
    const e = getEngine();
    if (!e.intro) { e.introDone = true; return; }
    e.intro = null; e.introDone = true; e.down = false; e.points = []; e.widths = []; e.laser.length = 0;
    if (activeRef.current) activeRef.current.setAttribute("d", "");
    e.tool = live.current.tool;
    showChip(null);
    setBusy(false);
  }, [getEngine, showChip]);

  // Measure the stage: the board is always 1000 units wide.
  useLayoutEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (!rect.width) return;
      const e = getEngine();
      e.unit = 1000 / rect.width; e.height = f1((rect.height * 1000) / rect.width);
      if (!e.show && !e.down) { e.pointer = [500, f1(e.height / 2)]; e.tip = [500, f1(e.height / 2)]; }
      setHeight(e.height); setUnitState(e.unit); setMeasured(true);
      paintNib();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [getEngine, paintNib]);

  useEffect(() => {
    const e = getEngine();
    if (e.intro || e.down) return;
    e.tool = tool; e.cssColor = color.value; e.color = color.id;
    paintNib();
  }, [color.id, color.value, getEngine, paintNib, tool]);

  // Intro: once, the first time the board is in view. Also pause the loop offscreen and in background tabs.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || !measured) return;
    const e = getEngine();
    const begin = () => {
      if (e.introDone || e.intro || !intro || itemsRef.current.length) return;
      const steps = introSteps(e.height, live.current.colors);
      if (live.current.still) {
        e.introDone = true;
        const made: BoardItem[] = [];
        for (const step of steps) {
          if (step.kind !== "draw" || !step.path) continue;
          const c = live.current.colors[step.color ?? 0] ?? DEFAULT_COLORS[0];
          const found = recognize(step.path, e.unit, MORPH_POINTS);
          if (!found) continue;
          made.push({ id: `${uid}s${++counter.current}`, shape: found.shape, color: c.id, cssColor: c.value, width: f1(live.current.size * 0.85 * e.unit), mode: "clean", d: found.d, points: found.target.map(p => [f1(p[0]), f1(p[1])] as [number, number]), rawPoints: step.path, rawWidths: step.path.map(() => live.current.size * e.unit), snap: found });
        }
        commit(made);
        return;
      }
      e.intro = { steps, index: 0, t: 0, from: [e.pointer[0], e.pointer[1]] };
      setBusy(true);
      start();
    };
    const observer = new IntersectionObserver(([entry]) => {
      e.visible = entry.isIntersecting && !document.hidden;
      if (e.visible) { begin(); start(); } else if (e.raf) { cancelAnimationFrame(e.raf); e.raf = 0; }
    }, { threshold: 0.2 });
    observer.observe(node);
    const onVisibility = () => { e.visible = !document.hidden; if (e.visible) start(); else if (e.raf) { cancelAnimationFrame(e.raf); e.raf = 0; } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); if (e.raf) { cancelAnimationFrame(e.raf); e.raf = 0; } };
  }, [commit, getEngine, intro, measured, start, uid]);

  useEffect(() => () => { if (chipTimer.current) clearTimeout(chipTimer.current); }, []);

  const toBoard = (event: ReactPointerEvent): Pt => {
    const rect = event.currentTarget.getBoundingClientRect(), e = getEngine();
    return [((event.clientX - rect.left) * 1000) / rect.width, ((event.clientY - rect.top) * e.height) / rect.height];
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    takeOver();
    const e = getEngine();
    event.currentTarget.setPointerCapture(event.pointerId);
    e.keyboard = false; e.pointer = toBoard(event);
    e.realPressure = event.pointerType === "pen" && event.pressure > 0 ? event.pressure : null;
    penDown(tool, color.value, color.id);
    if (chip) showChip(chip, 150);
    paintNib(); start();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const e = getEngine();
    if (e.intro) { if (event.pointerType === "mouse" && !event.buttons) return; takeOver(); }
    e.keyboard = false; e.pointer = toBoard(event);
    if (event.pointerType === "pen" && event.pressure > 0) e.realPressure = event.pressure;
    if (!e.down) { e.tip = [e.pointer[0], e.pointer[1]]; e.show = true; paintNib(); }
    start();
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const e = getEngine();
    if (!e.down || e.intro) return;
    e.pointer = toBoard(event);
    land(false);
    if (event.pointerType !== "mouse") { e.show = false; paintNib(); }
  };
  const onPointerLeave = () => { const e = getEngine(); if (!e.down && !e.intro && !e.keyboard) { e.show = false; paintNib(); } };

  const pickTool = (next: WhiteboardTool) => {
    takeOver(); setTool(next);
    setStatus(next === "laser" ? "Laser pointer. Trails fade on their own" : "Pen");
  };
  const toggleSnap = () => { setSnap(value => { setStatus(value ? "Shape snapping off" : "Shape snapping on"); return !value; }); };
  const removeLater = (ids: string[]) => setTimeout(() => commit(itemsRef.current.filter(item => !ids.includes(item.id)), false), LEAVE_MS);
  const undo = () => {
    takeOver();
    const liveItems = itemsRef.current.filter(item => !item.leaving), lastItem = liveItems[liveItems.length - 1];
    if (!lastItem) return;
    const e = getEngine();
    e.morphs = e.morphs.filter(m => m.id !== lastItem.id);
    commit(itemsRef.current.map(item => (item.id === lastItem.id ? { ...item, leaving: true } : item)));
    setStatus(`Removed ${shapeWord(lastItem.shape, false)}`);
    if (chip) showChip(chip, 150);
    removeLater([lastItem.id]);
  };
  const clear = () => {
    takeOver();
    const ids = itemsRef.current.map(item => item.id);
    if (!ids.length) return;
    getEngine().morphs = [];
    commit(itemsRef.current.map(item => ({ ...item, leaving: true })));
    setStatus("Board cleared"); showChip(null);
    removeLater(ids);
  };
  const keepAsDrawn = () => {
    if (!chip) return;
    const item = itemsRef.current.find(it => it.id === chip.id);
    showChip(null);
    if (!item || !item.snap) return;
    const e = getEngine(), id = item.id;
    const rawD = outline(item.rawPoints, item.rawWidths);
    const finish = () => commit(itemsRef.current.map(it => (it.id === id ? { ...it, mode: "ink" as const, d: rawD, shape: "stroke" as const, points: it.rawPoints.map(p => [f1(p[0]), f1(p[1])] as [number, number]), snap: undefined } : it)), false);
    e.morphs = e.morphs.filter(m => m.id !== id);
    commit(itemsRef.current.map(it => (it.id === id ? { ...it, shape: "stroke" as const, mode: "ink" as const, d: live.current.still ? rawD : outline(item.snap!.target, item.snap!.target.map(() => item.width)), points: it.rawPoints.map(p => [f1(p[0]), f1(p[1])] as [number, number]) } : it)));
    setStatus("Kept as drawn");
    if (live.current.still) { finish(); return; }
    const raw = resample(item.rawPoints, MORPH_POINTS, item.rawWidths);
    e.morphs.push({ id, from: item.snap.target, to: raw.pts, fromW: raw.values.map(() => item.width), toW: raw.values, x: 0, v: 0, done: finish });
    start();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const e = getEngine(), key = event.key;
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key.startsWith("Arrow") || key === "Shift") {
      if (key !== "Shift") { event.preventDefault(); takeOver(); e.keyboard = true; e.show = true; }
      e.keys.add(key); paintNib(); start();
    } else if (key === " " || key === "Enter") {
      event.preventDefault();
      if (event.repeat) return;
      takeOver(); e.keyboard = true; e.show = true;
      if (e.down) { land(false); setStatus(prev => (tool === "laser" ? "Pen up" : prev)); }
      else { e.realPressure = null; penDown(tool, color.value, color.id); setStatus("Pen down"); if (chip) showChip(chip, 150); start(); }
    } else if (key === "Escape") {
      if (!e.down) return;
      e.down = false; e.points = []; e.widths = [];
      if (activeRef.current) activeRef.current.setAttribute("d", "");
      setBusy(false); setStatus("Stroke cancelled"); paintNib();
    } else if (key.toLowerCase() === "p") pickTool("pen");
    else if (key.toLowerCase() === "l") pickTool("laser");
    else if (key.toLowerCase() === "s") toggleSnap();
  };
  const onKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => { getEngine().keys.delete(event.key); };
  const onBlur = () => { const e = getEngine(); e.keys.clear(); if (e.keyboard && !e.down) { e.show = false; paintNib(); } };

  const onToolbarKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(toolbarRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  const shown = items.filter(item => !item.leaving);
  const summary = useMemo(() => {
    if (!shown.length) return "The board is empty.";
    const order: WhiteboardShape[] = [], counts = new Map<WhiteboardShape, number>();
    for (const item of shown) { if (!counts.has(item.shape)) order.push(item.shape); counts.set(item.shape, (counts.get(item.shape) ?? 0) + 1); }
    return `On the board: ${order.map(shape => `${counts.get(shape)} ${shapeWord(shape, (counts.get(shape) ?? 0) > 1)}`).join(", ")}.`;
  }, [shown]);

  const unitNow = unitState;
  const cell = f1(22 * unitNow), dot = f1(0.88 * unitNow);
  const empty = shown.length === 0;

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={accent ? ({ ...style, "--ctd-accent": accent } as CSSProperties) : style} aria-labelledby={`${uid}-title`}>
      <header className={styles.header}>
        <h3 className={styles.title} id={`${uid}-title`}>{label}</h3>
        <p className={styles.count} aria-hidden="true">{shown.length} {shown.length === 1 ? "item" : "items"}</p>
      </header>
      <div className={styles.stage} data-tool={tool}>
        <div
          ref={canvasRef} className={styles.canvas} role="application" aria-roledescription="whiteboard" aria-label={`${label} canvas`} aria-describedby={`${uid}-help ${uid}-sum`} tabIndex={0}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerLeave} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={onBlur}
        >
          <svg className={styles.svg} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="xMinYMin slice" aria-hidden="true">
            <defs>
              <pattern id={`${uid}-grid`} patternUnits="userSpaceOnUse" width={cell} height={cell}>
                <circle className={styles.gridDot} cx={f1(cell / 2)} cy={f1(cell / 2)} r={dot} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${uid}-grid)`} />
            <g>
              {items.map(item => (
                <path
                  key={item.id} ref={node => { if (node) pathRefs.current.set(item.id, node); else pathRefs.current.delete(item.id); }}
                  className={styles.ink} data-mode={item.mode} data-leaving={item.leaving ? "" : undefined} d={item.d} style={{ color: item.cssColor }} strokeWidth={item.mode === "clean" ? item.width : undefined}
                />
              ))}
            </g>
            <path ref={activeRef} className={styles.ink} d="" />
            <path ref={laserRef} className={styles.laser} d="" />
            <circle ref={ringRef} className={styles.nibRing} cx={500} cy={300} r={8} />
            <circle ref={nibRef} className={styles.nib} cx={500} cy={300} r={3} />
          </svg>
        </div>
        {hint ? <p className={styles.hint} aria-hidden="true" data-hidden={!empty || busy ? "" : undefined}>{hint}</p> : null}
        <AnimatePresence>
          {chip ? (
            <motion.div
              key="chip" className={styles.chip}
              initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={still ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: still ? 0.01 : 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <Sparkles className={styles.chipIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.chipText}>Snapped to {chip.shape}</span>
              <button type="button" className={styles.chipButton} onClick={keepAsDrawn}>Keep as drawn</button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div ref={toolbarRef} className={styles.toolbar} role="toolbar" aria-label="Drawing tools" onKeyDown={onToolbarKey}>
          <LayoutGroup id={uid}>
            <div className={styles.group}>
              {([["pen", "Pen", "Pen (P)", PenLine], ["laser", "Laser pointer", "Laser pointer (L)", Wand]] as const).map(([id, name, title, Icon]) => (
                <button key={id} type="button" className={styles.tool} aria-pressed={tool === id} aria-label={name} title={title} onClick={() => pickTool(id)}>
                  {tool === id ? <motion.span layoutId="tool" className={styles.toolHighlight} aria-hidden="true" transition={still ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }} /> : null}
                  <Icon className={styles.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ))}
            </div>
          </LayoutGroup>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.group} data-dim={tool === "laser" ? "" : undefined}>
            {colors.map(c => (
              <button
                key={c.id} type="button" className={styles.swatch} aria-pressed={c.id === color.id} aria-label={`${c.label} ink`} title={`${c.label} ink`} style={{ "--swatch": c.value } as CSSProperties}
                onClick={() => { takeOver(); setColorId(c.id); setStatus(`${c.label} ink`); }}
              >
                <span className={styles.swatchDot} aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.group}>
            <button type="button" className={styles.tool} data-toggle="" aria-pressed={snap} aria-label="Snap shapes" title="Snap shapes (S)" onClick={toggleSnap}>
              <Shapes className={styles.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className={styles.tool} aria-label="Undo last stroke" title="Undo (Ctrl or Cmd Z)" disabled={empty} onClick={undo}>
              <Undo2 className={styles.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className={styles.tool} aria-label="Clear board" title="Clear board" disabled={empty} onClick={clear}>
              <Trash2 className={styles.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <p className={styles.srOnly} id={`${uid}-help`}>Draw with a pointer, or with the keyboard: arrow keys move the cursor, Shift moves slowly, Space or Enter puts the pen down and lifts it, Escape cancels a stroke. P picks the pen, L the laser pointer, S turns shape snapping on or off, and Control or Command Z undoes.</p>
      <p className={styles.srOnly} id={`${uid}-sum`}>{summary}</p>
      <span className={styles.srOnly} role="status" aria-live="polite">{status}</span>
    </section>
  );
}

export default CursorTrailDraw;
