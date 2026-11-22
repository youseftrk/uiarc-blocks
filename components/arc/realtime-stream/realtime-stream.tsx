"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./realtime-stream.module.css";

export interface RealtimeStreamPoint {
  /** Timestamp in milliseconds. */
  t: number;
  value: number;
  /** Marks the reading as an anomaly. A string is used as its label. */
  anomaly?: boolean | string;
}

export interface RealtimeStreamProps {
  points: RealtimeStreamPoint[];
  label: string;
  unit?: string;
  windowMs?: number;
  interval?: number;
  height?: number;
  formatValue?: (value: number) => string;
  formatTime?: (t: number) => string;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  pauseOnHover?: boolean;
  min?: number;
  max?: number;
  emptyLabel?: string;
  ref?: Ref<HTMLElement>;
  className?: string;
}

interface Hover { t: number; value: number; anomaly?: boolean | string; x: number; y: number }

const { spring } = motionTokens;
const FOLLOW = { stiffness: spring.responsive.stiffness, damping: spring.responsive.damping, restDelta: 0.01 };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const noop = () => () => {};

function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

function lowerBound(points: RealtimeStreamPoint[], t: number) {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (points[middle].t < t) low = middle + 1;
    else high = middle;
  }
  return low;
}

const pop = (time: number) => (time >= 0.5 ? 1 : 1 - Math.exp(-(12 * time)) * Math.cos(16 * time));

export function RealtimeStream({
  points,
  label,
  unit = "",
  windowMs = 3e4,
  interval = 1e3,
  height = 200,
  formatValue,
  formatTime = t => timeFormat.format(t),
  paused,
  defaultPaused = false,
  onPausedChange,
  pauseOnHover = true,
  min,
  max,
  emptyLabel = "Waiting for data",
  ref,
  className,
}: RealtimeStreamProps) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reduced = !!useReducedMotion() && hydrated;
  const figureRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inksRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => figureRef.current as HTMLElement);
  const inView = useInView(figureRef, { amount: 0 });
  const empty = points.length === 0;
  const latest = points[points.length - 1];
  const [innerPaused, setInnerPaused] = useState(defaultPaused);
  const isPaused = paused ?? innerPaused;
  const setPaused = (next: boolean) => {
    if (paused === undefined) setInnerPaused(next);
    if (next !== isPaused) onPausedChange?.(next);
  };
  const [hover, setHover] = useState<Hover | null>(null);
  const [resting, setResting] = useState(false);
  const frozen = isPaused || (pauseOnHover && resting) || hover !== null;
  const [missed, setMissed] = useState(0);
  const [lastT, setLastT] = useState(latest?.t);
  if (latest?.t !== lastT) {
    setLastT(latest?.t);
    if (frozen && lastT !== undefined) setMissed(count => count + 1);
  }
  const [wasFrozen, setWasFrozen] = useState(frozen);
  if (wasFrozen !== frozen) {
    setWasFrozen(frozen);
    if (!frozen) setMissed(0);
  }
  const [announcement, setAnnouncement] = useState("");
  const [lastAnomaly, setLastAnomaly] = useState<number | null>(null);
  if (latest?.anomaly && latest.t !== lastAnomaly) {
    setLastAnomaly(latest.t);
    setAnnouncement(`${typeof latest.anomaly === "string" ? latest.anomaly : "Anomaly"} at ${formatTime(latest.t)}, ${formatValue ? formatValue(latest.value) : numberFormat.format(latest.value)}${unit ? ` ${unit}` : ""}`);
  }

  const config = useRef({ points, windowMs, interval, height, frozen, reduced, hover, min, max });
  useLayoutEffect(() => {
    config.current = { points, windowMs, interval, height, frozen, reduced, hover, min, max };
  });
  const view = useRef({ t: 0, skew: 0, lo: 0, hi: 1, ready: false, arrivals: new Map<number, number>(), width: 0, lastLatest: -Infinity });
  const inks = useRef({ ink: "#111", accent: "#333", surface: "#fff", border: "#eee", muted: "#888", mark: "#e26a2b", font: "system-ui, sans-serif" });
  const readInks = useRef(() => {
    const holder = inksRef.current;
    if (!holder) return;
    const swatches = holder.children;
    const colour = (index: number) => getComputedStyle(swatches[index]).color;
    inks.current = { ink: colour(0), accent: colour(1), surface: colour(2), border: colour(3), muted: colour(4), mark: colour(5), font: getComputedStyle(holder).fontFamily || "system-ui, sans-serif" };
  });

  useEffect(() => {
    const read = () => readInks.current();
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class", "style"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", read);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const plot = plotRef.current;
    if (!canvas || !plot) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let before = performance.now();
    let ticks = 0;
    const draw = (now: number) => {
      if (ticks++ % 30 === 0) readInks.current();
      const dt = Math.min(0.1, (now - before) / 1000);
      before = now;
      const c = config.current;
      const v = view.current;
      const ink = inks.current;
      const w = plot.clientWidth;
      const h = c.height;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
      }
      v.width = w;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, w, h);
      const data = c.points;
      if (!data.length || w <= 44) return;
      const last = data[data.length - 1];
      if (last.t !== v.lastLatest) {
        v.lastLatest = last.t;
        v.arrivals.set(last.t, now);
        for (const key of v.arrivals.keys()) if (key < last.t - 2 * c.windowMs) v.arrivals.delete(key);
        v.skew = v.ready ? v.skew + (last.t - Date.now() - v.skew) * 0.25 : last.t - Date.now();
      }
      const goal = c.reduced ? last.t : Math.min(Date.now() + v.skew - c.interval, last.t);
      if (!v.ready) {
        v.t = goal;
        v.ready = true;
      }
      if (!c.frozen) v.t = c.reduced || Math.abs(goal - v.t) < 4 ? goal : v.t + (goal - v.t) * (1 - Math.exp(-(7 * dt)));
      const right = v.t;
      const left = right - c.windowMs;
      const plotW = w - 44;
      const plotH = h - 14 - 22;
      const xOf = (t: number) => ((t - left) / c.windowMs) * plotW;
      const from = Math.max(0, lowerBound(data, left) - 1);
      const to = Math.min(data.length, lowerBound(data, right) + 1);
      const inWindow = data.slice(from, to);
      const next = lowerBound(data, right);
      const previous = next - 1;
      let head: RealtimeStreamPoint;
      if (previous < 0) head = data[0];
      else if (next >= data.length) head = data[data.length - 1];
      else {
        const a = data[previous];
        const b = data[next];
        const part = (right - a.t) / Math.max(1, b.t - a.t);
        head = { t: right, value: a.value + (b.value - a.value) * clamp(part, 0, 1) };
      }
      const drawn = inWindow.filter(point => point.t <= right);
      drawn.push(head);
      let low = c.min ?? Infinity;
      let high = c.max ?? -Infinity;
      if (c.min === undefined || c.max === undefined)
        for (const point of drawn) {
          if (c.min === undefined) low = Math.min(low, point.value);
          if (c.max === undefined) high = Math.max(high, point.value);
        }
      if (!(Number.isFinite(low) && Number.isFinite(high))) {
        low = 0;
        high = 1;
      }
      const span = Math.max(high - low, 0.1 * Math.abs(high), 1e-6);
      const targetLow = c.min ?? low - 0.18 * span;
      const targetHigh = c.max ?? high + 0.18 * span;
      if (c.reduced || v.hi - v.lo <= 0) {
        v.lo = targetLow;
        v.hi = targetHigh;
      } else {
        const ease = 1 - Math.exp(-(4 * dt));
        v.lo += (targetLow - v.lo) * ease;
        v.hi += (targetHigh - v.hi) * ease;
      }
      const yOf = (value: number) => 14 + (1 - (value - v.lo) / (v.hi - v.lo)) * plotH;
      const step = niceStep(v.hi - v.lo, Math.max(2, Math.floor(plotH / 44)));
      context.font = `12px ${ink.font}`;
      context.textBaseline = "middle";
      context.textAlign = "left";
      for (let value = Math.ceil(v.lo / step) * step; value <= v.hi; value += step) {
        const y = Math.round(yOf(value)) + 0.5;
        if (y < 12 || y > h - 22 + 2) continue;
        context.strokeStyle = ink.border;
        context.lineWidth = 1;
        context.globalAlpha = 1;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(plotW, y);
        context.stroke();
        context.fillStyle = ink.muted;
        context.fillText(numberFormat.format(Math.round(100 * value) / 100), plotW + 8, y);
      }
      context.textBaseline = "alphabetic";
      const timeStep = 1000 * niceStep(c.windowMs / 1000, Math.max(2, Math.floor(plotW / 90)));
      for (let ago = 0; ago <= c.windowMs; ago += timeStep) {
        const x = plotW - (ago / c.windowMs) * plotW;
        context.textAlign = ago === 0 ? "right" : x < 20 ? "left" : "center";
        context.fillStyle = ink.muted;
        context.fillText(ago === 0 ? "now" : `−${Math.round(ago / 1000)}s`, x, h - 6);
      }
      context.save();
      context.beginPath();
      context.rect(0, 0, plotW, h);
      context.clip();
      const xy = drawn.map(point => [xOf(point.t), yOf(point.value)]);
      const slopes = xy.map((_, index) => {
        if (xy.length < 2) return 0;
        const before = index > 0 ? (xy[index][1] - xy[index - 1][1]) / Math.max(1e-6, xy[index][0] - xy[index - 1][0]) : null;
        const after = index < xy.length - 1 ? (xy[index + 1][1] - xy[index][1]) / Math.max(1e-6, xy[index + 1][0] - xy[index][0]) : null;
        return before === null ? after ?? 0 : after === null ? before : before * after <= 0 ? 0 : (2 * before * after) / (before + after);
      });
      const trace = () => {
        context.moveTo(xy[0][0], xy[0][1]);
        for (let index = 0; index < xy.length - 1; index++) {
          const third = (xy[index + 1][0] - xy[index][0]) / 3;
          context.bezierCurveTo(xy[index][0] + third, xy[index][1] + slopes[index] * third, xy[index + 1][0] - third, xy[index + 1][1] - slopes[index + 1] * third, xy[index + 1][0], xy[index + 1][1]);
        }
      };
      if (xy.length > 1) {
        context.beginPath();
        trace();
        context.lineTo(xy[xy.length - 1][0], h - 22);
        context.lineTo(xy[0][0], h - 22);
        context.closePath();
        context.fillStyle = ink.accent;
        context.globalAlpha = 0.08;
        context.fill();
        context.beginPath();
        trace();
        context.globalAlpha = 1;
        context.strokeStyle = ink.accent;
        context.lineWidth = 2;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.stroke();
      }
      let taken = -Infinity;
      for (const point of inWindow) {
        if (!point.anomaly || point.t > right) continue;
        const x = xOf(point.t);
        const y = yOf(point.value);
        const arrived = v.arrivals.get(point.t);
        const age = c.reduced || arrived === undefined ? 1 : (now - arrived) / 1000 - c.interval / 1000;
        if (age < 0) continue;
        const scale = c.reduced ? 1 : pop(age);
        context.globalAlpha = 0.45 * clamp(4 * age, 0, 1);
        context.strokeStyle = ink.mark;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, 24);
        context.lineTo(Math.round(x) + 0.5, y - 6);
        context.stroke();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(x, y, 6 * scale, 0, 2 * Math.PI);
        context.fillStyle = ink.surface;
        context.fill();
        context.beginPath();
        context.arc(x, y, 4 * scale, 0, 2 * Math.PI);
        context.fillStyle = ink.mark;
        context.fill();
        const text = typeof point.anomaly === "string" ? point.anomaly : "Anomaly";
        context.font = `500 12px ${ink.font}`;
        const pill = context.measureText(text).width + 14;
        const pillX = clamp(x - pill / 2, 0, plotW - pill);
        if (pillX < taken + 4) continue;
        taken = pillX + pill;
        context.save();
        context.translate(pillX + pill / 2, 15);
        context.scale(scale, scale);
        context.translate(-(pillX + pill / 2), -15);
        context.beginPath();
        context.roundRect(pillX, 6, pill, 18, 9);
        context.fillStyle = ink.surface;
        context.fill();
        context.strokeStyle = ink.border;
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = ink.ink;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, pillX + pill / 2, 15.5);
        context.restore();
      }
      const pointed = c.hover;
      if (pointed) {
        const x = Math.round(xOf(pointed.t)) + 0.5;
        const y = yOf(pointed.value);
        context.globalAlpha = 0.5;
        context.strokeStyle = ink.ink;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, 14);
        context.lineTo(x, h - 22);
        context.stroke();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(x, y, 6, 0, 2 * Math.PI);
        context.fillStyle = ink.surface;
        context.fill();
        context.beginPath();
        context.arc(x, y, 4, 0, 2 * Math.PI);
        context.fillStyle = ink.accent;
        context.fill();
      }
      const [headX, headY] = xy[xy.length - 1];
      context.globalAlpha = 1;
      context.beginPath();
      context.arc(headX, headY, 6, 0, 2 * Math.PI);
      context.fillStyle = ink.surface;
      context.fill();
      context.beginPath();
      context.arc(headX, headY, 4, 0, 2 * Math.PI);
      context.fillStyle = ink.accent;
      context.fill();
      context.restore();
    };
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!document.hidden) draw(now);
    };
    if (config.current.reduced) return void draw(performance.now());
    if (!inView) return;
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, points, hover, height, windowMs]);

  const status = frozen ? (missed > 0 ? `Paused, ${missed} new` : "Paused") : "Live";
  const statusRef = useRef<HTMLSpanElement>(null);
  const statusWidth = useMotionValue<number | string>("auto");
  useLayoutEffect(() => {
    const node = statusRef.current;
    if (!node) return;
    const width = node.offsetWidth;
    if (reduced || statusWidth.get() === "auto") return void statusWidth.jump(width);
    const controls = animate(statusWidth, width, spring.morph);
    return () => controls.stop();
  }, [status, reduced, statusWidth]);

  const [lastHover, setLastHover] = useState(hover);
  if (hover && hover !== lastHover) setLastHover(hover);
  const shownHover = hover ?? lastHover;
  const reading = useMotionValue(latest?.value ?? 0);
  const readingText = useTransform(reading, value => (formatValue ? formatValue(value) : numberFormat.format(Math.round(value))));
  useEffect(() => {
    if (!latest) return;
    if (reduced) return void reading.jump(latest.value);
    const controls = animate(reading, latest.value, spring.smooth);
    return () => controls.stop();
  }, [latest, reduced, reading]);

  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipSpringX = useSpring(tipX, FOLLOW);
  const tipSpringY = useSpring(tipY, FOLLOW);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const plot = plotRef.current;
    if (!hover || !tooltip || !plot) {
      placed.current = false;
      return;
    }
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const plotW = plot.clientWidth - 44;
    let x = hover.x + 14;
    if (x + tw > plotW) x = hover.x - 14 - tw;
    const y = clamp(hover.y - th - 12 < 0 ? hover.y + 14 : hover.y - th - 12, 0, Math.max(0, height - th));
    tipX.set(clamp(x, 0, Math.max(0, plotW - tw)));
    tipY.set(y);
    if (!placed.current || reduced) {
      tipSpringX.jump(tipX.get());
      tipSpringY.jump(y);
    }
    placed.current = true;
  });

  const geometry = () => {
    const v = view.current;
    const c = config.current;
    const plotW = v.width - 44;
    const plotH = c.height - 14 - 22;
    const left = v.t - c.windowMs;
    return { xOf: (t: number) => ((t - left) / c.windowMs) * plotW, yOf: (value: number) => 14 + (1 - (value - v.lo) / (v.hi - v.lo)) * plotH, left, right: v.t, plotW };
  };
  const hoverAt = (index: number): Hover | null => {
    const point = points[index];
    if (!point) return null;
    const g = geometry();
    return { t: point.t, value: point.value, anomaly: point.anomaly, x: g.xOf(point.t), y: g.yOf(point.value) };
  };
  const nearest = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || empty) return null;
    const g = geometry();
    const t = g.left + clamp((clientX - rect.left) / Math.max(1, g.plotW), 0, 1) * (g.right - g.left);
    const index = lowerBound(points, t);
    const candidates = [index - 1, index].filter(item => item >= 0 && item < points.length && points[item].t <= g.right);
    return candidates.length ? candidates.reduce((best, item) => (Math.abs(points[item].t - t) < Math.abs(points[best].t - t) ? item : best)) : null;
  };
  const hoverIndex = hover ? lowerBound(points, hover.t) : null;
  const text = (value: number) => `${formatValue ? formatValue(value) : numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;
  const recent = points.slice(-20);

  return (
    <figure ref={figureRef} className={[styles.figure, className].filter(Boolean).join(" ")} aria-label={label}>
      <div className={styles.head}>
        <p className={styles.now} aria-label={latest ? `${label}, ${text(latest.value)}` : `${label}, ${emptyLabel}`}>
          <motion.span className={styles.value} aria-hidden="true">{latest ? readingText : "0"}</motion.span>
          {unit && <span className={styles.unit} aria-hidden="true">{unit}</span>}
        </p>
        <button type="button" className={styles.status} data-held={frozen || undefined} aria-pressed={isPaused} onClick={() => setPaused(!isPaused)}>
          <span className={styles.statusDot} aria-hidden="true" />
          <motion.span className={styles.statusText} style={{ width: statusWidth }}>
            <span ref={statusRef} className={styles.statusLabel}>{status}</span>
          </motion.span>
          <span className={styles.srOnly}>{isPaused ? ", resume" : ", pause"}</span>
        </button>
      </div>
      <div
        ref={plotRef}
        className={styles.plot}
        style={{ height }}
        data-active={!!hover || undefined}
        role="group"
        tabIndex={empty ? -1 : 0}
        aria-roledescription="live chart"
        aria-label={`${label}, last ${Math.round(windowMs / 1000)} seconds. Focus holds the view. Use left and right arrows to read points, Space to pause or resume.`}
        onPointerEnter={event => {
          if (event.pointerType === "mouse") setResting(true);
        }}
        onPointerLeave={event => {
          if (event.pointerType === "mouse") {
            setResting(false);
            setHover(null);
          }
        }}
        onPointerMove={event => {
          if (event.pointerType !== "mouse" && !event.buttons) return;
          const index = nearest(event.clientX);
          setHover(index === null ? null : hoverAt(index));
        }}
        onPointerDown={event => {
          if (event.pointerType !== "mouse") {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            const index = nearest(event.clientX);
            setHover(index === null ? null : hoverAt(index));
          }
        }}
        onPointerUp={event => {
          if (event.pointerType !== "mouse") setHover(null);
        }}
        onPointerCancel={() => setHover(null)}
        onKeyDown={event => {
          if (empty) return;
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            setPaused(!isPaused);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setHover(null);
            if (isPaused) setPaused(false);
            return;
          }
          const g = geometry();
          const first = lowerBound(points, g.left);
          const last = lowerBound(points, g.right + 0.001) - 1;
          const current = hoverIndex ?? last + 1;
          const moves: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: first, End: last, PageUp: current - 10, PageDown: current + 10 };
          if (event.key in moves) {
            event.preventDefault();
            setHover(hoverAt(clamp(moves[event.key], first, last)));
          }
        }}
        onBlur={() => setHover(null)}
        onFocus={event => {
          if (event.currentTarget.matches(":focus-visible") && !empty) setHover(hoverAt(Math.max(0, lowerBound(points, geometry().right + 0.001) - 1)));
        }}
      >
        <canvas ref={canvasRef} className={styles.canvas} style={{ height }} aria-hidden="true" />
        <span ref={inksRef} className={styles.probe} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <motion.div ref={tooltipRef} className={styles.tooltip} style={{ x: reduced ? tipX : tipSpringX, y: reduced ? tipY : tipSpringY }} aria-hidden="true">
          <p className={styles.tipValue}>{shownHover ? text(shownHover.value) : ""}</p>
          <p className={styles.tipMeta}>{shownHover ? `${formatTime(shownHover.t)}${shownHover.anomaly ? `, ${typeof shownHover.anomaly === "string" ? shownHover.anomaly.toLowerCase() : "anomaly"}` : ""}` : ""}</p>
        </motion.div>
        {empty && <p className={styles.message}>{emptyLabel}</p>}
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {hover ? `${formatTime(hover.t)}, ${text(hover.value)}${hover.anomaly ? `, ${typeof hover.anomaly === "string" ? hover.anomaly : "anomaly"}` : ""}` : ""}
      </p>
      {!empty && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}, latest {recent.length} readings</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Value</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(point => (
                <tr key={point.t}>
                  <th scope="row">{formatTime(point.t)}</th>
                  <td>{text(point.value)}</td>
                  <td>{point.anomaly ? (typeof point.anomaly === "string" ? point.anomaly : "Anomaly") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
