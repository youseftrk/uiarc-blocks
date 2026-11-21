"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
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

interface Spring { x: number; v: number }
interface Config {
  min: number; max: number; step: number; gap: number; large: number; decimals: number;
  values: [number, number]; reduced: boolean; disabled: boolean; presets: LensRangePreset[]; magnet: number;
  emit: (index: number, value: number) => void; commit: () => void;
}
interface Nodes {
  root: RefObject<HTMLDivElement | null>;
  scale: RefObject<HTMLDivElement | null>;
  ticks: RefObject<(HTMLSpanElement | null)[]>;
  fill: RefObject<HTMLSpanElement | null>;
  knobs: RefObject<(HTMLDivElement | null)[]>;
  marks: RefObject<(HTMLButtonElement | null)[]>;
  pills: RefObject<(HTMLSpanElement | null)[]>;
  texts: RefObject<(HTMLSpanElement | null)[]>;
  pointers: RefObject<(HTMLSpanElement | null)[]>;
}
interface Drag { id: number; index: number | null; grab: number; x0: number; touch: boolean }

const STEP = 1 / 240;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const decimalsOf = (value: number) => (String(value).split(".")[1] ?? "").length;
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const spring = (x = 0): Spring => ({ x, v: 0 });
const advance = (s: Spring, target: number, stiffness: number, damping: number, dt: number) => {
  s.v += (-stiffness * (s.x - target) - damping * s.v) * dt;
  s.x += s.v * dt;
};
const settled = (s: Spring, target: number, epsilon: number) => Math.abs(s.x - target) < epsilon && Math.abs(s.v) < 20 * epsilon;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (listener: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

/* Styles are written straight to the nodes, and only when a value changes. */
const written = new WeakMap<Element, Record<string, string>>();
function write(node: Element | null | undefined, property: string, value: string) {
  if (!node) return;
  let cache = written.get(node);
  if (!cache) {
    cache = {};
    written.set(node, cache);
  }
  if (cache[property] !== value) {
    cache[property] = value;
    (node as HTMLElement).style.setProperty(property, value);
  }
}

function createEngine(config: RefObject<Config | null>, nodes: Nodes, setDragging: (index: number | null) => void) {
  const cfg = () => config.current as Config;
  const thumb = () => ({ pos: spring(), goal: 0, lag: spring(), lens: spring(0.3), press: spring(), bubble: spring(), hover: false, focus: false, caught: -1 });
  const state = {
    w: 1, left: 0, rootW: 1, rootLeft: 0,
    thumbs: [thumb(), thumb()],
    widths: [spring(), spring(), spring()],
    textW: [0, 0, 0],
    merge: spring(),
    merged: false,
    pulses: [] as Spring[],
    labels: [] as number[],
    drag: null as Drag | null,
    running: false, frame: 0, last: 0, visible: true, disposed: false, measured: false,
  };

  const toX = (value: number) => ((value - cfg().min) / (cfg().max - cfg().min || 1)) * state.w;
  const toValue = (x: number) => cfg().min + (x / state.w) * (cfg().max - cfg().min);
  const round = (value: number) => Number(value.toFixed(cfg().decimals));
  const lowest = (index: number) => (index === 1 ? round(cfg().values[0] + cfg().gap) : cfg().min);
  const highest = (index: number) => (index === 0 ? round(cfg().values[1] - cfg().gap) : cfg().max);
  const snap = (index: number, value: number) => {
    const c = cfg();
    const inside = clamp(value, c.min, c.max);
    return clamp(round(c.min + Math.round((inside - c.min) / c.step) * c.step), lowest(index), highest(index));
  };
  const lensGoal = (index: number) => {
    const t = state.thumbs[index];
    return state.drag?.index === index ? 1 : t.hover || t.focus ? 0.72 : 0.3;
  };
  const at = (index: number) => state.thumbs[index].pos.x + state.thumbs[index].lag.x;

  function kick() {
    if (state.disposed || state.running) return;
    if (!state.visible) {
      rest();
      paint();
      return;
    }
    state.running = true;
    state.last = 0;
    state.frame = requestAnimationFrame(tick);
  }

  function simulate(elapsed: number) {
    if (cfg().reduced) {
      rest();
      updateMerged();
      rest();
      return !!state.drag;
    }
    const steps = Math.min(24, Math.max(1, Math.ceil(elapsed / STEP - 1e-6)));
    const dt = elapsed / steps;
    for (let i = 0; i < steps; i++) {
      state.thumbs.forEach((t, index) => {
        if (state.drag?.index !== index) advance(t.pos, t.goal, 520, 38, dt);
        advance(t.lag, 0, 520, 40, dt);
        advance(t.lens, lensGoal(index), 300, 26, dt);
        advance(t.press, +(state.drag?.index === index), 700, 38, dt);
        advance(t.bubble, t.pos.x + t.lag.x, 380, 26, dt);
      });
      state.widths.forEach((w, index) => advance(w, state.textW[index], 640, 46, dt));
      advance(state.merge, +!!state.merged, 360, 30, dt);
      state.pulses.forEach(p => advance(p, 0, 520, 16, dt));
    }
    updateMerged();
    let moving = !!state.drag;
    state.thumbs.forEach((t, index) => {
      if (!((state.drag?.index === index || settled(t.pos, t.goal, 0.05)) && settled(t.lag, 0, 0.05) && settled(t.lens, lensGoal(index), 0.002) && settled(t.press, +(state.drag?.index === index), 0.002) && settled(t.bubble, at(index), 0.05))) moving = true;
    });
    state.widths.forEach((w, index) => {
      if (!settled(w, state.textW[index], 0.05)) moving = true;
    });
    if (!settled(state.merge, +!!state.merged, 0.002)) moving = true;
    state.pulses.forEach(p => {
      if (!settled(p, 0, 0.002)) moving = true;
    });
    if (!moving) rest();
    return moving;
  }

  function tick(now: number) {
    const elapsed = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
    state.last = now;
    const moving = simulate(elapsed);
    paint();
    if (moving && state.visible && !state.disposed) state.frame = requestAnimationFrame(tick);
    else {
      state.running = false;
      state.last = 0;
    }
  }

  function rest() {
    state.thumbs.forEach((t, index) => {
      if (state.drag?.index !== index) {
        t.pos.x = t.goal;
        t.pos.v = 0;
      }
      t.lag.x = 0; t.lag.v = 0;
      t.lens.x = lensGoal(index); t.lens.v = 0;
      t.press.x = +(state.drag?.index === index); t.press.v = 0;
      t.bubble.x = at(index); t.bubble.v = 0;
    });
    state.widths.forEach((w, index) => {
      w.x = state.textW[index];
      w.v = 0;
    });
    state.merge.x = +!!state.merged;
    state.merge.v = 0;
    state.pulses.forEach(p => {
      p.x = 0;
      p.v = 0;
    });
  }

  function bubbles() {
    const wa = Math.max(state.widths[0].x, 28);
    const wb = Math.max(state.widths[1].x, 28);
    const ca = clamp(14 + state.thumbs[0].bubble.x, wa / 2, state.rootW - wa / 2);
    const cb = clamp(14 + state.thumbs[1].bubble.x, wb / 2, state.rootW - wb / 2);
    return { wa, wb, ca, cb };
  }

  function updateMerged() {
    const { wa, wb, ca, cb } = bubbles();
    const gap = cb - wb / 2 - (ca + wa / 2);
    if (!state.merged && gap < 4) state.merged = true;
    else if (state.merged && gap > 14) state.merged = false;
  }

  function paint() {
    if (!state.measured) return;
    const c = cfg();
    const a = at(0);
    const b = at(1);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const ticks = nodes.ticks.current;
    const count = ticks.length;
    const pull = state.thumbs.map(t => 0.18 + 0.72 * t.lens.x);
    const grow = state.thumbs.map(t => 0.35 + 0.65 * t.lens.x);
    for (let i = 0; i < count; i++) {
      const node = ticks[i];
      if (!node) continue;
      const home = count > 1 ? (i / (count - 1)) * state.w : 0;
      let x = home;
      let lift = 0;
      for (let k = 0; k < 2; k++) {
        const distance = home - (k ? b : a);
        const falloff = Math.exp(-(distance * distance) / 900);
        x += pull[k] * distance * falloff;
        lift = Math.max(lift, grow[k] * Math.exp(-(distance * distance) / (900 * 0.55)));
      }
      write(node, "transform", `translate3d(${x.toFixed(2)}px,0,0) scaleY(${(1 + 2.1 * lift).toFixed(4)})`);
      const inside = smooth((home - low + 2) / 4) * smooth((high - home + 2) / 4);
      write(node.firstElementChild, "opacity", inside.toFixed(3));
    }
    write(nodes.fill.current, "transform", `translate3d(${low.toFixed(2)}px,0,0) scaleX(${(Math.max(0, high - low) / state.w).toFixed(5)})`);
    state.thumbs.forEach((t, index) => {
      write(nodes.knobs.current[index], "transform", `translate3d(${at(index).toFixed(2)}px,0,0)`);
      write(nodes.knobs.current[index]?.firstElementChild, "transform", `scale(${(1 + 0.1 * t.press.x).toFixed(4)})`);
    });
    const marks = nodes.marks.current;
    c.presets.forEach((preset, index) => {
      const pulse = state.pulses[index]?.x ?? 0;
      const caught = state.thumbs.some(t => t.caught === index);
      write(marks[index], "transform", `translate3d(${(state.labels[index] ?? toX(preset.value)).toFixed(2)}px,0,0) translateX(-50%) scale(${(1 + 0.12 * pulse).toFixed(4)})`);
      write(marks[index]?.firstElementChild, "opacity", caught ? "1" : "0");
    });
    const { wa, wb, ca, cb } = bubbles();
    const merge = clamp(state.merge.x, 0, 1.2);
    const wide = Math.max(state.widths[2].x, 28);
    const centre = clamp((ca + cb) / 2, wide / 2, state.rootW - wide / 2);
    const aLeft = ca - wa / 2 + (centre - wide / 2 - (ca - wa / 2)) * merge;
    const aRight = ca + wa / 2 + (centre - (ca + wa / 2)) * merge;
    const bLeft = cb - wb / 2 + (centre - (cb - wb / 2)) * merge;
    const bRight = cb + wb / 2 + (centre + wide / 2 - (cb + wb / 2)) * merge;
    const pills = nodes.pills.current;
    const pill = (first: number, left: number, right: number) => {
      const end = Math.max(right, left + 28);
      write(pills[first], "transform", `translate3d(${left.toFixed(2)}px,0,0)`);
      write(pills[first + 1], "transform", `translate3d(${(left + 14).toFixed(2)}px,0,0) scaleX(${(Math.max(0, end - left - 28) / 100).toFixed(5)})`);
      write(pills[first + 2], "transform", `translate3d(${(end - 28).toFixed(2)}px,0,0)`);
    };
    pill(0, aLeft, aRight);
    pill(3, bLeft, bRight);
    const aMid = (aLeft + aRight) / 2;
    const bMid = (bLeft + bRight) / 2;
    write(pills[6], "transform", `translate3d(${aMid.toFixed(2)}px,0,0) scale(${(Math.max(0, bMid - aMid) / 100).toFixed(5)},${clamp(merge, 0, 1).toFixed(4)})`);
    write(pills[6], "opacity", merge > 0.02 ? "1" : "0");
    const texts = nodes.texts.current;
    const fits = (index: number) => smooth((16 - (state.textW[index] - state.widths[index].x)) / 8);
    const apart = smooth((cb - wb / 2 - (ca + wa / 2) - 2) / 12);
    const single = smooth((0.45 - merge) / 0.45) * apart;
    const joined = smooth((merge - 0.55) / 0.45);
    write(texts[0], "transform", `translate3d(${((aLeft + aRight) / 2).toFixed(2)}px,0,0) translateX(-50%)`);
    write(texts[1], "transform", `translate3d(${((bLeft + bRight) / 2).toFixed(2)}px,0,0) translateX(-50%)`);
    write(texts[2], "transform", `translate3d(${centre.toFixed(2)}px,0,0) translateX(-50%) scale(${(0.94 + 0.06 * joined).toFixed(4)})`);
    write(texts[0], "opacity", (single * fits(0)).toFixed(3));
    write(texts[1], "opacity", (single * fits(1)).toFixed(3));
    write(texts[2], "opacity", (joined * fits(2)).toFixed(3));
    state.thumbs.forEach((_, index) => {
      const x = clamp(14 + at(index), (index ? bLeft : aLeft) + 14 - 2, (index ? bRight : aRight) - 14 + 2);
      write(nodes.pointers.current[index], "transform", `translate3d(${x.toFixed(2)}px,0,0) translateX(-50%)`);
    });
  }

  function measureTexts(force = false) {
    const texts = nodes.texts.current;
    for (let i = 0; i < 3; i++) {
      const width = (texts[i]?.offsetWidth ?? 0) + 22;
      state.textW[i] = width;
      if (force || !state.widths[i].x) {
        state.widths[i].x = width;
        state.widths[i].v = 0;
      }
    }
  }

  function measure() {
    const scale = nodes.scale.current;
    const root = nodes.root.current;
    if (!scale || !root) return;
    const scaleRect = scale.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    state.w = Math.max(1, scaleRect.width - 28);
    state.left = scaleRect.left + 14;
    state.rootW = rootRect.width;
    state.rootLeft = rootRect.left;
    const first = !state.measured;
    state.measured = true;
    const c = cfg();
    state.thumbs.forEach((t, index) => {
      t.goal = toX(c.values[index]);
      if (first || state.drag?.index !== index) {
        t.pos.x = t.goal;
        t.pos.v = 0;
        t.bubble.x = t.goal;
      }
    });
    state.pulses = c.presets.map((_, index) => state.pulses[index] ?? spring());
    const spots = c.presets.map((preset, index) => ({ i: index, at: toX(preset.value), w: (nodes.marks.current[index]?.offsetWidth ?? 0) + 6 })).sort((p, q) => p.at - q.at);
    const places = spots.map(spot => spot.at);
    for (let pass = 0; pass < 12; pass++) {
      for (let i = 1; i < spots.length; i++) {
        const overlap = places[i - 1] + spots[i - 1].w / 2 - (places[i] - spots[i].w / 2);
        if (overlap > 0) {
          places[i - 1] -= overlap / 2;
          places[i] += overlap / 2;
        }
      }
      spots.forEach((spot, i) => {
        places[i] = clamp(places[i], spot.w / 2 - 14, state.w + 14 - spot.w / 2);
      });
    }
    state.labels = [];
    spots.forEach((spot, i) => {
      state.labels[spot.i] = places[i];
    });
    measureTexts(first);
    updateMerged();
    if (first) state.merge.x = +!!state.merged;
    paint();
  }

  function pulse(index: number) {
    const p = state.pulses[index];
    if (p && !cfg().reduced) {
      p.v += 9;
      kick();
    }
  }
  const focusKnob = (index: number) => nodes.knobs.current[index]?.focus({ preventScroll: true });

  function grab(index: number, x: number, onKnob: boolean) {
    const drag = state.drag;
    if (!drag) return;
    const t = state.thumbs[index];
    const shown = at(index);
    drag.index = index;
    drag.grab = onKnob ? x - t.pos.x : 0;
    if (!onKnob) {
      t.pos.x = x;
      t.lag.x = cfg().reduced ? 0 : shown - x;
    }
    t.pos.v = 0;
    setDragging(index);
    focusKnob(index);
    dragTo(x);
  }

  function dragTo(pointer: number) {
    const drag = state.drag;
    if (!drag || drag.index === null) return;
    const c = cfg();
    const index = drag.index;
    const t = state.thumbs[index];
    const from = toX(lowest(index));
    const to = toX(highest(index));
    const raw = clamp(pointer - drag.grab, from, to);
    let x = raw;
    let value = snap(index, toValue(raw));
    let caught = -1;
    if (c.magnet > 0) {
      let nearest = -1;
      let best = Infinity;
      c.presets.forEach((preset, i) => {
        if (preset.value < lowest(index) || preset.value > highest(index)) return;
        const distance = Math.abs(raw - toX(preset.value));
        if (distance < c.magnet && distance < best) {
          nearest = i;
          best = distance;
        }
      });
      if (nearest >= 0) {
        const anchor = toX(c.presets[nearest].value);
        const offset = raw - anchor;
        x = anchor + Math.sign(offset) * c.magnet * Math.pow(Math.abs(offset) / c.magnet, 2.4);
        if (Math.abs(offset) < 0.55 * c.magnet) {
          value = c.presets[nearest].value;
          caught = nearest;
        } else value = snap(index, toValue(x));
      }
    }
    t.pos.x = x;
    t.goal = x;
    if (caught !== t.caught) {
      if (caught >= 0) {
        pulse(caught);
        if (drag.touch && !c.reduced) navigator.vibrate?.(6);
      }
      t.caught = caught;
    }
    c.emit(index, value);
  }

  function hover(clientX: number | null) {
    let changed = false;
    state.thumbs.forEach((t, index) => {
      const near = clientX !== null && Math.abs(clientX - state.left - at(index)) < 36;
      if (near !== t.hover) {
        t.hover = near;
        changed = true;
      }
    });
    if (changed) kick();
  }

  return {
    measure,
    sync() {
      const c = cfg();
      state.thumbs.forEach((t, index) => {
        if (state.drag?.index !== index) t.goal = toX(c.values[index]);
      });
      state.pulses = c.presets.map((_, index) => state.pulses[index] ?? spring());
      measureTexts();
      kick();
    },
    kick,
    down(event: ReactPointerEvent<HTMLDivElement>) {
      const c = cfg();
      if (c.disabled || event.button !== 0 || !event.isPrimary || state.drag) return;
      measure();
      const x = event.clientX - state.left;
      const knob = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch { /* The pointer may already be gone. */ }
      state.drag = { id: event.pointerId, index: null, grab: 0, x0: event.clientX, touch: event.pointerType === "touch" };
      if (c.values[1] - c.values[0] <= c.gap + 1e-9 && Math.abs(x - toX(c.values[0])) < 16) {
        focusKnob(knob ? Number(knob.dataset.index) : 1);
        event.preventDefault();
        return;
      }
      grab(knob ? Number(knob.dataset.index) : Math.abs(x - toX(c.values[0])) <= Math.abs(x - toX(c.values[1])) ? 0 : 1, x, !!knob);
      event.preventDefault();
      kick();
    },
    move(event: ReactPointerEvent<HTMLDivElement>) {
      const drag = state.drag;
      if (!drag) return void hover(event.clientX);
      if (drag.id !== event.pointerId) return;
      const x = event.clientX - state.left;
      if (drag.index === null) {
        const travelled = event.clientX - drag.x0;
        if (Math.abs(travelled) < 2) return;
        grab(travelled < 0 ? 0 : 1, x - travelled, true);
      }
      dragTo(x);
      kick();
    },
    up(event: ReactPointerEvent<HTMLDivElement>) {
      const drag = state.drag;
      if (!drag || drag.id !== event.pointerId) return;
      state.drag = null;
      setDragging(null);
      const index = drag.index;
      if (index === null) return;
      const t = state.thumbs[index];
      t.goal = toX(cfg().values[index]);
      t.caught = -1;
      cfg().commit();
      kick();
    },
    hover,
    focus(index: number, focused: boolean) {
      state.thumbs[index].focus = focused;
      kick();
    },
    key(index: number, event: ReactKeyboardEvent<HTMLDivElement>) {
      const c = cfg();
      if (c.disabled) return;
      const current = c.values[index];
      const step = event.shiftKey ? c.large : c.step;
      let next: number;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + step;
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - step;
      else if (event.key === "PageUp") next = current + c.large;
      else if (event.key === "PageDown") next = current - c.large;
      else if (event.key === "Home") next = lowest(index);
      else if (event.key === "End") next = highest(index);
      else return;
      event.preventDefault();
      const value = snap(index, next);
      if (value === current) {
        if (!c.reduced) {
          state.thumbs[index].pos.v += 180 * Math.sign(next - current);
          kick();
        }
        return;
      }
      const preset = c.presets.findIndex(p => p.value === value);
      if (preset >= 0) pulse(preset);
      c.emit(index, value);
      c.commit();
    },
    choose(presetIndex: number) {
      const c = cfg();
      const preset = c.presets[presetIndex];
      if (!preset || c.disabled) return;
      const toLow = Math.abs(c.values[0] - preset.value);
      const toHigh = Math.abs(c.values[1] - preset.value);
      let index = toLow < toHigh ? 0 : toHigh < toLow ? 1 : preset.value < c.values[0] ? 0 : 1;
      if (preset.value < lowest(index) || preset.value > highest(index)) index = 1 - index;
      if (preset.value < lowest(index) || preset.value > highest(index)) return;
      pulse(presetIndex);
      c.emit(index, preset.value);
      c.commit();
    },
    setVisible(visible: boolean) {
      if (visible === state.visible) return;
      state.visible = visible;
      if (!visible) {
        cancelAnimationFrame(state.frame);
        state.running = false;
        state.last = 0;
        rest();
        paint();
        return;
      }
      kick();
    },
    dispose() {
      state.disposed = true;
      cancelAnimationFrame(state.frame);
    },
  };
}

type Engine = ReturnType<typeof createEngine>;

export function LensRange({
  label = "Range",
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  minStepsBetweenThumbs = 0,
  presets = [],
  magnet = 16,
  format,
  thumbLabels,
  accent,
  name,
  disabled = false,
  className,
  style,
}: LensRangeProps) {
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const stepSize = step > 0 ? step : 1;
  const decimals = Math.max(decimalsOf(stepSize), decimalsOf(min));
  const span = max - min || 1;
  const large = largeStep ?? Math.max(stepSize, Math.round(span / 10 / stepSize) * stepSize);
  const gap = Math.max(0, minStepsBetweenThumbs) * stepSize;
  const order = (pair: readonly [number, number]): [number, number] => [clamp(Math.min(pair[0], pair[1]), min, max), clamp(Math.max(pair[0], pair[1]), min, max)];
  const [inner, setInner] = useState<[number, number]>(() => order(defaultValue ?? [min + Math.round(span / 4 / stepSize) * stepSize, max - Math.round(span / 4 / stepSize) * stepSize]));
  const values = value ? order(value) : inner;
  const [dragging, setDragging] = useState<number | null>(null);
  const [tickCount, setTickCount] = useState(41);
  const text = format ?? ((amount: number) => amount.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const marks = presets.filter(preset => preset.value >= min && preset.value <= max);

  const valuesRef = useRef(values);
  const configRef = useRef<Config | null>(null);
  const commitRef = useRef(onValueCommit);
  const changeRef = useRef(onValueChange);
  const controlledRef = useRef(value !== undefined);
  const [emit] = useState(() => (index: number, next: number) => {
    const current = valuesRef.current;
    if (current[index] === next) return;
    const pair: [number, number] = index === 0 ? [next, current[1]] : [current[0], next];
    valuesRef.current = pair;
    if (configRef.current) configRef.current.values = pair;
    if (!controlledRef.current) setInner(pair);
    changeRef.current?.(pair);
  });
  const [commit] = useState(() => () => commitRef.current?.(valuesRef.current));

  const rootRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const fillRef = useRef<HTMLSpanElement>(null);
  const knobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const markRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pointerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);

  useLayoutEffect(() => {
    valuesRef.current = values;
    commitRef.current = onValueCommit;
    changeRef.current = onValueChange;
    controlledRef.current = value !== undefined;
    configRef.current = { min, max, step: stepSize, gap, large, decimals, values, reduced, disabled, presets: marks, magnet, emit, commit };
    engineRef.current?.sync();
  });

  useLayoutEffect(() => {
    const engine = createEngine(configRef, { root: rootRef, scale: scaleRef, ticks: tickRefs, fill: fillRef, knobs: knobRefs, marks: markRefs, pills: pillRefs, texts: textRefs, pointers: pointerRefs }, setDragging);
    engineRef.current = engine;
    const scale = scaleRef.current;
    const measure = () => {
      const count = clamp(Math.round(((scale?.getBoundingClientRect().width ?? 0) - 28) / 7) + 1, 12, 121);
      setTickCount(previous => (previous === count ? previous : count));
      engine.measure();
    };
    measure();
    const resize = new ResizeObserver(measure);
    if (scale) resize.observe(scale);
    let onScreen = true;
    const visibility = () => engine.setVisible(onScreen && document.visibilityState === "visible");
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      visibility();
    });
    if (scale) intersection.observe(scale);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.measure();
  }, [min, max, tickCount]);

  const names = thumbLabels ?? [`${label}, minimum`, `${label}, maximum`];
  const bubbleTexts = [text(values[0]), text(values[1]), values[0] === values[1] ? text(values[0]) : `${text(values[0])} – ${text(values[1])}`];
  const rootStyle = { ...(accent ? { "--lr-accent": accent } : null), ...style } as CSSProperties;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} role="group" aria-label={label} data-disabled={disabled || undefined} data-dragging={dragging !== null || undefined}>
      <span className={styles.label}>{label}</span>
      <div className={styles.bubbles} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map(index => (
          <span key={index} ref={node => { pillRefs.current[index] = node; }} className={index % 3 === 1 ? styles.mid : styles.cap} />
        ))}
        <span ref={node => { pillRefs.current[6] = node; }} className={styles.bridge} />
        {[0, 1].map(index => (
          <span key={`p${index}`} ref={node => { pointerRefs.current[index] = node; }} className={styles.pointer} />
        ))}
        {bubbleTexts.map((content, index) => (
          <span key={`t${index}`} ref={node => { textRefs.current[index] = node; }} className={styles.text}>{content}</span>
        ))}
      </div>
      <div
        ref={scaleRef}
        className={styles.scale}
        onPointerDown={event => engineRef.current?.down(event)}
        onPointerMove={event => engineRef.current?.move(event)}
        onPointerUp={event => engineRef.current?.up(event)}
        onPointerCancel={event => engineRef.current?.up(event)}
        onLostPointerCapture={event => engineRef.current?.up(event)}
        onPointerLeave={() => engineRef.current?.hover(null)}
      >
        <div className={styles.ticks} aria-hidden="true">
          {Array.from({ length: tickCount }, (_, index) => (
            <span
              key={index}
              ref={node => {
                tickRefs.current[index] = node;
                if (index === tickCount - 1) tickRefs.current.length = tickCount;
              }}
              className={styles.tick}
            >
              <span className={styles.tickOn} />
            </span>
          ))}
        </div>
        <span className={styles.track} aria-hidden="true">
          <span ref={fillRef} className={styles.fill} />
          {marks.map(preset => (
            <span key={preset.value} className={styles.stop} style={{ left: `${((preset.value - min) / span) * 100}%` }} />
          ))}
        </span>
        <div className={styles.knobs}>
          {[0, 1].map(index => (
            <div
              key={index}
              ref={node => { knobRefs.current[index] = node; }}
              role="slider"
              data-index={index}
              className={styles.knob}
              tabIndex={disabled ? -1 : 0}
              aria-label={names[index]}
              aria-valuemin={index === 0 ? min : Number((values[0] + gap).toFixed(decimals))}
              aria-valuemax={index === 0 ? Number((values[1] - gap).toFixed(decimals)) : max}
              aria-valuenow={values[index]}
              aria-valuetext={text(values[index])}
              aria-orientation="horizontal"
              aria-disabled={disabled || undefined}
              onKeyDown={event => engineRef.current?.key(index, event)}
              onFocus={() => engineRef.current?.focus(index, true)}
              onBlur={() => engineRef.current?.focus(index, false)}
            >
              <span className={styles.knobFace} />
            </div>
          ))}
        </div>
      </div>
      {marks.length ? (
        <div className={styles.presets}>
          {marks.map((preset, index) => (
            <button
              key={`${preset.value}-${preset.label}`}
              ref={node => { markRefs.current[index] = node; }}
              type="button"
              className={styles.preset}
              disabled={disabled}
              onClick={() => engineRef.current?.choose(index)}
              aria-label={`${preset.label}, ${text(preset.value)}`}
            >
              <span className={styles.presetDot} aria-hidden="true" />
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      {name ? values.map((amount, index) => <input key={index} type="hidden" name={name} value={amount} disabled={disabled} />) : null}
    </div>
  );
}

export default LensRange;
