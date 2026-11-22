"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AnimatePresence, MotionConfig, animate, motion, motionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { Check } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./activity-rings.module.css";

export interface ActivityRingsMetric {
  id: string;
  label: string;
  unit: string;
  goal: number;
  color?: string;
}

export interface ActivityRingsDay {
  id: string;
  label: string;
  short: string;
  values: Record<string, number>;
}

export interface ActivityRingsProps {
  /** One ring per metric, from the outside in. */
  metrics: ActivityRingsMetric[];
  /** Days with values keyed by metric id. */
  days: ActivityRingsDay[];
  day?: string;
  defaultDay?: string;
  onDayChange?: (day: string) => void;
  focused?: string | null;
  defaultFocused?: string | null;
  onFocusedChange?: (metric: string | null) => void;
  onRingClose?: (metric: string, day: string) => void;
  label?: string;
  className?: string;
}

const COLORS = ["oklch(60% .17 275)", "oklch(75% .15 68)", "oklch(66% .09 160)"];
const SIZE = 220;
const CENTER = SIZE / 2;
const TICK_COUNT = 56;
const RING_STEP = 20;
const SWEEP = { type: "spring", visualDuration: 0.9, bounce: 0 } as const;
const SLIDE = { type: "spring", visualDuration: 0.32, bounce: 0 } as const;
const SWAP = { duration: 0.15, ease: [0.16, 1, 0.3, 1] } as const;
const numberFormat = new Intl.NumberFormat("en-US");

const round = (value: number) => Math.round(value * 1000) / 1000;

function ticks(index: number) {
  const inner = 94 - RING_STEP * index;
  const outer = 105 - RING_STEP * index;
  // Inner rings carry fewer ticks so the spacing stays even, kept to a multiple of four so the quarters line up.
  const count = Math.max(8, TICK_COUNT - 12 * index);
  return Array.from({ length: count }, (_, tick) => {
    const angle = (tick / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x1: round(CENTER + inner * cos), y1: round(CENTER + inner * sin), x2: round(CENTER + outer * cos), y2: round(CENTER + outer * sin) };
  });
}

const ratio = (value: number, goal: number) => (goal > 0 ? Math.max(0, value) / goal : 0);

function Count({ value, format }: { value: MotionValue<number>; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useMotionValueEvent(value, "change", (latest) => {
    if (ref.current) ref.current.textContent = format(latest);
  });
  return <span ref={ref}>{format(value.get())}</span>;
}

interface RingProps {
  index: number;
  maskId: string;
  color: string;
  amount: MotionValue<number>;
  dimmed: boolean;
}

function Ring({ index, maskId, color, amount, dimmed }: RingProps) {
  const lines = useMemo(() => ticks(index), [index]);
  const fill = useTransform(amount, (value) => `${Math.min(1, Math.max(0, value))} 1`);
  const lap = useTransform(amount, (value) => `${Math.min(1, Math.max(0, value - 1))} 1`);
  const lapOpacity = useTransform(amount, (value) => (value > 1 ? 1 : 0));
  const rotate = `rotate(-90 ${CENTER} ${CENTER})`;
  return (
    <g className={styles.ring} data-dimmed={dimmed ? "" : undefined} style={{ "--ring": color } as CSSProperties}>
      <mask id={maskId}>
        <g transform={rotate}>
          <motion.circle cx={CENTER} cy={CENTER} r={99.5 - RING_STEP * index} fill="none" stroke="white" strokeWidth={17} pathLength={1} strokeDashoffset={0} strokeDasharray={fill} />
        </g>
      </mask>
      <g className={styles.ticksBase}>
        {lines.map((line, tick) => <line key={tick} {...line} />)}
      </g>
      <g className={styles.ticksFill} mask={`url(#${maskId})`}>
        {lines.map((line, tick) => <line key={tick} {...line} />)}
      </g>
      <g transform={rotate}>
        <motion.circle className={styles.lap} cx={CENTER} cy={CENTER} r={89 - RING_STEP * index} pathLength={1} strokeDashoffset={0} strokeDasharray={lap} style={{ opacity: lapOpacity }} />
      </g>
    </g>
  );
}

function Marker({ index, amount, dimmed }: { index: number; amount: MotionValue<number>; dimmed: boolean }) {
  const rotate = useTransform(amount, (value) => Math.max(0, value) * 360);
  const opacity = useTransform(amount, (value) => (value > 0 ? 1 : 0));
  return (
    <motion.div className={styles.markerArm} aria-hidden="true" data-dimmed={dimmed ? "" : undefined} style={{ opacity, rotate }}>
      <span className={styles.marker} style={{ top: `${((5 + RING_STEP * index) / SIZE) * 100}%`, height: `${(17 / SIZE) * 100}%` }} />
    </motion.div>
  );
}

interface TrackedMetric {
  metric: ActivityRingsMetric;
  color: string;
  value: number;
}

interface LegendRowProps {
  entry: TrackedMetric;
  amount: MotionValue<number>;
  pressed: boolean;
  dimmed: boolean;
  onToggle: () => void;
  onHover: (hovering: boolean) => void;
}

function LegendRow({ entry, amount, pressed, dimmed, onToggle, onHover }: LegendRowProps) {
  const { metric, color, value } = entry;
  const percent = Math.round(ratio(value, metric.goal) * 100);
  const met = metric.goal > 0 && value >= metric.goal;
  const metOpacity = useTransform(amount, (latest) => (latest >= 0.9995 ? 1 : 0));
  return (
    <button
      type="button"
      className={styles.legendRow}
      aria-pressed={pressed}
      data-dimmed={dimmed ? "" : undefined}
      style={{ "--ring": color } as CSSProperties}
      aria-label={`${metric.label}, ${numberFormat.format(value)} of ${numberFormat.format(metric.goal)} ${metric.unit}, ${percent} percent${met ? ", goal met" : ""}`}
      onClick={onToggle}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") onHover(true); }}
      onPointerLeave={() => onHover(false)}
    >
      <span className={styles.swatch} aria-hidden="true" />
      <span className={styles.legendText} aria-hidden="true">
        <span className={styles.legendLabel}>{metric.label}</span>
        <span className={styles.legendValue}>
          <Count value={amount} format={(latest) => numberFormat.format(Math.round(latest * metric.goal))} /> / {numberFormat.format(metric.goal)} {metric.unit}
        </span>
      </span>
      <span className={styles.legendPercent} aria-hidden="true">
        <AnimatePresence initial={false}>
          {met ? (
            <motion.span key="met" className={styles.met} style={{ opacity: metOpacity }} initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6, transition: { duration: 0 } }} transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}>
              <Check size={12} strokeWidth={2.25} aria-hidden="true" />
            </motion.span>
          ) : null}
        </AnimatePresence>
        <Count value={amount} format={(latest) => `${Math.round(latest * 100)}%`} />
      </span>
    </button>
  );
}

/** One motion value per metric id, shared by the ring, marker, legend and centre. Each change springs from what is on screen. */
function useAmounts(entries: TrackedMetric[], reduced: boolean) {
  const [store] = useState(() => new Map<string, MotionValue<number>>());
  const amounts = entries.map((entry) => {
    let amount = store.get(entry.metric.id);
    if (!amount) {
      amount = motionValue(ratio(entry.value, entry.metric.goal));
      store.set(entry.metric.id, amount);
    }
    return amount;
  });
  const signature = entries.map((entry) => `${entry.metric.id}:${ratio(entry.value, entry.metric.goal)}`).join("|");
  useEffect(() => {
    const controls = signature.split("|").filter(Boolean).map((part) => {
      const cut = part.lastIndexOf(":");
      const amount = store.get(part.slice(0, cut));
      const target = Number(part.slice(cut + 1));
      if (!amount) return null;
      if (reduced) {
        amount.set(target);
        return null;
      }
      return animate(amount, target, SWEEP);
    });
    return () => controls.forEach((control) => control?.stop());
  }, [reduced, signature, store]);
  return amounts;
}

function Total({ amounts }: { amounts: MotionValue<number>[] }) {
  const total = useTransform(amounts, (values: number[]) => (values.length ? values.reduce((sum, value) => sum + Math.min(1, Math.max(0, value)), 0) / values.length : 0));
  return <Count value={total} format={(latest) => String(Math.round(latest * 100))} />;
}

export function ActivityRings({ metrics, days, day: dayProp, defaultDay, onDayChange, focused: focusedProp, defaultFocused = null, onFocusedChange, onRingClose, label = "Activity", className }: ActivityRingsProps) {
  const reduced = useReducedMotion();
  const uid = useId();
  const [dayState, setDayState] = useState(defaultDay ?? days[days.length - 1]?.id);
  const [focusedState, setFocusedState] = useState<string | null>(defaultFocused);
  const [hovered, setHovered] = useState<string | null>(null);
  const weekRef = useRef<HTMLDivElement>(null);

  const dayId = dayProp ?? dayState;
  const current = days.find((entry) => entry.id === dayId) ?? days[days.length - 1];
  const focused = focusedProp === undefined ? focusedState : focusedProp;
  const active = metrics.some((metric) => metric.id === hovered) ? hovered : metrics.some((metric) => metric.id === focused) ? focused : null;

  const entries = useMemo<TrackedMetric[]>(
    () => metrics.map((metric, index) => ({ metric, color: metric.color ?? COLORS[index % COLORS.length], value: current?.values[metric.id] ?? 0 })),
    [current, metrics],
  );

  const previous = useRef<{ day: string | undefined; values: Record<string, number> } | null>(null);
  useEffect(() => {
    const last = previous.current;
    const values = Object.fromEntries(entries.map((entry) => [entry.metric.id, entry.value]));
    if (last && last.day === current?.id && current) {
      for (const entry of entries) {
        const before = last.values[entry.metric.id];
        if (before !== undefined && before < entry.metric.goal && entry.value >= entry.metric.goal) onRingClose?.(entry.metric.id, current.id);
      }
    }
    previous.current = { day: current?.id, values };
  }, [current, entries, onRingClose]);

  const pickDay = (id: string) => {
    if (id === current?.id) return;
    if (dayProp === undefined) setDayState(id);
    onDayChange?.(id);
  };

  const toggle = (id: string) => {
    const next = focused === id ? null : id;
    if (focusedProp === undefined) setFocusedState(next);
    onFocusedChange?.(next);
  };

  const onWeekKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = days.findIndex((entry) => entry.id === current?.id);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % days.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + days.length) % days.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = days.length - 1;
    else return;
    event.preventDefault();
    pickDay(days[next].id);
    weekRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  const amounts = useAmounts(entries, reduced);
  const summary = current ? `${current.label}: ${entries.map((entry) => `${entry.metric.label} ${Math.round(ratio(entry.value, entry.metric.goal) * 100)}%`).join(", ")}` : label;
  const activeEntry = entries.find((entry) => entry.metric.id === active);
  const activeIndex = activeEntry ? entries.indexOf(activeEntry) : -1;

  return (
    <MotionConfig reducedMotion="user">
      <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label={label}>
            <div className={styles.main}>
              <div className={styles.dial}>
                <svg className={styles.rings} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary}>
                  {entries.map((entry, index) => (
                    <Ring key={entry.metric.id} index={index} maskId={`${uid}-mask-${index}`} color={entry.color} amount={amounts[index]} dimmed={active !== null && active !== entry.metric.id} />
                  ))}
                </svg>
                {entries.map((entry, index) => (
                  <Marker key={entry.metric.id} index={index} amount={amounts[index]} dimmed={active !== null && active !== entry.metric.id} />
                ))}
                <div className={styles.center} aria-hidden="true">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={activeEntry ? activeEntry.metric.id : "__total"}
                      className={styles.centerInner}
                      initial={{ opacity: 0, filter: "blur(2px)", y: 4 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      exit={{ opacity: 0, filter: "blur(2px)", y: -4 }}
                      transition={SWAP}
                    >
                      {activeEntry ? (
                        <>
                          <span className={styles.centerValue}>
                            <Count value={amounts[activeIndex]} format={(latest) => numberFormat.format(Math.round(latest * activeEntry.metric.goal))} />
                          </span>
                          <span className={styles.centerLabel}>{activeEntry.metric.unit} {activeEntry.metric.label.toLowerCase()}</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.centerValue}>
                            <Total amounts={amounts} />
                            <span className={styles.centerUnit}>%</span>
                          </span>
                          <span className={styles.centerLabel}>of goals</span>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className={styles.legend}>
                {entries.map((entry, index) => (
                  <LegendRow
                    key={entry.metric.id}
                    entry={entry}
                    amount={amounts[index]}
                    pressed={focused === entry.metric.id}
                    dimmed={active !== null && active !== entry.metric.id}
                    onToggle={() => toggle(entry.metric.id)}
                    onHover={(hovering) => setHovered((value) => (hovering ? entry.metric.id : value === entry.metric.id ? null : value))}
                  />
                ))}
              </div>
            </div>
        <div ref={weekRef} className={styles.week} role="radiogroup" aria-label="Day" onKeyDown={onWeekKeyDown}>
          {days.map((entry) => {
            const checked = entry.id === current?.id;
            return (
              <button key={entry.id} type="button" role="radio" aria-checked={checked} aria-label={entry.label} tabIndex={checked ? 0 : -1} className={styles.day} onClick={() => pickDay(entry.id)}>
                {checked ? <motion.span className={styles.dayHighlight} layoutId={`${uid}-day`} transition={reduced ? { duration: 0 } : SLIDE} /> : null}
                <svg className={styles.mini} viewBox="0 0 32 32" aria-hidden="true">
                  {metrics.map((metric, index) => {
                    const radius = 14 - 4.5 * index;
                    if (radius <= 0) return null;
                    return (
                      <g key={metric.id} style={{ "--ring": metric.color ?? COLORS[index % COLORS.length] } as CSSProperties}>
                        <circle className={styles.miniTrack} cx={16} cy={16} r={radius} />
                        <circle className={styles.miniArc} cx={16} cy={16} r={radius} pathLength={1} strokeDasharray={`${Math.min(1, ratio(entry.values[metric.id] ?? 0, metric.goal))} 1`} />
                      </g>
                    );
                  })}
                </svg>
                <span className={styles.dayLabel}>{entry.short}</span>
              </button>
            );
          })}
        </div>
      </section>
    </MotionConfig>
  );
}

export default ActivityRings;
