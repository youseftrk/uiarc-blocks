"use client";

import { AgentTimeline } from "./agent-timeline";
import styles from "./agent-timeline.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <AgentTimeline />
    </div>
  );
}
