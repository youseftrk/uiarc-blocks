"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import styles from "./voice-recorder.module.css";

export interface VoiceMessage {
  id: string;
  duration: number;
  peaks: number[];
  from?: string;
  avatar?: string;
  meta?: string;
}

export interface VoiceRecorderProps {
  defaultMessages?: VoiceMessage[];
  maxDuration?: number;
  onSend?: (message: VoiceMessage) => void;
  className?: string;
}

export function voicePeaks(seed: number, duration: number): number[] {
  const count = Math.max(16, Math.min(36, Math.round(duration * 3.5)));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v =
      0.22 +
      0.72 * Math.abs(Math.sin((i + 1) * 0.72 + seed * 1.9) * Math.cos(i * 0.31 + seed));
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({
  defaultMessages = [],
  maxDuration = 30,
  onSend,
  className,
}: VoiceRecorderProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>(defaultMessages);
  const [mode, setMode] = useState<"idle" | "recording" | "review">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [livePeaks, setLivePeaks] = useState<number[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (mode !== "recording") return;
    const id = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.25;
        if (next >= maxDuration) {
          setMode("review");
          return maxDuration;
        }
        return next;
      });
      setLivePeaks((prev) => {
        const sample = 0.25 + 0.7 * Math.abs(Math.sin(prev.length * 0.65 + 0.4));
        return [...prev.slice(-31), Number(sample.toFixed(2))];
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [mode, maxDuration]);

  useEffect(() => {
    if (!playingId) return;
    const target = messages.find((m) => m.id === playingId);
    if (!target) return;
    const id = window.setInterval(() => {
      setPlayProgress((prev) => {
        const cur = prev[playingId] ?? 0;
        const step = 0.1 / Math.max(1, target.duration);
        if (cur + step >= 1) {
          setPlayingId(null);
          return { ...prev, [playingId]: 0 };
        }
        return { ...prev, [playingId]: cur + step };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [playingId, messages]);

  const startRecording = () => {
    setElapsed(0);
    setLivePeaks([]);
    setMode("recording");
  };

  const stopRecording = () => {
    setMode("review");
  };

  const discard = () => {
    setMode("idle");
    setElapsed(0);
    setLivePeaks([]);
  };

  const sendTake = () => {
    const dur = Math.max(1, Math.round(elapsed));
    const msg: VoiceMessage = {
      id: `v-${Date.now()}`,
      duration: dur,
      peaks: livePeaks.length >= 12 ? livePeaks : voicePeaks(messages.length + 2, dur),
      from: "You",
      meta: "Just now",
    };
    setMessages((prev) => [...prev, msg]);
    onSend?.(msg);
    discard();
  };

  return (
    <div className={`${styles.shell} ${className ?? ""}`}>
      <div className={styles.thread}>
        {messages.map((m) => {
          const prog = playProgress[m.id] ?? 0;
          const isPlaying = playingId === m.id;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${styles.bubble} ${m.from === "You" ? styles.bubbleMine : ""}`}
            >
              <div className={styles.bubbleTop}>
                <span>{m.from ?? "Voice note"}</span>
                <span>{m.meta ?? ""}</span>
              </div>
              <div className={styles.bubbleRow}>
                <button
                  type="button"
                  className={styles.playBtn}
                  aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
                  onClick={() => setPlayingId(isPlaying ? null : m.id)}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <div
                  className={styles.bars}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    setPlayProgress((p) => ({ ...p, [m.id]: pct }));
                  }}
                >
                  {m.peaks.map((pk, idx) => (
                    <span
                      key={idx}
                      className={`${styles.bar} ${
                        idx / m.peaks.length <= prog ? styles.barPlayed : ""
                      }`}
                      style={{ height: `${Math.max(4, Math.round(pk * 26))}px` }}
                    />
                  ))}
                </div>
                <span className={styles.dur}>{formatSec(m.duration)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className={styles.composer}>
        {mode === "idle" && (
          <>
            <button
              type="button"
              className={styles.recordBtn}
              aria-label="Start recording"
              onClick={startRecording}
            >
              <Mic size={15} />
            </button>
            <span className={styles.composerLabel}>Tap mic to record a voice note</span>
          </>
        )}

        {mode === "recording" && (
          <>
            <button
              type="button"
              className={`${styles.recordBtn} ${styles.recordBtnLive}`}
              aria-label="Stop recording"
              onClick={stopRecording}
            >
              <Square size={12} />
            </button>
            <div className={styles.bars}>
              {livePeaks.map((pk, idx) => (
                <span
                  key={idx}
                  className={`${styles.bar} ${styles.barPlayed}`}
                  style={{ height: `${Math.max(4, Math.round(pk * 24))}px` }}
                />
              ))}
            </div>
            <span className={styles.dur}>{formatSec(elapsed)}</span>
          </>
        )}

        {mode === "review" && (
          <>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Discard recording"
              onClick={discard}
            >
              <Trash2 size={14} />
            </button>
            <span className={styles.composerLabel}>
              Ready to send ({formatSec(elapsed)})
            </span>
            <button
              type="button"
              className={styles.recordBtn}
              aria-label="Send voice note"
              onClick={sendTake}
            >
              <Send size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
