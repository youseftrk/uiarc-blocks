"use client";

import { BranchGraph } from "./branch-graph";
import styles from "./branch-graph.module.css";

export default function Demo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <BranchGraph />
    </div>
  );
}
