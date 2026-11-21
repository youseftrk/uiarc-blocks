"use client";

import { useEffect, useId, useState } from "react";
import { RealtimeStream, type RealtimeStreamPoint } from "./realtime-stream";
import styles from "./realtime-stream.module.css";

function createFeed() {
  let level = 142;
  let untilSpike = 12 + 8 * Math.random();
  let spiking = 0;
  return (t: number): RealtimeStreamPoint => {
    const drift = 18 * Math.sin(t / 9000) + 8 * Math.sin(t / 3100);
    level += (138 + drift - level) * 0.18 + (Math.random() - 0.5) * 14;
    untilSpike -= 0.5;
    if (untilSpike <= 0 && !spiking) {
      spiking = 2 + Math.floor(2 * Math.random());
      untilSpike = 15 + 10 * Math.random();
    }
    let reading = level;
    if (spiking) {
      reading = 330 + 120 * Math.random();
      spiking--;
    }
    const value = Math.round(reading);
    return { t, value, anomaly: value > 300 ? "Spike" : undefined };
  };
}

export default function Demo() {
  const titleId = useId();
  const [points, setPoints] = useState<RealtimeStreamPoint[]>([]);
  useEffect(() => {
    const feed = createFeed();
    const start = 500 * Math.floor(Date.now() / 500);
    const history = Array.from({ length: 62 }, (_, index) => feed(start - (61 - index) * 500)).map(point => ({ ...point, anomaly: undefined }));
    const timeout = window.setTimeout(() => setPoints(history), 0);
    const timer = window.setInterval(() => setPoints(previous => [...previous.slice(-160), feed(500 * Math.floor(Date.now() / 500))]), 500);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(timer);
    };
  }, []);
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <h3 id={titleId} className={styles.title}>Checkout API</h3>
        <p className={styles.meta}>p95 latency, simulated feed</p>
      </div>
      <RealtimeStream points={points} label="Checkout API p95 latency" unit="ms" interval={500} windowMs={3e4} />
    </section>
  );
}
