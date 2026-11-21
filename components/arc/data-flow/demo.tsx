"use client";

import { DataFlow } from "./data-flow";
import styles from "./data-flow.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <DataFlow />
    </div>
  );
}
