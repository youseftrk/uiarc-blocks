"use client";

import { DnsResolution } from "./dns-resolution";
import styles from "./dns-resolution.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <DnsResolution />
    </div>
  );
}
