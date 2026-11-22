"use client";

import { useCallback, useRef, useState } from "react";
import { ReplyDraft } from "./reply-draft";
import { simulateReplyDraft } from "./reply-draft-data";
import type { ReplyDraftRequest } from "./reply-draft-data";
import styles from "./reply-draft.module.css";

export default function ReplyDraftDemo() {
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(false);

  const toggleFail = () => {
    setFailNext((prev) => {
      const next = !prev;
      failNextRef.current = next;
      return next;
    });
  };

  const generate = useCallback(async (req: ReplyDraftRequest) => {
    if (failNextRef.current) {
      failNextRef.current = false;
      setFailNext(false);
      await new Promise<void>((r) => window.setTimeout(r, 260));
      throw new Error("The model timed out before completing the draft.");
    }
    return simulateReplyDraft(req);
  }, []);

  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={failNext}
          onClick={toggleFail}
        >
          {failNext ? "Next draft will fail" : "Fail the next draft"}
        </button>
      </div>
      <ReplyDraft generate={generate} autoPlay />
    </div>
  );
}
