"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./funnel-chart.module.css";

export interface FunnelSegment {
  key: string;
  label: string;
}

export interface FunnelStage {
  key: string;
  label: string;
  value?: number;
  values?: Record<string, number>;
}

export interface FunnelChartProps {
  stages: FunnelStage[];
  segments?: FunnelSegment[];
  label: string;
  unit?: string;
  view?: "total" | "split" | (string & {});
  flow?: boolean;
  orientation?: "auto" | "horizontal" | "vertical";
  height?: number;
  formatValue?: (value: number) => string;
  activeIndex?: number | null;
  onActiveChange?: (index: number | null) => void;
  emptyLabel?: string;
  className?: string;
}

const PAD = 8;
const SPLIT_GAP = 2;
const VERTICAL_BREAKPOINT = 420;
const VERTICAL_ROW_HEIGHT = 68;
const DOT_COUNT = 42;

function defaultCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}K`;
  }
  return Math.round(n).toLocaleString();
}

function defaultFull(n: number): string {
  return Math.round(n).toLocaleString();
}

function formatPct(ratio: number): string {
  const pct = ratio * 100;
  if (pct <= 0) return "0%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${Number(pct.toFixed(1))}%`;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

interface BandFrame {
  /** Per-segment, per-stage [top, bottom] in pixels along thickness axis */
  bounds: [number, number][][];
}

function computeTargetBounds(
  stageMatrix: number[][],
  segCount: number,
  thickness: number,
  view: string,
  segKeys: string[],
): [number, number][][] {
  const nStages = stageMatrix.length;
  const usable = Math.max(2, thickness - PAD * 2);
  const center = thickness / 2;
  const isSplit = view === "split" && segCount > 1;
  const isolatedIndex = view !== "total" && view !== "split" ? segKeys.indexOf(view) : -1;

  // Determine the denominator (first stage total for current view)
  let maxVal = 0;
  if (nStages > 0) {
    if (isolatedIndex >= 0) {
      maxVal = stageMatrix[0][isolatedIndex] ?? 0;
    } else {
      for (let s = 0; s < segCount; s++) maxVal += stageMatrix[0][s] ?? 0;
    }
  }

  const result: [number, number][][] = Array.from({ length: segCount }, () =>
    Array.from({ length: nStages }, () => [center, center] as [number, number]),
  );

  if (maxVal <= 0 || nStages === 0) return result;

  const gap = isSplit ? SPLIT_GAP : 0;

  for (let i = 0; i < nStages; i++) {
    const heights: number[] = [];
    let visibleCount = 0;
    for (let s = 0; s < segCount; s++) {
      const val = isolatedIndex >= 0 ? (s === isolatedIndex ? stageMatrix[i][s] ?? 0 : 0) : stageMatrix[i][s] ?? 0;
      const h = val > 0 ? Math.max(val / maxVal, 0) : 0;
      heights.push(h);
      if (val > 0) visibleCount++;
    }

    const totalGap = isSplit && visibleCount > 1 ? gap * (visibleCount - 1) : 0;
    const avail = Math.max(2, usable - totalGap);
    const pxHeights = heights.map((h) => h * avail);
    const sumPx = pxHeights.reduce((a, b) => a + b, 0) + totalGap;
    let cursor = center - sumPx / 2;

    let seenVisible = 0;
    for (let s = 0; s < segCount; s++) {
      const h = pxHeights[s];
      if (isSplit && h > 0 && seenVisible > 0) {
        cursor += gap;
      }
      const top = cursor;
      const bottom = cursor + h;
      result[s][i] = [top, bottom];
      cursor = bottom;
      if (h > 0) seenVisible++;
    }
  }

  return result;
}

/** Sample interpolated [top, bottom] at normalized position x in [0, length] */
function sampleSegmentAt(
  segBounds: [number, number][],
  pos: number,
  length: number,
): [number, number] {
  const n = segBounds.length;
  if (n === 0 || length <= 0) return [0, 0];
  if (n === 1) return segBounds[0];

  const colLen = length / n;
  const halfTrans = colLen * 0.225;

  for (let i = 0; i < n - 1; i++) {
    const boundary = (i + 1) * colLen;
    if (pos < boundary - halfTrans) {
      return segBounds[i];
    }
    if (pos <= boundary + halfTrans) {
      const t = smoothstep((pos - (boundary - halfTrans)) / (2 * halfTrans));
      const [t0, b0] = segBounds[i];
      const [t1, b1] = segBounds[i + 1];
      return [t0 + (t1 - t0) * t, b0 + (b1 - b0) * t];
    }
  }
  return segBounds[n - 1];
}

function buildBandPath(
  segBounds: [number, number][],
  length: number,
  vertical: boolean,
): string {
  if (segBounds.length === 0 || length <= 0) return "";
  const step = Math.max(2, Math.min(3, length / 120));
  const xs: number[] = [];
  for (let p = 0; p < length; p += step) xs.push(p);
  xs.push(length);

  const tops: [number, number][] = [];
  const bottoms: [number, number][] = [];

  for (const p of xs) {
    const [top, bottom] = sampleSegmentAt(segBounds, p, length);
    if (vertical) {
      tops.push([top, p]);
      bottoms.push([bottom, p]);
    } else {
      tops.push([p, top]);
      bottoms.push([p, bottom]);
    }
  }

  let d = `M${tops[0][0].toFixed(1)},${tops[0][1].toFixed(1)}`;
  for (let i = 1; i < tops.length; i++) {
    d += `L${tops[i][0].toFixed(1)},${tops[i][1].toFixed(1)}`;
  }
  for (let i = bottoms.length - 1; i >= 0; i--) {
    d += `L${bottoms[i][0].toFixed(1)},${bottoms[i][1].toFixed(1)}`;
  }
  d += "Z";
  return d;
}

function RollingText({
  value,
  format,
  reduced,
}: {
  value: number;
  format: (v: number) => string;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (reduced || from === value) {
      setShown(value);
      return;
    }
    const ctrl = animate(from, value, {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => ctrl.stop();
  }, [value, reduced]);

  return <span>{format(shown)}</span>;
}

interface Dot {
  segIndex: number;
  lane: number; // 0..1 inside segment band
  pos: number; // 0..1 along funnel length
  speed: number; // fraction per second
  exitStage: number; // stage index where it drops out (nStages means completes)
  exited: boolean;
  fallVel: number;
  fallOffset: number;
  fallSide: 1 | -1;
  alpha: number;
  radius: number;
}

export const FunnelChart = forwardRef<HTMLElement, FunnelChartProps>(function FunnelChart(
  {
    stages,
    segments,
    label,
    unit = "",
    view = "total",
    flow = true,
    orientation = "auto",
    height = 200,
    formatValue,
    activeIndex: controlledActive,
    onActiveChange,
    emptyLabel = "No data",
    className,
  },
  ref,
) {
  const uid = useId();
  const clipId = `${uid}-focus`;
  const reduced = Boolean(useReducedMotion());

  const figureRef = useRef<HTMLElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const svgLayerRefs = useRef<(SVGPathElement | null)[]>([]);
  const glowLayerRefs = useRef<(SVGPathElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [containerWidth, setContainerWidth] = useState(465);
  const [inView, setInView] = useState(false);
  const [internalActive, setInternalActive] = useState<number | null>(null);

  const active = controlledActive !== undefined ? controlledActive : internalActive;

  const setActive = useCallback(
    (next: number | null) => {
      if (controlledActive === undefined) setInternalActive(next);
      onActiveChange?.(next);
    },
    [controlledActive, onActiveChange],
  );

  // Merge forwarded ref
  const assignFigureRef = useCallback(
    (node: HTMLElement | null) => {
      figureRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // Measure container width
  useLayoutEffect(() => {
    const el = figureRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setContainerWidth(w);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track viewport visibility for entry reveal and canvas pause
  useEffect(() => {
    const el = figureRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const vertical =
    orientation === "vertical" ||
    (orientation === "auto" && containerWidth < VERTICAL_BREAKPOINT);

  const segList: FunnelSegment[] = useMemo(
    () => (segments && segments.length > 0 ? segments : [{ key: "__total", label }]),
    [segments, label],
  );
  const segKeys = useMemo(() => segList.map((s) => s.key), [segList]);
  const segCount = segList.length;

  // Build [stageIndex][segIndex] matrix
  const stageMatrix: number[][] = useMemo(
    () =>
      stages.map((st) =>
        segments && segments.length > 0
          ? segments.map((seg) => Math.max(0, st.values?.[seg.key] ?? 0))
          : [Math.max(0, st.value ?? 0)],
      ),
    [stages, segments],
  );

  const isolatedIndex = useMemo(
    () => (view !== "total" && view !== "split" ? segKeys.indexOf(view) : -1),
    [view, segKeys],
  );

  // Totals for current view per stage
  const stageTotals = useMemo(
    () =>
      stageMatrix.map((row) =>
        isolatedIndex >= 0 ? row[isolatedIndex] ?? 0 : row.reduce((a, b) => a + b, 0),
      ),
    [stageMatrix, isolatedIndex],
  );

  const firstTotal = stageTotals[0] ?? 0;
  const isEmpty = firstTotal <= 0 || stages.length === 0;

  const plotWidth = vertical ? Math.max(120, Math.min(180, Math.round(containerWidth * 0.44))) : containerWidth;
  const plotHeight = vertical ? Math.max(160, stages.length * VERTICAL_ROW_HEIGHT) : height;
  const length = vertical ? plotHeight : plotWidth;
  const thickness = vertical ? plotWidth : plotHeight;

  const targetBounds = useMemo(
    () => computeTargetBounds(stageMatrix, segCount, thickness, view, segKeys),
    [stageMatrix, segCount, thickness, view, segKeys],
  );

  // Current animated bounds (mutated in-place inside RAF without React re-renders)
  const currentBoundsRef = useRef<BandFrame>({
    bounds: targetBounds.map((seg) => seg.map(() => [thickness / 2, thickness / 2] as [number, number])),
  });
  const hasEnteredRef = useRef(false);

  const paintPaths = useCallback(
    (bounds: [number, number][][]) => {
      for (let s = 0; s < segCount; s++) {
        const d = bounds[s] ? buildBandPath(bounds[s], length, vertical) : "";
        const baseEl = svgLayerRefs.current[s];
        const glowEl = glowLayerRefs.current[s];
        if (baseEl) baseEl.setAttribute("d", d);
        if (glowEl) glowEl.setAttribute("d", d);
      }
    },
    [segCount, length, vertical],
  );

  // Morph band when targetBounds / inView / dimensions change
  useEffect(() => {
    if (!inView && !hasEnteredRef.current) {
      const center = thickness / 2;
      const flat = targetBounds.map((seg) => seg.map(() => [center, center] as [number, number]));
      currentBoundsRef.current = { bounds: flat };
      paintPaths(flat);
      return;
    }

    hasEnteredRef.current = true;

    const prev = currentBoundsRef.current.bounds;
    const startBounds: [number, number][][] = targetBounds.map((seg, s) =>
      seg.map((_, i) => {
        const existing = prev[s]?.[i];
        return existing ? [existing[0], existing[1]] : [thickness / 2, thickness / 2];
      }),
    );

    if (reduced) {
      currentBoundsRef.current = { bounds: targetBounds };
      paintPaths(targetBounds);
      return;
    }

    const ctrl = animate(0, 1, {
      ...motionTokens.spring.morph,
      onUpdate: (t) => {
        const next: [number, number][][] = targetBounds.map((seg, s) =>
          seg.map(([t1, b1], i) => {
            const [t0, b0] = startBounds[s][i];
            return [t0 + (t1 - t0) * t, b0 + (b1 - b0) * t];
          }),
        );
        currentBoundsRef.current = { bounds: next };
        paintPaths(next);
      },
    });
    return () => ctrl.stop();
  }, [targetBounds, inView, reduced, thickness, paintPaths]);

  // Dots flow animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(plotWidth * dpr));
    canvas.height = Math.max(1, Math.round(plotHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!flow || reduced || isEmpty || !inView) {
      ctx.clearRect(0, 0, plotWidth, plotHeight);
      return;
    }

    const nStages = stages.length;

    const pickSegment = (): number => {
      if (isolatedIndex >= 0) return isolatedIndex;
      const total0 = stageMatrix[0].reduce((a, b) => a + b, 0);
      if (total0 <= 0) return 0;
      let r = Math.random() * total0;
      for (let s = 0; s < segCount; s++) {
        r -= stageMatrix[0][s];
        if (r <= 0) return s;
      }
      return segCount - 1;
    };

    const pickExitStage = (segIdx: number): number => {
      const startVal = stageMatrix[0]?.[segIdx] ?? 0;
      if (startVal <= 0) return 0;
      const r = Math.random() * startVal;
      for (let i = 1; i < nStages; i++) {
        if (r > (stageMatrix[i]?.[segIdx] ?? 0)) {
          return i - 1;
        }
      }
      return nStages; // reaches the end
    };

    const spawnDot = (initialPos?: number): Dot => {
      const segIndex = pickSegment();
      const exitStage = pickExitStage(segIndex);
      const pos = initialPos !== undefined ? initialPos : 0;
      return {
        segIndex,
        lane: 0.12 + Math.random() * 0.76,
        pos,
        speed: 0.085 + Math.random() * 0.055,
        exitStage,
        exited: false,
        fallVel: 0,
        fallOffset: 0,
        fallSide: Math.random() < 0.5 ? 1 : -1,
        alpha: 0.55 + Math.random() * 0.35,
        radius: 1.7 + Math.random() * 0.6,
      };
    };

    const dots: Dot[] = Array.from({ length: DOT_COUNT }, (_, idx) => {
      const d = spawnDot(idx / DOT_COUNT);
      // If initialPos is past its exitStage boundary, respawn earlier so dots populate naturally
      const maxPos = d.exitStage < nStages ? (d.exitStage + 0.85) / nStages : 1;
      if (d.pos > maxPos) d.pos = Math.random() * maxPos;
      return d;
    });

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (document.visibilityState === "hidden") {
        lastTime = now;
        return;
      }
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, plotWidth, plotHeight);
      const color = getComputedStyle(canvas).color || "currentColor";
      const bounds = currentBoundsRef.current.bounds;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const segB = bounds[dot.segIndex];
        if (!segB || segB.length === 0) {
          dots[i] = spawnDot(0);
          continue;
        }

        dot.pos += dot.speed * dt;
        const exitBoundary = (dot.exitStage + 1) / nStages;

        if (!dot.exited && dot.exitStage < nStages - 1 && dot.pos >= exitBoundary - 0.035) {
          dot.exited = true;
          dot.fallVel = 18 + Math.random() * 24;
        }

        if (dot.exited) {
          dot.fallVel += 65 * dt;
          dot.fallOffset += dot.fallVel * dt;
          dot.alpha -= 1.35 * dt;
          if (dot.alpha <= 0.02 || dot.pos >= 1.05) {
            dots[i] = spawnDot(0);
            continue;
          }
        } else if (dot.pos >= 1) {
          dots[i] = spawnDot(0);
          continue;
        }

        const along = dot.pos * length;
        const [top, bottom] = sampleSegmentAt(segB, Math.min(length, along), length);
        const span = bottom - top;
        if (span < 0.8 && !dot.exited) continue;

        const across = top + span * dot.lane + (dot.exited ? dot.fallOffset * dot.fallSide : 0);
        const x = vertical ? across : along;
        const y = vertical ? along : across;

        // Fade smoothly near start and end edges
        const edgeFade = Math.min(1, dot.pos * 18) * Math.min(1, (1 - dot.pos) * 18);
        const a = Math.max(0, Math.min(1, dot.alpha * (dot.exited ? 1 : edgeFade)));

        ctx.globalAlpha = a * 0.72;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [flow, reduced, isEmpty, inView, plotWidth, plotHeight, length, vertical, stages.length, stageMatrix, segCount, isolatedIndex]);

  // Pointer & keyboard handlers
  const indexFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const area = areaRef.current;
      if (!area || stages.length === 0) return null;
      const rect = area.getBoundingClientRect();
      const ratio = vertical
        ? (clientY - rect.top) / Math.max(1, rect.height)
        : (clientX - rect.left) / Math.max(1, rect.width);
      const idx = Math.floor(ratio * stages.length);
      return Math.max(0, Math.min(stages.length - 1, idx));
    },
    [stages.length, vertical],
  );

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (isEmpty) return;
    const idx = indexFromPoint(e.clientX, e.clientY);
    if (idx !== null && idx !== active) setActive(idx);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isEmpty) return;
    if (e.pointerType === "touch") {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const idx = indexFromPoint(e.clientX, e.clientY);
    if (idx !== null) setActive(idx);
  };

  const onPointerLeave = () => {
    if (document.activeElement !== areaRef.current) {
      setActive(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isEmpty) return;
    const last = stages.length - 1;
    const cur = active ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(last, cur + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, cur - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActive(null);
    }
  };

  const compactFmt = formatValue ?? defaultCompact;
  const fullFmt = formatValue ?? defaultFull;

  const colSpan = stages.length > 0 ? length / stages.length : 0;
  const activeStage = active !== null ? stages[active] : null;
  const activeTotal = active !== null ? stageTotals[active] ?? 0 : 0;
  const prevTotal = active !== null && active > 0 ? stageTotals[active - 1] ?? 0 : activeTotal;
  const keptFromPrev = prevTotal > 0 ? activeTotal / prevTotal : 0;
  const shareOfFirst = firstTotal > 0 ? activeTotal / firstTotal : 0;

  // Tooltip positioning (clamped inside chart)
  const tipX = useMemo(() => {
    if (active === null || stages.length === 0) return 0;
    if (vertical) {
      return Math.min(Math.max(8, plotWidth + 12), Math.max(8, containerWidth - 200));
    }
    const center = (active + 0.5) * colSpan;
    const approxWidth = 196;
    return Math.max(4, Math.min(Math.max(4, containerWidth - approxWidth - 4), center - approxWidth / 2));
  }, [active, stages.length, vertical, plotWidth, containerWidth, colSpan]);

  const tipY = useMemo(() => {
    if (active === null) return 0;
    if (vertical) {
      return Math.max(4, Math.min(plotHeight - 104, active * colSpan + 8));
    }
    return 72;
  }, [active, vertical, plotHeight, colSpan]);

  // Live announcement for active step
  const liveAnnouncement = useMemo(() => {
    if (active === null || !activeStage) return "";
    const countStr = `${fullFmt(activeTotal)}${unit ? ` ${unit}` : ""}`;
    if (active === 0) return `${activeStage.label}, ${countStr}, start.`;
    return `${activeStage.label}, ${countStr}, ${formatPct(keptFromPrev)} kept from previous, ${formatPct(shareOfFirst)} of start.`;
  }, [active, activeStage, activeTotal, fullFmt, unit, keptFromPrev, shareOfFirst]);

  // Visually hidden summary
  const summaryText = useMemo(() => {
    if (isEmpty) return `${label}. ${emptyLabel}.`;
    const viewLabel =
      view === "total"
        ? "all"
        : view === "split"
          ? "split"
          : segList.find((s) => s.key === view)?.label ?? view;
    const parts = stages.map(
      (st, i) => `${st.label} ${fullFmt(stageTotals[i])}${unit ? ` ${unit}` : ""}`,
    );
    const lastRate = firstTotal > 0 ? formatPct((stageTotals[stages.length - 1] ?? 0) / firstTotal) : "0%";
    return `${label}, ${viewLabel}. ${parts.join(", ")}. ${lastRate} reach the last step.`;
  }, [isEmpty, label, emptyLabel, view, segList, stages, fullFmt, stageTotals, unit, firstTotal]);

  const springFast = reduced ? { duration: 0 } : motionTokens.spring.snappy;

  return (
    <figure
      ref={assignFigureRef}
      className={[styles.figure, className].filter(Boolean).join(" ")}
      data-vertical={vertical ? "" : undefined}
      aria-label={label}
    >
      <div
        ref={areaRef}
        className={styles.area}
        data-view={view}
        data-active={active !== null ? "" : undefined}
        role="group"
        tabIndex={0}
        aria-roledescription="funnel chart"
        aria-label={`${label}. Use arrow keys to move between steps.`}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerLeave}
        onFocus={() => {
          if (active === null && !isEmpty) setActive(0);
        }}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {/* Active column/row highlight */}
        <motion.div
          className={styles.column}
          aria-hidden="true"
          style={
            vertical
              ? { height: colSpan }
              : { width: colSpan }
          }
          animate={
            vertical
              ? { y: (active ?? 0) * colSpan, x: 0 }
              : { x: (active ?? 0) * colSpan, y: 0 }
          }
          transition={springFast}
        />

        {/* Horizontal header */}
        {!vertical && (
          <div
            className={styles.header}
            style={{ gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {stages.map((st, i) => {
              const val = stageTotals[i] ?? 0;
              const rate = firstTotal > 0 ? val / firstTotal : 0;
              return (
                <div
                  key={st.key}
                  className={styles.stage}
                  data-on={active === i ? "" : undefined}
                >
                  <span className={styles.stageLabel}>{st.label}</span>
                  <span className={styles.stageValue}>
                    <RollingText value={val} format={compactFmt} reduced={reduced} />
                  </span>
                  <span className={styles.stageRate}>
                    {i === 0 ? "Start" : `${formatPct(rate)} of start`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Plot row */}
        <div className={styles.plotRow}>
          <div className={styles.plot} style={{ width: plotWidth, height: plotHeight }}>
            <svg
              className={styles.svg}
              width={plotWidth}
              height={plotHeight}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <clipPath id={clipId}>
                  <motion.rect
                    x={0}
                    y={0}
                    width={vertical ? plotWidth : colSpan}
                    height={vertical ? colSpan : plotHeight}
                    animate={
                      vertical
                        ? { y: (active ?? 0) * colSpan, x: 0 }
                        : { x: (active ?? 0) * colSpan, y: 0 }
                    }
                    transition={springFast}
                  />
                </clipPath>
              </defs>

              {segList.map((seg, s) => (
                <path
                  key={seg.key}
                  ref={(el) => {
                    svgLayerRefs.current[s] = el;
                  }}
                  className={styles.layer}
                  data-index={s}
                  data-shown={isolatedIndex < 0 || isolatedIndex === s ? "true" : "false"}
                />
              ))}

              <g className={styles.glow} clipPath={`url(#${clipId})`}>
                {segList.map((seg, s) => (
                  <path
                    key={seg.key}
                    ref={(el) => {
                      glowLayerRefs.current[s] = el;
                    }}
                    className={styles.glowLayer}
                    data-index={s}
                  />
                ))}
              </g>
            </svg>

            <canvas
              ref={canvasRef}
              className={styles.canvas}
              style={{ width: plotWidth, height: plotHeight }}
              aria-hidden="true"
            />
          </div>

          {/* Vertical side labels */}
          {vertical && (
            <div className={styles.side} aria-hidden="true">
              {stages.map((st, i) => {
                const val = stageTotals[i] ?? 0;
                const rate = firstTotal > 0 ? val / firstTotal : 0;
                return (
                  <div
                    key={st.key}
                    className={styles.row}
                    style={{ top: i * colSpan, height: colSpan }}
                    data-on={active === i ? "" : undefined}
                  >
                    <span className={styles.stageLabel}>{st.label}</span>
                    <span className={styles.stageValue}>
                      <RollingText value={val} format={compactFmt} reduced={reduced} />
                    </span>
                    <span className={styles.stageRate}>
                      {i === 0 ? "Start" : `${formatPct(rate)} of start`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drop-off indicators */}
        {!isEmpty && stages.length > 1 && (
          <div className={styles.drops} aria-hidden="true">
            {stages.slice(1).map((st, idx) => {
              const prev = stageTotals[idx] ?? 0;
              const cur = stageTotals[idx + 1] ?? 0;
              const dropRatio = prev > 0 ? Math.max(0, 1 - cur / prev) : 0;
              const posPct = ((idx + 1) / stages.length) * 100;
              return (
                <span
                  key={st.key}
                  className={styles.drop}
                  style={vertical ? { top: `${posPct}%` } : { left: `${posPct}%` }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                    <path
                      d="M4 1v6M1.5 4.5 4 7l2.5-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{formatPct(dropRatio)}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Tooltip */}
        <motion.div
          className={styles.tooltip}
          aria-hidden="true"
          animate={{ x: tipX, y: tipY }}
          transition={springFast}
        >
          <p className={styles.tipTitle}>{activeStage?.label ?? ""}</p>
          {segments && segments.length > 0 && view === "split" ? (
            segList.map((seg, s) => (
              <p key={seg.key} className={styles.tipRow} data-index={s}>
                <span className={styles.tipKey} />
                <span className={styles.tipName}>{seg.label}</span>
                <span className={styles.tipValue}>
                  {active !== null
                    ? `${fullFmt(stageMatrix[active]?.[s] ?? 0)}${unit ? ` ${unit}` : ""}`
                    : ""}
                </span>
              </p>
            ))
          ) : (
            <p
              className={styles.tipRow}
              data-index={isolatedIndex >= 0 ? isolatedIndex : 0}
            >
              {isolatedIndex >= 0 && <span className={styles.tipKey} />}
              <span className={styles.tipName}>
                {isolatedIndex >= 0 ? segList[isolatedIndex]?.label : "Total"}
              </span>
              <span className={styles.tipValue}>
                {active !== null ? `${fullFmt(activeTotal)}${unit ? ` ${unit}` : ""}` : ""}
              </span>
            </p>
          )}
          <p className={styles.tipMeta}>
            {active !== null && active > 0
              ? `${formatPct(keptFromPrev)} of previous · ${formatPct(shareOfFirst)} of start`
              : ""}
          </p>
        </motion.div>

        {isEmpty && <p className={styles.message}>{emptyLabel}</p>}
      </div>

      {/* Accessibility: live region, summary, and full data table */}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </p>
      <p className={styles.srOnly}>{summaryText}</p>
      <div className={styles.srOnly}>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              {segments && segments.length > 0
                ? segments.map((seg) => (
                    <th key={seg.key} scope="col">
                      {seg.label}
                    </th>
                  ))
                : null}
              <th scope="col">Shown total</th>
              <th scope="col">Kept from previous</th>
              <th scope="col">Of first step</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((st, i) => {
              const cur = stageTotals[i] ?? 0;
              const prev = i > 0 ? stageTotals[i - 1] ?? 0 : cur;
              const kept = i === 0 ? 1 : prev > 0 ? cur / prev : 0;
              const ofFirst = firstTotal > 0 ? cur / firstTotal : 0;
              return (
                <tr key={st.key}>
                  <th scope="row">{st.label}</th>
                  {segments && segments.length > 0
                    ? segments.map((seg, s) => (
                        <td key={seg.key}>
                          {fullFmt(stageMatrix[i]?.[s] ?? 0)}
                          {unit ? ` ${unit}` : ""}
                        </td>
                      ))
                    : null}
                  <td>
                    {fullFmt(cur)}
                    {unit ? ` ${unit}` : ""}
                  </td>
                  <td>{formatPct(kept)}</td>
                  <td>{formatPct(ofFirst)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
});

export default FunnelChart;
