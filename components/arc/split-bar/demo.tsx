"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { SplitBar, type SplitBarSegment } from "./split-bar";
import styles from "./split-bar.module.css";

const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const DATA: Record<string, SplitBarSegment[]> = {
  "7d": [
    { id: "organic", label: "Organic search", value: 41280 },
    { id: "direct", label: "Direct", value: 24630 },
    { id: "paid", label: "Paid search", value: 18940 },
    { id: "social", label: "Social", value: 9870 },
    { id: "referral", label: "Referral", value: 3120 },
    { id: "other", label: "Other", value: 1460 },
  ],
  "30d": [
    { id: "organic", label: "Organic search", value: 168420 },
    { id: "direct", label: "Direct", value: 88910 },
    { id: "paid", label: "Paid search", value: 97350 },
    { id: "social", label: "Social", value: 51240 },
    { id: "referral", label: "Referral", value: 9870 },
    { id: "other", label: "Other", value: 5310 },
  ],
  "90d": [
    { id: "organic", label: "Organic search", value: 462900 },
    { id: "direct", label: "Direct", value: 301450 },
    { id: "paid", label: "Paid search", value: 214880 },
    { id: "social", label: "Social", value: 93700 },
    { id: "referral", label: "Referral", value: 38260 },
    { id: "other", label: "Other", value: 12940 },
  ],
};

export default function Demo() {
  const [period, setPeriod] = useState("7d");
  return (
    <div className={styles.dDemo}>
      <SegmentedControl options={PERIODS} value={period} onValueChange={setPeriod} label="Period" />
      <SplitBar title="Traffic by source" description="Sessions on northwind.shop" segments={DATA[period] ?? []} unit="sessions" totalLabel="Total" />
    </div>
  );
}
