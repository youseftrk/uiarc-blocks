"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  DotMatrixLoader,
  type DotMatrixState,
  type DotMatrixVariant,
} from "./dot-matrix-loader";
import styles from "./dot-matrix-loader.module.css";

const VARIANTS: ReadonlyArray<{ id: DotMatrixVariant; name: string }> = [
  { id: "wave", name: "Wave" },
  { id: "spiral", name: "Spiral" },
  { id: "rain", name: "Rain" },
  { id: "ripple", name: "Ripple" },
  { id: "snake", name: "Snake" },
  { id: "scan", name: "Scan" },
];

type DemoMode = "loading" | "progress" | "success" | "error";

export default function DotMatrixLoaderDemo() {
  const [mode, setMode] = useState<DemoMode>("loading");
  const [progress, setProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    if (mode !== "progress") return;
    let frame = 0;
    const start = performance.now();
    const duration = 3200;

    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, replayKey]);

  const loaderState: DotMatrixState =
    mode === "success" ? "success" : mode === "error" ? "error" : "loading";

  const handleMode = (next: DemoMode) => {
    setMode(next);
    if (next === "progress") {
      setProgress(0);
      setReplayKey((k) => k + 1);
    }
  };

  const handleReplay = () => {
    if (mode === "progress") {
      setProgress(0);
      setReplayKey((k) => k + 1);
    } else if (mode === "success" || mode === "error") {
      const target = mode;
      setMode("loading");
      window.setTimeout(() => setMode(target), 260);
    } else {
      setReplayKey((k) => k + 1);
    }
  };

  const caption =
    mode === "loading"
      ? "Waiting for size"
      : mode === "progress"
        ? `Uploading · ${Math.round(progress * 100)}%`
        : mode === "success"
          ? "Upload complete"
          : "Upload failed";

  return (
    <div className={styles.demo}>
      <div className={styles.bar}>
        <div
          className={styles.segment}
          role="group"
          aria-label="Loader state"
        >
          {(
            [
              ["loading", "Loading"],
              ["progress", "Progress"],
              ["success", "Success"],
              ["error", "Error"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={styles.segBtn}
              aria-pressed={mode === id}
              onClick={() => handleMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.ghost}
          onClick={handleReplay}
        >
          <RotateCcw size={13} aria-hidden="true" />
          Replay
        </button>
      </div>

      <div className={styles.frame}>
        <ul className={styles.grid}>
          {VARIANTS.map((v, i) => (
            <li key={v.id} className={styles.cell}>
              <DotMatrixLoader
                variant={v.id}
                state={loaderState}
                progress={mode === "progress" ? progress : undefined}
                size={64}
                decorative={i > 0}
                label="Uploading file"
                successLabel="Upload complete"
                errorLabel="Upload failed"
              />
              <span className={styles.name}>{v.name}</span>
            </li>
          ))}
        </ul>
        <div className={styles.caption}>{caption}</div>
      </div>
    </div>
  );
}
