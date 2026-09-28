"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SegmentedControl } from "../segmented-control";
import { motionTokens } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./line-chart.module.css";

type Range = "7d" | "30d" | "90d";
type Point = { date: Date; current: number; previous: number };

const END = Date.UTC(2026, 8, 21);
const DAY = 86_400_000;

function noise(seed: number) {
  const x = Math.sin(seed * 91.37) * 10_000;
  return x - Math.floor(x);
}

function series(days: number): Point[] {
  return Array.from({ length: days }, (_, i) => {
    const offset = days - 1 - i;
    const date = new Date(END - offset * DAY);
    const weekend = [0, 6].includes(date.getUTCDay()) ? 0.64 : 1;
    const trend = 180 + (90 - offset) * 0.9;
    return {
      date,
      current: Math.round(trend * weekend * (0.88 + noise(offset) * 0.26)),
      previous: Math.round((trend - 26) * weekend * (0.9 + noise(offset + 500) * 0.2)),
    };
  });
}

const DATA: Record<Range, Point[]> = { "7d": series(7), "30d": series(30), "90d": series(90) };
const W = 640;
const H = 220;
const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function path(points: Point[], key: "current" | "previous", max: number) {
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - (p[key] / max) * (H - 16);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LineChartDemo() {
  const [range, setRange] = useState<Range>("30d");
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const data = DATA[range];
  const max = useMemo(() => Math.max(...data.flatMap((p) => [p.current, p.previous])) * 1.1, [data]);
  const total = data.reduce((s, p) => s + p.current, 0);
  const prevTotal = data.reduce((s, p) => s + p.previous, 0);
  const change = (total - prevTotal) / prevTotal;
  const point = active === null ? null : data[active];

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (data.length - 1)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const last = data.length - 1;
    const cur = active ?? last;
    const map: Record<string, number> = {
      ArrowLeft: cur - 1,
      ArrowRight: cur + 1,
      Home: 0,
      End: last,
      PageUp: cur - 7,
      PageDown: cur + 7,
    };
    if (event.key === "Escape") setActive(null);
    if (!(event.key in map)) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, map[event.key])));
  };

  const x = point ? (active! / (data.length - 1)) * 100 : 0;
  const y = point ? 100 - (point.current / max) * ((H - 16) / H) * 100 : 0;

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div>
          <p className={styles.title}>Trial signups</p>
          <p className={styles.readout} aria-live="polite">
            {(point ? point.current : total).toLocaleString("en-US")}
          </p>
          <p className={styles.note}>
            {point
              ? `${fmtDay.format(point.date)} · ${point.previous} in the previous period`
              : `${change >= 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(1)}% vs previous ${data.length} days`}
          </p>
        </div>
        <SegmentedControl
          label="Range"
          value={range}
          onValueChange={(v) => {
            setActive(null);
            setRange(v);
          }}
          options={[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "90d", label: "90D" },
          ]}
        />
      </div>
      <div
        ref={plot}
        className={styles.plot}
        role="slider"
        tabIndex={0}
        aria-label="Explore trial signups by day"
        aria-valuemin={0}
        aria-valuemax={data.length - 1}
        aria-valuenow={active ?? data.length - 1}
        aria-valuetext={point ? `${fmtDay.format(point.date)}: ${point.current} signups` : "Latest day"}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} aria-hidden>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className={styles.grid} />
          ))}
          <AnimatePresence mode="wait" initial={false}>
            <motion.g
              key={range}
              initial={reduced ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 100% 0 0)" }}
              animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: motionTokens.duration.considered * 1.6, ease: motionTokens.ease.enter }}
            >
              <path d={path(data, "previous", max)} className={styles.previous} vectorEffect="non-scaling-stroke" />
              <path d={path(data, "current", max)} className={styles.current} vectorEffect="non-scaling-stroke" />
            </motion.g>
          </AnimatePresence>
        </svg>
        {point && (
          <>
            <span className={styles.crosshair} style={{ left: `${x}%` }} />
            <span className={styles.dot} style={{ left: `${x}%`, top: `${y}%` }} />
          </>
        )}
      </div>
      <div className={styles.axis} aria-hidden>
        <span>{fmtDay.format(data[0].date)}</span>
        <span>{fmtDay.format(data[data.length - 1].date)}</span>
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} /> This period
        </span>
        <span>
          <i className={styles.swatchDashed} /> Previous period
        </span>
      </div>
    </div>
  );
}
