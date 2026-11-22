"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import styles from "./date-reel.module.css";

export type DateReelMode = "datetime" | "date" | "time";

export interface DateReelPreset {
  label: string;
  value: Date | ((today: Date) => Date);
}

export interface DateReelLabels {
  day?: string;
  month?: string;
  date?: string;
  year?: string;
  hour?: string;
  minute?: string;
  period?: string;
  at?: string;
  presets?: string;
  confirm?: string;
  confirming?: string;
  confirmed?: string;
  failed?: string;
  today?: string;
  tomorrow?: string;
  yesterday?: string;
}

export interface DateReelProps {
  mode?: DateReelMode;
  value?: Date;
  defaultValue?: Date;
  onChange?: (value: Date) => void;
  today?: Date;
  minDate?: Date;
  maxDate?: Date;
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  hourCycle?: 12 | 24;
  locale?: string;
  presets?: DateReelPreset[] | false;
  title?: string;
  onConfirm?: (value: Date) => void | Promise<void>;
  labels?: DateReelLabels;
  intro?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_VALUE = new Date(2026, 8, 24, 9, 30, 0, 0);
const SLOT_COUNT = 11;
const HALF_SLOTS = 5;
const STEP_ANGLE = 0.34; // radians per row on the cylinder
const MS_PER_DAY = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
}

function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / MS_PER_DAY);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function snapMinutes(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

function defaultPresets(): DateReelPreset[] {
  return [
    {
      label: "This evening",
      value: (today) =>
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0),
    },
    {
      label: "Tomorrow",
      value: (today) =>
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 0),
    },
    {
      label: "Monday",
      value: (today) => {
        const dow = today.getDay();
        const delta = ((1 - dow + 7) % 7) || 7;
        return new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + delta,
          9,
          0,
        );
      },
    },
  ];
}

interface ReelSpec {
  id: string;
  label: string;
  count: number;
  loop: boolean;
  align: "start" | "center" | "end";
  pageStep: number;
  getText: (index: number) => string;
  isOff?: (index: number, refDate: Date) => boolean;
  sizerSamples: string[];
}

interface ReelState {
  pos: number;
  vel: number;
  target: number;
  dragging: boolean;
  gliding: boolean;
  lastDragY: number;
  lastDragT: number;
  samples: Array<{ y: number; t: number }>;
  startX: number;
  startY: number;
  moved: boolean;
  active: boolean;
}

type ConfirmStatus = "idle" | "pending" | "done" | "failed";

export function DateReel({
  mode = "datetime",
  value,
  defaultValue = DEFAULT_VALUE,
  onChange,
  today: todayProp,
  minDate: minDateProp,
  maxDate: maxDateProp,
  minuteStep = 5,
  hourCycle = 12,
  locale = "en-US",
  presets: presetsProp,
  title,
  onConfirm,
  labels,
  intro = true,
  speed = 1,
  paused = false,
  accent,
  label = "Date and time",
  className,
  style,
}: DateReelProps) {
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced);

  const initialDate = useMemo(() => {
    const base = new Date((value ?? defaultValue).getTime());
    base.setSeconds(0, 0);
    const snapped = snapMinutes(base.getMinutes(), minuteStep);
    base.setMinutes(snapped);
    return base;
  }, [defaultValue, minuteStep, value]);

  const [uncontrolledDate, setUncontrolledDate] = useState<Date>(initialDate);
  const currentDate = value ?? uncontrolledDate;

  const today = useMemo(
    () => startOfDay(todayProp ?? initialDate),
    [todayProp, initialDate],
  );

  const minDate = useMemo(() => {
    if (minDateProp) return startOfDay(minDateProp);
    if (mode === "date") {
      return new Date(today.getFullYear() - 100, 0, 1);
    }
    return addDays(today, -30);
  }, [minDateProp, mode, today]);

  const maxDate = useMemo(() => {
    if (maxDateProp) return startOfDay(maxDateProp);
    if (mode === "date") {
      return new Date(today.getFullYear() + 10, 11, 31);
    }
    return addDays(today, 365);
  }, [maxDateProp, mode, today]);

  const [confirmStatus, setConfirmStatus] = useState<ConfirmStatus>("idle");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [focusedReel, setFocusedReel] = useState<string | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [introPending, setIntroPending] = useState(() => intro && !reduced && !paused);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const reelElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const drumSlotsRef = useRef<Record<string, Array<HTMLSpanElement | null>>>({});
  const lensSlotsRef = useRef<Record<string, Array<HTMLSpanElement | null>>>({});
  const slotCacheRef = useRef<Record<string, Array<{ text: string; off: boolean }>>>({});
  const statesRef = useRef<Record<string, ReelState>>({});
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const visibleRef = useRef<boolean>(true);
  const introDoneRef = useRef<boolean>(!intro || reduced || paused);
  const typeaheadRef = useRef<{ reelId: string; buf: string; ts: number }>({
    reelId: "",
    buf: "",
    ts: 0,
  });

  const onChangeRef = useRef(onChange);
  const currentDateRef = useRef(currentDate);
  const reducedRef = useRef(reduced);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);

  useEffect(() => {
    onChangeRef.current = onChange;
    currentDateRef.current = currentDate;
    reducedRef.current = reduced;
    speedRef.current = speed;
    pausedRef.current = paused;
  });

  // Formatters
  const fmtDayShort = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );
  const fmtMonthLong = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long" }),
    [locale],
  );
  const fmtFullDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [locale],
  );
  const fmtTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: hourCycle === 12,
      }),
    [hourCycle, locale],
  );

  const periodWords = useMemo(() => {
    const am =
      new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
        .formatToParts(new Date(2026, 0, 1, 9, 0))
        .find((p) => p.type === "dayPeriod")?.value ?? "AM";
    const pm =
      new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
        .formatToParts(new Date(2026, 0, 1, 21, 0))
        .find((p) => p.type === "dayPeriod")?.value ?? "PM";
    return [am, pm] as const;
  }, [locale]);

  const totalDays = useMemo(
    () => Math.max(1, daysBetween(minDate, maxDate) + 1),
    [minDate, maxDate],
  );

  const minYear = minDate.getFullYear();
  const maxYear = maxDate.getFullYear();
  const yearCount = Math.max(1, maxYear - minYear + 1);
  const minuteCount = Math.floor(60 / minuteStep);

  const todayIndex = useMemo(() => daysBetween(minDate, today), [minDate, today]);
  const todayWord = labels?.today ?? "Today";

  // Build reel specs for the active mode
  const specs = useMemo<ReelSpec[]>(() => {
    const result: ReelSpec[] = [];

    if (mode === "datetime") {
      const sizerSamples = [todayWord];
      for (let m = 0; m < 12; m++) {
        sizerSamples.push(fmtDayShort.format(new Date(2026, m, 28)));
      }
      result.push({
        id: "day",
        label: labels?.day ?? "Day",
        count: totalDays,
        loop: false,
        align: "end",
        pageStep: 7,
        getText: (idx) => {
          if (idx === todayIndex) return todayWord;
          return fmtDayShort.format(addDays(minDate, idx));
        },
        sizerSamples,
      });
    } else if (mode === "date") {
      const monthNames = Array.from({ length: 12 }, (_, m) =>
        fmtMonthLong.format(new Date(2026, m, 1)),
      );
      result.push({
        id: "month",
        label: labels?.month ?? "Month",
        count: 12,
        loop: true,
        align: "end",
        pageStep: 3,
        getText: (idx) => monthNames[mod(idx, 12)],
        sizerSamples: monthNames,
      });
      result.push({
        id: "date",
        label: labels?.date ?? "Date",
        count: 31,
        loop: true,
        align: "center",
        pageStep: 7,
        getText: (idx) => String(mod(idx, 31) + 1),
        isOff: (idx, refDate) => {
          const maxD = daysInMonth(refDate.getFullYear(), refDate.getMonth());
          return mod(idx, 31) + 1 > maxD;
        },
        sizerSamples: ["30", "31"],
      });
      result.push({
        id: "year",
        label: labels?.year ?? "Year",
        count: yearCount,
        loop: false,
        align: "start",
        pageStep: 10,
        getText: (idx) => String(minYear + clamp(idx, 0, yearCount - 1)),
        sizerSamples: [String(minYear), String(maxYear), "2026"],
      });
    }

    if (mode === "datetime" || mode === "time") {
      const hourCount = hourCycle === 12 ? 12 : 24;
      result.push({
        id: "hour",
        label: labels?.hour ?? "Hour",
        count: hourCount,
        loop: true,
        align: "end",
        pageStep: hourCycle === 12 ? 3 : 6,
        getText: (idx) => {
          const h = mod(idx, hourCount);
          if (hourCycle === 12) return String(h === 0 ? 12 : h);
          return String(h).padStart(2, "0");
        },
        sizerSamples: hourCycle === 12 ? ["12", "10"] : ["23", "00"],
      });

      result.push({
        id: "minute",
        label: labels?.minute ?? "Minute",
        count: minuteCount,
        loop: true,
        align: hourCycle === 12 ? "center" : "start",
        pageStep: Math.max(1, Math.round(15 / minuteStep)),
        getText: (idx) =>
          String(mod(idx, minuteCount) * minuteStep).padStart(2, "0"),
        sizerSamples: ["00", "55"],
      });

      if (hourCycle === 12) {
        result.push({
          id: "period",
          label: labels?.period ?? "AM or PM",
          count: 2,
          loop: false,
          align: "start",
          pageStep: 1,
          getText: (idx) => periodWords[clamp(idx, 0, 1)],
          sizerSamples: [periodWords[0], periodWords[1]],
        });
      }
    }

    return result;
  }, [
    fmtDayShort,
    fmtMonthLong,
    hourCycle,
    labels?.date,
    labels?.day,
    labels?.hour,
    labels?.minute,
    labels?.month,
    labels?.period,
    labels?.year,
    maxYear,
    minDate,
    minYear,
    minuteCount,
    minuteStep,
    mode,
    periodWords,
    todayIndex,
    todayWord,
    totalDays,
    yearCount,
  ]);

  const specsRef = useRef(specs);
  useEffect(() => {
    specsRef.current = specs;
  }, [specs]);

  // Convert Date -> reel indices
  const dateToIndices = useCallback(
    (d: Date): Record<string, number> => {
      const indices: Record<string, number> = {};
      if (mode === "datetime") {
        indices.day = clamp(daysBetween(minDate, startOfDay(d)), 0, totalDays - 1);
      } else if (mode === "date") {
        indices.month = d.getMonth();
        indices.date = d.getDate() - 1;
        indices.year = clamp(d.getFullYear() - minYear, 0, yearCount - 1);
      }
      if (mode === "datetime" || mode === "time") {
        const hrs = d.getHours();
        if (hourCycle === 12) {
          indices.hour = hrs % 12;
          indices.period = hrs >= 12 ? 1 : 0;
        } else {
          indices.hour = hrs;
        }
        indices.minute = mod(Math.round(d.getMinutes() / minuteStep), minuteCount);
      }
      return indices;
    },
    [hourCycle, minDate, minYear, minuteCount, minuteStep, mode, totalDays, yearCount],
  );

  // Convert reel indices -> Date
  const indicesToDate = useCallback(
    (indices: Record<string, number>, base: Date): Date => {
      let year = base.getFullYear();
      let month = base.getMonth();
      let day = base.getDate();
      let hours = base.getHours();
      let minutes = base.getMinutes();

      if (mode === "datetime" && indices.day !== undefined) {
        const d = addDays(minDate, clamp(Math.round(indices.day), 0, totalDays - 1));
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
      } else if (mode === "date") {
        year = minYear + clamp(Math.round(indices.year ?? 0), 0, yearCount - 1);
        month = mod(Math.round(indices.month ?? 0), 12);
        const maxDay = daysInMonth(year, month);
        day = clamp(mod(Math.round(indices.date ?? 0), 31) + 1, 1, maxDay);
      }

      if (mode === "datetime" || mode === "time") {
        if (hourCycle === 12) {
          const h12 = mod(Math.round(indices.hour ?? 0), 12);
          const period = clamp(Math.round(indices.period ?? 0), 0, 1);
          hours = period * 12 + h12;
        } else {
          hours = mod(Math.round(indices.hour ?? 0), 24);
        }
        minutes = mod(Math.round(indices.minute ?? 0), minuteCount) * minuteStep;
      }

      return new Date(year, month, day, hours, minutes, 0, 0);
    },
    [hourCycle, minDate, minYear, minuteCount, minuteStep, mode, totalDays, yearCount],
  );

  // Summary headline & detail text
  const summary = useMemo(() => {
    const timeStr = fmtTime.format(currentDate);
    if (mode === "time") {
      return {
        headline: timeStr,
        detail: hourCycle === 12 ? "12-hour clock" : "24-hour clock",
      };
    }

    const diff = daysBetween(today, startOfDay(currentDate));
    let relDay: string;
    if (diff === 0) relDay = labels?.today ?? "Today";
    else if (diff === 1) relDay = labels?.tomorrow ?? "Tomorrow";
    else if (diff === -1) relDay = labels?.yesterday ?? "Yesterday";
    else if (diff > 1 && diff <= 30) relDay = `In ${diff} days`;
    else if (diff < -1 && diff >= -30) relDay = `${Math.abs(diff)} days ago`;
    else relDay = fmtDayShort.format(currentDate);

    if (mode === "date") {
      return {
        headline: fmtFullDate.format(currentDate),
        detail: relDay,
      };
    }

    const atWord = labels?.at ?? "at";
    return {
      headline: `${relDay} ${atWord} ${timeStr}`,
      detail: fmtFullDate.format(currentDate),
    };
  }, [
    currentDate,
    fmtDayShort,
    fmtFullDate,
    fmtTime,
    hourCycle,
    labels?.at,
    labels?.today,
    labels?.tomorrow,
    labels?.yesterday,
    mode,
    today,
  ]);

  // Paint one reel directly to recycled DOM nodes
  const paintReel = useCallback((spec: ReelSpec, pos: number) => {
    const drumSlots = drumSlotsRef.current[spec.id];
    const lensSlots = lensSlotsRef.current[spec.id];
    if (!drumSlots || !lensSlots) return;

    const rowHeight =
      reelElsRef.current[spec.id]
        ?.querySelector<HTMLElement>("[data-row='true']")
        ?.getBoundingClientRect().height || 42;
    const radius = rowHeight / STEP_ANGLE;

    const centerIdx = Math.round(pos);
    let cache = slotCacheRef.current[spec.id];
    if (!cache || cache.length !== SLOT_COUNT) {
      cache = Array.from({ length: SLOT_COUNT }, () => ({ text: "", off: false }));
      slotCacheRef.current[spec.id] = cache;
    }

    for (let s = 0; s < SLOT_COUNT; s++) {
      const idx = centerIdx + (s - HALF_SLOTS);
      const drumEl = drumSlots[s];
      const lensEl = lensSlots[s];
      if (!drumEl || !lensEl) continue;

      const outOfBounds = !spec.loop && (idx < 0 || idx >= spec.count);
      if (outOfBounds) {
        drumEl.style.opacity = "0";
        lensEl.style.opacity = "0";
        continue;
      }

      const delta = idx - pos;
      const angle = delta * STEP_ANGLE;
      const absAngle = Math.abs(angle);

      const text = spec.getText(idx);
      const off = spec.isOff ? spec.isOff(idx, currentDateRef.current) : false;

      if (cache[s].text !== text) {
        drumEl.textContent = text;
        lensEl.textContent = text;
        cache[s].text = text;
      }
      if (cache[s].off !== off) {
        if (off) {
          drumEl.setAttribute("data-off", "");
          lensEl.setAttribute("data-off", "");
        } else {
          drumEl.removeAttribute("data-off");
          lensEl.removeAttribute("data-off");
        }
        cache[s].off = off;
      }

      // Drum projection onto cylinder
      if (absAngle >= Math.PI / 2) {
        drumEl.style.opacity = "0";
      } else {
        const y = Math.sin(angle) * radius;
        const cosA = Math.cos(angle);
        const scaleY = Math.max(0.25, cosA);
        const scaleX = 0.88 + 0.12 * cosA;
        const opacity = Math.max(0, Math.pow(cosA, 1.35));
        drumEl.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
        drumEl.style.opacity = opacity.toFixed(3);
      }

      // Lens crisp flat copy
      if (Math.abs(delta) > 1.35) {
        lensEl.style.opacity = "0";
      } else {
        const lensY = delta * rowHeight;
        lensEl.style.transform = `translate3d(0, ${lensY.toFixed(2)}px, 0)`;
        lensEl.style.opacity = "1";
      }
    }
  }, []);

  const commitIfChanged = useCallback(() => {
    const activeSpecs = specsRef.current;
    const indices: Record<string, number> = {};
    for (const spec of activeSpecs) {
      const st = statesRef.current[spec.id];
      if (!st) continue;
      let snapped = Math.round(st.pos);
      if (!spec.loop) {
        snapped = clamp(snapped, 0, spec.count - 1);
      }
      indices[spec.id] = snapped;
    }

    const nextDate = indicesToDate(indices, currentDateRef.current);

    // If date mode clamped invalid day (e.g. Feb 30 -> Feb 28), snap date reel back
    if (mode === "date" && statesRef.current.date) {
      const wantedDayIdx = nextDate.getDate() - 1;
      const curDayIdx = mod(Math.round(statesRef.current.date.pos), 31);
      if (wantedDayIdx !== curDayIdx) {
        const delta = wantedDayIdx - curDayIdx;
        statesRef.current.date.target = Math.round(statesRef.current.date.pos) + delta;
        if (reducedRef.current) {
          statesRef.current.date.pos = statesRef.current.date.target;
        }
      }
    }

    if (nextDate.getTime() !== currentDateRef.current.getTime()) {
      if (value === undefined) {
        setUncontrolledDate(nextDate);
      }
      currentDateRef.current = nextDate;
      onChangeRef.current?.(nextDate);
      const timeStr = fmtTime.format(nextDate);
      const dateStr = fmtFullDate.format(nextDate);
      setLiveAnnouncement(
        mode === "time" ? timeStr : mode === "date" ? dateStr : `${dateStr}, ${timeStr}`,
      );
    }
  }, [fmtFullDate, fmtTime, indicesToDate, mode, value]);

  const scheduleTickRef = useRef<() => void>(() => {});
  const tickRef = useRef<(now: number) => void>(() => {});

  const tick = useCallback(
    (now: number) => {
      rafRef.current = null;
      if (!visibleRef.current || document.hidden) {
        lastFrameRef.current = 0;
        return;
      }

      const rawDt = lastFrameRef.current
        ? Math.min(0.05, (now - lastFrameRef.current) / 1000)
        : 1 / 60;
      lastFrameRef.current = now;
      const dt = rawDt * Math.max(0.2, speedRef.current);

      let anyMoving = false;
      const activeSpecs = specsRef.current;

      for (const spec of activeSpecs) {
        const st = statesRef.current[spec.id];
        if (!st) continue;

        if (st.dragging) {
          paintReel(spec, st.pos);
          anyMoving = true;
          continue;
        }

        if (reducedRef.current || pausedRef.current) {
          st.pos = st.target;
          st.vel = 0;
          st.gliding = false;
          paintReel(spec, st.pos);
          continue;
        }

        if (st.gliding) {
          // Exponential decay toward landing target
          const decay = Math.exp(-5.4 * dt);
          st.pos += st.vel * dt;
          st.vel *= decay;

          if (!spec.loop) {
            if (st.pos < 0 || st.pos > spec.count - 1) {
              st.gliding = false;
              st.target = clamp(Math.round(st.pos), 0, spec.count - 1);
            }
          }

          if (Math.abs(st.vel) < 2.2) {
            st.gliding = false;
            st.target = spec.loop
              ? Math.round(st.pos + st.vel * 0.12)
              : clamp(Math.round(st.pos + st.vel * 0.12), 0, spec.count - 1);
          }
          anyMoving = true;
        } else {
          // Critically damped spring to target
          const omega = 18;
          const disp = st.pos - st.target;
          const acc = -omega * omega * disp - 2 * omega * st.vel;
          st.vel += acc * dt;
          st.pos += st.vel * dt;

          if (Math.abs(st.pos - st.target) < 0.0015 && Math.abs(st.vel) < 0.004) {
            st.pos = st.target;
            st.vel = 0;
          } else {
            anyMoving = true;
          }
        }

        paintReel(spec, st.pos);
      }

      if (anyMoving) {
        rafRef.current = window.requestAnimationFrame((nextNow) => tickRef.current(nextNow));
      } else {
        lastFrameRef.current = 0;
        commitIfChanged();
      }
    },
    [commitIfChanged, paintReel],
  );

  const wake = useCallback(() => {
    if (rafRef.current !== null) return;
    if (!visibleRef.current || document.hidden) return;
    lastFrameRef.current = 0;
    rafRef.current = window.requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    tickRef.current = tick;
    scheduleTickRef.current = wake;
  }, [tick, wake]);

  // Initialize reel states on mount / mode / specs change
  useEffect(() => {
    const targetIndices = dateToIndices(currentDateRef.current);
    const nextStates: Record<string, ReelState> = {};

    for (const spec of specs) {
      const idx = targetIndices[spec.id] ?? 0;
      const existing = statesRef.current[spec.id];
      const pos = existing ? existing.pos : idx;
      nextStates[spec.id] = {
        pos: introPending ? idx - 4 : pos,
        vel: 0,
        target: idx,
        dragging: false,
        gliding: false,
        lastDragY: 0,
        lastDragT: 0,
        samples: [],
        startX: 0,
        startY: 0,
        moved: false,
        active: false,
      };
    }

    statesRef.current = nextStates;
    slotCacheRef.current = {};

    for (const spec of specs) {
      paintReel(spec, nextStates[spec.id].pos);
    }

    if (!introPending) {
      wake();
    }
  }, [dateToIndices, introPending, paintReel, specs, wake]);

  // Sync external controlled `value` changes smoothly along shortest path
  const prevValueMsRef = useRef<number | null>(value ? value.getTime() : null);
  useEffect(() => {
    if (!value) return;
    const ms = value.getTime();
    if (prevValueMsRef.current === ms) return;
    prevValueMsRef.current = ms;

    const targetIndices = dateToIndices(value);
    for (const spec of specsRef.current) {
      const st = statesRef.current[spec.id];
      if (!st || st.dragging) continue;
      const desired = targetIndices[spec.id] ?? 0;
      if (spec.loop) {
        const curMod = mod(Math.round(st.target), spec.count);
        let diff = desired - curMod;
        if (diff > spec.count / 2) diff -= spec.count;
        if (diff < -spec.count / 2) diff += spec.count;
        st.target = Math.round(st.target) + diff;
      } else {
        st.target = clamp(desired, 0, spec.count - 1);
      }
      st.gliding = false;
      if (reducedRef.current || pausedRef.current) {
        st.pos = st.target;
        paintReel(spec, st.pos);
      }
    }
    wake();
  }, [dateToIndices, paintReel, value, wake]);

  // IntersectionObserver for intro trigger + offscreen pause
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const isVis = entries.some((e) => e.isIntersecting);
        visibleRef.current = isVis;
        if (isVis) {
          if (!introDoneRef.current && intro && !reducedRef.current && !pausedRef.current) {
            introDoneRef.current = true;
            setIntroPending(false);
            wake();
          } else {
            wake();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    const onVisChange = () => {
      if (!document.hidden && visibleRef.current) {
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [intro, wake]);

  // Non-passive wheel listeners on each reel
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    for (const spec of specs) {
      const el = reelElsRef.current[spec.id];
      if (!el) continue;

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const st = statesRef.current[spec.id];
        if (!st) return;

        const step = Math.sign(ev.deltaY) * Math.max(1, Math.round(Math.abs(ev.deltaY) / 48));
        const nextTarget = st.target + step;
        st.target = spec.loop ? nextTarget : clamp(nextTarget, 0, spec.count - 1);
        st.gliding = false;
        if (reducedRef.current || pausedRef.current) {
          st.pos = st.target;
          paintReel(spec, st.pos);
          commitIfChanged();
        } else {
          wake();
        }
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      cleanups.push(() => el.removeEventListener("wheel", onWheel));
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [commitIfChanged, paintReel, specs, wake]);

  // Pointer drag + tap handling
  const onPointerDown = useCallback(
    (spec: ReelSpec, ev: ReactPointerEvent<HTMLDivElement>) => {
      if (ev.button !== 0 && ev.pointerType === "mouse") return;
      const st = statesRef.current[spec.id];
      if (!st) return;

      ev.currentTarget.setPointerCapture(ev.pointerId);
      st.dragging = true;
      st.gliding = false;
      st.vel = 0;
      st.startX = ev.clientX;
      st.startY = ev.clientY;
      st.lastDragY = ev.clientY;
      st.lastDragT = performance.now();
      st.samples = [{ y: ev.clientY, t: st.lastDragT }];
      st.moved = false;
      setIsDraggingAny(true);
      setFocusedReel(spec.id);
      wake();
    },
    [wake],
  );

  const onPointerMove = useCallback(
    (spec: ReelSpec, ev: ReactPointerEvent<HTMLDivElement>) => {
      const st = statesRef.current[spec.id];
      if (!st || !st.dragging) return;

      const rowHeight =
        ev.currentTarget
          .querySelector<HTMLElement>("[data-row='true']")
          ?.getBoundingClientRect().height || 42;

      const dy = ev.clientY - st.lastDragY;
      if (Math.abs(ev.clientY - st.startY) > 4) {
        st.moved = true;
      }

      let deltaRows = -dy / rowHeight;
      if (!spec.loop) {
        if (st.pos < 0 || st.pos > spec.count - 1) {
          deltaRows *= 0.35; // rubber-band resistance
        }
      }

      st.pos += deltaRows;
      st.lastDragY = ev.clientY;
      const now = performance.now();
      st.lastDragT = now;
      st.samples.push({ y: ev.clientY, t: now });
      if (st.samples.length > 6) st.samples.shift();

      paintReel(spec, st.pos);
    },
    [paintReel],
  );

  const onPointerUp = useCallback(
    (spec: ReelSpec, ev: ReactPointerEvent<HTMLDivElement>) => {
      const st = statesRef.current[spec.id];
      if (!st || !st.dragging) return;

      st.dragging = false;
      setIsDraggingAny(false);

      const rowHeight =
        ev.currentTarget
          .querySelector<HTMLElement>("[data-row='true']")
          ?.getBoundingClientRect().height || 42;

      if (!st.moved) {
        // Tap above or below center lens moves by 1 or 2 rows
        const rect = ev.currentTarget.getBoundingClientRect();
        const relY = ev.clientY - (rect.top + rect.height / 2);
        const offsetRows = Math.round(relY / rowHeight);
        if (offsetRows !== 0) {
          const nextTarget = Math.round(st.pos) + clamp(offsetRows, -2, 2);
          st.target = spec.loop ? nextTarget : clamp(nextTarget, 0, spec.count - 1);
          st.gliding = false;
        } else {
          st.target = spec.loop
            ? Math.round(st.pos)
            : clamp(Math.round(st.pos), 0, spec.count - 1);
        }
      } else {
        // Compute release velocity from recent samples
        const now = performance.now();
        const recent = st.samples.filter((s) => now - s.t <= 90);
        let velRowsPerSec = 0;
        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const dtSec = Math.max(0.012, (last.t - first.t) / 1000);
          velRowsPerSec = -((last.y - first.y) / rowHeight) / dtSec;
        }

        if (
          !reducedRef.current &&
          !pausedRef.current &&
          Math.abs(velRowsPerSec) > 3.2
        ) {
          st.vel = clamp(velRowsPerSec, -28, 28);
          st.gliding = true;
        } else {
          st.vel = 0;
          st.gliding = false;
          st.target = spec.loop
            ? Math.round(st.pos)
            : clamp(Math.round(st.pos), 0, spec.count - 1);
        }
      }

      if (reducedRef.current || pausedRef.current) {
        st.pos = st.target;
        st.vel = 0;
        st.gliding = false;
        paintReel(spec, st.pos);
        commitIfChanged();
      } else {
        wake();
      }
    },
    [commitIfChanged, paintReel, wake],
  );

  // Keyboard navigation + typeahead
  const onReelKeyDown = useCallback(
    (spec: ReelSpec, specIndex: number, ev: KeyboardEvent<HTMLDivElement>) => {
      const st = statesRef.current[spec.id];
      if (!st) return;

      const moveTo = (nextTarget: number) => {
        st.target = spec.loop ? nextTarget : clamp(nextTarget, 0, spec.count - 1);
        st.gliding = false;
        if (reducedRef.current || pausedRef.current) {
          st.pos = st.target;
          paintReel(spec, st.pos);
          commitIfChanged();
        } else {
          wake();
        }
      };

      switch (ev.key) {
        case "ArrowUp":
          ev.preventDefault();
          moveTo(st.target - 1);
          return;
        case "ArrowDown":
          ev.preventDefault();
          moveTo(st.target + 1);
          return;
        case "PageUp":
          ev.preventDefault();
          moveTo(st.target - spec.pageStep);
          return;
        case "PageDown":
          ev.preventDefault();
          moveTo(st.target + spec.pageStep);
          return;
        case "Home":
          ev.preventDefault();
          moveTo(0);
          return;
        case "End":
          ev.preventDefault();
          moveTo(spec.count - 1);
          return;
        case "ArrowLeft": {
          ev.preventDefault();
          const prev = specs[specIndex - 1];
          if (prev) reelElsRef.current[prev.id]?.focus();
          return;
        }
        case "ArrowRight": {
          ev.preventDefault();
          const next = specs[specIndex + 1];
          if (next) reelElsRef.current[next.id]?.focus();
          return;
        }
        default:
          break;
      }

      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        const ch = ev.key.toLowerCase();
        if (!/[a-z0-9]/.test(ch)) return;
        ev.preventDefault();

        const now = performance.now();
        const prev = typeaheadRef.current;
        const buf =
          prev.reelId === spec.id && now - prev.ts < 700 ? prev.buf + ch : ch;
        typeaheadRef.current = { reelId: spec.id, buf, ts: now };

        const searchLimit = Math.min(spec.count, 120);
        for (let i = 0; i < searchLimit; i++) {
          const text = spec.getText(i).toLowerCase();
          if (text.startsWith(buf) || text === buf.padStart(2, "0")) {
            if (spec.loop) {
              const curMod = mod(Math.round(st.target), spec.count);
              let diff = i - curMod;
              if (diff > spec.count / 2) diff -= spec.count;
              if (diff < -spec.count / 2) diff += spec.count;
              moveTo(Math.round(st.target) + diff);
            } else {
              moveTo(i);
            }
            return;
          }
        }
      }
    },
    [commitIfChanged, paintReel, specs, wake],
  );

  // Spin all reels to a preset Date
  const spinToDate = useCallback(
    (targetDate: Date) => {
      const clamped = new Date(targetDate.getTime());
      clamped.setSeconds(0, 0);
      clamped.setMinutes(snapMinutes(clamped.getMinutes(), minuteStep));

      const targetIndices = dateToIndices(clamped);
      specsRef.current.forEach((spec) => {
        const st = statesRef.current[spec.id];
        if (!st) return;
        const desired = targetIndices[spec.id] ?? 0;
        if (spec.loop) {
          const curMod = mod(Math.round(st.target), spec.count);
          let diff = desired - curMod;
          if (diff > spec.count / 2) diff -= spec.count;
          if (diff < -spec.count / 2) diff += spec.count;
          st.target = Math.round(st.target) + diff;
        } else {
          st.target = clamp(desired, 0, spec.count - 1);
        }
        st.gliding = false;
        if (reducedRef.current || pausedRef.current) {
          st.pos = st.target;
          paintReel(spec, st.pos);
        }
      });

      if (reducedRef.current || pausedRef.current) {
        commitIfChanged();
      } else {
        wake();
      }
    },
    [commitIfChanged, dateToIndices, minuteStep, paintReel, wake],
  );

  const resolvedPresets = useMemo(() => {
    if (presetsProp === false) return null;
    const list = presetsProp ?? defaultPresets();
    return list.map((p) => ({
      label: p.label,
      date: typeof p.value === "function" ? p.value(today) : p.value,
    }));
  }, [presetsProp, today]);

  const isPresetActive = useCallback(
    (presetDate: Date) => {
      if (mode === "date") {
        return (
          presetDate.getFullYear() === currentDate.getFullYear() &&
          presetDate.getMonth() === currentDate.getMonth() &&
          presetDate.getDate() === currentDate.getDate()
        );
      }
      if (mode === "time") {
        return (
          presetDate.getHours() === currentDate.getHours() &&
          presetDate.getMinutes() === currentDate.getMinutes()
        );
      }
      return (
        presetDate.getFullYear() === currentDate.getFullYear() &&
        presetDate.getMonth() === currentDate.getMonth() &&
        presetDate.getDate() === currentDate.getDate() &&
        presetDate.getHours() === currentDate.getHours() &&
        presetDate.getMinutes() === currentDate.getMinutes()
      );
    },
    [currentDate, mode],
  );

  const handleConfirm = useCallback(async () => {
    if (!onConfirm || confirmStatus === "pending") return;
    setConfirmStatus("pending");
    try {
      await onConfirm(currentDateRef.current);
      setConfirmStatus("done");
      setLiveAnnouncement(labels?.confirmed ?? "Scheduled");
      window.setTimeout(() => setConfirmStatus("idle"), 1800);
    } catch {
      setConfirmStatus("failed");
      setLiveAnnouncement(labels?.failed ?? "Could not schedule");
      window.setTimeout(() => setConfirmStatus("idle"), 2200);
    }
  }, [confirmStatus, labels, onConfirm]);

  const currentIndices = useMemo(
    () => dateToIndices(currentDate),
    [currentDate, dateToIndices],
  );

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      ...(accent ? ({ "--dr-accent": accent } as CSSProperties) : undefined),
      ...style,
    }),
    [accent, style],
  );

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-mode={mode}
      data-dragging={isDraggingAny ? "" : undefined}
      data-intro={introPending ? "" : undefined}
      style={rootStyle}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          {title ? <h3 className={styles.title}>{title}</h3> : null}
          <p className={styles.summary} aria-hidden="true">
            <span className={styles.headline}>{summary.headline}</span>
            <span className={styles.detail}>{summary.detail}</span>
          </p>
        </div>

        <div ref={stageRef} className={styles.stage}>
          <div className={styles.lens} aria-hidden="true" />
          <div className={styles.reels}>
            {specs.map((spec, specIndex) => {
              const curIdx = currentIndices[spec.id] ?? 0;
              return (
                <div
                  key={spec.id}
                  ref={(node) => {
                    reelElsRef.current[spec.id] = node;
                  }}
                  className={styles.reel}
                  data-align={spec.align}
                  data-active={focusedReel === spec.id ? "" : undefined}
                  style={{ "--dr-i": specIndex } as CSSProperties}
                  role="spinbutton"
                  tabIndex={0}
                  aria-label={spec.label}
                  aria-valuemin={0}
                  aria-valuemax={spec.count - 1}
                  aria-valuenow={curIdx}
                  aria-valuetext={spec.getText(curIdx)}
                  onFocus={() => setFocusedReel(spec.id)}
                  onBlur={() =>
                    setFocusedReel((prev) => (prev === spec.id ? null : prev))
                  }
                  onPointerDown={(ev) => onPointerDown(spec, ev)}
                  onPointerMove={(ev) => onPointerMove(spec, ev)}
                  onPointerUp={(ev) => onPointerUp(spec, ev)}
                  onPointerCancel={(ev) => onPointerUp(spec, ev)}
                  onKeyDown={(ev) => onReelKeyDown(spec, specIndex, ev)}
                >
                  <span className={styles.sizer} aria-hidden="true" data-row="true">
                    {spec.sizerSamples.map((sample, i) => (
                      <span key={`${spec.id}-sz-${i}`}>{sample}</span>
                    ))}
                  </span>

                  <div className={styles.drum} aria-hidden="true">
                    {Array.from({ length: SLOT_COUNT }, (_, s) => (
                      <span
                        key={s}
                        ref={(node) => {
                          if (!drumSlotsRef.current[spec.id]) {
                            drumSlotsRef.current[spec.id] = [];
                          }
                          drumSlotsRef.current[spec.id][s] = node;
                        }}
                        className={styles.item}
                      />
                    ))}
                  </div>

                  <div className={styles.window} aria-hidden="true">
                    {Array.from({ length: SLOT_COUNT }, (_, s) => (
                      <span
                        key={s}
                        ref={(node) => {
                          if (!lensSlotsRef.current[spec.id]) {
                            lensSlotsRef.current[spec.id] = [];
                          }
                          lensSlotsRef.current[spec.id][s] = node;
                        }}
                        className={styles.lensItem}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(resolvedPresets && resolvedPresets.length > 0) || onConfirm ? (
          <div className={styles.footer}>
            {resolvedPresets && resolvedPresets.length > 0 ? (
              <div
                className={styles.presets}
                role="group"
                aria-label={labels?.presets ?? "Quick picks"}
              >
                {resolvedPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={styles.preset}
                    aria-pressed={isPresetActive(preset.date)}
                    onClick={() => spinToDate(preset.date)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            {onConfirm ? (
              <button
                type="button"
                className={styles.confirm}
                aria-disabled={confirmStatus === "pending"}
                onClick={() => void handleConfirm()}
              >
                <span className={styles.confirmStack}>
                  <span data-show={confirmStatus === "idle" ? "" : undefined}>
                    {labels?.confirm ?? "Schedule"}
                  </span>
                  <span data-show={confirmStatus === "pending" ? "" : undefined}>
                    <Loader2 size={14} className={styles.spin} aria-hidden="true" />
                    {labels?.confirming ?? "Scheduling"}
                  </span>
                  <span data-show={confirmStatus === "done" ? "" : undefined}>
                    <Check size={14} aria-hidden="true" />
                    {labels?.confirmed ?? "Scheduled"}
                  </span>
                  <span data-show={confirmStatus === "failed" ? "" : undefined}>
                    <RotateCcw size={14} aria-hidden="true" />
                    {labels?.failed ?? "Retry"}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
    </div>
  );
}
