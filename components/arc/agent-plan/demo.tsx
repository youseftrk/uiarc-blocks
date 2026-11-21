"use client";

import { AgentPlan } from "./agent-plan";
import styles from "./agent-plan.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <AgentPlan />
    </div>
  );
}
