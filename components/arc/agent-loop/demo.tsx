"use client";

import { AgentLoop } from "./agent-loop";
import styles from "./agent-loop.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <AgentLoop />
    </div>
  );
}
