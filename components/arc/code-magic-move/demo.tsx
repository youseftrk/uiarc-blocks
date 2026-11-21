"use client";

import { CodeMagicMove } from "./code-magic-move";
import styles from "./code-magic-move.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <CodeMagicMove label="Building a save button" />
    </div>
  );
}
