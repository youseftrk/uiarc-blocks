"use client";

import { MultiRegionFailover } from "./multi-region-failover";
import styles from "./multi-region-failover.module.css";

export default function MultiRegionFailoverDemo() {
  return (
    <div className={styles.demo}>
      <MultiRegionFailover />
    </div>
  );
}
