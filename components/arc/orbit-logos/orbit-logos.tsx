"use client";

import { isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./orbit-logos.module.css";

export interface OrbitLogo {
  id?: string;
  name: string;
  /** SVG path data on a 24 by 24 viewBox, an image URL, or any node. */
  icon: string | ReactNode;
  color?: string;
  category?: string;
  description?: string;
  connected?: boolean;
  href?: string;
}

export interface OrbitLogosProps {
  logos: OrbitLogo[];
  center?: ReactNode;
  onSelect?: (logo: OrbitLogo | null, index: number) => void;
  onConnect?: (logo: OrbitLogo, index: number) => void | Promise<unknown>;
  defaultSelected?: string | null;
  selected?: string | null;
  speed?: number;
  paused?: boolean;
  allLabel?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Status = "idle" | "connecting" | "connected" | "error";

const PERIODS = [64, 88];
const SIDE_AT = 760;
const MAX_STAGE = 460;
const SIMULATED_MS = 1200;
const MORPH = { type: "spring", duration: 0.5, bounce: 0.16 } as const;
const QUICK = { type: "spring", duration: 0.3, bounce: 0 } as const;

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const keyOf = (logo: OrbitLogo) => logo.id ?? logo.name;
const isPath = (icon: string) => /^[mM][\s\d.,-]/.test(icon);
const mod = (value: number, by: number) => ((value % by) + by) % by;
/** Signed shortest turn from one angle to another, in degrees. */
const shortest = (from: number, to: number) => mod(to - from + 180, 360) - 180;

function Mark({ logo }: { logo: OrbitLogo }) {
  const { icon } = logo;
  if (typeof icon === "string") {
    if (isPath(icon)) {
      return (
        <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
          <path d={icon} fill={logo.color ?? "currentColor"} />
        </svg>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.mark} src={icon} alt="" draggable={false} />;
  }
  return isValidElement(icon) ? <span className={styles.mark}>{icon}</span> : <>{icon}</>;
}

interface Ring {
  angle: number;
  velocity: number;
  goal: number | null;
}

interface Slot {
  ring: 0 | 1;
  step: number;
  offset: number;
}

export function OrbitLogos({
  logos,
  center,
  onSelect,
  onConnect,
  defaultSelected = null,
  selected: selectedProp,
  speed = 1,
  paused = false,
  allLabel = "All",
  label = "Integrations",
  className,
  style,
}: OrbitLogosProps) {
  const reduced = useReducedMotion();
  const groupId = useId();
  const [selectedState, setSelectedState] = useState<string | null>(defaultSelected);
  const [category, setCategory] = useState<string | null>(null);
  const [focused, setFocused] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [layout, setLayout] = useState<"stack" | "side">("stack");
  const [size, setSize] = useState(MAX_STAGE);
  const [ready, setReady] = useState(false);
  const [direction, setDirection] = useState(1);
  const [message, setMessage] = useState("");

  const selectedKey = selectedProp !== undefined ? selectedProp : selectedState;
  const selectedIndex = selectedKey === null ? -1 : logos.findIndex(logo => keyOf(logo) === selectedKey);
  const selectedLogo = selectedIndex < 0 ? null : logos[selectedIndex];

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const logo of logos) if (logo.category && !seen.includes(logo.category)) seen.push(logo.category);
    return seen;
  }, [logos]);

  const slots = useMemo<Slot[]>(() => {
    const total = logos.length;
    const inner = total <= 6 ? total : Math.max(3, Math.round(total * 0.36));
    const outer = total - inner;
    return logos.map((_, i) =>
      i < inner
        ? { ring: 0, step: 360 / inner, offset: (360 / inner) * i }
        : { ring: 1, step: 360 / Math.max(1, outer), offset: (360 / Math.max(1, outer)) * (i - inner) },
    );
  }, [logos]);

  const statusOf = useCallback((logo: OrbitLogo): Status => statuses[keyOf(logo)] ?? (logo.connected ? "connected" : "idle"), [statuses]);
  const matches = useCallback((logo: OrbitLogo) => category === null || logo.category === category, [category]);
  const visible = useMemo(() => logos.map((logo, i) => (matches(logo) ? i : -1)).filter(i => i >= 0), [logos, matches]);

  const tile = size < 380 ? 44 : 52;
  const core = Math.round(size * 0.17);
  const outerRadius = size / 2 - tile / 2 - 2;
  const radii = useMemo(() => [outerRadius * 0.57, outerRadius], [outerRadius]);
  const park = layout === "side" ? 0 : 90;

  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const line = useRef<SVGLineElement>(null);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const frame = useRef(0);
  const engine = useRef({
    rings: [{ angle: -20, velocity: 0, goal: null }, { angle: -19, velocity: 0, goal: null }] as Ring[],
    drift: 1,
    held: false,
    hover: false,
    focus: false,
    onscreen: true,
    selected: -1,
    reach: 0,
    last: 0,
  });
  const live = useRef({ slots, radii, size, tile, speed, reduced, paused });
  useLayoutEffect(() => {
    live.current = { slots, radii, size, tile, speed, reduced, paused };
  });

  const paint = useCallback(() => {
    const state = engine.current;
    const { slots: all, radii: r, size: s, tile: t } = live.current;
    const half = s / 2;
    all.forEach((slot, i) => {
      const node = chips.current[i];
      if (!node) return;
      const theta = ((state.rings[slot.ring].angle + slot.offset) * Math.PI) / 180;
      const x = half + r[slot.ring] * Math.cos(theta);
      const y = half + r[slot.ring] * Math.sin(theta);
      node.style.transform = `translate3d(${(x - t / 2).toFixed(2)}px, ${(y - t / 2).toFixed(2)}px, 0px)`;
      const tag = y < half ? "above" : "below";
      if (node.dataset.tag !== tag) node.dataset.tag = tag;
      if (i === state.selected && line.current) {
        const reach = (r[slot.ring] - t / 2 - 6) * state.reach;
        line.current.setAttribute("x2", (half + reach * Math.cos(theta)).toFixed(2));
        line.current.setAttribute("y2", (half + reach * Math.sin(theta)).toFixed(2));
      }
    });
    if (state.selected < 0 && line.current) {
      line.current.setAttribute("x2", String(half));
      line.current.setAttribute("y2", String(half));
    }
  }, []);

  const wake = useCallback(() => {
    if (frame.current) return;
    const state = engine.current;
    state.last = 0;
    const tick = (now: number) => {
      const config = live.current;
      const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      const hold = state.held || state.hover || state.focus || config.paused || config.reduced || config.speed === 0;
      // The turn eases to rest and back on a critically damped curve.
      state.drift += ((hold ? 0 : 1) - state.drift) * (1 - Math.exp(-dt * 7));
      let moving = Math.abs(state.drift) > 0.002;
      state.rings.forEach((ring, i) => {
        if (ring.goal !== null) {
          if (config.reduced) {
            ring.angle = ring.goal;
            ring.velocity = 0;
          } else {
            const force = 150 * (ring.goal - ring.angle) - 19 * ring.velocity;
            ring.velocity += force * dt;
            ring.angle += ring.velocity * dt;
            if (Math.abs(ring.goal - ring.angle) < 0.02 && Math.abs(ring.velocity) < 0.05) {
              ring.angle = ring.goal;
              ring.velocity = 0;
            } else moving = true;
          }
        } else {
          ring.angle += (360 / PERIODS[i]) * config.speed * state.drift * dt;
        }
      });
      const reachGoal = state.selected >= 0 ? 1 : 0;
      state.reach = config.reduced ? reachGoal : state.reach + (reachGoal - state.reach) * (1 - Math.exp(-dt * 12));
      if (Math.abs(reachGoal - state.reach) > 0.002) moving = true;
      else state.reach = reachGoal;
      paint();
      frame.current = moving && state.onscreen && !document.hidden ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  // Size, layout and visibility.
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const next = width >= SIDE_AT ? "side" : "stack";
      setLayout(next);
      setSize(Math.max(240, Math.min(MAX_STAGE, next === "side" ? width * 0.55 : width)));
      setReady(true);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    const seen = new IntersectionObserver(([entry]) => {
      engine.current.onscreen = entry.isIntersecting;
      if (entry.isIntersecting) wake();
    });
    seen.observe(node);
    const onVisible = () => { if (!document.hidden) wake(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      resize.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [wake]);

  // Ring goals follow the open logo, then the category.
  useLayoutEffect(() => {
    const state = engine.current;
    const aim = (ringIndex: number, offset: number, at: number) => {
      const ring = state.rings[ringIndex];
      ring.goal = ring.angle + shortest(ring.angle + offset, at);
    };
    state.selected = selectedIndex;
    state.held = selectedIndex >= 0 || category !== null;
    if (selectedIndex >= 0) {
      const slot = slots[selectedIndex];
      aim(slot.ring, slot.offset, park);
      if (slot.ring === 1) {
        // The inner ring steps aside so the connector stays clear.
        const first = slots[0];
        const ring = state.rings[0];
        const gap = mod(park + first.step / 2 - ring.angle + first.step / 2, first.step) - first.step / 2;
        ring.goal = ring.angle + gap;
      } else state.rings[1].goal = state.rings[1].goal === null ? null : state.rings[1].angle;
    } else if (category !== null) {
      ([0, 1] as const).forEach(ringIndex => {
        const found = slots.filter((slot, i) => slot.ring === ringIndex && logos[i].category === category);
        if (!found.length) return;
        const ring = state.rings[ringIndex];
        let sx = 0;
        let sy = 0;
        for (const slot of found) {
          sx += Math.cos((slot.offset * Math.PI) / 180);
          sy += Math.sin((slot.offset * Math.PI) / 180);
        }
        const mean = Math.hypot(sx, sy) > 0.2 ? (Math.atan2(sy, sx) * 180) / Math.PI : found[0].offset;
        const nearest = found.reduce((best, slot) => (Math.abs(shortest(slot.offset, mean)) < Math.abs(shortest(best.offset, mean)) ? slot : best));
        aim(ringIndex, nearest.offset, park);
        void ring;
      });
    } else {
      state.rings.forEach(ring => { ring.goal = null; ring.velocity = 0; });
    }
    wake();
  }, [selectedIndex, category, slots, logos, park, wake]);

  useLayoutEffect(() => {
    paint();
    wake();
  }, [paint, wake, size, tile, radii, reduced, paused, speed]);

  const select = useCallback((index: number, from?: number) => {
    const logo = index < 0 ? null : logos[index];
    if (logo && from !== undefined) setDirection(from);
    if (selectedProp === undefined) setSelectedState(logo ? keyOf(logo) : null);
    if (logo) setFocused(index);
    setMessage(logo ? `${logo.name} open${logo.description ? `, ${logo.description}` : ""}` : "");
    onSelect?.(logo, index);
  }, [logos, onSelect, selectedProp]);

  const step = useCallback((delta: number, focus: boolean, edge?: "first" | "last") => {
    if (!visible.length) return;
    const current = selectedIndex >= 0 ? selectedIndex : focused;
    const at = visible.indexOf(current);
    const next = edge === "first" ? visible[0]
      : edge === "last" ? visible[visible.length - 1]
      : visible[mod((at < 0 ? (delta > 0 ? -1 : 0) : at) + delta, visible.length)];
    setFocused(next);
    if (selectedIndex >= 0) select(next, delta >= 0 ? 1 : -1);
    if (focus) chips.current[next]?.focus({ preventScroll: true });
  }, [visible, selectedIndex, focused, select]);

  const close = useCallback((refocus: boolean) => {
    const index = selectedIndex;
    select(-1);
    if (refocus && index >= 0) chips.current[index]?.focus({ preventScroll: true });
  }, [select, selectedIndex]);

  const pickCategory = (next: string | null) => {
    setCategory(next);
    const inside = logos.filter(logo => next === null || logo.category === next);
    setMessage(next === null ? `${inside.length} in ${allLabel}` : `${inside.length} in ${next}`);
    if (selectedLogo && next !== null && selectedLogo.category !== next) select(-1);
    const first = logos.findIndex(logo => next === null || logo.category === next);
    if (first >= 0 && (next !== null && logos[focused]?.category !== next)) setFocused(first);
  };

  const onChipKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") step(1, true);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") step(-1, true);
    else if (event.key === "Home") step(0, true, "first");
    else if (event.key === "End") step(0, true, "last");
    else return;
    event.preventDefault();
  };

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const connect = async (logo: OrbitLogo, index: number) => {
    const key = keyOf(logo);
    const set = (status: Status) => { if (alive.current) setStatuses(previous => ({ ...previous, [key]: status })); };
    set("connecting");
    try {
      const result = onConnect?.(logo, index);
      if (result && typeof (result as Promise<unknown>).then === "function") await result;
      else await new Promise(resolve => setTimeout(resolve, SIMULATED_MS));
      set("connected");
      if (alive.current) setMessage(`${logo.name} connected`);
    } catch {
      set("error");
      if (alive.current) setMessage(`${logo.name} could not connect`);
    }
  };

  const scoped = logos.filter(matches);
  const connectedInScope = scoped.filter(logo => statusOf(logo) === "connected").length;
  const connectedTotal = logos.filter(logo => statusOf(logo) === "connected").length;
  const tabStop = selectedIndex >= 0 ? selectedIndex : visible.includes(focused) ? focused : visible[0] ?? 0;
  const status = selectedLogo ? statusOf(selectedLogo) : "idle";
  const hold = (key: "hover" | "focus", value: boolean) => {
    engine.current[key] = value;
    wake();
  };

  return (
    <div
      ref={root}
      className={cx(styles.root, className)}
      style={style}
      data-layout={layout}
      data-ready={ready || undefined}
      onFocus={() => hold("focus", true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hold("focus", false); }}
      onKeyDown={event => {
        if (event.key === "Escape" && selectedIndex >= 0) {
          event.stopPropagation();
          close(true);
        }
      }}
    >
      {categories.length ? (
        <LayoutGroup id={groupId}>
          <div className={styles.categories} role="toolbar" aria-label="Filter by category">
            {[null, ...categories].map(item => {
              const on = item === category;
              return (
                <button key={item ?? "__all"} type="button" className={styles.category} aria-pressed={on} data-on={on || undefined} onClick={() => pickCategory(item)}>
                  {on ? <motion.span layoutId="pill" className={styles.pill} transition={reduced ? { duration: 0 } : MORPH} /> : null}
                  <span className={styles.categoryLabel}>{item ?? allLabel}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      ) : null}

      <div className={styles.body}>
        <div
          ref={stage}
          className={styles.stage}
          style={{ "--tile": `${tile}px`, "--core": `${core}px`, width: size, height: size } as CSSProperties}
          onPointerEnter={event => { if (event.pointerType !== "touch") hold("hover", true); }}
          onPointerLeave={() => hold("hover", false)}
        >
          <svg className={styles.rings} width={size} height={size} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={radii[0]} />
            <circle cx={size / 2} cy={size / 2} r={radii[1]} />
            <line ref={line} className={styles.connector} x1={size / 2} y1={size / 2} x2={size / 2} y2={size / 2} style={{ opacity: selectedIndex >= 0 ? 1 : 0 }} />
          </svg>
          <div className={styles.core} style={{ left: (size - core) / 2, top: (size - core) / 2 }}>
            {center ?? (
              <svg viewBox="0 0 32 32" width="46%" height="46%" aria-hidden="true">
                <circle cx="16" cy="16" r="5" fill="currentColor" />
                <circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeDasharray="4 3.2" />
              </svg>
            )}
          </div>
          <ul className={styles.list} aria-label={label}>
            {logos.map((logo, i) => {
              const match = matches(logo);
              const connected = statusOf(logo) === "connected";
              return (
                <li key={keyOf(logo)} className={styles.slot}>
                  <button
                    ref={node => { chips.current[i] = node; }}
                    type="button"
                    className={styles.chip}
                    tabIndex={i === tabStop ? 0 : -1}
                    aria-pressed={i === selectedIndex}
                    aria-label={[logo.name, logo.category, connected ? "connected" : null].filter(Boolean).join(", ")}
                    data-dim={category !== null && !match ? "true" : undefined}
                    data-match={category !== null && match ? "true" : undefined}
                    data-selected={i === selectedIndex || undefined}
                    onFocus={() => setFocused(i)}
                    onKeyDown={onChipKey}
                    onClick={() => (i === selectedIndex ? close(false) : select(i, i > selectedIndex ? 1 : -1))}
                  >
                    <span className={styles.face}>
                      <Mark logo={logo} />
                      {connected ? <span className={styles.dot} aria-hidden="true" /> : null}
                    </span>
                    <span className={styles.tag} aria-hidden="true">{logo.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.panel}>
          <AnimatePresence initial={false} mode="popLayout">
            {selectedLogo ? (
              <motion.div
                key="card"
                className={styles.card}
                role="region"
                aria-label={`${selectedLogo.name} details`}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={reduced ? { duration: 0 } : QUICK}
              >
                <motion.span
                  className={styles.cardShell}
                  aria-hidden="true"
                  initial={reduced ? false : { opacity: 0, scaleX: 0.14, scaleY: 0.34, borderRadius: 120 }}
                  animate={{ opacity: 1, scaleX: 1, scaleY: 1, borderRadius: 22 }}
                  transition={reduced ? { duration: 0 } : MORPH}
                />
                <motion.div
                  className={styles.cardBody}
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.2, delay: 0.14 }}
                >
                  <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                    <motion.div
                      key={keyOf(selectedLogo)}
                      className={styles.cardContent}
                      custom={direction}
                      variants={{
                        enter: (dir: number) => (reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: dir * 18 }),
                        rest: { opacity: 1, x: 0 },
                        exit: (dir: number) => (reduced ? { opacity: 0, x: 0 } : { opacity: 0, x: dir * -18 }),
                      }}
                      initial="enter"
                      animate="rest"
                      exit="exit"
                      transition={reduced ? { duration: 0 } : QUICK}
                    >
                      <div className={styles.cardHead}>
                        <span className={styles.cardMark}><Mark logo={selectedLogo} /></span>
                        <div className={styles.cardTitle}>
                          <p className={styles.cardName}>{selectedLogo.name}</p>
                          {selectedLogo.category ? <p className={styles.cardCategory}>{selectedLogo.category}</p> : null}
                        </div>
                      </div>
                      <p className={styles.cardText}>{selectedLogo.description}</p>
                      <div className={styles.cardFoot}>
                        <span className={styles.status} data-status={status}>
                          {status === "connected"
                            ? <Check size={14} strokeWidth={2} aria-hidden="true" />
                            : <span className={styles.statusDot} aria-hidden="true" />}
                          {status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : status === "error" ? "Could not connect" : "Not connected"}
                        </span>
                        <span className={styles.actions}>
                          {selectedLogo.href ? (
                            <a className={styles.docs} href={selectedLogo.href} target="_blank" rel="noreferrer noopener">
                              Docs
                              <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
                            </a>
                          ) : null}
                          {status !== "connected" ? (
                            <button
                              type="button"
                              className={styles.connect}
                              aria-disabled={status === "connecting" || undefined}
                              onClick={() => { if (status !== "connecting") void connect(selectedLogo, selectedIndex); }}
                            >
                              <AnimatePresence initial={false} mode="popLayout">
                                <motion.span
                                  key={status}
                                  className={styles.connectLabel}
                                  initial={reduced ? false : { opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                                  transition={reduced ? { duration: 0 } : QUICK}
                                >
                                  {status === "connecting" ? "Connecting" : status === "error" ? "Try again" : "Connect"}
                                </motion.span>
                              </AnimatePresence>
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <div className={styles.cardNav}>
                    <button type="button" className={styles.iconButton} aria-label="Previous integration" onClick={() => step(-1, false)}>
                      <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.iconButton} aria-label="Next integration" onClick={() => step(1, false)}>
                      <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => close(true)}>
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                className={styles.idle}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.18 }}
              >
                <p className={styles.idleTitle}>{category ?? label}</p>
                <p className={styles.idleMeta}>
                  <span className={styles.num}>{scoped.length}</span> integrations, <span className={styles.num}>{connectedInScope}</span> connected
                </p>
                <p className={styles.idleHint}>
                  Pick a logo to see what it does and connect it.<span className={styles.keysHint}> Arrow keys step through them.</span>
                </p>
                <span className={styles.srOnly}>{connectedTotal} of {logos.length} connected in total</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">{message}</p>
    </div>
  );
}

export default OrbitLogos;
