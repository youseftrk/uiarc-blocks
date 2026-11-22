"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./ai-spark.module.css";

export type AiSparkStatus = "idle" | "thinking" | "generating" | "done" | "error";
export type AiSparkTone = "accent" | "foreground" | "muted" | "inherit";
export type AiSparkVariant = "mark" | "pill" | "avatar";

export interface AiSparkProps {
  /** What the AI is doing. Omit it and the mark cycles through its states on its own. */
  status?: AiSparkStatus;
  size?: number | string;
  tone?: AiSparkTone;
  color?: string;
  variant?: AiSparkVariant;
  label?: string;
  speed?: number;
  twinkle?: boolean;
  paused?: boolean;
  announce?: boolean;
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
}

interface Geo {
  p: { r0: number; r1: number; a: number; b: number };
  s: { r0: number; r1: number; a: number; b: number; dot: boolean };
  core: number;
  particles: boolean;
  toneB: number;
}
interface Pose { fill: (t: number, out: Float32Array) => void; spin: number; rest: boolean; loops: boolean }
interface Impulse { kind: "gather" | "shake"; start: number }
interface Engine {
  status: AiSparkStatus; twinkle: boolean; from: Pose; to: Pose; mixStart: number; mixDur: number; t: number; clock: number; angle: number; vel: number;
  target: number | null; glide: { start: number; from: number; v0: number; distance: number; duration: number }; impulses: Impulse[];
  A: Float32Array; B: Float32Array; out: Float32Array; raf: number; last: number; inView: boolean; kick: () => void;
}

const LABELS: Record<AiSparkStatus, string> = { idle: "Ready", thinking: "Thinking", generating: "Writing", done: "Done", error: "Couldn't finish" };
const SPOKEN: Record<AiSparkStatus, string> = { idle: "AI ready", thinking: "AI is thinking", generating: "AI is writing", done: "AI finished", error: "AI couldn't finish" };
const TONES: Record<AiSparkTone, string> = { accent: "var(--accent)", foreground: "var(--foreground)", muted: "var(--text-muted)", inherit: "currentColor" };
const CYCLE: [AiSparkStatus, number][] = [["idle", 1600], ["thinking", 2800], ["generating", 3600], ["done", 2000]];
const TAU = 2 * Math.PI;
const JITTER = [0, 0.021, -0.014, 0.017, -0.019, 0.012, 0.008, -0.016];
const fract = (value: number) => value - Math.floor(value);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const unit = (value: number) => Math.min(1, Math.max(0, value));
const wave = (value: number) => 0.5 - 0.5 * Math.cos(TAU * value);
const bump = (value: number, start: number, length: number) => (value <= start || value >= start + length ? 0 : Math.sin((Math.PI * (value - start)) / length) ** 2);
const easeInOut = (value: number) => (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);
const num = (value: number) => String(Math.round(100 * value) / 100);

function ray(inner: number, outer: number, wide: number, narrow: number) {
  const length = outer - inner;
  if (length <= wide - narrow + 0.001) {
    const y = num(-inner);
    const r = num(wide);
    return `M${r} ${y}A${r} ${r} 0 1 0 -${r} ${y}A${r} ${r} 0 1 0 ${r} ${y}Z`;
  }
  const sine = (wide - narrow) / length;
  const cosine = Math.sqrt(1 - sine * sine);
  const x0 = num(wide * cosine);
  const y0 = num(-inner - wide * sine);
  const x1 = num(narrow * cosine);
  const y1 = num(-outer - narrow * sine);
  return `M${x0} ${y0}L${x1} ${y1}A${num(narrow)} ${num(narrow)} 0 0 0 -${x1} ${y1}L-${x0} ${y0}A${num(wide)} ${num(wide)} 0 1 0 ${x0} ${y0}Z`;
}

function rayPath(geo: Geo, index: number, pose: Float32Array) {
  const at = 4 * index;
  const length = Math.max(0, pose[at]);
  const width = pose[at + 1];
  const shift = pose[at + 2];
  if (index % 2 === 0) {
    const p = geo.p;
    const inner = p.r0 + shift;
    return ray(inner, inner + (p.r1 - p.r0) * length, p.a * width, p.b * width);
  }
  const s = geo.s;
  const inner = s.r0 + shift;
  if (s.dot) {
    const r = s.a * width * (0.72 + 0.28 * Math.min(1.3, length));
    return ray(inner, inner, r, r);
  }
  return ray(inner, inner + (s.r1 - s.r0) * length, s.a * width, Math.min(s.a, s.b) * width);
}

function put(out: Float32Array, index: number, length: number, width: number, shift: number, opacity: number) {
  const at = 4 * index;
  out[at] = length;
  out[at + 1] = width;
  out[at + 2] = shift;
  out[at + 3] = opacity;
}

function idlePose(twinkle: boolean): Pose {
  return {
    fill: (t, out) => {
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
          put(out, i, 1, 1, 0, 1);
          continue;
        }
        const glint = twinkle ? bump(fract(t / 6.4 - (i - 1) / 8 + JITTER[i]), 0, 0.32) : 0;
        put(out, i, 1 + 0.3 * glint, 1 + 0.08 * glint, +glint, 1);
      }
      out[32] = twinkle ? 1 + 0.018 * wave(t / 6.4) : 1;
      out[33] = twinkle ? 1 + 0.1 * wave(t / 3.2) : 1;
      out[34] = 0;
    },
    spin: 0,
    rest: true,
    loops: twinkle,
  };
}

const THINKING: Pose = {
  fill: (t, out) => {
    for (let i = 0; i < 8; i++) {
      const w = wave(t / 1.9 - i / 8 + JITTER[i]) ** 1.35;
      if (i % 2 === 0) put(out, i, 0.7 + 0.3 * w, 0.94 + 0.08 * w, -1 + 2 * w, 1);
      else put(out, i, 0.42 + 0.78 * w, 0.88 + 0.16 * w, -1 + 3 * w, 0.5 + 0.5 * w);
    }
    out[32] = 0.965 + 0.03 * wave(t / 4);
    out[33] = 0.7 + 0.22 * wave(t);
    out[34] = 0;
  },
  spin: 26,
  rest: false,
  loops: true,
};

const beat = (value: number) => bump(value, 0, 0.2) + 0.62 * bump(value, 0.2, 0.22);
const GENERATING: Pose = {
  fill: (t, out) => {
    for (let i = 0; i < 8; i++) {
      const pair = i >> 1;
      if (i % 2 === 0) {
        const b = beat(fract(t / 1.04 - 0.045 * pair + 0.3 * JITTER[i]));
        put(out, i, 0.7 + 0.32 * b, 0.96 + 0.08 * b, 0.8 * b, 1);
      } else {
        const b = beat(fract(t / 1.04 - 0.17 - 0.045 * pair + 0.3 * JITTER[i]));
        put(out, i, 0.55 + 0.65 * b, 0.92 + 0.12 * b, 2.5 * b, 0.6 + 0.4 * b);
      }
    }
    const b = beat(fract(t / 1.04));
    out[32] = 0.975 + 0.035 * b;
    out[33] = 0.9 + 0.5 * beat(fract(t / 1.04 - 0.03));
    out[34] = 1;
  },
  spin: 46,
  rest: false,
  loops: true,
};

const DONE: Pose = {
  fill: (_, out) => {
    for (let i = 0; i < 8; i++) put(out, i, 1, 1, 0, 1);
    out[32] = 1;
    out[33] = 1;
    out[34] = 0;
  },
  spin: 0,
  rest: true,
  loops: false,
};

const ERROR: Pose = {
  fill: (_, out) => {
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) put(out, i, 0.56, 0.96, -1, 1);
      else put(out, i, 0.34, 0.9, -2, 0.45);
    }
    out[32] = 0.96;
    out[33] = 0.8;
    out[34] = 0;
  },
  spin: 0,
  rest: true,
  loops: false,
};

const IDLE_TWINKLE = idlePose(true);
const IDLE_STILL = idlePose(false);

function poseFor(status: AiSparkStatus, twinkle: boolean): Pose {
  switch (status) {
    case "idle":
      return twinkle ? IDLE_TWINKLE : IDLE_STILL;
    case "thinking":
      return THINKING;
    case "generating":
      return GENERATING;
    case "done":
      return DONE;
    default:
      return ERROR;
  }
}

function blendPoses(from: Pose, to: Pose, amount: number): Pose {
  const a = new Float32Array(35);
  const b = new Float32Array(35);
  return {
    fill: (t, out) => {
      from.fill(t, a);
      to.fill(t, b);
      for (let i = 0; i < 35; i++) out[i] = a[i] + (b[i] - a[i]) * amount;
    },
    spin: to.spin,
    rest: to.rest,
    loops: from.loops || to.loops,
  };
}

function geometryFor(px: number): Geo {
  const k = unit(Math.log(Math.max(1, px) / 12) / Math.log(8));
  const dot = px < 18;
  return {
    p: { r0: mix(11, 13.5, k), r1: mix(41.5, 44, k), a: mix(8.4, 5.6, k), b: mix(3.9, 1.8, k) },
    s: dot ? { r0: 27, r1: 27, a: mix(5.6, 5, unit((px - 12) / 6)), b: 0, dot } : { r0: mix(23.5, 22, k), r1: mix(32, 36, k), a: mix(4.9, 3.7, k), b: mix(2.3, 1.4, k), dot },
    core: px >= 28 ? mix(2.6, 3.4, k) : 0,
    particles: px >= 40,
    toneB: mix(0.66, 0.5, k),
  };
}

function initialPose(status: AiSparkStatus) {
  const out = new Float32Array(35);
  poseFor(status, false).fill(0, out);
  return out;
}

const noop = () => () => {};

function useCycle(enabled: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % CYCLE.length), CYCLE[index][1]);
    return () => window.clearTimeout(timer);
  }, [enabled, index]);
  return CYCLE[index][0];
}

export function AiSpark({
  status: statusProp,
  size,
  tone = "accent",
  color,
  variant = "mark",
  label,
  speed = 1,
  twinkle = true,
  paused = false,
  announce = true,
  "aria-label": ariaLabel,
  className,
  style,
}: AiSparkProps) {
  const cycled = useCycle(statusProp === undefined && !paused);
  const status = statusProp ?? cycled;
  const pill = variant === "pill";
  const avatar = variant === "avatar";
  const box = size ?? (pill ? 16 : avatar ? 32 : 24);
  const boxCss = typeof box === "number" ? `${box}px` : box;
  const markCss = avatar ? (typeof box === "number" ? `${Math.round(0.56 * box)}px` : `calc(${box} * .56)`) : boxCss;
  const prefersReduced = useReducedMotion();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reduced = !!(hydrated && prefersReduced);
  const rootRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const scaleRef = useRef<SVGGElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const rayRefs = useRef<(SVGPathElement | null)[]>([]);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const known = typeof box === "number" ? (avatar ? Math.round(0.56 * box) : box) : null;
  useLayoutEffect(() => {
    if (known !== null) return;
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = svg.getBoundingClientRect().width;
      if (width > 0) setMeasured(Math.round(width));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [known]);
  const px = known ?? measured ?? 16;
  const geo = useMemo(() => geometryFor(px), [px]);
  const live = useRef({ geo, speed, reduced, paused, twinkle });
  useLayoutEffect(() => {
    live.current = { geo, speed, reduced, paused, twinkle };
  });
  const [firstStatus] = useState(status);
  const firstPose = useMemo(() => initialPose(firstStatus), [firstStatus]);

  useEffect(() => {
    const pose = poseFor(firstStatus, live.current.twinkle);
    const e: Engine = engineRef.current ?? {
      status: firstStatus, twinkle: live.current.twinkle, from: pose, to: pose, mixStart: 0, mixDur: 0, t: 0, clock: 0, angle: 0, vel: 0, target: null,
      glide: { start: 0, from: 0, v0: 0, distance: 0, duration: 0 }, impulses: [], A: new Float32Array(35), B: new Float32Array(35), out: new Float32Array(35), raf: 0, last: 0, inView: true, kick: () => {},
    };
    engineRef.current = e;
    const progress = () => (e.mixDur <= 0 ? 1 : Math.min(1, (e.clock - e.mixStart) / e.mixDur));
    const paint = () => {
      const { geo: g, reduced: still } = live.current;
      const out = e.out;
      const amount = easeInOut(progress());
      const time = still ? 0 : e.t;
      if (amount >= 1) e.to.fill(time, out);
      else {
        e.from.fill(time, e.A);
        e.to.fill(time, e.B);
        for (let i = 0; i < 35; i++) out[i] = e.A[i] + (e.B[i] - e.A[i]) * amount;
      }
      let shake = 0;
      let scale = out[32];
      let core = out[33];
      if (!still)
        for (const impulse of e.impulses) {
          const age = e.clock - impulse.start;
          if (impulse.kind === "shake") {
            shake += age < 0 || age >= 0.46 ? 0 : 3.2 * Math.sin((TAU * age) / 0.15) * (1 - age / 0.46) ** 2;
            continue;
          }
          const gather = age < 0 || age >= 0.68 ? 0 : age < 0.17 ? 1 - Math.pow(1 - age / 0.17, 3) : 1 - easeInOut((age - 0.17) / 0.51);
          if (gather <= 0) continue;
          for (let i = 0; i < 8; i++) {
            const at = 4 * i;
            const main = i % 2 === 0;
            out[at] *= 1 - (main ? 0.12 : 0.2) * gather;
            out[at + 2] -= (main ? 2.4 : 3) * gather;
          }
          scale *= 1 - 0.045 * gather;
          core *= 1 + 0.35 * gather;
        }
      for (let i = 0; i < 8; i++) {
        const path = rayRefs.current[i];
        if (!path) continue;
        path.setAttribute("d", rayPath(g, i, out));
        path.setAttribute("opacity", out[4 * i + 3].toFixed(3));
      }
      coreRef.current?.setAttribute("r", (g.core * Math.max(0, core)).toFixed(2));
      scaleRef.current?.setAttribute("transform", `translate(${shake.toFixed(2)} 0) scale(${scale.toFixed(4)})`);
      spinRef.current?.setAttribute("transform", `rotate(${e.angle.toFixed(3)})`);
      const sparks = g.particles && !still ? out[34] : 0;
      for (let i = 0; i < 2; i++) {
        const particle = particleRefs.current[i];
        if (!particle) continue;
        if (sparks < 0.01) {
          particle.setAttribute("opacity", "0");
          continue;
        }
        const angle = i === 0 ? 30 + (360 * e.t) / 2.6 : 210 + (360 * e.t) / 3.9;
        const glow = 0.55 + 0.45 * wave(e.t / 1.3 + 0.5 * i);
        particle.setAttribute("transform", `rotate(${(angle % 360).toFixed(2)}) translate(0 -47.5) scale(${(0.5 + 0.5 * sparks).toFixed(3)})`);
        particle.setAttribute("opacity", (sparks * glow).toFixed(3));
      }
    };
    const tick = (now: number) => {
      const { speed: rate, reduced: still } = live.current;
      const dt = e.last ? Math.min(1 / 30, (now - e.last) / 1000) : 1 / 60;
      e.last = now;
      e.clock += dt;
      if (!still) e.t += dt * rate;
      if (progress() >= 1) e.from = e.to;
      e.impulses = e.impulses.filter(impulse => e.clock - impulse.start < 0.7);
      if (still) {
        e.vel = 0;
        e.angle = 90 * Math.round(e.angle / 90);
      } else if (e.to.rest) {
        if (e.target === null) {
          const v0 = Math.max(0, e.vel);
          e.target = 90 * Math.ceil((e.angle + 0.2 * v0) / 90 - 1e-6);
          const distance = e.target - e.angle;
          e.glide = { start: e.clock, from: e.angle, v0, distance, duration: Math.min(1.8, Math.max(0.6, v0 > 0.5 ? (3 * distance) / v0 : 1.2)) };
        }
        const glide = e.glide;
        const age = e.clock - glide.start;
        if (glide.distance < 0.01 || age >= glide.duration) {
          e.angle = e.target;
          e.vel = 0;
        } else {
          const d = glide.duration;
          const s = glide.distance;
          const b = (3 * s - 2 * glide.v0 * d) / (d * d);
          const c = (glide.v0 * d - 2 * s) / (d * d * d);
          e.angle = glide.from + glide.v0 * age + b * age * age + c * age * age * age;
          e.vel = glide.v0 + 2 * b * age + 3 * c * age * age;
        }
      } else {
        e.target = null;
        e.vel += (e.to.spin * rate - e.vel) * (1 - Math.exp(-(3 * dt)));
        e.angle += e.vel * dt;
        if (e.angle >= 360) e.angle -= 360;
      }
      paint();
      const parked = still || (e.to.rest && e.target !== null && e.angle === e.target);
      if (progress() >= 1 && e.impulses.length === 0 && parked && (still || !e.to.loops)) {
        if (!still && e.target !== null) {
          e.angle = e.target % 360;
          e.target = e.angle;
          e.vel = 0;
          paint();
        }
        e.raf = 0;
        e.last = 0;
        return;
      }
      e.raf = requestAnimationFrame(tick);
    };
    const halt = () => {
      if (e.raf) cancelAnimationFrame(e.raf);
      e.raf = 0;
      e.last = 0;
    };
    e.kick = () => {
      if (!e.inView || document.hidden || live.current.paused) halt();
      else if (!e.raf) {
        e.last = 0;
        e.raf = requestAnimationFrame(tick);
      }
    };
    const root = rootRef.current;
    const observer = typeof IntersectionObserver !== "undefined" && root
      ? new IntersectionObserver(([entry]) => {
          e.inView = entry.isIntersecting;
          e.kick();
        }, { rootMargin: "48px" })
      : null;
    if (observer && root) observer.observe(root);
    const onVisibility = () => e.kick();
    document.addEventListener("visibilitychange", onVisibility);
    e.kick();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      halt();
    };
  }, [firstStatus]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    if (e.status !== status || e.twinkle !== twinkle) {
      const amount = e.mixDur <= 0 ? 1 : Math.min(1, (e.clock - e.mixStart) / e.mixDur);
      e.from = amount < 1 ? blendPoses(e.from, e.to, easeInOut(amount)) : e.to;
      e.to = poseFor(status, twinkle);
      e.mixStart = e.clock;
      e.mixDur = reduced ? 0.2 : status === "generating" ? 0.42 : status === "done" ? 0.5 : 0.56;
      if (e.status !== status) {
        e.target = null;
        if (!reduced && status === "done") e.impulses.push({ kind: "gather", start: e.clock });
        if (!reduced && status === "error") e.impulses.push({ kind: "shake", start: e.clock });
      }
      e.status = status;
      e.twinkle = twinkle;
    }
    e.kick();
  }, [status, twinkle, reduced, paused, geo]);

  const busy = status === "thinking" || status === "generating";
  const text = label ?? LABELS[status];
  const spoken = ariaLabel ?? (pill ? undefined : SPOKEN[status]);
  const rootStyle = { "--spark-color": color ?? TONES[tone], ...(avatar ? { width: boxCss, height: boxCss } : null), ...style } as CSSProperties;

  return (
    <span
      ref={rootRef}
      className={[styles.root, pill ? styles.pill : "", avatar ? styles.avatar : "", className].filter(Boolean).join(" ")}
      data-status={status}
      style={rootStyle}
      role={announce ? "status" : "img"}
      aria-live={announce ? "polite" : undefined}
      aria-busy={busy || undefined}
      aria-label={announce ? undefined : spoken ?? text}
    >
      <svg ref={svgRef} className={styles.mark} viewBox="-50 -50 100 100" width={markCss} height={markCss} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
        <g ref={scaleRef}>
          <g ref={spinRef}>
            {Array.from({ length: 8 }, (_, index) => (
              <path key={index} ref={node => { rayRefs.current[index] = node; }} d={rayPath(geo, index, firstPose)} opacity={firstPose[4 * index + 3]} transform={`rotate(${45 * index})`} fill="currentColor" fillOpacity={index % 2 === 0 ? 1 : geo.toneB} />
            ))}
            <circle ref={coreRef} r={geo.core * firstPose[33]} fill="currentColor" fillOpacity={geo.toneB} />
          </g>
          {[1.9, 1.3].map((radius, index) => (
            <circle key={index} ref={node => { particleRefs.current[index] = node; }} r={radius} opacity={0} fill="currentColor" fillOpacity={index === 0 ? 0.8 : geo.toneB} />
          ))}
        </g>
      </svg>
      {pill ? <PillLabel text={text} busy={busy} reduced={reduced} /> : announce ? <span className={styles.srOnly}>{spoken}</span> : null}
    </span>
  );
}

function PillLabel({ text, busy, reduced }: { text: string; busy: boolean; reduced: boolean }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const from = box.style.width ? box.getBoundingClientRect().width : lastWidth.current;
    box.style.width = "";
    const to = box.getBoundingClientRect().width;
    lastWidth.current = to;
    if (reduced || !from || Math.abs(from - to) < 0.5) return;
    const controls = animate(box, { width: [from, to] }, {
      ...motionTokens.spring.morph,
      onComplete: () => {
        box.style.width = "";
      },
    });
    return () => controls.stop();
  }, [text, reduced]);
  return (
    <span ref={boxRef} className={styles.labelBox}>
      <span className={styles.sizer} aria-hidden="true">{text}</span>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className={styles.labelLayer}
          initial={{ opacity: 0, y: 2 * +!reduced }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? motionTokens.duration.instant : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant, ease: "easeOut" } }}
        >
          <TextShimmer active={busy}>{text}</TextShimmer>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
