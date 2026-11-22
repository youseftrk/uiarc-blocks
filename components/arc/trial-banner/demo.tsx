"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { TrialBanner, type TrialBannerVariant } from "./trial-banner";
import styles from "./demo.module.css";

const VARIANTS = [
  { value: "banner", label: "Banner" },
  { value: "card", label: "Sidebar card" },
  { value: "pill", label: "Pill" },
];
const TRIALS = [
  { value: "9", label: "9 days left" },
  { value: "2", label: "2 days left" },
  { value: "0", label: "Expired" },
];

export default function Demo() {
  const [variant, setVariant] = useState<TrialBannerVariant>("banner");
  const [days, setDays] = useState("9");
  return (
    <div className={styles.demo}>
      <div className={styles.controls}>
        <SegmentedControl label="Variant" options={VARIANTS} value={variant} onValueChange={value => setVariant(value as TrialBannerVariant)} />
        <SegmentedControl label="Trial" options={TRIALS} value={days} onValueChange={setDays} />
      </div>
      <div className={styles.stage} data-variant={variant}>
        <TrialBanner variant={variant} daysLeft={Number(days)} />
      </div>
    </div>
  );
}
