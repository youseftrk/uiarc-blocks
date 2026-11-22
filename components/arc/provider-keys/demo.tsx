"use client";

import { ProviderKeys } from "./provider-keys";
import styles from "./provider-keys.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ProviderKeys description="Your own keys, encrypted at rest and only used by this workspace." />
    </div>
  );
}
