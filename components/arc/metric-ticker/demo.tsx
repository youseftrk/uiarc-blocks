"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useInView } from "motion/react";
import { Button } from "../button/button";
import { MetricTicker, type TickerMetric } from "./metric-ticker";
import styles from "./metric-ticker.module.css";

interface Source { metric: Omit<TickerMetric, "value">; start: number; step: number; drift: number; min: number; max: number; round: number }

const SOURCES: Source[] = [
  { metric: { id: "mrr", label: "Monthly recurring revenue", format: { style: "currency", currency: "USD", maximumFractionDigits: 0 }, caption: "Last 24 updates, today" }, start: 84210, step: 420, drift: 0.35, min: 8e4, max: 96e3, round: 10 },
  { metric: { id: "active", label: "Active now", caption: "Signed in users, last 24 updates" }, start: 1284, step: 38, drift: 0.1, min: 1050, max: 1600, round: 1 },
  { metric: { id: "conversion", label: "Trial conversion", format: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }, delta: "absolute", caption: "Rolling 7 days" }, start: 0.184, step: 0.004, drift: 0.05, min: 0.15, max: 0.22, round: 0.001 },
  { metric: { id: "latency", label: "API p95", format: { style: "unit", unit: "millisecond", unitDisplay: "short" }, positive: "down", delta: "absolute", caption: "p95 across regions" }, start: 212, step: 9, drift: 0, min: 168, max: 260, round: 1 },
  { metric: { id: "orders", label: "Orders per minute", caption: "Checkout, all stores" }, start: 342, step: 16, drift: 0.15, min: 280, max: 420, round: 1 },
  { metric: { id: "errors", label: "Error rate", format: { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }, positive: "down", delta: "absolute", caption: "5xx responses" }, start: 0.0031, step: 4e-4, drift: -0.05, min: 0.0012, max: 0.0068, round: 1e-4 },
  { metric: { id: "churn", label: "Logo churn", format: { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }, positive: "down", delta: "absolute", caption: "Trailing 30 days" }, start: 0.0184, step: 6e-4, drift: -0.02, min: 0.012, max: 0.026, round: 1e-4 },
];

function seeded(seed: number) {
  let state = seed;
  return () => (state = (1664525 * state + 0x3c6ef35f) % 0x100000000) / 0x100000000;
}

function nextValue(source: Source, from: number, random: () => number) {
  const raw = from + (random() - 0.5 + 0.5 * source.drift) * 2 * source.step;
  return Math.round(Math.min(source.max, Math.max(source.min, raw)) / source.round) * source.round;
}

function seedHistory() {
  const random = seeded(11);
  return SOURCES.map(source => {
    const values = [source.start];
    for (let i = 0; i < 23; i++) values.unshift(nextValue({ ...source, drift: -source.drift }, values[0] ?? source.start, random));
    return values;
  });
}

export default function Demo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.2 });
  const [series, setSeries] = useState(seedHistory);
  const [streaming, setStreaming] = useState(true);
  const random = useRef(seeded(29));
  useEffect(() => {
    if (!streaming || !inView) return;
    let timer: ReturnType<typeof setTimeout>;
    const push = () => {
      if (!document.hidden) {
        const next = random.current;
        const picked = new Set(Array.from({ length: 1 + Math.floor(3 * next()) }, () => Math.floor(next() * SOURCES.length)));
        setSeries(all =>
          all.map((values, index) => {
            const source = SOURCES[index];
            if (!picked.has(index) || !source) return values;
            const from = values[values.length - 1] ?? source.start;
            const value = nextValue(source, from, next);
            return value === from ? values : [...values.slice(-23), value];
          }),
        );
      }
      timer = setTimeout(push, 900 + 700 * random.current());
    };
    timer = setTimeout(push, 700);
    return () => clearTimeout(timer);
  }, [inView, streaming]);
  const metrics = SOURCES.map((source, index) => {
    const values = series[index] ?? [source.start];
    return { ...source.metric, value: values[values.length - 1] ?? source.start, history: values };
  });
  return (
    <div ref={rootRef} className={styles.dDemo}>
      <div className={styles.dBar}>
        <p className={styles.dHeading}>Product health</p>
        <Button size="sm" variant="secondary" onClick={() => setStreaming(value => !value)}>
          {streaming ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
          {streaming ? "Pause stream" : "Resume stream"}
        </Button>
      </div>
      <MetricTicker metrics={metrics} label="Product health metrics" />
    </div>
  );
}
