"use client";

import { useId, useState } from "react";
import { motion } from "motion/react";
import { LensRange } from "./lens-range";
import styles from "./lens-range.module.css";

const PRESETS = [
  { value: 62_000, label: "Entry" },
  { value: 82_000, label: "Median" },
  { value: 104_000, label: "Top quarter" },
];
const PERIODS = ["Yearly", "Monthly"] as const;

/** Share of offers at or below a salary, on a normal curve around the median. */
function share(value: number) {
  const z = (value - 82_000) / 17_000 / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

const thousands = (value: number) => {
  const amount = value / 1000;
  return `€${amount < 10 ? Number(amount.toFixed(1)) : Math.round(amount)}k`;
};
const yearly = (value: number) => `€${Math.round(value / 1000)}k`;
const monthly = (value: number) => thousands(value / 12);

export default function Demo() {
  const id = useId();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Yearly");
  const [band, setBand] = useState<[number, number]>([74_000, 96_000]);
  const beats = Math.round(share(band[1]) * 100);
  const covers = Math.round((share(band[1]) - share(band[0])) * 100);

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.role}>
            <h3 className={styles.title}>Senior product designer</h3>
            <span className={styles.meta}>Berlin, full time</span>
          </div>
          <div className={styles.periods} role="group" aria-label="Show salary">
            {PERIODS.map((option) => (
              <button key={option} type="button" className={styles.period} aria-pressed={period === option} onClick={() => setPeriod(option)}>
                {period === option ? <motion.span className={styles.periodActive} layoutId={`${id}-period`} transition={{ type: "spring", visualDuration: 0.2, bounce: 0 }} /> : null}
                <span className={styles.periodText}>{option}</span>
              </button>
            ))}
          </div>
        </div>
        <LensRange
          label="Salary range"
          min={40_000}
          max={160_000}
          step={1000}
          value={band}
          onValueChange={setBand}
          presets={PRESETS}
          format={period === "Yearly" ? yearly : monthly}
          thumbLabels={["Minimum salary", "Maximum salary"]}
        />
        <p className={styles.note} aria-live="polite">
          The top of this band beats <span className={styles.figure}>{beats}%</span> of offers for this role and covers <span className={styles.figure}>{covers}%</span> of the market.
        </p>
      </div>
    </div>
  );
}
