"use client";

import { LinkUnfurl } from "./link-unfurl";
import styles from "./link-unfurl.module.css";

export default function LinkUnfurlDemo() {
  return (
    <div className={styles.demo}>
      <LinkUnfurl />
      <p className={styles.note}>
        Paste any URL or try a sample below. Click a link chip or drag a preview header up to fold it back.
      </p>
    </div>
  );
}
