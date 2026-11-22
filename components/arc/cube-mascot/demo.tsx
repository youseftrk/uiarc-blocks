"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { CubeMascot, type CubeStatus } from "./cube-mascot";
import styles from "./cube-mascot.module.css";

const STATES = [
  { value: "idle", label: "Idle" },
  { value: "thinking", label: "Thinking" },
  { value: "writing", label: "Writing" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];
const CAPTIONS: Record<CubeStatus, string> = {
  idle: "Ask Atlas anything",
  thinking: "Thinking",
  writing: "Writing the release notes",
  done: "Release notes ready, 312 words",
  error: "Could not reach the repository",
};
const SIZES = [24, 32, 40, 64];

export default function Demo() {
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<CubeStatus>("idle");
  const [playing, setPlaying] = useState(true);
  const busy = status === "thinking" || status === "writing";

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.stage}>
          <CubeMascot status={playing ? undefined : status} onStatusChange={setStatus} size={160} name="Atlas" announce />
        </div>
        <div className={styles.inline}>
          <CubeMascot status={status} size={24} name="Atlas" />
          <span className={styles.caption}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                className={styles.lineText}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 2 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] } }}
                exit={{ opacity: 0, transition: { duration: 0.11 } }}
              >
                {busy ? <TextShimmer>{CAPTIONS[status]}</TextShimmer> : CAPTIONS[status]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <div className={styles.sizes} aria-label="Sizes">
          {SIZES.map((size) => (
            <div key={size} className={styles.size}>
              <div className={styles.sizeBox}><CubeMascot status={status} size={size} name="Atlas" /></div>
              <span className={styles.sizeLabel}>{size}</span>
            </div>
          ))}
        </div>
        <div className={styles.controls}>
          <SegmentedControl label="Cube state" options={STATES} value={status} onValueChange={(value) => { setPlaying(false); setStatus(value as CubeStatus); }} />
          <Button variant="ghost" size="sm" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            <span className={styles.playText}>{playing ? "Pause" : "Play"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
