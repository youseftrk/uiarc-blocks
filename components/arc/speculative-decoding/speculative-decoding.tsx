"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import styles from "./speculative-decoding.module.css";

export interface SpeculativeToken {
  text: string;
  ease?: number;
  miss?: string;
}

export interface SpeculativeRound {
  draft: string[];
  accepted: number;
  target: string;
}

export interface SpeculativeStats {
  rounds: number;
  accepted: number;
  totalDrafted: number;
  speedup: number;
}

export interface SpeculativeDecodingProps {
  tokens?: SpeculativeToken[];
  rounds?: SpeculativeRound[];
  defaultDraftLength?: number;
  defaultCompare?: boolean;
  onComplete?: (stats: SpeculativeStats) => void;
  className?: string;
}

const DEFAULT_TOKENS: SpeculativeToken[] = [
  { text: "Speculative" },
  { text: "decoding" },
  { text: "uses" },
  { text: "a", ease: 0.9 },
  { text: "small", ease: 0.55, miss: "tiny" },
  { text: "draft" },
  { text: "model" },
  { text: "to" },
  { text: "guess" },
  { text: "several", ease: 0.5, miss: "many" },
  { text: "tokens" },
  { text: "and" },
  { text: "verifies" },
  { text: "them" },
  { text: "in" },
  { text: "one", ease: 0.6, miss: "a" },
  { text: "parallel" },
  { text: "target" },
  { text: "pass." },
];

function buildRounds(tokens: SpeculativeToken[], draftLength: number): SpeculativeRound[] {
  const result: SpeculativeRound[] = [];
  let i = 0;
  while (i < tokens.length) {
    const draft: string[] = [];
    let accepted = 0;
    let failed = false;
    for (let k = 0; k < draftLength && i + k < tokens.length; k += 1) {
      const tok = tokens[i + k];
      const willMiss = tok.miss !== undefined && (tok.ease ?? 0.9) < 0.65 && k > 0;
      if (willMiss) {
        draft.push(tok.miss!);
        failed = true;
        break;
      }
      draft.push(tok.text);
      accepted += 1;
    }
    const targetIdx = i + accepted;
    const target = targetIdx < tokens.length ? tokens[targetIdx].text : "";
    result.push({ draft, accepted, target: failed ? target : target });
    i += accepted + (target ? 1 : 0);
  }
  return result;
}

export function SpeculativeDecoding({
  tokens = DEFAULT_TOKENS,
  rounds: externalRounds,
  defaultDraftLength = 4,
  defaultCompare = true,
  onComplete,
  className,
}: SpeculativeDecodingProps) {
  const [draftLength, setDraftLength] = useState(defaultDraftLength);
  const [compare, setCompare] = useState(defaultCompare);
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);

  const rounds = useMemo(
    () => externalRounds ?? buildRounds(tokens, draftLength),
    [externalRounds, tokens, draftLength]
  );

  const totalSteps = rounds.length * 2;

  useEffect(() => {
    if (!playing) return;
    if (step >= totalSteps) return;
    const id = window.setTimeout(() => {
      const next = step + 1;
      setStep(next);
      if (next >= totalSteps) {
        const totalDrafted = rounds.reduce((s, r) => s + r.draft.length, 0);
        const accepted = rounds.reduce((s, r) => s + r.accepted, 0);
        const totalOut = accepted + rounds.filter((r) => r.target).length;
        onComplete?.({
          rounds: rounds.length,
          accepted,
          totalDrafted,
          speedup: Number((totalOut / Math.max(1, rounds.length)).toFixed(2)),
        });
      }
    }, 680);
    return () => window.clearTimeout(id);
  }, [playing, step, totalSteps, rounds, onComplete]);

  const completedRounds = Math.floor(step / 2);
  const inVerify = step % 2 === 1;
  const activeRound = rounds[completedRounds];

  const committedTokens: { text: string; kind: "accepted" | "target" }[] = [];
  for (let r = 0; r < completedRounds; r += 1) {
    const round = rounds[r];
    for (let j = 0; j < round.accepted; j += 1) {
      committedTokens.push({ text: round.draft[j], kind: "accepted" });
    }
    if (round.target) {
      committedTokens.push({ text: round.target, kind: "target" });
    }
  }

  const totalOut = committedTokens.length;
  const passes = Math.max(1, completedRounds);
  const speedup = (totalOut / passes).toFixed(2);
  const baselineCount = Math.min(tokens.length, completedRounds);

  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Speculative decoding</span>
          <span className={styles.subtitle}>
            Pass {Math.min(rounds.length, completedRounds + (activeRound ? 1 : 0))} of{" "}
            {rounds.length} · {inVerify ? "Verifying draft" : activeRound ? "Drafting" : "Complete"}
          </span>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setCompare((c) => !c)}
          >
            {compare ? "Hide baseline" : "Compare baseline"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setStep(0);
              setPlaying(true);
            }}
            aria-label="Replay"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className={styles.lane}>
        <div className={styles.laneHeader}>
          <span>Speculative (draft + verify)</span>
          <span>{totalOut} tokens / {completedRounds} passes</span>
        </div>
        <div className={styles.tokenFlow}>
          {committedTokens.map((t, i) => (
            <motion.span
              key={`c-${i}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${styles.token} ${
                t.kind === "accepted" ? styles.tokenAccepted : styles.tokenTarget
              }`}
            >
              {t.text}
            </motion.span>
          ))}
          {activeRound &&
            activeRound.draft.map((d, j) => {
              const rejected = inVerify && j >= activeRound.accepted;
              const accepted = inVerify && j < activeRound.accepted;
              return (
                <motion.span
                  key={`d-${completedRounds}-${j}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${styles.token} ${
                    rejected
                      ? styles.tokenRejected
                      : accepted
                        ? styles.tokenAccepted
                        : styles.tokenDraft
                  }`}
                >
                  {d}
                </motion.span>
              );
            })}
        </div>
      </div>

      {compare && (
        <div className={styles.lane}>
          <div className={styles.laneHeader}>
            <span>Standard autoregressive (1 token / pass)</span>
            <span>{baselineCount} tokens / {completedRounds} passes</span>
          </div>
          <div className={styles.tokenFlow}>
            {tokens.slice(0, baselineCount).map((t, i) => (
              <span key={`b-${i}`} className={styles.token}>
                {t.text}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        {!externalRounds && (
          <label className={styles.sliderRow}>
            <span>Draft length k = {draftLength}</span>
            <input
              type="range"
              min={2}
              max={6}
              value={draftLength}
              onChange={(e) => {
                setDraftLength(Number(e.target.value));
                setStep(0);
                setPlaying(true);
              }}
            />
          </label>
        )}
        <div className={styles.stats}>
          <span>
            Tokens/pass: <span className={styles.statValue}>{speedup}×</span>
          </span>
        </div>
      </div>
    </div>
  );
}
