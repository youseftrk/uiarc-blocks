"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./photo-grid.module.css";

export interface PhotoGridPhoto {
  id: string;
  src: string;
  srcSet?: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  detail?: string;
}

export interface PhotoGridProps {
  photos: PhotoGridPhoto[];
  title: string;
  zoomLevels?: number[];
  defaultColumns?: number;
  onColumnsChange?: (columns: number) => void;
  defaultFavorites?: string[];
  onFavoriteChange?: (id: string, favorite: boolean) => void;
  onViewerChange?: (id: string | null) => void;
  className?: string;
}

type Phase = "closed" | "opening" | "open" | "closing";

const LEVELS = [5, 3, 2];
const EASE = [0.22, 1, 0.36, 1] as const;
const SLIDE_GAP = 24;
const THUMB = 22;
const THUMB_H = 40;
const SWAP = { duration: 0.22, ease: EASE };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function ZoomGlyph({ columns }: { columns: number }) {
  const n = clamp(Math.round(columns), 1, 6);
  const gap = n >= 5 ? 1 : n >= 3 ? 1 : 2;
  const size = (14 - gap * (n - 1)) / n;
  const rx = n >= 5 ? 0.5 : 1.25;
  const cells = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      cells.push(
        <rect key={`${x}-${y}`} x={1 + x * (size + gap)} y={1 + y * (size + gap)} width={size} height={size} rx={rx} />,
      );
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {cells}
    </svg>
  );
}

function Swap({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`${styles.swap} ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.swapText}
          initial={{ opacity: 0, filter: "blur(4px)", y: 6 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(4px)", y: -6 }}
          transition={SWAP}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function PhotoGrid({
  photos,
  title,
  zoomLevels = LEVELS,
  defaultColumns = 3,
  onColumnsChange,
  defaultFavorites,
  onFavoriteChange,
  onViewerChange,
  className,
}: PhotoGridProps) {
  const reduced = useReducedMotion();
  const uid = useId();
  const count = photos.length;
  const [columns, setColumns] = useState(defaultColumns);
  const [favorites, setFavorites] = useState<string[]>(defaultFavorites ?? []);
  const [focus, setFocus] = useState(0);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("closed");
  const [status, setStatus] = useState("");
  const [grabbing, setGrabbing] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const frostRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const navsRef = useRef<HTMLDivElement>(null);

  const openT = useMotionValue(0);
  const page = useMotionValue(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const live = useRef({ index: 0, photos, reduced: false });
  const flip = useRef<{ rects: DOMRect[]; anchor: number; y: number } | null>(null);
  const gesture = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null; page: number; lx: number; ly: number; lt: number; vx: number; vy: number } | null>(null);
  const scrub = useRef<{ id: number; x: number; page: number; moved: boolean } | null>(null);
  const pinch = useRef<{ points: Map<number, { x: number; y: number }>; start: number; ratio: number }>({ points: new Map(), start: 0, ratio: 1 });
  const stepRef = useRef<(dir: number, anchor?: number) => void>(() => {});

  const tile = (i: number) => gridRef.current?.querySelector<HTMLElement>(`[data-tile="${i}"]`) ?? null;

  const paint = useCallback(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!stage || !track) return;
    const { index: cur, photos: list, reduced: still } = live.current;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const t = openT.get();
    const tc = clamp(t);
    const p = page.get();
    const dx = dragX.get();
    const dy = dragY.get();
    const pull = clamp(dy / 260);
    const chrome = tc * (1 - pull);
    if (backdropRef.current) backdropRef.current.style.opacity = String(chrome);
    if (frostRef.current) frostRef.current.style.opacity = String(tc);
    if (barRef.current) {
      barRef.current.style.opacity = String(chrome);
      barRef.current.style.transform = still ? "none" : `translateY(${-8 * (1 - chrome)}px)`;
    }
    if (navsRef.current) navsRef.current.style.opacity = String(chrome);
    if (stripRef.current) {
      stripRef.current.style.opacity = String(chrome);
      stripRef.current.style.transform = still ? "none" : `translateY(${10 * (1 - chrome)}px)`;
    }
    track.style.transform = `translateX(${-p * (w + SLIDE_GAP)}px)`;

    const stageBox = stage.getBoundingClientRect();
    track.querySelectorAll<HTMLElement>("[data-photo]").forEach((el) => {
      const i = Number(el.dataset.photo);
      const photo = list[i];
      if (!photo) return;
      const k = Math.min((w - 24) / photo.width, (h - 24) / photo.height);
      const fw = photo.width * k;
      const fh = photo.height * k;
      const fx = (w - fw) / 2;
      const fy = (h - fh) / 2;
      el.style.left = `${fx}px`;
      el.style.top = `${fy}px`;
      el.style.width = `${fw}px`;
      el.style.height = `${fh}px`;
      const source = i === cur ? gridRef.current?.querySelector<HTMLElement>(`[data-tile="${i}"]`) : null;
      if (!source || (t === 1 && dx === 0 && dy === 0)) {
        el.style.transform = "none";
        el.style.clipPath = "inset(0px round 14px)";
        el.style.opacity = "1";
        return;
      }
      if (still) {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.clipPath = "inset(0px round 14px)";
        el.style.opacity = String(tc);
        return;
      }
      const box = source.getBoundingClientRect();
      const s0 = Math.max(box.width / fw, box.height / fh);
      const ds = 1 - pull * 0.35;
      const s = (s0 + (1 - s0) * t) * ds;
      const tx = box.left - stageBox.left + box.width / 2;
      const ty = box.top - stageBox.top + box.height / 2;
      const cx = tx + (w / 2 - tx) * t + dx;
      const cy = ty + (h / 2 - ty) * t + dy;
      const ix = ((fw - box.width / s0) / 2) * (1 - tc);
      const iy = ((fh - box.height / s0) / 2) * (1 - tc);
      const radius = (6 + 8 * tc) / Math.max(s, 0.01);
      el.style.opacity = "1";
      el.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) scale(${s})`;
      el.style.clipPath = `inset(${Math.max(0, iy)}px ${Math.max(0, ix)}px round ${radius}px)`;
    });

    const strip = stripRef.current;
    if (strip) {
      const thumbs = strip.querySelectorAll<HTMLElement>("[data-thumb]");
      const centers: number[] = [];
      const lefts: number[] = [];
      const vis: number[] = [];
      const full: number[] = [];
      const active: number[] = [];
      let cursor = 0;
      for (let i = 0; i < list.length; i++) {
        const a = clamp(1 - Math.abs(i - p));
        const f = Math.max(THUMB, (THUMB_H * list[i].width) / list[i].height);
        const v = THUMB + (f - THUMB) * a;
        const m = 4 * a;
        lefts.push(cursor + m);
        vis.push(v);
        full.push(f);
        active.push(a);
        centers.push(cursor + m + v / 2);
        cursor += m + v + m + 2;
      }
      const pc = clamp(p, 0, list.length - 1);
      const lo = Math.floor(pc);
      const hi = Math.min(list.length - 1, lo + 1);
      const center = (centers[lo] ?? 0) + ((centers[hi] ?? 0) - (centers[lo] ?? 0)) * (pc - lo);
      const offset = strip.clientWidth / 2 - center + (p - pc) * -26;
      thumbs.forEach((el) => {
        const i = Number(el.dataset.thumb);
        const crop = (full[i] - vis[i]) / 2;
        el.style.width = `${full[i]}px`;
        el.style.clipPath = `inset(0px ${crop}px round 4px)`;
        el.style.opacity = String(0.5 + 0.5 * active[i]);
        el.style.transform = `translateX(${lefts[i] + offset - crop}px)`;
      });
    }
  }, [openT, page, dragX, dragY]);

  useLayoutEffect(() => {
    live.current = { index, photos, reduced };
    paint();
  });

  useEffect(() => {
    const offs = [openT, page, dragX, dragY].map((v) => v.on("change", paint));
    const stage = stageRef.current;
    const observer = new ResizeObserver(paint);
    if (stage) observer.observe(stage);
    return () => {
      offs.forEach((off) => off());
      observer.disconnect();
    };
  }, [openT, page, dragX, dragY, paint]);

  const reveal = (i: number) => {
    const scroller = scrollerRef.current;
    const el = tile(i);
    if (!scroller || !el) return;
    const s = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = s.top + parseFloat(getComputedStyle(scroller).paddingTop || "0");
    if (r.top < top) scroller.scrollTop -= top - r.top + 3;
    else if (r.bottom > s.bottom) scroller.scrollTop += r.bottom - s.bottom + 3;
  };

  const label = (i: number) => `${photos[i]?.title ?? ""}, ${i + 1} of ${count}`;

  const open = (i: number) => {
    if (phase !== "closed") return;
    setIndex(i);
    setFocus(i);
    page.jump(i);
    dragX.jump(0);
    dragY.jump(0);
    openT.jump(0);
    setPhase("opening");
    setStatus(label(i));
    onViewerChange?.(photos[i].id);
  };

  const close = () => {
    if (phase !== "open" && phase !== "opening") return;
    reveal(index);
    setPhase("closing");
    onViewerChange?.(null);
  };

  const goTo = (to: number) => {
    const i = clamp(to, 0, count - 1);
    const p = page.get();
    if (Math.abs(i - p) > 1.5) page.jump(i - Math.sign(i - p));
    if (i !== index) {
      setIndex(i);
      setFocus(i);
      setStatus(label(i));
      reveal(i);
    }
    if (reduced) page.jump(i);
    else animate(page, i, { type: "spring", stiffness: 320, damping: 36, mass: 1 });
  };

  useEffect(() => {
    if (phase === "opening") {
      viewerRef.current?.focus({ preventScroll: true });
      const controls = animate(openT, 1, reduced ? { duration: 0.2, ease: EASE } : { type: "spring", stiffness: 300, damping: 31, mass: 1 });
      controls.then(() => {
        if (openT.get() > 0.99) setPhase((p) => (p === "opening" ? "open" : p));
      });
      return () => controls.stop();
    }
    if (phase === "closing") {
      const spring = reduced ? { duration: 0.2, ease: EASE } : ({ type: "spring", stiffness: 300, damping: 32, mass: 1 } as const);
      const controls = animate(openT, 0, spring);
      const ax = animate(dragX, 0, spring);
      const ay = animate(dragY, 0, spring);
      const from = live.current.index;
      controls.then(() => {
        if (openT.get() < 0.01) {
          setPhase((p) => (p === "closing" ? "closed" : p));
          gridRef.current?.querySelector<HTMLElement>(`[data-tile="${from}"]`)?.focus({ preventScroll: true });
        }
      });
      return () => {
        controls.stop();
        ax.stop();
        ay.stop();
      };
    }
  }, [phase, reduced, openT, dragX, dragY]);

  /* zoom */
  const zoomTo = (next: number, anchorIndex?: number) => {
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (next === columns || !scroller || !grid) return;
    const tiles = [...grid.querySelectorAll<HTMLElement>("[data-tile]")];
    const s = scroller.getBoundingClientRect();
    const rects = tiles.map((el) => el.getBoundingClientRect());
    let anchor = anchorIndex ?? -1;
    if (anchor < 0) {
      const top = parseFloat(getComputedStyle(scroller).paddingTop || "0");
      const mx = s.left + s.width / 2;
      const my = s.top + top + (s.height - top) / 2;
      let best = Infinity;
      rects.forEach((r, i) => {
        const d = Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my);
        if (d < best) {
          best = d;
          anchor = i;
        }
      });
    }
    if (rects[anchor]) flip.current = { rects, anchor, y: rects[anchor].top + rects[anchor].height / 2 - s.top };
    setColumns(next);
    onColumnsChange?.(next);
  };

  const step = (dir: number, anchor?: number) => {
    const at = zoomLevels.indexOf(columns);
    const next = zoomLevels[at + dir];
    if (at >= 0 && next !== undefined) zoomTo(next, anchor);
  };

  useLayoutEffect(() => {
    stepRef.current = step;
  });

  useLayoutEffect(() => {
    const f = flip.current;
    flip.current = null;
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (!f || !scroller || !grid) return;
    const tiles = [...grid.querySelectorAll<HTMLElement>("[data-tile]")];
    const anchor = tiles[f.anchor];
    if (anchor) {
      const s = scroller.getBoundingClientRect();
      const r = anchor.getBoundingClientRect();
      scroller.scrollTop += r.top + r.height / 2 - s.top - f.y;
    }
    if (reduced) return;
    const view = scroller.getBoundingClientRect();
    tiles.forEach((el, i) => {
      const o = f.rects[i];
      const r = el.getBoundingClientRect();
      if (!o) return;
      const seen = (b: DOMRect) => b.bottom > view.top - 200 && b.top < view.bottom + 200;
      if (!seen(o) && !seen(r)) return;
      const s = o.width / r.width;
      const dx = o.left + o.width / 2 - (r.left + r.width / 2);
      const dy = o.top + o.height / 2 - (r.top + r.height / 2);
      el.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s})`, borderRadius: `${6 / s}px` },
          { transform: "translate3d(0, 0, 0) scale(1)", borderRadius: "6px" },
        ],
        { duration: 460, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
  }, [columns, reduced]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let acc = 0;
    let lock = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const now = performance.now();
      if (now < lock) return;
      acc -= event.deltaY;
      if (Math.abs(acc) < 24) return;
      const dir = acc > 0 ? 1 : -1;
      acc = 0;
      lock = now + 320;
      const hit = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-tile]");
      stepRef.current(dir, hit ? Number(hit.dataset.tile) : undefined);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, []);

  const spread = () => {
    const pts = [...pinch.current.points.values()];
    return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onGridPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const p = pinch.current;
    p.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (p.points.size === 2) {
      p.start = spread();
      p.ratio = 1;
    }
  };

  const onGridPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pinch.current;
    if (!p.points.has(event.pointerId)) return;
    p.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const grid = gridRef.current;
    if (p.points.size !== 2 || !p.start || !grid) return;
    p.ratio = clamp(spread() / p.start, 0.6, 1.6);
    const pts = [...p.points.values()];
    const box = grid.getBoundingClientRect();
    grid.style.transformOrigin = `${(pts[0].x + pts[1].x) / 2 - box.left}px ${(pts[0].y + pts[1].y) / 2 - box.top}px`;
    grid.style.transform = `scale(${p.ratio})`;
  };

  const onGridPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pinch.current;
    if (!p.points.delete(event.pointerId)) return;
    const grid = gridRef.current;
    if (!p.start || !grid) return;
    const ratio = p.ratio;
    p.start = 0;
    p.ratio = 1;
    grid.style.transform = "";
    grid.style.transformOrigin = "";
    if (ratio > 1.2) step(1);
    else if (ratio < 0.84) step(-1);
  };

  const toggleFavorite = (id: string) => {
    const on = !favorites.includes(id);
    setFavorites(on ? [...favorites, id] : favorites.filter((f) => f !== id));
    onFavoriteChange?.(id, on);
  };

  const moveFocus = (to: number) => {
    const i = clamp(to, 0, count - 1);
    setFocus(i);
    tile(i)?.focus();
  };

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const k = event.key;
    let to: number | null = null;
    if (k === "ArrowRight") to = focus + 1;
    else if (k === "ArrowLeft") to = focus - 1;
    else if (k === "ArrowDown") to = focus + columns < count ? focus + columns : focus;
    else if (k === "ArrowUp") to = focus - columns >= 0 ? focus - columns : focus;
    else if (k === "PageDown") to = Math.min(count - 1, focus + columns * 3);
    else if (k === "PageUp") to = Math.max(0, focus - columns * 3);
    else if (k === "Home") to = 0;
    else if (k === "End") to = count - 1;
    else if (k === "+" || k === "=") {
      event.preventDefault();
      step(1, focus);
      return;
    } else if (k === "-" || k === "_") {
      event.preventDefault();
      step(-1, focus);
      return;
    }
    if (to === null) return;
    event.preventDefault();
    moveFocus(to);
  };

  const onViewerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const k = event.key;
    if (k === "Escape") close();
    else if (k === "ArrowLeft") goTo(index - 1);
    else if (k === "ArrowRight") goTo(index + 1);
    else if (k === "Home") goTo(0);
    else if (k === "End") goTo(count - 1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  /* stage drag */
  const onStageDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || phase !== "open") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, page: page.get(), lx: event.clientX, ly: event.clientY, lt: event.timeStamp, vx: 0, vy: 0 };
    setGrabbing(true);
  };

  const onStageMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    const dt = Math.max(1, event.timeStamp - g.lt);
    g.vx = ((event.clientX - g.lx) / dt) * 1000;
    g.vy = ((event.clientY - g.ly) / dt) * 1000;
    g.lx = event.clientX;
    g.ly = event.clientY;
    g.lt = event.timeStamp;
    if (!g.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) || dy < 0 ? "x" : "y";
    }
    if (g.axis === "x") {
      const w = event.currentTarget.clientWidth + SLIDE_GAP;
      let p = g.page - dx / w;
      if (p < 0) p *= 0.35;
      if (p > count - 1) p = count - 1 + (p - count + 1) * 0.35;
      page.set(p);
    } else {
      dragX.set(dx);
      dragY.set(Math.max(0, dy));
    }
  };

  const onStageUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    setGrabbing(false);
    if (g.axis === "x") {
      const dx = event.clientX - g.x;
      const w = event.currentTarget.clientWidth;
      let to = Math.round(g.page);
      if (Math.abs(dx) > w * 0.2 || Math.abs(g.vx) > 400) to -= Math.sign(Math.abs(g.vx) > 400 ? g.vx : dx);
      goTo(to);
    } else if (g.axis === "y") {
      if (dragY.get() > 90 || g.vy > 600) close();
      else {
        const spring = { type: "spring", stiffness: 320, damping: 30 } as const;
        animate(dragX, 0, spring);
        animate(dragY, 0, spring);
      }
    }
  };

  /* filmstrip */
  const onStripDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { id: event.pointerId, x: event.clientX, page: page.get(), moved: false };
  };

  const onStripMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = scrub.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    if (!g.moved && Math.abs(dx) < 4) return;
    g.moved = true;
    const p = clamp(g.page - dx / (THUMB + 2), 0, count - 1);
    page.set(p);
    const r = Math.round(p);
    if (r !== index) {
      setIndex(r);
      setFocus(r);
      setStatus(label(r));
    }
  };

  const onStripUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = scrub.current;
    if (!g || g.id !== event.pointerId) return;
    scrub.current = null;
    if (g.moved) {
      goTo(Math.round(page.get()));
      return;
    }
    const hit = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-thumb]");
    if (hit) goTo(Number(hit.dataset.thumb));
  };

  const shown = phase !== "closed";
  const current = photos[index];
  const favorite = current ? favorites.includes(current.id) : false;
  const favoriteCount = photos.filter((p) => favorites.includes(p.id)).length;
  const pop = reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", scale: 0.6 };

  return (
    <div className={`${styles.root} ${className ?? ""}`} data-phase={phase === "opening" ? "open" : phase === "closing" ? "closed" : phase}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>
            <span>{count} photos</span>
            <AnimatePresence initial={false}>
              {favoriteCount > 0 ? (
                <motion.span
                  key="favorites"
                  className={styles.favoriteCount}
                  aria-label={`${favoriteCount} favorite${favoriteCount === 1 ? "" : "s"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SWAP}
                >
                  <Heart size={12} fill="currentColor" aria-hidden="true" />
                  <Swap text={String(favoriteCount)} />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </p>
        </div>
        <div className={styles.zoom} role="group" aria-label="Zoom">
          {zoomLevels.map((level) => (
            <button
              key={level}
              type="button"
              className={styles.zoomButton}
              aria-pressed={level === columns}
              aria-label={`${level} photos per row`}
              title={`${level} per row`}
              onClick={() => zoomTo(level)}
            >
              {level === columns ? (
                <motion.span
                  className={styles.zoomSelection}
                  aria-hidden="true"
                  layoutId={`${uid}-zoom`}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40, mass: 0.8 }}
                />
              ) : null}
              <ZoomGlyph columns={level} />
            </button>
          ))}
        </div>
      </header>

      <div
        ref={scrollerRef}
        className={styles.scroller}
        onPointerDown={onGridPointerDown}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerEnd}
        onPointerCancel={onGridPointerEnd}
      >
        <ul
          ref={gridRef}
          className={styles.grid}
          style={{ "--columns": columns } as React.CSSProperties}
          aria-label={`${title}, ${count} photos`}
          onKeyDown={onGridKeyDown}
        >
          {photos.map((photo, i) => {
            const fav = favorites.includes(photo.id);
            return (
              <li key={photo.id} className={styles.cell}>
                <button
                  type="button"
                  className={styles.tile}
                  data-tile={i}
                  tabIndex={i === focus ? 0 : -1}
                  aria-label={fav ? `${photo.alt}, favorite` : photo.alt}
                  style={{ borderRadius: 6, visibility: shown && i === index ? "hidden" : undefined }}
                  onFocus={() => setFocus(i)}
                  onClick={() => open(i)}
                >
                  <img src={photo.src} srcSet={photo.srcSet} alt="" width={photo.width} height={photo.height} draggable={false} decoding="async" />
                  <AnimatePresence initial={false}>
                    {fav ? (
                      <motion.span key="badge" className={styles.badge} initial={pop} animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }} exit={pop} transition={SWAP}>
                        <Heart size={14} fill="currentColor" aria-hidden="true" />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        ref={viewerRef}
        className={styles.viewer}
        data-state={phase === "open" || phase === "opening" ? "open" : "closed"}
        data-shown={shown || undefined}
        role="dialog"
        aria-label="Photo viewer"
        aria-hidden={shown ? undefined : true}
        tabIndex={-1}
        onKeyDown={onViewerKeyDown}
      >
        <div ref={frostRef} className={styles.frost} style={{ opacity: 0 }} />
        <div ref={backdropRef} className={styles.backdrop} style={{ opacity: 0 }} />
        <div
          ref={stageRef}
          className={styles.stage}
          data-grabbing={grabbing || undefined}
          onPointerDown={onStageDown}
          onPointerMove={onStageMove}
          onPointerUp={onStageUp}
          onPointerCancel={onStageUp}
        >
          <div ref={trackRef} className={styles.track}>
            {shown
              ? photos.map((photo, i) =>
                  Math.abs(i - index) > 1 ? null : (
                    <div
                      key={photo.id}
                      className={styles.slide}
                      aria-hidden={i === index ? undefined : true}
                      style={{ left: `calc(${i * 100}% + ${i * SLIDE_GAP}px)` }}
                    >
                      <div className={styles.photo} data-photo={i}>
                        <img src={photo.src} srcSet={photo.srcSet} alt={i === index ? photo.alt : ""} draggable={false} decoding="sync" />
                      </div>
                    </div>
                  ),
                )
              : null}
          </div>
        </div>

        <div ref={barRef} className={styles.bar} style={{ opacity: 0 }}>
          <button type="button" className={styles.glass} aria-label="Back to all photos" tabIndex={shown ? 0 : -1} onClick={close}>
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <div className={styles.caption}>
            <span className={styles.captionTitle}>
              <Swap text={current?.title ?? ""} />
            </span>
            <span className={styles.captionMeta}>
              {current?.detail ? <Swap text={current.detail} /> : null}
              <span className={styles.counterPart}>
                {current?.detail ? <span aria-hidden="true">·</span> : null}
                <span className={styles.counter}>
                  <Swap text={String(index + 1)} />
                  <span>of {count}</span>
                </span>
              </span>
            </span>
          </div>
          <button
            type="button"
            className={styles.glass}
            aria-pressed={favorite}
            aria-label="Favorite"
            tabIndex={shown ? 0 : -1}
            onClick={() => current && toggleFavorite(current.id)}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={favorite ? "on" : "off"}
                className={styles.icon}
                initial={pop}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                exit={pop}
                transition={SWAP}
              >
                <Heart size={20} strokeWidth={1.75} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <div ref={navsRef} className={styles.navs} style={{ opacity: 0 }}>
          <button
            type="button"
            className={`${styles.glass} ${styles.nav}`}
            aria-label="Previous photo"
            disabled={index === 0}
            tabIndex={shown ? 0 : -1}
            onClick={() => goTo(index - 1)}
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.glass} ${styles.nav}`}
            aria-label="Next photo"
            disabled={index === count - 1}
            tabIndex={shown ? 0 : -1}
            onClick={() => goTo(index + 1)}
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div
          ref={stripRef}
          className={styles.strip}
          role="slider"
          tabIndex={shown ? 0 : -1}
          aria-label="Photos"
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={index + 1}
          aria-valuetext={label(index)}
          style={{ opacity: 0 }}
          onPointerDown={onStripDown}
          onPointerMove={onStripMove}
          onPointerUp={onStripUp}
          onPointerCancel={onStripUp}
        >
          {shown
            ? photos.map((photo, i) => (
                <span key={photo.id} className={styles.thumb} data-thumb={i}>
                  <img src={photo.src} srcSet={photo.srcSet} alt="" draggable={false} decoding="async" />
                </span>
              ))
            : null}
        </div>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export default PhotoGrid;
