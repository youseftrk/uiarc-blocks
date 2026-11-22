"use client";

import { ChevronLeft, ChevronRight, MoveUpRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useReducedMotion } from "../use-reduced-motion";
import styles from "./page-curl.module.css";

export interface PageCurlProps {
  /** Page contents in reading order. Page one is the cover and sits alone on the right. */
  pages: ReactNode[];
  /** Controlled spread. 0 shows the cover; spread n shows pages 2n and 2n + 1 (one-based). */
  spread?: number;
  /** Initial spread when uncontrolled. */
  defaultSpread?: number;
  /** Called when a page finishes turning. */
  onSpreadChange?: (spread: number) => void;
  /** Page width divided by height. */
  pageAspect?: number;
  /** Accessible name of the book. */
  label?: string;
  /** Curls the cover corner once when the book first comes into view. */
  tease?: boolean;
  /** Hint under the lower outer corner, shown until the first interaction. */
  hint?: ReactNode | null;
  /** Shows the page count with previous and next buttons under the book. */
  controls?: boolean;
  className?: string;
  style?: CSSProperties;
}

type Dir = 1 | -1;
type Rest = "remove" | "commit" | null;

interface Sim {
  dir: Dir;
  from: number;
  ky: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: "drag" | "spring" | "tween";
  tx: number;
  ty: number;
  rest: Rest;
  t0: number;
  ox: number;
  oy: number;
  last: number;
  tease: boolean;
}

interface Gesture {
  id: number;
  dir: Dir;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  moved: boolean;
  samples: { t: number; x: number; y: number }[];
}

interface Parts {
  front: HTMLElement;
  under: HTMLElement;
  flap: HTMLElement;
  shades: HTMLElement[];
}

const STIFFNESS = 180;
const DAMPING = 27;
const TURN_MS = 700;
const CORNER_ZONE = 56;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

function bezier(x1: number, y1: number, x2: number, y2: number) {
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const t = (lo + hi) / 2;
      const u = 1 - t;
      if (3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t < x) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    const u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  };
}

const turnEase = bezier(0.45, 0.05, 0.25, 0.95);

/** Clips the page rectangle to one side of the fold line. */
function clipPage(w: number, h: number, nx: number, ny: number, mx: number, my: number, sign: 1 | -1) {
  const rect: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  const out: [number, number][] = [];
  const side = (p: [number, number]) => sign * ((p[0] - mx) * nx + (p[1] - my) * ny);
  for (let i = 0; i < 4; i++) {
    const a = rect[i];
    const b = rect[(i + 1) % 4];
    const da = side(a);
    const db = side(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (out.length < 3) return "polygon(0px 0px)";
  return `polygon(${out.map((p) => `${r2(p[0])}px ${r2(p[1])}px`).join(", ")})`;
}

function armTween(s: Sim, w: number) {
  s.tease = false;
  s.mode = "tween";
  s.rest = "commit";
  s.t0 = performance.now();
  s.ox = s.x - w;
  s.oy = s.y - s.ky;
}

function hold(s: Sim) {
  s.tease = false;
  if (s.mode === "spring" && s.rest !== "commit") {
    s.tx = s.x;
    s.ty = s.y;
    s.vx = 0;
    s.vy = 0;
    s.rest = null;
  }
}

const dirOf = (el: HTMLElement): Dir => (el.dataset.dir === "-1" ? -1 : 1);

export function PageCurl({
  pages,
  spread: spreadProp,
  defaultSpread = 0,
  onSpreadChange,
  pageAspect = 0.72,
  label = "Book",
  tease = true,
  hint = "Drag the corner",
  controls = true,
  className,
  style,
}: PageCurlProps) {
  const reduced = useReducedMotion();
  const count = pages.length;
  const max = Math.floor(count / 2);
  const [inner, setInner] = useState(defaultSpread);
  const spread = clamp(spreadProp ?? inner, 0, max);
  const [dims, setDims] = useState({ w: 0, h: 0, diag: 0 });
  const [turn, setTurn] = useState<{ dir: Dir; from: number } | null>(null);
  const [hintHidden, setHintHidden] = useState(false);
  const [cue, setCue] = useState<Dir>(1);

  const rootRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const parts = useRef<Parts | null>(null);
  const sim = useRef<Sim | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const loop = useRef<(now: number) => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teased = useRef({ first: false, last: 0, turned: false });
  const live = useRef({ spread, max, count, w: 0, h: 0, diag: 0, reduced, controlled: spreadProp !== undefined, onSpreadChange });

  useLayoutEffect(() => {
    live.current = {
      spread,
      max,
      count,
      w: dims.w,
      h: dims.h,
      diag: dims.diag,
      reduced,
      controlled: spreadProp !== undefined,
      onSpreadChange,
    };
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const w = Math.round((root.clientWidth / 2) * 100) / 100;
      const h = Math.round(w / pageAspect);
      const diag = Math.ceil(Math.hypot(w, h));
      setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h, diag }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pageAspect]);

  const shiftFor = useCallback((s: number) => {
    const { w, max: m, count: n } = live.current;
    if (s <= 0) return -w / 2;
    if (s >= m && 2 * s >= n) return w / 2;
    return 0;
  }, []);

  const constrain = useCallback((s: Sim) => {
    const { w, h, diag } = live.current;
    const near = s.ky;
    const far = h - s.ky;
    for (let i = 0; i < 2; i++) {
      let d = Math.hypot(s.x, s.y - near);
      if (d > w) {
        s.x = (s.x / d) * w;
        s.y = near + ((s.y - near) / d) * w;
      }
      d = Math.hypot(s.x, s.y - far);
      const reach = Math.hypot(w, h);
      if (d > reach && diag > 0) {
        s.x = (s.x / d) * reach;
        s.y = far + ((s.y - far) / d) * reach;
      }
    }
  }, []);

  const paint = useCallback(() => {
    const s = sim.current;
    const p = parts.current;
    const { w, h } = live.current;
    if (!s || !p || !w) return;
    const dx = w - s.x;
    const dy = s.ky - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.05) {
      p.front.style.clipPath = `polygon(0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px)`;
      p.under.style.clipPath = "polygon(0px 0px)";
      p.flap.style.clipPath = "polygon(0px 0px)";
      p.shades[0].style.opacity = "0";
      p.shades[1].style.opacity = "0";
    } else {
      const nx = dx / len;
      const ny = dy / len;
      const mx = (w + s.x) / 2;
      const my = (s.ky + s.y) / 2;
      const beyond = clipPage(w, h, nx, ny, mx, my, 1);
      p.front.style.clipPath = clipPage(w, h, nx, ny, mx, my, -1);
      p.under.style.clipPath = beyond;
      p.flap.style.clipPath = beyond;
      const k = 2 * (nx * mx + ny * my);
      p.flap.style.transform = `matrix(${1 - 2 * nx * nx}, ${-2 * nx * ny}, ${-2 * nx * ny}, ${1 - 2 * ny * ny}, ${k * nx}, ${k * ny})`;
      const at = `translate(${r2(mx)}px, ${r2(my)}px) rotate(${(Math.atan2(ny, nx) * 180) / Math.PI}deg)`;
      const opacity = String(0.134 + 0.755 * Math.sin((Math.PI / 2) * Math.min(1, len / 2 / (w * 0.44))));
      for (const shade of p.shades) shade.style.transform = at;
      p.shades[0].style.opacity = opacity;
      p.shades[1].style.opacity = opacity;
    }
    const book = bookRef.current;
    if (book) {
      const progress = clamp(((w - s.x) / (2 * w) - 0.12) / 0.88, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      const a = shiftFor(s.from);
      const b = shiftFor(s.from + s.dir);
      book.style.transform = `translateX(${r2(a + (b - a) * eased)}px)`;
    }
  }, [shiftFor]);

  const settle = useCallback(
    (how: Exclude<Rest, null>) => {
      const s = sim.current;
      if (!s) return;
      sim.current = null;
      parts.current = null;
      if (timer.current) clearTimeout(timer.current);
      const book = bookRef.current;
      const next = how === "commit" ? s.from + s.dir : s.from;
      if (book) book.style.transform = `translateX(${r2(shiftFor(live.current.controlled && how === "commit" ? s.from : next))}px)`;
      setTurn(null);
      if (how === "commit") {
        teased.current.turned = true;
        live.current.spread = next;
        if (!live.current.controlled) setInner(next);
        live.current.onSpreadChange?.(next);
      }
    },
    [shiftFor],
  );

  const tick = useCallback(
    (now: number) => {
      frame.current = 0;
      const s = sim.current;
      if (!s) return;
      const { w, h } = live.current;
      const dt = Math.min(0.034, Math.max(0, (now - s.last) / 1000));
      s.last = now;
      let done = false;
      if (s.mode === "spring") {
        const steps = 4;
        const sub = dt / steps;
        for (let i = 0; i < steps; i++) {
          s.vx += (STIFFNESS * (s.tx - s.x) - DAMPING * s.vx) * sub;
          s.vy += (STIFFNESS * (s.ty - s.y) - DAMPING * s.vy) * sub;
          s.x += s.vx * sub;
          s.y += s.vy * sub;
        }
        constrain(s);
        if (Math.hypot(s.tx - s.x, s.ty - s.y) < 0.4 && Math.hypot(s.vx, s.vy) < 12) {
          s.x = s.tx;
          s.y = s.ty;
          s.vx = 0;
          s.vy = 0;
          done = true;
        }
      } else if (s.mode === "tween") {
        const u = clamp((now - s.t0) / TURN_MS, 0, 1);
        const p = turnEase(u);
        const fade = (1 - p) ** 2;
        s.x = w - 2 * w * p + s.ox * fade;
        s.y = s.ky + (s.ky ? -1 : 1) * 0.16 * h * Math.sin(Math.PI * p) + s.oy * fade;
        constrain(s);
        done = u >= 1;
      } else {
        return;
      }
      paint();
      if (done) {
        if (s.rest) settle(s.rest);
        return;
      }
      frame.current = requestAnimationFrame(loop.current);
    },
    [constrain, paint, settle],
  );

  useEffect(() => {
    loop.current = tick;
  }, [tick]);

  const kick = useCallback(() => {
    const s = sim.current;
    if (!s) return;
    s.last = performance.now();
    if (!frame.current) frame.current = requestAnimationFrame(loop.current);
  }, []);

  const canTurn = useCallback((from: number, dir: Dir) => (dir === 1 ? from < live.current.max : from > 0), []);

  const begin = useCallback((dir: Dir, ky: number): Sim => {
    const current = sim.current;
    if (current && current.dir === dir) return current;
    const { w, spread: from } = live.current;
    const next: Sim = {
      dir,
      from,
      ky,
      x: w,
      y: ky,
      vx: 0,
      vy: 0,
      mode: "spring",
      tx: w,
      ty: ky,
      rest: null,
      t0: 0,
      ox: 0,
      oy: 0,
      last: performance.now(),
      tease: false,
    };
    sim.current = next;
    parts.current = null;
    setTurn({ dir, from });
    return next;
  }, []);

  const springTo = useCallback(
    (s: Sim, tx: number, ty: number, rest: Rest) => {
      s.mode = "spring";
      s.tx = tx;
      s.ty = ty;
      s.rest = rest;
      kick();
    },
    [kick],
  );

  const layBack = useCallback(() => {
    const s = sim.current;
    if (!s || s.mode === "tween" || s.rest === "commit") return;
    s.tease = false;
    springTo(s, live.current.w, s.ky, "remove");
  }, [springTo]);

  const lift = useCallback(
    (dir: Dir, ky: number, dx: number, dy: number, hold?: number) => {
      const { w, h, spread: from, reduced: still } = live.current;
      if (still || !w || !canTurn(from, dir)) return;
      const current = sim.current;
      if (current && current.dir === dir && current.ky !== ky && current.mode === "spring" && current.rest !== "commit" && Math.hypot(current.x - w, current.y - current.ky) < 3) {
        current.ky = ky;
        current.x = w;
        current.y = ky;
        current.vx = 0;
        current.vy = 0;
      } else if (current && (current.dir !== dir || current.ky !== ky || current.mode !== "spring" || current.rest === "commit")) {
        if (current.dir === dir && current.mode === "spring" && current.rest !== "commit") layBack();
        return;
      }
      const s = begin(dir, ky);
      springTo(s, w - dx, ky === h ? ky - dy : ky + dy, null);
      if (hold) {
        s.tease = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (sim.current === s && s.tease && !gesture.current) layBack();
        }, hold);
      }
    },
    [begin, canTurn, layBack, springTo],
  );

  const dismissHint = useCallback(() => setHintHidden(true), []);

  const go = useCallback(
    (dir: Dir) => {
      dismissHint();
      let current = sim.current;
      if (current && (current.mode === "tween" || current.rest === "commit")) {
        settle("commit");
        current = null;
      }
      const from = live.current.spread;
      if (!canTurn(from, dir)) return;
      if (live.current.reduced || !live.current.w) {
        if (current) settle("remove");
        const next = from + dir;
        teased.current.turned = true;
        live.current.spread = next;
        if (!live.current.controlled) setInner(next);
        live.current.onSpreadChange?.(next);
        return;
      }
      if (current && current.dir !== dir) {
        settle("remove");
        current = null;
      }
      const s = current ?? begin(dir, live.current.h);
      armTween(s, live.current.w);
      kick();
    },
    [begin, canTurn, dismissHint, kick, settle],
  );

  useLayoutEffect(() => {
    const el = turnRef.current;
    if (!el || !turn) return;
    const q = (name: string) => el.querySelector<HTMLElement>(`[data-p="${name}"]`)!;
    parts.current = {
      front: q("front"),
      under: q("under"),
      flap: q("flap"),
      shades: [q("frontCurl"), q("underShadow"), q("flapCurl")],
    };
    paint();
  }, [turn, paint, dims]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // First-view tease.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !tease || reduced || !dims.w) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || teased.current.first) return;
        teased.current.first = true;
        teased.current.last = performance.now();
        const { w, h } = live.current;
        lift(1, h, w * 0.26, w * 0.2, 1300);
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [tease, reduced, dims.w, lift]);

  const onBookEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !tease || teased.current.turned || sim.current) return;
    const now = performance.now();
    if (!teased.current.first || now - teased.current.last < 2500) return;
    teased.current.last = now;
    const { w, h } = live.current;
    lift(1, h, w * 0.13, w * 0.1, 700);
  };

  const onEdgeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dir = dirOf(event.currentTarget);
    if (event.button !== 0 || gesture.current) return;
    if (!canTurn(live.current.spread, dir) && !(sim.current && sim.current.dir === dir)) return;
    let current = sim.current;
    if (current && (current.mode === "tween" || current.rest === "commit")) {
      if (current.dir !== dir) return;
    } else if (current && current.dir !== dir) {
      settle("remove");
      current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    const { h, reduced: still } = live.current;
    const ky = event.clientY < box.top + box.height / 2 ? 0 : h;
    const s = still ? null : (current ?? begin(dir, ky));
    if (s) hold(s);
    gesture.current = {
      id: event.pointerId,
      dir,
      sx: event.clientX,
      sy: event.clientY,
      cx: s ? s.x : 0,
      cy: s ? s.y : 0,
      moved: false,
      samples: [],
    };
  };

  const onEdgeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dir = dirOf(event.currentTarget);
    const g = gesture.current;
    const { w, h, spread: from } = live.current;
    if (g) {
      if (g.id !== event.pointerId) return;
      const dx = (event.clientX - g.sx) * g.dir;
      const dy = event.clientY - g.sy;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 4) return;
        g.moved = true;
        dismissHint();
      }
      const s = sim.current;
      if (!s || s.dir !== g.dir) return;
      if (s.mode !== "drag") {
        if (s.mode === "tween" || s.rest === "commit") {
          g.cx = s.x - dx;
          g.cy = s.y - dy;
        }
        s.mode = "drag";
        s.rest = null;
      }
      s.x = g.cx + dx;
      s.y = g.cy + dy;
      constrain(s);
      const now = performance.now();
      g.samples.push({ t: now, x: s.x, y: s.y });
      while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();
      paint();
      return;
    }
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const outer = dir === 1 ? box.right - event.clientX : event.clientX - box.left;
    const top = event.clientY - box.top;
    const bottom = box.bottom - event.clientY;
    const s = sim.current;
    if (outer < CORNER_ZONE && Math.min(top, bottom) < CORNER_ZONE && canTurn(from, dir)) {
      if (s?.tease) s.tease = false;
      lift(dir, top < bottom ? 0 : h, w * 0.148, w * 0.113);
    } else if (s && !s.tease && s.mode === "spring" && s.rest === null) {
      layBack();
    }
  };

  const onEdgeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const s = sim.current;
    if (!g.moved) {
      if (event.type === "pointercancel") layBack();
      else go(g.dir);
      return;
    }
    if (!s || s.dir !== g.dir) {
      if (!s && event.type !== "pointercancel") go(g.dir);
      return;
    }
    const first = g.samples[0];
    const lastSample = g.samples[g.samples.length - 1];
    const span = first && lastSample ? (lastSample.t - first.t) / 1000 : 0;
    const stale = lastSample ? performance.now() - lastSample.t > 120 : true;
    s.vx = span > 0.008 && !stale ? (lastSample.x - first.x) / span : 0;
    s.vy = span > 0.008 && !stale ? (lastSample.y - first.y) / span : 0;
    const { w } = live.current;
    const forward = event.type !== "pointercancel" && s.vx < 400 && (s.vx < -400 || s.x + s.vx * 0.12 < w * 0.6);
    if (forward && canTurn(s.from, s.dir)) springTo(s, -w, s.ky, "commit");
    else springTo(s, w, s.ky, "remove");
  };

  const onEdgeEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const dir = dirOf(event.currentTarget);
    if (canTurn(live.current.spread, dir)) setCue(dir);
  };

  const onEdgeLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current || event.pointerType !== "mouse") return;
    const s = sim.current;
    if (s && !s.tease && s.mode === "spring" && s.rest === null) layBack();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      go(-1);
    }
  };

  const at = (index: number) => (index >= 0 && index < count ? pages[index] : undefined);
  const page = (index: number, side: "left" | "right") => {
    const content = at(index);
    if (content === undefined) return null;
    return (
      <div className={styles.page} data-side={side}>
        {content}
      </div>
    );
  };

  const base = turn ? turn.from : spread;
  const leftIndex = turn && turn.dir === -1 ? 2 * base - 3 : 2 * base - 1;
  const rightIndex = turn && turn.dir === 1 ? 2 * base + 2 : 2 * base;
  const frontIndex = turn ? (turn.dir === 1 ? 2 * base : 2 * base - 1) : -1;
  const flapIndex = turn ? (turn.dir === 1 ? 2 * base + 1 : 2 * base - 2) : -1;

  const first = 2 * spread;
  const second = 2 * spread + 1;
  const single = spread === 0 || second > count;
  const isBack = spread > 0 && second > count;
  const name = spread === 0 ? "Cover" : isBack ? "Back cover" : `Pages ${first}–${second}`;
  const total = single ? `${count} pages` : `of ${count}`;
  const status = spread === 0 ? `Page 1 of ${count}` : isBack ? `Page ${first} of ${count}` : `Page ${first} and ${second} of ${count}`;
  const open = !turn && !single;
  const rest = spread <= 0 ? -dims.w / 2 : isBack ? dims.w / 2 : 0;

  const vars = {
    ...style,
    "--page-w": `${dims.w}px`,
    "--page-h": `${dims.h}px`,
    "--diag": `${dims.diag}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={vars}
      role="group"
      aria-roledescription="book"
      aria-label={label}
      tabIndex={0}
      data-ready={dims.w ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      <div
        ref={bookRef}
        className={styles.book}
        style={{ transform: `translateX(${r2(rest)}px)` }}
        onPointerEnter={onBookEnter}
      >
        <div className={`${styles.slot} ${styles.left}`}>{page(leftIndex, "left")}</div>
        <div className={`${styles.slot} ${styles.right}`}>{page(rightIndex, "right")}</div>
        {open ? <div className={styles.gutter} aria-hidden="true" /> : null}
        <div
          className={`${styles.edge} ${styles.edgeLeft}`}
          aria-hidden="true"
          data-on={cue === -1 && spread > 0 ? "true" : undefined}
          data-can={spread > 0 ? "true" : undefined}
          onPointerEnter={onEdgeEnter}
          data-dir="-1"
          onPointerDown={onEdgeDown}
          onPointerMove={onEdgeMove}
          onPointerUp={onEdgeUp}
          onPointerCancel={onEdgeUp}
          onPointerLeave={onEdgeLeave}
        >
          <span className={styles.cue}>
            <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
          </span>
        </div>
        <div
          className={`${styles.edge} ${styles.edgeRight}`}
          aria-hidden="true"
          data-on={(cue === 1 || spread <= 0) && spread < max ? "true" : undefined}
          data-can={spread < max ? "true" : undefined}
          onPointerEnter={onEdgeEnter}
          data-dir="1"
          onPointerDown={onEdgeDown}
          onPointerMove={onEdgeMove}
          onPointerUp={onEdgeUp}
          onPointerCancel={onEdgeUp}
          onPointerLeave={onEdgeLeave}
        >
          <span className={styles.cue}>
            <ChevronRight strokeWidth={1.75} aria-hidden="true" />
          </span>
        </div>
        {hint !== null && hint !== undefined ? (
          <p className={styles.hint} aria-hidden="true" data-hidden={hintHidden ? "true" : undefined}>
            {hint}
            <MoveUpRight strokeWidth={1.75} aria-hidden="true" />
          </p>
        ) : null}
        {turn ? (
          <div ref={turnRef} className={styles.turn} data-dir={turn.dir} aria-hidden="true">
            <div className={styles.front} data-p="front">
              <div className={turn.dir === -1 ? styles.mirror : undefined}>
                {page(frontIndex, turn.dir === 1 ? "right" : "left")}
              </div>
              <div className={`${styles.shade} ${styles.frontCurl}`} data-p="frontCurl" />
            </div>
            <div className={styles.under} data-p="under">
              <div className={`${styles.shade} ${styles.underShadow}`} data-p="underShadow" />
            </div>
            <div className={styles.flapWrap}>
              <div className={styles.flap} data-p="flap">
                <div className={turn.dir === 1 ? styles.mirror : undefined}>
                  {page(flapIndex, turn.dir === 1 ? "left" : "right")}
                </div>
                <div className={`${styles.shade} ${styles.flapCurl}`} data-p="flapCurl" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {controls ? (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            disabled={spread <= 0}
            aria-label="Previous page"
            onClick={() => go(-1)}
          >
            <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
          </button>
          <p className={styles.count} aria-hidden="true">
            <span>{name}</span>
            <span className={styles.total}>{total}</span>
          </p>
          <button
            type="button"
            className={styles.control}
            disabled={spread >= max}
            aria-label="Next page"
            onClick={() => go(1)}
          >
            <ChevronRight strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <span className={styles.status} role="status">
        {status}
      </span>
    </div>
  );
}

export default PageCurl;
