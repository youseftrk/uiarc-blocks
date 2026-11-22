"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { SankeyFlow } from "./sankey-flow";
import type { SankeyLink, SankeyNode } from "./sankey-flow";
import styles from "./sankey-flow.module.css";

const NODES: SankeyNode[] = [
  { id: "organic", label: "Organic", column: 0 },
  { id: "paid", label: "Paid", column: 0 },
  { id: "referral", label: "Referral", column: 0 },
  { id: "activated", label: "Activated", column: 1 },
  { id: "inactive", label: "Not activated", column: 1 },
  { id: "free", label: "Free", column: 2 },
  { id: "pro", label: "Pro", column: 2 },
  { id: "team", label: "Team", column: 2 },
  { id: "retained", label: "Retained", column: 3 },
  { id: "churned", label: "Churned", column: 3 },
];

const QUARTERS: Record<
  "q2" | "q3",
  { meta: string; links: SankeyLink[] }
> = {
  q2: {
    meta: "9,400 signups, Apr to Jun 2026",
    links: [
      { source: "organic", target: "activated", value: 2820 },
      { source: "organic", target: "inactive", value: 1580 },
      { source: "paid", target: "activated", value: 1620 },
      { source: "paid", target: "inactive", value: 1680 },
      { source: "referral", target: "activated", value: 1210 },
      { source: "referral", target: "inactive", value: 490 },
      { source: "activated", target: "free", value: 3250 },
      { source: "activated", target: "pro", value: 1780 },
      { source: "activated", target: "team", value: 620 },
      { source: "free", target: "retained", value: 1940 },
      { source: "free", target: "churned", value: 1310 },
      { source: "pro", target: "retained", value: 1410 },
      { source: "pro", target: "churned", value: 370 },
      { source: "team", target: "retained", value: 540 },
      { source: "team", target: "churned", value: 80 },
    ],
  },
  q3: {
    meta: "11,200 signups, Jul to Sep 2026",
    links: [
      { source: "organic", target: "activated", value: 3380 },
      { source: "organic", target: "inactive", value: 1820 },
      { source: "paid", target: "activated", value: 2080 },
      { source: "paid", target: "inactive", value: 1820 },
      { source: "referral", target: "activated", value: 1550 },
      { source: "referral", target: "inactive", value: 550 },
      { source: "activated", target: "free", value: 3860 },
      { source: "activated", target: "pro", value: 2310 },
      { source: "activated", target: "team", value: 840 },
      { source: "free", target: "retained", value: 2290 },
      { source: "free", target: "churned", value: 1570 },
      { source: "pro", target: "retained", value: 1840 },
      { source: "pro", target: "churned", value: 470 },
      { source: "team", target: "retained", value: 740 },
      { source: "team", target: "churned", value: 100 },
    ],
  },
};

export default function SankeyFlowDemo() {
  const [quarter, setQuarter] = useState<"q2" | "q3">("q3");
  const current = QUARTERS[quarter];

  return (
    <section className={styles.card}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 className={styles.title}>Signup journey</h3>
          <p className={styles.meta}>{current.meta}</p>
        </div>
        <SegmentedControl
          label="Quarter"
          value={quarter}
          onValueChange={(v) => setQuarter(v as "q2" | "q3")}
          options={[
            { value: "q2", label: "Q2" },
            { value: "q3", label: "Q3" },
          ]}
        />
      </div>

      <SankeyFlow
        nodes={NODES}
        links={current.links}
        label="Signup journey"
        columns={["Source", "Activation", "Plan", "90 days"]}
        unit="people"
        totalLabel="signups"
      />
    </section>
  );
}
