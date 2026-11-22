"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./morph-loader.module.css";

export type MorphLoaderVariant = "dots" | "bars" | "ring" | "square";
export type MorphLoaderStatus = "loading" | "success" | "error";

export interface MorphLoaderProps {
  variant?: MorphLoaderVariant;
  status?: MorphLoaderStatus;
  size?: number;
  strokeWidth?: number;
  tone?: boolean;
  label?: string;
  successLabel?: string;
  errorLabel?: string;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface StrokeSpec {
  cx: number;
  cy: number;
  len: number; // half-length
  angle: number; // radians
  bend: number; // quadratic bezier control offset perpendicular to chord
  width: number;
  opacity: number;
}

interface SpringScalar {
  val: number;
  vel: number;
}

interface SpringStroke {
  cx: SpringScalar;
  cy: SpringScalar;
  len: SpringScalar;
  angle: SpringScalar;
  bend: SpringScalar;
  width: SpringScalar;
  opacity: SpringScalar;
}

function stepSpring(s: SpringScalar, target: number, dt: number, stiffness: number, damping: number) {
  const force = (target - s.val) * stiffness - s.vel * damping;
  s.vel += force * dt;
  s.val += s.vel * dt;
}

function stepAngleSpring(s: SpringScalar, target: number, dt: number, stiffness: number, damping: number) {
  let diff = target - s.val;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const force = diff * stiffness - s.vel * damping;
  s.vel += force * dt;
  s.val += s.vel * dt;
}

function strokeToPath(cx: number, cy: number, len: number, angle: number, bend: number): string {
  const half = Math.max(0.005, len);
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  const x1 = cx - dx;
  const y1 = cy - dy;
  const x2 = cx + dx;
  const y2 = cy + dy;

  if (Math.abs(bend) < 0.02) {
    return `M${x1.toFixed(3)} ${y1.toFixed(3)}L${x2.toFixed(3)} ${y2.toFixed(3)}`;
  }
  // Control point perpendicular to chord
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const qx = cx + nx * bend;
  const qy = cy + ny * bend;
  return `M${x1.toFixed(3)} ${y1.toFixed(3)}Q${qx.toFixed(3)} ${qy.toFixed(3)} ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

function getTargets(
  variant: MorphLoaderVariant,
  status: MorphLoaderStatus,
  t: number,
  strokeWidth: number,
  reduced: boolean
): { strokes: StrokeSpec[]; groupRotate: number } {
  const dotW = Math.max(strokeWidth * 1.6, 3.6);

  if (status === "success") {
    // Checkmark: (5, 12.5) -> (9.8, 17.2) -> (19, 7.6)
    const s1x1 = 5.2;
    const s1y1 = 12.6;
    const s1x2 = 9.8;
    const s1y2 = 17.2;
    const s2x1 = 9.8;
    const s2y1 = 17.2;
    const s2x2 = 18.8;
    const s2y2 = 7.6;

    const dx1 = s1x2 - s1x1;
    const dy1 = s1y2 - s1y1;
    const dx2 = s2x2 - s2x1;
    const dy2 = s2y2 - s2y1;

    return {
      groupRotate: 0,
      strokes: [
        {
          cx: (s1x1 + s1x2) / 2,
          cy: (s1y1 + s1y2) / 2,
          len: Math.hypot(dx1, dy1) / 2,
          angle: Math.atan2(dy1, dx1),
          bend: 0,
          width: strokeWidth,
          opacity: 1,
        },
        {
          cx: (s2x1 + s2x2) / 2,
          cy: (s2y1 + s2y2) / 2,
          len: Math.hypot(dx2, dy2) / 2,
          angle: Math.atan2(dy2, dx2),
          bend: 0,
          width: strokeWidth,
          opacity: 1,
        },
        { cx: 9.8, cy: 17.2, len: 0.005, angle: 0, bend: 0, width: 0, opacity: 0 },
        { cx: 9.8, cy: 17.2, len: 0.005, angle: 0, bend: 0, width: 0, opacity: 0 },
      ],
    };
  }

  if (status === "error") {
    const half = 5.6 * Math.SQRT2;
    return {
      groupRotate: 0,
      strokes: [
        { cx: 12, cy: 12, len: half, angle: Math.PI / 4, bend: 0, width: strokeWidth, opacity: 1 },
        { cx: 12, cy: 12, len: half, angle: (3 * Math.PI) / 4, bend: 0, width: strokeWidth, opacity: 1 },
        { cx: 12, cy: 12, len: 0.005, angle: 0, bend: 0, width: 0, opacity: 0 },
        { cx: 12, cy: 12, len: 0.005, angle: 0, bend: 0, width: 0, opacity: 0 },
      ],
    };
  }

  // Loading states
  if (variant === "dots") {
    const xs = [5, 12, 19];
    const strokes: StrokeSpec[] = xs.map((x, idx) => {
      if (reduced) {
        return { cx: x, cy: 12, len: 0.005, angle: 0, bend: 0, width: dotW, opacity: 1 };
      }
      const cycle = ((t * 1.15 - idx * 0.16) % 1 + 1) % 1;
      const bounce = cycle < 0.45 ? Math.sin((cycle / 0.45) * Math.PI) : 0;
      const lift = bounce * 3.8;
      const w = dotW + bounce * 0.5;
      return { cx: x, cy: 12 - lift, len: 0.005, angle: 0, bend: 0, width: w, opacity: 1 };
    });
    strokes.push({ cx: 12, cy: 12, len: 0.005, angle: 0, bend: 0, width: 0, opacity: 0 });
    return { groupRotate: 0, strokes };
  }

  if (variant === "bars") {
    const xs = [4.8, 9.6, 14.4, 19.2];
    const barW = Math.max(strokeWidth * 1.05, 2.4);
    const strokes: StrokeSpec[] = xs.map((x, idx) => {
      if (reduced) {
        const h = idx % 2 === 0 ? 3.5 : 5.5;
        return { cx: x, cy: 12, len: h, angle: Math.PI / 2, bend: 0, width: barW, opacity: 1 };
      }
      const wave = 0.5 + 0.5 * Math.sin(t * 5.2 - idx * 0.85);
      const halfLen = 2.4 + wave * 4.4;
      return {
        cx: x,
        cy: 12,
        len: halfLen,
        angle: Math.PI / 2,
        bend: 0,
        width: barW,
        opacity: 0.45 + wave * 0.55,
      };
    });
    return { groupRotate: 0, strokes };
  }

  if (variant === "ring") {
    const r = 8;
    const breath = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3.1);
    const arcHalf = 0.42 + breath * 0.2; // radians half-span per quadrant arc
    const chordHalf = r * Math.sin(arcHalf);
    const midDist = r * Math.cos(arcHalf);
    const sagitta = r - midDist;
    const bend = sagitta * 2;
    const groupRotate = reduced ? 0 : (t * 210) % 360;

    const strokes: StrokeSpec[] = [0, 1, 2, 3].map((i) => {
      const theta = i * (Math.PI / 2);
      const cx = 12 + Math.cos(theta) * midDist;
      const cy = 12 + Math.sin(theta) * midDist;
      const tangent = theta + Math.PI / 2;
      return {
        cx,
        cy,
        len: chordHalf,
        angle: tangent,
        bend: -bend,
        width: strokeWidth,
        opacity: 1,
      };
    });
    return { groupRotate, strokes };
  }

  // variant === "square"
  const period = 0.95;
  const stepIndex = reduced ? 0 : Math.floor(t / period);
  const local = reduced ? 0 : (t % period) / period;
  // Ease in-out cubic for the quarter turn
  const eased =
    local < 0.6
      ? (() => {
          const p = local / 0.6;
          return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        })()
      : 1;
  const open = reduced ? 0 : Math.sin(Math.min(1, local / 0.6) * Math.PI);
  const groupRotate = (stepIndex + eased) * 90;
  const dist = 6.2 + open * 1.5;
  const sideHalf = 4.6 - open * 1.2;

  const strokes: StrokeSpec[] = [
    { cx: 12, cy: 12 - dist, len: sideHalf, angle: 0, bend: 0, width: strokeWidth, opacity: 1 },
    { cx: 12 + dist, cy: 12, len: sideHalf, angle: Math.PI / 2, bend: 0, width: strokeWidth, opacity: 1 },
    { cx: 12, cy: 12 + dist, len: sideHalf, angle: Math.PI, bend: 0, width: strokeWidth, opacity: 1 },
    { cx: 12 - dist, cy: 12, len: sideHalf, angle: -Math.PI / 2, bend: 0, width: strokeWidth, opacity: 1 },
  ];
  return { groupRotate, strokes };
}

function createSpringStroke(spec: StrokeSpec): SpringStroke {
  return {
    cx: { val: spec.cx, vel: 0 },
    cy: { val: spec.cy, vel: 0 },
    len: { val: spec.len, vel: 0 },
    angle: { val: spec.angle, vel: 0 },
    bend: { val: spec.bend, vel: 0 },
    width: { val: spec.width, vel: 0 },
    opacity: { val: spec.opacity, vel: 0 },
  };
}

export function MorphLoader({
  variant = "dots",
  status = "loading",
  size = 24,
  strokeWidth = 2.5,
  tone = true,
  label = "Loading",
  successLabel = "Done",
  errorLabel = "Failed",
  decorative = false,
  className,
  style,
}: MorphLoaderProps) {
  const reduced = Boolean(useReducedMotion());
  const gRef = useRef<SVGGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([null, null, null, null]);

  const propsRef = useRef({ variant, status, strokeWidth, reduced });
  useEffect(() => {
    propsRef.current = { variant, status, strokeWidth, reduced };
  }, [variant, status, strokeWidth, reduced]);

  const initial = getTargets(variant, status, 0, strokeWidth, true);
  const stateRef = useRef<{
    strokes: SpringStroke[];
    rot: SpringScalar;
    scale: SpringScalar;
    prevStatus: MorphLoaderStatus;
    time: number;
  }>({
    strokes: initial.strokes.map(createSpringStroke),
    rot: { val: initial.groupRotate, vel: 0 },
    scale: { val: 1, vel: 0 },
    prevStatus: status,
    time: 0,
  });

  useEffect(() => {
    let rafId = 0;
    let last = 0;
    let settledFrames = 0;

    const applyDom = () => {
      const st = stateRef.current;
      if (gRef.current) {
        gRef.current.style.transform = `rotate(${st.rot.val.toFixed(3)}deg) scale(${st.scale.val.toFixed(4)})`;
      }
      for (let i = 0; i < 4; i++) {
        const p = pathRefs.current[i];
        const s = st.strokes[i];
        if (!p || !s) continue;
        p.setAttribute("d", strokeToPath(s.cx.val, s.cy.val, s.len.val, s.angle.val, s.bend.val));
        p.setAttribute("stroke-width", Math.max(0, s.width.val).toFixed(3));
        p.style.opacity = Math.max(0, Math.min(1, s.opacity.val)).toFixed(3);
      }
    };

    const tick = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      const cur = propsRef.current;
      const st = stateRef.current;

      if (cur.status !== st.prevStatus) {
        st.prevStatus = cur.status;
        if (!cur.reduced && (cur.status === "success" || cur.status === "error")) {
          // Give a subtle pop impulse on resolve
          st.scale.vel = 2.4;
        }
        settledFrames = 0;
      }

      if (cur.status === "loading" && !cur.reduced) {
        st.time += dt;
      }

      const target = getTargets(cur.variant, cur.status, st.time, cur.strokeWidth, cur.reduced);

      if (cur.reduced) {
        for (let i = 0; i < 4; i++) {
          const s = st.strokes[i];
          const t = target.strokes[i];
          s.cx.val = t.cx;
          s.cy.val = t.cy;
          s.len.val = t.len;
          s.angle.val = t.angle;
          s.bend.val = t.bend;
          s.width.val = t.width;
          s.opacity.val = t.opacity;
          s.cx.vel = s.cy.vel = s.len.vel = s.angle.vel = s.bend.vel = s.width.vel = s.opacity.vel = 0;
        }
        st.rot.val = target.groupRotate;
        st.rot.vel = 0;
        st.scale.val = 1;
        st.scale.vel = 0;
        applyDom();
        return;
      }

      const stiff = cur.status === "loading" ? 260 : 320;
      const damp = cur.status === "loading" ? 24 : 26;

      let maxDelta = 0;
      for (let i = 0; i < 4; i++) {
        const s = st.strokes[i];
        const t = target.strokes[i];
        stepSpring(s.cx, t.cx, dt, stiff, damp);
        stepSpring(s.cy, t.cy, dt, stiff, damp);
        stepSpring(s.len, t.len, dt, stiff, damp);
        stepAngleSpring(s.angle, t.angle, dt, stiff, damp);
        stepSpring(s.bend, t.bend, dt, stiff, damp);
        stepSpring(s.width, t.width, dt, stiff, damp);
        stepSpring(s.opacity, t.opacity, dt, stiff, damp);
        maxDelta = Math.max(
          maxDelta,
          Math.abs(s.cx.val - t.cx) + Math.abs(s.cx.vel) * 0.05,
          Math.abs(s.cy.val - t.cy) + Math.abs(s.cy.vel) * 0.05,
          Math.abs(s.len.val - t.len) + Math.abs(s.len.vel) * 0.05,
          Math.abs(s.width.val - t.width) + Math.abs(s.width.vel) * 0.05
        );
      }

      if (cur.status === "loading" && (cur.variant === "ring" || cur.variant === "square")) {
        // Track continuous rotation smoothly
        st.rot.val = target.groupRotate;
        st.rot.vel = 0;
      } else {
        // Turn forward to nearest upright multiple of 360
        const currentMod = ((st.rot.val % 360) + 360) % 360;
        const targetRot = currentMod === 0 ? st.rot.val : st.rot.val + (360 - currentMod);
        stepSpring(st.rot, targetRot, dt, 220, 24);
        maxDelta = Math.max(maxDelta, Math.abs(st.rot.val - targetRot) + Math.abs(st.rot.vel) * 0.02);
      }

      stepSpring(st.scale, 1, dt, 380, 22);
      maxDelta = Math.max(maxDelta, Math.abs(st.scale.val - 1) * 20 + Math.abs(st.scale.vel));

      applyDom();

      if (cur.status !== "loading" && maxDelta < 0.02) {
        settledFrames++;
        if (settledFrames > 12) return;
      } else {
        settledFrames = 0;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [variant, status, strokeWidth, reduced]);

  const statusText =
    status === "success" ? successLabel : status === "error" ? errorLabel : label;

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-status={status}
      data-tone={tone ? "" : undefined}
      style={{ width: size, height: size, ...style }}
      role={decorative ? undefined : "status"}
      aria-hidden={decorative ? true : undefined}
    >
      <svg
        className={styles.svg}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <g
          ref={gRef}
          style={{
            transformOrigin: "50% 50%",
            transformBox: "view-box",
          }}
        >
          {[0, 1, 2, 3].map((idx) => (
            <path
              key={idx}
              ref={(el) => {
                pathRefs.current[idx] = el;
              }}
              d={strokeToPath(
                initial.strokes[idx].cx,
                initial.strokes[idx].cy,
                initial.strokes[idx].len,
                initial.strokes[idx].angle,
                initial.strokes[idx].bend
              )}
              strokeWidth={initial.strokes[idx].width}
              style={{ opacity: initial.strokes[idx].opacity }}
            />
          ))}
        </g>
      </svg>
      {!decorative && <span className={styles.srOnly}>{statusText}</span>}
    </span>
  );
}

export default MorphLoader;
