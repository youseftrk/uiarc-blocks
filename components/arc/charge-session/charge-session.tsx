"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import { BatteryFull, RotateCcw, Square, Zap } from "lucide-react";
import styles from "./charge-session.module.css";

export type ChargeSessionState = "charging" | "stopped" | "complete";

export interface ChargeSessionDetail {
  /** State of charge in percent. */
  charge: number;
  /** Energy added this session in kWh. */
  energy: number;
  /** Cost so far in the session currency. */
  cost: number;
  /** Charge limit in percent. */
  limit: number;
}

export interface ChargeSessionProps {
  title?: string;
  /** Secondary line under the title. Pass an empty string to hide it. */
  location?: string;
  /** Usable battery capacity in kWh. */
  capacity?: number;
  /** Peak charging power in kW. */
  maxPower?: number;
  /** State of charge in percent when the session starts. */
  startCharge?: number;
  defaultLimit?: number;
  minLimit?: number;
  /** State of charge in percent where the power starts to taper. */
  taperAt?: number;
  /** Price per kWh. */
  rate?: number;
  currency?: string;
  locale?: string;
  /** Multiplies simulated time. At 1, one second on screen is forty seconds of charging. */
  speed?: number;
  paused?: boolean;
  accent?: string;
  onStateChange?: (
    state: ChargeSessionState,
    detail: ChargeSessionDetail,
  ) => void;
  onLimitChange?: (limit: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/* Share of peak power from the taper point (first entry) to full (last entry). */
const TAPER = [
  1.0, 0.9951, 0.9877, 0.9779, 0.9672, 0.9557, 0.943, 0.9299, 0.9164, 0.902,
  0.8877, 0.8725, 0.8574, 0.8422, 0.8266, 0.8107, 0.7951, 0.7791, 0.7631,
  0.7475, 0.7316, 0.716, 0.7, 0.6844, 0.6693, 0.6537, 0.6385, 0.6234, 0.6086,
  0.5939, 0.5795, 0.5652, 0.5512, 0.5373, 0.5238, 0.5102, 0.4971, 0.4844,
  0.4717, 0.4594, 0.4471, 0.4352, 0.4234, 0.4123, 0.4012, 0.3902, 0.3795,
  0.3693, 0.359, 0.3492, 0.3398, 0.3303, 0.3209, 0.3123, 0.3037, 0.2951, 0.2869,
  0.2791, 0.2713, 0.2639, 0.2566, 0.2496, 0.2426, 0.2361, 0.2295, 0.2234,
  0.2172, 0.2115, 0.2057, 0.2, 0.1947, 0.1898, 0.1848, 0.1799, 0.175, 0.1705,
  0.1664, 0.1623, 0.1582, 0.1541, 0.1504, 0.1467, 0.1434, 0.1398, 0.1365,
  0.1336, 0.1303, 0.1275, 0.1246, 0.1221, 0.1193, 0.1168, 0.1143, 0.1123,
  0.1098, 0.1078, 0.1057, 0.1037, 0.102, 0.1, 0.0984,
];

const PACK_X = 244;
const PACK_W = 728;
const NUB_X = 212;
const POOL = 18;
const GAP = 65;
const TIME_SCALE = 40;

/* The cable from the charger to the nub, as an arc length table so packets keep an even pace. */
const CABLE = (() => {
  const p = [84, 176, 140, 238, 168, 120, 212, 120];
  const table: { x: number; y: number; s: number }[] = [];
  let s = 0;
  let px = p[0];
  let py = p[1];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const u = 1 - t;
    const x =
      u * u * u * p[0] +
      3 * u * u * t * p[2] +
      3 * u * t * t * p[4] +
      t * t * t * p[6];
    const y =
      u * u * u * p[1] +
      3 * u * u * t * p[3] +
      3 * u * t * t * p[5] +
      t * t * t * p[7];
    s += Math.hypot(x - px, y - py);
    table.push({ x, y, s });
    px = x;
    py = y;
  }
  return { table, length: s };
})();

function alongPath(d: number) {
  if (d >= CABLE.length) return { x: NUB_X + (d - CABLE.length), y: 120 };
  const t = CABLE.table;
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid].s < d) lo = mid;
    else hi = mid;
  }
  const k = (d - t[lo].s) / Math.max(1e-6, t[hi].s - t[lo].s);
  return {
    x: t[lo].x + (t[hi].x - t[lo].x) * k,
    y: t[lo].y + (t[hi].y - t[lo].y) * k,
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
};

function curveAt(soc: number, taperAt: number) {
  if (soc < 10) return 0.62 + (0.38 * (1 - Math.cos((Math.PI * soc) / 10))) / 2;
  if (soc <= taperAt) return 1;
  const u =
    clamp((soc - taperAt) / Math.max(1e-6, 100 - taperAt), 0, 1) *
    (TAPER.length - 1);
  const i = Math.min(TAPER.length - 2, Math.floor(u));
  return TAPER[i] + (TAPER[i + 1] - TAPER[i]) * (u - i);
}

function durationShort(minutes: number) {
  if (minutes < 1) return "Under 1 min";
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

function durationLong(minutes: number) {
  const m = Math.max(1, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (rest || !h) parts.push(`${rest} minute${rest === 1 ? "" : "s"}`);
  return `about ${parts.join(" ")} to go`;
}

/** A live charging session card for an EV or any device. */
export function ChargeSession({
  title = "Fast charger 4",
  location = "Harbor Street hub, 150 kW",
  capacity = 77,
  maxPower = 150,
  startCharge = 34,
  defaultLimit = 80,
  minLimit = 50,
  taperAt = 50,
  rate = 0.42,
  currency = "USD",
  locale = "en-US",
  speed = 1,
  paused = false,
  accent,
  onStateChange,
  onLimitChange,
  label,
  className,
  style,
}: ChargeSessionProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  /* React renders only this: the mode, the limit, and the charge at the moment either last changed. */
  const [view, setView] = useState(() => ({
    mode: "charging" as ChargeSessionState,
    limit: clamp(Math.round(defaultLimit), minLimit, 100),
    soc: startCharge,
  }));
  const [dragging, setDragging] = useState(false);
  const [byPointer, setByPointer] = useState(false);
  const [message, setMessage] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const sim = useRef({
    soc: startCharge,
    level: 1,
    mode: view.mode,
    limit: view.limit,
    flash: 0,
    emit: 0,
    packets: [] as number[],
  });
  /* Elements the loop writes to, found once by their data-el name. */
  const cache = useRef<{
    els: Record<string, Element | null>;
    packets: SVGCircleElement[];
  } | null>(null);

  const money = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency });
    } catch {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      });
    }
  }, [locale, currency]);

  const minutesTo = useCallback(
    (from: number, to: number) => {
      let hours = 0;
      for (let s = from; s < to; s += 0.25) {
        const step = Math.min(0.25, to - s);
        hours +=
          ((step / 100) * capacity) /
          Math.max(0.001, curveAt(s + step / 2, taperAt) * maxPower);
      }
      return hours * 60;
    },
    [capacity, maxPower, taperAt],
  );

  const detail = useCallback((): ChargeSessionDetail => {
    const s = sim.current;
    const energy = (Math.max(0, s.soc - startCharge) / 100) * capacity;
    return { charge: s.soc, energy, cost: energy * rate, limit: s.limit };
  }, [startCharge, capacity, rate]);

  const paint = useCallback(() => {
    const s = sim.current;
    const root = rootRef.current;
    if (!root) return;
    if (!cache.current) {
      const found: Record<string, Element | null> = {};
      root.querySelectorAll("[data-el]").forEach((el) => {
        found[el.getAttribute("data-el") as string] = el;
      });
      cache.current = {
        els: found,
        packets: [
          ...root.querySelectorAll<SVGCircleElement>("circle[data-in]"),
        ],
      };
    }
    const e = cache.current.els;
    const packetEls = cache.current.packets;
    const power = s.level * curveAt(s.soc, taperAt) * maxPower;
    const energy = (Math.max(0, s.soc - startCharge) / 100) * capacity;
    const pct = Math.floor(s.soc + 1e-6);
    const fillW = (PACK_W * s.soc) / 100;
    const front = PACK_X + fillW;
    const text = (name: string, value: string) => {
      const el = e[name];
      if (el && el.textContent !== value) el.textContent = value;
    };
    text("soc", `${pct}%`);
    text("at", `${Math.round(power)} kW at ${pct}%`);
    text("power", `${Math.round(power)} kW`);
    text("energy", `${energy.toFixed(1)} kWh`);
    text(
      "time",
      s.mode === "complete"
        ? "Done"
        : s.mode === "stopped"
          ? "Paused"
          : durationShort(minutesTo(s.soc, s.limit)),
    );
    text("cost", money.format(energy * rate));
    e.fill?.setAttribute("width", fillW.toFixed(2));
    e.front?.setAttribute("x1", front.toFixed(2));
    e.front?.setAttribute("x2", front.toFixed(2));
    (e.front as SVGElement | null)?.style.setProperty(
      "opacity",
      (0.5 + 0.2 * s.flash).toFixed(3),
    );
    (e.led as SVGElement | null)?.style.setProperty(
      "opacity",
      (0.18 + 0.82 * s.level).toFixed(3),
    );
    (e.core as SVGElement | null)?.style.setProperty(
      "opacity",
      (0.55 * s.level).toFixed(3),
    );
    e.done?.setAttribute(
      "width",
      Math.max(0, (s.soc - startCharge) * 10).toFixed(2),
    );
    const dot = e.dot as HTMLElement | null;
    dot?.style.setProperty("--x", s.soc.toFixed(3));
    dot?.style.setProperty(
      "--y",
      ((288 - 244 * (power / maxPower)) / 3).toFixed(3),
    );
    const total = CABLE.length + (front - NUB_X);
    for (let i = 0; i < POOL; i++) {
      const el = packetEls[i];
      if (!el) continue;
      const d = s.packets[i];
      if (d === undefined || d < 0) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        continue;
      }
      const at = alongPath(Math.min(d, total));
      el.setAttribute("cx", at.x.toFixed(2));
      el.setAttribute("cy", at.y.toFixed(2));
      el.setAttribute("r", (5.5 - smooth((at.x - 208) / 38)).toFixed(2));
      el.dataset.in = at.x >= 236 ? "in" : "out";
      el.style.opacity = Math.min(
        smooth(d / 26),
        clamp((front - at.x - 9) / 20, 0, 1),
      ).toFixed(2);
    }
  }, [taperAt, maxPower, startCharge, capacity, minutesTo, money, rate]);

  /* With reduced motion or when held, packets sit at even spacing to show direction. */
  const still = reduced || paused;
  const settle = useCallback(() => {
    const s = sim.current;
    s.level = s.mode === "charging" ? 1 : 0;
    s.flash = 0;
    const total = CABLE.length + (PACK_W * s.soc) / 100 + PACK_X - NUB_X;
    s.packets =
      s.mode === "charging"
        ? Array.from({ length: POOL }, (_, i) =>
            (i + 0.5) * GAP < total - 12 ? (i + 0.5) * GAP : -1,
          )
        : [];
  }, []);

  const changeMode = useCallback(
    (mode: ChargeSessionState, text: string) => {
      const s = sim.current;
      s.mode = mode;
      setView({ mode, limit: s.limit, soc: s.soc });
      setMessage(text);
      onStateChange?.(mode, detail());
    },
    [onStateChange, detail],
  );

  const summary = useCallback(() => {
    const d = detail();
    return `${d.energy.toFixed(1)} kWh added for ${money.format(d.cost)}.`;
  }, [detail, money]);

  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    io.observe(el);
    const onVisibility = () =>
      setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* One loop advances the session and writes attributes, variables and text directly. */
  useEffect(() => {
    if (still) {
      if (reduced) settle();
      paint();
      return;
    }
    if (!visible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      const target = s.mode === "charging" ? 1 : 0;
      s.level +=
        (target - s.level) * (1 - Math.exp(-dt / (target ? 0.37 : 0.24)));
      if (!target && s.level < 0.002) s.level = 0;
      const power = s.level * curveAt(s.soc, taperAt) * maxPower;
      if (speed > 0 && s.mode !== "complete")
        s.soc = Math.min(
          100,
          s.soc + ((power * dt * speed * TIME_SCALE) / 3600 / capacity) * 100,
        );
      if (s.mode === "charging" && s.soc >= s.limit) {
        s.soc = Math.max(s.limit, Math.min(s.soc, s.limit + 0.01));
        changeMode(
          "complete",
          `Charged to ${Math.floor(s.soc + 1e-6)}%. ${summary()}`,
        );
      }
      const front = PACK_X + (PACK_W * s.soc) / 100;
      const total = CABLE.length + (front - NUB_X);
      const pace = 120 + 180 * s.level;
      let moving = false;
      for (let i = 0; i < s.packets.length; i++) {
        const d = s.packets[i];
        if (d < 0) continue;
        moving = true;
        const left = total - d;
        const ease =
          d < 30
            ? 0.55 + 0.45 * (d / 30)
            : left < 48
              ? 0.4 + 0.6 * (left / 48)
              : 1;
        const next = d + pace * ease * dt;
        if (next >= total - 9) {
          s.packets[i] = -1;
          s.flash = 1;
        } else s.packets[i] = next;
      }
      s.flash *= Math.exp(-dt / 0.22);
      if (s.mode === "charging") {
        s.emit += (dt * s.level * 300) / GAP;
        if (s.emit >= 1) {
          s.emit -= 1;
          let slot = s.packets.findIndex((d) => d < 0);
          if (slot < 0 && s.packets.length < POOL) slot = s.packets.length;
          if (slot >= 0) s.packets[slot] = 0;
        }
      }
      paint();
      /* The loop stops once the flow has fully drained. */
      if (target || s.level > 0 || moving || s.flash > 0.01)
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    still,
    reduced,
    visible,
    view.mode,
    taperAt,
    maxPower,
    capacity,
    speed,
    paint,
    settle,
    changeMode,
    summary,
  ]);

  const applyStill = () => {
    if (!still) return;
    if (reduced) settle();
    paint();
  };

  /* The limit: one to one while dragging, announced once it settles. */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => void (settleTimer.current && clearTimeout(settleTimer.current)),
    [],
  );
  const setLimit = (raw: number, settleNow = true) => {
    const s = sim.current;
    const next = clamp(Math.round(raw), minLimit, 100);
    if (next === s.limit) return;
    s.limit = next;
    let mode = s.mode;
    if (mode === "complete" && next > s.soc + 0.01) mode = "charging";
    else if (mode === "charging" && next <= s.soc) mode = "complete";
    const changed = mode !== s.mode;
    s.mode = mode;
    setView({ mode, limit: next, soc: s.soc });
    if (changed) onStateChange?.(mode, detail());
    applyStill();
    if (settleNow) queueSettle();
  };
  const queueSettle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const s = sim.current;
      onLimitChange?.(s.limit);
      setMessage(
        s.mode === "complete" || s.limit <= s.soc
          ? `Charge limit ${s.limit}%.`
          : `Charge limit ${s.limit}%. ${durationLong(minutesTo(s.soc, s.limit))} at full power.`,
      );
    }, 400);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const limit = sim.current.limit;
    const big = event.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp")
      next = limit + big;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
      next = limit - big;
    else if (event.key === "PageUp") next = limit + 10;
    else if (event.key === "PageDown") next = limit - 10;
    else if (event.key === "Home") next = minLimit;
    else if (event.key === "End") next = 100;
    if (next === null) return;
    event.preventDefault();
    setByPointer(false);
    setLimit(next);
  };

  const fromPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
    surface: string,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const k = (event.clientX - rect.left) / Math.max(1, rect.width);
    return surface === "plot" ? k * 100 : ((k * 1000 - PACK_X) / PACK_W) * 100;
  };
  const onDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    surface: "hero" | "plot",
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    setByPointer(true);
    rootRef.current
      ?.querySelector<HTMLElement>('[role="slider"]')
      ?.focus({ preventScroll: true });
    setLimit(fromPointer(event, surface), false);
    event.preventDefault();
  };
  const onMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    surface: "hero" | "plot",
  ) => {
    if (dragging) setLimit(fromPointer(event, surface), false);
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    queueSettle();
  };

  const act = () => {
    const s = sim.current;
    if (s.mode === "charging") {
      changeMode(
        "stopped",
        `Charging stopped at ${Math.floor(s.soc + 1e-6)}%. ${summary()}`,
      );
    } else if (s.mode === "stopped") {
      if (s.soc >= s.limit)
        changeMode(
          "complete",
          `Charged to ${Math.floor(s.soc + 1e-6)}%. ${summary()}`,
        );
      else changeMode("charging", `Charging resumed to ${s.limit}%.`);
    } else {
      s.soc = startCharge;
      s.packets = [];
      s.emit = 0;
      if (s.limit <= s.soc)
        s.limit = clamp(Math.round(defaultLimit), minLimit, 100);
      changeMode(
        "charging",
        `New session started at ${Math.floor(startCharge)}%, charging to ${s.limit}%.`,
      );
    }
    applyStill();
  };

  const { mode, limit } = view;
  const limitX = PACK_X + (PACK_W * limit) / 100;
  const curve = useMemo(() => {
    let d = "";
    for (let i = 0; i <= 200; i++) {
      const s = i / 2;
      d += `${i ? " L" : "M"} ${(s * 10).toFixed(1)} ${(288 - 244 * curveAt(s, taperAt)).toFixed(1)}`;
    }
    return d;
  }, [taperAt]);
  const startPower =
    curveAt(view.soc, taperAt) * maxPower * (mode === "charging" ? 1 : 0);
  const startEnergy = (Math.max(0, view.soc - startCharge) / 100) * capacity;
  const pct = Math.floor(view.soc + 1e-6);
  const eta =
    mode !== "complete" && limit > view.soc ? minutesTo(view.soc, limit) : null;
  const StatusIcon =
    mode === "charging" ? Zap : mode === "stopped" ? Square : BatteryFull;
  const ActionIcon =
    mode === "charging" ? Square : mode === "stopped" ? Zap : RotateCcw;
  const rootStyle = accent
    ? ({ "--cs-accent": accent, ...style } as CSSProperties)
    : style;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label ?? title}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-mode={mode}
      data-dragging={dragging ? "" : undefined}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <h3 className={styles.title}>{title}</h3>
            {location ? <p className={styles.location}>{location}</p> : null}
          </div>
          <div className={styles.charge}>
            <span className={styles.soc} data-el="soc" suppressHydrationWarning>
              {pct}%
            </span>
            <span className={styles.status} data-mode={mode}>
              <StatusIcon
                size={mode === "stopped" ? 14 : 16}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {mode === "charging"
                ? "Charging"
                : mode === "stopped"
                  ? "Stopped"
                  : "Charged to limit"}
            </span>
          </div>
        </header>

        <div
          className={styles.hero}
          data-surface="hero"
          onPointerDown={(e) => onDown(e, "hero")}
          onPointerMove={(e) => onMove(e, "hero")}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <svg
            className={styles.heroSvg}
            viewBox="0 0 1000 240"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
                <stop className={styles.m1} offset="0" />
                <stop className={styles.m2} offset=".3" />
                <stop className={styles.m3} offset=".55" />
                <stop className={styles.m4} offset=".8" />
                <stop className={styles.m5} offset="1" />
              </linearGradient>
              <clipPath id={`${uid}-pack`}>
                <rect x={PACK_X} y="32" width={PACK_W} height="176" rx="32" />
              </clipPath>
            </defs>
            <rect
              className={styles.post}
              x="12"
              y="28"
              width="72"
              height="184"
              rx="18"
              fill={`url(#${uid}-metal)`}
            />
            <rect
              className={styles.screen}
              x="28"
              y="46"
              width="40"
              height="24"
              rx="6"
            />
            <rect
              className={styles.led}
              data-el="led"
              x="44"
              y="96"
              width="8"
              height="56"
              rx="4"
              style={{ opacity: mode === "charging" ? 1 : 0.18 }}
            />
            <path
              className={styles.cable}
              d="M 84 176 C 140 238 168 120 212 120"
            />
            <path
              className={styles.core}
              data-el="core"
              d="M 84 176 C 140 238 168 120 212 120"
              style={{ opacity: mode === "charging" ? 0.55 : 0 }}
            />
            <rect
              className={styles.holster}
              x="72"
              y="166"
              width="18"
              height="20"
              rx="5"
            />
            <rect
              className={styles.nub}
              x="210"
              y="96"
              width="42"
              height="48"
              rx="10"
            />
            <rect
              className={styles.shell}
              x="232"
              y="20"
              width="752"
              height="200"
              rx="44"
            />
            <g clipPath={`url(#${uid}-pack)`}>
              <rect
                className={styles.well}
                x={PACK_X}
                y="32"
                width={PACK_W}
                height="176"
              />
              <rect
                className={styles.fill}
                data-el="fill"
                x={PACK_X}
                y="32"
                width={((PACK_W * view.soc) / 100).toFixed(2)}
                height="176"
                suppressHydrationWarning
              />
              <rect
                className={styles.beyond}
                x={limitX.toFixed(2)}
                y="32"
                width={(PACK_X + PACK_W - limitX).toFixed(2)}
                height="176"
              />
              {Array.from({ length: 9 }, (_, i) => {
                const x = PACK_X + (PACK_W * (i + 1)) / 10;
                return (
                  <line
                    key={i}
                    className={styles.cell}
                    x1={x}
                    x2={x}
                    y1="46"
                    y2="194"
                  />
                );
              })}
              <line
                className={styles.front}
                data-el="front"
                x1={(PACK_X + (PACK_W * view.soc) / 100).toFixed(2)}
                x2={(PACK_X + (PACK_W * view.soc) / 100).toFixed(2)}
                y1="32"
                y2="208"
                style={{ opacity: 0.5 }}
                suppressHydrationWarning
              />
            </g>
            <path className={styles.sheen} d="M 276 25 H 940" />
            <line
              className={styles.limitLine}
              x1={limitX.toFixed(2)}
              x2={limitX.toFixed(2)}
              y1="20"
              y2="220"
            />
            <g className={styles.packets}>
              {Array.from({ length: POOL }, (_, i) => (
                <circle
                  key={i}
                  className={styles.packet}
                  cx="84"
                  cy="176"
                  r="5.5"
                  data-in="out"
                  style={{ opacity: 0 }}
                  suppressHydrationWarning
                />
              ))}
            </g>
          </svg>
          <div
            className={styles.handle}
            role="slider"
            tabIndex={0}
            aria-label="Charge limit"
            aria-valuemin={minLimit}
            aria-valuemax={100}
            aria-valuenow={limit}
            aria-valuetext={
              eta === null
                ? `Charge limit ${limit}%`
                : `Charge limit ${limit}%, ${durationLong(eta)}`
            }
            aria-describedby={`${uid}-hint`}
            data-pointer={byPointer ? "" : undefined}
            style={{ "--x": (limitX / 10).toFixed(3) } as CSSProperties}
            onKeyDown={onKeyDown}
            onBlur={() => setByPointer(false)}
          >
            <span className={styles.pill}>{limit}%</span>
          </div>
        </div>

        <div className={styles.lower}>
          <section className={styles.curve} aria-label="Charge curve">
            <div className={styles.curveHead}>
              <span className={styles.curveTitle}>Charge curve</span>
              <span
                className={styles.curveAt}
                data-el="at"
                aria-hidden="true"
                suppressHydrationWarning
              >
                {Math.round(startPower)} kW at {pct}%
              </span>
            </div>
            <div
              className={styles.plot}
              data-surface="plot"
              aria-hidden="true"
              onPointerDown={(e) => onDown(e, "plot")}
              onPointerMove={(e) => onMove(e, "plot")}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <svg
                className={styles.plotSvg}
                viewBox="0 0 1000 300"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id={`${uid}-area`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop className={styles.areaTop} offset="0" />
                    <stop className={styles.areaBottom} offset="1" />
                  </linearGradient>
                  <clipPath id={`${uid}-done`}>
                    <rect
                      data-el="done"
                      x={(startCharge * 10).toFixed(2)}
                      y="0"
                      width={Math.max(0, (view.soc - startCharge) * 10).toFixed(
                        2,
                      )}
                      height="300"
                      suppressHydrationWarning
                    />
                  </clipPath>
                </defs>
                <line
                  className={styles.grid}
                  x1="0"
                  x2="1000"
                  y1="44"
                  y2="44"
                />
                <line
                  className={styles.grid}
                  x1="0"
                  x2="1000"
                  y1="166"
                  y2="166"
                />
                <line
                  className={styles.axis}
                  x1="0"
                  x2="1000"
                  y1="288"
                  y2="288"
                />
                <rect
                  className={styles.curveBeyond}
                  x={(limit * 10).toFixed(2)}
                  y="0"
                  width={((100 - limit) * 10).toFixed(2)}
                  height="288"
                />
                <path
                  d={`${curve} L 1000 288 L 0 288 Z`}
                  fill={`url(#${uid}-area)`}
                  clipPath={`url(#${uid}-done)`}
                />
                <path className={styles.curveLine} d={curve} />
                <path
                  className={styles.curveDone}
                  d={curve}
                  clipPath={`url(#${uid}-done)`}
                />
                <line
                  className={styles.curveLimit}
                  x1={(limit * 10).toFixed(2)}
                  x2={(limit * 10).toFixed(2)}
                  y1="14"
                  y2="288"
                />
              </svg>
              <span className={styles.yLabel} style={{ top: `${44 / 3}%` }}>
                {maxPower} kW
              </span>
              <span className={styles.xLabel} data-edge="start">
                0%
              </span>
              <span className={styles.xLabel} style={{ left: "50%" }}>
                50%
              </span>
              <span className={styles.xLabel} data-edge="end">
                100%
              </span>
              <span
                className={styles.dot}
                data-el="dot"
                style={
                  {
                    "--x": view.soc.toFixed(3),
                    "--y": ((288 - 244 * (startPower / maxPower)) / 3).toFixed(
                      3,
                    ),
                  } as CSSProperties
                }
                suppressHydrationWarning
              />
            </div>
          </section>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Power</dt>
              <dd data-el="power" suppressHydrationWarning>
                {Math.round(startPower)} kW
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Energy added</dt>
              <dd data-el="energy" suppressHydrationWarning>
                {startEnergy.toFixed(1)} kWh
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Time to {limit}%</dt>
              <dd data-el="time" suppressHydrationWarning>
                {mode === "complete"
                  ? "Done"
                  : mode === "stopped"
                    ? "Paused"
                    : durationShort(eta ?? 0)}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Cost</dt>
              <dd data-el="cost" suppressHydrationWarning>
                {money.format(startEnergy * rate)}
              </dd>
            </div>
          </dl>
        </div>

        <footer className={styles.footer}>
          <p className={styles.hint} id={`${uid}-hint`}>
            Drag across the pack or the curve to set the charge limit.
          </p>
          <button
            type="button"
            className={styles.action}
            data-mode={mode}
            onClick={act}
          >
            <span className={styles.actionIcon} aria-hidden="true">
              <ActionIcon
                size={mode === "charging" ? 14 : 16}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </span>
            <span className={styles.actionLabels}>
              {(["charging", "stopped", "complete"] as const).map((m) => (
                <span
                  key={m}
                  className={styles.actionLabel}
                  data-active={mode === m ? "" : undefined}
                  aria-hidden={mode === m ? undefined : true}
                >
                  {m === "charging"
                    ? "Stop charging"
                    : m === "stopped"
                      ? "Resume charging"
                      : "Start new session"}
                </span>
              ))}
            </span>
          </button>
        </footer>
      </div>
      <p className={styles.sr} role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

export default ChargeSession;
