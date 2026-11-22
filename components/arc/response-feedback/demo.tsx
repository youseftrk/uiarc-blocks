"use client";

import { useCallback, useRef, useState } from "react";
import { Switch } from "../switch/switch";
import { ResponseFeedback } from "./response-feedback";
import type { FeedbackEvent } from "./response-feedback";
import styles from "./response-feedback.module.css";

export default function ResponseFeedbackDemo() {
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(false);

  const handleToggle = (checked: boolean) => {
    setFailNext(checked);
    failNextRef.current = checked;
  };

  const handleFeedback = useCallback(
    async (event: FeedbackEvent, { signal }: { signal: AbortSignal }) => {
      if (event.stage !== "details") return;
      await new Promise<void>((resolve, reject) => {
        const id = window.setTimeout(resolve, 280);
        signal.addEventListener("abort", () => {
          window.clearTimeout(id);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      if (failNextRef.current) {
        failNextRef.current = false;
        setFailNext(false);
        throw new Error("Could not reach feedback service.");
      }
    },
    [],
  );

  return (
    <div className={styles.demo}>
      <ResponseFeedback
        messageId="msg-orders-index"
        onFeedback={handleFeedback}
      />
      <div className={styles.controls}>
        <Switch
          label="Fail the next send"
          checked={failNext}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}
