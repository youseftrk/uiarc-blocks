"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, X } from "lucide-react";
import styles from "./social-proof-toast.module.css";

export interface SocialProofEvent {
  id: string;
  name: string;
  action: string;
  meta?: string;
  time?: Date | number | string;
  avatar?: string;
  logo?: ReactNode;
  verified?: string | boolean;
}

export interface SocialProofToastProps {
  events: SocialProofEvent[];
  position?: "bottom-left" | "bottom-right";
  interval?: number;
  limit?: number;
  maxVisible?: number;
  onShow?: (event: SocialProofEvent) => void;
  onDismiss?: (event: SocialProofEvent) => void;
  className?: string;
}

function formatRelative(time?: Date | number | string): string {
  if (!time) return "just now";
  if (typeof time === "string") return time;
  const ts = time instanceof Date ? time.getTime() : time;
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function SocialProofToast({
  events,
  position = "bottom-left",
  interval = 3400,
  limit = 6,
  maxVisible = 3,
  onShow,
  onDismiss,
  className,
}: SocialProofToastProps) {
  const prefersReduced = useReducedMotion();
  const [cursor, setCursor] = useState(1);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  const pool = useMemo(() => events.slice(0, limit), [events, limit]);

  useEffect(() => {
    if (expanded || pool.length <= 1) return;
    const id = window.setInterval(() => {
      setCursor((c) => {
        const next = Math.min(pool.length, c + 1);
        if (next === c) return 1;
        const shown = pool[next - 1];
        if (shown) onShow?.(shown);
        return next;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [expanded, interval, onShow, pool]);

  const visible = useMemo(() => {
    const active = pool
      .slice(0, cursor)
      .filter((e) => !dismissed.includes(e.id));
    return active.slice(-maxVisible);
  }, [cursor, dismissed, maxVisible, pool]);

  const dismiss = (event: SocialProofEvent) => {
    setDismissed((prev) => [...prev, event.id]);
    onDismiss?.(event);
  };

  return (
    <div
      className={`${styles.viewport} ${
        position === "bottom-right" ? styles.viewportRight : ""
      } ${className ?? ""}`}
    >
      <div
        className={styles.stack}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {visible.map((event, idx) => {
            const depthFromFront = visible.length - 1 - idx;
            const collapsedY = depthFromFront * -8;
            const collapsedScale = 1 - depthFromFront * 0.04;
            return (
              <motion.div
                key={event.id}
                layout
                initial={
                  prefersReduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: 18, scale: 0.96 }
                }
                animate={{
                  opacity: expanded ? 1 : Math.max(0.55, 1 - depthFromFront * 0.18),
                  y: expanded ? 0 : collapsedY,
                  scale: expanded ? 1 : collapsedScale,
                }}
                exit={
                  prefersReduced
                    ? { opacity: 0 }
                    : { opacity: 0, x: position === "bottom-right" ? 28 : -28 }
                }
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={styles.toast}
                style={{
                  marginBottom: !expanded && depthFromFront > 0 ? -52 : 0,
                  zIndex: idx + 1,
                }}
              >
                <div
                  className={`${styles.avatar} ${
                    !event.logo ? styles.avatarCircle : ""
                  }`}
                >
                  {event.logo ? event.logo : initialsOf(event.name)}
                </div>
                <div className={styles.body}>
                  <div className={styles.line}>
                    <span className={styles.name}>{event.name}</span> {event.action}
                  </div>
                  <div className={styles.metaRow}>
                    {event.meta && <span>{event.meta}</span>}
                    <span>· {formatRelative(event.time)}</span>
                    {event.verified && (
                      <span className={styles.verified}>
                        <BadgeCheck size={12} />
                        {typeof event.verified === "string" ? event.verified : "Verified"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.dismiss}
                  aria-label={`Dismiss ${event.name}`}
                  onClick={() => dismiss(event)}
                >
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
