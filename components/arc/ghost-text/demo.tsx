"use client";

import { GitPullRequest } from "lucide-react";
import { GhostText } from "./ghost-text";
import styles from "./ghost-text.module.css";

export default function GhostTextDemo() {
  return (
    <div className={styles.demo}>
      <article className={styles.card} aria-label="Pull request #4127">
        <header className={styles.cardHeader}>
          <span className={styles.prIcon} aria-hidden="true">
            <GitPullRequest size={16} strokeWidth={1.85} />
          </span>
          <div className={styles.prMeta}>
            <div className={styles.prTitleRow}>
              <h2 className={styles.prTitle}>
                Fix double charge on mid-cycle upgrades
              </h2>
              <span className={styles.prNumber}>#4127</span>
            </div>
            <div className={styles.prAuthorRow}>
              <span className={styles.avatar} aria-hidden="true">
                DK
              </span>
              <span>
                <strong>Daniel Kim</strong> wants to merge{" "}
                <code className={styles.branch}>fix/proration</code> into{" "}
                <code className={styles.branch}>main</code>
              </span>
            </div>
          </div>
        </header>

        <GhostText
          variant="plain"
          multiline
          rows={9}
          maxRows={14}
          defaultValue="Customers who upgraded mid-cycle were "
          placeholder="Describe what changed and why"
          ariaLabel="Pull request description"
          model={{ name: "Claude Haiku 5.5" }}
          notice="Simulated suggestions"
        />
      </article>
    </div>
  );
}
