"use client";

import { FeedbackMorph } from "./feedback-morph";
import styles from "./feedback-morph.module.css";

export default function FeedbackMorphDemo() {
  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <article className={styles.article}>
          <h3 className={styles.heading}>
            Deploy previews now build in about 40 seconds
          </h3>
          <p className={styles.body}>
            Every pull request gets its own preview URL. Builds reuse the
            dependency cache from main, so most previews are ready before review
            starts.
          </p>
          <p className={styles.body}>
            Previews expire 14 days after the branch merges. Pin one from the
            deployment page to keep it longer.
          </p>
        </article>

        <div className={styles.slot} data-side="bottom">
          <FeedbackMorph
            title="How do deploy previews feel?"
            onSubmit={async () => {
              await new Promise((r) => setTimeout(r, 450));
            }}
          />
        </div>
      </div>
    </div>
  );
}
