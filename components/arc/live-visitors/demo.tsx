"use client";

import { LiveVisitors } from "./live-visitors";
import styles from "./live-visitors.module.css";

export default function LiveVisitorsDemo() {
  return (
    <div className={styles.demo}>
      <LiveVisitors />
    </div>
  );
}
