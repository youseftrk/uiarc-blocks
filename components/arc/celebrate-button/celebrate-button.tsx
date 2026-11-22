"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import styles from "./celebrate-button.module.css";

export type CelebrateStatus = "idle" | "pending" | "success" | "error";

export interface CelebrateButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The resting label. */
  children: ReactNode;
  /** Runs on press. A promise shows the pending state; a rejection shows the error label without a burst. */
  onAction?: () => void | Promise<unknown>;
  /** Controlled status. Moving to success plays the burst. */
  status?: CelebrateStatus;
  onStatusChange?: (status: CelebrateStatus) => void;
  successLabel?: ReactNode;
  pendingLabel?: ReactNode;
  errorLabel?: ReactNode;
  /** Milliseconds before returning to rest. 0 stays done. */
  resetAfter?: number;
  /** Shortest time in ms between two bursts. */
  cooldown?: number;
  /** Confetti colours. Defaults to the accent in three tones, a sunny yellow, and a little ink. */
  colors?: string[];
  /** Pieces per burst. */
  particles?: number;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  shape: 0 | 1 | 2;
  color: string;
  angle: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  sway: number;
  swaySpeed: number;
  life: number;
  ttl: number;
}

const SIDE = 150;
const ABOVE = 190;
const BELOW = 110;
const MAX_PIECES = 180;

function themeColors(el: Element) {
  const cs = getComputedStyle(el);
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const accent = read("--accent", "#2563eb");
  return [
    accent,
    accent,
    `color-mix(in oklab, ${accent} 62%, white)`,
    `color-mix(in oklab, ${accent} 78%, black)`,
    "oklch(0.86 0.17 92)",
    read("--foreground", "#111"),
  ];
}

/** A point on the outline of a pill, as a fraction of its perimeter, with the outward normal. */
function onOutline(w: number, h: number, t: number) {
  const r = Math.min(h / 2, w / 2);
  const straight = Math.max(0, w - 2 * r);
  const arc = Math.PI * r;
  const total = 2 * straight + 2 * arc;
  let d = t * total;
  if (d < straight) return { x: r + d, y: 0, nx: 0, ny: -1 };
  d -= straight;
  if (d < arc) {
    const a = -Math.PI / 2 + d / r;
    return { x: w - r + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  d -= arc;
  if (d < straight) return { x: w - r - d, y: h, nx: 0, ny: 1 };
  d -= straight;
  const a = Math.PI / 2 + d / r;
  return { x: r + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
}

/** A button that bursts confetti from its own edges when its action succeeds, while the label morphs to a done state and the width springs to fit. */
export function CelebrateButton({
  children,
  onAction,
  status: controlled,
  onStatusChange,
  successLabel = "Done",
  pendingLabel,
  errorLabel = "Try again",
  resetAfter = 2400,
  cooldown = 1200,
  colors,
  particles = 44,
  className,
  onClick,
  disabled,
  type = "button",
  ...rest
}: CelebrateButtonProps) {
  const reduced = useReducedMotion() ?? false;
  const [inner, setInner] = useState<CelebrateStatus>("idle");
  const status = controlled ?? inner;
  const [width, setWidth] = useState<number | null>(null);
  const [bursting, setBursting] = useState<{ w: number; h: number; dpr: number } | null>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pieces = useRef<Piece[]>([]);
  const frame = useRef(0);
  const lastBurst = useRef(-Infinity);
  const kick = useMotionValue(1);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const change = useCallback(
    (next: CelebrateStatus) => {
      if (controlled === undefined) setInner(next);
      onStatusChange?.(next);
    },
    [controlled, onStatusChange],
  );

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = canvas.width / canvas.clientWidth || 1;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const drag = Math.pow(0.12, dt);
      pieces.current = pieces.current.filter((p) => p.life < p.ttl);
      for (const p of pieces.current) {
        p.life += dt;
        p.vx *= drag;
        p.vy = p.vy * drag + 520 * dt;
        p.sway += p.swaySpeed * dt;
        p.x += (p.vx + Math.sin(p.sway) * 26) * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        const k = p.life / p.ttl;
        ctx.globalAlpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (p.shape === 2) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.scale(1, Math.max(0.12, Math.abs(Math.cos(p.flip))));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (pieces.current.length) frame.current = requestAnimationFrame(step);
      else {
        frame.current = 0;
        if (alive.current) setBursting(null);
      }
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
  }, []);

  const burst = useCallback(() => {
    const button = buttonRef.current;
    const now = performance.now();
    if (reduced || !button || now - lastBurst.current < cooldown) return;
    lastBurst.current = now;
    const w = button.offsetWidth;
    const h = button.offsetHeight;
    const palette = colors?.length ? colors : themeColors(button);
    const room = Math.max(0, MAX_PIECES - pieces.current.length);
    for (let i = 0; i < Math.min(particles, room); i++) {
      const at = onOutline(w, h, Math.random());
      const speed = 190 + Math.random() * 330;
      const shape = (Math.random() < 0.45 ? 0 : Math.random() < 0.6 ? 1 : 2) as 0 | 1 | 2;
      const size = 5 + Math.random() * 4;
      pieces.current.push({
        x: SIDE + at.x,
        y: ABOVE + at.y,
        vx: at.nx * speed * 0.9 + (Math.random() - 0.5) * 140,
        vy: at.ny * speed * 0.55 - (220 + Math.random() * 300),
        w: shape === 0 ? size * 1.7 : size,
        h: shape === 0 ? size * 0.55 : size,
        shape,
        color: palette[Math.floor(Math.random() * palette.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 9,
        flip: Math.random() * Math.PI,
        flipSpeed: 5 + Math.random() * 9,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 3 + Math.random() * 4,
        life: 0,
        ttl: 1.1 + Math.random() * 0.75,
      });
    }
    kick.set(1.07);
    animate(kick, 1, { type: "spring", stiffness: 420, damping: 16, mass: 0.8 });
    setBursting((b) => b ?? { w, h, dpr: Math.min(2, window.devicePixelRatio || 1) });
  }, [reduced, cooldown, colors, particles, kick]);

  /* The canvas only exists during a burst. */
  useEffect(() => {
    if (bursting && !frame.current) run();
  }, [bursting, run]);

  const seen = useRef<CelebrateStatus>(status);
  useEffect(() => {
    const before = seen.current;
    seen.current = status;
    if (status === before) return;
    if (status === "success") burst();
    if ((status === "success" || status === "error") && resetAfter > 0) {
      const timer = setTimeout(() => change("idle"), resetAfter);
      return () => clearTimeout(timer);
    }
  }, [status, burst, resetAfter, change]);

  const press = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (status === "pending" || status === "success") {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented) return;
    try {
      const result = onAction?.();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        change("pending");
        await result;
      }
      if (alive.current) change("success");
    } catch {
      if (alive.current) change("error");
    }
  };

  const content =
    status === "pending" ? (
      <>
        <span className={styles.spinner} aria-hidden="true" />
        <span>{pendingLabel ?? children}</span>
      </>
    ) : status === "success" ? (
      <>
        <Check className={styles.icon} size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>{successLabel}</span>
      </>
    ) : (
      <span>{status === "error" ? errorLabel : children}</span>
    );

  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")}>
      <span className={styles.measure} ref={measureRef} aria-hidden="true">
        <span className={styles.label}>{content}</span>
      </span>
      <motion.span className={styles.pop} style={{ scale: kick }}>
        <motion.button
          {...(rest as object)}
          ref={buttonRef}
          type={type}
          className={styles.button}
          data-status={status}
          disabled={disabled}
          aria-disabled={status === "pending" ? true : undefined}
          aria-busy={status === "pending" ? true : undefined}
          initial={false}
          animate={width === null ? undefined : { width }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
          whileTap={reduced || disabled || status === "pending" || status === "success" ? undefined : { scale: 0.96 }}
          onClick={press}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              className={styles.label}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: reduced ? 0.12 : 0.2, ease: [0.2, 0, 0, 1] }}
            >
              {content}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </motion.span>
      {bursting && (
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-hidden="true"
          width={Math.round((bursting.w + SIDE * 2) * bursting.dpr)}
          height={Math.round((bursting.h + ABOVE + BELOW) * bursting.dpr)}
          style={{ left: -SIDE, top: -ABOVE, width: bursting.w + SIDE * 2, height: bursting.h + ABOVE + BELOW }}
        />
      )}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {status === "success" ? successLabel : status === "error" ? errorLabel : null}
      </span>
    </span>
  );
}

export default CelebrateButton;
