"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Sparkles } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import { TimeDial, type TimeDialCity } from "./time-dial";
import styles from "./demo.module.css";

const cities: TimeDialCity[] = [
  { id: "nyc", name: "New York", code: "NYC", offset: -240 },
  { id: "sf", name: "San Francisco", code: "SF", offset: -420 },
  { id: "lon", name: "London", code: "LON", offset: 60 },
  { id: "tyo", name: "Tokyo", code: "TYO", offset: 540 },
];
const WORK: [number, number] = [540, 1080];
const START = 21 * 60, HOME = "nyc", DAY = 1440;
const mod = (value: number, by: number) => ((value % by) + by) % by;
const atWork = (time: number) => cities.filter(city => { const local = mod(time + city.offset, DAY); return local >= WORK[0] && local < WORK[1]; }).length;

/** The quarter hour in the home city's day with the most offices at work, nearest to the current time. */
function bestOverlap(time: number, homeOffset: number) {
  const dayStart = Math.floor((time + homeOffset) / DAY) * DAY - homeOffset;
  let best = time, most = -1;
  for (let slot = dayStart; slot < dayStart + DAY; slot += 15) {
    const count = atWork(slot);
    if (count > most || (count === most && Math.abs(slot - time) < Math.abs(best - time))) { best = slot; most = count; }
  }
  return best;
}

export default function Demo() {
  const reduced = useReducedMotion();
  const [time, setTime] = useState(START);
  const [home, setHome] = useState(HOME);
  const status = `${atWork(time)} of ${cities.length} offices at work`;
  const { duration, ease, blur } = motionTokens;
  return (
    <div className={styles.demo}>
      <TimeDial cities={cities} value={time} onValueChange={setTime} homeId={home} onHomeChange={setHome} workingHours={WORK} label="Call time" />
      <div className={styles.bar}>
        <p className={styles.status}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              className={styles.statusText}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${blur.subtle}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.standard, ease: [...ease.enter] } }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant } }}
            >
              {status}
            </motion.span>
          </AnimatePresence>
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => setTime(bestOverlap(time, cities.find(city => city.id === home)!.offset))}><Sparkles aria-hidden="true" />Find overlap</button>
          <button type="button" className={styles.action} disabled={time === START && home === HOME} onClick={() => { setTime(START); setHome(HOME); }}><RotateCcw aria-hidden="true" />Reset</button>
        </div>
      </div>
    </div>
  );
}
