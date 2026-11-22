"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Copy, RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./prize-wheel.module.css";

export interface PrizeWheelSegment {
  id?: string;
  label: string;
  detail?: string;
  code?: string;
  weight?: number;
  featured?: boolean;
}

export interface PrizeWheelLabels {
  spin?: string;
  again?: string;
  done?: string;
  copy?: string;
  copied?: string;
  copyFailed?: string;
  odds?: string;
  hint?: string;
  weak?: string;
}

export interface PrizeWheelProps {
  segments?: PrizeWheelSegment[];
  title?: string;
  description?: string;
  labels?: PrizeWheelLabels;
  pickWinner?: (segments: PrizeWheelSegment[]) => number;
  onResult?: (segment: PrizeWheelSegment, index: number) => void;
  once?: boolean;
  sizing?: "equal" | "weight";
  showOdds?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_SEGMENTS: PrizeWheelSegment[] = [
  {
    id: "10-off",
    label: "10% off",
    detail: "Off your first year of Pro",
    code: "SPIN-10OFF",
    weight: 30,
  },
  {
    id: "free-month",
    label: "Free month",
    detail: "One month of Pro on us",
    code: "SPIN-FREEMONTH",
    weight: 12,
  },
  {
    id: "20-off",
    label: "20% off",
    detail: "Off your first year of Pro",
    code: "SPIN-20OFF",
    weight: 18,
  },
  {
    id: "lifetime-pro",
    label: "Lifetime Pro",
    detail: "Pro for life, every future update included",
    code: "SPIN-LIFETIME",
    weight: 1,
    featured: true,
  },
  {
    id: "15-off",
    label: "15% off",
    detail: "Off your first year of Pro",
    code: "SPIN-15OFF",
    weight: 20,
  },
  {
    id: "extra-seat",
    label: "Extra seat",
    detail: "One more teammate, free for a year",
    code: "SPIN-SEAT",
    weight: 14,
  },
  {
    id: "2x-credits",
    label: "2x credits",
    detail: "Double referral credit for 90 days",
    code: "SPIN-2XCREDIT",
    weight: 3,
  },
  {
    id: "priority-help",
    label: "Priority help",
    detail: "Replies within four hours for a year",
    code: "SPIN-PRIORITY",
    weight: 2,
  },
];

const CX = 200;
const CY = 200;
const FACE_R = 162;
const RIM_R = 170;

function polar(r: number, degFromTop: number): [number, number] {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return [
    Math.round((CX + r * Math.cos(rad)) * 100) / 100,
    Math.round((CY + r * Math.sin(rad)) * 100) / 100,
  ];
}

function wedgePath(startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(FACE_R, startDeg);
  const [x2, y2] = polar(FACE_R, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M${CX} ${CY}L${x1} ${y1}A${FACE_R} ${FACE_R} 0 ${largeArc} 1 ${x2} ${y2}Z`;
}

function normDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function formatChance(pct: number): string {
  if (pct >= 1) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

function pickWeightedIndex(segments: PrizeWheelSegment[]): number {
  const weights = segments.map((s) => Math.max(0.001, s.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

type Phase = "idle" | "spinning" | "won";

export function PrizeWheel({
  segments: rawSegments = DEFAULT_SEGMENTS,
  title = "Spin for a reward",
  description = "Every spin wins something. Your code works at checkout.",
  labels,
  pickWinner,
  onResult,
  once = false,
  sizing = "equal",
  showOdds = true,
  speed = 1,
  paused = false,
  accent,
  label = "Prize wheel",
  className,
  style,
}: PrizeWheelProps) {
  const uid = useId();
  const prefersReduced = Boolean(useReducedMotion());

  const segments = useMemo(
    () => rawSegments.slice(0, 12),
    [rawSegments]
  );

  const l = {
    spin: labels?.spin ?? "Spin",
    again: labels?.again ?? "Spin again",
    done: labels?.done ?? "Claimed",
    copy: labels?.copy ?? "Copy code",
    copied: labels?.copied ?? "Copied",
    copyFailed: labels?.copyFailed ?? "Couldn't copy",
    odds: labels?.odds ?? "Odds",
    hint: labels?.hint ?? "Flick the wheel, or hold Spin to wind it up.",
    weak: labels?.weak ?? "Flick a little harder, or hold Spin.",
  };

  // Compute segment geometry (angles clockwise from top 0deg)
  const slices = useMemo(() => {
    const weights = segments.map((s) => Math.max(0.001, s.weight ?? 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const out = [];
    let cursor = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const span =
        sizing === "weight"
          ? (weights[i] / totalWeight) * 360
          : 360 / segments.length;
      const start = cursor;
      const end = cursor + span;
      cursor = end;
      const mid = (start + end) / 2;
      const pct = (weights[i] / totalWeight) * 100;
      const [dx, dy] = polar(FACE_R, start);
      const [px, py] = polar(RIM_R, start);
      out.push({
        seg,
        index: i,
        start,
        end,
        span,
        mid,
        pct,
        path: wedgePath(start, end),
        divX: dx,
        divY: dy,
        pegX: px,
        pegY: py,
        showLabel: span >= 18,
      });
    }
    return out;
  }, [segments, sizing]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);
  const [weakHint, setWeakHint] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [announcement, setAnnouncement] = useState("");

  const locked = once && phase === "won";

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rotorRef = useRef<HTMLDivElement | null>(null);
  const flapRef = useRef<SVGGElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);

  const inViewRef = useRef(true);
  const propsRef = useRef({
    slices,
    segments,
    pickWinner,
    onResult,
    speed,
    paused,
    prefersReduced,
    once,
    locked,
  });

  useEffect(() => {
    propsRef.current = {
      slices,
      segments,
      pickWinner,
      onResult,
      speed,
      paused,
      prefersReduced,
      once,
      locked,
    };
  }, [slices, segments, pickWinner, onResult, speed, paused, prefersReduced, once, locked]);

  // Physics state kept outside React for 60fps zero-rerender spins
  const physRef = useRef({
    angle: 15,
    mode: "idle" as "idle" | "charging" | "dragging" | "spinning" | "won",
    chargeStart: 0,
    chargeStartAngle: 15,
    chargeVal: 0,
    spinStart: 0,
    spinDuration: 4.8,
    spinFrom: 15,
    spinTo: 15,
    spinDir: 1,
    spinRamp: true,
    targetIdx: 0,
    pointerAngle: 0,
    pointerVel: 0,
    prevAngle: 15,
    dragPointerId: -1,
    dragLastPointerDeg: 0,
    dragSamples: [] as Array<{ t: number; a: number }>,
    lastWrittenAngle: NaN,
    lastWrittenPointer: NaN,
    lastWrittenCharge: NaN,
  });

  const startSpin = useCallback(
    (initialVelDegPerSec: number, fromFlick: boolean) => {
      const p = physRef.current;
      const {
        slices: curSlices,
        segments: curSegments,
        pickWinner: picker,
        onResult: resultCb,
        prefersReduced: reduced,
      } = propsRef.current;

      if (curSegments.length === 0) return;

      const idx = Math.max(
        0,
        Math.min(
          curSegments.length - 1,
          picker ? picker(curSegments) : pickWeightedIndex(curSegments)
        )
      );

      const slice = curSlices[idx];
      // Landing spot inside slice (away from pegs)
      const margin = Math.min(slice.span * 0.24, 8);
      const localTarget =
        slice.start + margin + Math.random() * Math.max(1, slice.span - margin * 2);
      // When rotor is at rotation R, the point under top pointer (0deg) is normDeg(-R).
      // So we want normDeg(-finalAngle) === localTarget => normDeg(finalAngle) === normDeg(-localTarget)
      const desiredMod = normDeg(-localTarget);

      if (reduced) {
        p.angle = desiredMod;
        p.prevAngle = desiredMod;
        p.pointerAngle = 0;
        p.pointerVel = 0;
        p.mode = "won";
        p.targetIdx = idx;
        if (rotorRef.current) {
          rotorRef.current.style.transform = `rotate(${p.angle.toFixed(3)}deg)`;
        }
        if (flapRef.current) {
          flapRef.current.style.transform = "rotate(0deg)";
        }
        setWinnerIdx(idx);
        setPhase("won");
        setWeakHint(false);
        setCopyState("idle");
        const wonSeg = curSegments[idx];
        setAnnouncement(
          `Won ${wonSeg.label}.${wonSeg.code ? ` Code: ${wonSeg.code.split("").join(" ")}.` : ""}`
        );
        resultCb?.(wonSeg, idx);
        return;
      }

      const dir = initialVelDegPerSec >= 0 ? 1 : -1;
      const absVel = Math.max(280, Math.min(1800, Math.abs(initialVelDegPerSec)));
      // Duration ~ 3.8s to 5.6s for suspenseful settle
      const duration = Math.max(3.6, Math.min(5.8, 2.8 + absVel / 420));
      // For easeOutCubic (1 - (1-t)^3), initial velocity is 3 * delta / duration => delta ≈ absVel * duration / 3
      const naturalTravel = Math.max(720, (absVel * duration) / 3);
      const approxEnd = p.angle + dir * naturalTravel;
      const curMod = normDeg(approxEnd);
      let adjust = desiredMod - curMod;
      if (dir > 0 && adjust < 0) adjust += 360;
      if (dir < 0 && adjust > 0) adjust -= 360;
      const finalAngle = approxEnd + adjust;

      p.mode = "spinning";
      p.spinStart = performance.now();
      p.spinDuration = duration;
      p.spinFrom = p.angle;
      p.spinTo = finalAngle;
      p.spinDir = dir;
      p.spinRamp = !fromFlick;
      p.targetIdx = idx;
      p.chargeVal = 0;

      setPhase("spinning");
      setWinnerIdx(null);
      setWeakHint(false);
      setCopyState("idle");
      setAnnouncement("Spinning the prize wheel");
    },
    []
  );

  // IntersectionObserver to pause idle drift when offscreen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Main single rAF loop
  useEffect(() => {
    let rafId = 0;
    let lastNow = 0;

    const tick = (now: number) => {
      if (lastNow === 0) lastNow = now;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      const p = physRef.current;
      const {
        slices: curSlices,
        segments: curSegments,
        onResult: resultCb,
        speed: curSpeed,
        paused: isPaused,
        prefersReduced: reduced,
        locked: isLocked,
      } = propsRef.current;

      const visible =
        inViewRef.current &&
        (typeof document === "undefined" || document.visibilityState === "visible");

      if (visible) {
        if (p.mode === "idle") {
          if (!isPaused && !reduced && !isLocked && curSpeed > 0) {
            p.angle += 4 * curSpeed * dt;
          }
        } else if (p.mode === "charging") {
          const elapsed = (now - p.chargeStart) / 1000;
          const t = Math.min(1, elapsed / 1.15);
          // Ease in-out charge
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          p.chargeVal = eased;
          p.angle = p.chargeStartAngle - eased * 28;
        } else if (p.mode === "spinning") {
          const elapsed = (now - p.spinStart) / 1000;
          const t = Math.min(1, elapsed / p.spinDuration);
          // Cubic ease-out: 1 - (1 - t)^3 with subtle ramp on button spins
          let ease = 1 - Math.pow(1 - t, 3);
          if (p.spinRamp && t < 0.06) {
            const r = t / 0.06;
            ease = ease * (r * r * (3 - 2 * r));
          }
          p.angle = p.spinFrom + (p.spinTo - p.spinFrom) * ease;

          if (t >= 1) {
            p.angle = p.spinTo;
            p.mode = "won";
            const idx = p.targetIdx;
            const wonSeg = curSegments[idx];
            setWinnerIdx(idx);
            setPhase("won");
            if (wonSeg) {
              setAnnouncement(
                `Won ${wonSeg.label}.${wonSeg.code ? ` Code: ${wonSeg.code.split("").join(" ")}.` : ""}`
              );
              resultCb?.(wonSeg, idx);
            }
          }
        }

        // Pointer spring + peg collision (4 substeps per frame)
        const angleDelta = p.angle - p.prevAngle;
        const substeps = 4;
        const subDt = dt / substeps;
        const pegAngles = curSlices.map((s) => s.start);

        if (!reduced) {
          for (let s = 0; s < substeps; s++) {
            const subAngle = p.prevAngle + (angleDelta * (s + 1)) / substeps;
            const stepMove = angleDelta / substeps;

            // Check if any peg is touching pointer capsule near 0deg
            let deflected = false;
            for (let i = 0; i < pegAngles.length; i++) {
              const pegWorld = normDeg(pegAngles[i] + subAngle);
              const signed = pegWorld > 180 ? pegWorld - 360 : pegWorld;
              if (Math.abs(signed) < 5.2 && Math.abs(stepMove) > 0.01) {
                const pushDir = stepMove >= 0 ? -1 : 1;
                const depth = 1 - Math.abs(signed) / 5.2;
                const targetBend = pushDir * (14 + depth * 18);
                if (
                  (pushDir < 0 && p.pointerAngle > targetBend) ||
                  (pushDir > 0 && p.pointerAngle < targetBend)
                ) {
                  p.pointerAngle = targetBend;
                  p.pointerVel = pushDir * Math.min(480, Math.abs(angleDelta / dt) * 0.45);
                }
                deflected = true;
              }
            }

            if (!deflected) {
              // Stiff lightly-damped spring back to 0
              const force = -820 * p.pointerAngle - 20 * p.pointerVel;
              p.pointerVel += force * subDt;
              p.pointerAngle += p.pointerVel * subDt;
              if (
                Math.abs(p.pointerAngle) < 0.08 &&
                Math.abs(p.pointerVel) < 0.5
              ) {
                p.pointerAngle = 0;
                p.pointerVel = 0;
              }
            }
          }
        } else {
          p.pointerAngle = 0;
          p.pointerVel = 0;
        }
        p.prevAngle = p.angle;

        // Write to DOM only when changed
        if (rotorRef.current && Math.abs(p.angle - p.lastWrittenAngle) > 0.001) {
          p.lastWrittenAngle = p.angle;
          rotorRef.current.style.transform = `rotate(${p.angle.toFixed(3)}deg)`;
        }
        if (flapRef.current && Math.abs(p.pointerAngle - p.lastWrittenPointer) > 0.01) {
          p.lastWrittenPointer = p.pointerAngle;
          flapRef.current.style.transform = `rotate(${p.pointerAngle.toFixed(2)}deg)`;
        }
        if (ringRef.current && Math.abs(p.chargeVal - p.lastWrittenCharge) > 0.002) {
          p.lastWrittenCharge = p.chargeVal;
          ringRef.current.style.strokeDashoffset = (1 - p.chargeVal).toFixed(4);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Pointer drag / flick on wheel face
  const getPointerAngle = (clientX: number, clientY: number): number => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  };

  const handleGripPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    if (p.mode === "spinning" || locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const a = getPointerAngle(e.clientX, e.clientY);
    p.mode = "dragging";
    p.dragPointerId = e.pointerId;
    p.dragLastPointerDeg = a;
    p.dragSamples = [{ t: performance.now(), a: p.angle }];
    setWeakHint(false);
  };

  const handleGripPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    if (p.mode !== "dragging" || p.dragPointerId !== e.pointerId) return;
    const a = getPointerAngle(e.clientX, e.clientY);
    let delta = a - p.dragLastPointerDeg;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    p.dragLastPointerDeg = a;
    p.angle += delta;
    const now = performance.now();
    p.dragSamples.push({ t: now, a: p.angle });
    // Keep last 120ms of samples
    while (p.dragSamples.length > 2 && now - p.dragSamples[0].t > 120) {
      p.dragSamples.shift();
    }
  };

  const handleGripPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    if (p.mode !== "dragging" || p.dragPointerId !== e.pointerId) return;
    p.dragPointerId = -1;
    const now = performance.now();
    const samples = p.dragSamples.filter((s) => now - s.t <= 110);
    let vel = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dtSec = Math.max(0.016, (last.t - first.t) / 1000);
      vel = (last.a - first.a) / dtSec;
    }

    if (Math.abs(vel) < 65) {
      p.mode = winnerIdx !== null ? "won" : "idle";
      setWeakHint(true);
      return;
    }

    startSpin(vel, true);
  };

  // Hub press-and-hold wind-up (pointer + keyboard)
  const beginCharge = () => {
    const p = physRef.current;
    if (p.mode === "spinning" || locked) return;
    if (prefersReduced) {
      startSpin(720, false);
      return;
    }
    p.mode = "charging";
    p.chargeStart = performance.now();
    p.chargeStartAngle = p.angle;
    p.chargeVal = 0;
    setWeakHint(false);
  };

  const releaseCharge = () => {
    const p = physRef.current;
    if (p.mode !== "charging") return;
    const power = p.chargeVal;
    p.chargeVal = 0;
    const vel = 540 + power * 880;
    startSpin(vel, false);
  };

  const handleHubPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginCharge();
  };

  const handleHubPointerUp = () => {
    releaseCharge();
  };

  const handleHubClick = () => {
    // Screen reader activation (without pointerdown/keydown hold)
    const p = physRef.current;
    if (p.mode === "idle" || (p.mode === "won" && !locked)) {
      startSpin(760, false);
    }
  };

  const handleHubKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      beginCharge();
    }
  };

  const handleHubKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      releaseCharge();
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      setAnnouncement(`Copied ${code}`);
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      setAnnouncement(l.copyFailed);
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  const wheelSummary = useMemo(() => {
    const list = slices
      .map((s) => `${s.seg.label}, ${formatChance(s.pct)} chance`)
      .join("; ");
    return `${label}. ${slices.length} prizes: ${list}.`;
  }, [label, slices]);

  const activeWinner = winnerIdx !== null ? segments[winnerIdx] : null;
  const hubDisabled = phase === "spinning" || locked;
  const hubText = locked ? l.done : l.spin;

  const rootStyle = useMemo<CSSProperties>(
    () =>
      accent
        ? ({ ...style, "--pw-accent": accent } as CSSProperties)
        : (style ?? {}),
    [accent, style]
  );

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={rootStyle}
      data-phase={phase}
      role="group"
      aria-label={label}
    >
      <div className={styles.layout}>
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.shadow} aria-hidden="true" />
          <div
            className={styles.grip}
            role="img"
            aria-label={wheelSummary}
            data-locked={locked || undefined}
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onPointerCancel={handleGripPointerUp}
          >
            <div
              ref={rotorRef}
              className={styles.rotor}
              style={{ transform: "rotate(15deg)" }}
            >
              <svg viewBox="0 0 400 400" className={styles.svg} aria-hidden="true">
                {slices.map((s) => {
                  const isWon = phase === "won" && winnerIdx === s.index;
                  return (
                    <g
                      key={s.seg.id ?? s.index}
                      className={styles.wedge}
                      data-alt={s.index % 2 === 1 ? "true" : undefined}
                      data-featured={s.seg.featured ? "true" : undefined}
                      data-won={isWon ? "true" : undefined}
                    >
                      <path d={s.path} />
                      {s.showLabel && (
                        <text
                          x="200"
                          y="52"
                          transform={`rotate(${s.mid} 200 200) rotate(-90 200 52)`}
                          textAnchor="end"
                          dominantBaseline="central"
                        >
                          {s.seg.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {slices.map((s) => (
                  <line
                    key={`div-${s.index}`}
                    className={styles.divider}
                    x1={CX}
                    y1={CY}
                    x2={s.divX}
                    y2={s.divY}
                  />
                ))}

                <circle className={styles.faceEdge} cx={CX} cy={CY} r={FACE_R} />
                <circle
                  className={styles.rim}
                  cx={CX}
                  cy={CY}
                  r={RIM_R}
                  strokeWidth="16"
                />
                <circle className={styles.rimEdge} cx={CX} cy={CY} r="177.5" />

                {slices.map((s) => (
                  <g key={`peg-${s.index}`} className={styles.peg}>
                    <circle cx={s.pegX} cy={s.pegY} r="3.6" />
                    <circle
                      className={styles.pegShine}
                      cx={Math.round((s.pegX - 0.9) * 100) / 100}
                      cy={Math.round((s.pegY - 0.9) * 100) / 100}
                      r="1.2"
                    />
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <svg viewBox="0 0 400 400" className={styles.overlay} aria-hidden="true">
            <defs>
              <linearGradient
                id={`${uid}-sheen`}
                x1="0.15"
                y1="0"
                x2="0.85"
                y2="1"
              >
                <stop offset="0" className={styles.sheenHi} />
                <stop offset="0.45" className={styles.sheenLo} />
                <stop offset="1" className={styles.sheenMid} />
              </linearGradient>
            </defs>
            <circle
              cx={CX}
              cy={CY}
              r={RIM_R}
              fill="none"
              stroke={`url(#${uid}-sheen)`}
              strokeWidth="16"
            />
            <g
              ref={flapRef}
              className={styles.flap}
              style={{ transform: "rotate(0deg)" }}
            >
              <path
                className={styles.pointer}
                d="M193.69 8.55A6.5 6.5 0 1 1 206.31 8.55L201.46 28.36A1.5 1.5 0 0 1 198.54 28.36Z"
              />
              <circle className={styles.pivot} cx="200" cy="7" r="2.6" />
            </g>
          </svg>

          <button
            type="button"
            className={styles.hub}
            aria-describedby={`${uid}-hint`}
            aria-label={locked ? l.done : "Spin the wheel"}
            aria-disabled={hubDisabled || undefined}
            onPointerDown={handleHubPointerDown}
            onPointerUp={handleHubPointerUp}
            onPointerCancel={handleHubPointerUp}
            onKeyDown={handleHubKeyDown}
            onKeyUp={handleHubKeyUp}
            onClick={(e) => {
              if (e.detail === 0) handleHubClick();
            }}
          >
            <svg viewBox="0 0 100 100" className={styles.hubRing} aria-hidden="true">
              <circle
                ref={ringRef}
                cx="50"
                cy="50"
                r="46"
                pathLength={1}
                style={{ strokeDashoffset: 1 }}
              />
            </svg>
            <span className={styles.hubLabel}>{hubText}</span>
          </button>
        </div>

        <div className={styles.panel}>
          <div className={styles.slot}>
            {/* Invisible sizers so the panel never jumps vertically */}
            {segments.map((seg, i) => (
              <div
                key={`sizer-${seg.id ?? i}`}
                className={`${styles.card} ${styles.sizer}`}
                aria-hidden="true"
                inert
              >
                <p className={styles.cardPrize}>{seg.label}</p>
                {seg.detail && <p className={styles.cardDetail}>{seg.detail}</p>}
                {seg.code && (
                  <div className={styles.code}>
                    <span className={styles.codeText}>{seg.code}</span>
                    <span className={styles.copy}>
                      <span className={styles.copyFace} data-on="true">
                        <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                        {l.copy}
                      </span>
                    </span>
                  </div>
                )}
                {!once && (
                  <span className={styles.again}>
                    <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
                    {l.again}
                  </span>
                )}
              </div>
            ))}

            {/* Idle intro */}
            <div
              className={styles.idle}
              data-hidden={phase === "won" ? "true" : undefined}
              aria-hidden={phase === "won" || undefined}
            >
              <h3 className={styles.title}>{title}</h3>
              <p className={styles.description}>{description}</p>
              <p
                id={`${uid}-hint`}
                className={styles.hint}
                data-weak={weakHint ? "true" : undefined}
              >
                {weakHint ? l.weak : l.hint}
              </p>
            </div>

            {/* Winning reward card */}
            <motion.div
              key={winnerIdx ?? "none"}
              className={styles.card}
              data-show={phase === "won" ? "true" : undefined}
              inert={phase !== "won" ? true : undefined}
              initial={
                prefersReduced
                  ? { opacity: 1, x: 0, y: 0, scale: 1 }
                  : { opacity: 0, x: -36, y: -14, scale: 0.94 }
              }
              animate={
                phase === "won"
                  ? { opacity: 1, x: 0, y: 0, scale: 1 }
                  : { opacity: 0, x: 0, y: 0, scale: 0.98 }
              }
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 320, damping: 26, mass: 0.9 }
              }
            >
              {activeWinner && (
                <>
                  <p className={styles.cardPrize}>{activeWinner.label}</p>
                  {activeWinner.detail && (
                    <p className={styles.cardDetail}>{activeWinner.detail}</p>
                  )}
                  {activeWinner.code && (
                    <div className={styles.code}>
                      <span className={styles.codeText}>
                        {activeWinner.code}
                      </span>
                      <button
                        type="button"
                        className={styles.copy}
                        onClick={() => handleCopy(activeWinner.code!)}
                      >
                        <span className={styles.copyStack}>
                          <span
                            className={styles.copyFace}
                            data-on={copyState === "idle" ? "true" : undefined}
                            aria-hidden={copyState !== "idle"}
                          >
                            <Copy
                              size={15}
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            {l.copy}
                          </span>
                          <span
                            className={styles.copyFace}
                            data-on={
                              copyState === "copied" ? "true" : undefined
                            }
                            aria-hidden={copyState !== "copied"}
                          >
                            <svg
                              className={styles.copyCheck}
                              width="15"
                              height="15"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3.5 8.5L6.5 11.5L12.5 5" pathLength={1} />
                            </svg>
                            {l.copied}
                          </span>
                          <span
                            className={styles.copyFace}
                            data-on={
                              copyState === "failed" ? "true" : undefined
                            }
                            aria-hidden={copyState !== "failed"}
                          >
                            {l.copyFailed}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}
                  {!once && (
                    <button
                      type="button"
                      className={styles.again}
                      onClick={() => startSpin(780, false)}
                    >
                      <RotateCw size={15} strokeWidth={1.75} aria-hidden="true" />
                      {l.again}
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </div>

          {showOdds && (
            <div className={styles.odds}>
              <p className={styles.oddsTitle}>{l.odds}</p>
              <ul className={styles.oddsList}>
                {slices.map((s) => (
                  <li
                    key={s.seg.id ?? s.index}
                    className={styles.oddsRow}
                    data-featured={s.seg.featured ? "true" : undefined}
                    data-won={
                      phase === "won" && winnerIdx === s.index
                        ? "true"
                        : undefined
                    }
                  >
                    <span className={styles.oddsLabel}>{s.seg.label}</span>
                    <span className={styles.oddsValue}>
                      {formatChance(s.pct)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

export default PrizeWheel;
