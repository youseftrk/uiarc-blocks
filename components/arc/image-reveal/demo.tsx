"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { ImageReveal, type ImageRevealStatus } from "./image-reveal";
import { imageRevealSamples } from "./samples";
import styles from "./image-reveal.module.css";

type Mode = "live" | "queued" | "done" | "error";
const SEEDS = [48213, 70266, 62915, 31874, 85402];

export default function Demo() {
  const [mode, setMode] = useState<Mode>("live");
  const [run, setRun] = useState(0);
  const [retried, setRetried] = useState<Record<number, number>>({});
  const tiles = imageRevealSamples.slice(0, 4);
  const again = () => { setRun(run + 1); setRetried({}); if (mode !== "live") setMode("live"); };

  return (
    <div className={styles.demo}>
      <div className={styles.header}>
        <div className={styles.copy}>
          <p className={styles.prompt}>Quiet landscapes at golden hour</p>
          <p className={styles.meta}>Seed {SEEDS[run % SEEDS.length]}, 30 steps, batch of 4. Simulated.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={again}><RotateCcw aria-hidden="true" />Generate again</Button>
      </div>
      <div className={styles.grid}>
        {tiles.map((tile, index) => {
          const failing = mode === "error" && index % 2 === 1 && !retried[index];
          const fixed: ImageRevealStatus | undefined = mode === "queued" ? "queued" : mode === "done" ? "done" : failing ? "error" : undefined;
          return (
            <ImageReveal
              key={`${index}-${retried[index] ?? 0}`} className={styles.tile} src={tile.src} alt={tile.alt} size="sm" aspectRatio={1} seed={SEEDS[run % SEEDS.length] + index}
              status={fixed} runKey={`${run}-${mode === "error" ? "error" : "live"}`} loop={mode === "live"} duration={4200} queueLabel={mode === "queued" ? "Queued, 2 ahead" : "Queued"}
              onRetry={() => setRetried(current => ({ ...current, [index]: (current[index] ?? 0) + 1 }))}
            />
          );
        })}
      </div>
      <div className={styles.footer}>
        <SegmentedControl label="Generation state" value={mode} onValueChange={value => { setMode(value as Mode); setRetried({}); }}
          options={[{ value: "live", label: "Live" }, { value: "queued", label: "Queued" }, { value: "done", label: "Done" }, { value: "error", label: "Error" }]} />
      </div>
    </div>
  );
}
