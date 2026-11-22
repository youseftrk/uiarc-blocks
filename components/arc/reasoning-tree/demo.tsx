"use client";

import { ReasoningTree } from "./reasoning-tree";
import styles from "./reasoning-tree.module.css";

export default function ReasoningTreeDemo() {
  return (
    <div className={styles.demo}>
      <ReasoningTree />
    </div>
  );
}
