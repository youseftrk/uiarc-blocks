"use client";

import { useEffect, useId, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import { WindowRange } from "./window-range";
import styles from "./window-range.module.css";

/** Daily visitors from April 1 to September 29, 2026. */
const VISITS = [
  1690, 1898, 1770, 1409, 1507, 1850, 1814, 1918, 1927, 1889, 1543, 1543, 1980, 1856,
  1895, 1981, 1988, 1477, 1602, 1961, 2080, 2062, 1906, 2008, 1693, 1655, 2067, 2060,
  2151, 2161, 2036, 1628, 1737, 2053, 2016, 2062, 2104, 2079, 1802, 1731, 2218, 2265,
  2061, 2127, 2211, 1764, 1753, 2140, 2341, 2120, 2212, 2215, 1848, 1912, 2289, 2201,
  2276, 2252, 2282, 1846, 1832, 2357, 2388, 2290, 2490, 2371, 1997, 1952, 2450, 2425,
  2430, 2493, 2574, 1940, 2020, 2399, 2508, 2446, 2450, 2477, 2084, 2113, 2418, 2643,
  2425, 2533, 2466, 1961, 2195, 2513, 2649, 2505, 2612, 2666, 2023, 2230, 2786, 2796,
  2804, 2822, 2783, 2107, 2045, 2643, 5461, 5044, 5106, 4606, 3724, 3458, 4259, 3900,
  4091, 3694, 3679, 3074, 2758, 3564, 3321, 3676, 3536, 3635, 2598, 2879, 3298, 3614,
  3445, 3491, 3322, 2644, 2642, 3452, 3246, 3547, 3524, 3537, 2763, 2614, 3307, 3652,
  3330, 3571, 3666, 2651, 2943, 3679, 3743, 3737, 3665, 3526, 2769, 2940, 3751, 3552,
  3490, 3572, 3791, 2925, 2861, 3704, 3761, 3595, 3775, 3651, 2848, 2896, 3929, 3943,
  3789, 3907, 3935, 2897, 3065, 3611, 3785, 3819, 3926, 4015, 3049, 2948, 3813, 1671,
];
const FIRST = Date.UTC(2026, 3, 1);
const DAY = 86_400_000;
const LAST = VISITS.length - 1;
const PRESETS = [7, 30, 90];
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const whole = new Intl.NumberFormat("en-US");
const TICKS = [4, 5, 6, 7, 8].map((index) => {
  const at = Date.UTC(2026, index, 1);
  return { value: Math.round((at - FIRST) / DAY), label: month.format(at) };
});

const formatDay = (index: number) => day.format(FIRST + index * DAY);
const formatSpan = (span: number) => `${span + 1} days`;

function sum(series: readonly number[], from: number, to: number) {
  let total = 0;
  for (let index = Math.max(0, from); index <= to; index += 1) total += series[index];
  return total;
}

function Count({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    if (reduced) {
      shown.current = value;
      element.textContent = whole.format(value);
      return;
    }
    const controls = animate(shown.current, value, {
      type: "spring",
      visualDuration: 0.45,
      bounce: 0,
      onUpdate: (latest) => {
        shown.current = latest;
        element.textContent = whole.format(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [reduced, value]);
  return <span ref={node} className={styles.total} />;
}

export default function Demo() {
  const id = useId();
  const [visits, setVisits] = useState(VISITS);
  const [range, setRange] = useState<[number, number]>([LAST - 29, LAST]);

  // Today is still arriving: the latest point keeps growing.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setVisits((series) => {
        const next = series.slice();
        next[LAST] = Math.max(0, next[LAST] + Math.round(Math.random() * 44 - 6));
        return next;
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  const [start, end] = range;
  const days = end - start + 1;
  const total = sum(visits, start, end);
  const hasEarlier = start - days >= 0;
  const earlier = hasEarlier ? sum(visits, start - days, start - 1) : 0;
  const change = hasEarlier && earlier > 0 ? ((total - earlier) / earlier) * 100 : 0;
  const up = change >= 0;
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.metric}>
            <span className={styles.label}>Visitors</span>
            <Count value={total} />
            {hasEarlier ? (
              <span className={styles.change} data-trend={up ? "up" : "down"}>
                <Trend size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.changeValue}>{up ? "+" : "\u2212"}{Math.abs(change).toFixed(1)}%</span>
                <span className={styles.changeLabel}>vs previous {days} days</span>
              </span>
            ) : (
              <span className={styles.change}>
                <span className={styles.changeLabel}>No earlier period to compare</span>
              </span>
            )}
          </div>
          <div className={styles.presets} role="group" aria-label="Quick ranges">
            {PRESETS.map((preset) => {
              const active = end === LAST && days === preset;
              return (
                <button key={preset} type="button" className={styles.preset} aria-pressed={active} onClick={() => setRange([LAST - preset + 1, LAST])}>
                  {active ? <motion.span className={styles.presetActive} layoutId={`${id}-preset`} transition={{ type: "spring", visualDuration: 0.2, bounce: 0 }} /> : null}
                  <span className={styles.presetText}>{preset}d</span>
                </button>
              );
            })}
          </div>
        </div>
        <WindowRange
          label="Report dates"
          data={visits}
          value={range}
          onValueChange={setRange}
          minSpan={6}
          format={formatDay}
          formatSpan={formatSpan}
          ticks={TICKS}
          height={144}
          live
        />
      </div>
    </div>
  );
}
