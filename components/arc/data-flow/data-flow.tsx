"use client";

import { isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { AppWindow, LayoutDashboard, Warehouse } from "lucide-react";
import { SLACK_LOGO, STRIPE_LOGO, SUPABASE_LOGO } from "./logos";
import styles from "./data-flow.module.css";

export interface DataFlowNode {
  id?: string;
  label: string;
  /** Second line; hidden on narrow layouts. */
  meta?: string;
  /** One line hover tag. */
  detail?: string;
  /** SVG path data on a 24 by 24 viewBox, an image URL, or any node. */
  icon?: string | ReactNode;
  color?: string;
}

export interface DataFlowDestination extends DataFlowNode {
  /** 0 to 1. Thins out this destination evenly; 0.34 sends about every third record. */
  share?: number;
}

export interface DataFlowCore {
  label?: string;
  detail?: string;
  countLabel?: string;
  countStart?: number;
}

export interface DataFlowProps {
  sources?: DataFlowNode[];
  destinations?: DataFlowDestination[];
  core?: DataFlowCore;
  /** Multiplies the flow speed. 0 holds still. */
  speed?: number;
  paused?: boolean;
  /** Color of processed records, trails and active paths. */
  accent?: string;
  /** Accessible description of the diagram. */
  label?: string;
  caption?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_SOURCES: DataFlowNode[] = [
  { id: "app", label: "App", meta: "Web and iOS", detail: "Clicks and sessions as they happen", icon: <AppWindow /> },
  { id: "database", label: "Database", meta: "Supabase", detail: "Row changes through change data capture", icon: SUPABASE_LOGO },
  { id: "events", label: "Events", meta: "Stripe webhooks", detail: "Payments, refunds and disputes", icon: STRIPE_LOGO },
];
const DEFAULT_DESTINATIONS: DataFlowDestination[] = [
  { id: "warehouse", label: "Warehouse", meta: "Every record", detail: "Stored in full for analysis", icon: <Warehouse /> },
  { id: "dashboard", label: "Dashboard", meta: "Live metrics", detail: "Rolled up into metrics each minute", icon: <LayoutDashboard /> },
  { id: "alerts", label: "Alerts", meta: "Slack", detail: "Only unusual records reach #data-alerts", icon: SLACK_LOGO, share: 0.34 },
];
const DEFAULT_CORE = { label: "Transform", detail: "Validates, dedupes and enriches each record", countLabel: "processed", countStart: 12480 };

const CYCLE = 6.6;
const RECORDS = 6;
const GAP = CYCLE / RECORDS;
const SOURCE_ORDER = [0, 1, 2, 0, 2, 1];
const IN_TIME = [1.67, 1.88, 1.8, 1.62, 1.83, 1.75];
const OUT_TIME = [1.77, 2, 1.9, 1.7, 1.93, 1.85];
const MORPH = 0.54;
const CORE = 84;
const TRAIL = 42;
const SAMPLES = 48;

type Pt = [number, number];
interface Track { d: string; length: number; table: number[]; points: Pt[]; edge: number }
interface Box { left: number; top: number; width: number; height: number }
interface Layout {
  mode: "row" | "stack"; width: number; height: number; chips: Box[]; core: Box; center: Pt;
  caption: { place: "below" | "side"; left: number; top: number; maxWidth?: number };
  inTracks: Track[]; outTracks: Track[]; ports: Pt[];
}

const fx = (n: number) => n.toFixed(2);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const sine = (t: number) => (1 - Math.cos(Math.PI * clamp01(t))) / 2;

/** A cubic from the node to the core outline plus a straight run to the center, sampled into an arc length table. */
function makeTrack(port: Pt, c1: Pt, c2: Pt, rim: Pt, center: Pt, outward: boolean): Track {
  const points: Pt[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES, m = 1 - t;
    points.push([m * m * m * port[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * rim[0], m * m * m * port[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * rim[1]]);
  }
  points.push(center);
  if (outward) points.reverse();
  const table = [0];
  for (let i = 1; i < points.length; i++) table.push(table[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const length = table[table.length - 1], spoke = Math.hypot(center[0] - rim[0], center[1] - rim[1]);
  const curve = `C${fx(c1[0])} ${fx(c1[1])} ${fx(c2[0])} ${fx(c2[1])} ${fx(rim[0])} ${fx(rim[1])}`;
  const d = outward
    ? `M${fx(center[0])} ${fx(center[1])} L${fx(rim[0])} ${fx(rim[1])} C${fx(c2[0])} ${fx(c2[1])} ${fx(c1[0])} ${fx(c1[1])} ${fx(port[0])} ${fx(port[1])}`
    : `M${fx(port[0])} ${fx(port[1])} ${curve} L${fx(center[0])} ${fx(center[1])}`;
  return { d, length, table, points, edge: outward ? spoke / length : 1 - spoke / length };
}

function pointAt(track: Track, fraction: number): Pt {
  const want = clamp01(fraction) * track.length, table = track.table;
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid] <= want) lo = mid; else hi = mid; }
  const span = table[hi] - table[lo] || 1, t = (want - table[lo]) / span, a = track.points[lo], b = track.points[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function buildLayout(width: number, sources: number, destinations: number): Layout {
  const W = Math.round(width);
  const spread = (index: number, count: number) => index - (count - 1) / 2;
  if (W >= 600) {
    const height = Math.max(300, Math.round(W * 0.4)), chipW = Math.max(132, Math.round(W * 0.18)), chipH = 52;
    const cy = Math.floor((height - 19) / 2), most = Math.max(sources, destinations, 1);
    const pitch = Math.min(Math.round(height * 0.29), Math.floor((height - chipH - 2) / Math.max(1, most - 1)));
    const center: Pt = [W / 2, cy], chips: Box[] = [], ports: Pt[] = [], inTracks: Track[] = [], outTracks: Track[] = [];
    const lean = (index: number, count: number) => (count > 1 ? (spread(index, count) / ((count - 1) / 2)) * CORE * 0.16 : 0);
    for (let i = 0; i < sources; i++) {
      const y = cy + spread(i, sources) * pitch, port: Pt = [1 + chipW, y], rim: Pt = [center[0] - CORE / 2, cy + lean(i, sources)], mid = (port[0] + rim[0]) / 2;
      chips.push({ left: 1, top: Math.round(y - chipH / 2), width: chipW, height: chipH }); ports.push(port);
      inTracks.push(makeTrack(port, [mid, y], [mid, rim[1]], rim, center, false));
    }
    for (let i = 0; i < destinations; i++) {
      const y = cy + spread(i, destinations) * pitch, port: Pt = [W - 1 - chipW, y], rim: Pt = [center[0] + CORE / 2, cy + lean(i, destinations)], mid = (port[0] + rim[0]) / 2;
      chips.push({ left: W - 1 - chipW, top: Math.round(y - chipH / 2), width: chipW, height: chipH }); ports.push(port);
      outTracks.push(makeTrack(port, [mid, y], [mid, rim[1]], rim, center, true));
    }
    return { mode: "row", width: W, height, chips, ports, inTracks, outTracks, center, core: { left: center[0] - CORE / 2, top: cy - CORE / 2, width: CORE, height: CORE }, caption: { place: "below", left: center[0], top: cy + CORE / 2 + 12 } };
  }
  const height = Math.min(560, Math.max(440, Math.round(W * 1.24))), chipH = 64, gap = 8;
  const center: Pt = [W / 2, height / 2], chips: Box[] = [], ports: Pt[] = [], inTracks: Track[] = [], outTracks: Track[] = [];
  const row = (count: number, top: number) => {
    const each = (W - 2 - gap * (count - 1)) / Math.max(1, count), boxes: Box[] = [];
    for (let i = 0; i < count; i++) {
      const left = Math.round(1 + i * (each + gap)), right = i === count - 1 ? W - 1 : Math.round(1 + (i + 1) * (each + gap)) - gap;
      boxes.push({ left, top, width: right - left, height: chipH });
    }
    return boxes;
  };
  const lean = (index: number, count: number) => (count > 1 ? (spread(index, count) / ((count - 1) / 2)) * (CORE / 6) : 0);
  row(sources, 1).forEach((box, i) => {
    const x = box.left + box.width / 2, port: Pt = [x, 1 + chipH], rim: Pt = [center[0] + lean(i, sources), center[1] - CORE / 2], mid = (port[1] + rim[1]) / 2;
    chips.push(box); ports.push(port); inTracks.push(makeTrack(port, [x, mid], [rim[0], mid], rim, center, false));
  });
  row(destinations, height - 1 - chipH).forEach((box, i) => {
    const x = box.left + box.width / 2, port: Pt = [x, height - 1 - chipH], rim: Pt = [center[0] + lean(i, destinations), center[1] + CORE / 2], mid = (port[1] + rim[1]) / 2;
    chips.push(box); ports.push(port); outTracks.push(makeTrack(port, [x, mid], [rim[0], mid], rim, center, true));
  });
  const captionLeft = center[0] + CORE / 2 + 14;
  return { mode: "stack", width: W, height, chips, ports, inTracks, outTracks, center, core: { left: center[0] - CORE / 2, top: center[1] - CORE / 2, width: CORE, height: CORE }, caption: { place: "side", left: captionLeft, top: center[1], maxWidth: Math.max(0, W - captionLeft - 4) } };
}

function Mark({ icon, color }: { icon: DataFlowNode["icon"]; color?: string }) {
  if (icon == null || icon === false) return null;
  if (typeof icon === "string") {
    if (/^\s*[Mm][\s\d.,-]/.test(icon) && !/\.(svg|png|jpe?g|webp|gif|avif)(\?|$)/i.test(icon)) {
      return <span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 24 24" style={{ strokeWidth: 0 }}><path d={icon} fill={color ?? "currentColor"} /></svg></span>;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.mark} alt="" draggable={false} src={icon} />;
  }
  return <span className={styles.mark} aria-hidden="true" style={color && isValidElement(icon) ? { color } : undefined}>{icon}</span>;
}

const listWords = (words: string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`);

export function DataFlow({ sources = DEFAULT_SOURCES, destinations = DEFAULT_DESTINATIONS, core, speed = 1, paused = false, accent, label, caption, className, style }: DataFlowProps) {
  const reduced = useReducedMotion() ?? false;
  const coreInfo = { ...DEFAULT_CORE, ...core };
  const countStart = coreInfo.countStart;
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<SVGSVGElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | "core" | null>(null);
  const nSrc = sources.length, nDst = destinations.length;
  const layout = useMemo(() => (width > 0 ? buildLayout(width, nSrc, nDst) : null), [width, nSrc, nDst]);

  // Which destinations each of the six records reaches. A share thins a destination out evenly.
  const shareKey = destinations.map(d => d.share ?? 1).join(",");
  const routes = useMemo(() => {
    const shares = shareKey ? shareKey.split(",").map(Number) : [];
    return Array.from({ length: RECORDS }, (_, r) => shares.map(share => {
      const s = clamp01(share);
      return s >= 1 || Math.floor((r + 1) * s + 1e-6) > Math.floor(r * s + 1e-6);
    }));
  }, [shareKey]);

  const live = useRef({ speed, paused, hover, reduced, countStart });
  useLayoutEffect(() => { live.current = { speed, paused, hover, reduced, countStart }; });
  const clock = useRef({ time: 0, rate: 0, velocity: 0, raf: 0, last: 0, visible: true, cache: new Map<string, string>() });

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.round(node.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = flowRef.current, stage = stageRef.current;
    if (!layout || !svg || !stage || !nSrc) return;
    const state = clock.current;
    state.cache = new Map();
    const all = <T extends Element>(selector: string) => Array.from(svg.querySelectorAll<T>(selector));
    const ring = svg.querySelector<SVGGElement>("[data-ring]"), pulse = svg.querySelector<SVGRectElement>("[data-pulse]");
    const portHits = all<SVGCircleElement>("[data-port-hit]");
    const hitNodes = Array.from(stage.querySelectorAll<HTMLElement>("[data-hit]"));
    const slots = all<SVGGElement>("[data-record]").map(group => ({
      trail: group.querySelector<SVGPathElement>("[data-trail-in]"), dot: group.querySelector<SVGGElement>("[data-dot]"),
      raw: group.querySelector<SVGRectElement>("[data-raw]"), done: group.querySelector<SVGRectElement>("[data-done]"),
      outs: Array.from(group.querySelectorAll<SVGGElement>("[data-out]")).map(out => ({ trail: out.querySelector<SVGPathElement>("path"), copy: out.querySelector<SVGGElement>("g") })),
    }));
    const set = (key: string, el: Element | null | undefined, name: string, value: string) => {
      if (!el || state.cache.get(key) === value) return;
      state.cache.set(key, value); el.setAttribute(name, value);
    };
    const [cx, cy] = layout.center;
    const carrier = Math.floor((nDst - 1) / 2);
    let spin = 0;

    const paint = (time: number, still: boolean) => {
      const hits = new Array(nSrc + nDst + 1).fill(0);
      let count = live.current.countStart, pulseAge = Infinity;
      for (let r = 0; r < RECORDS; r++) {
        const slot = slots[r];
        if (!slot) continue;
        const src = SOURCE_ORDER[r] % nSrc, inT = IN_TIME[r], outT = OUT_TIME[r], total = inT + MORPH + outT;
        let age: number;
        if (still) age = r < 3 ? inT * 0.5 : inT + MORPH + outT * 0.52;
        else {
          const since = time - r * GAP;
          age = since < 0 ? -1 : since % CYCLE;
          if (since >= inT + MORPH) count += Math.floor((since - inT - MORPH) / CYCLE) + 1;
          if (since >= inT) pulseAge = Math.min(pulseAge, (since - inT) % CYCLE);
          if (age >= 0) hits[src] = Math.max(hits[src], Math.pow(clamp01(1 - age / 0.6), 2));
        }
        const track = layout.inTracks[src], key = `r${r}`;
        if (!still && age < 0) { set(key + "to", slot.trail, "opacity", "0"); set(key + "do", slot.dot, "opacity", "0"); slot.outs.forEach((out, j) => { set(`${key}o${j}t`, out.trail, "opacity", "0"); set(`${key}o${j}c`, out.copy, "opacity", "0"); }); continue; }
        // Inbound leg and the morph in the core.
        if (age < inT + MORPH) {
          const head = sine(age / inT), [x, y] = pointAt(track, head), morph = clamp01((age - inT) / MORPH);
          const swell = age < inT ? 0.5 + 0.5 * sine(age / 0.27) : 1 + 0.3 * Math.sin(Math.PI * morph);
          set(key + "do", slot.dot, "opacity", still ? "1" : clamp01(age / 0.2).toFixed(3));
          set(key + "dt", slot.dot, "transform", `translate(${fx(x)} ${fx(y)}) scale(${(still ? 1 : swell).toFixed(3)})`);
          set(key + "ra", slot.raw, "opacity", (1 - sine(morph)).toFixed(3));
          set(key + "dn", slot.done, "opacity", sine(morph).toFixed(3));
          const lead = Math.min(head, track.edge), span = (TRAIL / track.length) * 1000, tail = Math.max(0, lead * 1000 - span);
          const beyond = age < inT ? Math.max(0, age - inT * (Math.acos(1 - 2 * Math.min(1, track.edge)) / Math.PI)) : 1;
          set(key + "to", slot.trail, "opacity", (still ? 1 : Math.min(clamp01(age / 0.3), clamp01(1 - beyond / 0.33))).toFixed(3));
          set(key + "td", slot.trail, "stroke-dasharray", `${fx(lead * 1000 - tail)} 2000`);
          set(key + "tf", slot.trail, "stroke-dashoffset", fx(-tail));
          slot.outs.forEach((out, j) => { set(`${key}o${j}t`, out.trail, "opacity", "0"); set(`${key}o${j}c`, out.copy, "opacity", "0"); });
          continue;
        }
        set(key + "do", slot.dot, "opacity", "0"); set(key + "to", slot.trail, "opacity", "0");
        const leg = age - inT - MORPH, done = leg >= outT;
        slot.outs.forEach((out, j) => {
          const goes = routes[r]?.[j] && (!still || j === r - 3 || nDst <= r - 3);
          if (!goes || done) { set(`${key}o${j}t`, out.trail, "opacity", "0"); set(`${key}o${j}c`, out.copy, "opacity", "0"); return; }
          const path = layout.outTracks[j], head = sine(leg / outT), [x, y] = pointAt(path, head), left = outT - leg;
          const lead = Math.max(0, head - path.edge) * 1000, span = (TRAIL / path.length) * 1000, from = path.edge * 1000 + Math.max(0, lead - span);
          const fade = still ? 1 : clamp01(left / 0.2), born = still || j === carrier ? 1 : Math.pow(clamp01(leg / 0.47), 2);
          set(`${key}o${j}c`, out.copy, "opacity", (fade * born).toFixed(3));
          set(`${key}o${j}x`, out.copy, "transform", `translate(${fx(x)} ${fx(y)}) scale(${(0.45 + 0.55 * fade).toFixed(3)})`);
          set(`${key}o${j}t`, out.trail, "opacity", (still ? 1 : clamp01(left / 0.4)).toFixed(3));
          set(`${key}o${j}d`, out.trail, "stroke-dasharray", `${fx(Math.min(lead, span))} 2000`);
          set(`${key}o${j}f`, out.trail, "stroke-dashoffset", fx(-from));
        });
        if (!still) {
          const landed = (time - r * GAP - total + 0.25) % CYCLE;
          if (time - r * GAP >= total - 0.25) routes[r]?.forEach((goes, j) => { if (goes) hits[nSrc + j] = Math.max(hits[nSrc + j], Math.pow(clamp01(1 - landed / 0.6), 2)); });
        }
      }
      if (!still && pulseAge < Infinity) hits[nSrc + nDst] = Math.pow(clamp01(1 - pulseAge / 0.8), 2);
      const grow = still || pulseAge === Infinity ? 1 : sine(pulseAge / 0.65);
      set("ps", pulse, "transform", `translate(${cx} ${cy}) scale(${(1 + 0.16 * grow).toFixed(4)})`);
      set("po", pulse, "opacity", still || pulseAge === Infinity ? "0" : (0.5 * Math.pow(clamp01(1 - pulseAge / 0.75), 2)).toFixed(3));
      set("rg", ring, "transform", `translate(${cx} ${cy}) rotate(${(((spin % 360) + 360) % 360).toFixed(2)})`);
      hits.forEach((hit, i) => {
        const value = hit.toFixed(3), node = hitNodes[i];
        if (node && state.cache.get(`h${i}`) !== value) { state.cache.set(`h${i}`, value); node.style.setProperty("--hit", value); }
        set(`ph${i}`, portHits[i], "fill-opacity", value);
      });
      const text = Math.round(count).toLocaleString("en-US");
      if (numRef.current && state.cache.get("n") !== text) { state.cache.set("n", text); numRef.current.textContent = text; }
      return pulseAge;
    };

    if (live.current.reduced) { paint(0, true); return; }
    const frame = (now: number) => {
      state.raf = 0;
      const dt = Math.min(0.05, (now - state.last) / 1000), l = live.current;
      state.last = now;
      const target = l.paused ? 0 : Math.max(0, l.speed) * (l.hover === null ? 1 : 0.6);
      // Critically damped spring toward the target rate.
      const k = 60, c = 2 * Math.sqrt(k);
      state.velocity += (k * (target - state.rate) - c * state.velocity) * dt; state.rate += state.velocity * dt;
      if (Math.abs(target - state.rate) < 0.001 && Math.abs(state.velocity) < 0.001) { state.rate = target; state.velocity = 0; }
      state.time += dt * state.rate;
      const pulseAge = paint(state.time, false);
      spin += dt * state.rate * (14 + 46 * Math.pow(clamp01(1 - (pulseAge === Infinity ? 1 : pulseAge) / 0.7), 1.5));
      if (state.visible && (target > 0 || state.rate > 0)) state.raf = requestAnimationFrame(frame);
    };
    const run = () => { if (!state.raf && state.visible) { state.last = performance.now(); state.raf = requestAnimationFrame(frame); } };
    const halt = () => { if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; } };
    paint(state.time, false);
    const observer = new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting && !document.hidden; if (state.visible) run(); else halt(); });
    observer.observe(stage);
    const onVisibility = () => { state.visible = !document.hidden; if (state.visible) run(); else halt(); };
    document.addEventListener("visibilitychange", onVisibility);
    run();
    return () => { halt(); observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [layout, nSrc, nDst, routes, reduced, paused, speed]);

  const description = label ?? `Data flow. Records from ${listWords(sources.map(s => s.label.toLowerCase()))} stream into ${coreInfo.label.toLowerCase()}, which turns each raw record into a clean one and fans it out to ${listWords(destinations.map(d => d.label.toLowerCase()))}.`;
  const enter = (target: number | "core") => (event: ReactPointerEvent) => { if (event.pointerType === "mouse") setHover(target); };
  const leave = () => setHover(null);
  const nodes = [...sources, ...destinations];
  const pathOn = (index: number) => hover === "core" || hover === index;

  return (
    <figure ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={accent ? ({ ...style, "--flow-accent": accent } as CSSProperties) : style} data-layout={layout?.mode ?? "row"} data-ready={layout ? "true" : undefined}>
      <div ref={stageRef} className={styles.stage} role="img" aria-label={description} style={layout ? { height: layout.height } : undefined} data-focus={hover !== null ? "" : undefined}>
        {layout ? (
          <>
            <svg className={styles.layer} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} aria-hidden="true">
              {layout.inTracks.map((track, i) => <path key={`i${i}`} className={styles.path} d={track.d} data-on={pathOn(i) ? "" : undefined} />)}
              {layout.outTracks.map((track, j) => <path key={`o${j}`} className={styles.path} d={track.d} data-on={pathOn(nSrc + j) ? "" : undefined} />)}
            </svg>
            {nodes.map((node, i) => {
              const box = layout.chips[i], side = i < nSrc ? "src" : "dst";
              return (
                <div
                  key={`${side}-${node.id ?? i}`} className={styles.chip} data-side={side} data-hit="" data-on={hover === i ? "" : undefined}
                  data-dim={typeof hover === "number" && hover !== i && (hover < nSrc) === (i < nSrc) ? "" : undefined}
                  style={{ left: box.left, top: box.top, width: box.width, height: box.height }} onPointerEnter={enter(i)} onPointerLeave={leave}
                >
                  <Mark icon={node.icon} color={node.color} />
                  <span className={styles.text}>
                    <span className={styles.label}>{node.label}</span>
                    {node.meta ? <span className={styles.meta}>{node.meta}</span> : null}
                  </span>
                  {node.detail ? <span className={styles.tag} aria-hidden="true">{node.detail}</span> : null}
                </div>
              );
            })}
            <div className={styles.core} data-hit="" data-on={hover === "core" ? "" : undefined} style={{ left: layout.core.left, top: layout.core.top, width: CORE, height: CORE }} onPointerEnter={enter("core")} onPointerLeave={leave}>
              {coreInfo.detail ? <span className={styles.tag} data-place="above" aria-hidden="true">{coreInfo.detail}</span> : null}
            </div>
            <div className={styles.caption} data-place={layout.caption.place} style={{ left: layout.caption.left, top: layout.caption.top, maxWidth: layout.caption.maxWidth }}>
              <span className={styles.label}>{coreInfo.label}</span>
              <span className={styles.meta}><span ref={numRef} className={styles.num}>{countStart.toLocaleString("en-US")}</span> {coreInfo.countLabel}</span>
            </div>
            <svg ref={flowRef} className={styles.layer} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} aria-hidden="true">
              <g data-ring="" transform={`translate(${layout.center[0]} ${layout.center[1]})`}><circle className={styles.ring} r={CORE * 0.24} /></g>
              <rect data-pulse="" className={styles.pulse} x={-CORE / 2} y={-CORE / 2} width={CORE} height={CORE} rx={CORE * 0.28} transform={`translate(${layout.center[0]} ${layout.center[1]})`} opacity="0" />
              {layout.ports.map((port, i) => (
                <g key={`p${i}`} className={styles.slot} data-dim={typeof hover === "number" && hover !== i && (hover < nSrc) === (i < nSrc) ? "" : undefined}>
                  <circle className={styles.port} cx={port[0]} cy={port[1]} r={3.5} />
                  <circle data-port-hit="" className={styles.portHit} cx={port[0]} cy={port[1]} r={2.25} fillOpacity={0} />
                </g>
              ))}
              {nSrc ? SOURCE_ORDER.map((order, r) => {
                const src = order % nSrc;
                return (
                  <g key={`r${r}`} data-record="" className={styles.slot} data-dim={typeof hover === "number" && hover < nSrc && hover !== src ? "" : undefined}>
                    <path data-trail-in="" className={styles.trailRaw} d={layout.inTracks[src].d} pathLength={1000} opacity="0" />
                    {layout.outTracks.map((track, j) => (
                      <g key={j} data-out="" className={styles.slot} data-dim={typeof hover === "number" && hover >= nSrc && hover - nSrc !== j ? "" : undefined}>
                        <path className={styles.trailDone} d={track.d} pathLength={1000} opacity="0" />
                        <g opacity="0"><rect className={styles.done} x={-4.5} y={-4.5} width={9} height={9} rx={2.5} /></g>
                      </g>
                    ))}
                    <g data-dot="" opacity="0">
                      <rect data-raw="" className={styles.raw} x={-4} y={-4} width={8} height={8} rx={4} />
                      <rect data-done="" className={styles.done} x={-4.5} y={-4.5} width={9} height={9} rx={2.5} opacity="0" />
                    </g>
                  </g>
                );
              }) : null}
            </svg>
          </>
        ) : null}
      </div>
      {caption ? <figcaption className={styles.figcaption}>{caption}</figcaption> : null}
    </figure>
  );
}

export default DataFlow;
