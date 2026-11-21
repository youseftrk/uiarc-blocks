"use client";

import { useEffect, useRef } from "react";
import styles from "./image-generation.module.css";

export type FieldStatus = "empty" | "running" | "done" | "error" | "stopped";

/** Progress from 0 to 1 per variation, written by the owner without a render. */
export type ProgressRef = { readonly current: number[] };

interface DotFieldProps {
  status: FieldStatus;
  progress: ProgressRef;
  index: number;
  preview?: string;
  /** Distance between dots in CSS px. */
  pitch: number;
  reduced: boolean;
  large?: boolean;
}

type Grid = { cols: number; rows: number; data: Uint8ClampedArray };
const sampled = new Map<string, Promise<Grid | null>>();

/** The preview downscaled to the grid, cover fitted. Sampled once per grid size. */
function samplePreview(src: string, cols: number, rows: number) {
  const key = `${cols}x${rows}:${src}`;
  let job = sampled.get(key);
  if (!job) {
    job = new Promise<Grid | null>(resolve => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = cols; canvas.height = rows;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return resolve(null);
          const width = image.naturalWidth || cols, height = image.naturalHeight || rows, scale = Math.max(cols / width, rows / height);
          context.drawImage(image, (cols - width * scale) / 2, (rows - height * scale) / 2, width * scale, height * scale);
          resolve({ cols, rows, data: context.getImageData(0, 0, cols, rows).data });
        } catch { resolve(null); }
      };
      image.onerror = () => resolve(null);
      image.src = src;
    });
    sampled.set(key, job);
  }
  return job;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };

export function DotField({ status, progress, index, preview, pitch, reduced, large = false }: DotFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const field = fieldRef.current, canvas = canvasRef.current, glow = glowRef.current;
    if (!field || !canvas || !glow) return;
    const context = canvas.getContext("2d"), glowContext = glow.getContext("2d");
    if (!context || !glowContext) return;
    let grid: Grid | null = null, raf = 0, visible = true, alive = true, width = 0, height = 0, cols = 0, rows = 0, ink = [20, 20, 20];
    const born = performance.now();

    const readInk = () => {
      const match = getComputedStyle(field).color.match(/[\d.]+/g);
      if (match && match.length >= 3 && getComputedStyle(field).color.startsWith("rgb")) ink = match.slice(0, 3).map(Number);
      else ink = document.documentElement.dataset.theme === "dark" ? [245, 245, 245] : [20, 20, 20];
    };
    const resize = () => {
      const box = field.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(box.width)); height = Math.max(1, Math.round(box.height));
      cols = Math.max(2, Math.round(width / pitch)); rows = Math.max(2, Math.round(height / pitch));
      for (const node of [canvas, glow]) { node.width = Math.round(width * ratio); node.height = Math.round(height * ratio); }
      context.setTransform(ratio, 0, 0, ratio, 0, 0); glowContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      grid = null;
      if (preview) samplePreview(preview, cols, rows).then(result => { if (alive && result && result.cols === cols && result.rows === rows) { grid = result; if (!raf) draw(performance.now()); } });
    };

    const draw = (now: number) => {
      const p = status === "empty" ? 0 : clamp01(progress.current[index] ?? 0), time = reduced ? 0 : (now - born) / 1000;
      const cell = width / cols, cellY = height / rows;
      // The wave wanders and breathes; at rest it sits just above the middle.
      const waveX = 0.5 + 0.26 * Math.sin(time * 0.52 + 0.6), waveY = 0.42 + 0.2 * Math.cos(time * 0.41), reach = 0.42 + 0.06 * Math.sin(time * 1.1);
      const tint = grid ? smooth((p - 0.2) / 0.58) : 0;
      const lead = grid ? clamp01((p - 0.2) / 0.2) : 0;
      const waveFade = status === "empty" ? 0.35 : 1 - 0.75 * tint;
      context.clearRect(0, 0, width, height); glowContext.clearRect(0, 0, width, height);
      const aspect = width / height;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const u = (i + 0.5) / cols, v = (j + 0.5) / rows, dx = (u - waveX) * Math.max(1, aspect), dy = (v - waveY) / Math.min(1, aspect);
          const wave = Math.exp(-(dx * dx + dy * dy) / (2 * reach * reach * 0.36)) * waveFade;
          let radius = cell * (0.1 + 0.26 * wave), red = ink[0], green = ink[1], blue = ink[2], alpha = 0.16 + 0.4 * wave;
          if (grid && tint > 0) {
            const at = (j * cols + i) * 4, r = grid.data[at], g = grid.data[at + 1], b = grid.data[at + 2];
            const dark = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            const mixed = clamp01(tint * 1.1 + wave * lead * 0.5), grey = (1 - tint) * 0.55, luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            radius += (cell * (0.2 + 0.3 * dark) - radius) * mixed;
            red += (r + (luma - r) * grey - red) * mixed; green += (g + (luma - g) * grey - green) * mixed; blue += (b + (luma - b) * grey - blue) * mixed; alpha += (0.92 - alpha) * mixed;
          }
          const x = (i + 0.5) * cell, y = (j + 0.5) * cellY;
          context.fillStyle = `rgba(${red | 0},${green | 0},${blue | 0},${alpha.toFixed(3)})`;
          context.beginPath(); context.arc(x, y, radius, 0, 6.2832); context.fill();
          if (large && wave > 0.12) { glowContext.fillStyle = context.fillStyle; glowContext.beginPath(); glowContext.arc(x, y, radius * 1.15, 0, 6.2832); glowContext.fill(); }
        }
      }
      // Over the last fifth the dots blur away while the photo sharpens out of them.
      const dots = !grid ? 1 : reduced ? 1 - p : 1 - smooth((p - 0.8) / 0.2), settled = status === "done";
      const shown = settled ? 0 : status === "error" ? 0 : dots;
      canvas.style.opacity = String(+shown.toFixed(4));
      canvas.style.filter = reduced || shown >= 1 || shown <= 0 ? "" : `blur(${(5 * (1 - shown)).toFixed(2)}px)`;
      glow.style.opacity = String(+(large ? 0.7 * waveFade * shown : 0).toFixed(3));
      const image = imageRef.current;
      if (image) {
        if (settled || status === "error") { image.style.opacity = "1"; image.style.filter = ""; image.style.transform = ""; }
        else { image.style.opacity = String(+(1 - dots).toFixed(4)); image.style.filter = reduced ? "" : `blur(${(12 * dots).toFixed(2)}px)`; image.style.transform = reduced ? "" : `scale(${+(1 + 0.04 * dots).toFixed(4)})`; }
      }
    };

    const loop = (now: number) => {
      raf = 0;
      draw(now);
      if (alive && visible && status === "running" && !reduced) raf = requestAnimationFrame(loop);
      else if (alive && visible && status === "running") raf = window.setTimeout(() => loop(performance.now()), 120) as unknown as number;
    };
    const kick = () => { if (!raf) loop(performance.now()); };

    readInk(); resize(); kick();
    const sizes = new ResizeObserver(() => { resize(); kick(); });
    sizes.observe(field);
    const seen = new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; if (visible) kick(); });
    seen.observe(field);
    const theme = new MutationObserver(() => { readInk(); kick(); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(raf); sizes.disconnect(); seen.disconnect(); theme.disconnect(); };
  }, [status, progress, index, preview, pitch, reduced, large]);

  return (
    <div ref={fieldRef} className={styles.field} aria-hidden="true">
      <canvas ref={glowRef} className={large ? styles.fieldGlow : undefined} style={large ? undefined : { display: "none" }} />
      <canvas ref={canvasRef} className={styles.fieldCanvas} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview ? <img ref={imageRef} alt="" className={`${styles.image} ${styles.preview}`} draggable={false} decoding="async" src={preview} style={{ opacity: status === "done" || status === "error" ? 1 : 0 }} /> : null}
    </div>
  );
}
