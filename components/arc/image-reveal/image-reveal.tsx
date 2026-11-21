"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import { imageRevealSamples } from "./samples";
import styles from "./image-reveal.module.css";

export type ImageRevealStatus = "queued" | "generating" | "decoding" | "done" | "error";

export interface ImageRevealProps {
  src?: string;
  alt?: string;
  status?: ImageRevealStatus;
  progress?: number;
  duration?: number;
  decodeDuration?: number;
  steps?: number;
  aspectRatio?: number | string;
  size?: "sm" | "md" | "lg";
  color?: string;
  showProgress?: boolean;
  sheen?: boolean;
  queueLabel?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onStatusChange?: (status: ImageRevealStatus) => void;
  onComplete?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  startDelay?: number;
  queueDuration?: number;
  holdDuration?: number;
  runKey?: string | number;
  seed?: number;
  className?: string;
  style?: CSSProperties;
}

const RING = 2 * Math.PI * 8;
const FADE = 320, SHEEN = 1100, CELL = 6;
const CHAIN = [6, 8, 12, 16, 24, 32, 48, 64, 96];

/** Small seeded generator, so a replay of the same seed shows the same noise. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ease = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** Cover-fits the image into a canvas of the given size. */
function cover(image: HTMLImageElement, width: number, height: number) {
  const canvas = makeCanvas(width, height), context = canvas.getContext("2d");
  if (!context) return canvas;
  const w = image.naturalWidth || width, h = image.naturalHeight || height, scale = Math.max(canvas.width / w, canvas.height / h);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
  return canvas;
}

function noiseFrame(cols: number, rows: number, seed: number, step: number) {
  const canvas = makeCanvas(cols, rows), context = canvas.getContext("2d");
  if (!context) return canvas;
  const random = mulberry(seed * 7919 + step * 104729 + 17), pixels = context.createImageData(cols, rows), data = pixels.data;
  // The sum of three uniforms is close enough to a gaussian for a latent.
  const gauss = () => (random() + random() + random()) / 3;
  for (let i = 0; i < data.length; i += 4) { const luma = 0.62 + (gauss() - 0.5) * 1.1; data[i] = 255 * clamp01(luma + (gauss() - 0.5) * 0.7); data[i + 1] = 255 * clamp01(luma + (gauss() - 0.5) * 0.7); data[i + 2] = 255 * clamp01(luma + (gauss() - 0.5) * 0.7); data[i + 3] = 255; }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

interface Phase { key: string; node: ReactNode; bar?: { now: number; max: number } }

export function ImageReveal({
  src, alt, status: statusProp, progress, duration = 4600, decodeDuration = 560, steps = 30, aspectRatio = 1, size = "md", color, showProgress = true, sheen = true,
  queueLabel = "Queued", errorMessage = "Generation failed", onRetry, onStatusChange, onComplete, autoPlay = true, loop = true, startDelay = 0, queueDuration = 900,
  holdDuration = 2600, runKey, seed = 1, className, style,
}: ImageRevealProps) {
  const reduced = useReducedMotion() ?? false;
  const auto = statusProp === undefined;
  const [autoStatus, setAutoStatus] = useState<ImageRevealStatus>("queued");
  const [autoStep, setAutoStep] = useState(0);
  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [chipGone, setChipGone] = useState(false);
  const [chipWidth, setChipWidth] = useState<number | null>(null);

  const status = statusProp ?? autoStatus;
  const total = Math.max(1, Math.round(steps));
  const step = progress !== undefined ? Math.min(total, Math.max(0, Math.round(clamp01(progress) * total))) : auto ? autoStep : 0;
  const sample = imageRevealSamples[(run + Math.max(0, seed - 1)) % imageRevealSamples.length];
  const source = src ?? sample.src;
  const label = alt ?? (src ? "Generated image" : sample.alt);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const callbacks = useRef({ onStatusChange, onComplete });
  useLayoutEffect(() => { callbacks.current = { onStatusChange, onComplete }; });
  // Everything the frame loop reads, written without a render.
  const live = useRef({ status, step, total, changed: 0, stepAt: 0, from: "queued" as ImageRevealStatus, startedAt: 0 });

  useLayoutEffect(() => {
    const now = performance.now(), state = live.current;
    if (state.status !== status) { state.from = state.status; state.changed = now; state.status = status; if (status === "generating" && state.from !== "decoding") state.startedAt = now; }
    if (state.step !== step) { state.step = step; state.stepAt = now; }
    state.total = total;
  }, [status, step, total]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    callbacks.current.onStatusChange?.(status);
  }, [status]);

  // Elapsed time for the pill, and the pill leaving shortly after the image resolves.
  const began = useRef(0);
  useEffect(() => {
    if (status === "queued") { began.current = 0; return; }
    if (status === "generating" && !began.current) began.current = performance.now();
    if (status !== "done") return;
    const reveal = window.setTimeout(() => {
      setElapsed(began.current ? (performance.now() - began.current) / 1000 : null);
      callbacks.current.onComplete?.();
    }, 0);
    const leave = window.setTimeout(() => setChipGone(true), 1800);
    return () => { clearTimeout(reveal); clearTimeout(leave); };
  }, [status, run]);
  const [seenStatus, setSeenStatus] = useState(status);
  if (seenStatus !== status) { setSeenStatus(status); if (status !== "done") { setChipGone(false); setElapsed(null); } }

  // Auto mode: queued, sampling over `duration`, decoding, done, then around again.
  const [seenRunKey, setSeenRunKey] = useState(runKey);
  const [restart, setRestart] = useState(0);
  if (seenRunKey !== runKey) { setSeenRunKey(runKey); setRestart(restart + 1); }
  const plays = useRef(0);
  useEffect(() => {
    if (!auto) return;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => { timers.push(window.setTimeout(run, ms)); };
    let cancelled = false;
    const play = (fadeFirst: boolean) => {
      const lead = fadeFirst ? FADE : 0;
      if (fadeFirst) { later(0, () => { setAutoStatus("queued"); setAutoStep(0); }); }
      later(lead, () => { if (plays.current > 0 && !src) setRun(value => value + 1); plays.current += 1; });
      const startAt = lead + queueDuration + startDelay;
      later(startAt, () => { setAutoStep(1); setAutoStatus("generating"); });
      const each = duration / total;
      for (let i = 2; i <= total; i++) later(startAt + each * (i - 1), () => setAutoStep(i));
      later(startAt + duration, () => setAutoStatus("decoding"));
      later(startAt + duration + decodeDuration, () => {
        setAutoStatus("done");
        if (loop && !cancelled) later(holdDuration, () => play(true));
      });
    };
    if (autoPlay || restart > 0) play(restart > 0 || plays.current > 0);
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [auto, autoPlay, decodeDuration, duration, holdDuration, loop, queueDuration, restart, src, startDelay, total]);

  // The canvas: a few drawImage calls per frame, nothing once the image has resolved.
  useEffect(() => {
    const canvas = canvasRef.current, probe = probeRef.current;
    if (!canvas || !probe) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let raf = 0, alive = true, visible = true, width = 0, height = 0, ratio = 1;
    let sharp: HTMLCanvasElement | null = null, chain: HTMLCanvasElement[] = [], image: HTMLImageElement | null = null;
    type Frame = { step: number; canvas: HTMLCanvasElement };
    let noise = null as Frame | null, previous = null as Frame | null, noiseAt = 0;
    let surface = "#f4f4f5", snapshot: HTMLCanvasElement | null = null, snapshotAt = 0, settled = false;

    const build = () => {
      if (!image || !width) return;
      sharp = cover(image, width * ratio, height * ratio);
      chain = CHAIN.map(w => cover(image as HTMLImageElement, w, Math.max(1, Math.round((w * height) / width))));
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(box.width)); height = Math.max(1, Math.round(box.height));
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      noise = previous = null; settled = false;
      build();
    };
    const readSurface = () => { const tone = getComputedStyle(probe).color; if (tone) surface = tone; settled = false; };

    const draw = (now: number) => {
      const state = live.current, W = canvas.width, H = canvas.height, since = now - state.changed;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1; context.globalCompositeOperation = "source-over"; context.filter = "none";
      context.fillStyle = surface; context.fillRect(0, 0, W, H);
      context.fillStyle = "rgba(127,127,127,0.09)"; context.fillRect(0, 0, W, H);
      let busy = false;
      const cols = Math.max(2, Math.round(width / CELL)), rows = Math.max(2, Math.round(height / CELL));

      const prediction = (index: number, amount: number) => {
        if (!chain.length || amount <= 0) return;
        const low = Math.floor(index), mix = index - low;
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        context.globalAlpha = amount; context.drawImage(chain[Math.min(chain.length - 1, low)], 0, 0, W, H);
        if (mix > 0 && low + 1 < chain.length) { context.globalAlpha = amount * mix; context.drawImage(chain[low + 1], 0, 0, W, H); }
        context.globalAlpha = 1;
      };
      const latent = (current: number, strength: number) => {
        if (strength <= 0) return;
        const frameStep = reduced ? 1 : current;
        if (!noise || noise.step !== frameStep) { previous = noise; noise = { step: frameStep, canvas: noiseFrame(cols, rows, seed, frameStep) }; noiseAt = now; }
        context.imageSmoothingEnabled = false;
        const blend = reduced ? 1 : clamp01((now - noiseAt) / 35);
        if (previous && blend < 1) { context.globalAlpha = strength; context.drawImage(previous.canvas, 0, 0, W, H); busy = true; }
        context.globalAlpha = strength * (previous && blend < 1 ? blend : 1); context.drawImage(noise.canvas, 0, 0, W, H);
        context.globalAlpha = 1; context.imageSmoothingEnabled = true;
      };
      const sampling = (current: number, opacity: number) => {
        const t = clamp01(current / state.total);
        // Noise drops fast early; the last steps only refine.
        const strength = sharp ? 0.08 + 0.92 * Math.pow(1 - t, 1.9) : 1;
        if (opacity < 1) context.globalAlpha = opacity;
        prediction(Math.pow(t, 1.25) * (chain.length - 1), opacity);
        latent(current, strength * opacity * (sharp ? 0.92 : 0.5));
      };

      if (state.status === "queued") {
        // Leaving a finished image: fade it straight back to the surface.
        if (state.from === "done" && sharp && since < FADE) { context.globalAlpha = 1 - ease(since / FADE); context.drawImage(sharp, 0, 0, W, H); context.globalAlpha = 1; busy = true; }
        if (!reduced) {
          const travel = ((now % 2600) / 2600) * 2.4 - 0.7, x = travel * W, band = W * 0.7;
          const sweep = context.createLinearGradient(x - band / 2, 0, x + band / 2, 0);
          sweep.addColorStop(0, "rgba(255,255,255,0)"); sweep.addColorStop(0.5, "rgba(255,255,255,0.16)"); sweep.addColorStop(1, "rgba(255,255,255,0)");
          context.fillStyle = sweep; context.fillRect(0, 0, W, H);
          busy = true;
        }
      } else if (state.status === "generating") {
        sampling(Math.max(1, state.step), reduced ? 1 : ease(since / 240));
        busy = !reduced || since < 300;
      } else if (state.status === "decoding" || state.status === "done") {
        const decodeNow = state.status === "decoding" ? since : state.from === "decoding" ? Infinity : state.from === "generating" ? since : Infinity;
        const amount = decodeDuration > 0 ? decodeNow / decodeDuration : 1;
        if (!sharp) { busy = true; }
        else if (amount >= 1.25 || (state.status === "done" && state.from !== "generating" && state.from !== "decoding" && since > FADE)) { context.drawImage(sharp, 0, 0, W, H); }
        else if (state.status === "done" && state.from !== "generating" && state.from !== "decoding") { context.globalAlpha = ease(since / FADE); context.drawImage(sharp, 0, 0, W, H); context.globalAlpha = 1; busy = true; }
        else if (reduced) { sampling(state.total, 1); context.globalAlpha = ease(amount); context.drawImage(sharp, 0, 0, W, H); context.globalAlpha = 1; busy = amount < 1; }
        else {
          sampling(state.total, 1);
          // Tiles land in raster order, each one crossfading in.
          const tilesX = Math.max(2, Math.min(6, Math.round(width / 64))), tilesY = Math.max(2, Math.min(6, Math.round(height / 64))), count = tilesX * tilesY;
          for (let i = 0; i < count; i++) {
            const local = clamp01((amount * (count + 3) - i) / 3);
            if (local <= 0) continue;
            const x0 = Math.round(((i % tilesX) * W) / tilesX), x1 = Math.round((((i % tilesX) + 1) * W) / tilesX), y0 = Math.round((Math.floor(i / tilesX) * H) / tilesY), y1 = Math.round(((Math.floor(i / tilesX) + 1) * H) / tilesY);
            context.globalAlpha = ease(local); context.drawImage(sharp, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
          }
          context.globalAlpha = 1; busy = true;
        }
        if (state.status === "done" && sharp && sheen && !reduced) {
          const at = now - state.changed;
          if (at < SHEEN) {
            const x = (-0.4 + 1.8 * ease(at / SHEEN)) * W, band = W * 0.5, light = context.createLinearGradient(x - band / 2, 0, x + band / 2, H * 0.3);
            light.addColorStop(0, "rgba(255,255,255,0)"); light.addColorStop(0.5, "rgba(255,255,255,0.28)"); light.addColorStop(1, "rgba(255,255,255,0)");
            context.globalCompositeOperation = "soft-light"; context.fillStyle = light; context.fillRect(0, 0, W, H); context.globalCompositeOperation = "source-over";
            busy = true;
          }
        }
      } else {
        // Error: one calm frame of noise under the message.
        latent(1, 0.5 * (reduced ? 1 : ease(since / 240)));
        busy = since < 300;
      }
      // A photo swap crossfades from a snapshot of the last frame.
      if (snapshot && now - snapshotAt < FADE) { context.globalAlpha = 1 - ease((now - snapshotAt) / FADE); context.drawImage(snapshot, 0, 0, W, H); context.globalAlpha = 1; busy = true; } else snapshot = null;
      settled = !busy;
    };

    const loopFrame = (now: number) => {
      raf = 0;
      if (!alive || !visible) return;
      const state = live.current;
      if (!(settled && state.changed < lastDrawn && state.stepAt < lastDrawn)) { draw(now); lastDrawn = now; }
      raf = requestAnimationFrame(loopFrame);
    };
    let lastDrawn = 0;
    const kick = () => { settled = false; if (!raf && alive && visible) raf = requestAnimationFrame(loopFrame); };

    resize(); readSurface(); kick();
    if (canvas.width && lastSnapshot.current) { snapshot = lastSnapshot.current; snapshotAt = performance.now(); }
    const picture = new Image();
    picture.decoding = "async";
    picture.onload = () => { if (!alive) return; image = picture; build(); kick(); };
    picture.src = source;
    const sizes = new ResizeObserver(() => { resize(); kick(); });
    sizes.observe(canvas);
    const seen = new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; if (visible) kick(); else { cancelAnimationFrame(raf); raf = 0; } });
    seen.observe(canvas);
    const theme = new MutationObserver(() => { readSurface(); kick(); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const onVisibility = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false; cancelAnimationFrame(raf); sizes.disconnect(); seen.disconnect(); theme.disconnect(); document.removeEventListener("visibilitychange", onVisibility);
      try { const copy = makeCanvas(canvas.width, canvas.height); copy.getContext("2d")?.drawImage(canvas, 0, 0); lastSnapshot.current = copy; } catch { lastSnapshot.current = null; }
    };
  }, [decodeDuration, reduced, seed, sheen, source]);
  const lastSnapshot = useRef<HTMLCanvasElement | null>(null);

  // The pill: one label at a time, width on a spring with no bounce.
  let phase: Phase | null = null;
  if (showProgress && status !== "error" && !(status === "done" && chipGone)) {
    if (status === "queued") phase = { key: "queued", node: <><Ring spin reduced={reduced} /><span className={styles.text}>{queueLabel}</span></> };
    else if (status === "generating") phase = { key: "generating", bar: { now: step, max: total }, node: <><Ring value={step / total} />{size === "sm" ? null : <span className={styles.text}>Denoising</span>}<span className={`${styles.reserve} ${size === "sm" ? "" : styles.count}`}><span className={styles.ghost} aria-hidden="true">{total} / {total}</span><span>{step} / {total}</span></span></> };
    else if (status === "decoding" || elapsed === null) phase = { key: "decoding", node: <><Ring spin reduced={reduced} /><span className={styles.text}>Decoding</span></> };
    else phase = { key: "done", node: <><Check className={styles.doneIcon} strokeWidth={2.25} aria-hidden="true" /><span className={styles.text}>{elapsed.toFixed(1)}s</span></> };
  }
  const phaseKey = phase?.key;
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setChipWidth(Math.ceil(content.getBoundingClientRect().width) + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [phaseKey, queueLabel, size, total]);

  const canvasLabel = status === "done" ? label : `${status === "queued" ? queueLabel : status === "error" ? errorMessage : "Generating image"}: ${label}`;
  const spoken = status === "queued" ? queueLabel : status === "error" ? errorMessage : status === "done" ? "Image ready" : "Generating image";
  const ratioValue = typeof aspectRatio === "number" ? String(aspectRatio) : aspectRatio;
  const rootStyle = { aspectRatio: ratioValue, ...(color ? { "--ir-accent": color } : null), ...style } as CSSProperties;

  return (
    <div className={[styles.root, size === "md" ? "" : styles[size], className].filter(Boolean).join(" ")} style={rootStyle} data-status={status}>
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={canvasLabel} />
      <span ref={probeRef} className={styles.probe} aria-hidden="true" style={{ color: "var(--surface, var(--background, #fff))" }} />
      <AnimatePresence initial={false}>
        {phase ? (
          <motion.div key="chip" className={styles.chip} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0, width: chipWidth ?? "auto" }} exit={{ opacity: 0, y: reduced ? 0 : 4 }}
            transition={{ opacity: { duration: 0.2 }, y: { duration: 0.2 }, width: reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 } }}>
            <span ref={contentRef} className={styles.chipContent}>
              <AnimatePresence initial={false} mode="wait">
                <motion.span key={phase.key} className={styles.phase} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.16, delay: 0.06 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  {...(phase.bar ? { role: "progressbar", "aria-label": "Generation progress", "aria-valuemin": 0, "aria-valuemax": phase.bar.max, "aria-valuenow": phase.bar.now, "aria-valuetext": `Step ${phase.bar.now} of ${phase.bar.max}` } : null)}>
                  {phase.node}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {status === "error" ? (
          <motion.div key="error" className={styles.errorLayer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <motion.div className={styles.errorBody} initial={{ y: reduced ? 0 : 4 }} animate={{ y: 0 }} transition={{ duration: 0.2 }}>
              <span className={styles.errorTitle}><CircleAlert className={styles.errorIcon} aria-hidden="true" /><span>{size === "sm" ? "Failed" : errorMessage}</span></span>
              {onRetry ? <Button variant="secondary" size="sm" aria-label="Retry generation" onClick={onRetry}><RotateCcw aria-hidden="true" />Retry</Button> : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">{spoken}{auto && status !== "done" && status !== "error" ? ", simulated" : ""}</span>
    </div>
  );
}

function Ring({ value, spin, reduced }: { value?: number; spin?: boolean; reduced?: boolean }) {
  return (
    <svg className={`${styles.ring} ${spin && !reduced ? styles.spin : ""}`} viewBox="0 0 20 20" aria-hidden="true">
      <circle className={styles.ringTrack} cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" />
      {spin ? <circle className={styles.ringArc} cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" strokeDasharray={`${RING * 0.22} ${RING}`} />
        : <circle className={styles.ringArc} cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" strokeDasharray={RING} strokeDashoffset={RING} style={{ strokeDashoffset: RING * (1 - clamp01(value ?? 0)), transition: "stroke-dashoffset 120ms linear" }} />}
    </svg>
  );
}

export default ImageReveal;
