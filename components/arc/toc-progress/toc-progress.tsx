"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { Check } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./toc-progress.module.css";

export interface TocProgressItem {
  /** The id of the heading element this entry points at. */
  id: string;
  label: string;
  /** Nesting depth. Defaults to 1. */
  level?: 1 | 2 | 3;
}

export interface TocProgressProps {
  items: TocProgressItem[];
  /** The scrolling element. Defaults to the nearest scrollable ancestor of the first heading, then the window. */
  scrollContainer?: RefObject<HTMLElement | null> | HTMLElement | null;
  /** Distance from the top of the scroller at which a heading counts as reached. */
  offset?: number;
  activeId?: string;
  onActiveChange?: (id: string) => void;
  onNavigate?: (id: string) => void;
  /** Total reading time in minutes. Estimated from the content when omitted. */
  readingTime?: number;
  title?: string;
  showTimeLeft?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Point { x: number; y: number }
interface Geometry { d: string; points: Point[]; cumulative: number[]; anchors: number[]; total: number; height: number }

const LANES: Record<number, number> = { 1: 5, 2: 17, 3: 29 };
const FOLLOW = { ...motionTokens.spring.smooth };
const noop = () => () => {};

function lengthAt(geometry: Geometry | null, position: number) {
  if (!geometry) return 0;
  const index = Math.min(Math.floor(position), geometry.anchors.length - 2);
  if (index < 0) return 0;
  const part = Math.min(1, position - index);
  return geometry.anchors[index] + (geometry.anchors[index + 1] - geometry.anchors[index]) * part;
}

function buildGeometry(rows: { top: number; height: number; lane: number }[]): Geometry | null {
  if (!rows.length) return null;
  const points: Point[] = [];
  const centres: number[] = [];
  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (!(last && last.x === x && last.y === y)) points.push({ x, y });
  };
  rows.forEach((row, index) => {
    const centre = row.top + row.height / 2;
    if (index === 0) push(row.lane, centre);
    centres.push(centre);
    const next = rows[index + 1];
    if (!next) return void push(row.lane, row.top + row.height - 4);
    const nextCentre = next.top + next.height / 2;
    if (next.lane === row.lane) return void push(row.lane, nextCentre);
    const middle = (row.top + row.height + next.top) / 2;
    const bend = Math.min(7, (nextCentre - centre) / 2 - 1);
    push(row.lane, middle - bend);
    for (let step = 1; step <= 14; step++) {
      const t = step / 14;
      const u = 1 - t;
      push(
        u * u * u * row.lane + 3 * u * u * t * row.lane + 3 * u * t * t * next.lane + t * t * t * next.lane,
        u * u * u * (middle - bend) + 3 * u * u * t * middle + 3 * u * t * t * middle + t * t * t * (middle + bend),
      );
    }
    push(next.lane, nextCentre);
  });
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cumulative[cumulative.length - 1];
  const anchors = centres.map(centre => {
    const index = points.findIndex(point => Math.abs(point.y - centre) < 0.01);
    return index >= 0 ? cumulative[index] : 0;
  });
  anchors.push(total);
  const d = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join("");
  const last = rows[rows.length - 1];
  return { d, points, cumulative, anchors, total, height: last.top + last.height };
}

function pointAt(geometry: Geometry, length: number): Point {
  const { points, cumulative } = geometry;
  if (length <= 0) return points[0];
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (cumulative[middle] < length) low = middle + 1;
    else high = middle;
  }
  const index = Math.max(1, low);
  const a = points[index - 1];
  const b = points[index];
  const span = cumulative[index] - cumulative[index - 1] || 1;
  const t = Math.min(1, Math.max(0, (length - cumulative[index - 1]) / span));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function scrollParent(node: HTMLElement | null) {
  for (let parent = node?.parentElement ?? null; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

export function TocProgress({
  items,
  scrollContainer,
  offset = 96,
  activeId,
  onActiveChange,
  onNavigate,
  readingTime,
  title = "On this page",
  showTimeLeft = true,
  label,
  className,
  style,
}: TocProgressProps) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reduced = !!useReducedMotion() && hydrated;
  const titleId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRef = useRef<SVGGElement>(null);
  const knockoutRef = useRef<SVGCircleElement>(null);
  const maskId = `toc-knockout-${useId().replace(/[^\w-]/g, "")}`;
  const topsRef = useRef<number[]>([]);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [current, setCurrent] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(readingTime ?? null);
  const [read, setRead] = useState(0);
  const jumpRef = useRef<number | null>(null);
  const updateRef = useRef<(instant?: boolean) => void>(() => {});
  const position = useMotionValue(0);
  const geometryRef = useRef<Geometry | null>(null);
  const length = useTransform(position, value => lengthAt(geometryRef.current, value));
  const dash = useTransform(length, value => `${value.toFixed(2)} 100000`);
  const visible = useTransform(position, value => +(value > 0.001));
  const count = items.length;
  const levels = useMemo(() => items.map(item => item.level ?? 1), [items]);
  const active = activeId !== undefined ? Math.max(0, items.findIndex(item => item.id === activeId)) : current;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const next = buildGeometry(rowRefs.current.slice(0, count).map((row, index) => ({ top: row?.offsetTop ?? 0, height: row?.offsetHeight ?? 0, lane: LANES[levels[index]] })));
      geometryRef.current = next;
      setGeometry(next);
      position.set(position.get());
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count, levels, position]);

  useEffect(() => {
    let observer: ResizeObserver | undefined;
    const first = items[0] ? document.getElementById(items[0].id) : null;
    const scroller = (scrollContainer ? ("current" in scrollContainer ? scrollContainer.current : scrollContainer) : null) ?? scrollParent(first);
    scrollerRef.current = scroller;
    const update = (instant = false) => {
      const { top, height, max, end } = scroller
        ? { top: scroller.scrollTop, height: scroller.clientHeight, max: scroller.scrollHeight - scroller.clientHeight, end: scroller.scrollHeight }
        : { top: window.scrollY, height: window.innerHeight, max: document.documentElement.scrollHeight - window.innerHeight, end: document.documentElement.scrollHeight };
      const tops = topsRef.current;
      if (!tops.length) return;
      const left = Math.max(0, max - top);
      const room = Math.max(0, height - offset);
      const near = room > 0 && left < room ? 1 - left / room : 0;
      const line = top + offset + room * near * near;
      let next = 0;
      if (line >= tops[0]) {
        let index = tops.length - 1;
        while (index > 0 && tops[index] > line) index--;
        const from = tops[index];
        const to = index + 1 < tops.length ? tops[index + 1] : end;
        next = Math.min(tops.length, index + Math.min(1, Math.max(0, (line - from) / Math.max(1, to - from))));
      }
      const jump = jumpRef.current;
      if (jump !== null && next > jump + 1) next = jump;
      if (instant || reduced) {
        position.stop();
        position.set(next);
      } else animate(position, next, FOLLOW);
    };
    const measure = () => {
      const origin = scroller ? scroller.getBoundingClientRect().top - scroller.scrollTop + scroller.clientTop : -window.scrollY;
      let last = 0;
      topsRef.current = items.map(item => {
        const heading = document.getElementById(item.id);
        last = heading ? heading.getBoundingClientRect().top - origin : last;
        return last;
      });
      if (readingTime === undefined) setMinutes(Math.max(1, Math.round(((scroller ?? document.body).textContent ?? "").trim().split(/\s+/).length / 230)));
      update(true);
    };
    const onScroll = () => update();
    const release = () => {
      if (jumpRef.current !== null) {
        jumpRef.current = null;
        update();
      }
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    const gestures = ["wheel", "touchstart", "pointerdown", "keydown"];
    for (const gesture of gestures) target.addEventListener(gesture, release, { passive: true });
    updateRef.current = update;
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      const content = scroller?.firstElementChild ?? document.body;
      observer.observe(content);
      if (scroller) observer.observe(scroller);
    }
    measure();
    return () => {
      target.removeEventListener("scroll", onScroll);
      for (const gesture of gestures) target.removeEventListener(gesture, release);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [items, scrollContainer, offset, readingTime, reduced, position]);

  const activeChangeRef = useRef(onActiveChange);
  const indexRef = useRef(0);
  useLayoutEffect(() => {
    activeChangeRef.current = onActiveChange;
  });

  const place = useCallback((value: number) => {
    const shape = geometryRef.current;
    const marker = markerRef.current;
    if (!shape || !marker) return;
    const point = pointAt(shape, lengthAt(shape, value));
    const transform = `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`;
    marker.setAttribute("transform", transform);
    knockoutRef.current?.setAttribute("transform", transform);
  }, []);

  const onChange = useCallback(
    (value: number) => {
      place(value);
      const index = Math.min(count - 1, Math.max(0, Math.floor(value + 0.002)));
      if (indexRef.current !== index) {
        indexRef.current = index;
        setCurrent(index);
        activeChangeRef.current?.(items[index]?.id ?? "");
      }
      setRead(count ? Math.min(1, value / count) : 0);
    },
    [count, items, place],
  );
  useMotionValueEvent(position, "change", onChange);
  useLayoutEffect(() => {
    place(position.get());
  }, [geometry, place, position]);

  const left = minutes === null ? null : read >= 0.999 ? 0 : Math.max(1, Math.ceil(minutes * (1 - read)));
  const leftText = left === null ? "" : left === 0 ? "Finished" : `${left} min left`;

  const navigate = (event: ReactMouseEvent<HTMLAnchorElement>, item: TocProgressItem, index: number) => {
    event.preventDefault();
    onNavigate?.(item.id);
    const heading = document.getElementById(item.id);
    if (!heading) return;
    const scroller = scrollerRef.current;
    jumpRef.current = index;
    const top = (topsRef.current[index] ?? 0) - offset + 1;
    const behavior = reduced ? "auto" : "smooth";
    if (scroller) scroller.scrollTo({ top, behavior });
    else window.scrollTo({ top, behavior });
    updateRef.current();
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };

  return (
    <nav className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-label={title ? undefined : label ?? "On this page"} aria-labelledby={title ? titleId : undefined}>
      {title || showTimeLeft ? (
        <div className={styles.head}>
          {title ? <p id={titleId} className={styles.title}>{title}</p> : null}
          {showTimeLeft && left !== null ? (
            <span className={styles.time} data-done={left === 0 || undefined}>
              <AnimatePresence initial={false}>
                <motion.span
                  key={leftText}
                  className={styles.timeText}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 7, filter: `blur(${motionTokens.blur.subtle}px)` }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -7, filter: `blur(${motionTokens.blur.subtle}px)` }}
                  transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
                >
                  {left === 0 ? <Check aria-hidden="true" /> : null}
                  {leftText}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={styles.body}>
        {geometry ? (
          <svg className={styles.line} width={40} height={geometry.height} viewBox={`0 0 40 ${geometry.height}`} aria-hidden="true">
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-8} y={-8} width={56} height={geometry.height + 16}>
              <rect x={-8} y={-8} width={56} height={geometry.height + 16} fill="#fff" />
              <circle ref={knockoutRef} r={5.5} fill="#000" />
            </mask>
            <g mask={`url(#${maskId})`}>
              <path className={styles.track} d={geometry.d} />
              <motion.path className={styles.progress} d={geometry.d} style={{ strokeDasharray: dash, opacity: visible }} />
            </g>
            <g ref={markerRef} className={styles.marker}>
              <circle r={3.5} className={styles.markerDot} />
            </g>
          </svg>
        ) : null}
        <ol
          ref={listRef}
          className={styles.list}
          onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            const links = Array.from(listRef.current?.querySelectorAll("a") ?? []);
            const index = links.indexOf(document.activeElement as HTMLAnchorElement);
            if (index < 0) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1);
            links[Math.min(links.length - 1, Math.max(0, next))]?.focus();
          }}
        >
          {items.map((item, index) => (
            <li key={item.id} ref={node => { rowRefs.current[index] = node; }} className={styles.row} data-level={levels[index]} data-state={index < active ? "read" : index === active ? "current" : "ahead"}>
              <a href={`#${item.id}`} className={styles.link} aria-current={index === active ? "location" : undefined} onClick={event => navigate(event, item, index)}>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
