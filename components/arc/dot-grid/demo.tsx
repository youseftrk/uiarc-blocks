"use client";

import { useState } from "react";
import { DotGrid } from "./dot-grid";
import styles from "./dot-grid.module.css";

const DENSITIES = [
  { id: "dense", label: "Dense", gap: 14, dotSize: 1.2 },
  { id: "default", label: "Default", gap: 22, dotSize: 1.4 },
  { id: "loose", label: "Loose", gap: 30, dotSize: 1.7 },
] as const;

export default function DotGridDemo() {
  const [index, setIndex] = useState(1);
  const current = DENSITIES[index];

  return (
    <div className={styles.demo}>
      <DotGrid
        className={styles.field}
        gap={current.gap}
        dotSize={current.dotSize}
      >
        <div
          className={styles.segment}
          role="group"
          aria-label="Density"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span
            className={styles.thumb}
            aria-hidden="true"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {DENSITIES.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={index === i}
              className={styles.option}
              onClick={() => setIndex(i)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </DotGrid>
    </div>
  );
}
