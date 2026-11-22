"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./split-bar.module.css";

export interface SplitBarSegment {
  id: string;
  label: string;
  value: number;
  /** Any CSS colour. Defaults to the series tokens in order. */
  color?: string;
}

export interface SplitBarProps {
  segments: SplitBarSegment[];
  title?: ReactNode;
  description?: ReactNode;
  format?: Intl.NumberFormatOptions;
  unit?: string;
  totalLabel?: string;
  hidden?: string[];
  defaultHidden?: string[];
  onHiddenChange?: (hidden: string[]) => void;
  legend?: boolean;
  locale?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Mode = "full" | "short" | "outside" | "none";
interface Slice { id: string; start: number; end: number; share: number; on: boolean; mode: Mode }
interface Leader { id: string; name: string; anchor: number; width: number; x: number }

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--text-muted)", "var(--border-strong)"];
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, value => ((((digit - value) % 10) + 15) % 10) - 5);
  const y = useTransform(offset, value => `${value}em`);
  const opacity = useTransform(offset, value => Math.max(0, 1 - 1.2 * Math.abs(value)));
  return <motion.span className={styles.glyph} style={{ y, opacity }}>{digit}</motion.span>;
}

function Wheel({ digit, direction, reduceMotion }: { digit: number; direction: number; reduceMotion: boolean }) {
  const position = useMotionValue(digit);
  const state = useRef({ digit, target: digit });
  useEffect(() => {
    const current = state.current;
    if (current.digit === digit) return;
    current.target += direction < 0 ? -((current.digit - digit + 10) % 10) : (digit - current.digit + 10) % 10;
    current.digit = digit;
    if (reduceMotion) return void position.jump(current.target);
    const controls = animate(position, current.target, motionTokens.spring.smooth);
    return () => controls.stop();
  }, [digit, direction, position, reduceMotion]);
  return (
    <span className={styles.wheel}>
      <span className={styles.sizer}>0</span>
      {DIGITS.map(value => <Glyph key={value} position={position} digit={value} />)}
    </span>
  );
}

const COLUMN = { initial: { width: 0, opacity: 0 }, animate: { width: "auto", opacity: 1 }, exit: { width: 0, opacity: 0 } };

function RollingNumber({ value, formatter, reduceMotion }: { value: number; formatter: Intl.NumberFormat; reduceMotion: boolean }) {
  const [last, setLast] = useState({ value, direction: 1 });
  if (last.value !== value) setLast({ value, direction: value >= last.value ? 1 : -1 });
  const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
  const parts = formatter.formatToParts(value);
  let integers = parts.reduce((sum, part) => sum + (part.type === "integer" ? part.value.length : 0), 0);
  let fractions = 0;
  const cells = parts.flatMap((part, index): ({ key: string; digit: number } | { key: string; text: string })[] =>
    part.type === "integer"
      ? [...part.value].map(character => ({ key: `i${--integers}`, digit: Number(character) }))
      : part.type === "fraction"
        ? [...part.value].map(character => ({ key: `f${fractions++}`, digit: Number(character) }))
        : [{ key: part.type === "group" ? `g${integers}` : part.type === "literal" ? `l${index}` : part.type, text: part.value }],
  );
  return (
    <span className={styles.number} aria-hidden="true">
      <AnimatePresence initial={false}>
        {cells.map(cell =>
          "digit" in cell ? (
            <motion.span key={cell.key} className={styles.column} {...COLUMN} transition={transition}>
              <Wheel digit={cell.digit} direction={last.direction} reduceMotion={reduceMotion} />
            </motion.span>
          ) : (
            <motion.span key={cell.key} className={styles.symbol} {...COLUMN} transition={transition}>{cell.text}</motion.span>
          ),
        )}
      </AnimatePresence>
    </span>
  );
}

function Segment({ slice, color, width, active, dimmed, text, reduceMotion }: { slice: Slice; color: string; width: MotionValue<number>; active: boolean; dimmed: boolean; text: { name: string; share: number; formatter: Intl.NumberFormat }; reduceMotion: boolean }) {
  const start = useMotionValue(slice.start);
  const end = useMotionValue(slice.end);
  useEffect(() => {
    if (reduceMotion) {
      start.jump(slice.start);
      end.jump(slice.end);
      return;
    }
    const a = animate(start, slice.start, motionTokens.spring.smooth);
    const b = animate(end, slice.end, motionTokens.spring.smooth);
    return () => {
      a.stop();
      b.stop();
    };
  }, [end, reduceMotion, slice.end, slice.start, start]);
  const clipPath = useTransform([start, end, width], ([from = 0, to = 0, size = 0]: number[]) => {
    const left = Math.min(1, from * size);
    const right = Math.min(1, (1 - to) * size);
    return `inset(0 calc(${((1 - to) * 100).toFixed(3)}% + ${right.toFixed(2)}px) 0 calc(${(100 * from).toFixed(3)}% + ${left.toFixed(2)}px) round 4px)`;
  });
  const capX = useTransform([end, width], ([to = 0, size = 0]: number[]) => to * size - 3 - Math.min(1, (1 - to) * size));
  const capOpacity = useTransform([start, end, width], ([from = 0, to = 0, size = 0]: number[]) => Math.max(0, Math.min(1, ((to - from) * size - 4) / 6)));
  const insideX = useTransform([start, width], ([from = 0, size = 0]: number[]) => from * size + 10);
  const inside = slice.on && (slice.mode === "full" || slice.mode === "short");
  return (
    <motion.span className={styles.segment} data-active={active || undefined} data-dimmed={dimmed || undefined} style={{ clipPath, "--seg": color } as never} aria-hidden="true">
      <motion.span className={styles.cap} style={{ x: capX, opacity: capOpacity }} />
      <motion.span className={styles.inside} style={{ x: insideX }} initial={false} animate={{ opacity: +!!inside }} transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}>
        <motion.span
          className={styles.insideName}
          initial={false}
          animate={{ opacity: +(slice.mode === "full"), width: slice.mode === "full" ? "auto" : 0, marginRight: 5 * +(slice.mode === "full") }}
          transition={reduceMotion ? { duration: 0 } : motionTokens.spring.morph}
        >
          {text.name}
        </motion.span>
        <RollingNumber value={text.share} formatter={text.formatter} reduceMotion={reduceMotion} />
      </motion.span>
    </motion.span>
  );
}

function createMeasurer(font: string) {
  const cache = new Map<string, number>();
  const context = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (context && font) context.font = font;
  return (value: string) => {
    const known = cache.get(value);
    if (known !== undefined) return known;
    const size = context && font ? context.measureText(value).width : 7 * value.length;
    cache.set(value, size);
    return size;
  };
}

function useMeasure(probe: RefObject<HTMLElement | null>) {
  const [font, setFont] = useState("");
  useEffect(() => {
    const read = () => {
      if (probe.current) setFont(getComputedStyle(probe.current).font);
    };
    read();
    document.fonts?.ready.then(read).catch(() => {});
  }, [probe]);
  return useMemo(() => createMeasurer(font), [font]);
}

function layoutSlices(segments: SplitBarSegment[], shares: Map<string, number>, activeId: string | null, width: number, measure: (text: string) => number, percent: Intl.NumberFormat): Slice[] {
  const sized = new Map(shares);
  if (activeId && width > 0) {
    const share = sized.get(activeId) ?? 0;
    const segment = segments.find(item => item.id === activeId);
    const needed = segment ? (measure(`${segment.label} ${percent.format(share)}`) + 30) / width : 0;
    const grown = Math.min(Math.max(share + 0.045, Math.min(needed, 0.42)), 0.9);
    if (grown > share && share < 1) {
      const scale = (1 - grown) / (1 - share);
      for (const [id, value] of sized) sized.set(id, id === activeId ? grown : value * scale);
    }
  }
  const ends = segments.reduce<number[]>((list, segment) => [...list, (list[list.length - 1] ?? 0) + (sized.get(segment.id) ?? 0)], []);
  return segments.map((segment, index) => {
    const share = shares.get(segment.id) ?? 0;
    const start = index ? ends[index - 1] ?? 0 : 0;
    const end = Math.min(1, ends[index] ?? 0);
    const pixels = (end - start) * width;
    const on = end - start > 0;
    const full = measure(`${segment.label} ${percent.format(share)}`) + 30;
    const short = measure(percent.format(share)) + 26;
    return { id: segment.id, start, end, share, on, mode: on ? (pixels >= full ? "full" : pixels >= short ? "short" : "outside") : "none" };
  });
}

function layoutLeaders(segments: SplitBarSegment[], slices: Slice[], width: number, measure: (text: string) => number, percent: Intl.NumberFormat): Leader[] {
  const build = (named: boolean) =>
    slices.filter(slice => slice.mode === "outside").map(slice => {
      const name = named ? segments.find(segment => segment.id === slice.id)?.label ?? "" : "";
      const share = percent.format(slice.share);
      return { id: slice.id, name, anchor: ((slice.start + slice.end) / 2) * width, width: measure(name ? `${name} ${share}` : share) + 6, x: 0 };
    });
  let leaders = build(true);
  if (leaders.reduce((sum, leader, index) => sum + leader.width + 12 * +!!index, 0) > width) leaders = build(false);
  leaders.forEach((leader, index) => {
    const previous = leaders[index - 1];
    leader.x = Math.max(previous ? previous.x + previous.width + 12 : 0, leader.anchor - leader.width / 2);
  });
  for (let index = leaders.length - 1; index >= 0; index--) {
    const leader = leaders[index];
    const next = leaders[index + 1];
    if (!leader) continue;
    const limit = next ? next.x - 12 : width;
    if (leader.x + leader.width > limit) leader.x = Math.max(0, limit - leader.width);
  }
  return leaders;
}

export function SplitBar({
  segments,
  title,
  description,
  format,
  unit,
  totalLabel = "Total",
  hidden,
  defaultHidden = [],
  onHiddenChange,
  legend = true,
  locale = "en-US",
  label,
  className,
  style,
}: SplitBarProps) {
  const reduced = !!useReducedMotion();
  const titleId = useId();
  const [innerHidden, setInnerHidden] = useState(() => [...defaultHidden]);
  const hiddenIds = hidden ?? innerHidden;
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const setHidden = (next: string[]) => {
    if (!hidden) setInnerHidden(next);
    onHiddenChange?.(next);
  };
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0, ...format, numberingSystem: "latn" }), [format, locale]);
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, numberingSystem: "latn" }), [locale]);
  const barRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const widthValue = useMotionValue(0);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      widthValue.set(bar.clientWidth);
      setWidth(bar.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [widthValue]);
  const measure = useMeasure(probeRef);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [refused, setRefused] = useState<{ id: string; key: number } | null>(null);
  const colorOf = (segment: SplitBarSegment, index: number) => segment.color ?? COLORS[index % COLORS.length] ?? "var(--text-muted)";
  const visible = segments.filter(segment => !hiddenSet.has(segment.id) && segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  const active = activeId && visible.some(segment => segment.id === activeId) ? activeId : null;
  const shareOf = (segment: SplitBarSegment) => (total > 0 && !hiddenSet.has(segment.id) ? Math.max(0, segment.value) / total : 0);
  const shares = new Map(segments.map(segment => [segment.id, shareOf(segment)]));
  const slices = layoutSlices(segments, shares, active, width, measure, percent);
  const leaders = layoutLeaders(segments, slices, width, measure, percent);
  const toggle = (id: string) => {
    const segment = segments.find(item => item.id === id);
    if (!segment) return;
    if (hiddenSet.has(id)) {
      setHidden(hiddenIds.filter(item => item !== id));
      setAnnouncement(`${segment.label} shown.`);
    } else {
      if (visible.length <= 1) {
        setRefused(previous => ({ id, key: (previous?.key ?? 0) + 1 }));
        setAnnouncement(`${segment.label} is the only share shown, so it stays on.`);
        return;
      }
      setHidden([...hiddenIds, id]);
      setAnnouncement(`${segment.label} hidden.`);
    }
  };
  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = (event.clientX - rect.left) / rect.width;
    const slice = slices.find(item => item.on && at >= item.start && at < item.end);
    if (slice && slice.id !== activeId) setActiveId(slice.id);
  };
  const activeSegment = active ? segments.find(segment => segment.id === active) : undefined;
  const activeIndex = activeSegment ? segments.indexOf(activeSegment) : -1;
  const summary = visible.map(segment => `${segment.label} ${percent.format(shareOf(segment))}`).join(", ");
  const name = label ?? (typeof title === "string" ? title : undefined) ?? "Split bar";
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const ids = visible.map(segment => segment.id);
    if (!ids.length) return;
    const index = active ? ids.indexOf(active) : -1;
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index <= 0 ? ids.length - 1 : index - 1, ArrowUp: index <= 0 ? ids.length - 1 : index - 1, Home: 0, End: ids.length - 1 };
    if (event.key === "Escape") return void setActiveId(null);
    if (event.key === "Enter" || event.key === " ") {
      if (active) {
        event.preventDefault();
        toggle(active);
      }
      return;
    }
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = ids[(moves[event.key] + ids.length) % ids.length];
    if (!next) return;
    setActiveId(next);
    const segment = segments.find(item => item.id === next);
    if (segment) setAnnouncement(`${segment.label}, ${percent.format(shareOf(segment))}, ${number.format(segment.value)}${unit ? ` ${unit}` : ""}.`);
  };

  return (
    <figure className={[styles.figure, className].filter(Boolean).join(" ")} style={style} aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : name}>
      <span ref={probeRef} className={styles.probe} aria-hidden="true">0</span>
      <div className={styles.head}>
        {(title || description) && (
          <div className={styles.heading}>
            {title && <p id={titleId} className={styles.title}>{title}</p>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
        )}
        <div className={styles.readout} aria-hidden="true">
          <AnimatePresence mode="popLayout" anchorX="right" initial={false}>
            <motion.div
              key={activeSegment ? activeSegment.id : "total"}
              className={styles.readoutLine}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast } }}
              transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }}
            >
              {activeSegment ? (
                <>
                  <span className={styles.readoutSwatch} style={{ "--seg": colorOf(activeSegment, activeIndex) } as CSSProperties} />
                  <span className={styles.readoutName}>{activeSegment.label}</span>
                  <span className={styles.readoutShare}><RollingNumber value={shareOf(activeSegment)} formatter={percent} reduceMotion={reduced} /></span>
                  <span className={styles.readoutValue}>
                    <RollingNumber value={activeSegment.value} formatter={number} reduceMotion={reduced} />
                    {unit ? ` ${unit}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.readoutName}>{totalLabel}</span>
                  <span className={styles.readoutShare}><RollingNumber value={total} formatter={number} reduceMotion={reduced} /></span>
                  {unit && <span className={styles.readoutValue}>{unit}</span>}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div
        ref={barRef}
        className={styles.bar}
        data-active={active ? "" : undefined}
        tabIndex={0}
        role="group"
        aria-roledescription="split bar"
        aria-label={`${name}: ${summary}. Use the arrow keys to read each share.`}
        onPointerMove={point}
        onPointerDown={point}
        onPointerLeave={event => {
          if (event.pointerType === "mouse") setActiveId(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setActiveId(null)}
      >
        {segments.map((segment, index) => {
          const slice = slices[index];
          return slice ? <Segment key={segment.id} slice={slice} color={colorOf(segment, index)} width={widthValue} active={active === segment.id} dimmed={!!active && active !== segment.id} text={{ name: segment.label, share: slice.share, formatter: percent }} reduceMotion={reduced} /> : null;
        })}
      </div>
      <motion.div className={styles.lane} initial={false} animate={{ height: 40 * +!!leaders.length }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth} aria-hidden="true">
        <svg className={styles.leaders} width="100%" height={40}>
          <AnimatePresence initial={false}>
            {leaders.map(leader => {
              const centre = leader.x + leader.width / 2;
              const d = `M${leader.anchor.toFixed(1)} 0 C${leader.anchor.toFixed(1)} 10 ${centre.toFixed(1)} 6 ${centre.toFixed(1)} 15`;
              return (
                <motion.path
                  key={leader.id}
                  className={styles.leader}
                  data-dimmed={(active && active !== leader.id) || undefined}
                  initial={{ opacity: 0, d }}
                  animate={{ opacity: 1, d }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { d: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}
                />
              );
            })}
          </AnimatePresence>
        </svg>
        <AnimatePresence initial={false}>
          {leaders.map(leader => {
            const slice = slices.find(item => item.id === leader.id);
            return (
              <motion.span
                key={leader.id}
                className={styles.outside}
                data-dimmed={(active && active !== leader.id) || undefined}
                initial={{ opacity: 0, x: leader.x, y: -4 }}
                animate={{ opacity: 1, x: leader.x, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}
              >
                {leader.name && <span className={styles.outsideName}>{leader.name}</span>}
                <RollingNumber value={slice?.share ?? 0} formatter={percent} reduceMotion={reduced} />
              </motion.span>
            );
          })}
        </AnimatePresence>
      </motion.div>
      {legend && (
        <ul className={styles.legend} aria-label={`${name} segments`}>
          {segments.map((segment, index) => {
            const on = !hiddenSet.has(segment.id);
            return (
              <li key={segment.id}>
                <button
                  type="button"
                  className={styles.legendItem}
                  data-off={!on || undefined}
                  data-active={active === segment.id || undefined}
                  aria-pressed={on}
                  aria-label={`${segment.label}, ${on ? percent.format(shareOf(segment)) : "hidden"}`}
                  style={{ "--seg": colorOf(segment, index) } as CSSProperties}
                  onClick={() => toggle(segment.id)}
                  onPointerEnter={event => {
                    if (event.pointerType === "mouse" && on) setActiveId(segment.id);
                  }}
                  onPointerLeave={event => {
                    if (event.pointerType === "mouse") setActiveId(null);
                  }}
                >
                  <motion.span
                    key={refused?.id === segment.id ? refused.key : 0}
                    className={styles.legendLabel}
                    initial={{ x: 0 }}
                    animate={refused?.id !== segment.id || reduced ? { x: 0 } : { x: [0, -3, 3, -2, 0] }}
                    transition={{ duration: 0.32, ease: motionTokens.ease.standard }}
                  >
                    <span className={styles.swatch} aria-hidden="true" />
                    <span className={styles.legendName}>{segment.label}</span>
                  </motion.span>
                  <span className={styles.legendShare} aria-hidden="true">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {on ? (
                        <motion.span key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
                          <RollingNumber value={shareOf(segment)} formatter={percent} reduceMotion={reduced} />
                        </motion.span>
                      ) : (
                        <motion.span key="off" className={styles.legendOff} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
                          Off
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </figure>
  );
}
