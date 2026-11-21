"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./lens-range.module.css";

export interface LensRangePreset {
  value: number;
  label: string;
}

export interface LensRangeProps {
  label?: string;
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  onValueCommit?: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minStepsBetweenThumbs?: number;
  presets?: readonly LensRangePreset[];
  magnet?: number;
  format?: (value: number) => string;
  thumbLabels?: [string, string];
  accent?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Spring {
  x: number;
  v: number;
}

interface Engine {
  width: number;
  target: [number, number];
  pos: [Spring, Spring];
  glide: [boolean, boolean];
  level: [Spring, Spring];
  levelTarget: [number, number];
  follow: [Spring, Spring];
  pill: [Spring, Spring];
  merge: Spring;
  merged: boolean;
  textWidth: [number, number, number];
  pulse: Spring[];
  presetX: number[];
  frame: number;
  last: number;
  visible: boolean;
  ready: boolean;
}

const INSET = 14;
const TICK_GAP = 7;
const SUBSTEP = 1 / 240;
const GLIDE = { k: 784, c: 56 };
const TRAIL = { k: 520, c: 32 };
const PULSE = { k: 900, c: 22 };
/** Lens strength at rest, on hover or focus, and while dragging: [spread, swell]. */
const LENS = [[0.395, 1.15], [0.695, 1.73], [0.9, 2.115]] as const;
const SPREAD_SIGMA = 21.25;
const SWELL_SIGMA = 15.5;
const EMPTY_PRESETS: readonly LensRangePreset[] = [];
const defaultFormat = (value: number) => String(value);

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const spring = (x = 0): Spring => ({ x, v: 0 });
const fixed = (value: number, digits = 2) => String(Math.round(value * 10 ** digits) / 10 ** digits);
const at = (x: number) => `translate3d(${fixed(x)}px, 0px, 0px)`;

function advance(body: Spring, target: number, k: number, c: number, dt: number) {
  body.v += (-k * (body.x - target) - c * body.v) * dt;
  body.x += body.v * dt;
}

function settled(body: Spring, target: number, epsilon = 0.01) {
  if (Math.abs(body.x - target) < epsilon && Math.abs(body.v) < epsilon * 10) {
    body.x = target;
    body.v = 0;
    return true;
  }
  return false;
}

function write(node: HTMLElement | null | undefined, property: "transform" | "opacity", value: string) {
  if (node && node.style[property] !== value) node.style[property] = value;
}

function createEngine(): Engine {
  return {
    width: 0, target: [0, 0], pos: [spring(), spring()], glide: [false, false], level: [spring(), spring()], levelTarget: [0, 0],
    follow: [spring(), spring()], pill: [spring(52), spring(52)], merge: spring(), merged: false, textWidth: [28, 28, 60], pulse: [], presetX: [],
    frame: 0, last: 0, visible: true, ready: false,
  };
}

export function LensRange({
  label = "Range", value: valueProp, defaultValue, onValueChange, onValueCommit, min = 0, max = 100, step = 1, largeStep, minStepsBetweenThumbs = 0,
  presets = EMPTY_PRESETS, magnet = 16, format = defaultFormat, thumbLabels, accent, name, disabled = false, className, style,
}: LensRangeProps) {
  const reduced = useReducedMotion();
  const span = Math.max(max - min, Number.EPSILON);
  const snap = useCallback((raw: number) => {
    const stepped = min + Math.round((raw - min) / step) * step;
    return clamp(Number(stepped.toFixed(10)), min, max);
  }, [max, min, step]);
  const [inner, setInner] = useState<[number, number]>(() => defaultValue ?? [snap(min + span / 4), snap(max - span / 4)]);
  const value = valueProp ?? inner;
  const [low, high] = value;
  const gap = minStepsBetweenThumbs * step;
  const [tickCount, setTickCount] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine>(null as unknown as Engine);
  if (engineRef.current === null) engineRef.current = createEngine();
  const live = useRef({ value, dragging: null as number | null, grab: 0, held: -1, reduced, disabled });
  const callbacks = useRef({ onValueChange, onValueCommit });
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    callbacks.current = { onValueChange, onValueCommit };
    live.current.value = value;
    live.current.reduced = reduced;
    live.current.disabled = disabled;
  });

  const wake = useCallback(() => {
    if (engineRef.current.frame || !engineRef.current.visible) return;
    engineRef.current.last = performance.now();
    engineRef.current.frame = requestAnimationFrame(() => tickRef.current());
  }, []);

  const toPx = useCallback((amount: number) => ((amount - min) / span) * engineRef.current.width, [min, span]);

  const commit = useCallback((next: [number, number], final: boolean) => {
    const current = live.current.value;
    if (next[0] !== current[0] || next[1] !== current[1]) {
      live.current.value = next;
      if (valueProp === undefined) setInner(next);
      callbacks.current.onValueChange?.(next);
    }
    if (final) callbacks.current.onValueCommit?.(next);
  }, [valueProp]);

  // One loop steps every spring and writes transforms and opacity straight to the DOM. It stops at rest, offscreen and in background tabs.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const query = <T extends HTMLElement>(selector: string) => Array.from(root.querySelectorAll<T>(selector));

    const render = () => {
      const width = engineRef.current.width;
      const ticks = query(`.${styles.tick}`);
      const positions = [engineRef.current.pos[0].x, engineRef.current.pos[1].x];
      const strength = engineRef.current.level.map((body) => {
        const amount = clamp(body.x, 0, 2);
        const from = LENS[Math.min(1, Math.floor(amount))];
        const to = LENS[Math.min(2, Math.floor(amount) + 1)];
        const mix = amount - Math.min(1, Math.floor(amount));
        return [from[0] + (to[0] - from[0]) * mix, from[1] + (to[1] - from[1]) * mix];
      });
      ticks.forEach((tick, index) => {
        const base = ticks.length > 1 ? (index / (ticks.length - 1)) * width : 0;
        let shift = 0;
        let swell = 1;
        for (let thumb = 0; thumb < 2; thumb += 1) {
          const distance = base - positions[thumb];
          shift += strength[thumb][0] * distance * Math.exp(-(distance * distance) / (2 * SPREAD_SIGMA * SPREAD_SIGMA));
          swell += strength[thumb][1] * Math.exp(-(distance * distance) / (2 * SWELL_SIGMA * SWELL_SIGMA));
        }
        write(tick, "transform", `${at(base + shift)} scaleY(${fixed(swell, 4)})`);
        write(tick.firstElementChild as HTMLElement | null, "opacity", base >= positions[0] - 0.01 && base <= positions[1] + 0.01 ? "1" : "0");
      });

      const knobs = query(`.${styles.knob}`);
      knobs.forEach((knob, index) => {
        write(knob, "transform", at(positions[index]));
        write(knob.firstElementChild as HTMLElement | null, "transform", `scale(${live.current.dragging === index ? 1.1 : 1})`);
      });
      write(root.querySelector<HTMLElement>(`.${styles.fill}`), "transform", `${at(positions[0])} scaleX(${fixed(width > 0 ? (positions[1] - positions[0]) / width : 0, 5)})`);

      // Bubbles: two caps and a stretched middle each, a bridge between their centers, and three texts.
      const total = width + INSET * 2;
      const blend = clamp(engineRef.current.merge.x, 0, 1);
      const thumbs = [positions[0] + INSET, positions[1] + INSET];
      const centers = [engineRef.current.follow[0].x + INSET, engineRef.current.follow[1].x + INSET];
      const mid = (centers[0] + centers[1]) / 2;
      const mergedWidth = Math.max(56, engineRef.current.textWidth[2] + 24);
      const mergedCenter = clamp(mid, mergedWidth / 2, Math.max(mergedWidth / 2, total - mergedWidth / 2));
      const widths = [Math.max(28, engineRef.current.pill[0].x), Math.max(28, engineRef.current.pill[1].x)];
      const half = Math.max(28, mergedWidth / 2);
      const pillCenter = [0, 1].map((index) => {
        const single = clamp(centers[index], widths[index] / 2, Math.max(widths[index] / 2, total - widths[index] / 2));
        const joined = index === 0 ? mergedCenter - mergedWidth / 2 + half / 2 : mergedCenter + mergedWidth / 2 - half / 2;
        return single + (joined - single) * blend;
      });
      const bubbles = root.querySelector<HTMLElement>(`.${styles.bubbles}`);
      const parts = bubbles ? (Array.from(bubbles.children) as HTMLElement[]) : [];
      [0, 1].forEach((index) => {
        const left = pillCenter[index] - widths[index] / 2;
        write(parts[index * 3], "transform", at(left));
        write(parts[index * 3 + 1], "transform", `${at(left + 14)} scaleX(${fixed((widths[index] - 28) / 100, 5)})`);
        write(parts[index * 3 + 2], "transform", at(left + widths[index] - 28));
      });
      write(parts[6], "transform", `${at(pillCenter[0])} scale(${fixed(Math.max(0, pillCenter[1] - pillCenter[0]) / 100, 5)}, ${fixed(blend, 4)})`);
      write(parts[6], "opacity", blend > 0.001 ? "1" : "0");
      const leftEdge = pillCenter[0] - widths[0] / 2;
      const rightEdge = pillCenter[1] + widths[1] / 2;
      const pointers = [0, 1].map((index) => {
        const from = blend > 0.5 ? leftEdge : pillCenter[index] - widths[index] / 2;
        const to = blend > 0.5 ? rightEdge : pillCenter[index] + widths[index] / 2;
        return clamp(thumbs[index], from + 12, Math.max(from + 12, to - 12));
      });
      if (pointers[1] - pointers[0] < 24 && blend > 0.5) {
        const center = clamp((thumbs[0] + thumbs[1]) / 2, leftEdge + 24, Math.max(leftEdge + 24, rightEdge - 24));
        pointers[0] = center - 12;
        pointers[1] = center + 12;
      }
      write(parts[7], "transform", `${at(pointers[0])} translateX(-50%)`);
      write(parts[8], "transform", `${at(pointers[1])} translateX(-50%)`);
      const singleOpacity = clamp((0.385 - blend) / 0.315, 0, 1);
      const mergedOpacity = clamp((blend - 0.58) / 0.38, 0, 1);
      [0, 1].forEach((index) => {
        write(parts[9 + index], "transform", `${at(pillCenter[index])} translateX(-50%)`);
        write(parts[9 + index], "opacity", fixed(singleOpacity, 3));
      });
      write(parts[11], "transform", `${at((pillCenter[0] + pillCenter[1]) / 2)} translateX(-50%) scale(${fixed(0.94 + 0.06 * mergedOpacity, 4)})`);
      write(parts[11], "opacity", fixed(mergedOpacity, 3));

      query(`.${styles.preset}`).forEach((preset, index) => {
        write(preset, "transform", `${at(engineRef.current.presetX[index] ?? 0)} translateX(-50%) scale(${fixed(1 + (engineRef.current.pulse[index]?.x ?? 0), 4)})`);
      });
    };

    const stepAll = (dt: number) => {
      let moving = false;
      const jump = live.current.reduced;
      for (let index = 0; index < 2; index += 1) {
        const body = engineRef.current.pos[index];
        if (engineRef.current.glide[index] && !jump) {
          advance(body, engineRef.current.target[index], GLIDE.k, GLIDE.c, dt);
          if (settled(body, engineRef.current.target[index], 0.02)) engineRef.current.glide[index] = false;
          else moving = true;
        } else {
          body.x = engineRef.current.target[index];
          body.v = 0;
          engineRef.current.glide[index] = false;
        }
        const level = engineRef.current.level[index];
        if (jump) level.x = engineRef.current.levelTarget[index];
        else {
          advance(level, engineRef.current.levelTarget[index], 500, 45, dt);
          if (!settled(level, engineRef.current.levelTarget[index], 0.002)) moving = true;
        }
        const follow = engineRef.current.follow[index];
        if (jump) follow.x = body.x;
        else {
          advance(follow, body.x, TRAIL.k, TRAIL.c, dt);
          if (!settled(follow, body.x, 0.02)) moving = true;
        }
      }
      const separate = (engineRef.current.textWidth[0] + engineRef.current.textWidth[1]) / 2 + 24;
      const distance = engineRef.current.follow[1].x - engineRef.current.follow[0].x;
      if (engineRef.current.merged ? distance > separate + 8 : distance < separate + 4) engineRef.current.merged = !engineRef.current.merged;
      const mergeTarget = engineRef.current.merged ? 1 : 0;
      if (jump) engineRef.current.merge.x = mergeTarget;
      else {
        advance(engineRef.current.merge, mergeTarget, GLIDE.k, GLIDE.c, dt);
        if (!settled(engineRef.current.merge, mergeTarget, 0.002)) moving = true;
      }
      const half = Math.max(28, (engineRef.current.textWidth[2] + 24) / 2);
      for (let index = 0; index < 2; index += 1) {
        const target = engineRef.current.merged ? half : engineRef.current.textWidth[index] + 24;
        if (jump) engineRef.current.pill[index].x = target;
        else {
          advance(engineRef.current.pill[index], target, GLIDE.k, GLIDE.c, dt);
          if (!settled(engineRef.current.pill[index], target, 0.02)) moving = true;
        }
      }
      for (const pulse of engineRef.current.pulse) {
        if (jump) { pulse.x = 0; pulse.v = 0; continue; }
        advance(pulse, 0, PULSE.k, PULSE.c, dt);
        if (!settled(pulse, 0, 0.0005)) moving = true;
      }
      return moving;
    };

    const tick = () => {
      engineRef.current.frame = 0;
      const now = performance.now();
      let elapsed = Math.min(0.064, (now - engineRef.current.last) / 1000);
      engineRef.current.last = now;
      let moving = true;
      while (elapsed > 0 && moving) {
        moving = stepAll(Math.min(SUBSTEP, elapsed));
        elapsed -= SUBSTEP;
      }
      if (elapsed <= 0 && moving === true) moving = stepAll(0) || moving;
      render();
      if (moving && engineRef.current.visible && !document.hidden) engineRef.current.frame = requestAnimationFrame(tick);
    };
    tickRef.current = tick;

    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      engineRef.current.visible = entry.isIntersecting;
      if (engineRef.current.visible) wake();
    });
    observer?.observe(root);
    const onVisibility = () => { if (!document.hidden) wake(); };
    document.addEventListener("visibilitychange", onVisibility);
    wake();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(engineRef.current.frame);
      engineRef.current.frame = 0;
    };
  }, [wake]);

  // Width drives the tick count, about one every 7px, and where the presets sit.
  const presetKey = presets.map((preset) => `${preset.value}:${preset.label}`).join("|");
  useLayoutEffect(() => {
    const scale = scaleRef.current;
    const root = rootRef.current;
    if (!scale || !root) return;
    const measure = () => {
      const width = Math.max(0, scale.clientWidth - INSET * 2);
      engineRef.current.width = width;
      setTickCount(width > 0 ? Math.round(width / TICK_GAP) + 1 : 0);
      const labels = Array.from(root.querySelectorAll<HTMLElement>(`.${styles.preset}`));
      const values = presetKey ? presetKey.split("|").map((part) => Number(part.slice(0, part.indexOf(":")))) : [];
      const spots = values.map((amount, index) => ({ index, x: ((amount - min) / span) * width, size: labels[index]?.offsetWidth ?? 0 })).sort((a, b) => a.x - b.x);
      // Labels are nudged apart when they would overlap; the stops stay on the exact values.
      for (let pass = 0; pass < 4; pass += 1) {
        for (let index = 1; index < spots.length; index += 1) {
          const before = spots[index - 1];
          const after = spots[index];
          const overlap = before.x + before.size / 2 + 4 - (after.x - after.size / 2);
          if (overlap > 0) { before.x -= overlap / 2; after.x += overlap / 2; }
        }
      }
      engineRef.current.presetX = [];
      spots.forEach((spot) => { engineRef.current.presetX[spot.index] = spot.x; });
      while (engineRef.current.pulse.length < values.length) engineRef.current.pulse.push(spring());
      const current = live.current.value;
      for (let index = 0; index < 2; index += 1) {
        const px = ((current[index] - min) / span) * width;
        engineRef.current.target[index] = px;
        if (!engineRef.current.ready || live.current.dragging === null) {
          engineRef.current.pos[index].x = px;
          engineRef.current.pos[index].v = 0;
          engineRef.current.follow[index].x = px;
          engineRef.current.follow[index].v = 0;
        }
      }
      if (!engineRef.current.ready && width > 0) {
        const separate = (engineRef.current.textWidth[0] + engineRef.current.textWidth[1]) / 2 + 24;
        engineRef.current.merged = engineRef.current.pos[1].x - engineRef.current.pos[0].x < separate + 4;
        engineRef.current.merge.x = engineRef.current.merged ? 1 : 0;
        engineRef.current.ready = true;
      }
      wake();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scale);
    return () => observer.disconnect();
  }, [min, presetKey, span, wake]);

  const lowText = format(low);
  const highText = format(high);
  const mergedText = low === high ? lowText : `${lowText} – ${highText}`;

  // Text widths are read only when a bubble's text changes.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const texts = Array.from(root.querySelectorAll<HTMLElement>(`.${styles.text}`));
    const first = engineRef.current.textWidth[0] === 28 && engineRef.current.textWidth[1] === 28;
    texts.forEach((node, index) => { engineRef.current.textWidth[index] = node.offsetWidth; });
    if (first) {
      engineRef.current.pill[0].x = engineRef.current.textWidth[0] + 24;
      engineRef.current.pill[1].x = engineRef.current.textWidth[1] + 24;
      const separate = (engineRef.current.textWidth[0] + engineRef.current.textWidth[1]) / 2 + 24;
      if (engineRef.current.width > 0) {
        engineRef.current.merged = engineRef.current.pos[1].x - engineRef.current.pos[0].x < separate + 4;
        engineRef.current.merge.x = engineRef.current.merged ? 1 : 0;
        if (engineRef.current.merged) engineRef.current.pill[0].x = engineRef.current.pill[1].x = Math.max(28, (engineRef.current.textWidth[2] + 24) / 2);
      }
    }
    wake();
  }, [lowText, highText, mergedText, tickCount, wake]);

  // A value set from outside, by a key or by a preset glides the thumb there; a dragged thumb is already under the pointer.
  useEffect(() => {
    for (let index = 0; index < 2; index += 1) {
      if (live.current.dragging === index) continue;
      const px = toPx(index === 0 ? low : high);
      if (Math.abs(px - engineRef.current.target[index]) > 0.001) {
        engineRef.current.target[index] = px;
        engineRef.current.glide[index] = true;
      }
    }
    wake();
  }, [high, low, toPx, tickCount, wake]);

  const setLevel = useCallback((index: number, amount: number) => {
    engineRef.current.levelTarget[index] = amount;
    wake();
  }, [wake]);
  const hover = useRef<[boolean, boolean]>([false, false]);
  const focus = useRef<[boolean, boolean]>([false, false]);
  const refreshLevel = useCallback((index: number) => {
    setLevel(index, live.current.dragging === index ? 2 : hover.current[index] || focus.current[index] ? 1 : 0);
  }, [setLevel]);

  const limits = (index: number, current: [number, number]): [number, number] => (index === 0 ? [min, Math.max(min, current[1] - gap)] : [Math.min(max, current[0] + gap), max]);

  const moveTo = (index: number, raw: number, glide: boolean) => {
    const width = engineRef.current.width;
    if (width <= 0) return;
    const current = live.current.value;
    const [from, to] = limits(index, current);
    const fromPx = toPx(from);
    const toPxLimit = toPx(to);
    let px = clamp(raw, fromPx, toPxLimit);
    let next = clamp(snap(min + (px / width) * span), from, to);
    let held = -1;
    if (magnet > 0) {
      presets.forEach((preset, presetIndex) => {
        if (preset.value < from || preset.value > to) return;
        const center = toPx(preset.value);
        const offset = raw - center;
        if (Math.abs(offset) > magnet) return;
        // Inside a preset's reach the thumb follows a power curve: it lingers near the preset and lets go at the edge.
        const pulled = center + Math.sign(offset) * magnet * (Math.abs(offset) / magnet) ** 2.4;
        px = clamp(pulled, fromPx, toPxLimit);
        if (Math.abs(pulled - center) < magnet / 4) {
          next = preset.value;
          held = presetIndex;
        } else next = clamp(snap(min + (px / width) * span), from, to);
      });
    }
    if (held !== live.current.held) {
      live.current.held = held;
      if (held >= 0 && !live.current.reduced) {
        const pulse = engineRef.current.pulse[held];
        if (pulse) pulse.v = 0.9;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
      }
    }
    engineRef.current.target[index] = px;
    if (glide) engineRef.current.glide[index] = true;
    commit(index === 0 ? [next, current[1]] : [current[0], next], false);
    wake();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const scale = scaleRef.current;
    if (!scale) return;
    const left = scale.getBoundingClientRect().left + INSET;
    const raw = event.clientX - left;
    const knob = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    let index: number;
    if (knob) index = Number(knob.dataset.index);
    else {
      const [first, second] = [engineRef.current.pos[0].x, engineRef.current.pos[1].x];
      index = Math.abs(raw - first) < Math.abs(raw - second) || (Math.abs(raw - first) === Math.abs(raw - second) && raw < first) ? 0 : 1;
    }
    event.preventDefault();
    scale.setPointerCapture(event.pointerId);
    live.current.dragging = index;
    live.current.grab = knob ? raw - engineRef.current.pos[index].x : 0;
    live.current.held = -1;
    setDragging(index);
    refreshLevel(index);
    if (event.pointerType !== "mouse") scale.querySelectorAll<HTMLElement>("[data-index]")[index]?.focus({ preventScroll: true });
    // A press on the scale moves the value under the finger at once while the thumb glides there.
    if (!knob) moveTo(index, raw, true);
    else wake();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const index = live.current.dragging;
    const scale = scaleRef.current;
    if (index === null || !scale) return;
    moveTo(index, event.clientX - scale.getBoundingClientRect().left - INSET - live.current.grab, false);
  };

  const release = () => {
    const index = live.current.dragging;
    if (index === null) return;
    live.current.dragging = null;
    live.current.held = -1;
    setDragging(null);
    refreshLevel(index);
    const current = live.current.value;
    engineRef.current.target[index] = toPx(current[index]);
    engineRef.current.glide[index] = true;
    callbacks.current.onValueCommit?.(current);
    wake();
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const current = live.current.value;
    const [from, to] = limits(index, current);
    const big = Math.max(step, Math.round((largeStep ?? span / 10) / step) * step);
    const amount = event.shiftKey ? big : step;
    let next = current[index];
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = snap(next + amount);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = snap(next - amount);
    else if (event.key === "PageUp") next = snap(next + big);
    else if (event.key === "PageDown") next = snap(next - big);
    else if (event.key === "Home") next = from;
    else if (event.key === "End") next = to;
    else return;
    event.preventDefault();
    next = clamp(next, from, to);
    if (next !== current[index]) commit(index === 0 ? [next, current[1]] : [current[0], next], true);
  };

  const choosePreset = (preset: LensRangePreset) => {
    if (disabled) return;
    const current = live.current.value;
    const nearer = Math.abs(preset.value - current[0]) <= Math.abs(preset.value - current[1]) ? 0 : 1;
    const index = preset.value < current[0] ? 0 : preset.value > current[1] ? 1 : nearer;
    const [from, to] = limits(index, current);
    const next = clamp(preset.value, from, to);
    commit(index === 0 ? [next, current[1]] : [current[0], next], true);
  };

  const names = thumbLabels ?? [`${label}, minimum`, `${label}, maximum`];
  const rootStyle = accent ? ({ ...style, "--lr-accent": accent } as CSSProperties) : style;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      role="group"
      aria-label={label}
      data-dragging={dragging !== null ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      <span className={styles.label}>{label}</span>
      <div className={styles.bubbles} aria-hidden="true">
        <span className={styles.cap} />
        <span className={styles.mid} />
        <span className={styles.cap} />
        <span className={styles.cap} />
        <span className={styles.mid} />
        <span className={styles.cap} />
        <span className={styles.bridge} />
        <span className={styles.pointer} />
        <span className={styles.pointer} />
        <span className={styles.text}>{lowText}</span>
        <span className={styles.text}>{highText}</span>
        <span className={styles.text} style={{ opacity: 0 }}>{mergedText}</span>
      </div>
      <div ref={scaleRef} className={styles.scale} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
        <div className={styles.ticks} aria-hidden="true">
          {Array.from({ length: tickCount }, (_, index) => (
            <span key={index} className={styles.tick}><span className={styles.tickOn} /></span>
          ))}
        </div>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} />
          {presets.map((preset) => <span key={preset.value} className={styles.stop} style={{ left: `${((preset.value - min) / span) * 100}%` }} />)}
        </span>
        <div className={styles.knobs}>
          {[0, 1].map((index) => {
            const [from, to] = limits(index, value);
            return (
              <div
                key={index}
                role="slider"
                data-index={index}
                className={styles.knob}
                tabIndex={disabled ? -1 : 0}
                aria-label={names[index]}
                aria-valuemin={from}
                aria-valuemax={to}
                aria-valuenow={value[index]}
                aria-valuetext={format(value[index])}
                aria-orientation="horizontal"
                aria-disabled={disabled || undefined}
                onKeyDown={onKeyDown(index)}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") { hover.current[index] = true; refreshLevel(index); } }}
                onPointerLeave={() => { hover.current[index] = false; refreshLevel(index); }}
                onFocus={() => { focus.current[index] = true; refreshLevel(index); }}
                onBlur={() => { focus.current[index] = false; refreshLevel(index); }}
              >
                <span className={styles.knobFace} />
              </div>
            );
          })}
        </div>
      </div>
      {presets.length > 0 ? (
        <div className={styles.presets}>
          {presets.map((preset) => (
            <button key={preset.value} type="button" className={styles.preset} aria-label={`${preset.label}, ${format(preset.value)}`} disabled={disabled} onClick={() => choosePreset(preset)}>
              <span className={styles.presetDot} aria-hidden="true" style={{ opacity: dragging !== null && value[dragging] === preset.value ? 1 : 0 }} />
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      {name ? (
        <>
          <input type="hidden" name={name} value={low} disabled={disabled} />
          <input type="hidden" name={name} value={high} disabled={disabled} />
        </>
      ) : null}
    </div>
  );
}

export default LensRange;
