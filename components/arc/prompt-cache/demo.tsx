"use client";

import { PromptCache } from "./prompt-cache";
import styles from "./prompt-cache.module.css";

export default function PromptCacheDemo() {
  return (
    <div className={styles.demo}>
      <PromptCache />
    </div>
  );
}
