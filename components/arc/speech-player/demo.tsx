"use client";

import { Sparkles } from "lucide-react";
import { SpeechPlayer } from "./speech-player";

export default function SpeechPlayerDemo() {
  return (
    <SpeechPlayer
      author={{ name: "Arc Assistant", mark: <Sparkles size={15} /> }}
      text="Design tokens keep spacing, motion curves, and color roles consistent across every surface. Click Read aloud or tap any word to jump directly to that point in the narration."
    />
  );
}
