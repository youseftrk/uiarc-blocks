"use client";

import { TypewriterTerminal } from "./typewriter-terminal";
import styles from "./demo.module.css";

export default function Demo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <TypewriterTerminal />
    </div>
  );
}
