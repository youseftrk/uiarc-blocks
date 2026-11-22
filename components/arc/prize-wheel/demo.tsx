"use client";

import { PrizeWheel } from "./prize-wheel";
import styles from "./prize-wheel.module.css";

export default function PrizeWheelDemo() {
  return (
    <div className={styles.demo}>
      <PrizeWheel />
    </div>
  );
}
