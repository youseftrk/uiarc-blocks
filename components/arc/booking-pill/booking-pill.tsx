"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Transition } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarDays, Minus, Plus, RotateCcw } from "lucide-react";
import styles from "./booking-pill.module.css";

export type BookingStep = "start" | "party" | "date" | "time" | "review" | "booked";

export interface Booking {
  date: string;
  time: string;
  partySize: number;
}

export interface BookingPillProps {
  venue: string;
  venueDetail?: string;
  startDate: string;
  days?: number;
  times?: string[];
  isAvailable?: (date: string, time: string, partySize: number) => boolean;
  preferredTime?: string;
  minPartySize?: number;
  maxPartySize?: number;
  defaultPartySize?: number;
  onConfirm?: (booking: Booking) => Promise<void> | void;
  onStepChange?: (step: BookingStep) => void;
  hourCycle?: 12 | 24;
  label?: string;
  className?: string;
}

const DEFAULT_TIMES = Array.from({ length: 12 }, (_, i) => `${17 + Math.floor(i / 2)}:${i % 2 ? "30" : "00"}`);
const ORDER: BookingStep[] = ["start", "party", "date", "time", "review", "booked"];
const CELL = 52;
const shapeSpring: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 1 };
const glide: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 1 };
const EASE: [number, number, number, number] = [0.2, 0, 0, 1];

const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n));
}
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};
function formatTime(time: string, cycle: 12 | 24) {
  const [h, m] = time.split(":").map(Number);
  const mm = String(m || 0).padStart(2, "0");
  if (cycle === 24) return `${String(h).padStart(2, "0")}:${mm}`;
  return `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)" }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function BookingPill({
  venue,
  venueDetail,
  startDate,
  days = 21,
  times = DEFAULT_TIMES,
  isAvailable,
  preferredTime = "19:30",
  minPartySize = 1,
  maxPartySize = 12,
  defaultPartySize = 2,
  onConfirm,
  onStepChange,
  hourCycle = 12,
  label = "Book a table",
  className,
}: BookingPillProps) {
  const reduced = useReducedMotion() ?? false;
  const [step, setStepState] = useState<BookingStep>("start");
  const [dir, setDir] = useState(1);
  const [party, setParty] = useState(() => Math.min(maxPartySize, Math.max(minPartySize, defaultPartySize)));
  const [partyDir, setPartyDir] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [highlight, setHighlight] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const dates = useMemo(() => Array.from({ length: Math.max(1, days) }, (_, i) => addDays(startDate, i)), [startDate, days]);
  const free = useCallback(
    (i: number, t: string) => (isAvailable ? isAvailable(toIso(dates[i]), t, party) : true),
    [isAvailable, dates, party],
  );
  const openDays = useMemo(() => dates.map((_, i) => times.some((t) => free(i, t))), [dates, times, free]);
  const firstOpen = Math.max(0, openDays.indexOf(true));
  const index = Math.min(dates.length - 1, picked ?? firstOpen);
  const date = dates[index];
  const freeTimes = useMemo(() => times.filter((t) => free(index, t)), [times, free, index]);
  const nearest = useMemo(() => {
    if (!freeTimes.length) return null;
    const target = minutes(preferredTime);
    return freeTimes.reduce((best, t) => (Math.abs(minutes(t) - target) < Math.abs(minutes(best) - target) ? t : best), freeTimes[0]);
  }, [freeTimes, preferredTime]);
  const chosen = time && freeTimes.includes(time) ? time : nearest;

  const go = useCallback(
    (next: BookingStep) => {
      const root = frameRef.current;
      refocus.current = !!root && root.contains(document.activeElement);
      setDir(ORDER.indexOf(next) >= ORDER.indexOf(step) || next === "start" ? (next === "start" && step !== "booked" ? -1 : 1) : -1);
      setError(null);
      setStepState(next);
      onStepChange?.(next);
    },
    [step, onStepChange],
  );

  /* The shape springs to the size of the current face. */
  const measure = useCallback((node: HTMLDivElement | null) => {
    faceRef.current = node;
    if (!node) return;
    const read = () => setSize((prev) => (prev?.width === node.offsetWidth && prev?.height === node.offsetHeight ? prev : { width: node.offsetWidth, height: node.offsetHeight }));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    faceRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [step]);

  /* Date strip. */
  const x = useMotionValue(-index * CELL);
  const drag = useRef<{ id: number; startX: number; origin: number; moved: boolean; last: number; lastT: number; v: number } | null>(null);
  const settle = useCallback(
    (i: number, velocity = 0) => {
      const target = -i * CELL;
      if (reduced) x.set(target);
      else animate(x, target, { type: "spring", stiffness: 300, damping: 32, velocity });
    },
    [x, reduced],
  );
  const pick = useCallback(
    (i: number, velocity = 0) => {
      const next = Math.min(dates.length - 1, Math.max(0, i));
      setPicked(next);
      settle(next, velocity);
    },
    [dates.length, settle],
  );
  useLayoutEffect(() => {
    if (step === "date" && !drag.current) x.set(-index * CELL);
    // Only when the strip mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const onStripDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    x.stop();
    drag.current = { id: event.pointerId, startX: event.clientX, origin: x.get(), moved: false, last: event.clientX, lastT: performance.now(), v: 0 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onStripMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    const now = performance.now();
    if (now > d.lastT) d.v = ((event.clientX - d.last) / (now - d.lastT)) * 1000;
    d.last = event.clientX;
    d.lastT = now;
    const min = -(dates.length - 1) * CELL;
    let next = d.origin + dx;
    if (next > 0) next = next * 0.35;
    else if (next < min) next = min + (next - min) * 0.35;
    x.set(next);
    const i = Math.min(dates.length - 1, Math.max(0, Math.round(-next / CELL)));
    setPicked((prev) => (prev === i ? prev : i));
  };
  const onStripUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
      if (cell) pick(Number(cell.dataset.index));
      else settle(index);
      return;
    }
    const projected = x.get() + d.v * 0.18;
    pick(Math.round(-projected / CELL), d.v);
  };

  const onSliderKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageUp: -7, PageDown: 7 };
    if (event.key in moves) {
      event.preventDefault();
      pick(index + moves[event.key]);
    } else if (event.key === "Home") {
      event.preventDefault();
      pick(0);
    } else if (event.key === "End") {
      event.preventDefault();
      pick(dates.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      toTime();
    }
  };

  const toTime = () => {
    if (!openDays[index]) return;
    go("time");
    setAnnouncement(`${freeTimes.length} ${freeTimes.length === 1 ? "time" : "times"} free on ${longDate.format(date)}`);
  };

  /* Time grid highlight. */
  useLayoutEffect(() => {
    if (step !== "time") return;
    const root = slotsRef.current;
    const el = chosen && root ? root.querySelector<HTMLElement>('[aria-checked="true"]') : null;
    const read = () => setHighlight(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    read();
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(root);
    return () => ro.disconnect();
  }, [step, chosen, index]);

  const onSlotsKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!freeTimes.length) return;
    const at = chosen ? times.indexOf(chosen) : -1;
    let next: string | undefined;
    const scan = (from: number, stepBy: number) => {
      for (let i = from; i >= 0 && i < times.length; i += stepBy) if (freeTimes.includes(times[i])) return times[i];
      return undefined;
    };
    if (event.key === "ArrowRight") next = scan(at + 1, 1);
    else if (event.key === "ArrowLeft") next = scan(at - 1, -1);
    else if (event.key === "ArrowDown") next = scan(at + 4, 4);
    else if (event.key === "ArrowUp") next = scan(at - 4, -4);
    else if (event.key === "Home") next = freeTimes[0];
    else if (event.key === "End") next = freeTimes[freeTimes.length - 1];
    else return;
    event.preventDefault();
    if (next) {
      setTime(next);
      const i = times.indexOf(next);
      requestAnimationFrame(() => slotsRef.current?.querySelector<HTMLElement>(`[data-slot="${i}"]`)?.focus());
    }
  };

  const confirm = async () => {
    if (busy || !chosen) return;
    setBusy(true);
    setError(null);
    try {
      if (onConfirm) await onConfirm({ date: toIso(date), time: chosen, partySize: party });
      else await new Promise((resolve) => setTimeout(resolve, 900));
      if (!mounted.current) return;
      setBusy(false);
      go("booked");
      setAnnouncement(`Booked a table for ${party} at ${venue} on ${longDate.format(date)} at ${formatTime(chosen, hourCycle)}`);
    } catch (reason) {
      if (!mounted.current) return;
      setBusy(false);
      setError(reason instanceof Error && reason.message ? reason.message : "That table could not be booked. Try again.");
    }
  };

  const back = () => {
    if (busy) return;
    const previous: Partial<Record<BookingStep, BookingStep>> = { party: "start", date: "party", time: "date", review: "time" };
    const target = previous[step];
    if (target) go(target);
  };

  const bump = (delta: number) => {
    const next = Math.min(maxPartySize, Math.max(minPartySize, party + delta));
    if (next === party) return;
    setPartyDir(delta);
    setParty(next);
  };

  const guests = `${party} ${party === 1 ? "guest" : "guests"}`;
  const cells = (interactive: boolean) =>
    dates.map((d, i) => (
      <span key={i} className={styles.cell} data-index={interactive ? i : undefined} data-closed={openDays[i] ? undefined : "true"}>
        <span className={styles.cellTop}>{d.getUTCDate() === 1 ? month.format(d) : weekday.format(d)}</span>
        <span className={styles.cellDay}>{d.getUTCDate()}</span>
      </span>
    ));

  const faceMotion = {
    initial: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: 16 * d, scale: 0.95, filter: "blur(4px)" }),
    animate: reduced
      ? { opacity: 1, transition: { duration: 0.15, delay: 0.1 } }
      : {
          opacity: 1,
          x: 0,
          scale: 1,
          filter: "blur(0px)",
          transition: { x: { ...glide, delay: 0.1 }, scale: { ...glide, delay: 0.1 }, opacity: { duration: 0.16, delay: 0.14, ease: EASE }, filter: { duration: 0.16, delay: 0.14, ease: EASE } },
        },
    exit: (d: number) =>
      reduced ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: -10 * d, scale: 0.97, filter: "blur(4px)", transition: { duration: 0.11, ease: EASE } },
  };
  const rise = (delay: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 6, filter: "blur(2px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.24, delay, ease: EASE } };

  let face: ReactNode;
  let faceClass = styles.face;
  if (step === "start") {
    face = (
      <button type="button" className={styles.start} data-autofocus="true" onClick={() => go("party")}>
        <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
        {label}
      </button>
    );
  } else if (step === "party") {
    faceClass = `${styles.face} ${styles.row}`;
    face = (
      <>
        <button type="button" className={styles.round} aria-label="Back" onClick={back}>
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className={styles.stepper} role="group" aria-label="Party size">
          <button type="button" className={styles.round} data-size="sm" aria-label="Fewer guests" aria-disabled={party <= minPartySize || undefined} onClick={() => bump(-1)}>
            <Minus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <output className={styles.count} aria-live="polite">
            <span className={styles.srOnly}>{guests}</span>
            <span className={styles.countInk} aria-hidden="true">
              <span className={styles.roll}>
                {String(party)
                  .split("")
                  .map((digit, i, all) => (
                    <span key={all.length - i} className={styles.column}>
                      <span className={styles.sizer}>0</span>
                      <AnimatePresence initial={false} custom={partyDir}>
                        <motion.span
                          key={digit}
                          className={styles.digit}
                          custom={partyDir}
                          variants={{
                            enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: `${d > 0 ? 70 : -70}%`, filter: "blur(3px)" }),
                            rest: { opacity: 1, y: "0%", filter: "blur(0px)" },
                            leave: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: `${d > 0 ? -70 : 70}%`, filter: "blur(3px)" }),
                          }}
                          initial="enter"
                          animate="rest"
                          exit="leave"
                          transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 420, damping: 34 }}
                        >
                          {digit}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  ))}
              </span>
              <span className={styles.countWord}>
                guest
                <motion.span className={styles.plural} initial={false} animate={{ width: party === 1 ? 0 : "auto", opacity: party === 1 ? 0 : 1 }} transition={reduced ? { duration: 0 } : { duration: 0.18, ease: EASE }}>
                  s
                </motion.span>
              </span>
            </span>
          </output>
          <button type="button" className={styles.round} data-size="sm" data-autofocus="true" aria-label="More guests" aria-disabled={party >= maxPartySize || undefined} onClick={() => bump(1)}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className={styles.round} data-tone="primary" aria-label="Next, choose a date" onClick={() => go("date")}>
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </>
    );
  } else if (step === "date") {
    faceClass = `${styles.face} ${styles.dateFace}`;
    const text = longDate.format(date);
    face = (
      <>
        <div className={styles.bar}>
          <button type="button" className={styles.round} aria-label="Back to party size" onClick={back}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <Swap id={text} className={styles.title} reduced={reduced}>
            {text}
          </Swap>
          <button type="button" className={styles.round} data-tone="primary" aria-label="Next, choose a time" aria-disabled={!openDays[index] || undefined} onClick={toTime}>
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div
          className={styles.slider}
          role="slider"
          tabIndex={0}
          aria-label="Date"
          aria-valuemin={0}
          aria-valuemax={dates.length - 1}
          aria-valuenow={index}
          aria-valuetext={openDays[index] ? text : `${text}, no tables free`}
          data-autofocus="true"
          onKeyDown={onSliderKey}
        >
          <div className={styles.track}>
            <motion.div
              className={styles.strip}
              draggable={false}
              style={{ x, userSelect: "none", touchAction: "pan-y" }}
              onPointerDown={onStripDown}
              onPointerMove={onStripMove}
              onPointerUp={onStripUp}
              onPointerCancel={onStripUp}
            >
              {cells(true)}
            </motion.div>
            <motion.div className={styles.lens} aria-hidden="true" initial={reduced ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2, delay: 0.16, ease: EASE }}>
              <motion.div className={styles.strip} style={{ x }}>
                {cells(false)}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </>
    );
  } else if (step === "time") {
    faceClass = `${styles.face} ${styles.panel}`;
    face = (
      <>
        <div className={styles.bar}>
          <button type="button" className={styles.round} aria-label="Back to dates" onClick={back}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <span className={styles.heading}>
            <span className={styles.headingTitle}>
              <span className={styles.headingLong}>{longDate.format(date)}</span>
              <span className={styles.headingShort}>{shortDate.format(date)}</span>
            </span>
            <span className={styles.headingSub}>
              {guests} · {freeTimes.length} free
            </span>
          </span>
          <span aria-hidden="true" />
        </div>
        <div className={styles.slots} role="radiogroup" aria-label="Time" ref={slotsRef} onKeyDown={onSlotsKey}>
          <motion.span
            className={styles.highlight}
            aria-hidden="true"
            data-hidden={highlight ? undefined : "true"}
            initial={false}
            animate={highlight ? { x: highlight.x, y: highlight.y, width: highlight.w, height: highlight.h, opacity: 1 } : { opacity: 0 }}
            transition={reduced ? { duration: 0 } : glide}
          />
          {times.map((t, i) => {
            const available = freeTimes.includes(t);
            const checked = t === chosen;
            return (
              <motion.button
                key={t}
                type="button"
                role="radio"
                className={styles.slot}
                data-slot={i}
                data-autofocus={checked ? "true" : undefined}
                aria-checked={checked}
                aria-disabled={available ? undefined : "true"}
                tabIndex={checked ? 0 : -1}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.14 + i * 0.012, ease: EASE }}
                onClick={() => available && setTime(t)}
              >
                {formatTime(t, hourCycle)}
              </motion.button>
            );
          })}
        </div>
        <button type="button" className={styles.primary} aria-disabled={chosen ? undefined : "true"} onClick={() => chosen && go("review")}>
          Review booking
        </button>
      </>
    );
  } else if (step === "review") {
    faceClass = `${styles.face} ${styles.ticket}`;
    face = (
      <>
        <div className={styles.ticketMain}>
          <motion.span className={styles.venue} {...rise(0.16)}>
            <span className={styles.venueName}>{venue}</span>
            {venueDetail && <span className={styles.venueDetail}>{venueDetail}</span>}
          </motion.span>
          <motion.dl className={styles.facts} {...rise(0.22)}>
            <div className={styles.fact}>
              <dt>Date</dt>
              <dd>{shortDate.format(date)}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Time</dt>
              <dd>{chosen ? formatTime(chosen, hourCycle) : "–"}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Guests</dt>
              <dd>{party}</dd>
            </div>
          </motion.dl>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <div className={styles.stub}>
          <motion.span className={styles.perforation} aria-hidden="true" initial={reduced ? false : { opacity: 0, scaleX: 0.5 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.3, delay: 0.2, ease: EASE }} />
          <button type="button" className={styles.round} aria-label="Change time" aria-disabled={busy || undefined} tabIndex={busy ? -1 : 0} onClick={back}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" className={styles.primary} data-autofocus="true" aria-disabled={busy || undefined} aria-busy={busy || undefined} onClick={confirm}>
            <Swap id={busy ? "busy" : "idle"} reduced={reduced}>
              {busy ? "Booking…" : "Confirm booking"}
            </Swap>
          </button>
        </div>
      </>
    );
  } else {
    faceClass = `${styles.face} ${styles.booked}`;
    face = (
      <>
        <span className={styles.mark} aria-hidden="true">
          <motion.span className={styles.markDisc} initial={reduced ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ ...glide, delay: 0.12 }} />
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <motion.path
              d="M4 9.4l3.2 3.1L14 5.8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.28, delay: 0.28, ease: EASE }}
            />
          </svg>
        </span>
        <span className={styles.bookedText}>
          <span className={styles.bookedTitle}>Table for {party} booked</span>
          <span className={styles.bookedDetail}>
            {shortDate.format(date)} at {chosen ? formatTime(chosen, hourCycle) : ""}
          </span>
        </span>
        <button
          type="button"
          className={styles.round}
          data-size="sm"
          data-autofocus="true"
          aria-label="Book another table"
          onClick={() => {
            setTime(null);
            go("start");
          }}
        >
          <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </>
    );
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <motion.div
        ref={frameRef}
        className={styles.frame}
        tabIndex={-1}
        initial={false}
        animate={size ? { width: size.width, height: size.height } : undefined}
        transition={reduced ? { duration: 0 } : shapeSpring}
        onKeyDown={(event) => {
          if (event.key === "Escape" && step !== "start" && step !== "booked") {
            event.preventDefault();
            back();
          }
        }}
      >
        <span className={styles.shadow} aria-hidden="true" />
        <div className={styles.shape} role="group" aria-label={`${label} at ${venue}`}>
          <AnimatePresence initial={false} custom={dir}>
            <motion.div key={step} ref={measure} className={faceClass} data-face={step} custom={dir} variants={faceMotion} initial="initial" animate="animate" exit="exit">
              {face}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default BookingPill;
