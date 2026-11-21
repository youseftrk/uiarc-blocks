"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, Volume2, X } from "lucide-react";
import styles from "./speech-player.module.css";

export interface SpeechVoice {
  id: string;
  name: string;
  description?: string;
}

export interface SpeechAuthor {
  name: string;
  mark?: ReactNode;
}

export interface SpeechPlayerProps {
  text: string;
  variant?: "card" | "plain";
  author?: SpeechAuthor;
  voices?: SpeechVoice[];
  actions?: ReactNode;
  onPlay?: (info: { voice: SpeechVoice; speed: number }) => void;
  className?: string;
}

const DEFAULT_VOICES: SpeechVoice[] = [
  { id: "ava", name: "Ava", description: "Warm and conversational" },
  { id: "leo", name: "Leo", description: "Calm, lower register" },
  { id: "nova", name: "Nova", description: "Crisp and studio-clear" },
];

const SPEEDS = [1, 1.25, 1.5, 2] as const;

export function SpeechPlayer({
  text,
  variant = "card",
  author,
  voices = DEFAULT_VOICES,
  actions,
  onPlay,
  className,
}: SpeechPlayerProps) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [voiceIdx, setVoiceIdx] = useState(0);

  const speed = SPEEDS[speedIdx];
  const voice = voices[voiceIdx] ?? voices[0];

  useEffect(() => {
    if (!playing) return;
    if (wordIndex >= words.length - 1) {
      const doneTimer = window.setTimeout(() => setPlaying(false), 320);
      return () => window.clearTimeout(doneTimer);
    }
    const ms = Math.max(95, Math.round(280 / speed));
    const id = window.setTimeout(() => {
      setWordIndex((w) => Math.min(words.length - 1, w + 1));
    }, ms);
    return () => window.clearTimeout(id);
  }, [playing, wordIndex, words.length, speed]);

  const startPlayback = () => {
    setOpen(true);
    if (wordIndex >= words.length - 1) setWordIndex(0);
    setPlaying(true);
    if (voice) onPlay?.({ voice, speed });
  };

  const totalSecs = Math.max(1, Math.round((words.length * 0.28) / speed));
  const curSecs = Math.round(((wordIndex + 1) / Math.max(1, words.length)) * totalSecs);
  const fmt = (s: number) => `0:${String(s).padStart(2, "0")}`;

  return (
    <div
      className={`${styles.card} ${variant === "plain" ? styles.plain : ""} ${
        className ?? ""
      }`}
    >
      {author && (
        <div className={styles.author}>
          {author.mark}
          <span>{author.name}</span>
        </div>
      )}

      <div className={styles.prose}>
        {words.map((w, i) => {
          const isActive = open && i === wordIndex;
          const isSpoken = open && i < wordIndex;
          return (
            <span key={`${w}-${i}`}>
              <span
                className={`${styles.word} ${
                  isActive
                    ? styles.wordActive
                    : isSpoken
                      ? styles.wordSpoken
                      : styles.wordUpcoming
                }`}
                onClick={() => {
                  setOpen(true);
                  setWordIndex(i);
                }}
              >
                {w}
              </span>{" "}
            </span>
          );
        })}
      </div>

      <div className={styles.actionRow}>
        <AnimatePresence mode="wait" initial={false}>
          {!open ? (
            <motion.div
              key="trigger"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <button
                type="button"
                className={styles.readBtn}
                onClick={startPlayback}
              >
                <Volume2 size={14} />
                Read aloud
              </button>
              {actions}
            </motion.div>
          ) : (
            <motion.div
              key="player"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={styles.player}
            >
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={playing ? "Pause speech" : "Play speech"}
                onClick={() => {
                  if (playing) setPlaying(false);
                  else startPlayback();
                }}
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>

              <div className={styles.scrubWrap}>
                <input
                  type="range"
                  className={styles.scrub}
                  min={0}
                  max={Math.max(0, words.length - 1)}
                  value={wordIndex}
                  aria-label="Speech progress"
                  onChange={(e) => setWordIndex(Number(e.target.value))}
                />
                <span className={styles.time}>
                  {fmt(curSecs)} / {fmt(totalSecs)}
                </span>
              </div>

              <button
                type="button"
                className={styles.pillBtn}
                onClick={() => setSpeedIdx((s) => (s + 1) % SPEEDS.length)}
              >
                {speed}×
              </button>

              {voices.length > 0 && (
                <button
                  type="button"
                  className={styles.pillBtn}
                  onClick={() => setVoiceIdx((v) => (v + 1) % voices.length)}
                  title={voice?.description}
                >
                  {voice?.name}
                </button>
              )}

              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close player"
                onClick={() => {
                  setPlaying(false);
                  setOpen(false);
                  setWordIndex(0);
                }}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
