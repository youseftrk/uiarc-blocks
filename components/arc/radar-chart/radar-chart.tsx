"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { animate, motion, useInView, useMotionValue, useSpring } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./radar-chart.module.css";

export interface RadarChartAxis {
  key: string;
  label: string;
  /** The value at the outer ring for this axis. Defaults to the chart's max. */
  max?: number;
}

export interface RadarChartSeries {
  key: string;
  label: string;
  /** One value per axis key. */
  values: Record<string, number>;
}

export interface RadarChartProps {
  axes: RadarChartAxis[];
  series: RadarChartSeries[];
  label: string;
  max?: number;
  rings?: number;
  size?: number;
  formatValue?: (value: number, axis: RadarChartAxis) => string;
  activeAxis?: string | null;
  onActiveAxisChange?: (key: string | null) => void;
  legend?: boolean;
  emptyLabel?: string;
  ref?: Ref<HTMLElement>;
  className?: string;
}

const springFrom = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }, rest = 5e-4) => {
  const frequency = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring" as const, stiffness: frequency * frequency, damping: 2 * (1 - bounce) * frequency, restDelta: rest, restSpeed: 2 * rest };
};
const MORPH = springFrom({ visualDuration: 0.6, bounce: motionTokens.spring.morph.bounce });
const FOLLOW = { stiffness: motionTokens.spring.responsive.stiffness, damping: motionTokens.spring.responsive.damping, restDelta: 0.01 };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const noop = () => () => {};

export function RadarChart({
  axes,
  series,
  label,
  max = 100,
  rings = 4,
  size = 320,
  formatValue,
  activeAxis,
  onActiveAxisChange,
  legend = true,
  emptyLabel = "No data",
  ref,
  className,
}: RadarChartProps) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reduced = !!useReducedMotion() && hydrated;
  const figureRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const shapeRefs = useRef<(SVGPathElement | null)[]>([]);
  useImperativeHandle(ref, () => figureRef.current as HTMLElement);
  const inView = useInView(figureRef, { once: true, amount: 0.35 });
  const count = axes.length;
  const shown = series.slice(0, 3);
  const empty = count < 3 || shown.length === 0;
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setWidth(stage.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const pad = width < 360 ? 46 : 64;
  const radius = Math.max(40, Math.min(size, width - 2 * pad) / 2);
  const box = 2 * radius + 2 * pad;
  const cx = box / 2;
  const cy = box / 2;
  const angle = (index: number) => (index / Math.max(1, count)) * Math.PI * 2;
  const point = useCallback(
    (index: number, ratio: number) => {
      const theta = (index / Math.max(1, count)) * Math.PI * 2;
      return { x: cx + Math.sin(theta) * radius * ratio, y: cy - Math.cos(theta) * radius * ratio };
    },
    [cx, cy, radius, count],
  );

  const ratios = Array.from({ length: 3 }, (_, slot) => (shown[slot] ? axes.map(axis => clamp((shown[slot].values[axis.key] ?? 0) / (axis.max ?? max), 0, 1)) : axes.map(() => 0)));
  const signature = `${axes.map(axis => `${axis.key}:${axis.max ?? max}`).join(",")}|${ratios.map(list => list.join(",")).join(";")}`;
  const drawnRef = useRef<number[][]>(null);
  if (drawnRef.current === null) drawnRef.current = Array.from({ length: 3 }, () => axes.map(() => 0));
  const ratiosRef = useRef(ratios);
  const grow = useMotionValue(0);

  const draw = useCallback(() => {
    const scale = grow.get();
    (drawnRef.current ?? []).forEach((list, slot) => {
      const path = shapeRefs.current[slot];
      if (!path) return;
      if (!count || list.every(value => value === 0)) return void path.setAttribute("d", "");
      const d = list.map((value, index) => {
        const p = point(index, value * scale);
        return `${index ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      }).join("") + "Z";
      path.setAttribute("d", d);
    });
  }, [grow, count, point]);
  const drawRef = useRef(draw);

  useLayoutEffect(() => {
    ratiosRef.current = ratios;
  });
  useLayoutEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw, width]);

  useEffect(() => {
    const target = ratiosRef.current;
    const from = (drawnRef.current ?? []).map((list, slot) => (list.length === count ? list.slice() : target[slot].map(() => 0)));
    if (reduced) {
      drawnRef.current = target;
      drawRef.current();
      return;
    }
    const controls = animate(0, 1, {
      ...MORPH,
      onUpdate: progress => {
        drawnRef.current = from.map((list, slot) => list.map((value, index) => value + (target[slot][index] - value) * progress));
        drawRef.current();
      },
    });
    return () => controls.stop();
  }, [signature, reduced, count]);

  useEffect(() => {
    if (empty) return;
    if (reduced) {
      grow.jump(1);
      drawRef.current();
      return;
    }
    if (!inView || grow.get() >= 1) return;
    const controls = animate(grow, 1, { ...springFrom({ visualDuration: 0.9, bounce: 0 }), onUpdate: () => drawRef.current() });
    return () => controls.stop();
  }, [empty, grow, inView, reduced]);

  const [innerActive, setInnerActive] = useState<string | null>(null);
  const activeKey = activeAxis !== undefined ? activeAxis : innerActive;
  const found = activeKey ? axes.findIndex(axis => axis.key === activeKey) : -1;
  const active = found >= 0 ? found : null;
  const [lastActive, setLastActive] = useState(active);
  if (active !== null && active !== lastActive) setLastActive(active);
  const setActive = (index: number | null) => {
    const key = index === null ? null : axes[index]?.key ?? null;
    if (activeAxis === undefined) setInnerActive(key);
    if (key !== activeKey) onActiveAxisChange?.(key);
  };
  const [focusSlot, setFocusSlot] = useState<number | null>(null);

  const mx0 = useMotionValue(0), mx1 = useMotionValue(0), mx2 = useMotionValue(0);
  const my0 = useMotionValue(0), my1 = useMotionValue(0), my2 = useMotionValue(0);
  const sx0 = useSpring(mx0, FOLLOW), sx1 = useSpring(mx1, FOLLOW), sx2 = useSpring(mx2, FOLLOW);
  const sy0 = useSpring(my0, FOLLOW), sy1 = useSpring(my1, FOLLOW), sy2 = useSpring(my2, FOLLOW);
  const markerX = [mx0, mx1, mx2], markerY = [my0, my1, my2];
  const springX = [sx0, sx1, sx2], springY = [sy0, sy1, sy2];
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipSpringX = useSpring(tipX, FOLLOW);
  const tipSpringY = useSpring(tipY, FOLLOW);
  const placed = useRef(false);

  useLayoutEffect(() => {
    if (active === null) {
      placed.current = false;
      return;
    }
    const snap = !placed.current || reduced;
    ratios.forEach((list, slot) => {
      const p = point(active, list[active] ?? 0);
      markerX[slot].set(p.x);
      markerY[slot].set(p.y);
      if (snap) {
        springX[slot].jump(p.x);
        springY[slot].jump(p.y);
      }
    });
    const tooltip = tooltipRef.current;
    const stage = stageRef.current;
    if (tooltip && stage) {
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const offset = (sw - box) / 2;
      const tip = point(active, 1);
      const sin = Math.sin(angle(active));
      const cos = -Math.cos(angle(active));
      let x: number;
      let y: number;
      if (Math.abs(sin) < 0.35) {
        x = offset + tip.x + 60;
        y = tip.y + 12 * cos - th / 2;
      } else {
        x = sin > 0 ? offset + tip.x + 2 : offset + tip.x - tw - 2;
        y = cos < 0 ? tip.y - th - 20 : tip.y + 22;
      }
      x = clamp(x, 0, Math.max(0, sw - tw));
      y = clamp(y, 0, Math.max(0, sh - th));
      tipX.set(x);
      tipY.set(y);
      if (snap) {
        tipSpringX.jump(x);
        tipSpringY.jump(y);
      }
    }
    placed.current = true;
  });

  const axisAt = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || empty) return null;
    const dx = clientX - rect.left - (rect.width - box) / 2 - cx;
    const dy = clientY - rect.top - cy;
    if (Math.hypot(dx, dy) < 0.12 * radius) return active;
    return Math.round(((Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / count)) % count;
  };
  const text = (value: number, axis: RadarChartAxis) => (formatValue ? formatValue(value, axis) : numberFormat.format(value));
  const activeAxisItem = active !== null ? axes[active] : null;
  const tipAxis = activeAxisItem ?? (lastActive !== null ? axes[lastActive] ?? null : null);
  const rows = tipAxis ? shown.map((item, slot) => ({ item, slot, value: item.values[tipAxis.key] ?? 0 })).sort((a, b) => b.value - a.value) : [];
  const best = rows[0]?.value ?? 0;
  const announcement = activeAxisItem ? `${activeAxisItem.label}. ${rows.map(row => `${row.item.label} ${text(row.value, activeAxisItem)}`).join(", ")}` : "";
  const summary = empty
    ? `${label}. ${emptyLabel}.`
    : `${label}. ${shown.map(item => `${item.label}: ${axes.map(axis => `${axis.label} ${text(item.values[axis.key] ?? 0, axis)}`).join(", ")}`).join(". ")}.`;
  const left = width ? (width - box) / 2 : 0;

  return (
    <figure ref={figureRef} className={[styles.figure, className].filter(Boolean).join(" ")} aria-label={label}>
      <div
        ref={stageRef}
        className={styles.stage}
        style={{ height: width ? box : undefined }}
        data-active={active !== null || undefined}
        data-focus={focusSlot !== null || undefined}
        role="group"
        tabIndex={empty ? -1 : 0}
        aria-roledescription="radar chart"
        aria-label={`${label}. Use arrow keys to move between measures.`}
        onPointerMove={event => {
          if (event.pointerType === "mouse" || event.buttons) setActive(axisAt(event.clientX, event.clientY));
        }}
        onPointerDown={event => {
          if (event.pointerType !== "mouse") event.currentTarget.setPointerCapture?.(event.pointerId);
          setActive(axisAt(event.clientX, event.clientY));
        }}
        onPointerUp={event => {
          if (event.pointerType !== "mouse") setActive(null);
        }}
        onPointerCancel={() => setActive(null)}
        onPointerLeave={event => {
          if (event.pointerType === "mouse") setActive(null);
        }}
        onKeyDown={event => {
          if (empty) return;
          if (event.key === "Escape" && active !== null) {
            event.preventDefault();
            setActive(null);
            return;
          }
          const current = active ?? -1;
          const moves: Record<string, number> = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current < 0 ? count - 1 : current - 1, ArrowUp: current < 0 ? count - 1 : current - 1, Home: 0, End: count - 1 };
          if (event.key in moves) {
            event.preventDefault();
            setActive((moves[event.key] + count) % count);
          }
        }}
        onBlur={() => setActive(null)}
        onFocus={event => {
          if (event.currentTarget.matches(":focus-visible") && !empty && active === null) setActive(0);
        }}
      >
        {width > 0 && (
          <>
            <svg className={styles.svg} width={box} height={box} style={{ left }} aria-hidden="true" focusable="false">
              <g className={styles.web} data-shown={inView || reduced || undefined}>
                {Array.from({ length: rings }, (_, ring) => {
                  const ratio = (ring + 1) / rings;
                  return (
                    <path
                      key={ring}
                      className={styles.ring}
                      d={axes.map((_, index) => {
                        const p = point(index, ratio);
                        return `${index ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
                      }).join("") + "Z"}
                    />
                  );
                })}
                {axes.map((axis, index) => {
                  const p = point(index, 1);
                  return <line key={axis.key} className={styles.spoke} data-on={active === index || undefined} x1={cx} y1={cy} x2={p.x} y2={p.y} />;
                })}
              </g>
              {Array.from({ length: 3 }, (_, slot) => (
                <path key={slot} ref={node => { shapeRefs.current[slot] = node; }} className={styles.shape} data-slot={slot} data-dim={(focusSlot !== null && focusSlot !== slot) || undefined} data-on={focusSlot === slot || undefined} />
              ))}
              {Array.from({ length: 3 }, (_, slot) =>
                shown[slot] ? <motion.circle key={slot} className={styles.marker} data-slot={slot} r={4.5} cx={0} cy={0} style={{ x: reduced ? markerX[slot] : springX[slot], y: reduced ? markerY[slot] : springY[slot] }} /> : null,
              )}
            </svg>
            {axes.map((axis, index) => {
              const p = point(index, 1);
              const sin = Math.sin(angle(index));
              const cos = -Math.cos(angle(index));
              const anchor = Math.abs(sin) < 0.2 ? "center" : sin > 0 ? "start" : "end";
              return (
                <span
                  key={axis.key}
                  className={styles.axisLabel}
                  data-anchor={anchor}
                  data-on={active === index || undefined}
                  style={{
                    left: left + p.x + 10 * sin,
                    top: p.y + 12 * cos,
                    translate: `${anchor === "center" ? "-50%" : anchor === "end" ? "-100%" : "0"} ${Math.abs(cos) > 0.8 ? (cos < 0 ? "-100%" : "0") : "-50%"}`,
                    maxWidth: anchor === "center" ? 120 : pad + 8,
                  }}
                  aria-hidden="true"
                >
                  {axis.label}
                </span>
              );
            })}
          </>
        )}
        <motion.div ref={tooltipRef} className={styles.tooltip} style={{ x: reduced ? tipX : tipSpringX, y: reduced ? tipY : tipSpringY }} aria-hidden="true">
          <p className={styles.tipTitle}>{tipAxis?.label ?? ""}</p>
          {rows.map(row => (
            <p key={row.item.key} className={styles.tipRow} data-slot={row.slot}>
              <span className={styles.tipKey} />
              <span className={styles.tipName}>{row.item.label}</span>
              <span className={styles.tipValue}>{tipAxis ? text(row.value, tipAxis) : ""}</span>
              <span className={styles.tipGap}>{tipAxis && row.value < best ? `−${text(best - row.value, tipAxis)}` : ""}</span>
            </p>
          ))}
        </motion.div>
        {empty && <p className={styles.message}>{emptyLabel}</p>}
      </div>
      {legend && !empty && (
        <div className={styles.legend} role="group" aria-label={`${label} profiles`} onPointerLeave={() => setFocusSlot(null)}>
          {shown.map((item, slot) => (
            <motion.button
              key={slot}
              type="button"
              layout={!reduced}
              transition={motionTokens.spring.morph}
              className={styles.key}
              data-slot={slot}
              data-dim={(focusSlot !== null && focusSlot !== slot) || undefined}
              aria-pressed={focusSlot === slot}
              onClick={() => setFocusSlot(focusSlot === slot ? null : slot)}
              onPointerEnter={event => {
                if (event.pointerType === "mouse") setFocusSlot(slot);
              }}
            >
              <motion.span layout={!reduced && "position"} transition={motionTokens.spring.morph} className={styles.keyLine} aria-hidden="true" />
              <motion.span layout={!reduced && "position"} transition={motionTokens.spring.morph} className={styles.keyLabel}>{item.label}</motion.span>
            </motion.button>
          ))}
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
      <p className={styles.srOnly}>{summary}</p>
      {!empty && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                {shown.map(item => <th key={item.key} scope="col">{item.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {axes.map(axis => (
                <tr key={axis.key}>
                  <th scope="row">{axis.label}</th>
                  {shown.map(item => <td key={item.key}>{text(item.values[axis.key] ?? 0, axis)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
