"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { ReasoningBlock } from "./reasoning-block";
import styles from "./reasoning-block.module.css";

const FINISHED_REASONING = `**Trace the duplicate charge**
The webhook handler retries on a 504 from the billing service, and each retry calls createUsageCharge again with an idempotency key built from Date.now(), so Stripe sees a brand new request instead of a repeat.

**Check the idempotency key**
The invoice line item already has a stable invoiceId and periodStart. Hashing those two values gives the same key across every retry without touching the schema.

**Verify the rollback path**
If the local ledger write fails after Stripe succeeds, the next retry will hit Stripe with the same key and receive the original charge object back, so the ledger can upsert cleanly.`;

const INTERRUPTED_REASONING = `**Trace the duplicate charge**
The webhook handler retries on a 504 from the billing service, and each retry calls createUsageCharge again with an idempotency key built from Date.now().`;

export default function Demo() {
  const [mode, setMode] = useState("live");

  return (
    <div className={styles.demo}>
      <SegmentedControl
        label="Reasoning state"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "live", label: "Live" },
          { value: "done", label: "Finished" },
          { value: "error", label: "Interrupted" },
        ]}
      />
      <div className={styles.stage}>
        {mode === "live" && <ReasoningBlock key="live" />}
        {mode === "done" && (
          <ReasoningBlock
            key="done"
            reasoning={FINISHED_REASONING}
            status="done"
            seconds={7}
            defaultOpen
          />
        )}
        {mode === "error" && (
          <ReasoningBlock
            key="error"
            reasoning={INTERRUPTED_REASONING}
            status="error"
            seconds={3}
            error="Upstream stream closed unexpectedly."
            onRetry={() => setMode("live")}
            defaultOpen
          />
        )}
      </div>
    </div>
  );
}
