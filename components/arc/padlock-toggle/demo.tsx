"use client";

import { PadlockToggle } from "./padlock-toggle";
import styles from "./demo.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <PadlockToggle label="Private project" />
    </div>
  );
}
