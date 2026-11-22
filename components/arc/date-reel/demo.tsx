"use client";

import { DateReel } from "./date-reel";
import styles from "./date-reel.module.css";

const FIXED_TODAY = new Date(2026, 8, 24);
const FIXED_DEFAULT = new Date(2026, 8, 25, 9, 0);

export default function Demo() {
  return (
    <div className={styles.demo}>
      <DateReel
        title="Send later"
        today={FIXED_TODAY}
        defaultValue={FIXED_DEFAULT}
        onConfirm={() =>
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 900);
          })
        }
      />
    </div>
  );
}
