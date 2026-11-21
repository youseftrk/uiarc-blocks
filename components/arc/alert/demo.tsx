"use client";

import { useState } from "react";
import { Alert } from "./alert";

export default function BillingNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) {
    return (
      <button type="button" onClick={() => setDismissed(false)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>
        Restore alert
      </button>
    );
  }
  return (
    <Alert tone="warning" title="Card expires soon" onDismiss={() => setDismissed(true)}>
      Update your payment method before March 1 to avoid interruption.
    </Alert>
  );
}
