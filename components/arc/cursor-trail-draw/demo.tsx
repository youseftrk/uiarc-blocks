"use client";

import { CursorTrailDraw } from "./cursor-trail-draw";
import styles from "./cursor-trail-draw.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <CursorTrailDraw label="Onboarding flow sketch" />
    </div>
  );
}
