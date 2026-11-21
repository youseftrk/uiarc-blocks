"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./orbit-menu.module.css";

export interface OrbitMenuAction {
  id: string;
  label: string;
  icon: ReactNode;
  /** Short confirmation shown after firing. Defaults to the label. */
  done?: string;
  tone?: "neutral" | "danger";
}

export interface OrbitMenuProps {
  actions: OrbitMenuAction[];
  onAction: (id: string) => void;
  label?: string;
  radius?: number;
  spread?: number;
  direction?: number;
  disabled?: boolean;
  announce?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const DEAD_ZONE = 34;
const DONE_MS = 1400;
const HOLD_MS = 260;
const RAD = Math.PI / 180;

const DOTS = [
  { x1: 6, y1: 12, x2: 6.01, y2: 12 },
  { x1: 18, y1: 12, x2: 18.01, y2: 12 },
  { x1: 12, y1: 12, x2: 12.01, y2: 12 },
];
const CROSS = [
  { x1: 7, y1: 7, x2: 17, y2: 17 },
  { x1: 17, y1: 7, x2: 7, y2: 17 },
  { x1: 12, y1: 12, x2: 12.01, y2: 12 },
];
const TICK = [
  { x1: 5.5, y1: 12.5, x2: 10, y2: 17 },
  { x1: 18.5, y1: 7, x2: 10, y2: 17 },
  { x1: 10, y1: 17, x2: 10.01, y2: 17 },
];

const SPRING = { type: "spring", duration: 0.45, bounce: 0.22 } as const;
const SOFT = { type: "spring", duration: 0.35, bounce: 0 } as const;
const FOLLOW = { type: "spring", stiffness: 520, damping: 34, mass: 0.6 } as const;

function angleGap(a: number, b: number) {
  let gap = (a - b) % 360;
  if (gap > 180) gap -= 360;
  if (gap < -180) gap += 360;
  return gap;
}

export function OrbitMenu({
  actions,
  onAction,
  label = "Actions",
  radius = 104,
  spread = 150,
  direction = -90,
  disabled = false,
  announce = true,
  onOpenChange,
  className,
}: OrbitMenuProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpenState] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [cancel, setCancel] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [roving, setRoving] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [pillWidth, setPillWidth] = useState<number | null>(null);
  const [said, setSaid] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const measureRef = useRef<HTMLSpanElement>(null);
  const press = useRef<{ id: number; at: number; moved: boolean; wasOpen: boolean } | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);

  const count = actions.length;
  const points = useMemo(
    () =>
      actions.map((_, i) => {
        const angle = count > 1 ? direction - spread / 2 + (spread * i) / (count - 1) : direction;
        return { angle, x: radius * Math.cos(angle * RAD), y: radius * Math.sin(angle * RAD) };
      }),
    [actions, count, direction, radius, spread],
  );
  const step = count > 1 ? spread / (count - 1) : spread;
  const inner = radius / 2;
  const anchor = { x: inner * Math.cos(direction * RAD), y: inner * Math.sin(direction * RAD) };
  const arcs = useMemo(() => {
    const end = (sign: number) => {
      const a = (direction + (sign * spread) / 2) * RAD;
      return `${(radius * Math.cos(a)).toFixed(2)} ${(radius * Math.sin(a)).toFixed(2)}`;
    };
    const top = direction * RAD;
    const start = `M${(radius * Math.cos(top)).toFixed(2)} ${(radius * Math.sin(top)).toFixed(2)} A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0`;
    return [`${start} 0 ${end(-1)}`, `${start} 1 ${end(1)}`];
  }, [direction, radius, spread]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openRef.current === next) return;
      openRef.current = next;
      setOpenState(next);
      if (!next) {
        setTarget(null);
        setCancel(false);
        setPointer(null);
      }
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (disabled) queueMicrotask(() => setOpen(false));
  }, [disabled, setOpen]);

  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  const fire = useCallback(
    (index: number, refocus: boolean) => {
      const action = actions[index];
      if (!action) return;
      const text = action.done ?? action.label;
      setOpen(false);
      setDone(text);
      setSaid("");
      queueMicrotask(() => setSaid(text));
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(null), DONE_MS);
      if (refocus) triggerRef.current?.focus();
      onAction(action.id);
    },
    [actions, onAction, setOpen],
  );

  const locate = useCallback(
    (clientX: number, clientY: number) => {
      const box = rootRef.current?.getBoundingClientRect();
      if (!box) return { index: null as number | null, outside: false, x: 0, y: 0, far: 0 };
      const x = clientX - (box.left + box.width / 2);
      const y = clientY - (box.top + box.height / 2);
      const far = Math.hypot(x, y);
      if (far < DEAD_ZONE) return { index: null, outside: false, x, y, far };
      const angle = Math.atan2(y, x) / RAD;
      let best = -1;
      let bestGap = Infinity;
      points.forEach((point, i) => {
        const gap = Math.abs(angleGap(angle, point.angle));
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      const within = bestGap <= Math.max(step / 2, 18);
      return { index: within ? best : null, outside: !within, x, y, far };
    },
    [points, step],
  );

  const track = useCallback(
    (event: { clientX: number; clientY: number; pointerType: string }, dragging: boolean) => {
      const hit = locate(event.clientX, event.clientY);
      const reach = radius + 60;
      const index = dragging || hit.far <= reach ? hit.index : null;
      setTarget(index);
      setCancel(dragging && hit.outside);
      setPointer(event.pointerType === "touch" || reduced ? null : { x: hit.x, y: hit.y });
      return hit;
    },
    [locate, radius, reduced],
  );

  const onTriggerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    press.current = { id: event.pointerId, at: performance.now(), moved: false, wasOpen: openRef.current };
    if (doneTimer.current) clearTimeout(doneTimer.current);
    setDone(null);
    setOpen(true);
  };

  const onTriggerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = press.current;
    if (!state || state.id !== event.pointerId) return;
    const hit = track(event, true);
    if (hit.far >= DEAD_ZONE) state.moved = true;
  };

  const onTriggerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = press.current;
    if (!state || state.id !== event.pointerId) return;
    press.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const hit = locate(event.clientX, event.clientY);
    if (state.moved) {
      if (hit.index !== null) fire(hit.index, false);
      else setOpen(false);
      return;
    }
    const held = performance.now() - state.at > HOLD_MS;
    if (state.wasOpen || held) setOpen(false);
    else {
      setTarget(null);
      setCancel(false);
    }
  };

  const onTriggerCancel = () => {
    if (!press.current) return;
    press.current = null;
    setOpen(false);
  };

  // Tap mode: target by angle while the pointer roams near the arc, close on an outside press.
  useEffect(() => {
    if (!open) return;
    const move = (event: PointerEvent) => {
      if (press.current) return;
      track(event, false);
    };
    const down = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down, true);
    };
  }, [open, setOpen, track]);

  const focusItem = (index: number) => {
    const next = (index + count) % count;
    setRoving(next);
    setTarget(next);
    setPointer(null);
    requestAnimationFrame(() => itemRefs.current[next]?.focus());
  };

  const onTriggerKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const key = event.key;
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (openRef.current) setOpen(false);
      else {
        setDone(null);
        setOpen(true);
        focusItem(0);
      }
    } else if (key === "ArrowUp" || key === "End") {
      event.preventDefault();
      setDone(null);
      setOpen(true);
      focusItem(count - 1);
    } else if (key === "ArrowDown" || key === "ArrowRight" || key === "ArrowLeft" || key === "Home") {
      event.preventDefault();
      setDone(null);
      setOpen(true);
      focusItem(0);
    } else if (key === "Escape" && openRef.current) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const onItemKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    if (key === "ArrowRight" || key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (key === "End") {
      event.preventDefault();
      focusItem(count - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      fire(index, true);
    } else if (key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (key === "Tab") {
      setOpen(false);
    }
  };

  const pillText = done ?? (cancel ? "Release to cancel" : target !== null ? actions[target]?.label ?? label : label);
  const pillShown = open || done !== null;

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (node) setPillWidth(Math.ceil(node.getBoundingClientRect().width) + 2);
  }, [pillText, done]);

  const glyph = done !== null ? TICK : open ? CROSS : DOTS;
  const stroke = done !== null ? 2.2 : open ? 2 : 3.2;
  const instant = { duration: reduced ? 0 : 0.12 } as const;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ "--orbit-reach": `${radius + 60}px` } as CSSProperties}
      data-open={open || undefined}
    >
      <div className={styles.field} aria-hidden="true" />
      <svg className={styles.track} width="1" height="1" aria-hidden="true">
        {arcs.map((d) => (
          <motion.path
            key={d}
            d={d}
            pathLength={1}
            strokeDashoffset={0}
            initial={false}
            animate={{ strokeDasharray: open ? "1 1" : "0 1", opacity: open ? 1 : 0 }}
            transition={reduced ? instant : { ...SOFT, duration: 0.5 }}
          />
        ))}
      </svg>
      <motion.span
        className={styles.lens}
        aria-hidden="true"
        initial={false}
        animate={{
          x: target !== null ? points[target].x : points[0]?.x ?? 0,
          y: target !== null ? points[target].y : points[0]?.y ?? 0,
          scale: open && target !== null ? 1.42 : 0,
          opacity: open && target !== null ? 1 : 0,
        }}
        transition={reduced ? { duration: 0 } : { ...SPRING, opacity: { duration: 0.12 } }}
      />
      <motion.button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        data-open={open || undefined}
        initial={false}
        animate={{ scale: open ? 0.94 : 1 }}
        transition={reduced ? { duration: 0 } : SPRING}
        onPointerDown={onTriggerDown}
        onPointerMove={onTriggerMove}
        onPointerUp={onTriggerUp}
        onPointerCancel={onTriggerCancel}
        onKeyDown={onTriggerKey}
        onContextMenu={(event) => event.preventDefault()}
      >
        <motion.svg
          className={styles.glyph}
          viewBox="0 0 24 24"
          aria-hidden="true"
          initial={false}
          animate={{ rotate: open && done === null ? 90 : 0 }}
          transition={reduced ? { duration: 0 } : SPRING}
        >
          {glyph.map((line, i) => (
            <motion.line
              key={i}
              initial={false}
              animate={{ ...line, strokeWidth: stroke }}
              transition={reduced ? { duration: 0 } : SOFT}
            />
          ))}
        </motion.svg>
      </motion.button>
      <div
        id={id}
        role="menu"
        aria-label={label}
        aria-orientation="horizontal"
        className={styles.menu}
        inert={!open}
      >
        {actions.map((action, i) => {
          const point = points[i];
          const active = open && target === i;
          let x = point.x;
          let y = point.y;
          let scale = 1;
          if (open && pointer && !cancel) {
            const dx = pointer.x - point.x;
            const dy = pointer.y - point.y;
            const far = Math.hypot(dx, dy);
            const pull = active ? 0.21 : 0.06 * Math.max(0, 1 - far / 130);
            const reach = active ? Math.min(1, 16 / Math.max(far, 1)) : 1;
            x += dx * pull * Math.min(1, reach + 0.6);
            y += dy * pull * Math.min(1, reach + 0.6);
            scale = active ? 1.4 : 1 + 0.12 * Math.max(0, 1 - far / 110);
          } else if (active) scale = 1.4;
          const delay = reduced ? 0 : open ? i * 0.035 : (count - 1 - i) * 0.025;
          const settled = open && pointer !== null;
          return (
            <motion.button
              key={action.id}
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              type="button"
              role="menuitem"
              aria-label={action.label}
              tabIndex={i === roving ? 0 : -1}
              className={styles.item}
              data-active={active || undefined}
              data-danger={action.tone === "danger" || undefined}
              initial={false}
              animate={
                open
                  ? { opacity: 1, filter: "blur(0px)", x, y, scale }
                  : { opacity: 0, filter: reduced ? "blur(0px)" : "blur(4px)", x: reduced ? x : 0, y: reduced ? y : 0, scale: reduced ? 1 : 0.4 }
              }
              transition={
                reduced
                  ? { duration: 0, opacity: { duration: 0.15 } }
                  : settled
                    ? FOLLOW
                    : { ...SPRING, delay, opacity: { duration: 0.16, delay }, filter: { duration: 0.2, delay } }
              }
              onClick={() => fire(i, document.activeElement === itemRefs.current[i])}
              onFocus={() => {
                setRoving(i);
                if (!press.current) setTarget(i);
              }}
              onKeyDown={(event) => onItemKey(event, i)}
            >
              <motion.span
                className={styles.icon}
                initial={false}
                animate={open ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reduced ? 1 : 0.5 }}
                transition={reduced ? { duration: 0 } : { ...SPRING, delay: delay + (open ? 0.04 : 0) }}
              >
                {action.icon}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
      <div
        className={styles.pillAnchor}
        style={{ left: `calc(50% + ${anchor.x.toFixed(2)}px)`, top: `calc(50% + ${anchor.y.toFixed(2)}px)` }}
        aria-hidden="true"
      >
        <span ref={measureRef} className={`${styles.pillRow} ${styles.measure}`}>
          {done !== null ? <Check size={15} strokeWidth={2.25} /> : null}
          <span>{pillText}</span>
        </span>
        <motion.div
          className={styles.pill}
          initial={false}
          animate={
            pillShown
              ? { width: pillWidth ?? "auto", opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }
              : { width: pillWidth ?? "auto", opacity: 0, filter: reduced ? "blur(0px)" : "blur(4px)", y: reduced ? 0 : 12, scale: reduced ? 1 : 0.82 }
          }
          transition={reduced ? { duration: 0, opacity: { duration: 0.15 } } : SPRING}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={(done !== null ? "done:" : "") + pillText}
              className={styles.pillRow}
              initial={{ opacity: 0, filter: reduced ? "blur(0px)" : "blur(4px)", y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: reduced ? "blur(0px)" : "blur(4px)", y: reduced ? 0 : -6 }}
              transition={reduced ? { duration: 0.1 } : { ...SOFT, duration: 0.25 }}
            >
              {done !== null ? <Check size={15} strokeWidth={2.25} /> : null}
              <span>{pillText}</span>
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
      {announce ? (
        <span role="status" aria-live="polite" className={styles.srOnly}>
          {said}
        </span>
      ) : null}
    </div>
  );
}

