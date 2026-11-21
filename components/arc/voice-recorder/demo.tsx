"use client";

import { VoiceRecorder, voicePeaks } from "./voice-recorder";

const HISTORY = [
  {
    id: "m1",
    duration: 7,
    peaks: voicePeaks(1, 7),
    from: "Sam",
    meta: "9:41 AM",
  },
  {
    id: "m2",
    duration: 12,
    peaks: voicePeaks(3, 12),
    from: "Elena",
    meta: "9:43 AM",
  },
];

export default function VoiceRecorderDemo() {
  return <VoiceRecorder defaultMessages={HISTORY} maxDuration={30} />;
}
