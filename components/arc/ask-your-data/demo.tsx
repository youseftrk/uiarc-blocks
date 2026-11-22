"use client";

import { AskYourData } from "./ask-your-data";
import styles from "./ask-your-data.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <AskYourData />
      </div>
    </div>
  );
}
