"use client";

import { ContextWindow } from "./context-window";
import styles from "./context-window.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ContextWindow />
    </div>
  );
}
