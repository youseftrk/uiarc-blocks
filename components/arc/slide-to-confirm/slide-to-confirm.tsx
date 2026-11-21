"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import styles from "./slide-to-confirm.module.css";

export interface SlideToConfirmProps {
  label?: string;
  confirmedLabel?: string;
  pendingLabel?: string;
  errorLabel?: string;
  onConfirm?: () => void | Promise<unknown>;
  threshold?: number;
  resetAfter?: number;
  hint?: boolean;
  disabled?: boolean;
  accent?: string;
  className?: string;
}

type Status = "idle" | "pending" | "confirmed" | "error";

const THUMB_SIZE = 46;
const TRACK_PAD = 4;

export function SlideToConfirm({
  label = "Slide to pay",
  confirmedLabel = "Paid",
  pendingLabel = "Processing",
  errorLabel = "Payment failed, slide to retry",
  onConfirm,
  threshold = 0.9,
  resetAfter,
  hint = true,
  disabled = false,
  accent,
  className,
}: SlideToConfirmProps) {
  const prefersReduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [maxTravel, setMaxTravel] = useState(220);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const dragStartRef = useRef<{ clientX: number; startX: number } | null>(null);

  const x = useMotionValue(0);
  const fillWidth = useSpring(
    useTransform(x, (v) => Math.max(THUMB_SIZE, v + THUMB_SIZE)),
    { stiffness: 260, damping: 28 }
  );
  const labelOpacity = useTransform(x, [0, maxTravel * 0.6], [1, 0]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setMaxTravel(Math.max(40, w - THUMB_SIZE - TRACK_PAD * 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!hint || prefersReduced || touched || disabled || status !== "idle") return;
    const id = window.setInterval(() => {
      if (dragStartRef.current) return;
      animate(x, [0, 14, 0], { duration: 0.85, ease: [0.22, 1, 0.36, 1] });
    }, 3600);
    return () => window.clearInterval(id);
  }, [hint, prefersReduced, touched, disabled, status, x]);

  const triggerConfirm = useCallback(async () => {
    setStatus("pending");
    try {
      const res = onConfirm?.();
      if (res && typeof (res as Promise<unknown>).then === "function") {
        await res;
      }
      setStatus("confirmed");
      if (resetAfter && resetAfter > 0) {
        window.setTimeout(() => {
          setStatus("idle");
          x.set(0);
        }, resetAfter);
      }
    } catch {
      setStatus("error");
      animate(x, 0, {
        type: "spring",
        stiffness: 420,
        damping: 32,
      });
    }
  }, [onConfirm, resetAfter, x]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || status === "pending" || status === "confirmed") return;
    setTouched(true);
    setDragging(true);
    if (status === "error") setStatus("idle");
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { clientX: e.clientX, startX: x.get() };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const delta = e.clientX - dragStartRef.current.clientX;
    const raw = dragStartRef.current.startX + delta;
    if (raw < 0) {
      x.set(0);
    } else if (raw > maxTravel) {
      const over = raw - maxTravel;
      x.set(maxTravel + over * 0.16);
    } else {
      x.set(raw);
    }
  };

  const handlePointerUp = () => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setDragging(false);
    const ratio = x.get() / Math.max(1, maxTravel);
    if (ratio >= threshold) {
      animate(x, maxTravel, { type: "spring", stiffness: 460, damping: 34 });
      void triggerConfirm();
    } else {
      animate(x, 0, { type: "spring", stiffness: 440, damping: 30 });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || status === "pending" || status === "confirmed") return;
    setTouched(true);
    const step = maxTravel * 0.2;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(maxTravel, x.get() + step);
      x.set(next);
      if (next / maxTravel >= threshold) void triggerConfirm();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      x.set(Math.max(0, x.get() - step));
    } else if (e.key === "End" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      x.set(maxTravel);
      void triggerConfirm();
    } else if (e.key === "Home") {
      e.preventDefault();
      x.set(0);
    }
  };

  const pct = Math.min(100, Math.max(0, Math.round((x.get() / Math.max(1, maxTravel)) * 100)));
  const isSettled = status === "pending" || status === "confirmed";

  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`}
      style={
        accent ? ({ "--slide-accent": accent } as CSSProperties) : undefined
      }
    >
      <motion.div
        ref={trackRef}
        className={`${styles.track} ${disabled ? styles.trackDisabled : ""} ${
          status === "error" ? styles.trackError : ""
        } ${status === "confirmed" ? styles.trackConfirmed : ""}`}
        animate={
          prefersReduced
            ? undefined
            : {
                scale: dragging ? 1.015 : 1,
              }
        }
        transition={{ type: "spring", stiffness: 440, damping: 30 }}
      >
        {!isSettled && (
          <>
            <motion.div
              className={styles.liquidFill}
              style={{ width: fillWidth }}
              aria-hidden="true"
            />
            <motion.span
              className={`${styles.label} ${
                status === "error" ? styles.labelError : ""
              }`}
              style={{ opacity: labelOpacity }}
            >
              {status === "error" ? errorLabel : label}
            </motion.span>
            <motion.div
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-disabled={disabled}
              className={styles.thumb}
              style={{ x }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={handleKeyDown}
            >
              <ChevronRight size={20} strokeWidth={2.4} />
            </motion.div>
          </>
        )}

        {status === "pending" && (
          <motion.div
            key="pending"
            className={styles.statusPill}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Loader2 size={17} className={styles.spinner} />
            <span>{pendingLabel}</span>
          </motion.div>
        )}

        {status === "confirmed" && (
          <motion.div
            key="confirmed"
            className={`${styles.statusPill} ${styles.statusConfirmed}`}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 460, damping: 28 }}
          >
            <Check size={18} strokeWidth={2.6} />
            <span>{confirmedLabel}</span>
          </motion.div>
        )}
      </motion.div>

      <span role="status" aria-live="polite" className={styles.srOnly}>
        {status === "pending"
          ? pendingLabel
          : status === "confirmed"
            ? confirmedLabel
            : status === "error"
              ? errorLabel
              : ""}
      </span>
    </div>
  );
}
