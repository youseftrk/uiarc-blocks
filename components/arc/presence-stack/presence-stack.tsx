"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./presence-stack.module.css";

export type PresenceStatus = "active" | "idle" | "typing";

export interface PresencePerson {
  id: string;
  name: string;
  src?: string;
  status?: PresenceStatus;
  detail?: string;
}

export interface PresenceStackProps {
  people: readonly PresencePerson[];
  max?: number;
  size?: "sm" | "md" | "lg";
  align?: "start" | "end";
  selfId?: string;
  label?: string;
  heading?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPersonSelect?: (person: PresencePerson) => void;
  announce?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SIZES = { sm: 28, md: 36, lg: 44 };
const STATUS_LABEL: Record<PresenceStatus, string> = { active: "Active now", idle: "Idle", typing: "Typing" };

function Face({ person, size }: { person: PresencePerson; size: number }) {
  const [failed, setFailed] = useState<string>();
  const show = person.src && failed !== person.src;
  return (
    <span className={styles.face}>
      <span className={styles.initials} aria-hidden="true">
        {person.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("")}
      </span>
      {show ? <Image src={person.src as string} alt="" fill sizes={`${size}px`} className={styles.photo} onError={() => setFailed(person.src)} draggable={false} /> : null}
    </span>
  );
}

function Dots({ className }: { className?: string }) {
  return (
    <span className={[styles.dots, className].filter(Boolean).join(" ")} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function Mark({ status, reduceMotion }: { status: PresenceStatus; reduceMotion: boolean }) {
  const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.snappy;
  return (
    <span className={styles.mark} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {status === "typing" ? (
          <motion.span key="typing" className={styles.typingMark} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={transition}>
            <Dots />
          </motion.span>
        ) : (
          <motion.span key="dot" className={[styles.dot, status === "idle" ? styles.dotIdle : ""].join(" ")} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={transition} />
        )}
      </AnimatePresence>
    </span>
  );
}

export function PresenceStack({
  people,
  max = 4,
  size = "md",
  align = "start",
  selfId,
  label = "People here now",
  heading = "Here now",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onPersonSelect,
  announce = true,
  className,
  style,
}: PresenceStackProps) {
  const reduced = !!useReducedMotion();
  const px = SIZES[size];
  const step = Math.round(0.68 * px);
  const limit = Math.max(1, Math.floor(max));
  const shown = people.length > limit ? people.slice(0, limit) : people;
  const extra = people.length - shown.length;
  const slots = shown.length + +(extra > 0);
  const fullWidth = (limit + 1 - 1) * step + px;
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [byKeys, setByKeys] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  const fanned = (hovered || focused) && !open;
  const usedWidth = slots > 0 ? (slots - 1) * step + px : 0;
  const offset = align === "end" ? fullWidth - usedWidth : 0;
  const enter = (at: number) => {
    window.clearTimeout(leaveTimer.current);
    setByKeys(false);
    setHovered(true);
    setIndex(at);
  };
  const leave = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setHovered(false);
      setIndex(null);
    }, 90);
  };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const active = index !== null && index < slots ? index : null;
  const person = active === null ? null : active < shown.length ? shown[active] : null;
  const labelName = person ? `${person.name}${person.id === selfId ? " (you)" : ""}` : active !== null ? `${extra} more` : "";
  const labelSub = person ? STATUS_LABEL[person.status ?? "active"] : active !== null ? "Show everyone" : "";
  const measureRef = useRef<HTMLSpanElement>(null);
  const labelWidth = useMotionValue(0);
  const labelOn = fanned && active !== null;
  const wasOn = useRef(false);
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const width = measureRef.current.offsetWidth + 1;
    if (!labelOn || !wasOn.current || reduced || byKeys) labelWidth.set(width);
    else animate(labelWidth, width, motionTokens.spring.morph);
    wasOn.current = labelOn;
  }, [labelName, labelSub, labelOn, reduced, byKeys, labelWidth]);
  const [count, setCount] = useState({ value: extra, direction: 1 });
  if (count.value !== extra) setCount({ value: extra, direction: extra < count.value ? -1 : 1 });
  const [message, setMessage] = useState("");
  const previous = useRef(people);
  useEffect(() => {
    if (!announce) return;
    const before = new Map(previous.current.map(item => [item.id, item]));
    const now = new Set(people.map(item => item.id));
    const joined = people.filter(item => !before.has(item.id)).map(item => `${item.name} joined`);
    const left = previous.current.filter(item => !now.has(item.id)).map(item => `${item.name} left`);
    previous.current = people;
    const text = [...joined, ...left].join(". ");
    if (text) setMessage(text);
  }, [people, announce]);
  const smooth = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const morph = reduced ? { duration: 0 } : motionTokens.spring.morph;
  const quick = { duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
  const triggerLabel = `${label}, ${people.length} ${people.length === 1 ? "person" : "people"}`;

  return (
    <div className={[styles.root, styles[size], className].filter(Boolean).join(" ")} style={{ ...style, "--size": `${px}px` } as CSSProperties} data-align={align}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={styles.trigger}
            style={{ width: fullWidth, height: px }}
            aria-label={triggerLabel}
            onFocus={event => {
              if (event.currentTarget.matches(":focus-visible")) setFocused(true);
            }}
            onBlur={() => {
              setFocused(false);
              setIndex(null);
            }}
            onKeyDown={event => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const direction = event.key === "ArrowRight" ? 1 : -1;
              setByKeys(true);
              setIndex(value => (value === null ? (direction > 0 ? 0 : slots - 1) : Math.min(slots - 1, Math.max(0, value + direction))));
            }}
          >
            <AnimatePresence initial={false}>
              {shown.map((item, at) => {
                const status = item.status ?? "active";
                return (
                  <motion.span
                    key={item.id}
                    className={[styles.avatar, status === "idle" ? styles.idle : ""].join(" ")}
                    style={{ zIndex: slots - at }}
                    initial={{ x: offset + at * step, opacity: 0, scale: 0.7 }}
                    animate={{ x: offset + at * step, y: fanned && active === at ? -2 : 0, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7, transition: quick }}
                    transition={{ x: smooth, y: smooth, scale: morph, opacity: { duration: reduced ? 0 : motionTokens.duration.fast } }}
                    onPointerEnter={() => enter(at)}
                    onPointerLeave={leave}
                  >
                    <Face person={item} size={px} />
                    <Mark status={status} reduceMotion={reduced} />
                  </motion.span>
                );
              })}
              {extra > 0 ? (
                <motion.span
                  key="overflow"
                  className={styles.overflow}
                  style={{ zIndex: 0 }}
                  initial={{ x: offset + shown.length * step, opacity: 0, scale: 0.7 }}
                  animate={{ x: offset + shown.length * step, y: fanned && active === shown.length ? -2 : 0, opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7, transition: quick }}
                  transition={{ x: smooth, y: smooth, scale: morph }}
                  onPointerEnter={() => enter(shown.length)}
                  onPointerLeave={leave}
                >
                  <motion.span className={styles.countShift} initial={false} animate={{ x: (px - step) / 2 }} transition={smooth}>
                    <AnimatePresence mode="popLayout" initial={false} custom={count.direction}>
                      <motion.span
                        key={extra}
                        className={styles.count}
                        custom={count.direction}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: `${0.55 * count.direction}em` }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, y: `${-0.55 * count.direction}em` }}
                        transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                      >
                        +{extra}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                </motion.span>
              ) : null}
            </AnimatePresence>
            <span ref={measureRef} className={[styles.label, styles.measure].join(" ")} aria-hidden="true">
              <span className={styles.labelName}>{labelName}</span>
              <span className={styles.labelSub}>{labelSub}</span>
            </span>
            <AnimatePresence>
              {fanned && active !== null ? (
                <motion.span
                  key="label"
                  className={styles.labelTrack}
                  aria-hidden="true"
                  initial={{ x: offset + active * step + px / 2, opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ x: offset + active * step + px / 2, opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96, transition: quick }}
                  transition={{ x: reduced || byKeys ? { duration: 0 } : motionTokens.spring.morph, default: reduced ? { duration: 0 } : motionTokens.spring.snappy }}
                >
                  <motion.span className={styles.label} style={{ width: labelWidth }}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={labelName} className={styles.labelInner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
                        <span className={styles.labelName}>{labelName}</span>
                        <span className={styles.labelSub}>
                          {person?.status === "typing" ? <Dots className={styles.labelDots} /> : null}
                          {labelSub}
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        </Popover.Trigger>
        <AnimatePresence>
          {open ? (
            <Popover.Portal forceMount>
              <Popover.Content forceMount asChild align={align} sideOffset={10} collisionPadding={12} aria-label={heading}>
                <motion.div
                  className={styles.panel}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}
                  transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                >
                  <div className={styles.panelHead}>
                    <span className={styles.panelTitle}>{heading}</span>
                    <PanelCount value={people.length} reduceMotion={reduced} />
                  </div>
                  <ul className={styles.list}>
                    <AnimatePresence initial={false}>
                      {people.map(item => {
                        const status = item.status ?? "active";
                        const self = item.id === selfId;
                        const body = (
                          <>
                            <span className={[styles.rowAvatar, status === "idle" ? styles.idle : ""].join(" ")}>
                              <Face person={item} size={28} />
                              <Mark status={status} reduceMotion={reduced} />
                            </span>
                            <span className={styles.rowText}>
                              <span className={styles.rowName}>
                                {item.name}
                                {self ? <span className={styles.you}> (you)</span> : null}
                              </span>
                              <span className={styles.rowDetail}>
                                <AnimatePresence mode="popLayout" initial={false}>
                                  <motion.span key={`${status}-${item.detail ?? ""}`} className={styles.rowDetailText} initial={{ opacity: 0, y: 4 * +!reduced }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
                                    {status === "typing" ? <Dots className={styles.rowDots} /> : null}
                                    {item.detail ?? STATUS_LABEL[status]}
                                  </motion.span>
                                </AnimatePresence>
                              </span>
                            </span>
                          </>
                        );
                        return (
                          <motion.li key={item.id} className={styles.rowWrap} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
                            {onPersonSelect ? (
                              <button
                                type="button"
                                className={[styles.row, styles.rowButton].join(" ")}
                                onClick={() => {
                                  onPersonSelect(item);
                                  setOpen(false);
                                }}
                                aria-label={`${item.name}${self ? " (you)" : ""}, ${item.detail ?? STATUS_LABEL[status]}`}
                              >
                                {body}
                              </button>
                            ) : (
                              <div className={styles.row}>{body}</div>
                            )}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                  {people.length === 0 ? <p className={styles.empty}>No one else is here right now</p> : null}
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          ) : null}
        </AnimatePresence>
      </Popover.Root>
      <span className={styles.srOnly} role="status" aria-live="polite">{message}</span>
    </div>
  );
}

function PanelCount({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value < state.value ? -1 : 1 });
  const id = useId();
  return (
    <span className={styles.panelCount} aria-label={`${value} ${value === 1 ? "person" : "people"}`} id={id}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          aria-hidden="true"
          initial={{ opacity: 0, y: reduceMotion ? 0 : `${0.6 * state.direction}em` }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : `${-0.6 * state.direction}em` }}
          transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default PresenceStack;
