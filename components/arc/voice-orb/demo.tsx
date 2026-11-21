"use client";

import { useEffect, useState } from "react";
import {
  VoiceControls,
  VoiceOrb,
  VoiceTranscript,
  useMicLevel,
  type VoiceOrbState,
} from "./voice-orb";
import styles from "./voice-orb.module.css";

const STATES: { state: VoiceOrbState; caption: string }[] = [
  { state: "listening", caption: "Listening... “Move Friday’s design sync to 2 PM.”" },
  { state: "thinking", caption: "Checking calendar availability..." },
  { state: "speaking", caption: "Done — moved Design Sync to Friday at 2:00 PM." },
];

export default function VoiceOrbDemo() {
  const [active, setActive] = useState(true);
  const [muted, setMuted] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const mic = useMicLevel(active && !muted);
  const current = active
    ? STATES[phaseIdx]
    : { state: "idle" as VoiceOrbState, caption: "Tap the call button to start voice mode." };

  useEffect(() => {
    if (!active) return;
    const clock = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    const cycle = window.setInterval(
      () => setPhaseIdx((i) => (i + 1) % STATES.length),
      3200
    );
    return () => {
      window.clearInterval(clock);
      window.clearInterval(cycle);
    };
  }, [active]);

  return (
    <div className={styles.root}>
      <VoiceOrb state={current.state} level={mic} />
      <span className={styles.stateLabel}>{current.state}</span>
      <VoiceTranscript text={current.caption} />
      <VoiceControls
        active={active}
        muted={muted}
        elapsed={elapsed}
        onStart={() => {
          setActive(true);
          setElapsed(0);
          setPhaseIdx(0);
        }}
        onEnd={() => setActive(false)}
        onToggleMute={() => setMuted((m) => !m)}
      />
    </div>
  );
}
