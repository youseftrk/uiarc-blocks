"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown as IconDown, ArrowUp as IconUp, Minus as IconFlat } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./metric-ticker.module.css";

export interface TickerMetric {
  id: string;
  label: string;
  value: number;
  /** Number format for the value, such as currency, percent or a unit. */
  format?: Intl.NumberFormatOptions;
  /** How the change reads: relative to the previous value, or as the raw difference. */
  delta?: "percent" | "absolute";
  /** Which direction is good news. */
  positive?: "up" | "down";
  /** Recent values, oldest first, for the sparkline. */
  history?: readonly number[];
  caption?: string;
}

export interface MetricTickerProps {
  metrics: readonly TickerMetric[];
  overflow?: "marquee" | "scroll";
  speed?: number;
  flashDuration?: number;
  historyLength?: number;
  locale?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, value => ((((digit - value) % 10) + 15) % 10) - 5);
  const y = useTransform(offset, value => `${value}em`);
  const opacity = useTransform(offset, value => Math.max(0, 1 - 1.2 * Math.abs(value)));
  return (
    <motion.span className={styles.glyph} style={{ y, opacity }}>
      {digit}
    </motion.span>
  );
}

function Wheel({ digit, direction, delay, reduceMotion }: { digit: number; direction: number; delay: number; reduceMotion: boolean }) {
  const position = useMotionValue(digit);
  const state = useRef({ digit, target: digit });
  useEffect(() => {
    const s = state.current;
    if (s.digit === digit) return;
    s.target += direction < 0 ? -((s.digit - digit + 10) % 10) : (digit - s.digit + 10) % 10;
    s.digit = digit;
    if (reduceMotion) return void position.jump(s.target);
    const controls = animate(position, s.target, { ...motionTokens.spring.smooth, delay });
    return () => controls.stop();
  }, [delay, digit, direction, position, reduceMotion]);
  return (
    <span className={styles.wheel}>
      <span className={styles.sizer}>0</span>
      {DIGITS.map(value => (
        <Glyph key={value} position={position} digit={value} />
      ))}
    </span>
  );
}

const COLLAPSE = { initial: { width: 0, opacity: 0 }, animate: { width: "auto", opacity: 1 }, exit: { width: 0, opacity: 0 } };

type Part = { key: string; digit: number } | { key: string; text: string };

function partsOf(formatter: Intl.NumberFormat, value: number): Part[] {
  const parts = formatter.formatToParts(value);
  let integers = parts.reduce((sum, part) => sum + (part.type === "integer" ? part.value.length : 0), 0);
  let fractions = 0;
  return parts.flatMap((part, index): Part[] =>
    part.type === "integer"
      ? [...part.value].map(char => ({ key: `i${--integers}`, digit: Number(char) }))
      : part.type === "fraction"
        ? [...part.value].map(char => ({ key: `f${fractions++}`, digit: Number(char) }))
        : [{ key: part.type === "group" ? `g${integers}` : part.type === "literal" ? `l${index}` : part.type, text: part.value }],
  );
}

function RollingNumber({ value, formatter, reduceMotion }: { value: number; formatter: Intl.NumberFormat; reduceMotion: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value >= state.value ? 1 : -1 });
  const parts = partsOf(formatter, value);
  const digits = parts.filter(part => "digit" in part).length;
  let seen = 0;
  return (
    <span className={styles.number} aria-hidden="true">
      <AnimatePresence initial={false}>
        {parts.map(part => {
          const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
          if (!("digit" in part))
            return (
              <motion.span key={part.key} className={styles.symbol} {...COLLAPSE} transition={transition}>
                {part.text}
              </motion.span>
            );
          const delay = (digits - 1 - seen++) * 0.025;
          return (
            <motion.span key={part.key} className={styles.column} {...COLLAPSE} transition={transition}>
              <Wheel digit={part.digit} direction={state.direction} delay={delay} reduceMotion={reduceMotion} />
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function Sparkline({ values, tone, reduceMotion }: { values: number[]; tone: string; reduceMotion: boolean }) {
  if (values.length < 2) return <svg className={styles.spark} viewBox="0 0 216 56" aria-hidden="true" />;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * 216, 4 + (1 - (value - low) / span) * 48]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L216 56 L0 56 Z`;
  const last = points[points.length - 1] ?? [0, 0];
  return (
    <svg className={styles.spark} data-tone={tone} viewBox="0 0 216 56" preserveAspectRatio="none" aria-hidden="true">
      <motion.path className={styles.sparkArea} d={area} initial={!reduceMotion && { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.considered, ease: motionTokens.ease.standard, delay: 0.12 * +!reduceMotion }} />
      <motion.path className={styles.sparkLine} d={line} initial={!reduceMotion && { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: motionTokens.duration.considered, ease: motionTokens.ease.enter }} />
      <motion.circle className={styles.sparkDot} cx={last[0]} cy={last[1]} r={3} initial={!reduceMotion && { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { ...motionTokens.spring.snappy, delay: 0.42 }} />
    </svg>
  );
}

interface Formats { value: Intl.NumberFormat; delta: Intl.NumberFormat; scale: number; suffix: string }
interface Change { delta: number; ratio: number; tick: number }
interface Feed { metrics: readonly TickerMetric[]; history: Record<string, number[]>; changes: Record<string, Change>; tick: number }
interface Drag { x: number; last: number; time: number; velocity: number; moved: boolean; id: number }

export function MetricTicker({ metrics, overflow = "marquee", speed = 32, flashDuration = 1600, historyLength = 24, locale = "en-US", label = "Live metrics", className, style }: MetricTickerProps) {
  const reduced = !!useReducedMotion();
  const panelId = useId();
  const formatKey = metrics.map(metric => `${metric.id}:${metric.delta ?? ""}:${JSON.stringify(metric.format ?? {})}`).join("|");
  const formats = useMemo(() => {
    const map = new Map<string, Formats>();
    for (const metric of metrics) {
      const options: Intl.NumberFormatOptions = { maximumFractionDigits: 0, ...metric.format, numberingSystem: "latn" };
      const value = new Intl.NumberFormat(locale, options);
      if (metric.delta !== "absolute") map.set(metric.id, { value, delta: new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, numberingSystem: "latn" }), scale: 1, suffix: "" });
      else if (options.style === "percent") {
        const digits = value.resolvedOptions().maximumFractionDigits ?? 1;
        map.set(metric.id, { value, delta: new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, numberingSystem: "latn" }), scale: 100, suffix: " pts" });
      } else map.set(metric.id, { value, delta: new Intl.NumberFormat(locale, { ...options, signDisplay: "never" }), scale: 1, suffix: "" });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, formatKey]);

  const [feed, setFeed] = useState<Feed>(() => ({ metrics, history: Object.fromEntries(metrics.map(metric => [metric.id, [metric.value]])), changes: {}, tick: 0 }));
  if (feed.metrics !== metrics) {
    const tick = feed.tick + 1;
    const history = { ...feed.history };
    const changes = { ...feed.changes };
    const before = new Map(feed.metrics.map(metric => [metric.id, metric.value]));
    for (const metric of metrics) {
      const old = before.get(metric.id);
      if (old === undefined || old === metric.value) {
        history[metric.id] ??= [metric.value];
        continue;
      }
      history[metric.id] = [...(history[metric.id] ?? [old]), metric.value].slice(-historyLength);
      changes[metric.id] = { delta: metric.value - old, ratio: old ? (metric.value - old) / Math.abs(old) : 0, tick };
    }
    setFeed({ metrics, history, changes, tick });
  }

  const [settled, setSettled] = useState(0);
  const flashTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (feed.tick === 0) return;
    const tick = feed.tick;
    const timers = flashTimers.current;
    const timer = setTimeout(() => {
      timers.delete(timer);
      setSettled(value => Math.max(value, tick));
    }, flashDuration);
    timers.add(timer);
  }, [flashDuration, feed.tick]);
  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const openId = pinnedId ?? focusId ?? hoverId;
  const [focusVisible, setFocusVisible] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const anchorRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLUListElement>(null);
  const showHover = (id: string, anchor?: HTMLElement) => {
    clearTimeout(hoverTimer.current);
    if (anchor) anchorRef.current = anchor;
    setHoverId(id);
  };
  const hideHover = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverId(null), 160);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (!pinnedId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinnedId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinnedId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinnedId]);

  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const group = groupRef.current;
    if (!viewport || !group || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflowing(group.scrollWidth > viewport.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(group);
    return () => observer.disconnect();
  }, []);

  const marquee = overflowing && overflow === "marquee" && !reduced;
  const travel = useMotionValue(0);
  const loop = useRef<{ speed: number; target: number; drag: Drag | null; visible: boolean; width: number; seek: number | null }>({ speed: 0, target: 0, drag: null, visible: true, width: 0, seek: null });
  const trackX = useTransform(travel, value => {
    const width = loop.current.width;
    return width ? -(((value % width) + width) % width) : 0;
  });
  const holding = focusId !== null && focusVisible;
  useEffect(() => {
    loop.current.target = holding ? 0 : speed;
  }, [holding, speed]);
  useEffect(() => {
    if (!marquee) return void travel.set(0);
    const state = loop.current;
    const group = groupRef.current;
    const measure = () => {
      state.width = group?.offsetWidth ?? 0;
    };
    measure();
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (group) resize?.observe(group);
    const visibility = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => { state.visible = !!entry?.isIntersecting; }) : null;
    if (viewportRef.current) visibility?.observe(viewportRef.current);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (state.width && (travel.get() >= state.width || travel.get() < 0)) travel.set(((travel.get() % state.width) + state.width) % state.width);
      if (state.visible && !document.hidden && !state.drag) {
        if (state.seek !== null) {
          const gap = state.seek - travel.get();
          travel.set(travel.get() + gap * (1 - Math.exp(-(12 * dt))));
          if (Math.abs(gap) < 0.5) state.seek = null;
          state.speed = 0;
        } else {
          state.speed += (state.target - state.speed) * (1 - Math.exp(-dt * (state.target ? 2.2 : 6)));
          if (Math.abs(state.speed) > 0.01) travel.set(travel.get() + state.speed * dt);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      resize?.disconnect();
      visibility?.disconnect();
    };
  }, [marquee, travel]);

  const dragged = useRef(false);
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = loop.current;
    const drag = state.drag;
    if (drag && drag.id === event.pointerId) {
      state.drag = null;
      if (drag.moved) {
        state.speed = Math.max(-1600, Math.min(1600, drag.velocity));
        dragged.current = true;
        setTimeout(() => {
          dragged.current = false;
        }, 0);
      }
    }
  };
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [rovingId, setRovingId] = useState<string | null>(null);
  const tabId = rovingId ?? metrics[0]?.id ?? null;
  const reveal = useCallback(
    (id: string) => {
      const button = buttons.current.get(id);
      const viewport = viewportRef.current;
      if (!button || !viewport) return;
      const item = button.parentElement as HTMLElement;
      if (marquee) {
        const width = loop.current.width || 1;
        const at = ((travel.get() % width) + width) % width;
        let to = item.offsetLeft - 24;
        if (to - at > width / 2) to -= width;
        if (at - to > width / 2) to += width;
        loop.current.seek = travel.get() + (to - at);
      } else if (item.offsetLeft < viewport.scrollLeft || item.offsetLeft + item.offsetWidth > viewport.scrollLeft + viewport.clientWidth) viewport.scrollTo({ left: item.offsetLeft - 16, behavior: reduced ? "auto" : "smooth" });
    },
    [marquee, travel, reduced],
  );

  const panelX = useMotionValue(0);
  const panelOrigin = useMotionValue("50% 0px");
  const openRef = useRef(openId);
  useLayoutEffect(() => {
    openRef.current = openId;
  }, [openId]);
  const isOpen = openId !== null;
  useLayoutEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    let first = true;
    let last = -1;
    const follow = (now: number) => {
      const id = openRef.current;
      const anchor = anchorRef.current;
      const target = anchor?.isConnected && anchor.dataset.metric === id ? anchor : id ? buttons.current.get(id) : undefined;
      const root = rootRef.current;
      if (target && root) {
        const rect = target.getBoundingClientRect();
        const bounds = root.getBoundingClientRect();
        const width = Math.min(248, bounds.width);
        const centre = rect.left + rect.width / 2 - bounds.left;
        const x = Math.max(0, Math.min(bounds.width - width, rect.left - bounds.left));
        const dt = last < 0 ? 0 : Math.min(0.05, (now - last) / 1000);
        if (first || reduced) {
          panelX.jump(x);
          panelOrigin.set(`${Math.max(12, Math.min(width - 12, centre - x)).toFixed(1)}px 0px`);
        } else panelX.set(panelX.get() + (x - panelX.get()) * (1 - Math.exp(-(16 * dt))));
        first = false;
      }
      last = now;
      raf = requestAnimationFrame(follow);
    };
    follow(-1);
    last = -1;
    return () => cancelAnimationFrame(raf);
  }, [isOpen, panelOrigin, panelX, reduced]);

  const openMetric = openId ? metrics.find(metric => metric.id === openId) : undefined;

  const renderItems = (clone: boolean) =>
    metrics.map((metric, index) => {
      const format = formats.get(metric.id);
      if (!format) return null;
      const change = feed.changes[metric.id];
      const sign = change ? Math.sign(change.delta) : 0;
      const tone = sign === 0 ? "flat" : sign > 0 === ((metric.positive ?? "up") === "up") ? "good" : "bad";
      const flash = !!change && change.tick > settled;
      const amount = change ? Math.abs(metric.delta === "absolute" ? change.delta : change.ratio) * format.scale : 0;
      const deltaText = change ? `${format.delta.format(amount)}${format.suffix}` : "";
      const name = `${metric.label}, ${format.value.format(metric.value)}${change && sign ? `, ${sign > 0 ? "up" : "down"} ${deltaText}` : ""}`;
      const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: metrics.length - 1 };
        if (event.key === "Escape") {
          setPinnedId(null);
          setFocusId(null);
          return;
        }
        if (!(event.key in moves)) return;
        event.preventDefault();
        const next = metrics[(moves[event.key] + metrics.length) % metrics.length];
        if (next) buttons.current.get(next.id)?.focus();
      };
      return (
        <li key={metric.id} className={styles.item} data-open={openId === metric.id || undefined}>
          <button
            ref={clone ? undefined : node => { if (node) buttons.current.set(metric.id, node); else buttons.current.delete(metric.id); }}
            type="button"
            data-metric={metric.id}
            className={styles.button}
            tabIndex={clone ? -1 : tabId === metric.id ? 0 : -1}
            aria-label={clone ? undefined : name}
            aria-expanded={clone ? undefined : openId === metric.id}
            aria-controls={clone || openId !== metric.id ? undefined : panelId}
            onPointerEnter={event => { if (event.pointerType === "mouse") showHover(metric.id, event.currentTarget); }}
            onPointerLeave={event => { if (event.pointerType === "mouse") hideHover(); }}
            onFocus={event => {
              if (clone) return;
              setFocusVisible(event.currentTarget.matches(":focus-visible"));
              anchorRef.current = event.currentTarget;
              setRovingId(metric.id);
              setFocusId(metric.id);
              reveal(metric.id);
            }}
            onBlur={() => setFocusId(value => (value === metric.id ? null : value))}
            onClick={event => {
              if (dragged.current) return;
              anchorRef.current = event.currentTarget;
              setPinnedId(value => (value === metric.id ? null : metric.id));
            }}
            onKeyDown={onKeyDown}
          >
            <span className={styles.label}>{metric.label}</span>
            <span className={styles.reading}>
              <span className={styles.value}>
                <RollingNumber value={metric.value} formatter={format.value} reduceMotion={reduced} />
              </span>
              <span className={styles.delta} data-tone={tone} data-flash={flash || undefined} data-empty={!change || undefined}>
                <span className={styles.deltaIcon}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={sign} className={styles.deltaGlyph} initial={reduced ? { opacity: 0 } : { opacity: 0, y: sign > 0 ? 5 : -5 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: sign > 0 ? -5 : 5 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
                      {sign > 0 ? <IconUp size={12} strokeWidth={2.25} /> : sign < 0 ? <IconDown size={12} strokeWidth={2.25} /> : <IconFlat size={12} strokeWidth={2.25} />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className={styles.deltaText}>
                  <RollingNumber value={amount} formatter={format.delta} reduceMotion={reduced} />
                  {format.suffix && <span className={styles.symbol}>{format.suffix}</span>}
                </span>
                {change && !reduced && <motion.span key={change.tick} className={styles.pulse} initial={{ opacity: 0.9, scale: 0.8 }} animate={{ opacity: 0, scale: 1.25 }} transition={{ duration: 0.7, ease: motionTokens.ease.enter }} />}
              </span>
            </span>
          </button>
        </li>
      );
    });

  const series = openMetric ? (openMetric.history ? [...openMetric.history] : feed.history[openMetric.id] ?? []) : [];
  const openFormat = openMetric ? formats.get(openMetric.id) : undefined;
  const openChange = openMetric ? feed.changes[openMetric.id] : undefined;
  const trend = series.length > 1 ? Math.sign((series[series.length - 1] ?? 0) - (series[0] ?? 0)) : 0;
  const trendTone = trend === 0 ? "flat" : trend > 0 === ((openMetric?.positive ?? "up") === "up") ? "up" : "down";

  return (
    <div ref={rootRef} className={[styles.ticker, className].filter(Boolean).join(" ")} style={style} role="region" aria-label={label} onPointerLeave={event => { if (event.pointerType === "mouse") hideHover(); }}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-mode={marquee ? "marquee" : overflowing ? "scroll" : "fit"}
        onPointerDown={event => {
          if (marquee && event.button === 0) loop.current.drag = { x: event.clientX, last: event.clientX, time: performance.now(), velocity: 0, moved: false, id: event.pointerId };
        }}
        onPointerMove={event => {
          const drag = loop.current.drag;
          if (!drag || drag.id !== event.pointerId || (!drag.moved && Math.abs(event.clientX - drag.x) < 5)) return;
          if (!drag.moved) {
            drag.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          const now = performance.now();
          const dx = event.clientX - drag.last;
          drag.velocity = 0.6 * drag.velocity + (-dx / Math.max(1, now - drag.time)) * 400;
          drag.last = event.clientX;
          drag.time = now;
          travel.set(travel.get() - dx);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.fader}>
          <motion.div className={styles.track} style={{ x: trackX }}>
            <ul ref={groupRef} className={styles.group}>{renderItems(false)}</ul>
            {marquee && <ul className={styles.group} aria-hidden="true">{renderItems(true)}</ul>}
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {openMetric && openFormat && (
          <motion.div
            key="panel"
            id={panelId}
            className={styles.panel}
            style={{ x: panelX, transformOrigin: panelOrigin }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard } }}
            transition={reduced ? { duration: 0 } : { ...motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }}
            onPointerEnter={event => { if (event.pointerType === "mouse") showHover(openMetric.id); }}
            onPointerLeave={event => { if (event.pointerType === "mouse") hideHover(); }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={openMetric.id}
                className={styles.panelBody}
                initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
              >
                <div className={styles.panelHead}>
                  <span className={styles.panelLabel}>{openMetric.caption ?? `Last ${series.length} updates`}</span>
                  {openChange && <span className={styles.panelChange} data-tone={trendTone}>{trend > 0 ? "Trending up" : trend < 0 ? "Trending down" : "Flat"}</span>}
                </div>
                <Sparkline values={series} tone={trendTone} reduceMotion={reduced} />
                <dl className={styles.range}>
                  <div>
                    <dt>Low</dt>
                    <dd>{openFormat.value.format(Math.min(...series))}</dd>
                  </div>
                  <div>
                    <dt>High</dt>
                    <dd>{openFormat.value.format(Math.max(...series))}</dd>
                  </div>
                </dl>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MetricTicker;
