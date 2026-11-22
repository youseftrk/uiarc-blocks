"use client";

import { MixtureOfExperts } from "./mixture-of-experts";
import styles from "./mixture-of-experts.module.css";

export default function MixtureOfExpertsDemo() {
  return (
    <div className={styles.demo}>
      <MixtureOfExperts />
    </div>
  );
}
