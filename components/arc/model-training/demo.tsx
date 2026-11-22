"use client";

import { ModelTraining } from "./model-training";
import styles from "./model-training.module.css";

export default function ModelTrainingDemo() {
  return (
    <div className={styles.demo}>
      <ModelTraining />
    </div>
  );
}
