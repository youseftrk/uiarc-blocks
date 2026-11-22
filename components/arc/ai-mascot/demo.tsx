"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../button/button";
import { motionTokens } from "../motion-tokens";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { useReducedMotion } from "../use-reduced-motion";
import { AiMascot, MASCOT_STATUSES, type MascotStatus } from "./ai-mascot";
import styles from "./ai-mascot.module.css";

const NAMES: Record<MascotStatus, string> = { idle: "Idle", listening: "Listening", thinking: "Thinking", writing: "Writing", done: "Done", error: "Error" };
const LINES: Record<MascotStatus, string> = {
  idle: "Atlas is ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing a reply",
  done: "Reply ready, 214 words",
  error: "Could not finish the reply",
};
const OPTIONS = MASCOT_STATUSES.map(value => ({ value, label: NAMES[value] }));

export default function Demo() {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<MascotStatus>("idle");
  const busy = status === "thinking" || status === "writing" || status === "listening";
  return (
    <div className={styles.dDemo}>
      <div className={styles.dCard}>
        <div className={styles.dStage}>
          <AiMascot status={playing ? undefined : status} onStatusChange={setStatus} size={148} name="Atlas" announce />
        </div>
        <div className={styles.dInline}>
          <AiMascot status={status} size={24} name="Atlas" followPointer={false} />
          <span className={styles.dLine}>
            {MASCOT_STATUSES.map(name => (
              <span key={name} className={styles.dLineSizer} aria-hidden>
                {LINES[name]}
              </span>
            ))}
            <AnimatePresence initial={false}>
              <motion.span
                key={status}
                className={styles.dLineText}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: [0.23, 1, 0.32, 1] } }}
                exit={{ opacity: 0, y: 0, transition: { duration: motionTokens.duration.instant, ease: [0.4, 0, 1, 1] } }}
              >
                {busy ? <TextShimmer>{LINES[status]}</TextShimmer> : LINES[status]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <div className={styles.dControls}>
          <SegmentedControl
            options={OPTIONS}
            value={status}
            onValueChange={value => {
              setPlaying(false);
              setStatus(value as MascotStatus);
            }}
            label="Mascot state"
          />
          <Button variant="ghost" size="sm" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
            <span className={styles.dPlayText}>{playing ? "Pause" : "Play"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
