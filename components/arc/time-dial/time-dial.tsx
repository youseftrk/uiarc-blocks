"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./time-dial.module.css";

export interface TimeDialCity {
  id: string;
  name: string;
  /** Two or three letters shown on the dial. */
  code: string;
  /** Minutes from UTC in steps of 15. */
  offset: number;
}

export interface TimeDialProps {
  /** Two to five cities. */
  cities: TimeDialCity[];
  /** Controlled time in UTC minutes from midnight on the reference day. May leave 0 to 1439 to reach adjacent days. */
  value?: number;
  defaultValue?: number;
  /** Fires with the destination as soon as the dial is released or stepped, before it comes to rest. */
  onValueChange?: (value: number) => void;
  /** Controlled id of the city the dial reads in. Defaults to the first city. */
  homeId?: string;
  defaultHomeId?: string;
  onHomeChange?: (id: string) => void;
  /** Earliest time in UTC minutes. The dial stretches past it and springs back. */
  min?: number;
  max?: number;
  /** Weekday of the reference day in UTC, 0 for Sunday. */
  weekday?: number;
  hourCycle?: 12 | 24;
  /** Local working hours in minutes from midnight, drawn as a band on the dial. */
  workingHours?: [start: number, end: number];
  /** Accessible name of the dial. */
  label?: string;
  className?: string;
}

const DAY = 1440, STEP = 15, CENTER = 150;
const HOME_RADIUS = 106, LANES = [88, 77, 66, 55];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const { spring, duration, blur } = motionTokens;
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number];
const restSpring = { type: "spring" as const, stiffness: 210, damping: 28, restDelta: .05, restSpeed: .5 };
/** Minutes of stretch past a bound, and how far ahead a flick looks, in seconds. */
const STRETCH = 34, COAST = .22;

const mod = (value: number, by: number) => ((value % by) + by) % by;
const snap = (value: number) => Math.round(value / STEP) * STEP;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const cqi = (radius: number) => (radius / 300) * 100;
/** Degrees clockwise from the top of the dial; midnight sits at the bottom, noon at the top. */
const angleOf = (localMinutes: number) => localMinutes / 4 - 180;
const point = (radius: number, degrees: number) => { const a = (degrees * Math.PI) / 180; return [CENTER + radius * Math.sin(a), CENTER - radius * Math.cos(a)] as const; };
const rubber = (distance: number) => Math.sign(distance) * (1 - 1 / ((Math.abs(distance) * .55) / STRETCH + 1)) * STRETCH;
/** Pulls a dragged time toward the nearest quarter hour without ever stopping it. */
const detent = (raw: number) => { const near = snap(raw), away = raw - near; return near + away * Math.pow(Math.abs(away) / (STEP / 2), .7); };

const inHours = (local: number, [start, end]: [number, number]) => { const m = mod(local, DAY); return start <= end ? m >= start && m < end : m >= start || m < end; };
const isDay = (local: number) => { const m = mod(local, DAY); return m >= 360 && m < 1080; };

function formatTime(local: number, cycle: 12 | 24) {
  const m = mod(local, DAY), hour = Math.floor(m / 60), minute = String(m % 60).padStart(2, "0");
  if (cycle === 24) return `${String(hour).padStart(2, "0")}:${minute}`;
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}
function formatOffset(offset: number) {
  const abs = Math.abs(offset), hours = Math.floor(abs / 60), minutes = abs % 60;
  return `UTC${offset < 0 ? "−" : "+"}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}
function formatGap(minutes: number) {
  if (minutes === 0) return "same time";
  const hours = Math.abs(minutes) / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")} h ${minutes > 0 ? "ahead" : "behind"}`;
}
const dayWord = (shift: number) => (shift > 0 ? "next day" : shift < 0 ? "previous day" : "");
const dayChip = (shift: number) => `${shift > 0 ? "+" : "−"}${Math.abs(shift)} day${Math.abs(shift) > 1 ? "s" : ""}`;

const swapMotion = (reduced: boolean) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${blur.subtle}px)` },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.standard, ease: enterEase } },
  exit: reduced ? { opacity: 0, transition: { duration: duration.instant } } : { opacity: 0, y: "-0.35em", filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant, ease: standardEase } },
});

function Swap({ text, className, reduced }: { text: string; className?: string; reduced: boolean }) {
  return (
    <span className={`${styles.swap} ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} className={styles.swapItem} {...swapMotion(reduced)}>{text}</motion.span>
      </AnimatePresence>
    </span>
  );
}

function IconSwap({ day, reduced }: { day: boolean; reduced: boolean }) {
  return (
    <span className={styles.iconSwap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={day ? "sun" : "moon"}
          className={styles.iconItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -90, filter: `blur(${blur.subtle}px)` }}
          animate={{ opacity: 1, rotate: 0, filter: "blur(0px)", transition: { duration: duration.standard, ease: enterEase } }}
          exit={reduced ? { opacity: 0, transition: { duration: duration.instant } } : { opacity: 0, rotate: 90, filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant, ease: standardEase } }}
        >
          {day ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const HOURS_12 = Array.from({ length: 25 }, (_, i) => String(i % 12 || 12));
const HOURS_24 = Array.from({ length: 25 }, (_, i) => String(i % 24).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45", "00"];

/** An odometer readout that rolls with the dial: minutes turn through the quarter hours and the hour turns over during the last one. */
function Clock({ time, offset, cycle, meridiem, className, reduced }: { time: MotionValue<number>; offset: number; cycle: 12 | 24; meridiem: string; className?: string; reduced: boolean }) {
  const hourY = useTransform(time, value => {
    const local = mod(value + offset, DAY), hour = Math.floor(local / 60), minute = local - hour * 60;
    return `${-(hour + (minute > 45 ? (minute - 45) / STEP : 0)) * 1.3}em`;
  });
  const minuteY = useTransform(time, value => `${-(mod(value + offset, 60) / STEP) * 1.3}em`);
  return (
    <span className={`${styles.clock} ${className ?? ""}`} data-cycle={cycle} aria-hidden="true">
      <span className={styles.wheel}>
        <span className={styles.sizer}>{cycle === 12 ? "12" : "00"}</span>
        <motion.span className={styles.strip} style={{ y: hourY }}>{(cycle === 12 ? HOURS_12 : HOURS_24).map((face, i) => <span key={i} className={styles.face}>{face}</span>)}</motion.span>
      </span>
      <span className={styles.colon}>:</span>
      <span className={styles.wheel}>
        <span className={styles.sizer}>00</span>
        <motion.span className={styles.strip} style={{ y: minuteY }}>{MINUTES.map((face, i) => <span key={i} className={styles.face}>{face}</span>)}</motion.span>
      </span>
      {cycle === 12 && <Swap text={meridiem} className={styles.meridiem} reduced={reduced} />}
    </span>
  );
}

function Orbit({ city, time, home, radius, working, day, reduced }: { city: TimeDialCity; time: MotionValue<number>; home: boolean; radius: number; working: boolean; day: boolean; reduced: boolean }) {
  const rotate = useTransform(time, value => angleOf(value + city.offset));
  const counter = useTransform(rotate, value => -value);
  const codeX = useTransform(rotate, value => `${-5.4 * Math.sin((value * Math.PI) / 180)}cqi`);
  const codeY = useTransform(rotate, value => `${3.4 * Math.cos((value * Math.PI) / 180)}cqi`);
  const move = reduced ? { duration: 0 } : spring.morph;
  return (
    <motion.div className={styles.arm} data-home={home || undefined} style={{ rotate }}>
      <motion.div className={styles.anchor} style={{ rotate: counter }} initial={false} animate={{ y: `${-cqi(radius)}cqi` }} transition={move}>
        <motion.span className={styles.bead} data-working={working || undefined} initial={false} animate={{ scale: home ? 1 : .3 }} transition={move}>
          <motion.span className={styles.glyph} initial={false} animate={{ opacity: home ? 1 : 0 }} transition={{ duration: duration.fast }}>
            <IconSwap day={day} reduced={reduced} />
          </motion.span>
        </motion.span>
        <motion.span className={styles.code} style={{ x: codeX, y: codeY }} initial={false} animate={{ opacity: home ? 0 : 1 }} transition={{ duration: duration.fast }}>{city.code}</motion.span>
      </motion.div>
    </motion.div>
  );
}

type Drag = { pointer: number; angle: number; raw: number; origin: number; moved: boolean; samples: { at: number; raw: number }[] };

/** A 24 hour rotary dial for choosing a time across time zones. */
export function TimeDial({ cities, value, defaultValue = 0, onValueChange, homeId, defaultHomeId, onHomeChange, min = -Infinity, max = Infinity, weekday = 1, hourCycle = 12, workingHours = [540, 1080], label = "Time", className }: TimeDialProps) {
  const reduced = useReducedMotion();
  const hintId = useId();
  const [inner, setInner] = useState(defaultValue);
  const [innerHome, setInnerHome] = useState(defaultHomeId);
  const current = value ?? inner;
  const home = cities.find(city => city.id === (homeId ?? innerHome)) ?? cities[0];
  const time = useMotionValue(current);
  /** The quarter hour the moving dial is showing, so labels follow a drag without rendering every frame. */
  const [shown, setShown] = useState(current);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const sweep = useRef<SVGPathElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const handTurn = useMotionValue(0);
  const handRotate = useTransform([time, handTurn], ([t, turn]: number[]) => angleOf(t + (home?.offset ?? 0)) + turn);
  const lastHome = useRef(home?.id);

  useMotionValueEvent(time, "change", latest => {
    const quarter = snap(latest);
    setShown(previous => (previous === quarter ? previous : quarter));
    const active = drag.current, path = sweep.current;
    if (path && active) {
      const from = angleOf(active.origin + (home?.offset ?? 0)), span = clamp((latest - active.origin) / 4, -359, 359);
      if (Math.abs(span) < .5) path.setAttribute("d", "M0 0");
      else {
        const [x1, y1] = point(HOME_RADIUS, from), [x2, y2] = point(HOME_RADIUS, from + span);
        path.setAttribute("d", `M${x1.toFixed(2)} ${y1.toFixed(2)}A${HOME_RADIUS} ${HOME_RADIUS} 0 ${Math.abs(span) > 180 ? 1 : 0} ${span > 0 ? 1 : 0} ${x2.toFixed(2)} ${y2.toFixed(2)}`);
      }
    }
  });

  const settle = useCallback((to: number, velocity = 0) => {
    running.current?.stop();
    if (reduced) { time.set(to); return; }
    running.current = animate(time, to, { ...restSpring, velocity });
  }, [reduced, time]);

  // A controlled value or a reset from outside moves the dial the same way a step does.
  const target = useRef(current);
  useEffect(() => { if (drag.current || target.current === current) return; target.current = current; settle(current); }, [current, settle]);

  // The hand swings the short way round to a newly chosen home city.
  useEffect(() => {
    if (!home || lastHome.current === home.id) return;
    const previous = cities.find(city => city.id === lastHome.current);
    lastHome.current = home.id;
    if (!previous || reduced) return;
    const gap = mod((previous.offset - home.offset) / 4 + 180, 360) - 180;
    handTurn.set(gap);
    const controls = animate(handTurn, 0, spring.morph);
    return () => controls.stop();
  }, [home, cities, reduced, handTurn]);

  const commit = useCallback((next: number, velocity = 0) => {
    const to = clamp(snap(next), Number.isFinite(min) ? Math.ceil(min / STEP) * STEP : min, Number.isFinite(max) ? Math.floor(max / STEP) * STEP : max);
    if (value === undefined) setInner(to);
    if (to !== current) onValueChange?.(to);
    target.current = to;
    settle(to, velocity);
  }, [current, max, min, onValueChange, settle, value]);

  const pointerAngle = (event: PointerEvent) => {
    const box = stage.current!.getBoundingClientRect();
    return (Math.atan2(event.clientX - (box.left + box.width / 2), -(event.clientY - (box.top + box.height / 2))) * 180) / Math.PI;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    running.current?.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    const raw = time.get();
    drag.current = { pointer: event.pointerId, angle: pointerAngle(event), raw, origin: raw, moved: false, samples: [{ at: event.timeStamp, raw }] };
    sweep.current?.setAttribute("d", "M0 0");
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const angle = pointerAngle(event), turn = mod(angle - active.angle + 180, 360) - 180;
    active.angle = angle;
    active.raw += turn * 4;
    active.moved ||= Math.abs(active.raw - active.origin) > 1;
    active.samples.push({ at: event.timeStamp, raw: active.raw });
    if (active.samples.length > 6) active.samples.shift();
    const eased = detent(active.raw);
    time.set(eased > max ? max + rubber(eased - max) : eased < min ? min + rubber(eased - min) : eased);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    const first = active.samples[0], last = active.samples[active.samples.length - 1], elapsed = (last.at - first.at) / 1000;
    const fresh = event.timeStamp - last.at < 80 && elapsed > 0;
    const velocity = fresh && !reduced ? (last.raw - first.raw) / elapsed : 0;
    commit(active.raw + velocity * COAST, velocity);
  };

  const homeOffset = home?.offset ?? 0;
  const dayStart = Math.floor((current + homeOffset) / DAY) * DAY - homeOffset;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 60, PageDown: -60 };
    let next: number | null = null;
    if (event.key in steps) next = current + steps[event.key];
    else if (event.key === "Home") next = dayStart;
    else if (event.key === "End") next = dayStart + DAY - STEP;
    if (next === null) return;
    event.preventDefault();
    commit(next);
  };

  const chooseHome = (id: string) => {
    if (id === home?.id) return;
    if (homeId === undefined) setInnerHome(id);
    onHomeChange?.(id);
  };

  const workBand = useMemo(() => {
    const [start, end] = workingHours, from = angleOf(start), to = angleOf(start <= end ? end : end + DAY);
    const large = to - from > 180 ? 1 : 0, f = (n: number) => n.toFixed(2);
    const [ax, ay] = point(130, from), [bx, by] = point(130, to), [cx, cy] = point(60, to), [dx, dy] = point(60, from);
    return `M${f(ax)} ${f(ay)}A130 130 0 ${large} 1 ${f(bx)} ${f(by)}L${f(cx)} ${f(cy)}A60 60 0 ${large} 0 ${f(dx)} ${f(dy)}Z`;
  }, [workingHours]);

  if (!home) return null;
  const homeLocal = shown + homeOffset, homeDay = Math.floor(homeLocal / DAY);
  const read = (city: TimeDialCity) => {
    const local = shown + city.offset;
    return { local, shift: Math.floor(local / DAY) - homeDay, working: inHours(local, workingHours), day: isDay(local), text: formatTime(local, hourCycle), meridiem: mod(local, DAY) < 720 ? "AM" : "PM" };
  };
  const others = cities.filter(city => city.id !== home.id);
  const homeRead = read(home);
  const dayName = WEEKDAYS[mod(weekday + homeDay, 7)];
  const numerals = hourCycle === 12 ? ["12 AM", "6 AM", "Noon", "6 PM"] : ["00", "06", "12", "18"];

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.layout}>
        <div
          ref={stage}
          className={styles.stage}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={DAY - STEP}
          aria-valuenow={mod(homeLocal, DAY)}
          aria-valuetext={`${homeRead.text}, ${dayName}, ${home.name}`}
          aria-describedby={hintId}
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <svg className={styles.svg} viewBox="0 0 300 300" aria-hidden="true" focusable="false">
            <circle className={styles.plate} cx={CENTER} cy={CENTER} r={146} />
            <path className={styles.work} d={workBand} />
            <circle className={styles.rim} cx={CENTER} cy={CENTER} r={146} />
            <circle className={styles.homeTrack} cx={CENTER} cy={CENTER} r={HOME_RADIUS} />
            {others.map((city, i) => <circle key={city.id} className={styles.track} cx={CENTER} cy={CENTER} r={LANES[i] ?? LANES[LANES.length - 1]} />)}
            <circle className={styles.core} cx={CENTER} cy={CENTER} r={56} />
            {Array.from({ length: 24 }, (_, i) => <line key={i} className={i % 6 === 0 ? styles.major : styles.hour} x1={CENTER} y1={9} x2={CENTER} y2={i % 6 === 0 ? 16 : 13} transform={`rotate(${i * 15} ${CENTER} ${CENTER})`} />)}
            <text className={styles.numeral} x={150} y={277} textAnchor="middle" dominantBaseline="central">{numerals[0]}</text>
            <text className={styles.numeral} x={20} y={150} textAnchor="start" dominantBaseline="central">{numerals[1]}</text>
            <text className={styles.numeral} x={150} y={23} textAnchor="middle" dominantBaseline="central">{numerals[2]}</text>
            <text className={styles.numeral} x={280} y={150} textAnchor="end" dominantBaseline="central">{numerals[3]}</text>
          </svg>
          <svg className={styles.svg} viewBox="0 0 300 300" aria-hidden="true" focusable="false">
            <motion.path ref={sweep} className={styles.sweep} d="M0 0" initial={false} animate={{ opacity: dragging ? 1 : 0 }} transition={{ duration: dragging ? duration.instant : duration.considered, ease: standardEase }} />
          </svg>
          <div className={styles.orbits} aria-hidden="true">
            <motion.div className={styles.arm} style={{ rotate: handRotate }}><span className={styles.hand} /></motion.div>
            {cities.map(city => {
              const state = read(city), lane = others.indexOf(city);
              return <Orbit key={city.id} city={city} time={time} home={city.id === home.id} radius={city.id === home.id ? HOME_RADIUS : LANES[lane] ?? LANES[LANES.length - 1]} working={state.working} day={state.day} reduced={reduced} />;
            })}
          </div>
          <div className={styles.readout} aria-hidden="true">
            <Swap text={home.name} className={styles.readoutCity} reduced={reduced} />
            <Clock time={time} offset={homeOffset} cycle={hourCycle} meridiem={homeRead.meridiem} className={styles.readoutTime} reduced={reduced} />
            <Swap text={dayName} className={styles.readoutNote} reduced={reduced} />
          </div>
        </div>
        <ul className={styles.list} aria-label="Cities. Choose one to read the dial in its time.">
          {cities.map(city => {
            const state = read(city), isHome = city.id === home.id, gap = city.offset - homeOffset;
            const spoken = [city.name, state.text, dayWord(state.shift), state.working ? "working hours" : "", isHome ? "home city" : formatGap(gap)].filter(Boolean).join(", ");
            return (
              <li key={city.id} className={styles.item}>
                <button type="button" className={styles.row} aria-pressed={isHome} aria-label={spoken} onClick={() => chooseHome(city.id)}>
                  {isHome && <motion.span layoutId={`${hintId}-home`} className={styles.highlight} transition={reduced ? { duration: 0 } : spring.morph} />}
                  <span className={styles.rowIcon} data-day={state.day || undefined} data-working={state.working || undefined}><IconSwap day={state.day} reduced={reduced} /></span>
                  <span className={styles.rowText}>
                    <span className={styles.rowCity}>{city.name}</span>
                    <Swap text={isHome ? `Home · ${formatOffset(city.offset)}` : `${formatOffset(city.offset)} · ${formatGap(gap)}`} className={styles.rowMeta} reduced={reduced} />
                  </span>
                  <span className={styles.chipSlot}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {state.shift !== 0 && <motion.span key={state.shift} className={styles.chip} {...swapMotion(reduced)}>{dayChip(state.shift)}</motion.span>}
                    </AnimatePresence>
                  </span>
                  <Clock time={time} offset={city.offset} cycle={hourCycle} meridiem={state.meridiem} className={styles.rowTime} reduced={reduced} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <span id={hintId} className={styles.srOnly}>Drag around the dial or use the arrow keys to move in 15 minute steps. Page Up and Page Down move by an hour.</span>
      <p className={styles.srOnly} aria-live="polite">{others.map(city => { const state = read(city); return [`${city.name} ${state.text}`, dayWord(state.shift)].filter(Boolean).join(", "); }).join(". ")}</p>
    </div>
  );
}
