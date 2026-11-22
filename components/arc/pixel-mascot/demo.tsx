"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import SegmentedControl from "../segmented-control/segmented-control";
import {
  PixelMascot,
  usePixelMascotLoop,
  type PixelMascotStatus,
} from "./pixel-mascot";
import styles from "./pixel-mascot.module.css";

type Mode = "auto" | PixelMascotStatus;

const CAPTIONS: Record<PixelMascotStatus, string> = {
  idle: "Standing by",
  thinking: "Thinking it through",
  writing: "Writing the reply",
  done: "All done",
  error: "Something went wrong",
};

const MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "idle", label: "Idle" },
  { value: "thinking", label: "Thinking" },
  { value: "writing", label: "Writing" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];

export default function PixelMascotDemo() {
  const [mode, setMode] = useState<Mode>("auto");
  const reduced = Boolean(useReducedMotion());
  const looped = usePixelMascotLoop(mode === "auto");
  const activeStatus: PixelMascotStatus = mode === "auto" ? looped : mode;

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <PixelMascot
          status={activeStatus}
          size={6}
          name="Arc"
          announce={mode !== "auto"}
        />
        <p className={styles.caption}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={activeStatus}
              className={styles.captionText}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
            >
              {CAPTIONS[activeStatus]}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>

      <SegmentedControl
        aria-label="Mascot state"
        value={mode}
        onValueChange={(v: string) => setMode(v as Mode)}
        options={MODE_OPTIONS}
      />

      <div className={styles.sizes} aria-label="Sizes">
        {[1, 2, 3, 4].map((s) => (
          <figure key={s} className={styles.size}>
            <PixelMascot
              status={activeStatus}
              size={s}
              name="Arc"
              announce={false}
            />
            <figcaption>{s}x</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
