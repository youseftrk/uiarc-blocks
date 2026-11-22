"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Sunburst } from "./sunburst";
import type { SunburstNode } from "./sunburst";
import styles from "./sunburst.module.css";

const SPEND_SEP: SunburstNode = {
  id: "all",
  label: "All teams",
  children: [
    {
      id: "platform",
      label: "Platform",
      children: [
        {
          id: "platform/compute",
          label: "Compute",
          children: [
            { id: "api-cluster", label: "api-cluster", value: 18910 },
            { id: "batch-workers", label: "batch-workers", value: 9420 },
            { id: "edge-proxy", label: "edge-proxy", value: 5240 },
          ],
        },
        {
          id: "platform/storage",
          label: "Storage",
          children: [
            { id: "postgres-prod", label: "postgres-prod", value: 8670 },
            { id: "object-store", label: "object-store", value: 4980 },
          ],
        },
        {
          id: "platform/network",
          label: "Network",
          children: [
            { id: "egress", label: "egress", value: 4120 },
            { id: "cdn", label: "cdn", value: 2890 },
          ],
        },
      ],
    },
    {
      id: "data",
      label: "Data",
      children: [
        {
          id: "data/warehouse",
          label: "Warehouse",
          children: [
            { id: "analytics-wh", label: "analytics-wh", value: 19400 },
            { id: "reporting-wh", label: "reporting-wh", value: 7850 },
          ],
        },
        {
          id: "data/pipelines",
          label: "Pipelines",
          children: [
            { id: "kafka-ingest", label: "kafka-ingest", value: 6420 },
            { id: "dbt-runner", label: "dbt-runner", value: 4910 },
          ],
        },
        {
          id: "data/lake",
          label: "Lake",
          children: [
            { id: "raw-events", label: "raw-events", value: 5340 },
          ],
        },
      ],
    },
    {
      id: "ml",
      label: "ML",
      children: [
        {
          id: "ml/training",
          label: "Training",
          children: [
            { id: "gpu-train", label: "gpu-train", value: 27840 },
            { id: "eval-sweep", label: "eval-sweep", value: 8160 },
          ],
        },
        {
          id: "ml/inference",
          label: "Inference",
          children: [
            { id: "embed-svc", label: "embed-svc", value: 11250 },
            { id: "rerank-svc", label: "rerank-svc", value: 6320 },
          ],
        },
      ],
    },
    {
      id: "product",
      label: "Product",
      children: [
        {
          id: "product/web",
          label: "Web",
          children: [
            { id: "ssr-nodes", label: "ssr-nodes", value: 7420 },
            { id: "preview-envs", label: "preview-envs", value: 3890 },
          ],
        },
        {
          id: "product/search",
          label: "Search",
          children: [
            { id: "index-cluster", label: "index-cluster", value: 6910 },
          ],
        },
        {
          id: "product/media",
          label: "Media",
          children: [
            { id: "transcode", label: "transcode", value: 4480 },
          ],
        },
      ],
    },
    {
      id: "security",
      label: "Security",
      children: [
        {
          id: "security/observability",
          label: "Observability",
          children: [
            { id: "siem-logs", label: "siem-logs", value: 7940 },
            { id: "audit-vault", label: "audit-vault", value: 5840 },
          ],
        },
      ],
    },
  ],
};

const SPEND_AUG: SunburstNode = {
  id: "all",
  label: "All teams",
  children: [
    {
      id: "platform",
      label: "Platform",
      children: [
        {
          id: "platform/compute",
          label: "Compute",
          children: [
            { id: "api-cluster", label: "api-cluster", value: 17100 },
            { id: "batch-workers", label: "batch-workers", value: 8640 },
            { id: "edge-proxy", label: "edge-proxy", value: 4920 },
          ],
        },
        {
          id: "platform/storage",
          label: "Storage",
          children: [
            { id: "postgres-prod", label: "postgres-prod", value: 8210 },
            { id: "object-store", label: "object-store", value: 4650 },
          ],
        },
        {
          id: "platform/network",
          label: "Network",
          children: [
            { id: "egress", label: "egress", value: 3890 },
            { id: "cdn", label: "cdn", value: 2640 },
          ],
        },
      ],
    },
    {
      id: "data",
      label: "Data",
      children: [
        {
          id: "data/warehouse",
          label: "Warehouse",
          children: [
            { id: "analytics-wh", label: "analytics-wh", value: 18120 },
            { id: "reporting-wh", label: "reporting-wh", value: 7240 },
          ],
        },
        {
          id: "data/pipelines",
          label: "Pipelines",
          children: [
            { id: "kafka-ingest", label: "kafka-ingest", value: 5980 },
            { id: "dbt-runner", label: "dbt-runner", value: 4510 },
          ],
        },
        {
          id: "data/lake",
          label: "Lake",
          children: [
            { id: "raw-events", label: "raw-events", value: 4960 },
          ],
        },
      ],
    },
    {
      id: "ml",
      label: "ML",
      children: [
        {
          id: "ml/training",
          label: "Training",
          children: [
            { id: "gpu-train", label: "gpu-train", value: 21450 },
            { id: "eval-sweep", label: "eval-sweep", value: 6820 },
          ],
        },
        {
          id: "ml/inference",
          label: "Inference",
          children: [
            { id: "embed-svc", label: "embed-svc", value: 9840 },
            { id: "rerank-svc", label: "rerank-svc", value: 5480 },
          ],
        },
      ],
    },
    {
      id: "product",
      label: "Product",
      children: [
        {
          id: "product/web",
          label: "Web",
          children: [
            { id: "ssr-nodes", label: "ssr-nodes", value: 6950 },
            { id: "preview-envs", label: "preview-envs", value: 3420 },
          ],
        },
        {
          id: "product/search",
          label: "Search",
          children: [
            { id: "index-cluster", label: "index-cluster", value: 6410 },
          ],
        },
        {
          id: "product/media",
          label: "Media",
          children: [
            { id: "transcode", label: "transcode", value: 4120 },
          ],
        },
      ],
    },
    {
      id: "security",
      label: "Security",
      children: [
        {
          id: "security/observability",
          label: "Observability",
          children: [
            { id: "siem-logs", label: "siem-logs", value: 7420 },
            { id: "audit-vault", label: "audit-vault", value: 5410 },
          ],
        },
      ],
    },
  ],
};

const formatCurrency = (v: number) => `$${(v / 1000).toFixed(1)}K`;

export default function SunburstDemo() {
  const [month, setMonth] = useState<"aug" | "sep">("sep");
  const isSep = month === "sep";

  return (
    <section className={styles.card}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 className={styles.title}>Cloud spend</h3>
          <p className={styles.meta}>
            {isSep ? "September 2026" : "August 2026"}
          </p>
        </div>
        <SegmentedControl
          label="Month"
          value={month}
          onValueChange={(v) => setMonth(v as "aug" | "sep")}
          options={[
            { value: "aug", label: "Aug" },
            { value: "sep", label: "Sep" },
          ]}
        />
      </div>

      <Sunburst
        data={isSep ? SPEND_SEP : SPEND_AUG}
        label={`Cloud spend, ${isSep ? "September" : "August"} 2026`}
        formatValue={formatCurrency}
      />
    </section>
  );
}
