"use client";

import { useId } from "react";
import { RaceBarChart } from "./race-bar-chart";
import type { RaceBarFrame, RaceBarGroup, RaceBarItem } from "./race-bar-chart";
import styles from "./race-bar-chart.module.css";

const GROUPS: RaceBarGroup[] = [
  { id: "furniture", label: "Furniture" },
  { id: "lighting", label: "Lighting" },
  { id: "textiles", label: "Textiles" },
  { id: "tableware", label: "Tableware" },
];

const ITEMS: RaceBarItem[] = [
  { id: "linen", label: "Linen throw", group: "textiles" },
  { id: "sideboard", label: "Walnut sideboard", group: "furniture" },
  { id: "mushroom", label: "Mushroom lamp", group: "lighting" },
  { id: "cups", label: "Stoneware cups", group: "tableware" },
  { id: "rug", label: "Wool rug", group: "textiles" },
  { id: "bowls", label: "Stacked bowls", group: "tableware" },
  { id: "chair", label: "Oak lounge chair", group: "furniture" },
  { id: "ceramic", label: "Ceramic lamp", group: "lighting" },
  { id: "bench", label: "Ash dining bench", group: "furniture" },
  { id: "carafe", label: "Glass carafe", group: "tableware" },
];

const FRAMES: RaceBarFrame[] = [
  {
    period: "January",
    values: { linen: 72000, sideboard: 64000, mushroom: 66000, cups: 48000, rug: 34000, bowls: 28000, chair: 14000, ceramic: 22000, bench: 19000, carafe: 12000 },
  },
  {
    period: "February",
    values: { linen: 134000, sideboard: 121000, mushroom: 128000, cups: 88000, rug: 62000, bowls: 52000, chair: 30000, ceramic: 41000, bench: 35000, carafe: 24000 },
  },
  {
    period: "March",
    values: { linen: 192000, sideboard: 178000, mushroom: 184000, cups: 126000, rug: 91000, bowls: 78000, chair: 52000, ceramic: 58000, bench: 49000, carafe: 36000 },
  },
  {
    period: "April",
    values: { linen: 248000, sideboard: 235000, mushroom: 228000, cups: 162000, rug: 118000, bowls: 104000, chair: 78000, ceramic: 75000, bench: 64000, carafe: 48000 },
  },
  {
    period: "May",
    values: { linen: 294000, sideboard: 298000, mushroom: 271000, cups: 198000, rug: 146000, bowls: 128000, chair: 118000, ceramic: 92000, bench: 81000, carafe: 62000 },
  },
  {
    period: "June",
    values: { linen: 336000, sideboard: 358000, mushroom: 312000, cups: 234000, rug: 174000, bowls: 152000, chair: 172000, ceramic: 108000, bench: 98000, carafe: 77000 },
  },
  {
    period: "July",
    values: { linen: 374000, sideboard: 412000, mushroom: 356000, cups: 272000, rug: 205000, bowls: 178000, chair: 238000, ceramic: 126000, bench: 116000, carafe: 94000 },
  },
  {
    period: "August",
    values: { linen: 412000, sideboard: 462000, mushroom: 404000, cups: 308000, rug: 236000, bowls: 204000, chair: 316000, ceramic: 145000, bench: 134000, carafe: 112000 },
  },
  {
    period: "September",
    values: { linen: 452000, sideboard: 508000, mushroom: 458000, cups: 344000, rug: 272000, bowls: 229000, chair: 398000, ceramic: 168000, bench: 155000, carafe: 131000 },
  },
  {
    period: "October",
    values: { linen: 496000, sideboard: 552000, mushroom: 518000, cups: 382000, rug: 314000, bowls: 256000, chair: 486000, ceramic: 194000, bench: 178000, carafe: 152000 },
  },
  {
    period: "November",
    values: { linen: 544000, sideboard: 594000, mushroom: 576000, cups: 424000, rug: 362000, bowls: 288000, chair: 572000, ceramic: 224000, bench: 204000, carafe: 176000 },
  },
  {
    period: "December",
    values: { linen: 598000, sideboard: 640000, mushroom: 632000, cups: 468000, rug: 416000, bowls: 322000, chair: 668000, ceramic: 256000, bench: 232000, carafe: 202000 },
  },
];

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

export default function Demo() {
  const headingId = useId();
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h3 id={headingId} className={styles.title}>
          Revenue by product
        </h3>
        <p className={styles.meta}>Year to date, 2025</p>
      </div>
      <RaceBarChart
        items={ITEMS}
        frames={FRAMES}
        groups={GROUPS}
        label="Revenue by product, year to date 2025"
        formatValue={formatCurrency}
        highlight="chair"
      />
    </section>
  );
}
