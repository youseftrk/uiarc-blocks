"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./pixel-mascot.module.css";

export type PixelMascotStatus =
  | "idle"
  | "thinking"
  | "writing"
  | "done"
  | "error";

export interface PixelMascotProps {
  status?: PixelMascotStatus;
  size?: number;
  name?: string;
  label?: string;
  announce?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

const LOOP_SEQUENCE: Array<{ status: PixelMascotStatus; duration: number }> = [
  { status: "idle", duration: 2400 },
  { status: "thinking", duration: 2800 },
  { status: "writing", duration: 3200 },
  { status: "done", duration: 2400 },
  { status: "idle", duration: 2000 },
  { status: "thinking", duration: 2400 },
  { status: "error", duration: 2400 },
];

export function usePixelMascotLoop(enabled = true): PixelMascotStatus {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const duration = LOOP_SEQUENCE[idx]?.duration ?? 2400;
    const timer = window.setTimeout(() => {
      setIdx((i) => (i + 1) % LOOP_SEQUENCE.length);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [enabled, idx]);

  return LOOP_SEQUENCE[idx]?.status ?? "idle";
}

function defaultLabelFor(name: string, status: PixelMascotStatus): string {
  switch (status) {
    case "idle":
      return `${name} is idle`;
    case "thinking":
      return `${name} is thinking`;
    case "writing":
      return `${name} is writing`;
    case "done":
      return `${name} is done`;
    case "error":
      return `${name} encountered an error`;
  }
}

interface ArmPose {
  l0: [number, number, boolean];
  l1: [number, number, boolean];
  l2: [number, number, boolean];
  r0: [number, number, boolean];
  r1: [number, number, boolean];
  r2: [number, number, boolean];
}

const ARMS_REST: ArmPose = {
  l0: [-1, 6, true],
  l1: [-1, 7, true],
  l2: [-1, 7, false],
  r0: [14, 6, true],
  r1: [14, 7, true],
  r2: [14, 7, false],
};

const ARMS_WRITE_L: ArmPose = {
  l0: [-1, 7, true],
  l1: [-1, 9, true],
  l2: [0, 10, true],
  r0: [14, 7, true],
  r1: [14, 8, true],
  r2: [13, 9, true],
};

const ARMS_WRITE_R: ArmPose = {
  l0: [-1, 7, true],
  l1: [-1, 8, true],
  l2: [0, 9, true],
  r0: [14, 7, true],
  r1: [14, 9, true],
  r2: [13, 10, true],
};

const ARMS_CELEBRATE: ArmPose = {
  l0: [-1, 5, true],
  l1: [-1, 4, true],
  l2: [-2, 3, true],
  r0: [14, 5, true],
  r1: [14, 4, true],
  r2: [15, 3, true],
};

const ARMS_ERROR: ArmPose = {
  l0: [-1, 6, true],
  l1: [-2, 7, true],
  l2: [-2, 8, false],
  r0: [14, 6, true],
  r1: [15, 7, true],
  r2: [15, 8, false],
};

const KEY_XS = [1, 3, 5, 8, 10, 12, 5, 10];
const DONE_JUMP_Y = [8, 7, 6, 5, 5, 5, 6, 7, 8];
const ERROR_SHAKE_X = [5, 4, 6, 4, 6, 5];

function stepToward(cur: number, target: number): number {
  if (cur < target) return cur + 1;
  if (cur > target) return cur - 1;
  return cur;
}

export function PixelMascot({
  status: controlledStatus,
  size = 4,
  name = "Assistant",
  label,
  announce,
  paused = false,
  className,
  style,
}: PixelMascotProps) {
  const prefersReduced = Boolean(useReducedMotion());
  const isControlled = controlledStatus !== undefined;
  const loopedStatus = usePixelMascotLoop(!isControlled && !paused && !prefersReduced);
  const status: PixelMascotStatus = controlledStatus ?? loopedStatus;

  const clampedSize = Math.max(1, Math.min(8, Math.round(size)));
  const px = clampedSize * 24;
  const shouldAnnounce = announce ?? isControlled;
  const accessibleLabel = label ?? defaultLabelFor(name, status);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const inViewRef = useRef(true);
  const propsRef = useRef({ status, paused, prefersReduced });

  useEffect(() => {
    propsRef.current = { status, paused, prefersReduced };
  }, [status, paused, prefersReduced]);

  // Pause when scrolled off screen
  useEffect(() => {
    const el = svgRef.current;
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

  // Single 40ms-stepped animation loop writing SVG attributes directly
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const part = (key: string) =>
      svg.querySelector<SVGElement>(`[data-part="${key}"]`);

    const els = {
      shadow: part("shadow"),
      tailNear: part("tailNear"),
      tailFar: part("tailFar"),
      cloud: part("cloud"),
      dot0: part("dot0"),
      dot1: part("dot1"),
      dot2: part("dot2"),
      body: part("body"),
      armL0: part("armL0"),
      armL1: part("armL1"),
      armL2: part("armL2"),
      armR0: part("armR0"),
      armR1: part("armR1"),
      armR2: part("armR2"),
      eyeL: part("eyeL"),
      eyeR: part("eyeR"),
      happy: part("happy"),
      cross: part("cross"),
      cheeks: part("cheeks"),
      keyboard: part("keyboard"),
      key: part("key"),
      spark0core: part("spark0core"),
      spark0near: part("spark0near"),
      spark0far: part("spark0far"),
      spark1core: part("spark1core"),
      spark1near: part("spark1near"),
      spark1far: part("spark1far"),
      spark2core: part("spark2core"),
      spark2near: part("spark2near"),
    };

    const cache = new Map<string, string>();
    const setAttr = (
      el: SVGElement | null,
      key: string,
      attr: string,
      val: string
    ) => {
      if (!el) return;
      const ck = `${key}:${attr}`;
      if (cache.get(ck) === val) return;
      cache.set(ck, val);
      el.setAttribute(attr, val);
    };

    const setVis = (el: SVGElement | null, key: string, visible: boolean) => {
      setAttr(el, key, "visibility", visible ? "visible" : "hidden");
    };

    const setArm = (
      el: SVGElement | null,
      key: string,
      pose: [number, number, boolean]
    ) => {
      setAttr(el, key, "x", String(pose[0]));
      setAttr(el, key, "y", String(pose[1]));
      setVis(el, key, pose[2]);
    };

    // Mutable stepped state for smooth 1px morphing across status changes
    const st = {
      prevStatus: propsRef.current.status,
      stepInStatus: 0,
      globalStep: 0,
      bodyX: 5,
      bodyY: 8,
      eyeLx: 4,
      eyeLy: 5,
      eyeLh: 2,
      eyeRx: 8,
      eyeRy: 5,
      eyeRh: 2,
      bubbleStage: propsRef.current.status === "thinking" ? 3 : 0, // 0..3
      kbStage: propsRef.current.status === "writing" ? 2 : 0, // 0..2
      blinkSteps: 0,
    };

    const applyReducedPose = (s: PixelMascotStatus) => {
      setAttr(svg, "svg", "data-screen", s === "error" ? "error" : "normal");
      setAttr(svg, "svg", "data-antenna", s === "error" ? "off" : "on");
      setAttr(els.body, "body", "transform", "translate(5 8)");
      setAttr(els.shadow, "shadow", "x", "7");
      setAttr(els.shadow, "shadow", "width", "10");
      setAttr(els.shadow, "shadow", "opacity", "0.7");

      const thinking = s === "thinking";
      setVis(els.tailNear, "tailNear", thinking);
      setVis(els.tailFar, "tailFar", thinking);
      setVis(els.cloud, "cloud", thinking);
      setAttr(els.dot0, "dot0", "opacity", "0.3");
      setAttr(els.dot1, "dot1", "opacity", "1");
      setAttr(els.dot2, "dot2", "opacity", "0.3");

      const writing = s === "writing";
      setVis(els.keyboard, "keyboard", writing);
      setAttr(els.keyboard, "keyboard", "transform", "translate(0 0)");
      setVis(els.key, "key", writing);
      setAttr(els.key, "key", "x", "5");

      const showEyes = s === "idle" || s === "thinking" || s === "writing";
      setVis(els.eyeL, "eyeL", showEyes);
      setVis(els.eyeR, "eyeR", showEyes);
      setAttr(els.eyeL, "eyeL", "x", thinking ? "5" : "4");
      setAttr(els.eyeL, "eyeL", "y", "5");
      setAttr(els.eyeL, "eyeL", "height", "2");
      setAttr(els.eyeR, "eyeR", "x", thinking ? "9" : "8");
      setAttr(els.eyeR, "eyeR", "y", "5");
      setAttr(els.eyeR, "eyeR", "height", "2");

      setVis(els.happy, "happy", s === "done");
      setVis(els.cheeks, "cheeks", s === "done");
      setVis(els.cross, "cross", s === "error");

      const arms =
        s === "done"
          ? ARMS_CELEBRATE
          : s === "writing"
            ? ARMS_WRITE_L
            : s === "error"
              ? ARMS_ERROR
              : ARMS_REST;
      setArm(els.armL0, "armL0", arms.l0);
      setArm(els.armL1, "armL1", arms.l1);
      setArm(els.armL2, "armL2", arms.l2);
      setArm(els.armR0, "armR0", arms.r0);
      setArm(els.armR1, "armR1", arms.r1);
      setArm(els.armR2, "armR2", arms.r2);

      const spark = s === "done";
      setVis(els.spark0core, "spark0core", spark);
      setVis(els.spark0near, "spark0near", spark);
      setVis(els.spark0far, "spark0far", false);
      setVis(els.spark1core, "spark1core", spark);
      setVis(els.spark1near, "spark1near", false);
      setVis(els.spark1far, "spark1far", false);
      setVis(els.spark2core, "spark2core", spark);
      setVis(els.spark2near, "spark2near", false);
    };

    const advanceStep = () => {
      const { status: cur, prefersReduced: red } = propsRef.current;
      if (red) {
        applyReducedPose(cur);
        return;
      }

      if (cur !== st.prevStatus) {
        st.prevStatus = cur;
        st.stepInStatus = 0;
        st.blinkSteps = 2; // smooth lid close-open transition on status change
      } else {
        st.stepInStatus += 1;
      }
      st.globalStep += 1;

      const t = st.stepInStatus;
      const g = st.globalStep;

      // Target body coordinates
      let targetBX = 5;
      let targetBY = 8;

      if (cur === "idle") {
        // 2s (50 steps) gentle bob
        const phase = g % 50;
        targetBY = phase >= 20 && phase < 42 ? 7 : 8;
      } else if (cur === "thinking") {
        const phase = g % 56;
        targetBY = phase >= 24 && phase < 48 ? 7 : 8;
      } else if (cur === "writing") {
        targetBY = 8;
      } else if (cur === "done") {
        if (t < DONE_JUMP_Y.length) {
          targetBY = DONE_JUMP_Y[t];
        } else {
          targetBY = 8;
        }
      } else if (cur === "error") {
        if (t < ERROR_SHAKE_X.length) {
          targetBX = ERROR_SHAKE_X[t];
        } else {
          targetBX = 5;
        }
      }

      st.bodyX = stepToward(st.bodyX, targetBX);
      st.bodyY = stepToward(st.bodyY, targetBY);

      // Shadow tracks body height
      const lift = 8 - st.bodyY;
      const shW = lift >= 2 ? 6 : lift === 1 ? 8 : 10;
      const shX = Math.round(12 - shW / 2);
      const shOp = lift >= 2 ? "0.38" : lift === 1 ? "0.52" : "0.7";
      setAttr(els.body, "body", "transform", `translate(${st.bodyX} ${st.bodyY})`);
      setAttr(els.shadow, "shadow", "x", String(shX));
      setAttr(els.shadow, "shadow", "width", String(shW));
      setAttr(els.shadow, "shadow", "opacity", shOp);

      // Screen & antenna
      setAttr(svg, "svg", "data-screen", cur === "error" ? "error" : "normal");
      let antennaOn = true;
      if (cur === "error") {
        antennaOn = (t % 16) < 4;
      } else if (cur === "thinking") {
        antennaOn = (t % 14) < 10;
      }
      setAttr(svg, "svg", "data-antenna", antennaOn ? "on" : "off");

      // Thought bubble steps in/out (0..3)
      const wantBubble = cur === "thinking" ? 3 : 0;
      if (st.bubbleStage < wantBubble) st.bubbleStage += 1;
      else if (st.bubbleStage > wantBubble) st.bubbleStage -= 1;

      setVis(els.tailNear, "tailNear", st.bubbleStage >= 1);
      setVis(els.tailFar, "tailFar", st.bubbleStage >= 2);
      setVis(els.cloud, "cloud", st.bubbleStage >= 3);

      // 3 thinking dots cycle every 1.12s (28 steps)
      const dotActive = Math.floor((g % 28) / 9.333);
      setAttr(els.dot0, "dot0", "opacity", dotActive === 0 ? "1" : "0.3");
      setAttr(els.dot1, "dot1", "opacity", dotActive === 1 ? "1" : "0.3");
      setAttr(els.dot2, "dot2", "opacity", dotActive === 2 ? "1" : "0.3");

      // Keyboard steps in/out (0..2)
      const wantKb = cur === "writing" ? 2 : 0;
      if (st.kbStage < wantKb) st.kbStage += 1;
      else if (st.kbStage > wantKb) st.kbStage -= 1;

      setVis(els.keyboard, "keyboard", st.kbStage > 0);
      setAttr(
        els.keyboard,
        "keyboard",
        "transform",
        `translate(0 ${st.kbStage === 2 ? 0 : 1})`
      );

      // Keystrokes: 8-stroke bar every 1.6s (40 steps -> 5 steps per stroke)
      const strokeIdx = Math.floor((g % 40) / 5);
      const keyPressed = cur === "writing" && st.kbStage === 2 && (g % 5) < 3;
      setVis(els.key, "key", keyPressed);
      setAttr(els.key, "key", "x", String(KEY_XS[strokeIdx] ?? 1));

      // Eyes / happy / cross / cheeks
      if (st.blinkSteps > 0) {
        st.blinkSteps -= 1;
      }

      const showStandardEyes =
        cur === "idle" || cur === "thinking" || cur === "writing";
      const showHappy = cur === "done" && st.blinkSteps === 0;
      const showCross = cur === "error" && st.blinkSteps === 0;

      let targetEyeLx = 4;
      let targetEyeLy = 5;
      let targetEyeH = 2;

      if (cur === "idle") {
        // 8s (200 steps) glance & blink
        const p = g % 200;
        if (p >= 90 && p < 125) targetEyeLx = 5;
        else if (p >= 145 && p < 175) targetEyeLx = 3;
        if ((p >= 44 && p < 47) || (p >= 134 && p < 137)) {
          targetEyeH = 1;
          targetEyeLy = 6;
        }
      } else if (cur === "thinking") {
        targetEyeLx = 5;
        targetEyeLy = 5;
      } else if (cur === "writing") {
        // Scan across 1.6s (40 steps)
        const p = g % 40;
        targetEyeLx = p < 12 ? 3 : p < 24 ? 4 : p < 34 ? 5 : 4;
        targetEyeLy = 6;
      }

      if (st.blinkSteps > 0) {
        targetEyeH = 1;
        targetEyeLy = 6;
      }

      st.eyeLx = stepToward(st.eyeLx, targetEyeLx);
      st.eyeRx = st.eyeLx + 4;
      st.eyeLy = stepToward(st.eyeLy, targetEyeLy);
      st.eyeRy = st.eyeLy;
      st.eyeLh = targetEyeH;
      st.eyeRh = targetEyeH;

      setVis(els.eyeL, "eyeL", showStandardEyes || st.blinkSteps > 0);
      setVis(els.eyeR, "eyeR", showStandardEyes || st.blinkSteps > 0);
      setAttr(els.eyeL, "eyeL", "x", String(st.eyeLx));
      setAttr(els.eyeL, "eyeL", "y", String(st.eyeLy));
      setAttr(els.eyeL, "eyeL", "height", String(st.eyeLh));
      setAttr(els.eyeR, "eyeR", "x", String(st.eyeRx));
      setAttr(els.eyeR, "eyeR", "y", String(st.eyeRy));
      setAttr(els.eyeR, "eyeR", "height", String(st.eyeRh));

      setVis(els.happy, "happy", showHappy);
      setVis(els.cheeks, "cheeks", showHappy);
      setVis(els.cross, "cross", showCross);

      // Arms
      let arms = ARMS_REST;
      if (cur === "done") {
        arms = ARMS_CELEBRATE;
      } else if (cur === "writing") {
        arms = strokeIdx % 2 === 0 ? ARMS_WRITE_L : ARMS_WRITE_R;
      } else if (cur === "error") {
        arms = ARMS_ERROR;
      }
      setArm(els.armL0, "armL0", arms.l0);
      setArm(els.armL1, "armL1", arms.l1);
      setArm(els.armL2, "armL2", arms.l2);
      setArm(els.armR0, "armR0", arms.r0);
      setArm(els.armR1, "armR1", arms.r1);
      setArm(els.armR2, "armR2", arms.r2);

      // Done sparkles (3 bursts staggered)
      const renderSpark = (
        offset: number,
        core: SVGElement | null,
        near: SVGElement | null,
        far: SVGElement | null,
        prefix: string
      ) => {
        if (cur !== "done") {
          setVis(core, `${prefix}core`, false);
          setVis(near, `${prefix}near`, false);
          if (far) setVis(far, `${prefix}far`, false);
          return;
        }
        const f = (t + offset) % 24;
        setVis(core, `${prefix}core`, f >= 0 && f < 8);
        setVis(near, `${prefix}near`, f >= 2 && f < 10);
        if (far) setVis(far, `${prefix}far`, f >= 4 && f < 12);
      };

      renderSpark(0, els.spark0core, els.spark0near, els.spark0far, "spark0");
      renderSpark(8, els.spark1core, els.spark1near, els.spark1far, "spark1");
      renderSpark(16, els.spark2core, els.spark2near, null, "spark2");
    };

    // Draw initial frame synchronously
    if (propsRef.current.prefersReduced) {
      applyReducedPose(propsRef.current.status);
    } else {
      advanceStep();
    }

    let rafId = 0;
    let lastTick = 0;

    const loop = (now: number) => {
      const { paused: isPaused, prefersReduced: isRed } = propsRef.current;
      if (isRed) {
        applyReducedPose(propsRef.current.status);
        return;
      }
      if (!isPaused && inViewRef.current) {
        if (lastTick === 0) lastTick = now;
        if (now - lastTick >= 40) {
          lastTick = now - ((now - lastTick) % 40);
          advanceStep();
        }
      } else {
        lastTick = 0;
      }
      rafId = window.requestAnimationFrame(loop);
    };

    if (!prefersReduced) {
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [prefersReduced, status]);

  return (
    <span
      className={className ? `${styles.root} ${className}` : styles.root}
      style={style}
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox="0 0 24 24"
        width={px}
        height={px}
        shapeRendering="crispEdges"
        role="img"
        aria-label={accessibleLabel}
        data-screen={status === "error" ? "error" : "normal"}
        data-antenna={status === "error" ? "off" : "on"}
      >
        <rect
          data-part="shadow"
          className={styles.shadow}
          y="22"
          height="1"
          x="7"
          width="10"
          opacity="0.7"
        />
        <path
          data-part="tailNear"
          className={styles.ink}
          d="M15 8h1v1h-1z"
          visibility="hidden"
        />
        <path
          data-part="tailFar"
          className={styles.ink}
          d="M16 6h1v1h-1z"
          visibility="hidden"
        />
        <g data-part="cloud" visibility="hidden">
          <path className={styles.body} d="M15 1h7v3h-7z" />
          <path
            className={styles.ink}
            d="M15 0h7v1h-7zM15 4h7v1h-7zM14 1h1v3h-1zM22 1h1v3h-1z"
          />
          <rect
            data-part="dot0"
            className={styles.ink}
            x="16"
            y="2"
            width="1"
            height="1"
            opacity="0.3"
          />
          <rect
            data-part="dot1"
            className={styles.ink}
            x="18"
            y="2"
            width="1"
            height="1"
            opacity="1"
          />
          <rect
            data-part="dot2"
            className={styles.ink}
            x="20"
            y="2"
            width="1"
            height="1"
            opacity="0.3"
          />
        </g>

        <g data-part="body" transform="translate(5 8)">
          <rect
            data-part="armL0"
            className={styles.ink}
            width="1"
            height="1"
            x="-1"
            y="6"
            visibility="visible"
          />
          <rect
            data-part="armL1"
            className={styles.ink}
            width="1"
            height="1"
            x="-1"
            y="7"
            visibility="visible"
          />
          <rect
            data-part="armL2"
            className={styles.ink}
            width="1"
            height="1"
            x="-1"
            y="7"
            visibility="hidden"
          />
          <rect
            data-part="armR0"
            className={styles.ink}
            width="1"
            height="1"
            x="14"
            y="6"
            visibility="visible"
          />
          <rect
            data-part="armR1"
            className={styles.ink}
            width="1"
            height="1"
            x="14"
            y="7"
            visibility="visible"
          />
          <rect
            data-part="armR2"
            className={styles.ink}
            width="1"
            height="1"
            x="14"
            y="7"
            visibility="hidden"
          />
          <path className={styles.tip} d="M6 0h2v1h-2z" />
          <path className={styles.body} d="M1 3h12v8h-12z" />
          <path className={styles.shade} d="M1 10h12v1h-12zM12 3h1v7h-1z" />
          <path
            className={styles.ink}
            d="M6 1h2v1h-2zM1 2h12v1h-12zM1 11h12v1h-12zM0 3h1v8h-1zM13 3h1v8h-1z"
          />
          <path
            className={styles.screen}
            d="M3 4h8v1h-8zM2 5h10v3h-10zM3 8h8v1h-8z"
          />
          <rect
            data-part="eyeL"
            className={styles.eye}
            width="2"
            x="4"
            y="5"
            height="2"
            visibility="visible"
          />
          <rect
            data-part="eyeR"
            className={styles.eye}
            width="2"
            x="8"
            y="5"
            height="2"
            visibility="visible"
          />
          <path
            data-part="happy"
            className={styles.eye}
            d="M3 6h1v1h-1zM4 5h1v1h-1zM5 6h1v1h-1zM8 6h1v1h-1zM9 5h1v1h-1zM10 6h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="cross"
            className={styles.cross}
            d="M3 5h1v1h-1zM5 5h1v1h-1zM4 6h1v1h-1zM3 7h1v1h-1zM5 7h1v1h-1zM8 5h1v1h-1zM10 5h1v1h-1zM9 6h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="cheeks"
            className={styles.cheek}
            d="M2 9h1v1h-1zM11 9h1v1h-1z"
            visibility="hidden"
          />
          <g data-part="keyboard" transform="translate(0 0)" visibility="hidden">
            <path
              className={styles.body}
              d="M1 12h1v1h-1zM3 12h1v1h-1zM5 12h1v1h-1zM8 12h1v1h-1zM10 12h1v1h-1zM12 12h1v1h-1z"
            />
            <path
              className={styles.shade}
              d="M0 12h1v1h-1zM2 12h1v1h-1zM4 12h1v1h-1zM6 12h2v1h-2zM9 12h1v1h-1zM11 12h1v1h-1zM13 12h1v1h-1z"
            />
            <path
              className={styles.ink}
              d="M-1 11h16v1h-16zM-1 12h1v1h-1zM14 12h1v1h-1zM0 13h14v1h-14z"
            />
            <rect
              data-part="key"
              className={styles.accent}
              y="12"
              width="1"
              height="1"
              x="1"
              visibility="hidden"
            />
          </g>
        </g>

        <g className={styles.accent}>
          <path
            data-part="spark0core"
            d="M2 5h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="spark0near"
            d="M1 5h1v1h-1zM3 5h1v1h-1zM2 4h1v1h-1zM2 6h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="spark0far"
            d="M0 5h1v1h-1zM4 5h1v1h-1zM2 3h1v1h-1zM2 7h1v1h-1z"
            visibility="hidden"
          />
        </g>
        <g className={styles.accent}>
          <path
            data-part="spark1core"
            d="M21 4h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="spark1near"
            d="M20 4h1v1h-1zM22 4h1v1h-1zM21 3h1v1h-1zM21 5h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="spark1far"
            d="M19 4h1v1h-1zM23 4h1v1h-1zM21 2h1v1h-1zM21 6h1v1h-1z"
            visibility="hidden"
          />
        </g>
        <g className={styles.accent}>
          <path
            data-part="spark2core"
            d="M7 2h1v1h-1z"
            visibility="hidden"
          />
          <path
            data-part="spark2near"
            d="M6 2h1v1h-1zM8 2h1v1h-1zM7 1h1v1h-1zM7 3h1v1h-1z"
            visibility="hidden"
          />
        </g>
      </svg>

      {shouldAnnounce && (
        <span className={styles.live} role="status" aria-live="polite">
          {accessibleLabel}
        </span>
      )}
    </span>
  );
}

export default PixelMascot;
