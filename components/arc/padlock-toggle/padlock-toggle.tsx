"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./padlock-toggle.module.css";

export interface PadlockToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (locked: boolean) => void;
  onSnap?: (locked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  onDescription?: string;
  offDescription?: string;
  label?: string;
  size?: number;
  name?: string;
  haptics?: boolean;
  disabled?: boolean;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}

const BAR = "M16 108V40a30 30 0 0 1 60 0v32";
const KEYHOLE =
  "M15 7.9a4.6 4.6 0 0 1 2.3 8.58l1.3 6.72a1 1 0 0 1-1 1.2h-5.2a1 1 0 0 1-1-1.2l1.3-6.72A4.6 4.6 0 0 1 15 7.9Z";

/** Shackle rest positions, in percent of its own height and degrees. */
const OPEN_Y = -19.643;
const COLLAR_Y = -24;
const OPEN_SWIVEL = -36;
const STEP = 1 / 240;
type Part =
  | "rig" | "floor" | "lock" | "top" | "shackle" | "shade" | "spec" | "front"
  | "ao" | "spill" | "glow" | "bloom" | "ring" | "sheen" | "sweep";

interface Engine {
  locked: boolean;
  landed: boolean;
  popped: boolean;
  since: number;
  y: number;
  vy: number;
  swivel: number;
  vSwivel: number;
  lean: number;
  vLean: number;
  dip: number;
  vDip: number;
  squash: number;
  vSquash: number;
  glow: number;
  impact: number;
  press: number;
  pressTo: number;
  tiltX: number;
  tiltY: number;
  hover: { x: number; y: number } | null;
  sheen: number;
  sheenGain: number;
  focus: boolean;
  drag: { y: number; vy: number } | null;
  clock: number;
  last: number;
  onscreen: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const f = (value: number, digits = 3) => Number(value.toFixed(digits));

export function PadlockToggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  onSnap,
  onLabel = "Private",
  offLabel = "Public",
  onDescription = "Only you and invited members can open it",
  offDescription = "Anyone with the link can view",
  label,
  size = 132,
  name,
  haptics = true,
  disabled = false,
  accent,
  className,
  style,
}: PadlockToggleProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const controlled = checked !== undefined;
  const [inner, setInner] = useState(defaultChecked);
  const locked = controlled ? checked : inner;
  const [shown, setShown] = useState(locked);

  const padRef = useRef<HTMLButtonElement>(null);
  const nodes = useRef<Partial<Record<Part, HTMLElement | SVGElement>>>({});
  const loop = useRef<(now: number) => void>(() => {});
  const frame = useRef(0);
  const callbacks = useRef({ onSnap, haptics, reduced });
  const engine = useRef<Engine | null>(null);
  const gesture = useRef<{ id: number; startY: number; lastY: number; lastT: number; vy: number; dragging: boolean; fromY: number } | null>(null);
  const lockedRef = useRef(locked);
  const suppressClick = useRef(false);

  useEffect(() => {
    callbacks.current = { onSnap, haptics, reduced };
  });

  const paint = useCallback(() => {
    const s = engine.current;
    if (!s) return;
    const n = nodes.current;
    const open = clamp(s.swivel / OPEN_SWIVEL, 0, 1.3);
    const t = s.impact;
    const rigY = s.tiltY;
    const set = (part: Part, css: string) => {
      const node = n[part];
      if (node) node.style.cssText = css;
    };
    set("rig", `transform: perspective(720px) rotateX(${f(s.tiltX)}deg) rotateY(${f(rigY)}deg) scale(${f(1 - s.press * 0.03, 4)});`);
    set("floor", `transform: translate3d(${f(-0.6 * rigY)}%, 0px, 0px) scale(${f(1 + s.squash * 1.9)}, ${f(1 + s.squash * 2.1)}); opacity: ${f(0.8 - s.squash * 2.8)};`);
    set("lock", `transform: translate3d(0px, ${f(s.dip + s.press * 0.6)}%, 0px);`);
    const squash = `transform: scale(${f(1 + s.squash * 0.45)}, ${f(1 - s.squash)});`;
    set("top", squash);
    set("front", squash);
    set("shackle", `transform: translate3d(0px, ${f(s.y)}%, 0px) perspective(320px) rotateY(${f(s.swivel)}deg) rotate(${f(s.lean)}deg);`);
    set("shade", `opacity: ${f(0.3 * open)};`);
    set("spec", `transform: translate3d(${f(-1.85 * open + 0.16 * (1 - open))}%, 0.055%, 0px); opacity: ${f(1 - 0.35 * Math.min(1, open))};`);
    set("ao", `opacity: ${f(clamp(1 + s.y / 8, 0, 1))};`);
    set("glow", `opacity: ${f(clamp(s.glow, 0, 1))};`);
    set("spill", `opacity: ${f(clamp(s.glow * 0.68, 0, 1))};`);
    const pulse = t >= 0 ? 0.45 * Math.exp(-t / 0.2) : 0;
    const swell = t >= 0 ? 1 + 0.65 * Math.exp(-t / 0.32) : 1;
    set("bloom", `opacity: ${f(clamp(pulse + 0.6 * s.glow * s.glow, 0, 1))}; transform: scale(${f(swell)});`);
    if (t >= 0 && t < 1.2) {
      set("ring", `opacity: ${f(clamp(0.8 - 1.07 * t, 0, 1))}; transform: scale(${f(2.5 - 2 * Math.exp(-t / 0.21))});`);
      const glint = t < 0.34 ? t / 0.34 : clamp(1 - (t - 0.42) / 0.36, 0, 1);
      set("sweep", `opacity: ${f(glint)}; transform: translate3d(${f(430 - 530 * Math.exp(-t / 0.24))}%, 0px, 0px) skewX(-18deg);`);
    } else {
      set("ring", "opacity: 0;");
      set("sweep", "opacity: 0;");
    }
    set("sheen", `transform: translate3d(${f(s.sheen)}%, 0px, 0px); opacity: ${f(0.42 + s.sheenGain * 0.4)};`);
  }, []);

  const snap = useCallback((value: boolean) => {
    const { onSnap: notify, haptics: buzz } = callbacks.current;
    setShown(value);
    notify?.(value);
    if (buzz && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(value ? 12 : 8);
      } catch {
        /* Vibration is optional. */
      }
    }
  }, []);

  const step = useCallback(
    (s: Engine, dt: number) => {
      s.clock += dt;
      s.since += dt;
      if (s.impact >= 0) s.impact += dt;
      const spring = (value: number, velocity: number, to: number, k: number, c: number) =>
        velocity + (-k * (value - to) - c * velocity) * dt;

      if (s.drag) {
        const before = s.y;
        s.y = s.drag.y;
        s.vy = (s.y - before) / dt;
        const align = s.y > -6 ? 0 : OPEN_SWIVEL;
        s.vSwivel = spring(s.swivel, s.vSwivel, s.locked ? 0 : align, 700, 40);
        s.swivel += s.vSwivel * dt;
      } else if (s.locked) {
        s.vSwivel = spring(s.swivel, s.vSwivel, 0, 2600, 80);
        s.swivel += s.vSwivel * dt;
        if (!s.landed) {
          const latched = Math.abs(s.swivel) < 12;
          s.vy = latched ? s.vy + (1500 * -s.y + 2600 - 16 * s.vy) * dt : spring(s.y, s.vy, -13, 900, 50);
          s.y += s.vy * dt;
          if (s.y >= 0 && latched) {
            const force = clamp(Math.abs(s.vy) / 260, 0.5, 1.4);
            s.y = 0;
            s.vy = 0;
            s.landed = true;
            s.popped = false;
            s.impact = 0;
            s.vDip += 24 * force;
            s.vSquash += 0.5 * force;
            s.vLean += 48 * force;
            snap(true);
          }
        } else {
          s.y = 0;
          s.vy = 0;
        }
      } else {
        s.landed = false;
        s.vy = spring(s.y, s.vy, OPEN_Y, 760, 15);
        s.y += s.vy * dt;
        if (s.y < COLLAR_Y) {
          s.y = COLLAR_Y;
          s.vy = Math.abs(s.vy) * 0.3;
          if (!s.popped) {
            s.popped = true;
            snap(false);
          }
        }
        if (s.since > 0.065 || s.popped) {
          s.vSwivel = spring(s.swivel, s.vSwivel, OPEN_SWIVEL, 420, 17);
          s.swivel += s.vSwivel * dt;
        }
      }

      const sway = s.locked && !s.drag ? 0 : -7 * clamp(s.swivel / OPEN_SWIVEL, 0, 1) + Math.sin(s.clock * 1.3) * 1.1 * clamp(s.swivel / OPEN_SWIVEL, 0, 1);
      s.vLean = spring(s.lean, s.vLean, sway, s.locked ? 250 : 110, s.locked ? 10 : 7);
      s.lean += s.vLean * dt;
      s.vDip = spring(s.dip, s.vDip, 0, 1100, 30);
      s.dip += s.vDip * dt;
      s.vSquash = spring(s.squash, s.vSquash, 0, 1100, 32);
      s.squash += s.vSquash * dt;

      const lit = s.locked && s.landed ? 0.91 + 0.09 * Math.sin(s.clock * 1.7) : 0;
      const rate = s.locked && s.landed ? (s.impact >= 0 && s.impact < 0.4 ? 14 : 3) : 4.8;
      const aim = s.locked && s.landed && s.impact >= 0 && s.impact < 0.4 ? 1.06 : lit;
      s.glow = Math.min(1, s.glow + (aim - s.glow) * (1 - Math.exp(-dt * rate)));

      s.press += (s.pressTo - s.press) * (1 - Math.exp(-dt * 30));
      const hx = s.hover ? s.hover.x : 0;
      const hy = s.hover ? s.hover.y : 0;
      const tiltX = 0.45 + 0.35 * Math.sin(s.clock * 0.21) - hy * 2.4;
      const tiltY = -0.45 + 0.75 * Math.sin(s.clock * 0.17 + 1) + hx * 3.2;
      const ease = 1 - Math.exp(-dt * 7);
      s.tiltX += (tiltX - s.tiltX) * ease;
      s.tiltY += (tiltY - s.tiltY) * ease;
      const wander = 45 + 65 * Math.sin(s.clock * 0.11 + 0.4);
      const sheen = s.hover ? clamp((s.hover.x + 1) / 2, 0, 1) * 127 : wander;
      s.sheen += (sheen - s.sheen) * (1 - Math.exp(-dt * (s.hover ? 6 : 1.5)));
      s.sheenGain += ((s.focus ? 1 : s.hover ? 0.35 : 0) - s.sheenGain) * (1 - Math.exp(-dt * 8));
    },
    [snap],
  );

  const tick = useCallback(
    (now: number) => {
      const s = engine.current;
      if (!s) return;
      let elapsed = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60;
      s.last = now;
      while (elapsed > 0) {
        const dt = Math.min(STEP, elapsed);
        step(s, dt);
        elapsed -= dt;
      }
      paint();
      frame.current = s.onscreen && !document.hidden && !callbacks.current.reduced ? requestAnimationFrame(loop.current) : 0;
    },
    [paint, step],
  );

  useEffect(() => {
    loop.current = tick;
  }, [tick]);

  const wake = useCallback(() => {
    const s = engine.current;
    if (!s || frame.current || callbacks.current.reduced) return;
    s.last = 0;
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  // Create the engine once, at rest in the initial state.
  useEffect(() => {
    const at = lockedRef.current;
    engine.current = {
      locked: at, landed: at, popped: !at, since: 10,
      y: at ? 0 : OPEN_Y, vy: 0,
      swivel: at ? 0 : OPEN_SWIVEL, vSwivel: 0,
      lean: at ? 0 : -7, vLean: 0,
      dip: 0, vDip: 0, squash: 0, vSquash: 0,
      glow: at ? 0.95 : 0, impact: -1,
      press: 0, pressTo: 0, tiltX: 0.45, tiltY: -0.8, hover: null,
      sheen: 30, sheenGain: 0, focus: false, drag: null,
      clock: 0, last: 0, onscreen: true,
    };
    const pad = padRef.current;
    const found: Partial<Record<Part, HTMLElement | SVGElement>> = {};
    pad?.querySelectorAll<HTMLElement | SVGElement>("[data-n]").forEach((node) => {
      found[node.getAttribute("data-n") as Part] = node;
    });
    nodes.current = found;
    paint();
    const observer =
      pad && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            if (!engine.current) return;
            engine.current.onscreen = entry.isIntersecting;
            if (entry.isIntersecting) wake();
          })
        : null;
    if (pad) observer?.observe(pad);
    const visible = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", visible);
    wake();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visible);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [paint, wake]);

  // Follow the locked state, whoever owns it.
  useEffect(() => {
    lockedRef.current = locked;
    const s = engine.current;
    if (!s || s.locked === locked) return;
    s.locked = locked;
    s.since = 0;
    if (reduced) {
      s.landed = locked;
      s.popped = !locked;
      s.y = locked ? 0 : OPEN_Y;
      s.swivel = locked ? 0 : OPEN_SWIVEL;
      s.lean = locked ? 0 : -7;
      s.glow = locked ? 1 : 0;
      s.impact = -1;
      paint();
      queueMicrotask(() => setShown(locked));
      callbacks.current.onSnap?.(locked);
      return;
    }
    if (!locked) {
      s.popped = false;
      s.landed = false;
      s.vy -= 420;
      s.dip += 0.27;
      s.squash = -0.011;
      s.impact = -1;
    } else {
      s.landed = false;
    }
    wake();
  }, [locked, paint, reduced, wake]);

  useEffect(() => {
    if (reduced) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      const s = engine.current;
      if (s) {
        s.tiltX = 0;
        s.tiltY = 0;
        s.dip = 0;
        s.squash = 0;
        s.press = 0;
        paint();
      }
    } else wake();
  }, [paint, reduced, wake]);

  const request = useCallback(
    (next: boolean) => {
      if (disabled || next === lockedRef.current) return;
      if (!controlled) setInner(next);
      onCheckedChange?.(next);
    },
    [controlled, disabled, onCheckedChange],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    const s = engine.current;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    suppressClick.current = false;
    gesture.current = {
      id: event.pointerId, startY: event.clientY, lastY: event.clientY,
      lastT: performance.now(), vy: 0, dragging: false, fromY: s ? s.y : 0,
    };
    if (s) s.pressTo = 1;
    wake();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const s = engine.current;
    const pad = padRef.current;
    if (!s || !pad) return;
    const box = pad.getBoundingClientRect();
    if (event.pointerType !== "touch") {
      s.hover = {
        x: clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1),
        y: clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1),
      };
      wake();
    }
    const g = gesture.current;
    if (!g || g.id !== event.pointerId || reduced) return;
    const now = performance.now();
    const dy = event.clientY - g.startY;
    if (!g.dragging && Math.abs(dy) > 4) {
      g.dragging = true;
      s.pressTo = 0;
    }
    if (!g.dragging) return;
    g.vy = (event.clientY - g.lastY) / Math.max(1, now - g.lastT);
    g.lastY = event.clientY;
    g.lastT = now;
    // The shackle is 112 of the padlock's 176 units tall.
    const percent = (dy / (box.height * (112 / 176))) * 100;
    if (lockedRef.current) {
      const pull = Math.min(0, percent);
      const give = -6 * (1 - Math.exp(pull / 9));
      s.landed = false;
      s.drag = { y: give, vy: 0 };
      if (pull < -13) {
        s.drag = null;
        gesture.current = null;
        s.y = give;
        suppressClick.current = true;
        request(false);
      }
    } else {
      const y = clamp(g.fromY + percent, COLLAR_Y, 0);
      s.drag = { y, vy: 0 };
      if (y >= -0.5 && Math.abs(s.swivel) < 12) {
        s.drag = null;
        gesture.current = null;
        s.y = -0.5;
        s.vy = 200;
        suppressClick.current = true;
        request(true);
      }
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    const s = engine.current;
    if (s) s.pressTo = 0;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (!g.dragging) return;
    suppressClick.current = true;
    if (!s) return;
    const y = s.drag?.y ?? s.y;
    s.drag = null;
    if (lockedRef.current) {
      s.landed = false;
      s.vy = 120;
    } else if (g.vy > 0.5 || y > -5) {
      s.vy = Math.max(200, g.vy * 600);
      request(true);
    }
  };

  const onPointerCancel = () => {
    gesture.current = null;
    const s = engine.current;
    if (s) {
      s.drag = null;
      s.pressTo = 0;
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled || event.key !== " ") return;
    if (engine.current) engine.current.pressTo = 1;
    wake();
  };

  const onKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " && engine.current) engine.current.pressTo = 0;
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    request(!lockedRef.current);
  };

  const description = locked ? onDescription : offDescription;
  const rootStyle = {
    "--pl-size": `${size}px`,
    ...(accent ? { "--pl-accent": accent } : null),
    ...style,
  } as CSSProperties;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} data-disabled={disabled || undefined} data-reduced={reduced || undefined}>
      <button
        ref={padRef}
        type="button"
        role="switch"
        aria-checked={locked}
        aria-label={label ?? onLabel}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        className={styles.pad}
        data-n="pad"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => {
          if (engine.current) engine.current.hover = null;
        }}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={(event) => {
          if (engine.current) engine.current.focus = event.currentTarget.matches(":focus-visible");
          wake();
        }}
        onBlur={() => {
          if (engine.current) {
            engine.current.focus = false;
            engine.current.pressTo = 0;
          }
        }}
      >
        <span className={styles.rig} data-n="rig" aria-hidden="true">
          <span className={styles.floor} data-n="floor" />
          <span className={styles.lock} data-n="lock">
            <span className={styles.topLayer} data-n="top">
              <span className={styles.top}>
                <span className={styles.hole} data-leg="long" />
                <span className={styles.hole} data-leg="short" />
                <span className={styles.ao} data-n="ao" />
              </span>
            </span>
            <span className={styles.shackle} data-n="shackle">
              <svg className={styles.art} viewBox="0 0 92 112" focusable="false">
                <defs>
                  <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="112" gradientUnits="userSpaceOnUse">
                    <stop offset="0" className={styles.barHi} />
                    <stop offset=".45" className={styles.barMid} />
                    <stop offset="1" className={styles.barLo} />
                  </linearGradient>
                </defs>
                <path d={BAR} className={styles.barEdge} />
                <path d={BAR} className={styles.barBody} stroke={`url(#${id}-bar)`} />
                <path d={BAR} className={styles.barCore} transform="translate(-1.3 -.9)" />
                <path d="M76 66v3" className={styles.groove} />
              </svg>
              <span className={styles.shade} data-n="shade">
                <svg className={styles.art} viewBox="0 0 92 112" focusable="false">
                  <path d={BAR} className={styles.shadeBar} />
                </svg>
              </span>
              <span className={styles.spec} data-n="spec">
                <svg className={styles.art} viewBox="0 0 92 112" focusable="false">
                  <path d={BAR} className={styles.specBar} transform="translate(-2.7 -1.8)" />
                </svg>
              </span>
            </span>
            <span className={styles.frontLayer} data-n="front">
              <span className={styles.body}>
                <span className={styles.chamfer} />
                <span className={styles.escutcheon}>
                  <span className={styles.spill} data-n="spill" />
                  <svg className={styles.keyhole} viewBox="0 0 30 30" focusable="false">
                    <defs>
                      <linearGradient id={`${id}-well`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" className={styles.wellTop} />
                        <stop offset="1" className={styles.wellBottom} />
                      </linearGradient>
                    </defs>
                    <path d={KEYHOLE} fill={`url(#${id}-well)`} />
                  </svg>
                  <svg className={styles.glow} viewBox="0 0 30 30" focusable="false" data-n="glow">
                    <defs>
                      <radialGradient id={`${id}-lit`} cx="15" cy="13" r="11" gradientUnits="userSpaceOnUse">
                        <stop offset="0" className={styles.litCore} />
                        <stop offset=".55" className={styles.litMid} />
                        <stop offset="1" className={styles.litEdge} />
                      </radialGradient>
                    </defs>
                    <path d={KEYHOLE} fill={`url(#${id}-lit)`} />
                  </svg>
                  <span className={styles.bloom} data-n="bloom" />
                  <span className={styles.ring} data-n="ring" />
                </span>
                <span className={styles.sheen} data-n="sheen" />
                <span className={styles.sweep} data-n="sweep" />
              </span>
            </span>
          </span>
        </span>
      </button>
      {name ? <input type="hidden" name={name} value="on" disabled={!locked || disabled} /> : null}
      <div className={styles.caption} aria-hidden="true">
        <span className={styles.words}>
          <span className={styles.word} data-w="on" data-active={shown ? "" : undefined}>{onLabel}</span>
          <span className={styles.word} data-w="off" data-active={shown ? undefined : ""}>{offLabel}</span>
        </span>
        {onDescription || offDescription ? (
          <span className={styles.descs}>
            <span className={styles.desc} data-w="on" data-active={shown ? "" : undefined}>{onDescription}</span>
            <span className={styles.desc} data-w="off" data-active={shown ? undefined : ""}>{offDescription}</span>
          </span>
        ) : null}
      </div>
      {description ? (
        <span id={`${id}-desc`} className={styles.sr}>
          {description}
        </span>
      ) : null}
    </div>
  );
}
