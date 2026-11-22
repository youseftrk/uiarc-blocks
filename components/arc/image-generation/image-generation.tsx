"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "motion/react";
import { Check, CircleAlert, Download, Maximize2, RotateCcw, Shuffle, Sparkles, Square } from "lucide-react";
import { Button } from "../button/button";
import { Tooltip } from "../tooltip/tooltip";
import { DotField, type FieldStatus } from "./dot-field";
import { GeminiMark, OpenAIMark, XaiMark, samplePhotos } from "./samples";
import styles from "./image-generation.module.css";

export interface ImageGenerationModel { id: string; name: string; mark?: ReactNode }
export interface ImageGenerationAspect { id: string; label: string; width: number; height: number }
export interface ImageGenerationImage { id: string; src: string; alt: string; width: number; height: number; seed?: number }
export interface ImageGenerationRequest {
  prompt: string;
  model: ImageGenerationModel;
  aspect: ImageGenerationAspect;
  /** Which of the variations this call produces. */
  index: number;
  count: number;
  /** Set when the person asked for variations of an image. */
  variationOf?: ImageGenerationImage;
}
export interface ImageGenerationContext { signal: AbortSignal; onProgress(progress: number, preview?: string): void }

export interface ImageGenerationProps {
  prompt?: string;
  defaultPrompt?: string;
  onPromptChange?: (prompt: string) => void;
  models?: ImageGenerationModel[];
  model?: string;
  defaultModel?: string;
  onModelChange?: (id: string) => void;
  aspectRatios?: ImageGenerationAspect[];
  aspectRatio?: string;
  defaultAspectRatio?: string;
  onAspectRatioChange?: (id: string) => void;
  onGenerate?: (request: ImageGenerationRequest, context: ImageGenerationContext) => Promise<ImageGenerationImage>;
  onUpscale?: (image: ImageGenerationImage, context: ImageGenerationContext) => Promise<ImageGenerationImage>;
  onDownload?: (image: ImageGenerationImage) => void;
  onSelect?: (image: ImageGenerationImage | null) => void;
  suggestions?: string[];
  autoGenerate?: boolean;
  placeholder?: string;
  className?: string;
}

export const imageGenerationModels: ImageGenerationModel[] = [
  { id: "gpt-image", name: "GPT Image", mark: <OpenAIMark /> },
  { id: "gemini-image", name: "Gemini Image", mark: <GeminiMark /> },
  { id: "grok-imagine", name: "Grok Imagine", mark: <XaiMark /> },
];
const ASPECTS: ImageGenerationAspect[] = [
  { id: "1:1", label: "1:1", width: 1024, height: 1024 },
  { id: "4:5", label: "4:5", width: 1024, height: 1280 },
  { id: "16:9", label: "16:9", width: 1536, height: 864 },
];
const DEFAULT_PROMPT = "Cinematic landscapes at golden hour: an alpine lake under a glowing peak, hazy mountain ridges, a long coastline and a calm sea at dusk, shot on 35mm film";
const SUGGESTIONS = [
  "Sculptural architecture, curved facades and terracotta waves against a clear blue sky",
  "Speckled stoneware cups and bowls on a pale table, soft window light",
  "Sunlit reading corner, woven oak lounge chair, linen throws, ceramic lamp",
];
const COUNT = 4, MAX_HEIGHT = 440;
const SIM_SECONDS = [4.8, 4.95, 5.3, 5.9];
const SEED_OFFSET = 212925;

const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const aborted = () => new DOMException("Aborted", "AbortError");

/** Runs `frame` with the elapsed fraction until `seconds` pass or the signal aborts. */
function timeline(seconds: number, signal: AbortSignal, frame: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(aborted());
    const start = performance.now();
    let raf = 0, timer = 0;
    const stop = () => { cancelAnimationFrame(raf); clearTimeout(timer); reject(aborted()); };
    const tick = () => {
      const fraction = Math.min(1, (performance.now() - start) / (seconds * 1000));
      frame(fraction);
      if (fraction >= 1) { signal.removeEventListener("abort", stop); return resolve(); }
      // Timers keep the run moving when the tab is hidden and frames pause.
      if (document.hidden) timer = window.setTimeout(tick, 100); else raf = requestAnimationFrame(tick);
    };
    signal.addEventListener("abort", stop, { once: true });
    tick();
  });
}

/** The built in generator. Picks sample pictures that match the prompt; nothing is sent anywhere. */
export async function simulateImageGeneration(request: ImageGenerationRequest, { signal, onProgress }: ImageGenerationContext): Promise<ImageGenerationImage> {
  const words = request.prompt.toLowerCase();
  const scored = samplePhotos.map((photo, order) => ({ photo, order, at: Math.min(...photo.tags.map(tag => { const found = words.indexOf(tag); return found < 0 ? Infinity : found; })) }));
  const matched = scored.filter(item => item.at !== Infinity).sort((a, b) => a.at - b.at || a.order - b.order).map(item => item.photo);
  const pool = matched.length ? [...matched, ...samplePhotos.filter(photo => !matched.includes(photo))] : samplePhotos;
  const shift = request.variationOf ? 1 + (hash(request.variationOf.id) % 3) : 0;
  const photo = pool[(request.index + shift) % pool.length];
  const seconds = SIM_SECONDS[request.index % SIM_SECONDS.length];
  await timeline(seconds, signal, t => onProgress(Math.min(1, 0.5 * t + 0.5 * Math.sin((Math.PI * t) / 2) ** 1.5), photo.src));
  const seed = 100000 + ((hash(request.prompt) + SEED_OFFSET + request.index * 7919 + shift * 104729) % 900000);
  return { id: `${seed}-${request.index}`, src: photo.src, alt: photo.alt, width: request.aspect.width, height: request.aspect.height, seed };
}

/** The built in upscaler: the same picture at twice the size after a short pass. */
export async function simulateImageUpscale(image: ImageGenerationImage, { signal, onProgress }: ImageGenerationContext): Promise<ImageGenerationImage> {
  await timeline(1.3, signal, t => onProgress(t));
  return { ...image, id: `${image.id}@2x`, width: image.width * 2, height: image.height * 2 };
}

interface Slot { key: number; status: Exclude<FieldStatus, "empty">; preview?: string; image?: ImageGenerationImage; error?: string; seconds?: number; resolved?: boolean }
interface Batch { id: number; prompt: string; aspect: ImageGenerationAspect; model: ImageGenerationModel; varying: boolean }
type Upscale = { key: number; state: "running" | "done"; factor: number } | null;

const SPIN_DELAYS = [-810, -720, -630, -180, -90, -540, -270, -360, -450];
function Spinner() {
  return <span className={styles.spinner} aria-hidden="true">{SPIN_DELAYS.map((delay, i) => <span key={i} className={styles.spinDot} data-center={i === 4 ? "true" : undefined} style={{ animationDelay: `${delay}ms` }} />)}</span>;
}

const pillMotion = { initial: { opacity: 0, filter: "blur(4px)" }, animate: { opacity: 1, filter: "blur(0px)" }, exit: { opacity: 0, filter: "blur(4px)" }, transition: { duration: 0.2 } };

/** Labels stacked in one cell, so the button never changes width when they swap. */
function Stable({ on, items }: { on: number; items: ReactNode[] }) {
  return <span className={styles.stable}>{items.map((item, i) => <span key={i} className={styles.stableItem} data-on={i === on ? "true" : undefined} aria-hidden={i === on ? undefined : true}>{item}</span>)}</span>;
}

function AspectGlyph({ aspect }: { aspect: ImageGenerationAspect }) {
  const ratio = aspect.width / aspect.height, width = ratio >= 1 ? 10.8 : 10.8 * ratio, height = ratio >= 1 ? 10.8 / ratio : 10.8;
  const round = (n: number) => +n.toFixed(2);
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={styles.glyph}><rect x={round(7 - width / 2)} y={round(7 - height / 2)} width={round(width)} height={round(height)} rx="2" stroke="currentColor" strokeWidth="1.2" /></svg>;
}

function roving(event: ReactKeyboardEvent<HTMLElement>, selector: string, pick: (index: number) => void) {
  const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const step = keys[event.key];
  if (!step) return;
  const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(selector)).filter(node => !(node as HTMLButtonElement).disabled);
  const at = nodes.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  event.preventDefault();
  const next = (at + step + nodes.length) % nodes.length;
  nodes[next].focus();
  pick(Number(nodes[next].dataset.index));
}

export function ImageGeneration({
  prompt: promptProp, defaultPrompt = DEFAULT_PROMPT, onPromptChange, models = imageGenerationModels, model: modelProp, defaultModel, onModelChange,
  aspectRatios = ASPECTS, aspectRatio: aspectProp, defaultAspectRatio, onAspectRatioChange, onGenerate, onUpscale, onDownload, onSelect, suggestions = SUGGESTIONS,
  autoGenerate, placeholder = "Describe the image you want", className,
}: ImageGenerationProps) {
  const reduced = useReducedMotion() ?? false;
  const simulated = !onGenerate;
  const [promptInner, setPromptInner] = useState(defaultPrompt);
  const prompt = promptProp ?? promptInner;
  const [modelInner, setModelInner] = useState(defaultModel ?? models[0]?.id);
  const modelId = modelProp ?? modelInner;
  const [aspectInner, setAspectInner] = useState(defaultAspectRatio ?? aspectRatios[0]?.id);
  const aspectId = aspectProp ?? aspectInner;
  const model = models.find(item => item.id === modelId) ?? models[0];
  const aspect = aspectRatios.find(item => item.id === aspectId) ?? aspectRatios[0];

  const [batch, setBatch] = useState<Batch | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [active, setActive] = useState(0);
  const [upscale, setUpscale] = useState<Upscale>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [frameWidth, setFrameWidth] = useState(0);
  const springy = useRef(false);
  const widthValue = useSpring(0, { stiffness: 260, damping: 30 });
  const heightValue = useSpring(0, { stiffness: 260, damping: 30 });

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const softRef = useRef<HTMLImageElement>(null);
  const finalRef = useRef<HTMLImageElement>(null);
  const bandRef = useRef<HTMLCanvasElement>(null);
  const bandGlowRef = useRef<HTMLCanvasElement>(null);
  const progress = useRef<number[]>(Array.from({ length: COUNT }, () => 0));
  const bandCache = useRef<{ key: string; data: Uint8ClampedArray } | null>(null);
  const upscaleProgress = useRef(0);
  const controllers = useRef<(AbortController | null)[]>([]);
  const upscaleAbort = useRef<AbortController | null>(null);
  const keys = useRef(0);
  const touched = useRef(false);
  const live = useRef({ slots, active, batch, onSelect, onGenerate, onUpscale });
  useLayoutEffect(() => { live.current = { slots, active, batch, onSelect, onGenerate, onUpscale }; });

  const running = slots.some(slot => slot.status === "running");
  const ready = slots.filter(slot => slot.status === "done").length;
  const shown = slots[active];
  const shownAspect = batch?.aspect ?? aspect;
  const ratio = shownAspect.width / shownAspect.height;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => { springy.current = false; setFrameWidth(frame.clientWidth); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const stageWidth = frameWidth ? Math.min(frameWidth, MAX_HEIGHT * ratio) : 0;
  const stageHeight = stageWidth / ratio;
  // A new aspect ratio springs; a container resize cuts straight to the new size.
  useLayoutEffect(() => {
    if (!stageWidth) return;
    if (springy.current && !reduced) { widthValue.set(stageWidth); heightValue.set(stageHeight); }
    else { widthValue.jump(stageWidth); heightValue.jump(stageHeight); }
    springy.current = false;
  }, [heightValue, reduced, stageHeight, stageWidth, widthValue]);

  const patch = (index: number, key: number, change: Partial<Slot>) => setSlots(current => current.map((slot, i) => (i === index && slot.key === key ? { ...slot, ...change } : slot)));

  const runSlot = useCallback((index: number, request: Omit<ImageGenerationRequest, "index" | "count">) => {
    const key = ++keys.current, controller = new AbortController(), started = performance.now();
    controllers.current[index]?.abort();
    controllers.current[index] = controller;
    progress.current[index] = 0;
    setSlots(current => { const next = current.slice(); next[index] = { key, status: "running" }; return next; });
    let reported = false, previewed: string | undefined;
    const onProgress = (value: number, preview?: string) => {
      reported = true;
      progress.current[index] = Math.min(1, Math.max(0, value));
      if (preview && preview !== previewed) { previewed = preview; patch(index, key, { preview }); }
    };
    // Without reports, progress eases toward 90% on its own.
    const estimate = window.setInterval(() => { if (!reported) progress.current[index] = 0.9 * (1 - Math.exp(-(performance.now() - started) / 4000)); }, 80);
    const generate = live.current.onGenerate ?? simulateImageGeneration;
    generate({ ...request, index, count: COUNT }, { signal: controller.signal, onProgress }).then(image => {
      if (controller.signal.aborted) return;
      progress.current[index] = 1;
      patch(index, key, { status: "done", image, preview: previewed ?? image.src, resolved: !previewed || previewed !== image.src, seconds: (performance.now() - started) / 1000 });
      if (live.current.active === index) live.current.onSelect?.(image);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
      patch(index, key, { status: "error", error: message });
      setStatus(`Image ${index + 1} failed. ${message}`);
    }).finally(() => { clearInterval(estimate); if (controllers.current[index] === controller) controllers.current[index] = null; });
  }, []);

  const start = useCallback((variationOf?: ImageGenerationImage) => {
    const text = prompt.trim();
    if (!text || !model || !aspect) return;
    touched.current = true;
    upscaleAbort.current?.abort();
    setUpscale(null); setSaved(false); setActive(0);
    const from = variationOf ? live.current.active + 1 : 0;
    const next: Batch = { id: ++keys.current, prompt: text, aspect: variationOf ? live.current.batch?.aspect ?? aspect : aspect, model, varying: !!variationOf };
    setBatch(next);
    live.current.onSelect?.(null);
    setStatus(`${variationOf ? `Generating variations of image ${from}` : `Generating ${COUNT} images`} with ${model.name}, ${next.aspect.label}.${simulated ? " Simulated, nothing was sent." : ""}`);
    for (let i = 0; i < COUNT; i++) runSlot(i, { prompt: text, model, aspect: next.aspect, variationOf });
  }, [aspect, model, prompt, runSlot, simulated]);

  const stop = useCallback(() => {
    controllers.current.forEach(controller => controller?.abort());
    controllers.current = [];
    const done = live.current.slots.filter(slot => slot.status === "done").length;
    setSlots(current => current.map(slot => (slot.status === "running" ? { ...slot, status: "stopped" } : slot)));
    setStatus(`${done} of ${COUNT} images ready.`);
  }, []);

  // Announce once the whole batch has settled.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running && slots.length && !slots.some(slot => slot.status === "stopped")) {
      const failed = slots.filter(slot => slot.status === "error").length;
      const timer = window.setTimeout(() => setStatus(`${ready} of ${COUNT} images ready${failed ? `, ${failed} failed` : ""}.`), failed ? 1000 : 0);
      wasRunning.current = running;
      return () => clearTimeout(timer);
    }
    wasRunning.current = running;
  }, [ready, running, slots]);

  useEffect(() => () => { controllers.current.forEach(controller => controller?.abort()); upscaleAbort.current?.abort(); }, []);

  // Generates once when the card first scrolls into view, unless someone has already touched it.
  const auto = autoGenerate ?? simulated;
  const startRef = useRef(start);
  useLayoutEffect(() => { startRef.current = start; });
  useEffect(() => {
    const root = rootRef.current;
    if (!auto || !root) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (!touched.current) startRef.current();
    }, { threshold: 0.35 });
    observer.observe(root);
    return () => observer.disconnect();
  }, [auto]);

  // The percentage is written straight to the pill, without a render.
  const busy = shown?.status === "running" || upscale?.state === "running";
  useEffect(() => {
    if (!busy) return;
    let raf = 0;
    const write = () => {
      const value = upscale?.state === "running" ? upscaleProgress.current : progress.current[active];
      if (percentRef.current) percentRef.current.textContent = `${Math.round(value * 100)}%`;
      raf = requestAnimationFrame(write);
    };
    write();
    return () => cancelAnimationFrame(raf);
  }, [active, busy, upscale?.state]);

  const select = (index: number) => {
    if (index === active || !slots[index]) return;
    touched.current = true;
    upscaleAbort.current?.abort();
    setUpscale(null); setSaved(false); setActive(index);
    const slot = slots[index];
    setStatus(slot.status === "done" ? `Image ${index + 1}.` : `Image ${index + 1}, ${slot.status === "error" ? "failed" : slot.status === "stopped" ? "stopped" : "generating"}.`);
    if (slot.status === "done" && slot.image) onSelect?.(slot.image);
  };

  const retry = (index: number) => {
    if (!batch) return;
    setStatus(`Retrying image ${index + 1}.`);
    runSlot(index, { prompt: batch.prompt, model: batch.model, aspect: batch.aspect });
  };

  // One value drives the sweep: soft ahead of the band, sharp behind it, dots inside it.
  const paintBand = useCallback((value: number, source: HTMLImageElement | null) => {
    const edge = -8 + 116.6 * value;
    if (finalRef.current) finalRef.current.style.maskImage = `linear-gradient(90deg, rgb(0, 0, 0) ${edge.toFixed(2)}%, transparent ${(edge + 7.8).toFixed(2)}%)`;
    if (softRef.current) softRef.current.style.maskImage = `linear-gradient(90deg, transparent ${(edge + 18.6).toFixed(2)}%, rgb(0, 0, 0) ${(edge + 26.4).toFixed(2)}%)`;
    const canvas = bandRef.current, glow = bandGlowRef.current;
    if (!canvas || !glow || !source) return;
    const box = canvas.getBoundingClientRect(), scale = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(box.width * scale)) { for (const node of [canvas, glow]) { node.width = Math.round(box.width * scale); node.height = Math.round(box.height * scale); } }
    const context = canvas.getContext("2d"), glowContext = glow.getContext("2d");
    if (!context || !glowContext) return;
    const pitch = 6.9, cols = Math.round(box.width / pitch), rows = Math.round(box.height / pitch), cell = box.width / cols, cellY = box.height / rows;
    const key = `${source.src.length}:${cols}x${rows}`;
    if (bandCache.current?.key !== key) {
      const sample = document.createElement("canvas"); sample.width = cols; sample.height = rows;
      const sampler = sample.getContext("2d");
      if (!sampler) return;
      const fit = Math.max(cols / (source.naturalWidth || cols), rows / (source.naturalHeight || rows)), w = (source.naturalWidth || cols) * fit, h = (source.naturalHeight || rows) * fit;
      try { sampler.drawImage(source, (cols - w) / 2, (rows - h) / 2, w, h); bandCache.current = { key, data: sampler.getImageData(0, 0, cols, rows).data }; } catch { return; }
    }
    const data = bandCache.current!.data, from = (edge + 2) / 100, to = (edge + 24) / 100;
    for (const target of [context, glowContext]) { target.setTransform(scale, 0, 0, scale, 0, 0); target.clearRect(0, 0, box.width, box.height); }
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols;
      if (u < from || u > to) continue;
      const weight = Math.sin((Math.PI * (u - from)) / (to - from));
      for (let j = 0; j < rows; j++) {
        const at = (j * cols + i) * 4, dark = 1 - (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) / 255;
        context.fillStyle = glowContext.fillStyle = `rgba(${data[at]},${data[at + 1]},${data[at + 2]},${weight.toFixed(3)})`;
        for (const target of [context, glowContext]) { target.beginPath(); target.arc((i + 0.5) * cell, (j + 0.5) * cellY, cell * (0.2 + 0.3 * dark) * weight, 0, 6.2832); target.fill(); }
      }
    }
  }, []);

  const runUpscale = () => {
    const slot = slots[active], image = slot?.image;
    if (!image || slot.status !== "done" || upscale) return;
    touched.current = true;
    const controller = new AbortController(), key = slot.key, index = active;
    upscaleAbort.current = controller;
    upscaleProgress.current = 0;
    setUpscale({ key, state: "running", factor: 1 });
    setStatus(`Upscaling image ${index + 1}.${onUpscale ? "" : " Simulated, nothing was sent."}`);
    const onProgress = (value: number) => { upscaleProgress.current = Math.min(1, Math.max(0, value)); if (!reduced) paintBand(upscaleProgress.current, finalRef.current); };
    (live.current.onUpscale ?? simulateImageUpscale)(image, { signal: controller.signal, onProgress }).then(next => {
      if (controller.signal.aborted) return;
      onProgress(1);
      patch(index, key, { image: next });
      setUpscale({ key, state: "done", factor: Math.max(1, Math.round(next.width / image.width)) });
      setStatus(`Upscaled image ${index + 1} to ${next.width} × ${next.height}.`);
      live.current.onSelect?.(next);
    }).catch(() => { if (!controller.signal.aborted) { setUpscale(null); setStatus(`Upscaling image ${index + 1} failed.`); } });
  };

  const download = () => {
    const image = shown?.image;
    if (!image) return;
    touched.current = true;
    if (onDownload) onDownload(image);
    else {
      const link = document.createElement("a"), slug = (batch?.prompt ?? "image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
      link.href = image.src; link.download = `${slug}-${active + 1}-${image.width}x${image.height}`;
      document.body.appendChild(link); link.click(); link.remove();
    }
    setSaved(true);
    setStatus(`Saved image ${active + 1}.`);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const setPrompt = (next: string) => { touched.current = true; if (promptProp === undefined) setPromptInner(next); onPromptChange?.(next); };
  const pickModel = (id: string) => { touched.current = true; if (modelProp === undefined) setModelInner(id); onModelChange?.(id); };
  const pickAspect = (id: string) => { touched.current = true; springy.current = true; if (aspectProp === undefined) setAspectInner(id); onAspectRatioChange?.(id); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (running) stop(); else start(); };
  const onRootKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => { if (event.key === "Escape" && running) { event.preventDefault(); stop(); } };

  const stageStatus: FieldStatus = shown?.status ?? "empty";
  const image = shown?.image;
  const dims = image ?? shownAspect;
  const canAct = stageStatus === "done" && !!image;
  const upscaleOn = upscale && shown && upscale.key === shown.key ? upscale : null;
  const stageLabel = !shown ? undefined : stageStatus === "done" && image ? image.alt : `Image ${active + 1}, ${stageStatus === "error" ? "failed" : stageStatus === "stopped" ? "stopped" : "generating"}`;

  let pill: ReactNode = null, pillKey = "none";
  if (upscaleOn?.state === "running") { pillKey = "upscaling"; pill = <><Spinner /><span>Upscaling</span><span ref={percentRef} className={styles.percent}>0%</span></>; }
  else if (upscaleOn?.state === "done") { pillKey = "upscaled"; pill = <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span>Upscaled</span><span className={styles.mono}>{upscaleOn.factor}×</span></>; }
  else if (stageStatus === "running") { pillKey = `running-${shown?.key}`; pill = <><Spinner /><span>{batch?.varying ? "Varying" : "Generating"}</span><span ref={percentRef} className={styles.percent}>0%</span></>; }
  else if (stageStatus === "done" && image) { pillKey = `done-${shown?.key}`; pill = <span className={styles.mono}>{[image.seed != null ? `seed ${image.seed}` : null, shown?.seconds != null ? `${shown.seconds.toFixed(1)}s` : null].filter(Boolean).join(" · ")}</span>; }

  const stageStyle = stageWidth ? { width: widthValue, height: heightValue } : { width: "100%", aspectRatio: String(+ratio.toFixed(4)), maxWidth: MAX_HEIGHT * ratio };

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} onKeyDown={onRootKeyDown}>
      <div ref={frameRef} className={styles.frame}>
        <motion.div
          className={styles.stage} data-status={stageStatus} style={stageStyle}>
          <AnimatePresence initial={false}>
            <motion.div key={shown ? `${batch?.id}-${active}` : "empty"} className={styles.layer} role={shown ? "img" : undefined} aria-label={stageLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DotField key={shown?.key ?? "empty"} status={stageStatus} progress={progress} index={active} preview={shown?.preview} pitch={6.9} reduced={reduced} large />
              {!shown ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Describe an image, then generate</p>
                  {suggestions.length ? <div className={styles.suggestions}>{suggestions.map(text => <button key={text} type="button" className={styles.suggestion} onClick={() => setPrompt(text)}>{text}</button>)}</div> : null}
                </div>
              ) : null}
              {canAct && image && upscaleOn?.state === "running" && !reduced ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={softRef} alt="" className={`${styles.image} ${styles.layer} ${styles.soft}`} draggable={false} src={image.src} style={{ maskImage: "linear-gradient(90deg, transparent 10.6%, rgb(0, 0, 0) 18.4%)" }} />
                  <div className={styles.layer} aria-hidden="true"><canvas ref={bandGlowRef} className={styles.bandGlow} /><canvas ref={bandRef} className={styles.fieldCanvas} /></div>
                </>
              ) : null}
              {canAct && image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={finalRef} alt={upscaleOn?.state === "running" ? "" : image.alt} className={`${styles.image} ${styles.layer} ${styles.final}`} data-fade={shown?.resolved ? "true" : undefined} draggable={false} decoding="async" src={image.src} />
              ) : null}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {shown && (stageStatus === "error" || stageStatus === "stopped") ? (
              <motion.div key={`halt-${shown.key}`} className={styles.halt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <span className={styles.haltLabel} data-status={stageStatus}>
                  {stageStatus === "error" ? <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> : <Square size={12} strokeWidth={2.25} aria-hidden="true" />}
                  {stageStatus === "error" ? "Failed" : "Stopped"}
                </span>
                {stageStatus === "error" && shown.error ? <span className={styles.haltMessage}>{shown.error}</span> : null}
                <Button variant="secondary" size="sm" className={styles.retry} aria-label={`Retry image ${active + 1}`} onClick={() => retry(active)}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry</Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <span className={styles.statusSlot}>
            <AnimatePresence initial={false} mode="popLayout">{pill ? <motion.span key={pillKey} className={styles.pill} {...pillMotion}>{pill}</motion.span> : null}</AnimatePresence>
          </span>
          <span className={styles.dimsSlot}>
            <AnimatePresence initial={false} mode="popLayout"><motion.span key={`${dims.width}x${dims.height}`} className={styles.pill} {...pillMotion}><span className={styles.mono}>{dims.width} × {dims.height}</span></motion.span></AnimatePresence>
          </span>
        </motion.div>
      </div>

      <div className={styles.bar}>
        <div className={styles.strip} role="radiogroup" aria-label={batch ? `Variations for: ${batch.prompt}` : "Variations"} onKeyDown={event => roving(event, "[data-thumb]", select)}>
          {Array.from({ length: COUNT }, (_, i) => {
            const slot = slots[i];
            if (!slot) return <span key={i} className={styles.thumbPlaceholder} aria-hidden="true" />;
            const state = slot.status === "done" && slot.image ? slot.image.alt : slot.status === "error" ? "failed" : slot.status === "stopped" ? "stopped" : "generating";
            return (
              <button key={i} type="button" role="radio" aria-checked={i === active} tabIndex={i === active ? 0 : -1} className={styles.thumb} data-thumb={i} data-index={i} data-status={slot.status} data-active={i === active ? "true" : undefined} aria-label={`Image ${i + 1}, ${state}`} onClick={() => select(i)}>
                <span className={styles.thumbMedia}>
                  <DotField key={slot.key} status={slot.status} progress={progress} index={i} preview={slot.preview} pitch={4} reduced={reduced} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {slot.status === "done" && slot.image ? <img alt="" className={`${styles.image} ${styles.layer} ${styles.final}`} draggable={false} decoding="async" src={slot.image.src} /> : null}
                  {slot.status === "error" || slot.status === "stopped" ? <span className={styles.thumbHalt} data-status={slot.status}>{slot.status === "error" ? <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /> : <Square size={10} strokeWidth={2.25} aria-hidden="true" />}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" className={styles.action} aria-label={upscaleOn?.state === "running" ? "Upscaling" : upscaleOn?.state === "done" ? "Upscaled" : "Upscale"} disabled={!canAct || !!upscaleOn} onClick={runUpscale}>
            <Stable on={upscaleOn?.state === "running" ? 1 : upscaleOn?.state === "done" ? 2 : 0} items={[
              <><Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscale</span></>,
              <><Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscaling</span></>,
              <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscaled</span></>,
            ]} />
          </Button>
          <Button variant="secondary" size="sm" className={styles.action} aria-label="Vary" disabled={!canAct || upscaleOn?.state === "running"} onClick={() => image && start(image)}>
            <Shuffle size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Vary</span>
          </Button>
          <Button variant="secondary" size="sm" className={styles.action} aria-label="Download" disabled={!canAct || upscaleOn?.state === "running"} onClick={download}>
            <Stable on={saved ? 1 : 0} items={[
              <><Download size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Download</span></>,
              <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Saved</span></>,
            ]} />
          </Button>
        </div>
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <textarea
          className={styles.prompt} placeholder={placeholder} rows={2} aria-label="Prompt" aria-keyshortcuts="Meta+Enter Control+Enter" value={prompt}
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); if (!running) start(); } }}
        />
        <div className={styles.toolbar}>
          <div className={styles.options}>
            <div className={styles.chips} role="radiogroup" aria-label="Model" onKeyDown={event => roving(event, "[data-option]", index => pickModel(models[index].id))}>
              {models.map((item, i) => {
                const on = item.id === model?.id;
                const chip = (
                  <button key={item.id} type="button" role="radio" aria-checked={on} aria-label={item.name} data-option={item.id} data-index={i} tabIndex={on ? 0 : -1} className={`${styles.chip} ${styles.modelChip}`} onClick={() => pickModel(item.id)}>
                    {item.mark ? <span className={styles.chipMark} aria-hidden="true">{item.mark}</span> : null}
                    <motion.span className={styles.chipName} aria-hidden="true" initial={false} animate={{ width: on || !item.mark ? "auto" : 0, opacity: on || !item.mark ? 1 : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}>
                      <span className={styles.chipNameText}>{item.name}</span>
                    </motion.span>
                  </button>
                );
                return on || !item.mark ? chip : <Tooltip key={item.id} content={item.name}>{chip}</Tooltip>;
              })}
            </div>
            <div className={styles.chips} role="radiogroup" aria-label="Aspect ratio" onKeyDown={event => roving(event, "[data-option]", index => pickAspect(aspectRatios[index].id))}>
              {aspectRatios.map((item, i) => (
                <button key={item.id} type="button" role="radio" aria-checked={item.id === aspect?.id} aria-label={`${item.label}, ${item.width} by ${item.height}`} data-option={item.id} data-index={i} tabIndex={item.id === aspect?.id ? 0 : -1} className={`${styles.chip} ${styles.aspectChip}`} onClick={() => pickAspect(item.id)}>
                  <AspectGlyph aspect={item} /><span aria-hidden="true">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Button variant={running ? "secondary" : "primary"} size="sm" type="submit" className={`${styles.generate} ${running ? "" : styles.generatePrimary}`} disabled={!running && !prompt.trim()}>
            <Stable on={running ? 1 : 0} items={[
              <><Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />Generate</>,
              <><Square size={12} strokeWidth={2.25} aria-hidden="true" />Stop<span className={styles.count}>{ready}/{COUNT}</span></>,
            ]} />
          </Button>
        </div>
      </form>
      <span className={styles.srOnly} role="status" aria-live="polite">{status}</span>
    </div>
  );
}

export default ImageGeneration;
