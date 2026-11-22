"use client";

import { useCallback, useState } from "react";
import { Switch } from "../switch/switch";
import { ImageGeneration, simulateImageGeneration, type ImageGenerationContext, type ImageGenerationRequest } from "./image-generation";
import styles from "./image-generation.module.css";

export default function Demo() {
  const [fail, setFail] = useState(false);
  // With the switch on, the third variation times out a little past half way.
  const failing = useCallback((request: ImageGenerationRequest, context: ImageGenerationContext) => {
    if (request.index !== 2) return simulateImageGeneration(request, context);
    return new Promise<never>((_, reject) => {
      const inner = new AbortController();
      const timer = window.setTimeout(() => { inner.abort(); reject(new Error("The model timed out. Try again.")); }, 2800);
      context.signal.addEventListener("abort", () => { clearTimeout(timer); inner.abort(); }, { once: true });
      simulateImageGeneration(request, { signal: inner.signal, onProgress: context.onProgress }).catch(() => {});
    });
  }, []);
  return (
    <div className={styles.demo}>
      <ImageGeneration onGenerate={fail ? failing : undefined} />
      <div className={styles.controls}>
        <Switch label="Fail one image" checked={fail} onCheckedChange={setFail} />
      </div>
    </div>
  );
}
