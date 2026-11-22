"use client";

import { CelebrateButton } from "./celebrate-button";
import styles from "./celebrate-button.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <CelebrateButton onAction={() => new Promise((resolve) => setTimeout(resolve, 900))} pendingLabel="Publishing" successLabel="Published">
        Publish site
      </CelebrateButton>
    </div>
  );
}
