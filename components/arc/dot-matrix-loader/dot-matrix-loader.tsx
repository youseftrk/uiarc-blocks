"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./dot-matrix-loader.module.css";

export type DotMatrixVariant =
  | "wave"
  | "spiral"
  | "rain"
  | "ripple"
  | "snake"
  | "scan";

export type DotMatrixState = "loading" | "success" | "error";

export interface DotMatrixLoaderProps {
  variant?: DotMatrixVariant;
  state?: DotMatrixState;
  progress?: number;
  size?: number;
  accent?: string;
  label?: string;
  successLabel?: string;
  errorLabel?: string;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

const GRID = 7;
const COUNT = GRID * GRID;
const CELL = 10; // 7 * 10 = 70 viewBox
const BASE_R = 2.55;
const MIN_R = 1.05;

// Checkmark stroke order on 7x7 grid: [row, col]
const CHECK_STROKE: ReadonlyArray<[number, number]> = [
  [3, 1],
  [4, 2],
  [5, 3],
  [4, 4],
  [3, 5],
  [2, 5],
  [1, 6],
];

// Cross stroke order on 7x7 grid: [row, col]
const CROSS_STROKE: ReadonlyArray<[number, number]> = [
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [1, 5],
  [2, 4],
  [4, 2],
  [5, 1],
];

const CHECK_ORDER = new Int8Array(COUNT).fill(-1);
CHECK_STROKE.forEach(([r, c], i) => {
  CHECK_ORDER[r * GRID + c] = i;
});

const CROSS_ORDER = new Int8Array(COUNT).fill(-1);
CROSS_STROKE.forEach(([r, c], i) => {
  CROSS_ORDER[r * GRID + c] = i;
});

// Precompute fill order (0..48) for each variant
function buildFillOrder(variant: DotMatrixVariant): Float32Array {
  const indices = Array.from({ length: COUNT }, (_, i) => i);
  const cx = 3;
  const cy = 3;

  if (variant === "wave") {
    // Left to right, subtle diagonal tilt
    indices.sort((a, b) => {
      const ca = a % GRID;
      const ra = Math.floor(a / GRID);
      const cb = b % GRID;
      const rb = Math.floor(b / GRID);
      return ca * 10 + ra - (cb * 10 + rb);
    });
  } else if (variant === "spiral") {
    // Clock hand sweeping from 12 o'clock
    indices.sort((a, b) => {
      const ca = a % GRID - cx;
      const ra = Math.floor(a / GRID) - cy;
      const cb = b % GRID - cx;
      const rb = Math.floor(b / GRID) - cy;
      const angA = (Math.atan2(ca, -ra) + Math.PI * 2) % (Math.PI * 2);
      const angB = (Math.atan2(cb, -rb) + Math.PI * 2) % (Math.PI * 2);
      const distA = Math.hypot(ca, ra);
      const distB = Math.hypot(cb, rb);
      if (Math.abs(angA - angB) > 0.01) return angA - angB;
      return distA - distB;
    });
  } else if (variant === "rain") {
    // Bottom to top like a tank
    indices.sort((a, b) => {
      const ca = a % GRID;
      const ra = Math.floor(a / GRID);
      const cb = b % GRID;
      const rb = Math.floor(b / GRID);
      return (GRID - 1 - ra) * 10 + ca - ((GRID - 1 - rb) * 10 + cb);
    });
  } else if (variant === "ripple") {
    // Growing disc from center
    indices.sort((a, b) => {
      const distA = Math.hypot((a % GRID) - cx, Math.floor(a / GRID) - cy);
      const distB = Math.hypot((b % GRID) - cx, Math.floor(b / GRID) - cy);
      return distA - distB || a - b;
    });
  } else if (variant === "snake") {
    // Ring by ring from outside in
    indices.sort((a, b) => {
      const ca = a % GRID;
      const ra = Math.floor(a / GRID);
      const cb = b % GRID;
      const rb = Math.floor(b / GRID);
      const ringA = Math.min(ra, ca, GRID - 1 - ra, GRID - 1 - ca);
      const ringB = Math.min(rb, cb, GRID - 1 - rb, GRID - 1 - cb);
      if (ringA !== ringB) return ringA - ringB;
      const angA = (Math.atan2(ra - cy, ca - cx) + Math.PI * 2) % (Math.PI * 2);
      const angB = (Math.atan2(rb - cy, cb - cx) + Math.PI * 2) % (Math.PI * 2);
      return angA - angB;
    });
  } else {
    // scan: printer row by row
    indices.sort((a, b) => a - b);
  }

  const order = new Float32Array(COUNT);
  indices.forEach((cellIdx, rank) => {
    order[cellIdx] = rank / (COUNT - 1);
  });
  return order;
}

const FILL_ORDERS: Record<DotMatrixVariant, Float32Array> = {
  wave: buildFillOrder("wave"),
  spiral: buildFillOrder("spiral"),
  rain: buildFillOrder("rain"),
  ripple: buildFillOrder("ripple"),
  snake: buildFillOrder("snake"),
  scan: buildFillOrder("scan"),
};

// Precompute ring path indices for snake variant (3 nested rings)
const SNAKE_RINGS: number[][] = [
  // Outer ring (24 cells)
  [
    0, 1, 2, 3, 4, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46, 45, 44, 43, 42, 35,
    28, 21, 14, 7,
  ],
  // Middle ring (16 cells, reversed)
  [8, 15, 22, 29, 36, 37, 38, 39, 40, 33, 26, 19, 12, 11, 10, 9],
  // Inner ring (8 cells)
  [16, 17, 18, 25, 32, 31, 30, 23],
];

const SNAKE_POS = new Int8Array(COUNT).fill(-1);
const SNAKE_RING_OF = new Int8Array(COUNT).fill(-1);
SNAKE_RINGS.forEach((ring, rIdx) => {
  ring.forEach((cellIdx, pos) => {
    SNAKE_RING_OF[cellIdx] = rIdx;
    SNAKE_POS[cellIdx] = pos;
  });
});

// Rain column phases & speeds
const RAIN_SPEED = [1.15, 0.85, 1.35, 0.95, 1.25, 0.9, 1.1];
const RAIN_PHASE = [0.0, 0.42, 0.18, 0.67, 0.31, 0.83, 0.54];

function samplePattern(
  variant: DotMatrixVariant,
  idx: number,
  t: number
): number {
  const r = Math.floor(idx / GRID);
  const c = idx % GRID;
  const dx = c - 3;
  const dy = r - 3;

  switch (variant) {
    case "wave": {
      const phase = (c * 0.55 + r * 0.42) - t * 3.8;
      return 0.14 + 0.86 * Math.pow(0.5 + 0.5 * Math.sin(phase), 2);
    }
    case "spiral": {
      const dist = Math.hypot(dx, dy);
      if (dist < 0.01) return 0.55 + 0.35 * Math.sin(t * 3.2);
      const ang = Math.atan2(dy, dx);
      // Two arms rotating around center
      const v = 0.5 + 0.5 * Math.cos(2 * ang - t * 3.6 + dist * 0.55);
      return 0.12 + 0.88 * Math.pow(v, 2.2);
    }
    case "rain": {
      const pos = ((t * RAIN_SPEED[c] * 4.2 + RAIN_PHASE[c] * 9) % 9) - 1;
      const dist = pos - r;
      if (dist >= 0 && dist < 3.4) {
        return 0.12 + 0.88 * Math.pow(1 - dist / 3.4, 1.5);
      }
      return 0.12;
    }
    case "ripple": {
      const dist = Math.hypot(dx, dy);
      const wave = 0.5 + 0.5 * Math.sin(dist * 1.45 - t * 4.4);
      return 0.12 + 0.88 * Math.pow(wave, 2.4);
    }
    case "snake": {
      if (idx === 24) return 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3));
      const ringIdx = SNAKE_RING_OF[idx];
      const pos = SNAKE_POS[idx];
      const len = SNAKE_RINGS[ringIdx].length;
      const head = ((t * (5.2 + ringIdx * 1.2)) % len + len) % len;
      const dist = ((head - pos) % len + len) % len;
      const tailLen = Math.max(3, Math.floor(len * 0.35));
      if (dist < tailLen) {
        return 0.14 + 0.86 * Math.pow(1 - dist / tailLen, 1.4);
      }
      return 0.14;
    }
    case "scan": {
      // Sweeps up and down with phosphor afterglow
      const cycle = (t * 0.95) % 2;
      const y = cycle <= 1 ? cycle * 6 : (2 - cycle) * 6;
      const d = Math.abs(r - y);
      const glow = Math.exp(-d * d * 0.95);
      return 0.12 + 0.88 * glow;
    }
  }
}

export function DotMatrixLoader({
  variant = "wave",
  state = "loading",
  progress,
  size = 48,
  accent,
  label = "Loading",
  successLabel = "Done",
  errorLabel = "Failed",
  decorative = false,
  className,
  style,
}: DotMatrixLoaderProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const circleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  const propsRef = useRef({
    variant,
    state,
    progress,
    reducedMotion: Boolean(reducedMotion),
  });
  useEffect(() => {
    propsRef.current = {
      variant,
      state,
      progress,
      reducedMotion: Boolean(reducedMotion),
    };
  }, [variant, state, progress, reducedMotion]);

  // Persistent animation state across prop updates
  const animRef = useRef({
    clock: 0,
    blend: progress !== undefined ? 1 : 0,
    blendVel: 0,
    dispProgress: progress ?? 0,
    dispProgressVel: 0,
    stateEnteredAt: 0,
    lastState: state as DotMatrixState,
    shakePhase: 0,
    dotVal: new Float32Array(COUNT).fill(0.2),
    dotVel: new Float32Array(COUNT),
    lastR: new Float32Array(COUNT).fill(-1),
    lastOp: new Float32Array(COUNT).fill(-1),
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let visible = true;
    let tabVisible = !document.hidden;
    let rafId = 0;
    let lastNow = performance.now();

    const stepSpring = (
      val: number,
      vel: number,
      target: number,
      stiffness: number,
      damping: number,
      dt: number
    ): [number, number] => {
      const a = (target - val) * stiffness - vel * damping;
      const nextVel = vel + a * dt;
      const nextVal = val + nextVel * dt;
      return [nextVal, nextVel];
    };

    const tick = (now: number) => {
      rafId = 0;
      if (!visible || !tabVisible) return;

      const dt = Math.min(0.032, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      const { variant: curVariant, state: curState, progress: curProg, reducedMotion: rm } =
        propsRef.current;
      const st = animRef.current;

      if (curState !== st.lastState) {
        st.lastState = curState;
        st.stateEnteredAt = now;
        if (curState === "error" && !rm) {
          st.shakePhase = 1;
        }
      }

      if (!rm || curState === "loading") {
        st.clock += dt;
      }

      // Critically damped blend between pattern (0) and progress (1)
      const targetBlend = curProg !== undefined ? 1 : 0;
      if (rm) {
        st.blend = targetBlend;
        st.blendVel = 0;
      } else {
        [st.blend, st.blendVel] = stepSpring(
          st.blend,
          st.blendVel,
          targetBlend,
          140,
          24,
          dt
        );
      }

      const targetProg =
        curProg !== undefined ? Math.max(0, Math.min(1, curProg)) : st.dispProgress;
      if (rm) {
        st.dispProgress = targetProg;
        st.dispProgressVel = 0;
      } else {
        [st.dispProgress, st.dispProgressVel] = stepSpring(
          st.dispProgress,
          st.dispProgressVel,
          targetProg,
          120,
          22,
          dt
        );
      }

      const fillOrder = FILL_ORDERS[curVariant];
      const elapsedState = now - st.stateEnteredAt;
      let anyMoving = curState === "loading";

      // Damped horizontal shake for error
      if (svgRef.current) {
        if (st.shakePhase > 0.002 && !rm) {
          const tShake = elapsedState / 1000;
          const decay = Math.exp(-9 * tShake);
          const offset = Math.sin(tShake * 46) * 3.2 * decay;
          svgRef.current.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
          st.shakePhase = decay;
          anyMoving = true;
        } else if (st.shakePhase !== 0) {
          st.shakePhase = 0;
          svgRef.current.style.transform = "";
        }
      }

      const breath = rm ? 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(st.clock * 1.4)) : 1;

      for (let i = 0; i < COUNT; i++) {
        let target = 0;

        if (curState === "loading") {
          const patternVal = rm
            ? samplePattern(curVariant, i, 0.85) * breath
            : samplePattern(curVariant, i, st.clock);

          if (st.blend > 0.005) {
            const rank = fillOrder[i];
            const leadDist = st.dispProgress - rank;
            let progVal: number;
            if (leadDist >= 0) {
              // Leading dot is brightest (1.0), filled dots rest at 0.78
              const isLead = leadDist < 0.055 && st.dispProgress < 0.995;
              progVal = isLead ? 1 : 0.78;
            } else {
              // Faint trace of pattern so grid never looks stalled
              progVal = 0.09 + patternVal * 0.18;
            }
            target = patternVal * (1 - st.blend) + progVal * st.blend;
          } else {
            target = patternVal;
          }
        } else {
          const order = curState === "success" ? CHECK_ORDER[i] : CROSS_ORDER[i];
          if (order >= 0) {
            const delay = rm ? 0 : order * 45;
            target = elapsedState >= delay ? 1 : 0.08;
            if (!rm && elapsedState < delay + 400) anyMoving = true;
          } else {
            // Non-glyph dots fade out from center
            const r = Math.floor(i / GRID);
            const c = i % GRID;
            const distFromCenter = Math.hypot(c - 3, r - 3);
            const fadeDelay = rm ? 0 : distFromCenter * 28;
            target = elapsedState >= fadeDelay ? 0.06 : st.dotVal[i];
            if (!rm && elapsedState < fadeDelay + 350) anyMoving = true;
          }
        }

        if (rm) {
          st.dotVal[i] += (target - st.dotVal[i]) * Math.min(1, dt * 18);
          st.dotVel[i] = 0;
        } else {
          const isGlyph =
            curState !== "loading" &&
            (curState === "success" ? CHECK_ORDER[i] >= 0 : CROSS_ORDER[i] >= 0);
          // Slight overshoot for landing glyph dots
          const stiffness = isGlyph ? 260 : 180;
          const damping = isGlyph ? 17 : 22;
          [st.dotVal[i], st.dotVel[i]] = stepSpring(
            st.dotVal[i],
            st.dotVel[i],
            target,
            stiffness,
            damping,
            dt
          );
          if (
            Math.abs(st.dotVal[i] - target) > 0.008 ||
            Math.abs(st.dotVel[i]) > 0.02
          ) {
            anyMoving = true;
          }
        }

        const clamped = Math.max(0, Math.min(1.25, st.dotVal[i]));
        const rad = Math.round((MIN_R + (BASE_R - MIN_R) * clamped) * 100) / 100;
        const op =
          Math.round(Math.max(0.08, Math.min(1, 0.1 + clamped * 0.9)) * 100) / 100;

        const circle = circleRefs.current[i];
        if (circle) {
          if (rad !== st.lastR[i]) {
            st.lastR[i] = rad;
            circle.setAttribute("r", String(rad));
          }
          if (op !== st.lastOp[i]) {
            st.lastOp[i] = op;
            circle.setAttribute("fill-opacity", String(op));
          }
        }
      }

      if (anyMoving) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const start = () => {
      if (rafId || !visible || !tabVisible) return;
      lastNow = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { threshold: 0.01 }
    );
    io.observe(root);

    const onVisibility = () => {
      tabVisible = !document.hidden;
      if (tabVisible) start();
      else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [variant, state, progress, reducedMotion]);

  const dots = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        i,
        cx: (i % GRID) * CELL + CELL / 2,
        cy: Math.floor(i / GRID) * CELL + CELL / 2,
      })),
    []
  );

  const isLoading = state === "loading";
  const resolvedLabel = state === "success" ? successLabel : errorLabel;
  const roundedProgress =
    progress !== undefined
      ? Math.round(Math.max(0, Math.min(1, progress)) * 100)
      : undefined;

  const rootStyle: CSSProperties = {
    width: size,
    height: size,
    ...(accent
      ? ({ "--dot-matrix-color": accent } as CSSProperties)
      : undefined),
    ...style,
  };

  return (
    <span
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-state={state}
      data-variant={variant}
      style={rootStyle}
      aria-hidden={decorative ? true : undefined}
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox="0 0 70 70"
        role={decorative ? undefined : isLoading ? "progressbar" : "img"}
        aria-label={decorative ? undefined : isLoading ? label : resolvedLabel}
        aria-valuemin={
          !decorative && isLoading && roundedProgress !== undefined
            ? 0
            : undefined
        }
        aria-valuemax={
          !decorative && isLoading && roundedProgress !== undefined
            ? 100
            : undefined
        }
        aria-valuenow={
          !decorative && isLoading && roundedProgress !== undefined
            ? roundedProgress
            : undefined
        }
      >
        {dots.map((d) => (
          <circle
            key={d.i}
            ref={(el) => {
              circleRefs.current[d.i] = el;
            }}
            cx={d.cx}
            cy={d.cy}
            r={MIN_R}
            fill="currentColor"
            fillOpacity={0.18}
          />
        ))}
      </svg>
      {!decorative ? (
        <span className={styles.srOnly} role="status" aria-live="polite">
          {!isLoading ? resolvedLabel : ""}
        </span>
      ) : null}
    </span>
  );
}
