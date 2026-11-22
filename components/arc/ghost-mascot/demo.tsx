"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { GhostMascot, type GhostStatus } from "./ghost-mascot";
import styles from "./ghost-mascot.module.css";

const STATUS_OPTIONS: { value: GhostStatus; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "listening", label: "Listening" },
  { value: "thinking", label: "Thinking" },
  { value: "writing", label: "Writing" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];

const CAPTION_MAP: Record<GhostStatus, { text: string; active: boolean }> = {
  idle: { text: "Idle", active: false },
  listening: { text: "Listening", active: true },
  thinking: { text: "Thinking", active: true },
  writing: { text: "Writing", active: true },
  done: { text: "Done", active: false },
  error: { text: "Something went wrong", active: false },
};

export default function GhostMascotDemo() {
  const [status, setStatus] = useState<GhostStatus>("listening");
  const [autoPlay, setAutoPlay] = useState(true);

  const caption = CAPTION_MAP[status];

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.stage}>
          <GhostMascot
            status={autoPlay ? undefined : status}
            onStatusChange={setStatus}
            size={152}
            name="Atlas"
            announce
          />
        </div>

        <div className={styles.caption}>
          <span className={styles.captionText}>
            <TextShimmer active={caption.active}>{caption.text}</TextShimmer>
          </span>
        </div>

        <ul className={styles.sizes} aria-label="Sizes and tones">
          <li className={styles.size}>
            <span className={styles.slot}>
              <GhostMascot status={status} size={24} name="Atlas" />
            </span>
            <span className={styles.sizeLabel}>24</span>
          </li>
          <li className={styles.size}>
            <span className={styles.slot}>
              <GhostMascot status={status} size={40} name="Atlas" />
            </span>
            <span className={styles.sizeLabel}>40</span>
          </li>
          <li className={styles.size}>
            <span className={styles.slot}>
              <GhostMascot status={status} size={64} name="Atlas" />
            </span>
            <span className={styles.sizeLabel}>64</span>
          </li>
          <li className={styles.size}>
            <span className={styles.slot}>
              <GhostMascot status={status} size={64} tone="sheet" name="Atlas" />
            </span>
            <span className={styles.sizeLabel}>Sheet</span>
          </li>
        </ul>

        <div className={styles.controls}>
          <SegmentedControl
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={(val: string) => {
              setAutoPlay(false);
              setStatus(val as GhostStatus);
            }}
            label="Ghost mascot status"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoPlay((p) => !p)}
            aria-label={autoPlay ? "Pause autoplay" : "Play autoplay"}
          >
            {autoPlay ? <Pause size={15} /> : <Play size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
