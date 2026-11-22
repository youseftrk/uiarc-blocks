"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ghost-mascot.module.css";

export type GhostStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "writing"
  | "done"
  | "error";

export type GhostTone = "accent" | "sheet" | "ink";

export interface GhostMascotProps {
  status?: GhostStatus;
  size?: number;
  tone?: GhostTone;
  color?: string;
  eyeColor?: string;
  ground?: boolean;
  paused?: boolean;
  name?: string;
  label?: string;
  announce?: boolean;
  onStatusChange?: (status: GhostStatus) => void;
  className?: string;
  style?: CSSProperties;
}

const LOOP_ORDER: GhostStatus[] = [
  "idle",
  "listening",
  "thinking",
  "writing",
  "done",
  "error",
];

const LOOP_DURATIONS_MS: Record<GhostStatus, number> = {
  idle: 3200,
  listening: 2800,
  thinking: 3400,
  writing: 3800,
  done: 2600,
  error: 2600,
};

interface PoseConfig {
  floatAmp: number;
  floatSpeed: number;
  baseY: number;
  baseX: number;
  tilt: number;
  scaleX: number;
  scaleY: number;
  hemAmp: number;
  hemSpeed: number;
  flare: number;
  opacity: number;
  eyeScaleX: number;
  eyeScaleY: number;
  eyeGazeX: number;
  eyeGazeY: number;
  happy: number;
  droop: number;
  swirlAlpha: number;
  writeAlpha: number;
  starAlpha: number;
}

const POSES: Record<GhostStatus, PoseConfig> = {
  idle: {
    floatAmp: 3.6,
    floatSpeed: 2.0,
    baseY: 0,
    baseX: 0,
    tilt: 0,
    scaleX: 1,
    scaleY: 1,
    hemAmp: 1.6,
    hemSpeed: 2.3,
    flare: 0,
    opacity: 1,
    eyeScaleX: 1,
    eyeScaleY: 1,
    eyeGazeX: 0,
    eyeGazeY: 0,
    happy: 0,
    droop: 0,
    swirlAlpha: 0,
    writeAlpha: 0,
    starAlpha: 0,
  },
  listening: {
    floatAmp: 2.4,
    floatSpeed: 2.4,
    baseY: 0.6,
    baseX: 0,
    tilt: -4,
    scaleX: 1.05,
    scaleY: 1.04,
    hemAmp: 1.4,
    hemSpeed: 2.6,
    flare: 1.2,
    opacity: 1,
    eyeScaleX: 1.12,
    eyeScaleY: 1.14,
    eyeGazeX: -0.6,
    eyeGazeY: -0.4,
    happy: 0,
    droop: 0,
    swirlAlpha: 0,
    writeAlpha: 0,
    starAlpha: 0,
  },
  thinking: {
    floatAmp: 4.4,
    floatSpeed: 1.55,
    baseY: -4.2,
    baseX: -1.2,
    tilt: -2.2,
    scaleX: 0.98,
    scaleY: 1.02,
    hemAmp: 2.0,
    hemSpeed: 1.9,
    flare: -0.6,
    opacity: 0.72,
    eyeScaleX: 0.96,
    eyeScaleY: 0.96,
    eyeGazeX: 4.0,
    eyeGazeY: -4.8,
    happy: 0,
    droop: 0,
    swirlAlpha: 1,
    writeAlpha: 0,
    starAlpha: 0,
  },
  writing: {
    floatAmp: 2.0,
    floatSpeed: 2.8,
    baseY: 1.6,
    baseX: -2.0,
    tilt: 5.5,
    scaleX: 1.01,
    scaleY: 0.99,
    hemAmp: 1.5,
    hemSpeed: 3.0,
    flare: 0.8,
    opacity: 1,
    eyeScaleX: 0.95,
    eyeScaleY: 0.95,
    eyeGazeX: 5.5,
    eyeGazeY: 5.0,
    happy: 0,
    droop: 0,
    swirlAlpha: 0,
    writeAlpha: 1,
    starAlpha: 0,
  },
  done: {
    floatAmp: 3.0,
    floatSpeed: 2.2,
    baseY: -4.8,
    baseX: 0,
    tilt: -1.5,
    scaleX: 1.03,
    scaleY: 1.03,
    hemAmp: 1.7,
    hemSpeed: 2.5,
    flare: 1.0,
    opacity: 1,
    eyeScaleX: 1.04,
    eyeScaleY: 1.0,
    eyeGazeX: 0.4,
    eyeGazeY: -1.2,
    happy: 1,
    droop: 0,
    swirlAlpha: 0,
    writeAlpha: 0,
    starAlpha: 1,
  },
  error: {
    floatAmp: 1.1,
    floatSpeed: 1.2,
    baseY: 4.5,
    baseX: 0,
    tilt: -3.2,
    scaleX: 1.02,
    scaleY: 0.95,
    hemAmp: 0.8,
    hemSpeed: 1.3,
    flare: 0.5,
    opacity: 0.92,
    eyeScaleX: 0.95,
    eyeScaleY: 0.72,
    eyeGazeX: 0,
    eyeGazeY: 3.0,
    happy: 0,
    droop: 1,
    swirlAlpha: 0,
    writeAlpha: 0,
    starAlpha: 0,
  },
};

const STAR_PATH =
  "M0 -1C.1 -.28 .28 -.1 1 0C.28 .1 .1 .28 0 1C-.1 .28 -.28 .1 -1 0C-.28 -.1 -.1 -.28 0 -1Z";

function buildSwirlPath(): string {
  const steps = 56;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = -Math.PI / 2 + t * Math.PI * 3.85;
    const r = 6.2 * (1 - t * 0.78);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join("");
}

const SWIRL_PATH = buildSwirlPath();

interface WriteWord {
  startX: number;
  endX: number;
  phaseOffset: number;
}

const WRITE_WORDS: WriteWord[] = [
  { startX: 81.1, endX: 85.7, phaseOffset: 0 },
  { startX: 88.0, endX: 96.1, phaseOffset: 1.4 },
  { startX: 98.5, endX: 106.0, phaseOffset: 2.9 },
];

function sampleWriteY(x: number, phaseOffset: number): number {
  return (
    107.2 +
    Math.sin((x - 81) * 0.78 + phaseOffset) * 1.45 +
    Math.cos((x - 81) * 1.45) * 0.4
  );
}

function buildWriteLineAndPen(progress: number): {
  path: string;
  penX: number;
  penY: number;
  penLift: number;
} {
  // progress in [0, 1]:
  // 0..0.72 draws 3 words with lifts between them
  // 0.72..1.0 erases from left while pen glides back
  const segments: string[] = [];
  let penX = WRITE_WORDS[0].startX;
  let penY = sampleWriteY(penX, 0);
  let penLift = 0;

  if (progress <= 0.72) {
    const drawP = progress / 0.72;
    const wordRanges = [
      { drawStart: 0.0, drawEnd: 0.24, liftEnd: 0.32 },
      { drawStart: 0.32, drawEnd: 0.64, liftEnd: 0.72 },
      { drawStart: 0.72, drawEnd: 1.0, liftEnd: 1.0 },
    ];

    for (let w = 0; w < WRITE_WORDS.length; w++) {
      const word = WRITE_WORDS[w];
      const range = wordRanges[w];
      if (drawP <= range.drawStart) break;
      const localP = Math.min(
        1,
        (drawP - range.drawStart) / (range.drawEnd - range.drawStart)
      );
      const steps = Math.max(2, Math.round((word.endX - word.startX) * 2));
      const maxStep = Math.floor(steps * localP);
      let seg = "";
      let lastX = word.startX;
      let lastY = sampleWriteY(lastX, word.phaseOffset);
      for (let i = 0; i <= maxStep; i++) {
        const frac = i / steps;
        const x = word.startX + (word.endX - word.startX) * frac;
        const y = sampleWriteY(x, word.phaseOffset);
        seg += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        lastX = x;
        lastY = y;
      }
      if (localP < 1) {
        const x = word.startX + (word.endX - word.startX) * localP;
        const y = sampleWriteY(x, word.phaseOffset);
        seg += `L${x.toFixed(2)} ${y.toFixed(2)}`;
        lastX = x;
        lastY = y;
      }
      if (seg) segments.push(seg);

      if (drawP <= range.drawEnd) {
        penX = lastX;
        penY = lastY;
        penLift = 0;
      } else if (drawP < range.liftEnd && w < WRITE_WORDS.length - 1) {
        const nextWord = WRITE_WORDS[w + 1];
        const liftP = (drawP - range.drawEnd) / (range.liftEnd - range.drawEnd);
        const smooth = liftP * liftP * (3 - 2 * liftP);
        penX = word.endX + (nextWord.startX - word.endX) * smooth;
        penY =
          sampleWriteY(word.endX, word.phaseOffset) * (1 - smooth) +
          sampleWriteY(nextWord.startX, nextWord.phaseOffset) * smooth;
        penLift = Math.sin(liftP * Math.PI) * 3.8;
      } else {
        penX = lastX;
        penY = lastY;
        penLift = 0;
      }
    }
  } else {
    const eraseP = (progress - 0.72) / 0.28;
    const smooth = eraseP * eraseP * (3 - 2 * eraseP);
    const totalMin = WRITE_WORDS[0].startX;
    const totalMax = WRITE_WORDS[WRITE_WORDS.length - 1].endX;
    const cutX = totalMin + (totalMax - totalMin) * smooth;

    for (let w = 0; w < WRITE_WORDS.length; w++) {
      const word = WRITE_WORDS[w];
      if (word.endX <= cutX) continue;
      const startX = Math.max(word.startX, cutX);
      const steps = Math.max(2, Math.round((word.endX - startX) * 2));
      let seg = "";
      for (let i = 0; i <= steps; i++) {
        const x = startX + ((word.endX - startX) * i) / steps;
        const y = sampleWriteY(x, word.phaseOffset);
        seg += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      if (seg) segments.push(seg);
    }

    penX = totalMax + (totalMin - totalMax) * smooth;
    penY = sampleWriteY(penX, 0);
    penLift = Math.sin(eraseP * Math.PI) * 4.5;
  }

  return {
    path: segments.join(""),
    penX,
    penY: penY - penLift,
    penLift,
  };
}

function buildGhostPath(
  hemPhase1: number,
  hemPhase2: number,
  hemAmp: number,
  flare: number,
  stretchY: number
): string {
  const rightX = 91.2 + flare;
  const leftX = 28.8 - flare;
  const rightHemX = rightX - 2.8;
  const leftHemX = leftX + 2.8;
  const baseHemY = 89.2 + stretchY * 1.4;

  const hemY = (t: number) =>
    baseHemY +
    Math.sin(t * Math.PI * 5.2 + hemPhase1) * hemAmp +
    Math.sin(t * Math.PI * 2.7 - hemPhase2) * (hemAmp * 0.45);

  const hemDy = (t: number) =>
    Math.cos(t * Math.PI * 5.2 + hemPhase1) * hemAmp * Math.PI * 5.2 +
    Math.cos(t * Math.PI * 2.7 - hemPhase2) * (hemAmp * 0.45) * Math.PI * 2.7;

  const count = 12;
  const dt = 1 / count;
  const rightStartY = hemY(0);
  const leftEndY = hemY(1);

  let d = `M32 46C32 30.54 44.54 18 60 18C75.46 18 88 30.54 88 46C88 61 ${rightX.toFixed(2)} 70.4 ${rightX.toFixed(2)} ${(rightStartY - 2.8).toFixed(2)}Q${rightX.toFixed(2)} ${rightStartY.toFixed(2)} ${rightHemX.toFixed(2)} ${rightStartY.toFixed(2)}`;

  const dxStep = (leftHemX - rightHemX) / count;
  for (let i = 0; i < count; i++) {
    const t0 = i * dt;
    const t1 = (i + 1) * dt;
    const x0 = rightHemX + dxStep * i;
    const x1 = rightHemX + dxStep * (i + 1);
    const y0 = hemY(t0);
    const y1 = hemY(t1);
    const dy0 = (hemDy(t0) * dt) / 3;
    const dy1 = (hemDy(t1) * dt) / 3;
    const cx1 = x0 + dxStep / 3;
    const cy1 = y0 + dy0;
    const cx2 = x1 - dxStep / 3;
    const cy2 = y1 - dy1;
    d += `C${cx1.toFixed(2)} ${cy1.toFixed(2)} ${cx2.toFixed(2)} ${cy2.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  d += `Q${leftX.toFixed(2)} ${leftEndY.toFixed(2)} ${leftX.toFixed(2)} ${(leftEndY - 2.8).toFixed(2)}C${leftX.toFixed(2)} 71 32 61 32 46Z`;
  return d;
}

function buildEyePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  happy: number,
  droop: number,
  isRight: boolean
): string {
  if (happy > 0.5) {
    // Happy curved smile-eye
    const w = rx * 1.15;
    const arch = ry * 0.65;
    const thick = Math.max(1.8, rx * 0.44);
    const x0 = cx - w;
    const x1 = cx + w;
    const baseY = cy + arch * 0.25;
    return `M${x0.toFixed(2)} ${baseY.toFixed(2)}Q${cx.toFixed(2)} ${(baseY - arch * 1.65).toFixed(2)} ${x1.toFixed(2)} ${baseY.toFixed(2)}Q${(x1 - thick * 0.35).toFixed(2)} ${(baseY + thick * 0.55).toFixed(2)} ${(x1 - thick * 0.85).toFixed(2)} ${(baseY + thick * 0.25).toFixed(2)}Q${cx.toFixed(2)} ${(baseY - arch * 0.85).toFixed(2)} ${(x0 + thick * 0.85).toFixed(2)} ${(baseY + thick * 0.25).toFixed(2)}Q${(x0 + thick * 0.35).toFixed(2)} ${(baseY + thick * 0.55).toFixed(2)} ${x0.toFixed(2)} ${baseY.toFixed(2)}Z`;
  }

  if (droop > 0.35) {
    const tilt = (isRight ? -1 : 1) * droop * 2.4;
    const topY = cy - ry * (1 - droop * 0.45);
    const botY = cy + ry;
    return `M${(cx - rx).toFixed(2)} ${(topY - tilt * 0.5).toFixed(2)}L${(cx + rx).toFixed(2)} ${(topY + tilt * 0.5).toFixed(2)}C${(cx + rx).toFixed(2)} ${(botY + ry * 0.25).toFixed(2)} ${(cx - rx).toFixed(2)} ${(botY + ry * 0.25).toFixed(2)} ${(cx - rx).toFixed(2)} ${(topY - tilt * 0.5).toFixed(2)}Z`;
  }

  // Smooth rounded pill/oval eye
  const k = ry * 1.33;
  return `M${(cx - rx).toFixed(2)} ${cy.toFixed(2)}C${(cx - rx).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)}C${(cx + rx).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)}Z`;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendPose(a: PoseConfig, b: PoseConfig, t: number): PoseConfig {
  return {
    floatAmp: lerp(a.floatAmp, b.floatAmp, t),
    floatSpeed: lerp(a.floatSpeed, b.floatSpeed, t),
    baseY: lerp(a.baseY, b.baseY, t),
    baseX: lerp(a.baseX, b.baseX, t),
    tilt: lerp(a.tilt, b.tilt, t),
    scaleX: lerp(a.scaleX, b.scaleX, t),
    scaleY: lerp(a.scaleY, b.scaleY, t),
    hemAmp: lerp(a.hemAmp, b.hemAmp, t),
    hemSpeed: lerp(a.hemSpeed, b.hemSpeed, t),
    flare: lerp(a.flare, b.flare, t),
    opacity: lerp(a.opacity, b.opacity, t),
    eyeScaleX: lerp(a.eyeScaleX, b.eyeScaleX, t),
    eyeScaleY: lerp(a.eyeScaleY, b.eyeScaleY, t),
    eyeGazeX: lerp(a.eyeGazeX, b.eyeGazeX, t),
    eyeGazeY: lerp(a.eyeGazeY, b.eyeGazeY, t),
    happy: lerp(a.happy, b.happy, t),
    droop: lerp(a.droop, b.droop, t),
    swirlAlpha: lerp(a.swirlAlpha, b.swirlAlpha, t),
    writeAlpha: lerp(a.writeAlpha, b.writeAlpha, t),
    starAlpha: lerp(a.starAlpha, b.starAlpha, t),
  };
}

export function GhostMascot({
  status: statusProp,
  size = 96,
  tone = "accent",
  color,
  eyeColor,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: GhostMascotProps) {
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced);
  const clipId = `ghost-clip-${useId().replace(/:/g, "")}`;
  const isSelfPlaying = statusProp === undefined;

  const [autoIndex, setAutoIndex] = useState(0);
  const status: GhostStatus = isSelfPlaying ? LOOP_ORDER[autoIndex] : statusProp;
  const compact = size < 56;
  const showGround = ground && !compact;

  const rootRef = useRef<HTMLSpanElement>(null);
  const clipPathRef = useRef<SVGPathElement>(null);
  const shadePathRef = useRef<SVGPathElement>(null);
  const bodyPathRef = useRef<SVGPathElement>(null);
  const outlinePathRef = useRef<SVGPathElement>(null);
  const bodyGroupRef = useRef<SVGGElement>(null);
  const sheetOpacityRef = useRef<SVGGElement>(null);
  const groundRef = useRef<SVGEllipseElement>(null);
  const leftEyeRef = useRef<SVGPathElement>(null);
  const rightEyeRef = useRef<SVGPathElement>(null);
  const swirlRef = useRef<SVGPathElement>(null);
  const star1Ref = useRef<SVGPathElement>(null);
  const star2Ref = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const penRef = useRef<SVGGElement>(null);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        setInView(entries[0]?.isIntersecting ?? true);
      },
      { rootMargin: "48px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Self-playing loop when status is unset
  useEffect(() => {
    if (!isSelfPlaying || paused || !inView || !pageVisible) return;
    const dur = LOOP_DURATIONS_MS[LOOP_ORDER[autoIndex]];
    const timer = window.setTimeout(() => {
      setAutoIndex((prev) => {
        const next = (prev + 1) % LOOP_ORDER.length;
        onStatusChangeRef.current?.(LOOP_ORDER[next]);
        return next;
      });
    }, dur);
    return () => window.clearTimeout(timer);
  }, [isSelfPlaying, paused, inView, pageVisible, autoIndex]);

  // Persistent animation state across status changes
  const animStateRef = useRef({
    currentPose: { ...POSES[status] },
    fromPose: { ...POSES[status] },
    toPose: { ...POSES[status] },
    blendElapsed: 0.4,
    statusName: status as GhostStatus,
    floatPhase: 0,
    hemPhase1: 0,
    hemPhase2: 0,
    swirlPhase: 0,
    writePhase: 0,
    doneElapsed: 1,
    errorElapsed: 2,
    eyeX: POSES[status].eyeGazeX,
    eyeY: POSES[status].eyeGazeY,
    eyeVx: 0,
    eyeVy: 0,
    glanceTimer: 1.8,
    glanceX: 0,
    glanceY: 0,
    blinkTimer: 2.6,
    blinkProgress: 0,
    twinklePhase: 0,
  });

  // Trigger 400ms blend on status change
  useEffect(() => {
    const s = animStateRef.current;
    if (s.statusName !== status) {
      s.fromPose = { ...s.currentPose };
      s.toPose = { ...POSES[status] };
      s.blendElapsed = 0;
      s.statusName = status;
      if (status === "done") s.doneElapsed = 0;
      if (status === "error") s.errorElapsed = 0;
    }
  }, [status]);

  // Paint a single frame into SVG DOM nodes
  useEffect(() => {
    const applyFrame = (dt: number, isReduced: boolean) => {
      const s = animStateRef.current;
      if (isReduced) {
        s.currentPose = { ...POSES[status] };
        s.blendElapsed = 0.4;
      } else {
        s.blendElapsed = Math.min(0.4, s.blendElapsed + dt);
        const t = easeInOutCubic(s.blendElapsed / 0.4);
        s.currentPose = blendPose(s.fromPose, s.toPose, t);
      }

      const p = s.currentPose;

      if (!isReduced) {
        s.floatPhase += dt * p.floatSpeed;
        s.hemPhase1 += dt * p.hemSpeed;
        s.hemPhase2 += dt * (p.hemSpeed * 0.72);
        s.swirlPhase += dt * 0.46;
        s.writePhase = (s.writePhase + dt * 0.34) % 1;
        s.doneElapsed += dt;
        s.errorElapsed += dt;
        s.twinklePhase += dt * 2.2;
      }

      const floatY = isReduced ? 0 : Math.sin(s.floatPhase) * p.floatAmp;
      const floatVel = isReduced ? 0 : Math.cos(s.floatPhase) * p.floatAmp;
      const stretchY = -floatVel * 0.25;
      const dynamicFlare = p.flare + Math.max(0, floatVel) * 0.25;

      // Error one-shot damped wobble over ~1.2s
      let errorWobbleX = 0;
      let errorWobbleRot = 0;
      if (!isReduced && s.errorElapsed < 1.25) {
        const ramp = Math.min(1, s.errorElapsed / 0.08);
        const decay = Math.exp(-s.errorElapsed * 4.2);
        const wave = Math.sin(s.errorElapsed * 26);
        errorWobbleX = wave * decay * ramp * 4.6;
        errorWobbleRot = wave * decay * ramp * 7.5;
      }

      const bodyPath = buildGhostPath(
        isReduced ? 0.6 : s.hemPhase1,
        isReduced ? 1.1 : s.hemPhase2,
        p.hemAmp,
        dynamicFlare,
        stretchY
      );

      clipPathRef.current?.setAttribute("d", bodyPath);
      shadePathRef.current?.setAttribute("d", bodyPath);
      bodyPathRef.current?.setAttribute("d", bodyPath);
      outlinePathRef.current?.setAttribute("d", bodyPath);

      const totalX = p.baseX + errorWobbleX;
      const totalY = p.baseY + floatY;
      const totalRot = p.tilt + errorWobbleRot;
      const sx = p.scaleX - stretchY * 0.012;
      const sy = p.scaleY + stretchY * 0.015;

      bodyGroupRef.current?.setAttribute(
        "transform",
        `translate(${totalX.toFixed(2)} ${totalY.toFixed(2)}) rotate(${totalRot.toFixed(2)} 60 58) translate(60 46) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-60 -46)`
      );
      sheetOpacityRef.current?.setAttribute("opacity", p.opacity.toFixed(3));

      // Ground shadow shrinks and fades as ghost rises
      if (groundRef.current) {
        const lift = Math.max(-6, Math.min(10, totalY));
        const gScale = 1 + lift * 0.016;
        const gOpacity = Math.max(0.35, Math.min(0.95, 0.8 + lift * 0.025));
        groundRef.current.setAttribute(
          "transform",
          `translate(${(60 + totalX * 0.5).toFixed(2)} 112) scale(${gScale.toFixed(3)} 1)`
        );
        groundRef.current.setAttribute("opacity", gOpacity.toFixed(3));
      }

      // Writing line + pen
      const writeProg = isReduced ? 0.42 : s.writePhase;
      const writeFrame = buildWriteLineAndPen(writeProg);
      if (lineRef.current) {
        lineRef.current.setAttribute("d", writeFrame.path);
        lineRef.current.setAttribute("opacity", p.writeAlpha.toFixed(3));
      }
      if (penRef.current) {
        penRef.current.setAttribute(
          "transform",
          `translate(${writeFrame.penX.toFixed(2)} ${writeFrame.penY.toFixed(2)})`
        );
        penRef.current.setAttribute("opacity", p.writeAlpha.toFixed(3));
      }

      // Eyes: idle glance & blink, writing tracks pen tip, critically damped spring
      let targetEyeX = p.eyeGazeX;
      let targetEyeY = p.eyeGazeY;
      let blinkFactor = 1;

      if (!isReduced) {
        if (status === "idle") {
          s.glanceTimer -= dt;
          if (s.glanceTimer <= 0) {
            s.glanceTimer = 1.6 + Math.random() * 2.2;
            const choices = [
              [0, 0],
              [3.2, -0.8],
              [-3.2, -0.5],
              [2.2, 1.4],
              [0, 0],
            ];
            const pick = choices[Math.floor(Math.random() * choices.length)];
            s.glanceX = pick[0];
            s.glanceY = pick[1];
          }
          targetEyeX += s.glanceX;
          targetEyeY += s.glanceY;

          s.blinkTimer -= dt;
          if (s.blinkTimer <= 0) {
            s.blinkProgress += dt / 0.16;
            if (s.blinkProgress >= 1) {
              s.blinkProgress = 0;
              s.blinkTimer = 2.6 + Math.random() * 2.6;
            }
          }
          if (s.blinkProgress > 0) {
            blinkFactor = Math.max(
              0.12,
              1 - Math.sin(s.blinkProgress * Math.PI) * 0.9
            );
          }
        } else if (status === "writing") {
          const penNorm = (writeFrame.penX - 93) / 14;
          targetEyeX = p.eyeGazeX + penNorm * 3.5;
          targetEyeY = p.eyeGazeY;
        }

        // Critically damped spring for eyes
        const omega = status === "writing" ? 18 : status === "thinking" ? 6 : 14;
        const f = 1 + 2 * dt * omega;
        const oo = omega * omega;
        const hoo = dt * oo;
        const hhoo = dt * hoo;
        const detInv = 1 / (f + hhoo);
        const detX = f * s.eyeX + dt * s.eyeVx + hhoo * targetEyeX;
        const detV = s.eyeVx + hoo * (targetEyeX - s.eyeX);
        s.eyeX = detX * detInv;
        s.eyeVx = detV * detInv;

        const detY = f * s.eyeY + dt * s.eyeVy + hhoo * targetEyeY;
        const detVy = s.eyeVy + hoo * (targetEyeY - s.eyeY);
        s.eyeY = detY * detInv;
        s.eyeVy = detVy * detInv;
      } else {
        s.eyeX = targetEyeX;
        s.eyeY = targetEyeY;
      }

      const baseEyeRx = compact ? 4.8 : 4.0;
      const baseEyeRy = compact ? 7.2 : 6.1;
      const eyeRx = baseEyeRx * p.eyeScaleX;
      const eyeRy = baseEyeRy * p.eyeScaleY * blinkFactor;
      const eyeGap = compact ? 11.2 : 10.6;
      const eyeBaseY = compact ? 50.5 : 50.4;

      const leftD = buildEyePath(
        60 - eyeGap + s.eyeX,
        eyeBaseY + s.eyeY,
        eyeRx,
        eyeRy,
        p.happy,
        p.droop,
        false
      );
      const rightD = buildEyePath(
        60 + eyeGap + s.eyeX,
        eyeBaseY + s.eyeY,
        eyeRx,
        eyeRy,
        p.happy,
        p.droop,
        true
      );

      leftEyeRef.current?.setAttribute("d", leftD);
      rightEyeRef.current?.setAttribute("d", rightD);

      // Thinking swirl: draws in from outer end and erases behind itself seamlessly
      if (swirlRef.current) {
        const cyc = isReduced ? 0.45 : s.swirlPhase % 1;
        let dashLen = 0;
        let dashOff = 0;
        if (cyc < 0.5) {
          const u = easeInOutCubic(cyc * 2);
          dashLen = u * 0.92;
          dashOff = 0;
        } else {
          const u = easeInOutCubic((cyc - 0.5) * 2);
          dashLen = (1 - u) * 0.92;
          dashOff = -u * 0.92;
        }
        const rot = isReduced ? 120 : (s.swirlPhase * 360) % 360;
        swirlRef.current.setAttribute(
          "transform",
          `translate(90 21) rotate(${rot.toFixed(2)}) scale(${compact ? 1.15 : 1})`
        );
        swirlRef.current.setAttribute(
          "stroke-dasharray",
          `${Math.max(0.001, dashLen).toFixed(3)} 3`
        );
        swirlRef.current.setAttribute("stroke-dashoffset", dashOff.toFixed(3));
        swirlRef.current.setAttribute("opacity", p.swirlAlpha.toFixed(3));
      }

      // Done sparkles: 320ms grow + quarter turn, then gentle twinkle
      if (star1Ref.current && star2Ref.current) {
        const grow = isReduced
          ? 1
          : easeOutCubic(Math.min(1, s.doneElapsed / 0.32));
        const twinkle1 = isReduced ? 1 : 0.88 + Math.sin(s.twinklePhase) * 0.14;
        const twinkle2 = isReduced
          ? 1
          : 0.82 + Math.cos(s.twinklePhase * 1.15) * 0.18;
        const rot1 = (1 - grow) * -90 + (isReduced ? 0 : Math.sin(s.twinklePhase * 0.5) * 8);
        const rot2 = (1 - grow) * -90 - (isReduced ? 0 : Math.cos(s.twinklePhase * 0.6) * 10);
        const s1 = (compact ? 4.4 : 3.8) * grow * twinkle1;
        const s2 = (compact ? 2.1 : 1.75) * grow * twinkle2;

        star1Ref.current.setAttribute(
          "transform",
          `translate(91 22) rotate(${rot1.toFixed(2)}) scale(${s1.toFixed(2)})`
        );
        star1Ref.current.setAttribute("opacity", p.starAlpha.toFixed(3));

        star2Ref.current.setAttribute(
          "transform",
          `translate(100.5 35.5) rotate(${rot2.toFixed(2)}) scale(${s2.toFixed(2)})`
        );
        star2Ref.current.setAttribute(
          "opacity",
          (p.starAlpha * 0.85).toFixed(3)
        );
      }
    };

    if (reduced) {
      applyFrame(0, true);
      return;
    }

    if (paused || !inView || !pageVisible) {
      applyFrame(0, false);
      return;
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      applyFrame(dt, false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, reduced, paused, inView, pageVisible, compact]);

  const resolvedTone = color ? "custom" : tone;
  const rootStyle: CSSProperties = {
    width: size,
    height: size,
    ...(color ? ({ "--ghost-body": color } as CSSProperties) : {}),
    ...(eyeColor ? ({ "--ghost-eye": eyeColor } as CSSProperties) : {}),
    ...style,
  };

  const accessibleLabel = label ?? `${name}, ${status}`;
  const strokeW = compact ? 3.1 : 2.3;

  return (
    <span
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-tone={resolvedTone}
      data-status={status}
      style={rootStyle}
    >
      <svg
        className={styles.svg}
        viewBox={compact ? "8 7 104 104" : "0 0 120 120"}
        width={size}
        height={size}
        role="img"
        aria-label={accessibleLabel}
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            <path ref={clipPathRef} data-shape="true" />
          </clipPath>
        </defs>

        {showGround && (
          <ellipse
            ref={groundRef}
            className={styles.ground}
            cx="0"
            cy="0"
            rx="23"
            ry="3.1"
            transform="translate(60 112)"
            opacity="0.82"
          />
        )}

        <path
          ref={lineRef}
          className={styles.line}
          opacity="0"
          strokeWidth={strokeW}
        />

        <g ref={bodyGroupRef}>
          <g ref={sheetOpacityRef} opacity="1">
            <g clipPath={`url(#${clipId})`}>
              <path ref={shadePathRef} data-shape="true" className={styles.shade} />
              <path
                ref={bodyPathRef}
                data-shape="true"
                className={styles.body}
                transform="translate(-1.8 -3)"
              />
            </g>
            {resolvedTone === "sheet" && (
              <path ref={outlinePathRef} data-shape="true" className={styles.outline} />
            )}
          </g>

          <path ref={leftEyeRef} data-eye="true" className={styles.eye} />
          <path ref={rightEyeRef} data-eye="true" className={styles.eye} />

          <path
            ref={swirlRef}
            className={styles.swirl}
            d={SWIRL_PATH}
            pathLength={1}
            strokeWidth={strokeW}
            opacity="0"
          />

          <path
            ref={star1Ref}
            data-star="true"
            className={styles.mark}
            d={STAR_PATH}
            opacity="0"
          />
          <path
            ref={star2Ref}
            data-star="true"
            className={styles.mark}
            d={STAR_PATH}
            opacity="0"
          />
        </g>

        <g ref={penRef} className={styles.pen} opacity="0">
          <line x1="0" y1="0" x2="1.3" y2="-2.4" strokeWidth={compact ? 2.2 : 1.65} />
          <line x1="2.3" y1="-4.1" x2="6.6" y2="-11.9" strokeWidth={compact ? 4.2 : 3.3} />
        </g>
      </svg>

      {announce && (
        <span className={styles.srOnly} aria-live="polite">
          {accessibleLabel}
        </span>
      )}
    </span>
  );
}

export default GhostMascot;
