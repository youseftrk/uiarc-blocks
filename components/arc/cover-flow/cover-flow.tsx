"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import styles from "./cover-flow.module.css";

export interface CoverFlowItem { id: string; title: string; subtitle?: string; meta?: string; image: string; imagePosition?: string; alt?: string; }
export interface CoverFlowProps<T extends CoverFlowItem = CoverFlowItem> {
  /** Cards in order. alt defaults to the title. */
  items: T[];
  /** Accessible name of the carousel. */
  label: string;
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  renderCaption?: (item: T, index: number) => ReactNode;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Share of the card width the rail travels per card, and how the side cards stack behind it. */
const STEP = .7165, STACK = .1154, DEPTH = .38, DEPTH_FAR = .14, TURN = 45;
const settle = { type: "spring", stiffness: 260, damping: 30, restDelta: .001 } as const;

function Card<T extends CoverFlowItem>({ item, index, count, position, width, reduced, active }: { item: T; index: number; count: number; position: MotionValue<number>; width: MotionValue<number>; reduced: boolean; active: boolean }) {
  const offset = useTransform(position, value => index - value);
  const transform = useTransform([offset, width], ([d, w]: number[]) => {
    const distance = Math.abs(d), near = Math.min(1, distance), far = clamp(distance - 1, 0, 1), side = Math.sign(d);
    const x = side * w * (STEP * near + STACK * Math.max(0, distance - 1));
    const z = -w * (DEPTH * near + DEPTH_FAR * far);
    const round = (value: number) => Math.round(value * 100) / 100;
    return `translate3d(${round(x)}px, 0px, ${round(z)}px) rotateY(${reduced ? 0 : round(-side * TURN * near)}deg)`;
  });
  const opacity = useTransform(offset, d => clamp((1.7 - Math.abs(d)) / .7, 0, 1));
  const visibility = useTransform(opacity, value => value <= 0 ? "hidden" : "visible");
  const zIndex = useTransform(offset, d => Math.round(100 - 10 * Math.abs(d)));
  const veil = useTransform(offset, d => { const distance = Math.abs(d); return Math.min(.58, .42 * Math.min(1, distance) + .16 * Math.max(0, distance - 1)); });
  const edge = useTransform(offset, d => .45 * Math.min(1, Math.abs(d)));
  const edgeImage = useTransform(offset, d => `linear-gradient(${d < 0 ? 90 : 270}deg, transparent 40%, oklch(0% 0 0 / .5))`);
  const reflection = useTransform(offset, d => 1 - .45 * Math.min(1, Math.abs(d)));
  const imageStyle = item.imagePosition ? { objectPosition: item.imagePosition } : undefined;
  return (
    <motion.div className={styles.card} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}: ${item.title}`} aria-hidden={!active} data-active={active ? "true" : undefined} data-index={index} style={{ transform, opacity, zIndex, visibility }}>
      <span className={styles.ambient} aria-hidden="true" />
      <motion.span className={styles.reflection} aria-hidden="true" style={{ opacity: reflection }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the mirrored copy of the cover; any image URL works. */}
        <img className={styles.image} src={item.image} alt="" draggable={false} decoding="async" style={imageStyle} />
      </motion.span>
      <span className={styles.contact} aria-hidden="true" />
      <span className={styles.face}>
        {/* eslint-disable-next-line @next/next/no-img-element -- framework-free cover image. */}
        <img className={styles.image} src={item.image} alt={active ? item.alt ?? item.title : ""} draggable={false} decoding="async" style={imageStyle} />
        <motion.span className={styles.veil} aria-hidden="true" style={{ opacity: veil }} />
        <motion.span className={styles.edge} aria-hidden="true" style={{ opacity: edge, backgroundImage: edgeImage }} />
      </span>
    </motion.div>
  );
}

function Caption({ index, position, active, children }: { index: number; position: MotionValue<number>; active: boolean; children: ReactNode }) {
  const offset = useTransform(position, value => index - value);
  const opacity = useTransform(offset, d => clamp(1 - (Math.abs(d) - .1) / .45, 0, 1));
  const transform = useTransform(offset, d => `translate3d(${Math.round(clamp(d, -1, 1) * 1800) / 100}px, 0, 0)`);
  const visibility = useTransform(opacity, value => value <= 0 ? "hidden" : "visible");
  return <motion.div className={styles.captionItem} aria-hidden={!active} style={{ opacity, transform, visibility }}>{children}</motion.div>;
}

export function CoverFlow<T extends CoverFlowItem = CoverFlowItem>({ items, label, index: controlled, defaultIndex = 0, onIndexChange, renderCaption, className }: CoverFlowProps<T>) {
  const reduced = !!useReducedMotion();
  const last = Math.max(0, items.length - 1);
  const [front, setFront] = useState(() => clamp(controlled ?? defaultIndex, 0, last));
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const position = useMotionValue(front);
  const width = useMotionValue(228);
  const sizer = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const frontRef = useRef(front);
  const changed = useRef(onIndexChange);
  useEffect(() => { changed.current = onIndexChange; });

  useEffect(() => {
    const node = sizer.current;
    if (!node) return;
    const read = () => { const next = node.getBoundingClientRect().width; if (next) width.set(next); };
    read();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [width]);

  const show = useCallback((next: number, announce: boolean) => {
    if (next === frontRef.current) return;
    frontRef.current = next;
    setFront(next);
    if (announce && items[next]) setAnnouncement(`${items[next].title}, ${next + 1} of ${items.length}`);
    changed.current?.(next);
  }, [items]);
  useMotionValueEvent(position, "change", value => show(clamp(Math.round(value), 0, last), true));

  const go = useCallback((target: number, velocity = 0) => {
    const next = clamp(Math.round(target), 0, last);
    running.current?.stop();
    running.current = reduced ? animate(position, next, { duration: 0 }) : animate(position, next, { ...settle, velocity });
  }, [last, position, reduced]);

  useEffect(() => {
    if (controlled === undefined || controlled === frontRef.current) return;
    go(controlled);
  }, [controlled, go]);
  useEffect(() => () => running.current?.stop(), []);

  const drag = useRef<{ id: number; startX: number; startPosition: number; moved: boolean; card: number | null; samples: { x: number; t: number }[] } | null>(null);
  const stepPx = () => width.get() * STEP;
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    running.current?.stop();
    drag.current = { id: event.pointerId, startX: event.clientX, startPosition: position.get(), moved: false, card: card ? Number(card.dataset.index) : null, samples: [{ x: event.clientX, t: event.timeStamp }] };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    if (!state.moved) {
      if (Math.abs(event.clientX - state.startX) < 4) return;
      state.moved = true;
      state.startX = event.clientX;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    state.samples.push({ x: event.clientX, t: event.timeStamp });
    if (state.samples.length > 6) state.samples.shift();
    if (reduced) return;
    const raw = state.startPosition - (event.clientX - state.startX) / stepPx();
    const held = clamp(raw, 0, last);
    position.set(held + (raw - held) * .3);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (!state.moved) {
      if (state.card !== null && state.card !== frontRef.current) go(state.card);
      else go(position.get());
      return;
    }
    if (reduced) {
      const travelled = event.clientX - state.startX;
      if (Math.abs(travelled) > 40) go(frontRef.current - Math.sign(travelled));
      return;
    }
    const first = state.samples[0], final = state.samples[state.samples.length - 1];
    const elapsed = final.t - first.t;
    const speed = elapsed > 0 && event.timeStamp - final.t < 80 ? -(final.x - first.x) / elapsed / stepPx() * 1000 : 0;
    const origin = Math.round(state.startPosition);
    let target = Math.round(position.get() + speed * .18);
    if (Math.abs(speed) > 1.2 && target === origin) target = origin + Math.sign(speed);
    go(target, speed);
  };

  // Sideways trackpad scrolls move the rail directly, then it settles on a card.
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined, locked = false, speed = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (reduced) {
        if (locked) return;
        locked = true;
        go(frontRef.current + Math.sign(event.deltaX));
        clearTimeout(timer);
        timer = setTimeout(() => { locked = false; }, 360);
        return;
      }
      running.current?.stop();
      const by = event.deltaX / (width.get() * STEP);
      speed = by * 60;
      const raw = position.get() + by, held = clamp(raw, 0, last);
      position.set(held + (raw - held) * .3);
      clearTimeout(timer);
      timer = setTimeout(() => go(position.get() + clamp(speed * .12, -1, 1), speed), 90);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => { node.removeEventListener("wheel", onWheel); clearTimeout(timer); };
  }, [go, last, position, reduced, width]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = event.key === "ArrowRight" ? frontRef.current + 1 : event.key === "ArrowLeft" ? frontRef.current - 1 : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    go(next);
  };
  const thumb = useTransform(position, value => `translate3d(${Math.round(clamp(value, 0, last) * 1600) / 100}px, 0, 0)`);

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-roledescription="carousel" aria-label={label} data-reduced={reduced ? "true" : undefined}>
      <div ref={stage} className={styles.stage} tabIndex={0} data-dragging={dragging ? "true" : undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
        <div ref={sizer} className={styles.sizer} aria-hidden="true" />
        {items.map((item, index) => <Card key={item.id} item={item} index={index} count={items.length} position={position} width={width} reduced={reduced} active={index === front} />)}
      </div>
      <div className={styles.footer}>
        <div className={styles.caption}>
          {items.map((item, index) => (
            <Caption key={item.id} index={index} position={position} active={index === front}>
              {renderCaption ? renderCaption(item, index) : <><p className={styles.title}>{item.title}</p>{item.subtitle && <p className={styles.subtitle}>{item.subtitle}</p>}</>}
            </Caption>
          ))}
        </div>
        <div className={styles.ticks} role="group" aria-label={`${label} position`}>
          {items.map((item, index) => <button key={item.id} className={styles.tick} type="button" aria-label={`Show ${item.title}`} aria-current={index === front ? "true" : undefined} tabIndex={-1} onClick={() => go(index)} />)}
          <motion.span className={styles.thumb} aria-hidden="true" style={{ transform: thumb }} />
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  );
}

export default CoverFlow;
