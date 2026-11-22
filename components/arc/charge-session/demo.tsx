"use client";

import { ChargeSession } from "./charge-session";
import styles from "./charge-session.module.css";

export default function Demo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <ChargeSession />
    </div>
  );
}
