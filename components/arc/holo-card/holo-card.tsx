"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import styles from "./holo-card.module.css";

export interface HoloCardProps {
  /** The face. Fill the whole card; it is clipped to the rounded shape. */
  front: ReactNode;
  /** The back. Leave it out for a tilt only card that is not a button. */
  back?: ReactNode;
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Largest lean in degrees. */
  maxTilt?: number;
  /** Strength of foil, glitter, and glare from 0 to 1. */
  intensity?: number;
  /** Follows device tilt on touch screens. On iOS permission is asked on the first tap. */
  gyroscope?: boolean;
  /** Accessible name. Defaults to the text on the card. */
  label?: string;
  /** Class on the root. Set width here; the card keeps a 5:7 ratio. */
  className?: string;
  style?: CSSProperties;
}

const TILT_SPRING = { stiffness: 260, damping: 22, mass: 1 };
const LIGHT_SPRING = { stiffness: 150, damping: 20, mass: 1 };
const SPIN_SPRING = { stiffness: 220, damping: 24, mass: 1 };
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export function HoloCard({ front, back, flipped: flippedProp, defaultFlipped = false, onFlippedChange, maxTilt = 14, intensity = 1, gyroscope = true, label, className, style }: HoloCardProps) {
  const reduced = useReducedMotion() ?? false;
  const [inner, setInner] = useState(defaultFlipped);
  const flipped = flippedProp ?? inner;
  const strength = clamp(intensity, 0, 1);

  // Pointer position across the card, -1 to 1 on each axis.
  const aimX = useMotionValue(0), aimY = useMotionValue(0), hover = useMotionValue(0);
  const spinTarget = useMotionValue(flipped ? 180 : 0);
  const tiltX = useSpring(aimX, TILT_SPRING), tiltY = useSpring(aimY, TILT_SPRING);
  const lightX = useSpring(aimX, LIGHT_SPRING), lightY = useSpring(aimY, LIGHT_SPRING);
  const lift = useSpring(hover, TILT_SPRING);
  const spin = useSpring(spinTarget, SPIN_SPRING);

  const turns = useRef(flipped ? 1 : 0);
  const side = useRef(1);
  const pointerOn = useRef(false);
  const gyro = useRef<{ asked: boolean; base: { beta: number; gamma: number } | null }>({ asked: false, base: null });

  useEffect(() => {
    if ((Math.abs(turns.current) % 2 === 1) !== flipped) turns.current += side.current;
    spinTarget.set(turns.current * 180);
  }, [flipped, spinTarget]);

  const rotateX = useTransform(tiltY, v => -v * maxTilt);
  const rotateY = useTransform(tiltX, v => v * maxTilt);
  const scale = useTransform(lift, v => 1 + 0.035 * v);
  const sweep = useTransform(spin, v => Math.sin((v * Math.PI) / 180));
  const holoX = useTransform(lightX, v => `${50 + v * 50}%`);
  const holoY = useTransform(lightY, v => `${50 + v * 50}%`);
  const foilX = useTransform([lightX, sweep], ([x, s]: number[]) => `${50 + x * 50 + 60 * s}%`);
  const hue = useTransform([lightX, lightY, sweep], ([x, y, s]: number[]) => `${60 * x + 30 * y + 90 * s}deg`);
  const glitterX = useTransform(lightX, v => `${-18 * v}px`);
  const glitterY = useTransform(lightY, v => `${-18 * v}px`);
  const shine = useTransform(lift, v => (0.35 + 0.65 * v) * strength);
  const shadowX = useTransform(rotateY, v => -v * 0.9);
  const shadowY = useTransform(rotateX, v => 18 + v * 0.9);
  const boxShadow = useMotionTemplate`${shadowX}px ${shadowY}px 42px -14px oklch(0% 0 0 / calc(.28 + ${lift} * .12))`;
  const spinTransform = useTransform(spin, v => (Math.abs(v) < 0.005 ? "none" : `rotateY(${v}deg)`));

  const aim = (x: number, y: number, on: boolean) => { aimX.set(x); aimY.set(y); hover.set(on ? 1 : 0); };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === "touch") return;
    // Measured on the untransformed root, so the lean does not feed back into the reading.
    const box = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
    pointerOn.current = true;
    aim(clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1), clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1), true);
  };
  const onPointerLeave = () => { pointerOn.current = false; aim(0, 0, false); };

  const onOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (pointerOn.current || event.beta == null || event.gamma == null) return;
    const state = gyro.current;
    if (!state.base) state.base = { beta: event.beta, gamma: event.gamma };
    aimX.set(clamp((event.gamma - state.base.gamma) / 24, -1, 1));
    aimY.set(clamp((event.beta - state.base.beta) / 24, -1, 1));
    hover.set(1);
  }, [aimX, aimY, hover]);

  useEffect(() => {
    if (!gyroscope || reduced || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (typeof (window.DeviceOrientationEvent as unknown as OrientationPermission).requestPermission === "function") return;
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [gyroscope, onOrientation, reduced]);
  useEffect(() => () => window.removeEventListener("deviceorientation", onOrientation), [onOrientation]);

  const askGyro = () => {
    const state = gyro.current;
    if (!gyroscope || reduced || state.asked || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const request = (window.DeviceOrientationEvent as unknown as OrientationPermission).requestPermission;
    if (typeof request !== "function" || !window.matchMedia("(pointer: coarse)").matches) return;
    state.asked = true;
    request().then(result => { if (result === "granted") window.addEventListener("deviceorientation", onOrientation); }).catch(() => {});
  };

  const flip = (direction: number) => {
    side.current = direction;
    const next = !flipped;
    if (flippedProp === undefined) setInner(next);
    onFlippedChange?.(next);
  };
  const onClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    askGyro();
    const box = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
    flip(event.detail !== 0 && event.clientX < box.left + box.width / 2 ? -1 : 1);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    flip(1);
  };

  const vars = { "--holo-x": holoX, "--holo-y": holoY, "--holo-foil-x": foilX, "--holo-foil-y": holoY, "--holo-glitter-x": glitterX, "--holo-glitter-y": glitterY, "--holo-hue": hue, "--holo-shine": shine };
  const pose = reduced ? {} : { transformPerspective: 900, scale, rotateX, rotateY };
  const button = back !== undefined;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <motion.div className={styles.shadow} aria-hidden="true" style={{ boxShadow, ...pose }} />
      <motion.div
        className={styles.card}
        {...(button ? { role: "button", tabIndex: 0, "aria-pressed": flipped, "aria-roledescription": "flip card", onClick, onKeyDown } : { onClick: askGyro })}
        aria-label={label} data-reduced={reduced ? "true" : undefined} data-flipped={flipped ? "true" : undefined}
        style={{ ...vars, ...pose } as never} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onPointerCancel={onPointerLeave}
      >
        <motion.div className={styles.inner} style={reduced ? undefined : { transform: spinTransform }}>
          <div className={styles.face} data-side="front" aria-hidden={button && flipped ? true : undefined}>
            <div className={styles.content}>{front}</div>
            <span className={styles.foil} aria-hidden="true" />
            <span className={styles.glitter} aria-hidden="true" />
            <span className={styles.glare} aria-hidden="true" />
          </div>
          {button ? (
            <div className={styles.face} data-side="back" aria-hidden={flipped ? undefined : true}>
              <div className={styles.content}>{back}</div>
              <span className={styles.foil} aria-hidden="true" />
              <span className={styles.glare} aria-hidden="true" />
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default HoloCard;
