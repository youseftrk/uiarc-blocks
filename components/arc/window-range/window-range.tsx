"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./window-range.module.css";

export interface WindowRangeTick {
  value: number;
  label: string;
}

export interface WindowRangeProps {
  data: readonly number[];
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  onValueCommit?: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minSpan?: number;
  maxSpan?: number;
  format?: (value: number) => string;
  formatSpan?: ((span: number) => string) | null;
  ticks?: readonly WindowRangeTick[];
  label?: string;
  live?: boolean;
  accent?: string;
  height?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

type Mode = "idle" | "pan" | "start" | "end";
// The root also reports "coast" while a flicked window is still decelerating.

interface Body {
  x: number;
  v: number;
}

interface Engine {
  a: Body;
  b: Body;
  target: [number, number];
  k: number;
  c: number;
  mode: Mode;
  follow: boolean;
  coasting: boolean;
  moving: boolean;
  grab: number;
  rect: { left: number; usable: number };
  samples: { t: number; x: number }[];
  press: Body;
  pressTarget: number;
  grip: [Body, Body];
  gripTarget: [number, number];
  usable: number;
  frame: number;
  last: number;
  visible: boolean;
}

const HANDLE = 12;
const SUBSTEP = 1 / 240;
const GLIDE = { k: 400, c: 40 };
const SETTLE = { k: 784, c: 56 };
const COAST_TIME = 0.2;
const HEADROOM = 1.12;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const fixed = (value: number, digits = 2) => String(Number(value.toFixed(digits)));
const defaultFormat = (value: number) => String(value);

function advance(body: Body, target: number, k: number, c: number, dt: number) {
  body.v += (-k * (body.x - target) - c * body.v) * dt;
  body.x += body.v * dt;
}

function rest(body: Body, target: number, epsilon: number) {
  if (Math.abs(body.x - target) < epsilon && Math.abs(body.v) < epsilon * 20) {
    body.x = target;
    body.v = 0;
    return true;
  }
  return false;
}

/** Past a limit the frame keeps moving, but less and less. */
function band(raw: number, low: number, high: number, give: number) {
  if (raw < low) return low - (1 - 1 / (((low - raw) * 0.55) / give + 1)) * give;
  if (raw > high) return high + (1 - 1 / (((raw - high) * 0.55) / give + 1)) * give;
  return raw;
}

function write(node: HTMLElement | null | undefined, property: "transform" | "opacity", value: string) {
  if (node && node.style[property] !== value) node.style[property] = value;
}

/** One monotone cubic through evenly spaced points in a 1000 by 100 box. */
function toPath(ys: readonly number[]) {
  const count = ys.length;
  if (count === 0) return { line: "", area: "" };
  if (count === 1) return { line: `M0.00,${ys[0].toFixed(2)}L1000.00,${ys[0].toFixed(2)}`, area: `M0.00,${ys[0].toFixed(2)}L1000.00,${ys[0].toFixed(2)}L1000,100L0,100Z` };
  const gap = 1000 / (count - 1);
  const slope = (index: number) => (ys[index + 1] - ys[index]) / gap;
  const tangent = ys.map((_, index) => {
    if (index === 0) return slope(0);
    if (index === count - 1) return slope(count - 2);
    const before = slope(index - 1);
    const after = slope(index);
    return (Math.sign(before) + Math.sign(after)) * Math.min(Math.abs(before), Math.abs(after), 0.25 * Math.abs(before + after)) || 0;
  });
  let line = `M0.00,${ys[0].toFixed(2)}`;
  for (let index = 1; index < count; index += 1) {
    const from = (index - 1) * gap;
    const to = index === count - 1 ? 1000 : index * gap;
    line += `C${(from + gap / 3).toFixed(2)},${(ys[index - 1] + (gap / 3) * tangent[index - 1]).toFixed(2)} ${(to - gap / 3).toFixed(2)},${(ys[index] - (gap / 3) * tangent[index]).toFixed(2)} ${to.toFixed(2)},${ys[index].toFixed(2)}`;
  }
  return { line, area: `${line}L1000,100L0,100Z` };
}

function toHeights(data: readonly number[]) {
  let top = 0;
  for (const point of data) if (point > top) top = point;
  const ceiling = top > 0 ? top * HEADROOM : 1;
  return data.map((point) => 100 - (point / ceiling) * 100);
}

const STILL = { duration: 0 } as const;
const ROLL = { type: "spring", visualDuration: 0.3, bounce: 0 } as const;

function Roll({ text, order, instant, className }: { text: string; order: number; instant: boolean; className: string }) {
  const [seen, setSeen] = useState({ order, direction: 1 });
  let direction = seen.direction;
  if (order !== seen.order) {
    direction = order > seen.order ? 1 : -1;
    setSeen({ order, direction });
  }
  const slots = text.replace(/ /g, "\u00a0").match(/\d|[^\d]+/g) ?? [];
  return (
    <span className={`${styles.roll} ${className}`}>
      {slots.map((slot, index) => (
        <span key={index} className={styles.slot}>
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.span
              key={slot}
              className={styles.char}
              custom={direction}
              variants={{
                enter: (way: number) => ({ opacity: 0, y: `${way * 100}%` }),
                show: { opacity: 1, y: "0%" },
                leave: (way: number) => ({ opacity: 0, y: `${way * -100}%` }),
              }}
              initial="enter"
              animate="show"
              exit="leave"
              transition={instant ? STILL : ROLL}
            >
              {slot}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function createEngine(start: number, end: number): Engine {
  return {
    a: { x: start, v: 0 }, b: { x: end, v: 0 }, target: [start, end], k: GLIDE.k, c: GLIDE.c, mode: "idle", follow: false, coasting: false, moving: false, grab: 0,
    rect: { left: 0, usable: 0 }, samples: [], press: { x: 0, v: 0 }, pressTarget: 0, grip: [{ x: 1, v: 0 }, { x: 1, v: 0 }], gripTarget: [1, 1],
    usable: 0, frame: 0, last: 0, visible: true,
  };
}

export function WindowRange({
  data, value: valueProp, defaultValue, onValueChange, onValueCommit, min = 0, max: maxProp, step = 1, largeStep, minSpan: minSpanProp, maxSpan: maxSpanProp,
  format = defaultFormat, formatSpan, ticks, label = "Date range", live = false, accent, height = 112, disabled = false, className, style,
}: WindowRangeProps) {
  const reduced = useReducedMotion();
  const max = maxProp ?? Math.max(min + step, data.length - 1);
  const span = Math.max(max - min, Number.EPSILON);
  const minSpan = clamp(minSpanProp ?? step, 0, span);
  const maxSpan = clamp(maxSpanProp ?? span, minSpan, span);
  const snap = useCallback((raw: number) => clamp(Number((min + Math.round((raw - min) / step) * step).toFixed(10)), min, max), [max, min, step]);
  const [inner, setInner] = useState<[number, number]>(() => defaultValue ?? [snap(max - span / 4), max]);
  const value = valueProp ?? inner;
  const [start, end] = value;
  const [mode, setMode] = useState<Mode>("idle");
  const [coasting, setCoasting] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine>(null as unknown as Engine);
  if (engineRef.current === null) engineRef.current = createEngine(start, end);
  const liveRef = useRef({ value, reduced, disabled, min, max, span, minSpan, maxSpan, snap });
  const callbacks = useRef({ onValueChange, onValueCommit });
  const tickRef = useRef<() => void>(() => {});
  const controlled = valueProp !== undefined;

  useEffect(() => {
    callbacks.current = { onValueChange, onValueCommit };
    liveRef.current = { value, reduced, disabled, min, max, span, minSpan, maxSpan, snap };
  });

  const wake = useCallback(() => {
    const engine = engineRef.current;
    if (engine.frame || !engine.visible) return;
    engine.last = performance.now();
    engine.frame = requestAnimationFrame(() => tickRef.current());
  }, []);

  const emit = useCallback((next: [number, number]) => {
    const current = liveRef.current.value;
    if (next[0] === current[0] && next[1] === current[1]) return;
    liveRef.current.value = next;
    if (!controlled) setInner(next);
    callbacks.current.onValueChange?.(next);
  }, [controlled]);

  // One loop steps the frame's springs and writes transforms straight to the DOM. It stops at rest, offscreen and in background tabs.
  useEffect(() => {
    const root = rootRef.current;
    const plot = plotRef.current;
    if (!root || !plot) return;
    const part = (name: string) => root.querySelector<HTMLElement>(`.${name}`);
    const clip = part(styles.clip);
    const clipInner = part(styles.clipInner);
    const bandNode = part(styles.band);
    const tint = part(styles.tint);
    const body = part(styles.body);
    const dot = part(styles.dot);
    const edges = Array.from(root.querySelectorAll<HTMLElement>(`.${styles.edge}`));

    const render = () => {
      const engine = engineRef.current;
      const { min: low, span: range } = liveRef.current;
      const usable = engine.usable;
      const startX = ((engine.a.x - low) / range) * usable;
      const endX = Math.max(startX + HANDLE, HANDLE + ((engine.b.x - low) / range) * usable);
      const frame = `translate3d(${fixed(startX + HANDLE)}px, 0px, 0px) scaleX(${fixed((endX - startX - HANDLE) / 100, 5)})`;
      write(edges[0], "transform", `translate3d(${fixed(startX)}px, 0px, 0px)`);
      write(edges[1], "transform", `translate3d(${fixed(endX)}px, 0px, 0px)`);
      write(bandNode, "transform", frame);
      write(body, "transform", frame);
      const share = Math.max(0.0001, (endX - startX - HANDLE) / Math.max(usable, 1));
      write(clip, "transform", `translate3d(${fixed(startX)}px, 0px, 0px) scaleX(${fixed(share, 6)})`);
      write(clipInner, "transform", `scaleX(${fixed(1 / share, 5)}) translate3d(${fixed(-startX)}px, 0px, 0px)`);
      write(tint, "opacity", fixed(engine.press.x, 3));
      edges.forEach((edge, index) => write(edge.firstElementChild as HTMLElement | null, "transform", `scaleY(${fixed(engine.grip[index].x, 3)})`));
      if (dot) {
        const y = Number(dot.dataset.y ?? 0);
        write(dot, "transform", `translate3d(${fixed(HANDLE + usable)}px, ${fixed(10 + (y / 100) * (plot.clientHeight - 12))}px, 0px)`);
      }
    };

    const stepAll = (dt: number) => {
      const engine = engineRef.current;
      const state = liveRef.current;
      let moving = false;
      const epsilon = state.span / Math.max(engine.usable, 1) / 50;
      if (engine.mode === "idle" || engine.follow) {
        if (state.reduced) {
          engine.a.x = engine.target[0];
          engine.b.x = engine.target[1];
          engine.a.v = engine.b.v = 0;
        } else {
          advance(engine.a, engine.target[0], engine.k, engine.c, dt);
          advance(engine.b, engine.target[1], engine.k, engine.c, dt);
          const done = [rest(engine.a, engine.target[0], epsilon), rest(engine.b, engine.target[1], epsilon)];
          if (!done[0] || !done[1]) moving = true;
        }
      }
      engine.moving = moving;
      for (const [bodyPart, target] of [[engine.press, engine.pressTarget], [engine.grip[0], engine.gripTarget[0]], [engine.grip[1], engine.gripTarget[1]]] as const) {
        if (state.reduced) bodyPart.x = target;
        else {
          advance(bodyPart, target, 625, 37.5, dt);
          if (!rest(bodyPart, target, 0.002)) moving = true;
        }
      }
      return moving;
    };

    const tick = () => {
      const engine = engineRef.current;
      engine.frame = 0;
      const now = performance.now();
      let elapsed = Math.min(0.064, (now - engine.last) / 1000);
      engine.last = now;
      let moving = stepAll(0);
      while (elapsed > 0 && moving) {
        moving = stepAll(Math.min(SUBSTEP, elapsed));
        elapsed -= SUBSTEP;
      }
      render();
      if (engine.coasting && engine.mode === "idle") {
        const state = liveRef.current;
        if (engine.moving) {
          const width = state.value[1] - state.value[0];
          const from = clamp(state.snap(engine.a.x), state.min, state.max - width);
          emit([from, from + width]);
        } else {
          engine.coasting = false;
          setCoasting(false);
          emit([engine.target[0], engine.target[1]]);
          callbacks.current.onValueCommit?.(liveRef.current.value);
        }
      }
      if (moving && engine.visible && !document.hidden) engine.frame = requestAnimationFrame(tick);
    };
    tickRef.current = tick;

    const measure = () => {
      engineRef.current.usable = Math.max(0, plot.clientWidth - HANDLE * 2);
      render();
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(plot);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      engineRef.current.visible = entry.isIntersecting;
      if (entry.isIntersecting) wake();
    });
    observer?.observe(root);
    const onVisibility = () => { if (!document.hidden) wake(); };
    document.addEventListener("visibilitychange", onVisibility);
    wake();
    return () => {
      resize.disconnect();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(engineRef.current.frame);
      engineRef.current.frame = 0;
    };
  }, [emit, wake]);

  // A value from props, a key or a preset glides the frame there. A dragged or coasting frame already leads the value.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine.mode !== "idle" || engine.coasting) return;
    if (engine.target[0] !== start || engine.target[1] !== end) {
      engine.target = [start, end];
      engine.k = GLIDE.k;
      engine.c = GLIDE.c;
    }
    wake();
  }, [end, start, wake]);

  // The chart path is written only when data changes, and morphs from the shape on screen.
  const heights = useMemo(() => toHeights(data), [data]);
  const shown = useRef<number[] | null>(null);
  const [initial] = useState(() => toPath(heights));
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const lines = Array.from(root.querySelectorAll<SVGPathElement>(`.${styles.line}`));
    const areas = Array.from(root.querySelectorAll<SVGPathElement>(`.${styles.area}`));
    const dot = root.querySelector<HTMLElement>(`.${styles.dot}`);
    const draw = (ys: number[]) => {
      shown.current = ys;
      const path = toPath(ys);
      lines.forEach((node) => node.setAttribute("d", path.line));
      areas.forEach((node) => node.setAttribute("d", path.area));
      if (dot) {
        dot.dataset.y = String(ys[ys.length - 1] ?? 0);
        wake();
        tickRef.current();
      }
    };
    const from = shown.current;
    if (!from || from.length !== heights.length || reduced) {
      draw(heights.slice());
      return;
    }
    const controls = animate(0, 1, {
      type: "spring",
      visualDuration: 0.3,
      bounce: 0,
      onUpdate: (mix) => draw(heights.map((to, index) => from[index] + (to - from[index]) * mix)),
    });
    return () => controls.stop();
  }, [heights, reduced, wake]);

  const setModeBoth = (next: Mode) => {
    engineRef.current.mode = next;
    setMode(next);
  };

  const limitsFor = (which: Mode, current: [number, number]): [number, number] => {
    if (which === "start") return [Math.max(min, current[1] - maxSpan), current[1] - minSpan];
    if (which === "end") return [current[0] + minSpan, Math.min(max, current[0] + maxSpan)];
    return [min, max - (current[1] - current[0])];
  };

  const drag = (clientX: number) => {
    const engine = engineRef.current;
    const current = liveRef.current.value;
    const usable = Math.max(engine.rect.usable, 1);
    const raw = min + ((clientX - engine.rect.left - HANDLE) / usable) * span - engine.grab;
    const [low, high] = limitsFor(engine.mode, current);
    const give = ((engine.mode === "pan" ? 18 : 10) / usable) * span;
    const shownAt = reduced ? clamp(raw, low, high) : band(raw, low, high, give);
    const snapped = clamp(snap(clamp(raw, low, high)), low, high);
    const now = performance.now();
    engine.samples.push({ t: now, x: raw });
    while (engine.samples.length > 2 && now - engine.samples[0].t > 90) engine.samples.shift();
    if (engine.mode === "start") {
      if (engine.follow) engine.target[0] = shownAt; else engine.a.x = shownAt;
      emit([snapped, current[1]]);
    } else if (engine.mode === "end") {
      if (engine.follow) engine.target[1] = shownAt; else engine.b.x = shownAt;
      emit([current[0], snapped]);
    } else {
      const width = current[1] - current[0];
      if (engine.follow) engine.target = [shownAt, shownAt + width];
      else {
        engine.a.x = shownAt;
        engine.b.x = shownAt + width;
      }
      emit([snapped, snapped + width]);
    }
    wake();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const plot = plotRef.current;
    if (!plot) return;
    const engine = engineRef.current;
    const bounds = plot.getBoundingClientRect();
    engine.rect = { left: bounds.left, usable: bounds.width - HANDLE * 2 };
    const hit = (event.target as HTMLElement).closest<HTMLElement>("[data-part]");
    const name = (hit?.dataset.part ?? "outside") as "start" | "end" | "pan" | "outside";
    const pointer = min + ((event.clientX - bounds.left - HANDLE) / Math.max(engine.rect.usable, 1)) * span;
    event.preventDefault();
    plot.setPointerCapture(event.pointerId);
    // Grabbing mid coast stops the window where it is.
    engine.coasting = false;
    setCoasting(false);
    engine.a.v = engine.b.v = 0;
    engine.samples = [];
    engine.follow = false;
    if (name === "start" || name === "end") {
      engine.grab = pointer - (name === "start" ? engine.a.x : engine.b.x);
      engine.gripTarget[name === "start" ? 0 : 1] = 1.4;
      setModeBoth(name);
    } else {
      const width = liveRef.current.value[1] - liveRef.current.value[0];
      if (name === "outside") {
        // A press outside glides the window to center on the finger; dragging on moves it from there.
        engine.grab = width / 2;
        engine.follow = !reduced;
        engine.k = SETTLE.k;
        engine.c = SETTLE.c;
        engine.target = [engine.a.x, engine.b.x];
      } else engine.grab = pointer - engine.a.x;
      engine.pressTarget = 0.06;
      engine.gripTarget = [1.12, 1.12];
      setModeBoth("pan");
    }
    const focusPart = name === "outside" ? "pan" : name;
    plot.querySelector<HTMLElement>(`[data-part="${focusPart}"]`)?.focus({ preventScroll: true });
    if (name === "outside") drag(event.clientX);
    wake();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (engineRef.current.mode === "idle") return;
    const native = event.nativeEvent;
    const batch = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    drag((batch[batch.length - 1] ?? native).clientX);
  };

  const release = () => {
    const engine = engineRef.current;
    const was = engine.mode;
    if (was === "idle") return;
    const current = liveRef.current.value;
    engine.gripTarget = [1, 1];
    engine.pressTarget = 0;
    engine.follow = false;
    setModeBoth("idle");
    engine.target = [current[0], current[1]];
    engine.k = SETTLE.k;
    engine.c = SETTLE.c;
    const samples = engine.samples;
    let speed = 0;
    if (was === "pan" && samples.length > 1 && !reduced) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (performance.now() - last.t < 60 && last.t > first.t) speed = ((last.x - first.x) / (last.t - first.t)) * 1000;
    }
    const pxSpeed = (Math.abs(speed) / span) * Math.max(engine.usable, 1);
    if (pxSpeed > 60) {
      // The landing point is projected from the flick and reached on a critically damped spring that starts at the flick's speed.
      const width = current[1] - current[0];
      const landing = clamp(snap(engine.a.x + speed * COAST_TIME), min, max - width);
      engine.target = [landing, landing + width];
      engine.k = GLIDE.k;
      engine.c = GLIDE.c;
      engine.a.v = engine.b.v = speed;
      engine.coasting = true;
      setCoasting(true);
    } else callbacks.current.onValueCommit?.(current);
    wake();
  };

  const onKeyDown = (which: "start" | "pan" | "end", event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const engine = engineRef.current;
    const current = liveRef.current.value;
    const big = Math.max(step, Math.round((largeStep ?? span / 10) / step) * step);
    const amount = event.shiftKey ? big : step;
    const [low, high] = limitsFor(which, current);
    const now = which === "end" ? current[1] : current[0];
    let next = now;
    let way = 0;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") { next = now + amount; way = 1; }
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") { next = now - amount; way = -1; }
    else if (event.key === "PageUp") { next = now + big; way = 1; }
    else if (event.key === "PageDown") { next = now - big; way = -1; }
    else if (event.key === "Home") { next = low; way = -1; }
    else if (event.key === "End") { next = high; way = 1; }
    else return;
    event.preventDefault();
    next = clamp(snap(next), low, high);
    if (next === now) {
      // Pressing into a limit nudges the frame against it.
      if (!reduced) {
        const kick = way * span * 0.35;
        if (which !== "end") engine.a.v = kick;
        if (which !== "start") engine.b.v = kick;
        engine.k = SETTLE.k;
        engine.c = SETTLE.c;
        wake();
      }
      return;
    }
    engine.coasting = false;
    const width = current[1] - current[0];
    const result: [number, number] = which === "start" ? [next, current[1]] : which === "end" ? [current[0], next] : [next, next + width];
    emit(result);
    engine.target = [result[0], result[1]];
    engine.k = GLIDE.k;
    engine.c = GLIDE.c;
    wake();
    callbacks.current.onValueCommit?.(result);
  };

  const width = end - start;
  const startLimits = limitsFor("start", value);
  const endLimits = limitsFor("end", value);
  const instant = mode !== "idle" || coasting || reduced;
  const rootStyle = { ...style, "--wr-height": `${clamp(height, 64, 240)}px`, ...(accent ? { "--wr-accent": accent, "--wr-line": accent } : null) } as CSSProperties;
  const chart = (muted: boolean) => (
    <svg className={styles.chart} data-muted={muted || undefined} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className={styles.area} d={initial.area} />
      <path className={styles.line} vectorEffect="non-scaling-stroke" d={initial.line} />
    </svg>
  );
  const slider = { role: "slider", tabIndex: disabled ? -1 : 0, "aria-orientation": "horizontal", "aria-disabled": disabled || undefined } as const;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} role="group" aria-label={label} data-mode={mode === "idle" && coasting ? "coast" : mode} data-disabled={disabled ? "" : undefined}>
      <div className={styles.readouts} aria-hidden="true">
        <Roll className={styles.start} text={format(start)} order={start} instant={instant} />
        {formatSpan === null ? <span /> : <Roll className={styles.span} text={formatSpan ? formatSpan(width) : String(width)} order={width} instant={instant} />}
        <Roll className={styles.end} text={format(end)} order={end} instant={instant} />
      </div>
      <div ref={plotRef} className={styles.plot} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
        <div className={styles.base}>{chart(true)}</div>
        <div className={styles.clip} aria-hidden="true">
          <div className={styles.clipInner}>{chart(false)}</div>
        </div>
        {live ? <span className={styles.dot} aria-hidden="true">{reduced ? null : <span className={styles.pulse} />}</span> : null}
        <div className={styles.band} aria-hidden="true"><span className={styles.tint} style={{ opacity: 0 }} /></div>
        <div {...slider} className={styles.edge} data-side="start" data-part="start" aria-label={`${label}, start`} aria-valuemin={startLimits[0]} aria-valuemax={startLimits[1]} aria-valuenow={start} aria-valuetext={format(start)} onKeyDown={(event) => onKeyDown("start", event)}>
          <span className={styles.grip} />
        </div>
        <div {...slider} className={styles.body} data-part="pan" aria-label={`${label}, window`} aria-valuemin={min} aria-valuemax={max - width} aria-valuenow={start} aria-valuetext={`${format(start)} to ${format(end)}`} onKeyDown={(event) => onKeyDown("pan", event)} />
        <div {...slider} className={styles.edge} data-side="end" data-part="end" aria-label={`${label}, end`} aria-valuemin={endLimits[0]} aria-valuemax={endLimits[1]} aria-valuenow={end} aria-valuetext={format(end)} onKeyDown={(event) => onKeyDown("end", event)}>
          <span className={styles.grip} />
        </div>
      </div>
      {ticks && ticks.length > 0 ? (
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.value} className={styles.tick} style={{ left: `calc(12px + (100% - 24px) * ${((tick.value - min) / span).toFixed(5)})` }}>{tick.label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default WindowRange;
