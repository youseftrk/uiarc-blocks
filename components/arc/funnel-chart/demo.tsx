"use client";

import { useId, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Switch } from "../switch/switch";
import { FunnelChart } from "./funnel-chart";
import styles from "./funnel-chart.module.css";

const segments = [
  { key: "mobile", label: "Mobile" },
  { key: "desktop", label: "Desktop" },
];

const stages = [
  { key: "visit", label: "Visited store", values: { mobile: 68420, desktop: 31580 } },
  { key: "view", label: "Viewed product", values: { mobile: 39710, desktop: 21460 } },
  { key: "cart", label: "Added to cart", values: { mobile: 9140, desktop: 7280 } },
  { key: "checkout", label: "Started checkout", values: { mobile: 4310, desktop: 4090 } },
  { key: "purchase", label: "Purchased", values: { mobile: 1540, desktop: 2050 } },
];

const deviceOptions = [
  { value: "total", label: "All" },
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
];

export default function CheckoutFunnelDemo() {
  const titleId = useId();
  const [device, setDevice] = useState("total");
  const [split, setSplit] = useState(false);
  const [flow, setFlow] = useState(true);

  const effectiveView = split ? "split" : device;

  const first =
    device === "mobile"
      ? stages[0].values.mobile
      : device === "desktop"
        ? stages[0].values.desktop
        : stages[0].values.mobile + stages[0].values.desktop;
  const last =
    device === "mobile"
      ? stages[stages.length - 1].values.mobile
      : device === "desktop"
        ? stages[stages.length - 1].values.desktop
        : stages[stages.length - 1].values.mobile + stages[stages.length - 1].values.desktop;
  const conv = first > 0 ? ((last / first) * 100).toFixed(1) : "0.0";

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            Checkout funnel
          </h3>
          <p className={styles.meta}>Last 30 days, {conv}% convert</p>
        </div>

        <div className={styles.controls}>
          <SegmentedControl
            options={deviceOptions}
            value={device}
            onValueChange={(next) => {
              setDevice(next);
              if (next !== "total") setSplit(false);
            }}
            label="Device"
          />
          <div className={styles.switches}>
            <Switch
              label="Split"
              aria-label="Split"
              checked={split}
              onCheckedChange={(checked) => {
                setSplit(checked);
                if (checked) setDevice("total");
              }}
            />
            <Switch
              label="Flow"
              aria-label="Flow"
              checked={flow}
              onCheckedChange={setFlow}
            />
          </div>
        </div>
      </div>

      <FunnelChart
        stages={stages}
        segments={segments}
        view={effectiveView}
        flow={flow}
        label="Checkout funnel, last 30 days"
        unit="sessions"
      />
    </section>
  );
}
