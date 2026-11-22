"use client";

import { GenerationStats } from "./generation-stats";
import styles from "./generation-stats.module.css";

export default function GenerationStatsDemo() {
  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <GenerationStats />
      </div>
    </div>
  );
}
