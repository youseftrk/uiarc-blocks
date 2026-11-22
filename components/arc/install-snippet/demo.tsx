"use client";

import { InstallSnippet } from "./install-snippet";
import styles from "./install-snippet.module.css";

export default function InstallSnippetDemo() {
  return (
    <div className={styles.demo}>
      <InstallSnippet />
    </div>
  );
}
