"use client";

import { ConnectorSetup } from "./connector-setup";
import styles from "./connector-setup.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ConnectorSetup />
    </div>
  );
}
