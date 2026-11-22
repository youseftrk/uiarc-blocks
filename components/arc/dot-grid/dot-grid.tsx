"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./dot-grid.module.css";

export interface DotGridProps {
  gap?: number;
  dotSize?: number;
  radius?: number;
  strength?: number;
  ripple?: boolean;
  fade?: boolean;
  color?: string;
  activeColor?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface RippleWave {
  x: number;
  y: number;
  start: number;
}

function resolveColorToRgb(
  element: HTMLElement,
  value: string,
  fallback: [number, number, number]
): [number, number, number] {
  if (typeof window === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  element.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  element.removeChild(probe);

  // Use a 1x1 canvas to normalize any CSS color (oklch, hsl, rgb, hex, etc.) to sRGB
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = computed || value;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0], data[1], data[2]];
}

const RIPPLE_SPEED = 620; // px / s
const RIPPLE_DURATION = 1500; // ms
const MAX_RIPPLES = 6;
const RIPPLE_BAND = 72;

export function DotGrid({
  gap = 22,
  dotSize = 1.4,
  radius = 150,
  strength = 16,
  ripple = true,
  fade = true,
  color,
  activeColor,
  children,
  className,
  style,
}: DotGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const safeGap = Math.max(8, gap);
    const safeDot = Math.max(0.5, dotSize);
    const safeRadius = Math.max(20, radius);

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Typed arrays for dot state
    let count = 0;
    let baseX = new Float32Array(0);
    let baseY = new Float32Array(0);
    let ox = new Float32Array(0);
    let oy = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let heat = new Float32Array(0);

    let restRgb: [number, number, number] = [140, 140, 150];
    let activeRgb: [number, number, number] = [59, 130, 246];

    const refreshColors = () => {
      restRgb = resolveColorToRgb(
        root,
        color ?? "var(--border-strong, var(--border))",
        [150, 150, 160]
      );
      activeRgb = resolveColorToRgb(
        root,
        activeColor ?? "var(--accent)",
        [59, 130, 246]
      );
    };

    const rebuildGrid = () => {
      const rect = root.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const cols = Math.max(1, Math.floor((width - safeGap * 0.5) / safeGap) + 1);
      const rows = Math.max(1, Math.floor((height - safeGap * 0.5) / safeGap) + 1);
      const startX = (width - (cols - 1) * safeGap) / 2;
      const startY = (height - (rows - 1) * safeGap) / 2;

      count = cols * rows;
      baseX = new Float32Array(count);
      baseY = new Float32Array(count);
      ox = new Float32Array(count);
      oy = new Float32Array(count);
      vx = new Float32Array(count);
      vy = new Float32Array(count);
      heat = new Float32Array(count);

      let idx = 0;
      for (let r = 0; r < rows; r++) {
        const y = startY + r * safeGap;
        for (let c = 0; c < cols; c++) {
          baseX[idx] = startX + c * safeGap;
          baseY[idx] = y;
          idx++;
        }
      }
    };

    refreshColors();
    rebuildGrid();

    // Pointer & lens state
    let pointerActive = false;
    let targetPx = width / 2;
    let targetPy = height / 2;
    let lensX = targetPx;
    let lensY = targetPy;
    let lensAlpha = 0;
    const ripples: RippleWave[] = [];

    let visible = true;
    let rafId = 0;
    let lastTime = performance.now();

    const drawStatic = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${restRgb[0]}, ${restRgb[1]}, ${restRgb[2]})`;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = baseX[i];
        const y = baseY[i];
        ctx.moveTo(x + safeDot, y);
        ctx.arc(x, y, safeDot, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const tick = (now: number) => {
      rafId = 0;
      if (!visible) return;

      const dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Trail pointer smoothly and fade lens in/out
      const follow = 1 - Math.exp(-18 * dt);
      lensX += (targetPx - lensX) * follow;
      lensY += (targetPy - lensY) * follow;
      const targetAlpha = pointerActive ? 1 : 0;
      lensAlpha += (targetAlpha - lensAlpha) * (1 - Math.exp(-12 * dt));
      if (Math.abs(lensAlpha - targetAlpha) < 0.003) lensAlpha = targetAlpha;

      // Prune expired ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (now - ripples[i].start > RIPPLE_DURATION) {
          ripples.splice(i, 1);
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const stiffness = 190;
      const damping = 16;
      const twoPi = Math.PI * 2;
      const invRadius = 1 / safeRadius;

      let moving = pointerActive || lensAlpha > 0.004 || ripples.length > 0;

      // First pass: update physics and batch resting dots in one path
      ctx.fillStyle = `rgb(${restRgb[0]}, ${restRgb[1]}, ${restRgb[2]})`;
      ctx.beginPath();

      for (let i = 0; i < count; i++) {
        const bx = baseX[i];
        const by = baseY[i];
        let tx = 0;
        let ty = 0;
        let h = 0;

        // Lens displacement (peaks at ~1/3 of radius, fades to 0 at rim)
        if (lensAlpha > 0.004) {
          const dx = bx - lensX;
          const dy = by - lensY;
          const distSq = dx * dx + dy * dy;
          if (distSq < safeRadius * safeRadius) {
            const dist = Math.sqrt(distSq);
            const t = dist * invRadius; // 0..1
            // Smooth lens curve peaking around t = 1/3
            const env = Math.sin(Math.pow(t, 0.72) * Math.PI) * (1 - t * 0.25);
            const tint = Math.pow(1 - t, 1.35) * lensAlpha;
            h = Math.max(h, tint);
            if (!reducedMotion && dist > 0.001) {
              const push = env * strength * lensAlpha;
              tx += (dx / dist) * push;
              ty += (dy / dist) * push;
            }
          }
        }

        // Ripples
        if (!reducedMotion && ripples.length > 0) {
          for (let r = 0; r < ripples.length; r++) {
            const wave = ripples[r];
            const age = now - wave.start;
            const waveRadius = (age / 1000) * RIPPLE_SPEED;
            const decay = Math.max(0, 1 - age / RIPPLE_DURATION);
            const dx = bx - wave.x;
            const dy = by - wave.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const delta = dist - waveRadius;
            if (Math.abs(delta) < RIPPLE_BAND && dist > 0.001) {
              const band = Math.cos((delta / RIPPLE_BAND) * (Math.PI / 2));
              const force = band * band * decay;
              const push = force * strength * 0.95;
              tx += (dx / dist) * push;
              ty += (dy / dist) * push;
              h = Math.max(h, force * 0.95);
            }
          }
        }

        if (reducedMotion) {
          ox[i] = 0;
          oy[i] = 0;
          vx[i] = 0;
          vy[i] = 0;
          heat[i] += (h - heat[i]) * Math.min(1, dt * 16);
        } else {
          const ax = (tx - ox[i]) * stiffness - vx[i] * damping;
          const ay = (ty - oy[i]) * stiffness - vy[i] * damping;
          vx[i] += ax * dt;
          vy[i] += ay * dt;
          ox[i] += vx[i] * dt;
          oy[i] += vy[i] * dt;
          heat[i] += (h - heat[i]) * Math.min(1, dt * 14);

          if (
            Math.abs(ox[i]) > 0.04 ||
            Math.abs(oy[i]) > 0.04 ||
            Math.abs(vx[i]) > 0.08 ||
            Math.abs(vy[i]) > 0.08
          ) {
            moving = true;
          } else if (tx === 0 && ty === 0) {
            ox[i] = 0;
            oy[i] = 0;
            vx[i] = 0;
            vy[i] = 0;
          }
        }

        if (heat[i] > 0.02) {
          moving = true;
        } else {
          heat[i] = 0;
          const x = bx + ox[i];
          const y = by + oy[i];
          ctx.moveTo(x + safeDot, y);
          ctx.arc(x, y, safeDot, 0, twoPi);
        }
      }

      ctx.fill();

      // Second pass: active/tinted dots
      for (let i = 0; i < count; i++) {
        const h = heat[i];
        if (h <= 0.02) continue;
        const clamped = Math.min(1, h);
        const r = Math.round(restRgb[0] + (activeRgb[0] - restRgb[0]) * clamped);
        const g = Math.round(restRgb[1] + (activeRgb[1] - restRgb[1]) * clamped);
        const b = Math.round(restRgb[2] + (activeRgb[2] - restRgb[2]) * clamped);
        const dotR = reducedMotion
          ? safeDot
          : safeDot * (1 + clamped * 0.72);
        const x = baseX[i] + ox[i];
        const y = baseY[i] + oy[i];
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, twoPi);
        ctx.fill();
      }

      if (moving) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const ensureLoop = () => {
      if (!visible || rafId) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const updatePointer = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      targetPx = e.clientX - rect.left;
      targetPy = e.clientY - rect.top;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !pointerActive) return;
      updatePointer(e);
      if (!pointerActive) {
        lensX = targetPx;
        lensY = targetPy;
      }
      pointerActive = true;
      ensureLoop();
    };

    const handlePointerDown = (e: PointerEvent) => {
      updatePointer(e);
      if (e.pointerType === "touch") {
        lensX = targetPx;
        lensY = targetPy;
        pointerActive = true;
      }
      if (ripple && !reducedMotion) {
        ripples.push({ x: targetPx, y: targetPy, start: performance.now() });
        if (ripples.length > MAX_RIPPLES) {
          ripples.shift();
        }
      }
      ensureLoop();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        pointerActive = false;
        ensureLoop();
      }
    };

    const handlePointerLeave = () => {
      pointerActive = false;
      ensureLoop();
    };

    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointerup", handlePointerUp);
    root.addEventListener("pointercancel", handlePointerUp);
    root.addEventListener("pointerleave", handlePointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      rebuildGrid();
      drawStatic();
      ensureLoop();
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) {
          drawStatic();
          ensureLoop();
        } else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { threshold: 0.01 }
    );
    intersectionObserver.observe(root);

    // Watch theme changes on <html> so CSS token colors update live
    const themeObserver = new MutationObserver(() => {
      refreshColors();
      drawStatic();
      ensureLoop();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    drawStatic();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("pointercancel", handlePointerUp);
      root.removeEventListener("pointerleave", handlePointerLeave);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [gap, dotSize, radius, strength, ripple, color, activeColor, reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-fade={fade ? "true" : "false"}
      style={style}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {children ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
}
