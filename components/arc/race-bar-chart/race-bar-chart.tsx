"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./race-bar-chart.module.css";

export interface RaceBarItem {
  id: string;
  label: string;
  group?: string;
}

export interface RaceBarFrame {
  period: string;
  values: Record<string, number>;
}

export interface RaceBarGroup {
  id: string;
  label: string;
}

export interface RaceBarChartProps {
  items: RaceBarItem[];
  frames: RaceBarFrame[];
  label: string;
  groups?: RaceBarGroup[];
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  bars?: number;
  frame?: number;
  defaultFrame?: number;
  onFrameChange?: (index: number) => void;
  playing?: boolean;
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  autoPlay?: boolean;
  frameDuration?: number;
  loop?: boolean;
  highlight?: string;
  className?: string;
}

const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
] as const;

const ROW_HEIGHT = 36;
const BAR_HEIGHT = 24;
const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const AXIS_TOP = 26;
const LABEL_WIDTH = 104;
const LABEL_GAP = 12;
const VALUE_GAP = 8;
const RIGHT_PAD = 62;

function defaultFormatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function niceStep(maxVal: number, targetTicks: number): number {
  if (maxVal <= 0 || targetTicks <= 0) return 1;
  const rough = maxVal / targetTicks;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const frac = rough / base;
  if (frac <= 1.2) return base;
  if (frac <= 2.5) return 2 * base;
  if (frac <= 5.5) return 5 * base;
  return 10 * base;
}

interface RowSpringState {
  y: number;
  vy: number;
  opacity: number;
  initialized: boolean;
}

export function RaceBarChart({
  items,
  frames,
  label,
  groups,
  formatValue = defaultFormatCompact,
  formatTick,
  bars = 8,
  frame: controlledFrame,
  defaultFrame = 0,
  onFrameChange,
  playing: controlledPlaying,
  defaultPlaying = false,
  onPlayingChange,
  autoPlay = true,
  frameDuration = 1400,
  loop = false,
  highlight,
  className,
}: RaceBarChartProps) {
  const reduced = Boolean(useReducedMotion());
  const maxFrame = Math.max(0, frames.length - 1);
  const clampFrame = useCallback(
    (idx: number) => Math.max(0, Math.min(maxFrame, Math.round(idx))),
    [maxFrame],
  );

  const [internalFrame, setInternalFrame] = useState(() => clampFrame(defaultFrame));
  const [internalPlaying, setInternalPlaying] = useState(defaultPlaying);
  const frameIndex = controlledFrame !== undefined ? clampFrame(controlledFrame) : internalFrame;
  const isPlaying = controlledPlaying !== undefined ? controlledPlaying : internalPlaying;

  const setFrameIndex = useCallback(
    (next: number) => {
      const clamped = clampFrame(next);
      if (controlledFrame === undefined) setInternalFrame(clamped);
      onFrameChange?.(clamped);
    },
    [clampFrame, controlledFrame, onFrameChange],
  );

  const setPlaying = useCallback(
    (next: boolean) => {
      if (controlledPlaying === undefined) setInternalPlaying(next);
      onPlayingChange?.(next);
    },
    [controlledPlaying, onPlayingChange],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [plotWidth, setPlotWidth] = useState(520);
  const [announcement, setAnnouncement] = useState("");
  const atEnd = frameIndex >= maxFrame && maxFrame > 0;
  const [inView, setInView] = useState(true);
  const autoPlayedRef = useRef(false);

  const figureRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tipTitleRef = useRef<HTMLParagraphElement>(null);
  const tipValueRef = useRef<HTMLParagraphElement>(null);
  const tipNoteRef = useRef<HTMLParagraphElement>(null);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const labelRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const valueRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Animation refs (mutated inside rAF, zero React re-renders per frame)
  const targetTimeRef = useRef<number>(frameIndex);
  const drawnTimeRef = useRef<number>(frameIndex);
  const timeVelRef = useRef<number>(0);
  const drawnMaxRef = useRef<number>(0);
  const rowSpringsRef = useRef<Map<string, RowSpringState>>(new Map());
  const playingRef = useRef<boolean>(isPlaying);
  const inViewRef = useRef<boolean>(inView);
  const draggingRef = useRef<boolean>(false);
  const activeIdRef = useRef<string | null>(activeId);
  const lastPeriodIdxRef = useRef<number>(frameIndex);
  const rafRef = useRef<number | null>(null);
  const wakeRef = useRef<() => void>(() => {});
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    playingRef.current = isPlaying;
    wakeRef.current();
  }, [isPlaying]);

  useEffect(() => {
    inViewRef.current = inView;
    wakeRef.current();
  }, [inView]);

  useEffect(() => {
    activeIdRef.current = activeId;
    wakeRef.current();
  }, [activeId]);

  useEffect(() => {
    if (!playingRef.current && !draggingRef.current) {
      targetTimeRef.current = frameIndex;
      if (reduced) {
        drawnTimeRef.current = frameIndex;
        timeVelRef.current = 0;
      }
      wakeRef.current();
    }
  }, [frameIndex, maxFrame, reduced]);

  // Measure plot width
  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setPlotWidth(w);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pause off-screen and autoPlay first time in view
  useEffect(() => {
    const el = figureRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setInView(visible);
        if (visible && autoPlay && !reduced && !autoPlayedRef.current && maxFrame > 0) {
          autoPlayedRef.current = true;
          setPlaying(true);
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoPlay, reduced, maxFrame, setPlaying]);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (groups && groups.length > 0) {
      groups.forEach((g, idx) => {
        map.set(g.id, SERIES_VARS[idx % SERIES_VARS.length]);
      });
    }
    return map;
  }, [groups]);

  const getBarColor = useCallback(
    (item: RaceBarItem) => {
      if (!groups || groups.length === 0 || !item.group) return SERIES_VARS[0];
      return groupColorMap.get(item.group) ?? SERIES_VARS[0];
    },
    [groups, groupColorMap],
  );

  const visibleBars = Math.min(bars, Math.max(1, items.length));
  const compact = plotWidth < 400;
  const axisLeft = compact ? 0 : LABEL_WIDTH + LABEL_GAP;
  const chartRight = Math.max(axisLeft + 60, plotWidth - RIGHT_PAD);
  const barAreaWidth = Math.max(40, chartRight - axisLeft);
  const rowsHeight = visibleBars * ROW_HEIGHT;
  const plotHeight = AXIS_TOP + rowsHeight + 4;
  const tickFn = formatTick ?? formatValue;

  const getInterpolatedValues = useCallback(
    (t: number) => {
      if (frames.length === 0) return { vals: new Map<string, number>(), total: 0 };
      const clamped = Math.max(0, Math.min(maxFrame, t));
      const i0 = Math.floor(clamped);
      const i1 = Math.min(maxFrame, i0 + 1);
      const frac = clamped - i0;
      const f0 = frames[i0]?.values ?? {};
      const f1 = frames[i1]?.values ?? {};
      const vals = new Map<string, number>();
      let total = 0;
      for (const item of items) {
        const v0 = f0[item.id] ?? 0;
        const v1 = f1[item.id] ?? 0;
        const v = v0 + (v1 - v0) * frac;
        vals.set(item.id, v);
        total += v;
      }
      return { vals, total };
    },
    [frames, items, maxFrame],
  );

  // Main requestAnimationFrame loop
  useEffect(() => {
    if (frames.length === 0 || items.length === 0) return;

    const TICK_SLOTS = 8;

    const paint = (now: number) => {
      const dt = lastFrameTimeRef.current
        ? Math.min(0.05, Math.max(0.001, (now - lastFrameTimeRef.current) / 1000))
        : 1 / 60;
      lastFrameTimeRef.current = now;

      // Advance target time while playing and in view
      if (playingRef.current && inViewRef.current && !draggingRef.current && maxFrame > 0) {
        if (reduced) {
          // Step whole frames on reduced motion
          targetTimeRef.current += (dt * 1000) / frameDuration;
        } else {
          targetTimeRef.current += (dt * 1000) / frameDuration;
        }
        if (targetTimeRef.current >= maxFrame) {
          if (loop) {
            targetTimeRef.current = 0;
          } else {
            targetTimeRef.current = maxFrame;
            playingRef.current = false;
            setPlaying(false);
          }
        }
      }

      // Critically damped spring for drawnTime -> targetTime
      let timeSettled = true;
      if (reduced || draggingRef.current) {
        drawnTimeRef.current = reduced
          ? Math.round(targetTimeRef.current)
          : targetTimeRef.current;
        timeVelRef.current = 0;
      } else {
        const omega = 12;
        const diff = drawnTimeRef.current - targetTimeRef.current;
        const acc = -omega * omega * diff - 2 * omega * timeVelRef.current;
        timeVelRef.current += acc * dt;
        drawnTimeRef.current += timeVelRef.current * dt;
        if (Math.abs(diff) < 0.0005 && Math.abs(timeVelRef.current) < 0.001) {
          drawnTimeRef.current = targetTimeRef.current;
          timeVelRef.current = 0;
        } else {
          timeSettled = false;
        }
      }

      const drawnT = Math.max(0, Math.min(maxFrame, drawnTimeRef.current));
      const nearestPeriod = clampFrame(drawnT);
      if (nearestPeriod !== lastPeriodIdxRef.current) {
        lastPeriodIdxRef.current = nearestPeriod;
        setFrameIndex(nearestPeriod);
      }

      const { vals, total } = getInterpolatedValues(drawnT);

      // Update total readout
      if (totalRef.current) {
        totalRef.current.textContent = `Total ${formatValue(total)}`;
      }

      // Update timeline fill & thumb
      const pct = maxFrame > 0 ? drawnT / maxFrame : 0;
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${pct})`;
      }
      if (thumbRef.current) {
        thumbRef.current.style.left = `${pct * 100}%`;
      }

      // Rank items
      const ranked = items
        .map((item, origIdx) => ({
          item,
          value: vals.get(item.id) ?? 0,
          origIdx,
        }))
        .sort((a, b) => b.value - a.value || a.origIdx - b.origIdx);

      const rawMax = Math.max(1, ranked[0]?.value ?? 1);
      if (drawnMaxRef.current <= 0 || reduced) {
        drawnMaxRef.current = rawMax;
      } else {
        const blend = 1 - Math.exp(-10 * dt);
        drawnMaxRef.current += (rawMax - drawnMaxRef.current) * blend;
      }
      const scaleMax = Math.max(1, drawnMaxRef.current);

      // Update axis ticks
      const targetTickCount = Math.max(2, Math.min(5, Math.floor(barAreaWidth / 72)));
      const step = niceStep(scaleMax, targetTickCount);
      for (let slot = 0; slot < TICK_SLOTS; slot++) {
        const tickEl = tickRefs.current[slot];
        const lblEl = tickLabelRefs.current[slot];
        if (!tickEl || !lblEl) continue;
        const val = step * (slot + 1);
        const x = axisLeft + (val / scaleMax) * barAreaWidth;
        if (val > 0 && x <= plotWidth - 18 && val <= scaleMax * 1.02) {
          tickEl.setAttribute("data-on", "");
          tickEl.style.transform = `translate3d(${x.toFixed(2)}px, 0px, 0px)`;
          lblEl.textContent = tickFn(val);
        } else {
          tickEl.removeAttribute("data-on");
        }
      }

      // Update each row with spring Y and bar width
      let rowsSettled = true;
      let activeRank = -1;
      let activeItem: RaceBarItem | null = null;
      let activeValue = 0;
      let activeY = 0;
      let activeBarW = 0;

      ranked.forEach((entry, rank) => {
        const { item, value } = entry;
        const rowEl = rowRefs.current.get(item.id);
        const barEl = barRefs.current.get(item.id);
        const lblEl = labelRefs.current.get(item.id);
        const valEl = valueRefs.current.get(item.id);
        if (!rowEl || !barEl || !lblEl || !valEl) return;

        const inTop = rank < visibleBars;
        const targetY = inTop ? rank * ROW_HEIGHT : visibleBars * ROW_HEIGHT + 12;
        const targetOpacity = inTop ? 1 : 0;

        let state = rowSpringsRef.current.get(item.id);
        if (!state || !state.initialized || reduced) {
          state = { y: targetY, vy: 0, opacity: targetOpacity, initialized: true };
          rowSpringsRef.current.set(item.id, state);
        } else {
          const omega = 14;
          const dy = state.y - targetY;
          const acc = -omega * omega * dy - 2 * omega * state.vy;
          state.vy += acc * dt;
          state.y += state.vy * dt;
          const opBlend = 1 - Math.exp(-12 * dt);
          state.opacity += (targetOpacity - state.opacity) * opBlend;
          if (
            Math.abs(dy) < 0.15 &&
            Math.abs(state.vy) < 0.5 &&
            Math.abs(state.opacity - targetOpacity) < 0.01
          ) {
            state.y = targetY;
            state.vy = 0;
            state.opacity = targetOpacity;
          } else {
            rowsSettled = false;
          }
        }

        const barW = Math.max(3, (value / scaleMax) * barAreaWidth);
        rowEl.style.transform = `translate3d(0px, ${state.y.toFixed(2)}px, 0px)`;
        rowEl.style.opacity = state.opacity.toFixed(3);
        rowEl.style.pointerEvents = inTop ? "auto" : "none";

        barEl.style.left = `${axisLeft}px`;
        barEl.style.top = `${BAR_TOP}px`;
        barEl.style.height = `${BAR_HEIGHT}px`;
        barEl.style.width = `${barW.toFixed(2)}px`;

        if (compact) {
          lblEl.setAttribute("data-inside", "");
          lblEl.style.left = `${axisLeft + 8}px`;
          lblEl.style.width = `${Math.max(40, plotWidth - axisLeft - RIGHT_PAD - 8)}px`;
          const valX = Math.max(axisLeft + barW + VALUE_GAP, axisLeft + 8);
          valEl.style.transform = `translate3d(${Math.min(plotWidth - 52, valX).toFixed(2)}px, 0px, 0px)`;
        } else {
          lblEl.removeAttribute("data-inside");
          lblEl.style.left = "0px";
          lblEl.style.width = `${LABEL_WIDTH}px`;
          valEl.style.transform = `translate3d(${(axisLeft + barW + VALUE_GAP).toFixed(2)}px, 0px, 0px)`;
        }

        valEl.textContent = formatValue(value);

        if (activeIdRef.current === item.id) {
          activeRank = rank + 1;
          activeItem = item;
          activeValue = value;
          activeY = state.y;
          activeBarW = barW;
        }
      });

      // Position tooltip for active row
      if (activeItem && tooltipRef.current && tipTitleRef.current && tipValueRef.current && tipNoteRef.current) {
        const share = total > 0 ? Math.round((activeValue / total) * 100) : 0;
        const item = activeItem as RaceBarItem;
        tipTitleRef.current.textContent = item.label;
        tipValueRef.current.textContent = formatValue(activeValue);
        tipNoteRef.current.textContent = `Rank #${activeRank} · ${share}% of total`;
        const tipW = tooltipRef.current.offsetWidth || 160;
        const tipH = tooltipRef.current.offsetHeight || 72;
        const rawX = axisLeft + Math.min(activeBarW, barAreaWidth * 0.7) + 10;
        const clampedX = Math.max(8, Math.min(plotWidth - tipW - 8, rawX));
        const rawY = AXIS_TOP + activeY - tipH - 6;
        const clampedY = rawY < 4 ? AXIS_TOP + activeY + ROW_HEIGHT + 4 : rawY;
        tooltipRef.current.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0px)`;
      }

      const maxSettled = Math.abs(drawnMaxRef.current - rawMax) < rawMax * 0.002;
      const shouldContinue =
        (playingRef.current && inViewRef.current) ||
        draggingRef.current ||
        !timeSettled ||
        !rowsSettled ||
        !maxSettled;

      if (shouldContinue) {
        rafRef.current = requestAnimationFrame(paint);
      } else {
        rafRef.current = null;
        lastFrameTimeRef.current = 0;
      }
    };

    const wake = () => {
      if (rafRef.current === null) {
        lastFrameTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(paint);
      }
    };
    wakeRef.current = wake;
    wake();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    items,
    frames,
    maxFrame,
    frameDuration,
    loop,
    reduced,
    visibleBars,
    axisLeft,
    barAreaWidth,
    plotWidth,
    compact,
    formatValue,
    tickFn,
    getInterpolatedValues,
    clampFrame,
    setFrameIndex,
    setPlaying,
  ]);

  const togglePlay = useCallback(() => {
    if (maxFrame === 0) return;
    if (isPlaying) {
      setPlaying(false);
    } else {
      if (targetTimeRef.current >= maxFrame - 0.01) {
        targetTimeRef.current = 0;
        setFrameIndex(0);
      }
      setPlaying(true);
    }
  }, [isPlaying, maxFrame, setFrameIndex, setPlaying]);

  const stepPeriod = useCallback(
    (next: number) => {
      const clamped = clampFrame(next);
      setPlaying(false);
      targetTimeRef.current = clamped;
      setFrameIndex(clamped);
      const frame = frames[clamped];
      if (frame) {
        const leader = items
          .map((item) => ({ item, value: frame.values[item.id] ?? 0 }))
          .sort((a, b) => b.value - a.value)[0];
        setAnnouncement(
          leader
            ? `${frame.period}. Leader: ${leader.item.label} at ${formatValue(leader.value)}.`
            : frame.period,
        );
      }
      wakeRef.current();
    },
    [clampFrame, frames, items, formatValue, setFrameIndex, setPlaying],
  );

  const getRankedIdsAtCurrent = useCallback(() => {
    const frame = frames[frameIndex];
    if (!frame) return [];
    return items
      .map((item, idx) => ({ item, value: frame.values[item.id] ?? 0, idx }))
      .sort((a, b) => b.value - a.value || a.idx - b.idx)
      .slice(0, visibleBars);
  }, [frames, frameIndex, items, visibleBars]);

  const handlePlotKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepPeriod(frameIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepPeriod(frameIndex + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      stepPeriod(0);
    } else if (e.key === "End") {
      e.preventDefault();
      stepPeriod(maxFrame);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const ranked = getRankedIdsAtCurrent();
      if (ranked.length === 0) return;
      const curIdx = ranked.findIndex((r) => r.item.id === activeId);
      let nextIdx: number;
      if (curIdx === -1) {
        nextIdx = e.key === "ArrowDown" ? 0 : ranked.length - 1;
      } else {
        nextIdx =
          e.key === "ArrowDown"
            ? Math.min(ranked.length - 1, curIdx + 1)
            : Math.max(0, curIdx - 1);
      }
      const pick = ranked[nextIdx];
      setActiveId(pick.item.id);
      setAnnouncement(
        `${pick.item.label}, rank ${nextIdx + 1}, ${formatValue(pick.value)}.`,
      );
    } else if (e.key === "Escape") {
      setActiveId(null);
    }
  };

  // Timeline scrubbing
  const scrubFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || maxFrame === 0) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const nextT = frac * maxFrame;
      targetTimeRef.current = nextT;
      drawnTimeRef.current = nextT;
      const rounded = clampFrame(nextT);
      if (rounded !== frameIndex) setFrameIndex(rounded);
      wakeRef.current();
    },
    [clampFrame, frameIndex, maxFrame, setFrameIndex],
  );

  const handleTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (maxFrame === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setPlaying(false);
    scrubFromClientX(e.clientX);
  };

  const handleTrackPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    scrubFromClientX(e.clientX);
  };

  const handleTrackPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const snapped = clampFrame(targetTimeRef.current);
    targetTimeRef.current = snapped;
    setFrameIndex(snapped);
    wakeRef.current();
  };

  const handleSliderKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      stepPeriod(frameIndex - 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      stepPeriod(frameIndex + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      stepPeriod(0);
    } else if (e.key === "End") {
      e.preventDefault();
      stepPeriod(maxFrame);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      togglePlay();
    }
  };

  const currentPeriod = frames[frameIndex]?.period ?? "";
  const firstPeriod = frames[0]?.period ?? "";
  const lastPeriod = frames[maxFrame]?.period ?? "";
  const empty = items.length === 0 || frames.length === 0;

  return (
    <figure
      ref={figureRef}
      className={className ? `${styles.figure} ${className}` : styles.figure}
      aria-label={label}
    >
      <div className={styles.head} aria-hidden="true">
        <span className={styles.periodText}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={currentPeriod}
              className={styles.periodWord}
              initial={reduced ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{
                duration: reduced ? 0 : motionTokens.duration.standard,
                ease: motionTokens.ease.enter,
              }}
            >
              {currentPeriod}
            </motion.span>
          </AnimatePresence>
        </span>
        <span ref={totalRef} className={styles.total}>
          Total {formatValue(0)}
        </span>
      </div>

      <div
        ref={plotRef}
        className={styles.plot}
        style={{ height: `${plotHeight}px` }}
        role="group"
        tabIndex={0}
        aria-roledescription="bar chart race"
        aria-label={`${label}, ${currentPeriod}. Space plays or pauses, left and right arrows change the period, up and down arrows read the bars.`}
        data-active={activeId ? "" : undefined}
        onKeyDown={handlePlotKeyDown}
        onPointerLeave={() => setActiveId(null)}
        onBlur={() => setActiveId(null)}
      >
        {empty ? (
          <p className={styles.message}>No data to display</p>
        ) : (
          <>
            <div className={styles.grid} aria-hidden="true" style={{ height: `${plotHeight - 4}px` }}>
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  ref={(el) => {
                    tickRefs.current[idx] = el;
                  }}
                  className={styles.tick}
                >
                  <span
                    ref={(el) => {
                      tickLabelRefs.current[idx] = el;
                    }}
                    className={styles.tickLabel}
                  />
                </div>
              ))}
            </div>

            <div
              className={styles.baseline}
              style={{
                left: `${axisLeft}px`,
                height: `${rowsHeight}px`,
                top: `${AXIS_TOP}px`,
              }}
              aria-hidden="true"
            />

            <div className={styles.rows} style={{ top: `${AXIS_TOP}px` }} aria-hidden="true">
              {items.map((item) => {
                const isActive = activeId === item.id;
                const isDim = activeId !== null && !isActive;
                const isHighlight = highlight === item.id;
                const color = getBarColor(item);

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(item.id, el);
                      else rowRefs.current.delete(item.id);
                    }}
                    className={styles.row}
                    style={{ height: `${ROW_HEIGHT}px`, "--bar": color } as CSSProperties}
                    data-active={isActive ? "" : undefined}
                    data-dim={isDim ? "" : undefined}
                    data-highlight={isHighlight ? "" : undefined}
                    onPointerEnter={() => setActiveId(item.id)}
                  >
                    <span
                      ref={(el) => {
                        if (el) labelRefs.current.set(item.id, el);
                        else labelRefs.current.delete(item.id);
                      }}
                      className={styles.rowLabel}
                    >
                      {item.label}
                    </span>
                    <div
                      ref={(el) => {
                        if (el) barRefs.current.set(item.id, el);
                        else barRefs.current.delete(item.id);
                      }}
                      className={styles.bar}
                    />
                    <span
                      ref={(el) => {
                        if (el) valueRefs.current.set(item.id, el);
                        else valueRefs.current.delete(item.id);
                      }}
                      className={styles.rowValue}
                    />
                  </div>
                );
              })}
            </div>

            <div ref={tooltipRef} className={styles.tooltip} role="tooltip" aria-hidden={!activeId}>
              <p ref={tipTitleRef} className={styles.tipTitle} />
              <p ref={tipValueRef} className={styles.tipValue} />
              <p ref={tipNoteRef} className={styles.tipNote} />
            </div>
          </>
        )}
      </div>

      {groups && groups.length > 0 && (
        <ul className={styles.legend} aria-label="Groups">
          {groups.map((g, idx) => (
            <li
              key={g.id}
              className={styles.legendItem}
              style={{ "--bar": SERIES_VARS[idx % SERIES_VARS.length] } as CSSProperties}
            >
              <span className={styles.swatch} aria-hidden="true" />
              <span>{g.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.play}
          onClick={togglePlay}
          disabled={maxFrame === 0}
          aria-label={isPlaying ? "Pause" : atEnd ? "Replay" : "Play"}
        >
          <span className={styles.playIcon} aria-hidden="true">
            {isPlaying ? (
              <Pause size={15} fill="currentColor" strokeWidth={0} />
            ) : atEnd ? (
              <RotateCcw size={15} strokeWidth={2} />
            ) : (
              <Play size={15} fill="currentColor" strokeWidth={0} style={{ marginLeft: 1.5 }} />
            )}
          </span>
        </button>

        <div className={styles.timeline}>
          <div
            ref={trackRef}
            className={styles.track}
            role="slider"
            tabIndex={0}
            aria-label="Timeline period"
            aria-valuemin={0}
            aria-valuemax={maxFrame}
            aria-valuenow={frameIndex}
            aria-valuetext={currentPeriod}
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            onPointerCancel={handleTrackPointerUp}
            onKeyDown={handleSliderKeyDown}
          >
            <div className={styles.rail}>
              <div ref={fillRef} className={styles.fill} />
            </div>
            {frames.length > 2 &&
              frames.map((f, idx) => {
                if (idx === 0 || idx === maxFrame) return null;
                const leftPct = (idx / maxFrame) * 100;
                return (
                  <span
                    key={f.period}
                    className={styles.stop}
                    style={{ left: `${leftPct}%` }}
                    data-past={idx <= frameIndex ? "" : undefined}
                    aria-hidden="true"
                  />
                );
              })}
            <div ref={thumbRef} className={styles.thumb} aria-hidden="true" />
          </div>

          <div className={styles.ends} aria-hidden="true">
            <span>{firstPeriod}</span>
            <span>{lastPeriod}</span>
          </div>
        </div>
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <table className={styles.srOnly}>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            {frames.map((f) => (
              <th key={f.period} scope="col">
                {f.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <th scope="row">{item.label}</th>
              {frames.map((f) => (
                <td key={f.period}>{formatValue(f.values[item.id] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
