"use client";

import { Children, useCallback, useEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./gravity-well.module.css";

export interface GravityWellProps {
  /** One tile per child. */
  children: ReactNode;
  /** Fixed column count. Leave it out to fit as many columns as minTileSize allows. */
  columns?: number;
  /** Smallest tile width in px when columns is not set. */
  minTileSize?: number;
  /** Gap between tiles in px. */
  gap?: number;
  /** Reach of the well in px. */
  radius?: number;
  /** Pull strength from 0 to about 1.5. */
  strength?: number;
  /** Called when a click or key sends a shockwave, with its origin in px from the top left of the grid. */
  onPulse?: (origin: { x: number; y: number }) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Tile { el: HTMLElement; cx: number; cy: number; x: number; y: number; s: number; vx: number; vy: number; vs: number; ring: number; written: string }
interface Wave { x: number; y: number; age: number }

const WAVE_SPEED = 900, WAVE_WIDTH = 70;

export function GravityWell({ children, columns, minTileSize = 56, gap = 8, radius = 150, strength = 1, onPulse, label = "Gravity well", className, style }: GravityWellProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const sim = useRef({ tiles: [] as Tile[], waves: [] as Wave[], raf: 0, last: 0, wx: 0, wy: 0, tx: 0, ty: 0, vx: 0, vy: 0, power: 0, on: false, placed: false, cursor: -1, keyboard: false });
  const live = useRef({ radius, strength, reduced });
  useEffect(() => { live.current = { radius, strength, reduced }; });

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const state = sim.current, old = state.tiles;
    state.tiles = Array.from(root.children).map((child, i) => {
      const el = child as HTMLElement, prev = old[i];
      return { el, cx: el.offsetLeft + el.offsetWidth / 2, cy: el.offsetTop + el.offsetHeight / 2, x: prev?.x ?? 0, y: prev?.y ?? 0, s: prev?.s ?? 1, vx: prev?.vx ?? 0, vy: prev?.vy ?? 0, vs: prev?.vs ?? 0, ring: 0, written: "" };
    });
  }, []);

  const start = useCallback(() => {
    const state = sim.current;
    if (state.raf || live.current.reduced) return;
    state.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - state.last) / 1000), { radius: R, strength: K } = live.current;
      state.last = now;
      // The well follows its target on a critically damped spring.
      const w = 22;
      state.vx += (w * w * (state.tx - state.wx) - 2 * w * state.vx) * dt; state.wx += state.vx * dt;
      state.vy += (w * w * (state.ty - state.wy) - 2 * w * state.vy) * dt; state.wy += state.vy * dt;
      state.power += ((state.on ? 1 : 0) - state.power) * Math.min(1, dt * 9);
      for (const wave of state.waves) wave.age += dt;
      let reach = 0;
      for (const tile of state.tiles) reach = Math.max(reach, Math.abs(tile.cx) + Math.abs(tile.cy));
      state.waves = state.waves.filter(wave => wave.age * WAVE_SPEED < reach * 2 + WAVE_WIDTH * 3);
      let moving = state.waves.length > 0 || Math.abs(state.power - (state.on ? 1 : 0)) > 0.002 || Math.hypot(state.tx - state.wx, state.ty - state.wy) > 0.05;
      for (const tile of state.tiles) {
        const dx = state.wx - tile.cx, dy = state.wy - tile.cy, d = Math.hypot(dx, dy), power = state.power * K;
        const depth = 0.46 * Math.exp(-((d / R) ** 2)) * Math.min(1.6, power);
        const pull = 0.367 * Math.exp(-(d * d) / (2 * R * R)) * power;
        let gx = dx * pull, gy = dy * pull, gs = 1 - depth;
        for (const wave of state.waves) {
          const ox = tile.cx - wave.x, oy = tile.cy - wave.y, od = Math.hypot(ox, oy) || 1, front = wave.age * WAVE_SPEED;
          const phase = (od - front) / WAVE_WIDTH, bump = Math.exp(-phase * phase) * Math.max(0.25, 1 - front / 900);
          gx += (ox / od) * bump * 14; gy += (oy / od) * bump * 14; gs += bump * 0.1;
        }
        // Underdamped tile springs leave a jelly wake.
        const k = 210, c = 15;
        tile.vx += (k * (gx - tile.x) - c * tile.vx) * dt; tile.x += tile.vx * dt;
        tile.vy += (k * (gy - tile.y) - c * tile.vy) * dt; tile.y += tile.vy * dt;
        tile.vs += (k * (gs - tile.s) - c * tile.vs) * dt; tile.s += tile.vs * dt;
        if (Math.abs(tile.vx) + Math.abs(tile.vy) > 0.4 || Math.abs(tile.vs) > 0.004 || Math.abs(gx - tile.x) + Math.abs(gy - tile.y) > 0.05 || Math.abs(gs - tile.s) > 0.0008) moving = true;
        else { tile.x = gx; tile.y = gy; tile.s = gs; tile.vx = tile.vy = tile.vs = 0; }
        const sunk = Math.max(0, 1 - tile.s);
        const text = `${tile.x.toFixed(2)},${tile.y.toFixed(2)},${tile.s.toFixed(4)}`;
        if (text !== tile.written) {
          tile.written = text;
          tile.el.style.transform = `translate3d(${+tile.x.toFixed(2)}px, ${+tile.y.toFixed(2)}px, 0px) scale(${+tile.s.toFixed(4)})`;
          tile.el.style.opacity = String(+Math.min(1, 1 - 0.82 * sunk).toFixed(3));
          tile.el.style.zIndex = String(Math.max(1, Math.min(10, Math.ceil(10 - 20.4 * sunk))));
        }
      }
      state.raf = moving ? requestAnimationFrame(frame) : 0;
    };
    state.raf = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const state = sim.current;
    return () => { observer.disconnect(); if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; };
  }, [measure, children, columns, gap, minTileSize]);

  const place = (x: number, y: number) => {
    const state = sim.current;
    state.tx = x; state.ty = y;
    if (!state.placed || state.power < 0.02) { state.wx = x; state.wy = y; state.vx = state.vy = 0; state.placed = true; }
    state.on = true;
    start();
  };
  const markCursor = (index: number) => {
    const state = sim.current;
    state.tiles.forEach((tile, i) => { const ring = i === index && state.keyboard ? 1 : 0; if (tile.ring !== ring) { tile.ring = ring; tile.el.style.setProperty("--gravity-well-ring", String(ring)); } });
  };
  const pulse = (x: number, y: number) => {
    onPulse?.({ x, y });
    if (live.current.reduced) return;
    sim.current.waves.push({ x, y, age: 0 });
    start();
  };
  const local = (event: ReactPointerEvent<HTMLDivElement>) => { const box = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && event.buttons === 0) return;
    const state = sim.current, point = local(event);
    if (state.keyboard) { state.keyboard = false; markCursor(-1); }
    place(point.x, point.y);
  };
  const onPointerLeave = () => { const state = sim.current; if (state.keyboard) return; state.on = false; start(); };
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    pulse(event.clientX - box.left, event.clientY - box.top);
  };

  const moveCursor = (index: number) => {
    const state = sim.current, tile = state.tiles[index];
    if (!tile) return;
    state.cursor = index; state.keyboard = true;
    markCursor(index);
    place(tile.cx, tile.cy);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const state = sim.current, count = state.tiles.length;
    if (!count) return;
    const current = state.cursor < 0 ? 0 : state.cursor;
    let cols = 1;
    while (cols < count && Math.abs(state.tiles[cols].cy - state.tiles[0].cy) < 1) cols++;
    let next = -1;
    if (event.key === "ArrowRight") next = Math.min(count - 1, current + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (event.key === "ArrowDown") next = current + cols < count ? current + cols : current;
    else if (event.key === "ArrowUp") next = current - cols >= 0 ? current - cols : current;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === " " || event.key === "Enter") { event.preventDefault(); const tile = state.tiles[current]; moveCursor(current); pulse(tile.cx, tile.cy); return; }
    if (next < 0) return;
    event.preventDefault();
    moveCursor(next);
  };
  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => { if (event.currentTarget.matches(":focus-visible")) moveCursor(sim.current.cursor < 0 ? 0 : sim.current.cursor); };
  const onBlur = () => { const state = sim.current; if (!state.keyboard) return; state.keyboard = false; markCursor(-1); state.on = false; start(); };

  const rootStyle = { "--gravity-well-min": `${minTileSize}px`, gap, ...(columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : null), ...style } as CSSProperties;
  return (
    <div
      ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} role="group" aria-label={label} aria-roledescription="gravity well" tabIndex={0}
      onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={onPointerLeave} onPointerCancel={onPointerLeave} onClick={onClick} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur}
    >
      {Children.toArray(children).map((child, i) => (
        <div key={i} className={styles.tile} style={{ transform: "translate3d(0px, 0px, 0px) scale(1)", opacity: 1, zIndex: 10 }}>{child}</div>
      ))}
    </div>
  );
}

export default GravityWell;
