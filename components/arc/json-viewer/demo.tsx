"use client";

import { JsonViewer } from "./json-viewer";

const PAYLOAD = {
  id: "evt_01J9Z4K",
  type: "invoice.paid",
  amount: 4900,
  currency: "usd",
  customer: { id: "cus_9821", name: "Acme Studio", plan: "Pro" },
  items: [{ sku: "arc-pro-seat", qty: 4 }],
};

export default function WebhookPayload() {
  return (
    <JsonViewer
      data={PAYLOAD}
      rootName="event"
      defaultExpandDepth={2}
      maxHeight={360}
    />
  );
}
