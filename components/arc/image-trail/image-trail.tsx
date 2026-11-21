"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./image-trail.module.css";

export interface ImageTrailImage { src: string; alt?: string }

export interface ImageTrailProps {
  images: ImageTrailImage[];
  children?: ReactNode;
  spacing?: number;
  lifetime?: number;
  size?: number;
  aspectRatio?: number;
  maxTilt?: number;
  poolSize?: number;
  intro?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

const MIN_GAP = 40, ENTER = 420, EXIT = 760;
// The shared spring curve, sampled for WAAPI.
const SPRING = "linear(0, 0.0605, 0.2061, 0.3901, 0.5786, 0.7495, 0.8911, 0.9988, 1.0728, 1.1166, 1.1352, 1.1344, 1.1198, 1.0965, 1.069, 1.0405, 1.0137, 0.9901, 0.9709, 0.9563, 0.9464, 0.9408, 0.9388, 0.9397, 0.9427, 0.9472, 0.9525, 0.9581, 0.9636, 0.9687, 0.9732, 0.977, 0.98, 0.9823, 0.984, 1)";
const SOFT = "cubic-bezier(0.22, 1, 0.36, 1)";

export function ImageTrail({ images, children, spacing = 90, lifetime = 700, size = 168, aspectRatio = 4 / 5, maxTilt = 10, poolSize = 14, intro = false, disabled = false, className, style }: ImageTrailProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const height = size / aspectRatio;

  useEffect(() => { images.forEach(image => { const preload = new Image(); preload.decoding = "async"; preload.src = image.src; }); }, [images]);

  useEffect(() => {
    const root = rootRef.current, trail = trailRef.current;
    if (!root || !trail || !images.length) return;
    const nodes = Array.from(trail.children) as HTMLElement[];
    const running: (Animation | null)[] = nodes.map(() => null);
    let slot = 0, shown = 0, layer = 1, last: { x: number; y: number; t: number } | null = null, spawnedAt = 0, travelled = 0, vx = 0, vy = 0, touched = false, down = false;
    const gap = reduced ? spacing * 1.6 : spacing;

    const spawn = (x: number, y: number, speedX: number, speedY: number) => {
      const node = nodes[slot], image = node.firstElementChild as HTMLImageElement, index = slot;
      slot = (slot + 1) % nodes.length;
      const photo = images[shown % images.length];
      if (image.getAttribute("src") !== photo.src) image.src = photo.src;
      node.style.width = `${size}px`; node.style.height = `${height}px`; node.style.zIndex = String(++layer);
      running[index]?.cancel();
      const left = x - size / 2, top = y - height / 2;
      let frames: Keyframe[];
      if (reduced) {
        const at = `translate3d(${left}px, ${top}px, 0)`;
        frames = [{ opacity: 0, transform: at }, { opacity: 1, transform: at, offset: 0.25 }, { opacity: 1, transform: at, offset: 0.65 }, { opacity: 0, transform: at }];
      } else {
        // Lean with horizontal speed, plus a small fixed variation per photo.
        const lean = Math.max(-maxTilt, Math.min(maxTilt, (speedX / 1.6) * maxTilt)) + ((shown * 47) % 7 - 3) * 0.6;
        const driftX = Math.max(-90, Math.min(90, speedX * 60)), driftY = Math.max(-90, Math.min(90, speedY * 60));
        const total = lifetime + EXIT, entered = ENTER / total, held = lifetime / total;
        const place = (dx: number, dy: number, scale: number, turn: number) => `translate3d(${(left + dx).toFixed(1)}px, ${(top + dy).toFixed(1)}px, 0) rotate(${turn.toFixed(2)}deg) scale(${scale})`;
        frames = [
          { opacity: 0, transform: place(0, 0, 0.6, lean * 1.4), easing: SPRING },
          { opacity: 1, transform: place(driftX * 0.18, driftY * 0.18, 1, lean), offset: entered, easing: "linear" },
          { opacity: 1, transform: place(driftX * 0.45, driftY * 0.45, 1, lean * 0.8), offset: held, easing: SOFT },
          { opacity: 0, transform: place(driftX, driftY, 0.82, lean * 0.5) },
        ];
      }
      shown += 1;
      const animation = node.animate(frames, { duration: lifetime + EXIT, fill: "both" });
      running[index] = animation;
      animation.onfinish = () => { if (running[index] === animation) { animation.cancel(); running[index] = null; } };
    };

    const move = (clientX: number, clientY: number, time: number) => {
      const box = root.getBoundingClientRect(), x = clientX - box.left, y = clientY - box.top;
      if (!last) { last = { x, y, t: time }; return; }
      const dt = Math.max(1, time - last.t), dx = x - last.x, dy = y - last.y;
      vx += (dx / dt - vx) * 0.35; vy += (dy / dt - vy) * 0.35;
      travelled += Math.hypot(dx, dy);
      last = { x, y, t: time };
      if (travelled >= gap && time - spawnedAt >= MIN_GAP) { travelled = 0; spawnedAt = time; spawn(x, y, vx, vy); }
    };

    const onMove = (event: PointerEvent) => {
      if (disabled) return;
      if (event.pointerType === "touch" && !down) return;
      touched = true;
      move(event.clientX, event.clientY, event.timeStamp);
    };
    const onDown = (event: PointerEvent) => { if (event.pointerType === "touch") { down = true; last = null; travelled = 0; } };
    const onUp = () => { down = false; };
    const onLeave = () => { last = null; travelled = 0; vx = vy = 0; };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("pointerleave", onLeave);

    // One S-curve sweep the first time the area scrolls into view.
    let raf = 0, observer: IntersectionObserver | null = null;
    if (intro && !reduced && !disabled) {
      observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer?.disconnect(); observer = null;
        const start = performance.now() + 350, length = 1500;
        const step = (now: number) => {
          if (touched) return;
          const t = (now - start) / length;
          if (t >= 0 && t <= 1) {
            const box = root.getBoundingClientRect(), eased = t * t * (3 - 2 * t);
            move(box.left + box.width * (0.16 + 0.68 * eased), box.top + box.height * (0.5 - 0.24 * Math.sin(eased * Math.PI * 2)), now);
          }
          if (t <= 1) raf = requestAnimationFrame(step); else { last = null; travelled = 0; }
        };
        raf = requestAnimationFrame(step);
      }, { threshold: 0.5 });
      observer.observe(root);
    }

    return () => {
      root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerdown", onDown); root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp); root.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf); observer?.disconnect();
      running.forEach(animation => animation?.cancel());
    };
  }, [disabled, height, images, intro, lifetime, maxTilt, poolSize, reduced, size, spacing]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-disabled={disabled ? "" : undefined}>
      <div ref={trailRef} className={styles.trail} aria-hidden="true">
        {Array.from({ length: Math.max(1, poolSize) }, (_, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <div key={index} className={styles.photo}><img alt="" draggable={false} decoding="async" /></div>
        ))}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export default ImageTrail;
