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
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import styles from "./arming-switch.module.css";

export type ArmingSwitchStatus =
  | "safe"
  | "open"
  | "armed"
  | "running"
  | "done"
  | "failed";

export interface ArmingSwitchProps {
  title?: string;
  description?: string;
  armLabel?: string;
  safeLabel?: string;
  holdLabel?: string;
  readyLabel?: string;
  statusLabels?: Partial<Record<ArmingSwitchStatus, string>>;
  hints?: Partial<Record<ArmingSwitchStatus, string>>;
  holdDuration?: number;
  onConfirm?: () => void | boolean | Promise<void | boolean>;
  autoSafe?: boolean;
  disabled?: boolean;
  haptics?: boolean;
  accent?: string;
  coverColor?: string;
  onStatusChange?: (status: ArmingSwitchStatus) => void;
  onCoverChange?: (open: boolean) => void;
  onArmChange?: (armed: boolean) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_STATUS_LABELS: Record<ArmingSwitchStatus, string> = {
  safe: "Safe",
  open: "Cover open",
  armed: "Armed",
  running: "Deploying",
  done: "Deployed",
  failed: "Failed",
};

const DEFAULT_HINTS: Record<ArmingSwitchStatus, string> = {
  safe: "Lift the safety cover to begin.",
  open: "Throw the switch up to arm it.",
  armed: "Press and hold the lamp to deploy.",
  running: "Deploying to both regions.",
  done: "Deploy finished. Lift the cover to run it again.",
  failed: "The action did not finish. Hold the lamp to retry.",
};

const STATUS_KEYS: ArmingSwitchStatus[] = [
  "safe",
  "open",
  "armed",
  "running",
  "done",
  "failed",
];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

interface SpringState {
  x: number;
  v: number;
  target: number;
}

function stepSpring(
  s: SpringState,
  k: number,
  d: number,
  dt: number,
): boolean {
  const f = (s.target - s.x) * k - s.v * d;
  s.v += f * dt;
  s.x += s.v * dt;
  if (Math.abs(s.target - s.x) < 0.0004 && Math.abs(s.v) < 0.0004) {
    s.x = s.target;
    s.v = 0;
    return false;
  }
  return true;
}

interface PhysicsEngine {
  cover: SpringState; // 0 = closed, 1 = open (rotates 0 -> 114deg)
  lever: SpringState; // 0 = safe (-122deg), 1 = armed (-58deg)
  tiltX: SpringState; // -1..1
  tiltY: SpringState; // -1..1
  joltX: SpringState; // cqw
  joltY: SpringState; // cqw
  wobble: SpringState; // deg Z wobble on cover
  lensPress: SpringState; // 0..1
  holdProgress: number; // 0..1
  holding: boolean;
  spinAngle: number; // deg
  amberLevel: number;
  greenLevel: number;
  redLevel: number;
  flickerTimer: number;
  failBlinkTimer: number;
  sweepTimer: number;
  burstAccent: number;
  burstGreen: number;
  burstRed: number;
  coverHover: boolean;
  draggingCover: boolean;
  draggingLever: boolean;
  dragStartY: number;
  dragStartVal: number;
  dragMoved: boolean;
  lastPointerY: number;
  lastPointerT: number;
  dragVel: number;
  running: boolean;
  done: boolean;
  failed: boolean;
  open: boolean;
  armed: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  offscreen: boolean;
  hasInteracted: boolean;
  introPlayed: boolean;
}

export function ArmingSwitch({
  title = "Deploy to production",
  description = "api-gateway v2.14.0 to eu-west-1 and us-east-1",
  armLabel = "Arm",
  safeLabel = "Safe",
  holdLabel = "Hold to deploy",
  readyLabel = "Ready",
  statusLabels,
  hints,
  holdDuration = 1200,
  onConfirm,
  autoSafe = true,
  disabled = false,
  haptics = true,
  accent,
  coverColor,
  onStatusChange,
  onCoverChange,
  onArmChange,
  label,
  className,
  style,
}: ArmingSwitchProps) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  const clampedHoldMs = clamp(holdDuration, 300, 6000);

  const mergedStatusLabels = useMemo(
    () => ({ ...DEFAULT_STATUS_LABELS, ...statusLabels }),
    [statusLabels],
  );
  const mergedHints = useMemo(() => ({ ...DEFAULT_HINTS, ...hints }), [hints]);

  const [status, setStatus] = useState<ArmingSwitchStatus>("safe");
  const [coverOpen, setCoverOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [notice, setNotice] = useState<string>("");
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const rootRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const streaksRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const spillAmberRef = useRef<HTMLSpanElement>(null);
  const spillGreenRef = useRef<HTMLSpanElement>(null);
  const spillRedRef = useRef<HTMLSpanElement>(null);
  const coverShadowRef = useRef<HTMLSpanElement>(null);
  const coverContactRef = useRef<HTMLSpanElement>(null);
  const leverShadowRef = useRef<HTMLSpanElement>(null);
  const ringFillRef = useRef<SVGCircleElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const litAmberRef = useRef<HTMLSpanElement>(null);
  const litGreenRef = useRef<HTMLSpanElement>(null);
  const litRedRef = useRef<HTMLSpanElement>(null);
  const bloomsRef = useRef<HTMLSpanElement>(null);
  const bloomAmberRef = useRef<HTMLSpanElement>(null);
  const bloomGreenRef = useRef<HTMLSpanElement>(null);
  const bloomRedRef = useRef<HTMLSpanElement>(null);
  const burstAccentRef = useRef<HTMLSpanElement>(null);
  const burstGreenRef = useRef<HTMLSpanElement>(null);
  const burstRedRef = useRef<HTMLSpanElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);
  const leverRef = useRef<HTMLSpanElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);
  const ballSpecRef = useRef<HTMLSpanElement>(null);
  const coverRef = useRef<HTMLSpanElement>(null);
  const grazeRef = useRef<HTMLSpanElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);

  const noticeTimerRef = useRef<number | null>(null);
  const autoSafeTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const callbacksRef = useRef({
    onConfirm,
    onStatusChange,
    onCoverChange,
    onArmChange,
    autoSafe,
    clampedHoldMs,
    haptics,
    mergedStatusLabels,
    mergedHints,
  });

  useEffect(() => {
    callbacksRef.current = {
      onConfirm,
      onStatusChange,
      onCoverChange,
      onArmChange,
      autoSafe,
      clampedHoldMs,
      haptics,
      mergedStatusLabels,
      mergedHints,
    };
  });

  const engineRef = useRef<PhysicsEngine>({
    cover: { x: 0, v: 0, target: 0 },
    lever: { x: 0, v: 0, target: 0 },
    tiltX: { x: 0, v: 0, target: 0 },
    tiltY: { x: 0, v: 0, target: 0 },
    joltX: { x: 0, v: 0, target: 0 },
    joltY: { x: 0, v: 0, target: 0 },
    wobble: { x: 0, v: 0, target: 0 },
    lensPress: { x: 0, v: 0, target: 0 },
    holdProgress: 0,
    holding: false,
    spinAngle: 0,
    amberLevel: 0,
    greenLevel: 0,
    redLevel: 0,
    flickerTimer: 0,
    failBlinkTimer: 0,
    sweepTimer: 0,
    burstAccent: 0,
    burstGreen: 0,
    burstRed: 0,
    coverHover: false,
    draggingCover: false,
    draggingLever: false,
    dragStartY: 0,
    dragStartVal: 0,
    dragMoved: false,
    lastPointerY: 0,
    lastPointerT: 0,
    dragVel: 0,
    running: false,
    done: false,
    failed: false,
    open: false,
    armed: false,
    disabled: false,
    reducedMotion: false,
    offscreen: false,
    hasInteracted: false,
    introPlayed: false,
  });

  const statusRef = useRef<ArmingSwitchStatus>("safe");

  const buzz = useCallback((pattern: number | number[]) => {
    const e = engineRef.current;
    if (!callbacksRef.current.haptics || !e.hasInteracted) return;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore unsupported environments
      }
    }
  }, []);

  const flashNotice = useCallback((text: string) => {
    setNotice(text);
    setLiveAnnouncement(text);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimerRef.current = null;
    }, 2400);
  }, []);

  const updateStatus = useCallback((next: ArmingSwitchStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
    const { onStatusChange: cb, mergedStatusLabels: sl, mergedHints: hl } =
      callbacksRef.current;
    setLiveAnnouncement(`${sl[next]}. ${hl[next]}`);
    cb?.(next);
  }, []);

  const startLoopRef = useRef<() => void>(() => {});

  const wakeLoop = useCallback(() => {
    startLoopRef.current();
  }, []);

  const renderDOM = useCallback(() => {
    const e = engineRef.current;
    const coverNorm = e.cover.x;
    const coverDeg = clamp(coverNorm, -0.05, 1.18) * 114;
    const leverNorm = clamp(e.lever.x, -0.1, 1.1);
    const leverDeg = -122 + leverNorm * 64; // -122deg (safe/down) to -58deg (armed/up)

    // Panel tilt + jolt
    const rotX = e.reducedMotion ? 6 : 6 - e.tiltY.x * 4.5;
    const rotY = e.reducedMotion ? -6 : -6 + e.tiltX.x * 4.5;
    const jx = e.reducedMotion ? 0 : e.joltX.x;
    const jy = e.reducedMotion ? 0 : e.joltY.x;

    if (rigRef.current) {
      rigRef.current.style.transform = `translate3d(${jx.toFixed(3)}cqw, ${jy.toFixed(3)}cqw, 0px) rotateX(${rotX.toFixed(3)}deg) rotateY(${rotY.toFixed(3)}deg)`;
    }

    if (plateRef.current) {
      const lx = e.reducedMotion ? 0 : e.tiltX.x;
      const ly = e.reducedMotion ? 0 : e.tiltY.x;
      plateRef.current.style.setProperty("--as-lx", lx.toFixed(3));
      plateRef.current.style.setProperty("--as-ly", ly.toFixed(3));
    }

    if (streaksRef.current) {
      const sx = e.reducedMotion ? 0 : e.tiltX.x * 5.5;
      streaksRef.current.style.transform = `translate3d(${sx.toFixed(2)}cqw, 0px, 0px)`;
    }

    if (glowRef.current) {
      const gx = e.reducedMotion ? 0 : e.tiltX.x * 4;
      const gy = e.reducedMotion ? 0 : e.tiltY.x * 3;
      glowRef.current.style.transform = `translate3d(${gx.toFixed(2)}cqw, ${gy.toFixed(2)}cqw, 0px)`;
    }

    // Cover 3D transform
    if (coverRef.current) {
      const wob = e.reducedMotion ? 0 : e.wobble.x;
      coverRef.current.style.transform = `rotateX(${coverDeg.toFixed(2)}deg) rotateZ(${wob.toFixed(3)}deg)`;
    }

    // Cover glare & graze
    if (glareRef.current) {
      const glareY = -56 + clamp(coverNorm, 0, 1.1) * 118;
      const glareOp = clamp(0.42 + Math.sin(clamp(coverNorm, 0, 1) * Math.PI) * 0.45, 0, 0.9);
      glareRef.current.style.transform = `translate3d(0px, ${glareY.toFixed(1)}%, 0px)`;
      glareRef.current.style.opacity = glareOp.toFixed(3);
    }

    if (grazeRef.current) {
      const grazeOp = clamp(Math.sin(clamp(coverNorm, 0, 1) * Math.PI) * 0.34, 0, 0.4);
      grazeRef.current.style.opacity = grazeOp.toFixed(3);
    }

    // Cover shadows
    if (coverShadowRef.current) {
      const c = clamp(coverNorm, 0, 1.15);
      const sy = Math.max(0.14, 1.015 - c * 0.78);
      const ty = 16.2 - c * 14.5;
      const tx = 2.88 - c * 1.4;
      const op = clamp(0.806 * (1 - c * 0.65), 0.08, 0.85);
      coverShadowRef.current.style.transform = `translate3d(${tx.toFixed(2)}cqw, ${ty.toFixed(2)}cqw, 0px) scaleY(${sy.toFixed(3)})`;
      coverShadowRef.current.style.opacity = op.toFixed(3);
    }

    if (coverContactRef.current) {
      const contactOp = clamp(1 - coverNorm * 4.5, 0, 1);
      coverContactRef.current.style.opacity = contactOp.toFixed(3);
    }

    // Lever 3D transform
    if (leverRef.current) {
      leverRef.current.style.transform = `translateZ(1.6cqw) rotateX(${leverDeg.toFixed(2)}deg)`;
    }

    if (ballRef.current) {
      ballRef.current.style.transform = `rotateX(${(-leverDeg).toFixed(2)}deg)`;
    }

    if (bandRef.current) {
      const bandY = -17 + leverNorm * 34;
      bandRef.current.style.transform = `translate3d(0px, ${bandY.toFixed(2)}%, 0px)`;
    }

    if (ballSpecRef.current) {
      const specX = e.reducedMotion ? 0 : -e.tiltX.x * 0.5;
      const specY = 0.3 - leverNorm * 0.55 + (e.reducedMotion ? 0 : e.tiltY.x * 0.35);
      ballSpecRef.current.style.transform = `translate3d(${specX.toFixed(2)}cqw, ${specY.toFixed(2)}cqw, 0px)`;
    }

    if (leverShadowRef.current) {
      const angle = 78 - leverNorm * 142; // swings from down-right to up-right
      const scaleX = 1.13 - Math.sin(clamp(leverNorm, 0, 1) * Math.PI) * 0.45;
      leverShadowRef.current.style.transform = `translate3d(32cqw, 34cqw, 0px) rotate(${angle.toFixed(2)}deg) scaleX(${scaleX.toFixed(4)})`;
    }

    // Lamp lens depression
    if (lensRef.current) {
      const scale = 1 - e.lensPress.x * 0.065;
      lensRef.current.style.transform = `scale(${scale.toFixed(4)})`;
    }

    // Lamp brightness / flicker / colors
    let amber = e.amberLevel;
    if (e.flickerTimer > 0 && !e.reducedMotion) {
      const t = 1 - e.flickerTimer / 0.36;
      if (t < 0.18) amber *= 0.9;
      else if (t < 0.32) amber *= 0.22;
      else if (t < 0.52) amber *= 1.0;
      else if (t < 0.66) amber *= 0.42;
      else amber *= 1.0;
    }
    if (e.holding && e.armed) {
      amber = clamp(amber + e.holdProgress * 0.3, 0, 1.25);
    }

    let red = e.redLevel;
    if (e.failBlinkTimer > 0 && !e.reducedMotion) {
      const blink = Math.sin((e.failBlinkTimer / 0.55) * Math.PI * 5) > 0 ? 1 : 0.25;
      red *= blink;
    }

    const green = e.greenLevel;
    const totalGlow = clamp(amber + green + red, 0, 1.2);

    if (litAmberRef.current) litAmberRef.current.style.opacity = clamp(amber, 0, 1).toFixed(3);
    if (litGreenRef.current) litGreenRef.current.style.opacity = clamp(green, 0, 1).toFixed(3);
    if (litRedRef.current) litRedRef.current.style.opacity = clamp(red, 0, 1).toFixed(3);

    if (bloomAmberRef.current) bloomAmberRef.current.style.opacity = clamp(amber, 0, 1).toFixed(3);
    if (bloomGreenRef.current) bloomGreenRef.current.style.opacity = clamp(green, 0, 1).toFixed(3);
    if (bloomRedRef.current) bloomRedRef.current.style.opacity = clamp(red, 0, 1).toFixed(3);

    if (spillAmberRef.current) spillAmberRef.current.style.opacity = clamp(amber, 0, 1).toFixed(3);
    if (spillGreenRef.current) spillGreenRef.current.style.opacity = clamp(green, 0, 1).toFixed(3);
    if (spillRedRef.current) spillRedRef.current.style.opacity = clamp(red, 0, 1).toFixed(3);

    if (bloomsRef.current) {
      const bScale = 0.84 + totalGlow * 0.22 + (e.holding ? e.holdProgress * 0.14 : 0);
      bloomsRef.current.style.transform = `scale(${bScale.toFixed(3)})`;
    }

    // Ring fill & leading dot
    const showRing = e.holdProgress > 0.002 && !e.running;
    if (ringFillRef.current) {
      ringFillRef.current.style.opacity = showRing ? "1" : "0";
      ringFillRef.current.setAttribute("stroke-dashoffset", (1 - clamp(e.holdProgress, 0, 1)).toFixed(4));
    }

    if (headRef.current) {
      const showHead = showRing && e.holdProgress > 0.01 && e.holdProgress < 0.995 && !e.done && !e.failed;
      headRef.current.style.opacity = showHead ? "1" : "0";
      headRef.current.style.transform = `rotate(${(clamp(e.holdProgress, 0, 1) * 360).toFixed(2)}deg)`;
    }

    // Running spinner arc
    if (spinRef.current) {
      spinRef.current.style.opacity = e.running ? "1" : "0";
      spinRef.current.style.transform = `rotate(${e.spinAngle.toFixed(2)}deg)`;
    }

    // Shockwave bursts
    const applyBurst = (el: HTMLSpanElement | null, p: number, maxScale: number) => {
      if (!el) return;
      if (p <= 0 || e.reducedMotion) {
        el.style.opacity = "0";
        return;
      }
      const ease = 1 - Math.pow(1 - p, 3);
      const scale = 0.72 + ease * maxScale;
      const op = (1 - ease) * 0.85;
      el.style.transform = `scale(${scale.toFixed(3)})`;
      el.style.opacity = op.toFixed(3);
    };
    applyBurst(burstAccentRef.current, e.burstAccent, 0.85);
    applyBurst(burstGreenRef.current, e.burstGreen, 1.15);
    applyBurst(burstRedRef.current, e.burstRed, 0.75);

    // Metallic sweep glint
    if (sweepRef.current) {
      if (e.sweepTimer <= 0 || e.reducedMotion) {
        sweepRef.current.style.opacity = "0";
      } else {
        const p = 1 - e.sweepTimer / 0.7;
        const x = -36 + p * 156;
        const op = Math.sin(p * Math.PI) * 0.92;
        sweepRef.current.style.transform = `translate3d(${x.toFixed(2)}cqw, 0px, 0px)`;
        sweepRef.current.style.opacity = op.toFixed(3);
      }
    }
  }, []);

  const triggerConfirm = useCallback(async () => {
    const e = engineRef.current;
    if (e.running || !e.armed) return;

    e.holding = false;
    e.lensPress.target = 0;
    setHolding(false);
    e.burstAccent = 0.001;
    e.joltY.v += 4.5;
    buzz(22);

    const fn = callbacksRef.current.onConfirm;
    let res: void | boolean | Promise<void | boolean> = undefined;
    let failed = false;

    try {
      res = fn ? fn() : true;
    } catch {
      failed = true;
    }

    if (!failed && res && typeof (res as Promise<void | boolean>).then === "function") {
      e.running = true;
      e.done = false;
      e.failed = false;
      updateStatus("running");
      wakeLoop();
      try {
        const resolved = await res;
        failed = resolved === false;
      } catch {
        failed = true;
      }
      e.running = false;
    } else if (!failed) {
      failed = res === false;
    }

    if (failed) {
      e.failed = true;
      e.done = false;
      e.failBlinkTimer = 0.55;
      e.burstRed = 0.001;
      e.joltX.v += 11;
      buzz([25, 45, 25]);
      updateStatus("failed");
    } else {
      e.done = true;
      e.failed = false;
      e.holdProgress = 1;
      e.burstGreen = 0.001;
      e.sweepTimer = 0.7;
      e.joltY.v += 3;
      buzz([14, 30, 24]);
      updateStatus("done");

      if (callbacksRef.current.autoSafe) {
        if (autoSafeTimerRef.current !== null) {
          window.clearTimeout(autoSafeTimerRef.current);
        }
        autoSafeTimerRef.current = window.setTimeout(() => {
          autoSafeTimerRef.current = null;
          const eng = engineRef.current;
          if (!eng.open || eng.running) return;
          eng.open = false;
          eng.cover.target = 0;
          setCoverOpen(false);
          callbacksRef.current.onCoverChange?.(false);
          if (eng.armed) {
            eng.armed = false;
            eng.lever.target = 0;
            setArmed(false);
            callbacksRef.current.onArmChange?.(false);
          }
          eng.wobble.v += 3.5;
          eng.joltY.v += 3.2;
          wakeLoop();
        }, 720);
      }
    }
    wakeLoop();
  }, [buzz, updateStatus, wakeLoop]);

  const setCoverState = useCallback(
    (nextOpen: boolean, initialVel = 0) => {
      const e = engineRef.current;
      if (e.disabled) {
        e.cover.v += 2.2;
        e.wobble.v += 4;
        buzz(10);
        flashNotice("This switch is locked.");
        wakeLoop();
        return;
      }
      if (e.running) return;

      if (autoSafeTimerRef.current !== null) {
        window.clearTimeout(autoSafeTimerRef.current);
        autoSafeTimerRef.current = null;
      }

      const prevOpen = e.open;
      e.open = nextOpen;
      e.cover.target = nextOpen ? 1 : 0;
      if (initialVel !== 0) e.cover.v = initialVel;

      if (nextOpen) {
        if (e.done || e.failed) {
          e.done = false;
          e.failed = false;
          e.holdProgress = 0;
        }
        e.joltY.v -= 2.2;
        buzz(12);
        setCoverOpen(true);
        if (!prevOpen) callbacksRef.current.onCoverChange?.(true);
        updateStatus(e.armed ? "armed" : "open");
      } else {
        // Closing cover forces armed switch back to safe
        if (e.holding) {
          e.holding = false;
          e.lensPress.target = 0;
          setHolding(false);
        }
        if (e.armed) {
          e.armed = false;
          e.lever.target = 0;
          setArmed(false);
          callbacksRef.current.onArmChange?.(false);
        }
        e.failed = false;
        e.holdProgress = 0;
        e.wobble.v += 4.2;
        e.joltY.v += 3.5;
        buzz(16);
        setCoverOpen(false);
        if (prevOpen) callbacksRef.current.onCoverChange?.(false);
        if (!e.done) updateStatus("safe");
      }
      wakeLoop();
    },
    [buzz, flashNotice, updateStatus, wakeLoop],
  );

  const setArmState = useCallback(
    (nextArmed: boolean, initialVel = 0) => {
      const e = engineRef.current;
      if (e.disabled) {
        e.cover.v += 2;
        buzz(10);
        flashNotice("This switch is locked.");
        wakeLoop();
        return;
      }
      if (e.running) return;

      if (!e.open && nextArmed) {
        // Knock the closed lid
        e.cover.v += 3.4;
        e.wobble.v += 5;
        e.joltY.v -= 1.8;
        buzz(12);
        flashNotice("Lift the safety cover first.");
        wakeLoop();
        return;
      }

      const prevArmed = e.armed;
      e.armed = nextArmed;
      e.lever.target = nextArmed ? 1 : 0;
      if (initialVel !== 0) e.lever.v = initialVel;

      if (nextArmed) {
        e.done = false;
        e.failed = false;
        e.holdProgress = 0;
        e.flickerTimer = 0.36;
        e.joltY.v -= 2.8;
        buzz(18);
        setArmed(true);
        if (!prevArmed) callbacksRef.current.onArmChange?.(true);
        updateStatus("armed");
      } else {
        if (e.holding) {
          e.holding = false;
          e.lensPress.target = 0;
          setHolding(false);
        }
        e.failed = false;
        e.joltY.v += 2.2;
        buzz(12);
        setArmed(false);
        if (prevArmed) callbacksRef.current.onArmChange?.(false);
        updateStatus(e.open ? "open" : "safe");
      }
      wakeLoop();
    },
    [buzz, flashNotice, updateStatus, wakeLoop],
  );

  const beginHold = useCallback(() => {
    const e = engineRef.current;
    e.hasInteracted = true;
    if (e.disabled) {
      e.cover.v += 2;
      buzz(10);
      flashNotice("This switch is locked.");
      wakeLoop();
      return;
    }
    if (e.running) return;
    if (!e.open) {
      e.cover.v += 3;
      e.wobble.v += 4;
      buzz(10);
      flashNotice("Lift the safety cover first.");
      wakeLoop();
      return;
    }
    if (!e.armed) {
      e.lever.v += 2.2;
      buzz(10);
      flashNotice("Arm the switch first.");
      wakeLoop();
      return;
    }
    if (e.failed) {
      e.failed = false;
      e.holdProgress = 0;
      updateStatus("armed");
    }
    e.holding = true;
    e.lensPress.target = 1;
    setHolding(true);
    buzz(8);
    wakeLoop();
  }, [buzz, flashNotice, updateStatus, wakeLoop]);

  const endHold = useCallback(() => {
    const e = engineRef.current;
    if (!e.holding) return;
    e.holding = false;
    e.lensPress.target = 0;
    setHolding(false);
    wakeLoop();
  }, [wakeLoop]);

  // 240Hz spring physics loop
  useEffect(() => {
    const startLoop = () => {
      if (rafRef.current !== null) return;
      lastTimeRef.current = performance.now();

      const tick = (now: number) => {
        const e = engineRef.current;
        if (e.offscreen || document.hidden) {
          rafRef.current = null;
          return;
        }

        const rawDt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = now;

        const subSteps = Math.max(1, Math.round(rawDt * 240));
        const dt = rawDt / subSteps;

        let active = false;

        if (e.reducedMotion) {
          e.cover.x = e.cover.target;
          e.cover.v = 0;
          e.lever.x = e.lever.target;
          e.lever.v = 0;
          e.tiltX.x = 0;
          e.tiltY.x = 0;
          e.joltX.x = 0;
          e.joltY.x = 0;
          e.wobble.x = 0;
          e.lensPress.x = e.lensPress.target;
          e.flickerTimer = 0;
          e.failBlinkTimer = 0;
          e.sweepTimer = 0;
          e.burstAccent = 0;
          e.burstGreen = 0;
          e.burstRed = 0;
        } else {
          for (let i = 0; i < subSteps; i++) {
            if (!e.draggingCover) {
              const target = e.open ? 1 : e.coverHover && !e.disabled ? 0.055 : 0;
              e.cover.target = target;
              if (stepSpring(e.cover, target === 0 ? 320 : 250, target === 0 ? 22 : 19, dt)) {
                active = true;
              }
              if (e.cover.x < 0 && e.cover.v < 0) {
                e.cover.x = 0;
                e.cover.v = -e.cover.v * 0.24;
                if (Math.abs(e.cover.v) < 0.08) e.cover.v = 0;
              }
            }

            if (!e.draggingLever) {
              if (stepSpring(e.lever, 460, 25, dt)) active = true;
            }

            if (stepSpring(e.tiltX, 90, 14, dt)) active = true;
            if (stepSpring(e.tiltY, 90, 14, dt)) active = true;
            if (stepSpring(e.joltX, 340, 16, dt)) active = true;
            if (stepSpring(e.joltY, 340, 18, dt)) active = true;
            if (stepSpring(e.wobble, 280, 12, dt)) active = true;
            if (stepSpring(e.lensPress, 500, 30, dt)) active = true;
          }
        }

        // Hold ring fill / drain
        if (e.holding && e.armed && !e.running) {
          active = true;
          e.holdProgress = clamp(
            e.holdProgress + rawDt / (callbacksRef.current.clampedHoldMs / 1000),
            0,
            1,
          );
          if (e.holdProgress >= 1) {
            e.holdProgress = 1;
            void triggerConfirm();
          }
        } else if (!e.holding && !e.running && !e.done && e.holdProgress > 0) {
          active = true;
          const drainRate = e.failed ? 1.8 : 2.2;
          e.holdProgress = Math.max(0, e.holdProgress - rawDt * drainRate);
        }

        // Lamp color levels
        const targetAmber = (e.armed || e.running) && !e.done && !e.failed ? 1 : 0;
        const targetGreen = e.done ? 1 : 0;
        const targetRed = e.failed ? 1 : 0;
        const lerpRate = Math.min(1, rawDt * 12);

        if (Math.abs(e.amberLevel - targetAmber) > 0.002) {
          e.amberLevel += (targetAmber - e.amberLevel) * lerpRate;
          active = true;
        } else {
          e.amberLevel = targetAmber;
        }
        if (Math.abs(e.greenLevel - targetGreen) > 0.002) {
          e.greenLevel += (targetGreen - e.greenLevel) * lerpRate;
          active = true;
        } else {
          e.greenLevel = targetGreen;
        }
        if (Math.abs(e.redLevel - targetRed) > 0.002) {
          e.redLevel += (targetRed - e.redLevel) * lerpRate;
          active = true;
        } else {
          e.redLevel = targetRed;
        }

        // Running spinner
        if (e.running) {
          e.spinAngle = (e.spinAngle + rawDt * 340) % 360;
          active = true;
        }

        // Timers & bursts
        if (e.flickerTimer > 0) {
          e.flickerTimer = Math.max(0, e.flickerTimer - rawDt);
          active = true;
        }
        if (e.failBlinkTimer > 0) {
          e.failBlinkTimer = Math.max(0, e.failBlinkTimer - rawDt);
          active = true;
        }
        if (e.sweepTimer > 0) {
          e.sweepTimer = Math.max(0, e.sweepTimer - rawDt);
          active = true;
        }
        const stepBurst = (val: number, dur: number) => {
          if (val <= 0) return 0;
          const next = val + rawDt / dur;
          active = true;
          return next >= 1 ? 0 : next;
        };
        e.burstAccent = stepBurst(e.burstAccent, 0.45);
        e.burstGreen = stepBurst(e.burstGreen, 0.58);
        e.burstRed = stepBurst(e.burstRed, 0.45);

        renderDOM();

        if (active || e.draggingCover || e.draggingLever) {
          rafRef.current = window.requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = window.requestAnimationFrame(tick);
    };

    startLoopRef.current = startLoop;

    // Initial render
    renderDOM();

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      if (autoSafeTimerRef.current !== null) {
        window.clearTimeout(autoSafeTimerRef.current);
      }
    };
  }, [renderDOM, triggerConfirm]);

  // Sync disabled & reduced motion
  useEffect(() => {
    engineRef.current.disabled = disabled;
    if (disabled && engineRef.current.holding) {
      engineRef.current.holding = false;
      engineRef.current.lensPress.target = 0;
      setHolding(false);
    }
  }, [disabled]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      engineRef.current.reducedMotion = mq.matches;
      renderDOM();
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [renderDOM]);

  // IntersectionObserver: pause offscreen + intro hop on first sight
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        engineRef.current.offscreen = !visible;
        setOffscreen(!visible);
        if (visible) {
          if (!engineRef.current.introPlayed && !engineRef.current.reducedMotion) {
            engineRef.current.introPlayed = true;
            engineRef.current.cover.v = 1.6;
            engineRef.current.wobble.v = 1.2;
          }
          wakeLoop();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wakeLoop]);

  // Pointer tilt on stage
  const onStagePointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLDivElement>) => {
      if (engineRef.current.reducedMotion) return;
      const box = stageBoxRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      const nx = clamp(((ev.clientX - box.left) / box.width) * 2 - 1, -1, 1);
      const ny = clamp(((ev.clientY - box.top) / box.height) * 2 - 1, -1, 1);
      engineRef.current.tiltX.target = nx;
      engineRef.current.tiltY.target = ny;
      wakeLoop();
    },
    [wakeLoop],
  );

  const onStagePointerLeave = useCallback(() => {
    engineRef.current.tiltX.target = 0;
    engineRef.current.tiltY.target = 0;
    wakeLoop();
  }, [wakeLoop]);

  // Cover drag & tap
  const onCoverPointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>) => {
      if (ev.button !== 0) return;
      const e = engineRef.current;
      e.hasInteracted = true;
      if (e.disabled) {
        setCoverState(!e.open);
        return;
      }
      if (e.running) return;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      e.draggingCover = true;
      e.dragStartY = ev.clientY;
      e.dragStartVal = e.cover.x;
      e.dragMoved = false;
      e.lastPointerY = ev.clientY;
      e.lastPointerT = performance.now();
      e.dragVel = 0;
      setDragging(true);
      wakeLoop();
    },
    [setCoverState, wakeLoop],
  );

  const onCoverPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>) => {
      const e = engineRef.current;
      if (!e.draggingCover) return;
      const box = stageBoxRef.current?.getBoundingClientRect();
      const travel = Math.max(70, (box?.width ?? 400) * 0.34);
      const dy = e.dragStartY - ev.clientY;
      if (Math.abs(dy) > 5) e.dragMoved = true;

      let next = e.dragStartVal + dy / travel;
      if (next > 1) next = 1 + (next - 1) * 0.28;
      if (next < 0) next = next * 0.15;
      e.cover.x = clamp(next, -0.05, 1.18);

      const now = performance.now();
      const dt = Math.max(0.004, (now - e.lastPointerT) / 1000);
      e.dragVel = ((e.lastPointerY - ev.clientY) / travel) / dt;
      e.lastPointerY = ev.clientY;
      e.lastPointerT = now;
      wakeLoop();
    },
    [wakeLoop],
  );

  const onCoverPointerUp = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>) => {
      const e = engineRef.current;
      if (!e.draggingCover) return;
      e.draggingCover = false;
      setDragging(false);
      if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      }
      if (!e.dragMoved) {
        setCoverState(!e.open);
      } else {
        const shouldOpen = e.cover.x + e.dragVel * 0.08 > 0.48;
        setCoverState(shouldOpen, clamp(e.dragVel * 0.45, -8, 8));
      }
    },
    [setCoverState],
  );

  // Lever drag & tap
  const onLeverPointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>) => {
      if (ev.button !== 0) return;
      const e = engineRef.current;
      e.hasInteracted = true;
      if (e.disabled || !e.open) {
        setArmState(!e.armed);
        return;
      }
      if (e.running) return;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      e.draggingLever = true;
      e.dragStartY = ev.clientY;
      e.dragStartVal = e.lever.x;
      e.dragMoved = false;
      e.lastPointerY = ev.clientY;
      e.lastPointerT = performance.now();
      e.dragVel = 0;
      setDragging(true);
      wakeLoop();
    },
    [setArmState, wakeLoop],
  );

  const onLeverPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>) => {
      const e = engineRef.current;
      if (!e.draggingLever) return;
      const box = stageBoxRef.current?.getBoundingClientRect();
      const travel = Math.max(44, (box?.width ?? 400) * 0.18);
      const dy = e.dragStartY - ev.clientY;
      if (Math.abs(dy) > 4) e.dragMoved = true;

      const next = clamp(e.dragStartVal + dy / travel, 0, 1);
      e.lever.x = next;

      const now = performance.now();
      const dt = Math.max(0.004, (now - e.lastPointerT) / 1000);
      e.dragVel = ((e.lastPointerY - ev.clientY) / travel) / dt;
      e.lastPointerY = ev.clientY;
      e.lastPointerT = now;

      // Over-center snap out of your hand once past center
      if (!e.armed && next >= 0.56) {
        e.draggingLever = false;
        setDragging(false);
        if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
          ev.currentTarget.releasePointerCapture(ev.pointerId);
        }
        setArmState(true, Math.max(5, e.dragVel * 0.5));
      } else if (e.armed && next <= 0.44) {
        e.draggingLever = false;
        setDragging(false);
        if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
          ev.currentTarget.releasePointerCapture(ev.pointerId);
        }
        setArmState(false, Math.min(-5, e.dragVel * 0.5));
      } else {
        wakeLoop();
      }
    },
    [setArmState, wakeLoop],
  );

  const onLeverPointerUp = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>) => {
      const e = engineRef.current;
      if (!e.draggingLever) return;
      e.draggingLever = false;
      setDragging(false);
      if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      }
      if (!e.dragMoved) {
        setArmState(!e.armed);
      } else {
        const shouldArm = e.lever.x > 0.5;
        setArmState(shouldArm, clamp(e.dragVel * 0.4, -6, 6));
      }
    },
    [setArmState],
  );

  // Keyboard handlers
  const onRootKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      if (ev.key === "Escape") {
        const e = engineRef.current;
        if (e.running) return;
        ev.preventDefault();
        endHold();
        if (e.open || e.armed) {
          setCoverState(false);
        }
      }
    },
    [endHold, setCoverState],
  );

  const onCoverKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        engineRef.current.hasInteracted = true;
        setCoverState(true);
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        engineRef.current.hasInteracted = true;
        setCoverState(false);
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        engineRef.current.hasInteracted = true;
        setCoverState(!engineRef.current.open);
      }
    },
    [setCoverState],
  );

  const onLeverKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        engineRef.current.hasInteracted = true;
        setArmState(true);
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        engineRef.current.hasInteracted = true;
        setArmState(false);
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        engineRef.current.hasInteracted = true;
        setArmState(!engineRef.current.armed);
      }
    },
    [setArmState],
  );

  const onLampKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (!ev.repeat) beginHold();
      }
    },
    [beginHold],
  );

  const onLampKeyUp = useCallback(
    (ev: KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        endHold();
      }
    },
    [endHold],
  );

  const rootStyle: CSSProperties = {
    ...style,
    ...(accent ? ({ "--as-accent": accent } as CSSProperties) : {}),
    ...(coverColor ? ({ "--as-cover": coverColor } as CSSProperties) : {}),
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label ?? title}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={rootStyle}
      data-status={status}
      data-open={coverOpen ? "" : undefined}
      data-armed={armed ? "" : undefined}
      data-holding={holding ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-offscreen={offscreen ? "" : undefined}
      onKeyDown={onRootKeyDown}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <h3 className={styles.title}>{title}</h3>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>

          <span className={styles.status} data-status={status}>
            <span className={styles.statusIcons} aria-hidden="true">
              <span
                className={styles.statusIcon}
                data-key="safe"
                data-active={status === "safe" ? "" : undefined}
              >
                <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className={styles.statusIcon}
                data-key="open"
                data-active={status === "open" ? "" : undefined}
              >
                <ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className={styles.statusIcon}
                data-key="armed"
                data-active={status === "armed" ? "" : undefined}
              >
                <Zap size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className={styles.statusIcon}
                data-key="running"
                data-active={status === "running" ? "" : undefined}
              >
                <Loader2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className={styles.statusIcon}
                data-key="done"
                data-active={status === "done" ? "" : undefined}
              >
                <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className={styles.statusIcon}
                data-key="failed"
                data-active={status === "failed" ? "" : undefined}
              >
                <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </span>
            <span className={styles.statusLabels}>
              {STATUS_KEYS.map((key) => (
                <span
                  key={key}
                  className={styles.statusLabel}
                  data-active={status === key ? "" : undefined}
                  aria-hidden={status === key ? undefined : true}
                >
                  {mergedStatusLabels[key]}
                </span>
              ))}
            </span>
          </span>
        </header>

        <div className={styles.stageWrap}>
          <div
            ref={stageBoxRef}
            className={styles.stageBox}
            onPointerMove={onStagePointerMove}
            onPointerLeave={onStagePointerLeave}
          >
            <div className={styles.stage}>
              <div ref={rigRef} className={styles.rig}>
                <div ref={plateRef} className={styles.plate} aria-hidden="true">
                  <span className={styles.brush} />
                  <span className={styles.drift}>
                    <span ref={streaksRef} className={styles.streaks}>
                      <span className={styles.streak} />
                      <span className={styles.streakFaint} />
                    </span>
                  </span>
                  <span ref={glowRef} className={styles.glow} />
                  <span ref={spillAmberRef} className={styles.spill} data-hue="amber" />
                  <span ref={spillGreenRef} className={styles.spill} data-hue="green" />
                  <span ref={spillRedRef} className={styles.spill} data-hue="red" />
                  <span className={styles.base} />
                  <span className={styles.barrelShadow} />
                  <span className={styles.ear} data-side="left" />
                  <span className={styles.ear} data-side="right" />
                  <span className={styles.caustic}>
                    <span ref={coverShadowRef} className={styles.coverShadow} />
                  </span>
                  <span ref={coverContactRef} className={styles.coverContact} />
                  <span ref={leverShadowRef} className={styles.leverShadow} />
                  <span className={styles.engrave} data-at="arm">
                    {armLabel}
                  </span>
                  <span className={styles.tick} data-at="arm" />
                  <span className={styles.engrave} data-at="safe">
                    {safeLabel}
                  </span>
                  <span className={styles.tick} data-at="safe" />
                  <span className={styles.led} />
                  <span className={styles.engrave} data-at="ready">
                    {readyLabel}
                  </span>
                  <span className={styles.engrave} data-at="hold">
                    {holdLabel}
                  </span>
                  <span
                    className={styles.screw}
                    style={{ left: "5cqw", top: "5cqw", ["--r" as string]: "14deg" }}
                  >
                    <i />
                  </span>
                  <span
                    className={styles.screw}
                    style={{ left: "95cqw", top: "5cqw", ["--r" as string]: "71deg" }}
                  >
                    <i />
                  </span>
                  <span
                    className={styles.screw}
                    style={{ left: "5cqw", top: "57cqw", ["--r" as string]: "43deg" }}
                  >
                    <i />
                  </span>
                  <span
                    className={styles.screw}
                    style={{ left: "95cqw", top: "57cqw", ["--r" as string]: "104deg" }}
                  >
                    <i />
                  </span>

                  <span className={styles.lamp}>
                    <svg className={styles.ring} viewBox="0 0 100 100" focusable="false">
                      <circle cx="50" cy="50" r="46" className={styles.ringTrack} />
                      <circle cx="50" cy="50" r="46" className={styles.ringTrackHi} />
                      <circle
                        ref={ringFillRef}
                        cx="50"
                        cy="50"
                        r="46"
                        pathLength={1}
                        strokeDasharray="1 1"
                        strokeDashoffset="1"
                        transform="rotate(-90 50 50)"
                        className={styles.ringFill}
                      />
                      <g ref={headRef} className={styles.head}>
                        <circle cx="50" cy="4" r="2.4" className={styles.headDot} />
                      </g>
                      <g ref={spinRef} className={styles.spin}>
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          pathLength={1}
                          strokeDasharray=".22 .78"
                          className={styles.spinArc}
                        />
                      </g>
                    </svg>
                    <span className={styles.bezel} />
                    <span ref={lensRef} className={styles.lens}>
                      <span className={styles.litWrap}>
                        <span ref={litAmberRef} className={styles.lit} data-hue="amber" />
                        <span ref={litGreenRef} className={styles.lit} data-hue="green" />
                        <span ref={litRedRef} className={styles.lit} data-hue="red" />
                      </span>
                      <span className={styles.facets} />
                      <span className={styles.gloss} />
                    </span>
                    <span ref={bloomsRef} className={styles.blooms}>
                      <span ref={bloomAmberRef} className={styles.bloom} data-hue="amber" />
                      <span ref={bloomGreenRef} className={styles.bloom} data-hue="green" />
                      <span ref={bloomRedRef} className={styles.bloom} data-hue="red" />
                    </span>
                    <span ref={burstAccentRef} className={styles.burst} data-hue="accent" />
                    <span ref={burstGreenRef} className={styles.burst} data-hue="green" />
                    <span ref={burstRedRef} className={styles.burst} data-hue="red" />
                  </span>
                  <span ref={sweepRef} className={styles.sweep} />
                </div>

                <div className={styles.assembly} aria-hidden="true">
                  <span className={styles.washer} />
                  <span className={styles.nut} />
                  <span className={styles.bushing} />
                  <span ref={leverRef} className={styles.lever}>
                    <span className={styles.shaft}>
                      <span ref={bandRef} className={styles.band} />
                    </span>
                    <span ref={ballRef} className={styles.ball}>
                      <span ref={ballSpecRef} className={styles.ballSpec} />
                    </span>
                  </span>
                  <span className={styles.barrel} />
                  <span ref={coverRef} className={styles.cover}>
                    <span className={styles.wall} data-side="top" />
                    <span className={styles.wall} data-side="left" />
                    <span className={styles.wall} data-side="right" />
                    <span className={styles.wall} data-side="bottom" />
                    <span className={styles.lid}>
                      <span ref={grazeRef} className={styles.graze} />
                      <span ref={glareRef} className={styles.glare} />
                    </span>
                    <span className={styles.tab} />
                  </span>
                </div>

                <div className={styles.hits}>
                  <button
                    type="button"
                    className={`${styles.hit} ${styles.coverHit}`}
                    data-open={coverOpen ? "" : undefined}
                    aria-label={coverOpen ? "Close safety cover" : "Lift safety cover"}
                    aria-describedby={hintId}
                    aria-disabled={disabled || undefined}
                    onPointerEnter={() => {
                      engineRef.current.coverHover = true;
                      wakeLoop();
                    }}
                    onPointerLeave={() => {
                      engineRef.current.coverHover = false;
                      wakeLoop();
                    }}
                    onPointerDown={onCoverPointerDown}
                    onPointerMove={onCoverPointerMove}
                    onPointerUp={onCoverPointerUp}
                    onPointerCancel={onCoverPointerUp}
                    onKeyDown={onCoverKeyDown}
                  />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={armed}
                    className={`${styles.hit} ${styles.leverHit}`}
                    aria-label={`${armLabel} switch`}
                    aria-describedby={hintId}
                    aria-disabled={!coverOpen || disabled || undefined}
                    onPointerDown={onLeverPointerDown}
                    onPointerMove={onLeverPointerMove}
                    onPointerUp={onLeverPointerUp}
                    onPointerCancel={onLeverPointerUp}
                    onKeyDown={onLeverKeyDown}
                  />
                  <button
                    type="button"
                    className={`${styles.hit} ${styles.lampHit}`}
                    aria-label={holdLabel}
                    aria-describedby={hintId}
                    aria-disabled={!armed || disabled || undefined}
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      beginHold();
                    }}
                    onPointerUp={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                      endHold();
                    }}
                    onPointerCancel={endHold}
                    onKeyDown={onLampKeyDown}
                    onKeyUp={onLampKeyUp}
                    onBlur={endHold}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <p id={hintId} className={styles.hint}>
            {STATUS_KEYS.map((key) => {
              const isActive = !notice && status === key;
              return (
                <span
                  key={key}
                  className={styles.hintLine}
                  data-active={isActive ? "" : undefined}
                  aria-hidden={isActive ? undefined : true}
                >
                  {mergedHints[key]}
                </span>
              );
            })}
            <span
              className={styles.hintLine}
              data-notice=""
              data-active={notice ? "" : undefined}
              aria-hidden={notice ? undefined : true}
            >
              {notice}
            </span>
          </p>
        </footer>
      </div>

      <p className={styles.sr} role="status" aria-live="polite">
        {liveAnnouncement}
      </p>
    </div>
  );
}

export default ArmingSwitch;
