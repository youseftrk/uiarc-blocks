"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import styles from "./voice-orb.module.css";

export type VoiceOrbState = "idle" | "listening" | "thinking" | "speaking";

export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const simulated = 0.25 + 0.55 * Math.abs(Math.sin(frame * 0.45));
      setLevel(simulated);
    }, 120);
    return () => window.clearInterval(id);
  }, [active]);

  return active ? level : 0;
}

export interface VoiceOrbProps {
  state?: VoiceOrbState;
  level?: number;
  className?: string;
}

export function VoiceOrb({
  state = "idle",
  level = 0,
  className,
}: VoiceOrbProps) {
  const scale =
    state === "listening"
      ? 1 + level * 0.18
      : state === "speaking"
        ? 1.12
        : state === "thinking"
          ? 0.96
          : 1;

  return (
    <div className={`${styles.orbStage} ${className ?? ""}`}>
      <motion.div
        className={styles.halo}
        animate={{
          scale: state === "idle" ? 0.85 : 1 + level * 0.3,
          opacity: state === "idle" ? 0.35 : 0.85,
        }}
        transition={{ duration: 0.25 }}
      />
      <motion.div
        className={styles.orb}
        animate={{
          scale,
          rotate: state === "thinking" ? 360 : 0,
        }}
        transition={
          state === "thinking"
            ? { repeat: Infinity, duration: 2.2, ease: "linear" }
            : { type: "spring", stiffness: 260, damping: 18 }
        }
        role="img"
        aria-label={`Voice assistant ${state}`}
      />
    </div>
  );
}

export interface VoiceTranscriptProps {
  text: string;
  className?: string;
}

export function VoiceTranscript({ text, className }: VoiceTranscriptProps) {
  return (
    <div className={`${styles.transcript} ${className ?? ""}`} aria-live="polite">
      {text}
    </div>
  );
}

export interface VoiceControlsProps {
  active: boolean;
  muted: boolean;
  elapsed?: number;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  className?: string;
}

export function VoiceControls({
  active,
  muted,
  elapsed = 0,
  onStart,
  onEnd,
  onToggleMute,
  className,
}: VoiceControlsProps) {
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const formatted = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div className={`${styles.controls} ${className ?? ""}`}>
      {!active ? (
        <button
          type="button"
          className={styles.ctrlBtn}
          aria-label="Start voice session"
          onClick={onStart}
        >
          <Phone size={15} />
        </button>
      ) : (
        <>
          <button
            type="button"
            className={styles.ctrlBtn}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            onClick={onToggleMute}
          >
            {muted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <span className={styles.clock}>{formatted}</span>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${styles.endBtn}`}
            aria-label="End voice session"
            onClick={onEnd}
          >
            <PhoneOff size={15} />
          </button>
        </>
      )}
    </div>
  );
}
