"use client";

import { useEffect, useState } from "react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { AiSpark, type AiSparkStatus } from "./ai-spark";
import styles from "./ai-spark.module.css";

const TOUR: [AiSparkStatus, number][] = [["idle", 1800], ["thinking", 2800], ["generating", 3600], ["done", 2200]];
const STATES = [
  { value: "idle", label: "Idle" },
  { value: "thinking", label: "Thinking" },
  { value: "generating", label: "Writing" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];
const SIZES = [12, 16, 20, 24, 32, 48];

export default function Demo() {
  const [status, setStatus] = useState<AiSparkStatus>("idle");
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const index = TOUR.findIndex(([name]) => name === status);
    const wait = index < 0 ? 600 : TOUR[index][1];
    const next = TOUR[(index + 1) % TOUR.length][0];
    const timer = window.setTimeout(() => setStatus(next), wait);
    return () => window.clearTimeout(timer);
  }, [playing, status]);
  return (
    <div className={styles.dDemo}>
      <div className={styles.dCard}>
        <div className={styles.dStage}>
          <AiSpark size={120} status={status} />
        </div>
        <div className={styles.dControls}>
          <SegmentedControl
            label="Spark state"
            options={STATES}
            value={status}
            onValueChange={value => {
              setPlaying(false);
              setStatus(value as AiSparkStatus);
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setPlaying(value => !value)} aria-pressed={playing}>
            {playing ? "Pause" : "Play through"}
          </Button>
        </div>
        <div className={styles.dRow}>
          <div className={styles.dReply}>
            <AiSpark variant="avatar" size={32} status={status} announce={false} />
            <AiSpark variant="pill" status={status} announce={false} />
          </div>
          <AiSpark variant="pill" tone="foreground" status={status} announce={false} />
        </div>
        <div className={styles.dSizes} role="group" aria-label="Sizes from 12 to 48 px">
          {SIZES.map(size => (
            <div key={size} className={styles.dSize}>
              <span className={styles.dSizeCell}>
                <AiSpark size={size} status={status} announce={false} />
              </span>
              <span className={styles.dSizeLabel}>{size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
