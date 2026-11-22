"use client";

import { useId, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { RadarChart, type RadarChartAxis, type RadarChartSeries } from "./radar-chart";
import styles from "./radar-chart.module.css";

const AXES: RadarChartAxis[] = [
  { key: "talent", label: "Talent pool" },
  { key: "afford", label: "Affordability" },
  { key: "transit", label: "Transit" },
  { key: "timezone", label: "Time zone fit" },
  { key: "life", label: "Quality of life" },
  { key: "tax", label: "Tax climate" },
];

const CITIES: Record<string, RadarChartSeries> = {
  lisbon: { key: "lisbon", label: "Lisbon", values: { talent: 64, afford: 78, transit: 71, timezone: 88, life: 86, tax: 66 } },
  berlin: { key: "berlin", label: "Berlin", values: { talent: 86, afford: 58, transit: 92, timezone: 80, life: 78, tax: 46 } },
  toronto: { key: "toronto", label: "Toronto", values: { talent: 81, afford: 42, transit: 64, timezone: 72, life: 82, tax: 55 } },
  austin: { key: "austin", label: "Austin", values: { talent: 74, afford: 54, transit: 26, timezone: 60, life: 71, tax: 84 } },
};

const OPTIONS = [
  { value: "berlin", label: "Berlin" },
  { value: "toronto", label: "Toronto" },
  { value: "austin", label: "Austin" },
];

export default function Demo() {
  const titleId = useId();
  const [city, setCity] = useState("berlin");
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>Lisbon compared with</h3>
          <p className={styles.meta}>Second office shortlist, scored out of 100</p>
        </div>
        <SegmentedControl label="Compare with" options={OPTIONS} value={city} onValueChange={setCity} />
      </div>
      <RadarChart axes={AXES} series={[CITIES.lisbon, CITIES[city]]} label={`Office locations, Lisbon and ${CITIES[city].label}`} />
    </section>
  );
}
