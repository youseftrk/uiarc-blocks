"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import styles from "./glass-tabbar.module.css";

export interface GlassTabBarItem {
  /** Unique value. */
  value: string;
  /** Visible label and accessible name. */
  label: string;
  /** Icon at 22px. */
  icon: ReactNode;
  /** Count shown as an accent badge on the icon. 0 or empty hides it. */
  badge?: number | string;
}

export interface GlassTabBarProps {
  items: GlassTabBarItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** A separate round glass tab beside the bar, such as search. */
  action?: GlassTabBarItem;
  compact?: boolean;
  defaultCompact?: boolean;
  onCompactChange?: (compact: boolean) => void;
  /** Scroll container to watch. Leave it out to watch the window. */
  scrollRef?: RefObject<HTMLElement | null>;
  collapseOnScroll?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const SPRING = { stiffness: 360, damping: 38, mass: 1 };
const MAX_SLOT = 78, MIN_SLOT = 56, COMPACT_SLOT = 48, BAR = 62, COMPACT_BAR = 48, PAD = 4, GAP = 10;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface TabProps {
  item: GlassTabBarItem; index: number; selected: boolean; focusable: boolean; pos: MotionValue<number>; morph: MotionValue<number>; slot: number; lensOn: boolean;
  onSelect: (value: string) => void; register: (value: string, node: HTMLButtonElement | null) => void;
}

function Tab({ item, index, selected, focusable, pos, morph, slot, lensOn, onSelect, register }: TabProps) {
  const width = useTransform(morph, p => mix(slot, COMPACT_SLOT, p));
  const height = useTransform(morph, p => mix(BAR, COMPACT_BAR, p));
  const color = useTransform(pos, x => `color-mix(in oklab, var(--glass-active) ${lensOn ? Math.round(clamp01(1 - Math.abs(x - index)) * 100) : 0}%, var(--glass-ink))`);
  const iconY = useTransform(morph, p => -8 * (1 - p));
  const labelOpacity = useTransform(morph, p => clamp01(1 - p * 2));
  const labelY = useTransform(morph, p => 5 * p);
  const labelScale = useTransform(morph, p => 1 - 0.12 * p);
  const badge = item.badge === 0 || item.badge === "" || item.badge == null ? null : item.badge;
  return (
    <motion.button
      ref={node => register(item.value, node)} className={styles.item} type="button" role="tab" aria-selected={selected} tabIndex={focusable ? 0 : -1}
      data-active={selected ? "true" : undefined} data-value={item.value} style={{ width, height, color }} onClick={() => onSelect(item.value)}
    >
      <motion.span className={styles.icon} style={{ y: iconY }}>
        {item.icon}
        {badge !== null ? <span className={styles.badge} aria-hidden="true">{badge}</span> : null}
      </motion.span>
      <motion.span className={styles.label} style={{ opacity: labelOpacity, y: labelY, scale: labelScale }}>{item.label}</motion.span>
      {badge !== null ? <span className={styles.hidden}>, {badge} new</span> : null}
    </motion.button>
  );
}

export function GlassTabBar({
  items, value: valueProp, defaultValue, onValueChange, action, compact: compactProp, defaultCompact = false, onCompactChange, scrollRef, collapseOnScroll = true, label = "Tabs", className, style,
}: GlassTabBarProps) {
  const reduced = useReducedMotion() ?? false;
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value ?? "");
  const value = valueProp ?? inner;
  const [innerCompact, setInnerCompact] = useState(defaultCompact);
  const compact = compactProp ?? innerCompact;
  const [slot, setSlot] = useState(MAX_SLOT);
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<{ id: number; startX: number; moved: boolean; onLens: boolean } | null>(null);
  const skipClick = useRef(false);
  const motionState = useRef({ last: 0, lift: 0, stretch: 0, held: false });

  const index = items.findIndex(item => item.value === value);
  const lensOn = index >= 0;
  const lastIndex = useRef(Math.max(0, index));
  const posTarget = useMotionValue(Math.max(0, index));
  const posSpring = useSpring(posTarget, SPRING);
  const morphTarget = useMotionValue(compact ? 1 : 0);
  const morphSpring = useSpring(morphTarget, SPRING);
  const pos = reduced ? posTarget : posSpring;
  const morph = reduced ? morphTarget : morphSpring;
  const lift = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);

  useEffect(() => { if (index >= 0) { lastIndex.current = index; posTarget.set(index); } }, [index, posTarget]);
  useEffect(() => { morphTarget.set(compact ? 1 : 0); }, [compact, morphTarget]);

  const select = useCallback((next: string) => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
  }, [onValueChange, valueProp]);

  const setCompact = useCallback((next: boolean) => {
    if (compactProp === undefined) setInnerCompact(next);
    onCompactChange?.(next);
  }, [compactProp, onCompactChange]);
  const compactRef = useRef(compact);
  useLayoutEffect(() => { compactRef.current = compact; });

  // Tabs share the width the nav has, from 78px down to 56px each.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const room = nav.clientWidth - PAD * 2 - (action ? GAP + BAR : 0);
      setSlot(Math.min(MAX_SLOT, Math.max(MIN_SLOT, Math.floor(room / Math.max(1, items.length)))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [action, items.length]);

  useEffect(() => {
    if (!collapseOnScroll) return;
    const target: HTMLElement | Window = scrollRef?.current ?? window;
    const read = () => (target instanceof Window ? target.scrollY : target.scrollTop);
    let last = read();
    const onScroll = () => {
      const now = read(), delta = now - last;
      if (Math.abs(delta) < 6) return;
      last = now;
      const next = delta > 0 && now > 8;
      if (next !== compactRef.current) setCompact(next);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [collapseOnScroll, scrollRef, setCompact]);

  // Speed lifts the lens off the bar: it grows, stretches along its travel, then settles back.
  useAnimationFrame((time) => {
    const state = motionState.current;
    const dt = Math.min(0.05, Math.max(0.001, (time - state.last) / 1000));
    state.last = time;
    if (reduced) { if (lift.get() !== 0) { lift.set(0); scaleX.set(1); scaleY.set(1); } return; }
    const width = mix(slot, COMPACT_SLOT, morph.get());
    const speed = Math.abs(posSpring.getVelocity()) * width;
    const liftGoal = state.held ? 1 : clamp01(speed / 420), stretchGoal = Math.min(0.2, speed / 5200);
    state.lift += (liftGoal - state.lift) * Math.min(1, dt * (liftGoal > state.lift ? 14 : 9));
    state.stretch += (stretchGoal - state.stretch) * Math.min(1, dt * 26);
    if (state.lift < 0.0005 && liftGoal === 0) state.lift = 0;
    if (state.stretch < 0.0005 && stretchGoal === 0) state.stretch = 0;
    if (lift.get() === state.lift && state.stretch === 0 && scaleX.get() === 1) return;
    lift.set(state.lift);
    scaleX.set((1 + 0.08 * state.lift) * (1 + state.stretch));
    scaleY.set((1 + 0.08 * state.lift) * (1 - state.stretch * 0.34));
  });

  const lensX = useTransform([pos, morph], ([x, p]: number[]) => PAD + x * mix(slot, COMPACT_SLOT, p));
  const lensWidth = useTransform(morph, p => mix(slot, COMPACT_SLOT, p));
  const lensHeight = useTransform(morph, p => mix(BAR, COMPACT_BAR, p) - 8);
  const barHeight = useTransform(morph, p => mix(BAR, COMPACT_BAR, p));
  const liftStyle = useTransform(lift, v => String(v));

  const all = action ? [...items, action] : items;
  const focusValue = all.some(item => item.value === value) ? value : all[0]?.value;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = all.findIndex(item => item.value === (document.activeElement as HTMLElement | null)?.dataset.value);
    if (at < 0) return;
    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % all.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + all.length) % all.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = all.length - 1;
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(all[at].value); if (compact) setCompact(false); return; }
    if (next < 0) return;
    event.preventDefault();
    select(all[next].value);
    buttons.current.get(all[next].value)?.focus();
  };

  const slotAt = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const width = mix(slot, COMPACT_SLOT, morph.get());
    return Math.min(items.length - 1, Math.max(0, (clientX - bar.getBoundingClientRect().left - PAD - width / 2) / width));
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !lensOn) return;
    const onLens = Math.round(slotAt(event.clientX)) === index;
    drag.current = { id: event.pointerId, startX: event.clientX, moved: false, onLens };
    if (onLens) motionState.current.held = true;
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId || !state.onLens) return;
    if (!state.moved && Math.abs(event.clientX - state.startX) < 5) return;
    if (!state.moved) { state.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
    posTarget.set(slotAt(event.clientX));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    motionState.current.held = false;
    if (!state || !state.moved) return;
    const nearest = Math.round(slotAt(event.clientX)), next = items[nearest];
    posTarget.set(nearest);
    if (event.type === "pointerup") { skipClick.current = false; if (next) select(next.value); skipClick.current = true; setTimeout(() => { skipClick.current = false; }, 0); }
    else posTarget.set(lastIndex.current);
  };

  const register = useCallback((key: string, node: HTMLButtonElement | null) => { if (node) buttons.current.set(key, node); else buttons.current.delete(key); }, []);
  const actionOn = !!action && value === action.value;

  return (
    <nav ref={navRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-label={label}>
      <div className={styles.group} role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown}>
        <motion.div ref={barRef} className={styles.bar} style={{ height: barHeight }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className={styles.material} aria-hidden="true" />
          <motion.span className={styles.lens} aria-hidden="true" style={{ "--lift": liftStyle, width: lensWidth, height: lensHeight, opacity: lensOn ? 1 : 0, x: lensX, scaleX, scaleY } as never} />
          {items.map((item, i) => (
            <Tab key={item.value} item={item} index={i} selected={item.value === value} focusable={item.value === focusValue} pos={pos} morph={morph} slot={slot} lensOn={lensOn} onSelect={select} register={register} />
          ))}
        </motion.div>
        {action ? (
          <motion.div className={styles.bubble} style={{ width: barHeight, height: barHeight }} data-active={actionOn ? "true" : undefined}>
            <span className={styles.material} aria-hidden="true" />
            <span className={styles.bubbleLens} aria-hidden="true" />
            <button
              ref={node => register(action.value, node)} className={styles.bubbleButton} type="button" role="tab" aria-selected={actionOn} aria-label={action.label}
              tabIndex={action.value === focusValue ? 0 : -1} data-value={action.value} onClick={() => select(action.value)}
            >
              <span className={styles.bubbleIcon}>{action.icon}</span>
            </button>
          </motion.div>
        ) : null}
      </div>
    </nav>
  );
}

export default GlassTabBar;
