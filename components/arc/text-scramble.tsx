"use client";

import { animate, type AnimationPlaybackControls } from "motion/react";
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ElementType,
  type PointerEvent,
} from "react";
import { motionTokens as T, cx } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./text-scramble.module.css";

export const scrambleGlyphs = {
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  hex: "0123456789ABCDEF",
  binary: "01",
  symbols: "!#$%&*+-/<=>?@[]^_{|}~",
  blocks: "░▒▓█▖▗▘▙▚▛▜▝▞▟",
};

type Trigger = "mount" | "inView" | "change" | "hover";
type Order = "start" | "end" | "center" | "random";

export type TextScrambleHandle = { replay: () => void; readonly element: HTMLElement | null };

export type TextScrambleProps = {
  children: string;
  trigger?: Trigger | Trigger[];
  glyphs?: string;
  matchCase?: boolean;
  scrambleSymbols?: boolean;
  duration?: number;
  order?: Order;
  tick?: number;
  once?: boolean;
  wrap?: boolean;
  as?: ElementType;
  className?: string;
  id?: string;
  onStart?: () => void;
  onComplete?: () => void;
};

type Plan = {
  from: string[];
  start: number[];
  end: number[];
  ghosts: { char: string; start: number; end: number }[];
};

const noop = () => () => {};
const DIGIT = /\p{Nd}/u;
const UPPER = /\p{Lu}/u;
const LOWER = /\p{Ll}/u;
const WORDISH = /[\p{L}\p{N}]/u;

function tokenize(text: string) {
  const tokens: { text: string; space: boolean; first: number }[] = [];
  const chars: string[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    const space = /^\s+$/.test(part);
    tokens.push({ text: part, space, first: chars.length });
    if (!space) chars.push(...Array.from(part));
  }
  return { tokens, chars };
}

function offsets(count: number, order: Order): number[] {
  const span = Math.max(1, count - 1);
  const idx = Array.from({ length: count }, (_, i) => i);
  if (order === "end") return idx.map((i) => (count - 1 - i) / span);
  if (order === "center") {
    const mid = (count - 1) / 2;
    const half = Math.max(0.5, mid);
    return idx.map((i) => Math.abs(i - mid) / half);
  }
  if (order === "random") {
    const shuffled = [...idx];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const out: number[] = [];
    shuffled.forEach((v, i) => {
      out[v] = i / span;
    });
    return out;
  }
  return idx.map((i) => i / span);
}

const autoDuration = (n: number) => Math.min(1.2, Math.max(0.5, 0.3 + 0.03 * n));

export const TextScramble = forwardRef<TextScrambleHandle, TextScrambleProps>(function TextScramble(
  {
    children,
    trigger = ["inView", "change"],
    glyphs = scrambleGlyphs.alphanumeric,
    matchCase = true,
    scrambleSymbols = false,
    duration,
    order = "start",
    tick = 45,
    once = true,
    wrap = false,
    as = "span",
    className,
    id,
    onStart,
    onComplete,
  },
  ref,
) {
  const triggerKey = (Array.isArray(trigger) ? trigger : [trigger]).join(" ");
  const triggers = useMemo(() => new Set(triggerKey.split(" ") as Trigger[]), [triggerKey]);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduced = mounted && prefersReduced;
  const { tokens, chars } = useMemo(() => tokenize(children), [children]);
  const rootRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const ghostsRef = useRef<HTMLSpanElement>(null);
  const widthRef = useRef(0);
  const widthAnim = useRef<AnimationPlaybackControls | null>(null);
  const raf = useRef(0);
  const running = useRef(false);
  const prevText = useRef(children);
  const played = useRef(false);
  const [armed] = useState(() => triggers.has("mount") || triggers.has("inView"));
  const pools = useMemo(() => {
    const all = Array.from(glyphs);
    const pick = (re: RegExp) => {
      const subset = all.filter((g) => re.test(g));
      return subset.length ? subset : all;
    };
    return { all, digit: pick(DIGIT), upper: pick(UPPER), lower: pick(LOWER) };
  }, [glyphs]);
  const config = useRef({ chars, pools, matchCase, scrambleSymbols, tick, onStart, onComplete });
  useLayoutEffect(() => {
    config.current = { chars, pools, matchCase, scrambleSymbols, tick, onStart, onComplete };
  });

  const cells = useCallback(() => Array.from(trackRef.current?.querySelectorAll<HTMLElement>("[data-cell]") ?? []), []);
  const disarm = useCallback(() => {
    if (rootRef.current) delete rootRef.current.dataset.armed;
  }, []);
  const stop = useCallback(
    (reset: boolean) => {
      cancelAnimationFrame(raf.current);
      running.current = false;
      if (reset) {
        for (const cell of cells()) {
          cell.dataset.state = "rest";
          const glyph = cell.lastElementChild;
          if (glyph) glyph.textContent = "";
        }
        ghostsRef.current?.replaceChildren();
      }
    },
    [cells],
  );

  const run = useCallback(
    (plan: Plan) => {
      const cfg = config.current;
      const nodes = cells();
      if (!nodes.length && !plan.ghosts.length) return;
      cancelAnimationFrame(raf.current);
      running.current = true;
      disarm();
      cfg.onStart?.();
      const poolFor = (ch: string) => {
        const { pools: p } = config.current;
        if (!cfg.matchCase) return p.all;
        return DIGIT.test(ch) ? p.digit : UPPER.test(ch) ? p.upper : LOWER.test(ch) ? p.lower : p.all;
      };
      const scrambles = (ch: string) => !!ch && (cfg.scrambleSymbols || WORDISH.test(ch));
      const ghostHost = ghostsRef.current;
      const ghostEls = plan.ghosts.map((g) => {
        const el = document.createElement("span");
        el.className = styles.ghost;
        el.textContent = g.char;
        return el;
      });
      ghostHost?.replaceChildren(...ghostEls);
      const glyphEls = nodes.map((n) => n.lastElementChild as HTMLElement);
      const shown = nodes.map(() => "");
      const jitter = nodes.map(() => Math.random() * cfg.tick);
      const lastTick = nodes.map(() => -1);
      const ghostTick = plan.ghosts.map(() => -1);
      const startedAt = performance.now();
      const finish = Math.max(0, ...plan.end, ...plan.ghosts.map((g) => g.end));
      const set = (i: number, state: string, text: string) => {
        const cell = nodes[i];
        if (cell.dataset.state !== state) cell.dataset.state = state;
        const next = state === "rest" ? "" : text;
        if (shown[i] !== next) {
          glyphEls[i].textContent = next;
          shown[i] = next;
        }
      };
      const frame = (now: number) => {
        const t = (now - startedAt) / 1000;
        const current = config.current.chars;
        for (let i = 0; i < nodes.length; i++) {
          const ch = current[i] ?? "";
          if (t >= plan.end[i] || !scrambles(ch)) {
            set(i, "rest", ch);
            continue;
          }
          if (t < plan.start[i]) {
            set(i, "from", plan.from[i] ?? "");
            continue;
          }
          const tk = Math.floor((now + jitter[i]) / config.current.tick);
          if (tk !== lastTick[i]) {
            lastTick[i] = tk;
            const pool = poolFor(ch);
            let g = pool[Math.floor(Math.random() * pool.length)];
            if (g === shown[i] && pool.length > 1) g = pool[(pool.indexOf(g) + 1) % pool.length];
            set(i, "noise", g);
          }
        }
        plan.ghosts.forEach((g, i) => {
          const el = ghostEls[i];
          if (t >= g.end) {
            if (el.dataset.state !== "gone") el.dataset.state = "gone";
            return;
          }
          if (t < g.start) return;
          const tk = Math.floor(now / config.current.tick);
          if (tk === ghostTick[i]) return;
          ghostTick[i] = tk;
          el.dataset.state = "noise";
          const pool = poolFor(g.char);
          el.textContent = pool[Math.floor(Math.random() * pool.length)];
        });
        if (t >= finish + 0.2) {
          running.current = false;
          ghostHost?.replaceChildren();
          config.current.onComplete?.();
          return;
        }
        raf.current = requestAnimationFrame(frame);
      };
      frame(startedAt);
      raf.current = requestAnimationFrame(frame);
    },
    [cells, disarm],
  );

  const reveal = useCallback(
    (fromCurrent: boolean) => {
      const { chars: current } = config.current;
      const n = current.length;
      const total = duration ?? autoDuration(n);
      const lead = Math.min(0.32, 0.4 * total);
      const off = offsets(n, order);
      run({
        from: fromCurrent ? [...current] : current.map(() => ""),
        start: fromCurrent ? off.map((o) => o * (total - lead) * 0.45) : off.map(() => 0),
        end: off.map((o) => lead + o * (total - lead)),
        ghosts: [],
      });
    },
    [duration, order, run],
  );

  useLayoutEffect(() => {
    if (!armed) return;
    const el = rootRef.current;
    if (!el) return;
    if (reduced) return void disarm();
    if (!mounted) return;
    if (triggers.has("mount") && !played.current) {
      played.current = true;
      reveal(false);
      return;
    }
    if (!triggers.has("inView") || typeof IntersectionObserver === "undefined") return void disarm();
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (!last?.isIntersecting || (once && played.current)) return;
        played.current = true;
        reveal(false);
        if (once) observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [armed, disarm, mounted, once, reveal, reduced, triggers]);

  useLayoutEffect(() => {
    const before = prevText.current;
    if (before === children) return;
    prevText.current = children;
    if (reduced || !triggers.has("change")) {
      stop(true);
      disarm();
      return;
    }
    const oldChars = tokenize(before).chars;
    const n = chars.length;
    const total = duration ?? autoDuration(Math.max(n, oldChars.length));
    const lead = Math.min(0.3, 0.35 * total);
    const off = offsets(n, order);
    const end = off.map((o) => lead + o * (total - lead));
    const start = off.map((o, i) => (i >= oldChars.length ? Math.max(0, end[i] - lead) : o * (total - lead) * 0.35));
    const extra = oldChars.slice(n);
    played.current = true;
    run({
      from: chars.map((_, i) => oldChars[i] ?? ""),
      start,
      end,
      ghosts: wrap ? [] : extra.map((char, i) => ({ char, start: 0, end: 0.6 * lead + (i / Math.max(1, extra.length)) * lead })),
    });
  }, [chars, children, disarm, duration, order, reduced, run, stop, triggers, wrap]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const track = trackRef.current;
    if (!frame || !track) return;
    if (wrap) {
      frame.style.width = "";
      widthRef.current = 0;
      return;
    }
    const width = track.getBoundingClientRect().width;
    if (widthRef.current && Math.abs(width - widthRef.current) > 0.5 && !reduced && triggers.has("change")) {
      widthAnim.current?.stop();
      widthAnim.current = animate(frame, { width }, T.spring.morph);
    } else {
      widthAnim.current?.stop();
      frame.style.width = `${width}px`;
    }
    widthRef.current = width;
  }, [children, reduced, triggers, wrap]);

  useEffect(() => {
    const frame = frameRef.current;
    const track = trackRef.current;
    if (wrap || !frame || !track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = track.getBoundingClientRect().width;
      if (Math.abs(width - widthRef.current) < 0.5) return;
      widthAnim.current?.stop();
      frame.style.width = `${width}px`;
      widthRef.current = width;
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [wrap]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      widthAnim.current?.stop();
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        if (reduced) return;
        played.current = true;
        reveal(true);
      },
      get element() {
        return rootRef.current;
      },
    }),
    [reveal, reduced],
  );

  const onPointerEnter = triggers.has("hover")
    ? (event: PointerEvent<HTMLElement>) => {
        if (reduced || running.current || event.pointerType === "touch") return;
        reveal(true);
      }
    : undefined;

  return createElement(
    as,
    {
      ref: rootRef,
      id,
      className: cx(styles.root, className),
      "data-wrap": wrap || undefined,
      "data-armed": armed ? "" : undefined,
      onPointerEnter,
    },
    <span className={styles.srOnly}>{children}</span>,
    <span ref={frameRef} className={styles.frame} aria-hidden="true">
      <span ref={trackRef} className={styles.track}>
        {tokens.map((token, i) =>
          token.space ? (
            <span key={i} className={styles.space}>
              {wrap ? " " : token.text.replace(/\s/g, "\u00a0")}
            </span>
          ) : (
            <span key={i} className={styles.word}>
              {Array.from(token.text).map((ch, j) => (
                <span key={j} className={styles.cell} data-cell="" data-state="rest">
                  <span className={styles.sizer}>{ch}</span>
                  <span className={styles.glyph} />
                </span>
              ))}
            </span>
          ),
        )}
        <span ref={ghostsRef} className={styles.ghosts} />
      </span>
    </span>,
  );
});
