"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, FileCodeCorner, Pause, Play } from "lucide-react";
import styles from "./code-magic-move.module.css";

export interface CodeMagicMoveStep {
  code: string;
  title: string;
  description?: string;
  filename?: string;
}

export interface CodeMagicMoveProps {
  /** The versions of the snippet in order. */
  steps?: CodeMagicMoveStep[];
  language?: string;
  filename?: string;
  /** Index of the shown step for controlled use. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  /** Walk through the steps on its own and loop from the last back to the first. */
  autoPlay?: boolean;
  /** Seconds each step rests before autoplay moves on. */
  interval?: number;
  /** Multiplies the pace of every move. */
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_STEPS: CodeMagicMoveStep[] = [
  {
    title: "Start with a button",
    description: "A plain button with a fixed label.",
    code: `export function SaveButton() {
  return <button>Save</button>;
}`,
  },
  {
    title: "Track the pending state",
    description: "Import useState and keep a busy flag.",
    code: `import { useState } from "react";

export function SaveButton() {
  const [busy, setBusy] = useState(false);
  return <button>Save</button>;
}`,
  },
  {
    title: "Save on click",
    description: "Take an onSave prop and wrap it in the busy flag.",
    code: `import { useState } from "react";

export function SaveButton({ onSave }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await onSave();
    setBusy(false);
  }
  return (
    <button onClick={save}>Save</button>
  );
}`,
  },
  {
    title: "Show progress in the label",
    description: "Disable the button while it saves and say so.",
    code: `import { useState } from "react";

export function SaveButton({ onSave }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await onSave();
    setBusy(false);
  }
  return (
    <button onClick={save} disabled={busy}>
      {busy ? "Saving" : "Save"}
    </button>
  );
}`,
  },
];

type TokenClass = "" | "keyword" | "function" | "punctuation" | "tag" | "string" | "property" | "number" | "comment";

interface Tok {
  text: string;
  cls: TokenClass;
  line: number;
  col: number;
}

const KEYWORDS = new Set(
  "as async await break case catch class const continue default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of return static super switch this throw true try type typeof undefined var void while yield def elif except lambda None True False pass with fn pub use mut impl struct match".split(
    " ",
  ),
);

function tokenize(code: string): Tok[] {
  const out: Tok[] = [];
  const lines = code.replace(/\t/g, "  ").split("\n");
  const pattern = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\d[\d._]*)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
  lines.forEach((text, line) => {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    let prev = "";
    let inTag = false;
    while ((match = pattern.exec(text))) {
      const [value, comment, str, num, word, space] = match;
      const col = match.index;
      if (space) continue;
      let cls: TokenClass = "punctuation";
      if (comment) cls = "comment";
      else if (str) cls = "string";
      else if (num) cls = "number";
      else if (word) {
        const rest = text.slice(col + value.length);
        if (prev === "<" || prev === "</") cls = /^[a-z]/.test(value) || /^[A-Z]/.test(value) ? "tag" : "";
        else if (KEYWORDS.has(value)) cls = "keyword";
        else if (/^\s*\(/.test(rest)) cls = "function";
        else if (inTag && /^=/.test(rest)) cls = "property";
        else cls = "";
        if (prev === "<" && cls === "tag") inTag = true;
      } else if (value === ">") inTag = false;
      /* `<` only opens a tag when a name or a slash follows it. */
      if (value === "<" && !/^[A-Za-z/]/.test(text.slice(col + 1))) prev = "";
      else if (value === "/" && prev === "<") prev = "</";
      else prev = value;
      out.push({ text: value, cls, line, col });
    }
  });
  return out;
}

/** Longest common subsequence: pairs of indices that match in order. */
function lcs<A, B>(a: A[], b: B[], same: (x: A, y: B) => boolean) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(a[i], b[j])) pairs.push([i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

interface SceneToken {
  id: number;
  text: string;
  cls: TokenClass;
  from?: { line: number; col: number };
  to?: { line: number; col: number };
  /** For added tokens: when its first character is typed, in ms. */
  at?: number;
}

interface Scene {
  from: number;
  to: number;
  tokens: SceneToken[];
  fromLines: number;
  toLines: number;
  /** ms */
  typeStart: number;
  perChar: number;
  duration: number;
  glideEnd: number;
}

interface Mark {
  start: number;
  count: number;
}

const LINE = 1.7;
const GLIDE = 760;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function lcsHas(a: string[], b: string[], index: number) {
  return lcs(a, b, (x, y) => x === y).some(([i]) => i === index);
}

/** Pairs the tokens on screen with the next version: target index to shown index. */
function pairTokens(shown: Tok[], target: Tok[]) {
  const pairs = lcs(shown, target, (x, y) => x.text === y.text && x.cls === y.cls);
  const usedA = new Set(pairs.map(([i]) => i));
  const usedB = new Map(pairs.map(([i, j]) => [j, i]));
  /* Leftover words pair by distance, so a line that moved as a whole glides. */
  target.forEach((t, j) => {
    if (usedB.has(j) || t.text.length < 2) return;
    let best = -1;
    let bestD = Infinity;
    shown.forEach((s, i) => {
      if (usedA.has(i) || s.text !== t.text || s.cls !== t.cls) return;
      const d = Math.abs(s.line - t.line) * 40 + Math.abs(s.col - t.col);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      usedA.add(best);
      usedB.set(j, best);
    }
  });
  return usedB;
}

/** Line counts for the header, and bands over the lines that gained new code. */
function lineDiff(prev: string | undefined, next: string, prevTokens: Tok[] | undefined, nextTokens: Tok[]) {
  if (prev === undefined || !prevTokens) return { added: 0, removed: 0, marks: [] as Mark[] };
  const a = prev.split("\n");
  const b = next.split("\n");
  const kept = new Set(lcs(a, b, (x, y) => x === y).map(([, j]) => j));
  const marks: Mark[] = [];
  const paired = pairTokens(prevTokens, nextTokens);
  const fresh = new Set(nextTokens.filter((_, j) => !paired.has(j)).map((t) => t.line));
  const blank = b.filter((l, j) => !kept.has(j) && !l.trim()).length;
  b.forEach((_, j) => {
    if (!fresh.has(j)) return;
    const last = marks[marks.length - 1];
    if (last && last.start + last.count === j) last.count++;
    else marks.push({ start: j, count: 1 });
  });
  return { added: b.length - kept.size - blank, removed: a.filter((l, i) => l.trim() && !lcsHas(a, b, i)).length, marks };
}

/** A code block that moves between versions of a snippet. */
export function CodeMagicMove({
  steps = DEFAULT_STEPS,
  language = "tsx",
  filename = "save-button.tsx",
  value,
  defaultValue = 0,
  onValueChange,
  autoPlay = true,
  interval = 3.2,
  speed = 1,
  paused = false,
  accent,
  label = "Code walkthrough",
  className,
  style,
}: CodeMagicMoveProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const count = steps.length;
  const tokens = useMemo(() => steps.map((step) => tokenize(step.code)), [steps]);
  const lineCounts = useMemo(() => steps.map((step) => step.code.split("\n").length), [steps]);
  const diffs = useMemo(() => steps.map((step, i) => lineDiff(steps[i - 1]?.code, step.code, tokens[i - 1], tokens[i])), [steps, tokens]);
  const cols = useMemo(() => Math.max(1, ...steps.flatMap((step) => step.code.replace(/\t/g, "  ").split("\n").map((l) => l.length))), [steps]);
  const maxLines = Math.max(1, ...lineCounts);

  const nextId = useRef(0);
  const rest = useCallback(
    (index: number, keep?: SceneToken[]): Scene => {
      const list = keep
        ? keep.filter((t) => t.to).map((t) => ({ id: t.id, text: t.text, cls: t.cls, from: t.to, to: t.to }))
        : tokens[index].map((t) => ({ id: nextId.current++, text: t.text, cls: t.cls, from: { line: t.line, col: t.col }, to: { line: t.line, col: t.col } }));
      return { from: index, to: index, tokens: list, fromLines: lineCounts[index], toLines: lineCounts[index], typeStart: 0, perChar: 0, duration: 0, glideEnd: 0 };
    },
    [tokens, lineCounts],
  );

  const start = Math.min(count - 1, Math.max(0, value ?? defaultValue));
  const [index, setIndex] = useState(start);
  // eslint-disable-next-line react-hooks/refs
  const [scene, setScene] = useState<Scene>(() => rest(start));
  const [playing, setPlaying] = useState(autoPlay);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(true);

  const rootRef = useRef<HTMLElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const engine = useRef({ t: 0, dir: 0 as -1 | 0 | 1, band: 0, bandV: 0 });
  const sceneRef = useRef(scene);
  const hoverRef = useRef(false);
  const dragRef = useRef<{ id: number; x: number; y: number; active: boolean; width: number; base: number; target: number | null; lastX: number; lastT: number; v: number } | null>(null);
  const [kick, setKick] = useState(0);

  /** Build the move from the tokens on screen to a step. */
  const plan = useCallback(
    (current: Scene, to: number): Scene => {
      const shown = current.tokens.filter((t) => t.to);
      const target = tokens[to];
      const usedB = pairTokens(shown.map((t) => ({ text: t.text, cls: t.cls, line: t.to!.line, col: t.to!.col })), target);
      const list: SceneToken[] = [];
      const byA = new Map<number, number>();
      usedB.forEach((i, j) => byA.set(i, j));
      let moved = false;
      shown.forEach((s, i) => {
        const j = byA.get(i);
        if (j === undefined) {
          moved = true;
          list.push({ id: s.id, text: s.text, cls: s.cls, from: s.to });
        } else {
          const t = target[j];
          if (t.line !== s.to!.line || t.col !== s.to!.col) moved = true;
          list.push({ id: s.id, text: s.text, cls: s.cls, from: s.to, to: { line: t.line, col: t.col } });
        }
      });
      const added = target.map((t, j) => ({ t, j })).filter(({ j }) => !usedB.has(j));
      const chars = added.reduce((sum, { t }) => sum + t.text.length, 0);
      const perChar = Math.min(19, 1500 / Math.max(1, chars));
      const typeStart = moved ? 440 : 120;
      let at = typeStart;
      let lastLine = -1;
      for (const { t } of added) {
        if (lastLine >= 0 && t.line !== lastLine) at += perChar * 3;
        lastLine = t.line;
        list.push({ id: nextId.current++, text: t.text, cls: t.cls, to: { line: t.line, col: t.col }, at });
        at += t.text.length * perChar;
      }
      const glideEnd = moved ? GLIDE + Math.max(lineCounts[to], current.toLines) * 16 : 0;
      return { from: current.to, to, tokens: list, fromLines: current.toLines, toLines: lineCounts[to], typeStart, perChar, glideEnd, duration: Math.max(glideEnd, chars ? at : 0) + 220 };
    },
    [tokens, lineCounts],
  );

  /** Every value is a pure function of the time on the move's timeline. */
  const apply = useCallback(() => {
    const root = rootRef.current;
    const layer = liveRef.current;
    if (!root || !layer) return;
    const sc = sceneRef.current;
    const { t, band } = engine.current;
    const write = (el: HTMLElement, prop: "transform" | "opacity" | "clipPath" | "height", v: string) => {
      if (el.style[prop] !== v) el.style[prop] = v;
    };
    const glide = (line: number) => (sc.duration ? easeInOut(clamp01((t - line * 16) / GLIDE)) : 1);
    let caretAt: { line: number; col: number } | null = null;
    let typing = false;
    const kids = layer.children;
    sc.tokens.forEach((tok, i) => {
      const el = kids[i] as HTMLElement | undefined;
      if (!el) return;
      if (tok.from && tok.to) {
        const k = glide(tok.from.line);
        const col = tok.from.col + (tok.to.col - tok.from.col) * k;
        const line = tok.from.line + (tok.to.line - tok.from.line) * k;
        write(el, "transform", `translate3d(${+col.toFixed(3)}ch, ${+(line * LINE).toFixed(3)}em, 0)`);
        write(el, "opacity", "");
        write(el, "clipPath", "");
      } else if (tok.from) {
        const k = clamp01(t / 220);
        write(el, "transform", `translate3d(${tok.from.col}ch, ${+(tok.from.line * LINE - 0.45 * k).toFixed(3)}em, 0)`);
        write(el, "opacity", (1 - k).toFixed(3));
      } else if (tok.to) {
        const typed = clamp01((t - (tok.at ?? 0)) / Math.max(1, tok.text.length * sc.perChar));
        const chars = Math.ceil(typed * tok.text.length);
        write(el, "transform", `translate3d(${tok.to.col}ch, ${+(tok.to.line * LINE).toFixed(3)}em, 0)`);
        write(el, "opacity", typed >= 1 ? "" : clamp01((t - (tok.at ?? 0)) / 60).toFixed(3));
        write(el, "clipPath", typed >= 1 ? "" : `inset(-0.4em ${+(100 - (chars / tok.text.length) * 100).toFixed(1)}% -0.4em -0.3em)`);
        if (t >= (tok.at ?? 0)) {
          caretAt = { line: tok.to.line, col: tok.to.col + chars };
          typing = typed < 1 || typing;
        }
      }
    });
    const caret = root.querySelector<HTMLElement>("[data-el=caret]");
    if (caret) {
      const at = caretAt as { line: number; col: number } | null;
      if (at) write(caret, "transform", `translate3d(${at.col}ch, ${+(at.line * LINE).toFixed(3)}em, 0)`);
      const fade = sc.duration ? clamp01((sc.duration - t) / 200) : 0;
      write(caret, "opacity", at && t >= sc.typeStart ? fade.toFixed(3) : "0");
    }
    const k = glide(0);
    const lines = sc.fromLines + (sc.toLines - sc.fromLines) * k;
    const code = root.querySelector<HTMLElement>("[data-el=code]");
    if (code) write(code, "height", `${(lines * LINE).toFixed(3)}em`);
    root.querySelectorAll<HTMLElement>("[data-el=number]").forEach((el, i) => {
      const inFrom = i < sc.fromLines;
      const inTo = i < sc.toLines;
      const o = inFrom === inTo ? (inTo ? 1 : 0) : inTo ? clamp01((t - 320) / 90) : 1 - clamp01(t / 160);
      write(el, "opacity", sc.duration ? (o >= 1 ? "" : o.toFixed(3)) : inTo ? "" : "0");
    });
    const marks = diffs[sc.to].marks;
    root.querySelectorAll<HTMLElement>("[data-el=mark]").forEach((el, i) => {
      const mark = marks[i];
      if (!mark) return;
      let first = Infinity;
      for (const tok of sc.tokens) if (!tok.from && tok.to && tok.to.line >= mark.start && tok.to.line < mark.start + mark.count) first = Math.min(first, tok.at ?? 0);
      if (first === Infinity) first = sc.typeStart;
      const o = sc.duration ? clamp01((t - first + 40) / 200) : 1;
      write(el, "opacity", o >= 1 ? "" : o.toFixed(3));
    });
    const text = root.querySelector<HTMLElement>("[data-el=text]");
    if (text) write(text, "transform", band ? `translate3d(${band.toFixed(2)}px, 0, 0)` : "");
  }, [diffs]);

  useLayoutEffect(() => {
    sceneRef.current = scene;
    apply();
  }, [scene, apply]);

  const land = useCallback(
    (at: number) => {
      const sc = sceneRef.current;
      engine.current.t = 0;
      engine.current.dir = 0;
      const next = at === sc.to ? rest(at, sc.tokens) : rest(at, sc.tokens.filter((t) => t.from).map((t) => ({ ...t, to: t.from })));
      sceneRef.current = next;
      setScene(next);
      setIndex(at);
    },
    [rest],
  );

  /* One loop; it stops off screen, in hidden tabs, and once a move lands. */
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const e = engine.current;
      const sc = sceneRef.current;
      let busy = false;
      if (e.dir && sc.duration) {
        e.t += e.dir * dt * speed * (e.dir < 0 ? 1.6 : 1);
        if (e.dir > 0 && e.t >= sc.duration) land(sc.to);
        else if (e.dir < 0 && e.t <= 0) land(sc.from);
        else busy = true;
      }
      if (!dragRef.current?.active && (Math.abs(e.band) > 0.05 || Math.abs(e.bandV) > 0.05)) {
        /* Critically damped spring back to rest. */
        const w = 18;
        const s = dt / 1000;
        const a = -w * w * e.band - 2 * w * e.bandV;
        e.bandV += a * s;
        e.band += e.bandV * s;
        busy = true;
      } else if (!dragRef.current?.active) {
        e.band = 0;
        e.bandV = 0;
      }
      apply();
      if (busy) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, kick, speed, apply, land]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && document.visibilityState === "visible"));
    io.observe(el);
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const announce = useCallback(
    (to: number) => {
      const d = diffs[to];
      setMessage(`Step ${to + 1} of ${count}: ${steps[to].title}.${to > 0 ? ` ${d.added} line${d.added === 1 ? "" : "s"} added, ${d.removed} removed.` : ""}`);
    },
    [diffs, count, steps],
  );

  const go = useCallback(
    (raw: number, by: "user" | "auto" | "prop") => {
      const to = Math.min(count - 1, Math.max(0, raw));
      const e = engine.current;
      let sc = sceneRef.current;
      if (by === "user") setPlaying(false);
      if (to === sc.to && e.dir >= 0) return;
      if (by !== "prop") onValueChange?.(to);
      if (by === "user") announce(to);
      setIndex(to);
      if (reduced) {
        e.t = 0;
        e.dir = 0;
        sc = rest(to);
        sceneRef.current = sc;
        setScene(sc);
        return;
      }
      if (sc.duration && to === sc.from) {
        /* Stepping back mid move reverses on the same timeline. */
        e.dir = -1;
      } else if (sc.duration && to === sc.to) {
        e.dir = 1;
      } else {
        const base = sc.duration ? rest(e.t > sc.duration / 2 ? sc.to : sc.from, e.t > sc.duration / 2 ? sc.tokens : sc.tokens.filter((t) => t.from).map((t) => ({ ...t, to: t.from }))) : sc;
        const next = plan(base, to);
        e.t = 0;
        e.dir = 1;
        sceneRef.current = next;
        setScene(next);
      }
      setKick((k) => k + 1);
    },
    [count, onValueChange, announce, reduced, rest, plan],
  );

  /* Controlled value. */
  const seen = useRef(value);
  useEffect(() => {
    if (value === undefined || value === seen.current) return;
    seen.current = value;
    go(value, "prop");
  }, [value, go]);

  /* Autoplay: the active dot fills while a step rests. */
  const auto = playing && !paused && !reduced && count > 1;
  const resting = scene.duration === 0;
  const fillRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const fill = fillRef.current;
    if (!auto || !resting || !visible) {
      if (fill) fill.style.transform = "scaleX(1)";
      return;
    }
    let raf = 0;
    let elapsed = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!hoverRef.current) elapsed += now - last;
      last = now;
      const k = clamp01(elapsed / (interval * 1000));
      if (fill) fill.style.transform = `scaleX(${k.toFixed(4)})`;
      if (k >= 1) go(sceneRef.current.to === count - 1 ? 0 : sceneRef.current.to + 1, "auto");
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, resting, visible, interval, go, count, index]);
  useEffect(() => {
    hoverRef.current = hovering;
  }, [hovering]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let to: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") to = index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") to = index - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = count - 1;
    if (to === null) return;
    event.preventDefault();
    go(to, "user");
  };

  /* A sideways drag scrubs the move under the finger. */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false, width: event.currentTarget.clientWidth, base: sceneRef.current.to, target: null, lastX: event.clientX, lastT: performance.now(), v: 0 };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    if (!d.active) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - d.y)) return;
      const e = engine.current;
      if (e.dir) land(e.t > sceneRef.current.duration / 2 ? sceneRef.current.to : sceneRef.current.from);
      d.base = sceneRef.current.to;
      d.active = true;
      d.x = event.clientX;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
      setPlaying(false);
      return;
    }
    const now = performance.now();
    d.v = (event.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = event.clientX;
    d.lastT = now;
    const e = engine.current;
    const want = dx < 0 ? d.base + 1 : d.base - 1;
    if (want < 0 || want >= count) {
      /* At either end the text rubber-bands. */
      if (d.target !== null) land(d.base);
      d.target = null;
      e.band = Math.sign(dx) * 28 * (1 - Math.exp(-Math.abs(dx) / 120));
      e.bandV = 0;
      apply();
      return;
    }
    e.band = 0;
    if (d.target !== want) {
      if (d.target !== null) land(d.base);
      d.target = want;
      const next = plan(sceneRef.current, want);
      e.t = 0;
      e.dir = 0;
      sceneRef.current = next;
      setScene(next);
    }
    e.t = clamp01(Math.abs(dx) / (d.width * 0.6)) * sceneRef.current.duration;
    apply();
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== event.pointerId) return;
    dragRef.current = null;
    if (!d.active) return;
    setDragging(false);
    const e = engine.current;
    const sc = sceneRef.current;
    if (d.target !== null && sc.duration) {
      const forward = d.target > d.base ? d.v < -0.4 : d.v > 0.4;
      const commit = e.t / sc.duration > 0.33 || forward;
      e.dir = commit ? 1 : -1;
      if (commit) {
        setIndex(d.target);
        onValueChange?.(d.target);
        announce(d.target);
      }
    }
    setKick((k) => k + 1);
  };

  const step = steps[index] ?? steps[0];
  const diff = diffs[index];
  const marks = diffs[scene.to].marks;
  const digits = String(maxLines).length;
  const rootStyle = { "--cmm-cols": cols, "--cmm-digits": digits, ...(accent ? { "--cmm-accent": accent } : null), ...style } as CSSProperties;

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      aria-label={label}
      data-live="true"
      data-dragging={dragging ? "" : undefined}
      data-language={language}
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <header className={styles.header}>
        <span className={styles.file}>
          <FileCodeCorner size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.filename}>{step.filename ?? filename}</span>
        </span>
        <span className={styles.meta}>
          <span className={styles.diff} data-hidden={index === 0 ? "" : undefined}>
            <span className={styles.plus} aria-hidden="true">
              +{index === 0 ? (diffs[1]?.added ?? 0) : diff.added}
            </span>
            <span className={styles.minus} aria-hidden="true">
              −{index === 0 ? (diffs[1]?.removed ?? 0) : diff.removed}
            </span>
            {index > 0 && (
              <span className={styles.srOnly}>
                {diff.added} line{diff.added === 1 ? "" : "s"} added, {diff.removed} removed
              </span>
            )}
          </span>
          {count > 1 && !reduced && (
            <button type="button" className={styles.iconButton} aria-label={auto ? "Pause walkthrough" : "Play walkthrough"} onClick={() => setPlaying(!auto)}>
              {auto ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          )}
        </span>
      </header>
      <div
        className={styles.viewport}
        tabIndex={0}
        role="group"
        aria-label={`${label}, step ${index + 1} of ${count}`}
        aria-describedby={`${uid}-hint`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={styles.code} data-el="code" style={{ height: `${(scene.fromLines * LINE).toFixed(3)}em` }} aria-hidden="true" suppressHydrationWarning>
          <div className={styles.marks}>
            {marks.map((mark, i) => (
              <div key={`${scene.to}-${i}`} className={styles.mark} data-el="mark" style={{ transform: `translate3d(0, ${+(mark.start * LINE).toFixed(3)}em, 0)`, height: `${+(mark.count * LINE).toFixed(3)}em` }} suppressHydrationWarning />
            ))}
          </div>
          <div className={styles.numbers}>
            {Array.from({ length: maxLines }, (_, i) => (
              <span key={i} className={styles.lineNumber} data-el="number" style={{ transform: `translate3d(0, ${(i * LINE).toFixed(3)}em, 0)`, opacity: i < scene.fromLines ? undefined : 0 }} suppressHydrationWarning>
                {i + 1}
              </span>
            ))}
          </div>
          <div className={styles.text} data-el="text">
            <div className={styles.live} ref={liveRef}>
              {scene.tokens.map((tok) => {
                const at = tok.from ?? tok.to!;
                return (
                  <span
                    key={tok.id}
                    className={tok.cls ? `${styles.tok} ${styles[tok.cls] ?? ""}` : styles.tok}
                    style={{ transform: `translate3d(${at.col}ch, ${+(at.line * LINE).toFixed(3)}em, 0)`, opacity: tok.from ? undefined : 0 }}
                    suppressHydrationWarning
                  >
                    {tok.text}
                  </span>
                );
              })}
            </div>
            <span className={styles.caret} data-el="caret" />
          </div>
        </div>
        <pre className={styles.srOnly}>{step.code}</pre>
      </div>
      <footer className={styles.footer}>
        <div className={styles.caption} aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={index}
              className={styles.captionText}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              transition={{ duration: reduced ? 0 : 0.15, ease: [0.2, 0, 0, 1] }}
            >
              <span className={styles.title}>{step.title}</span>
              {step.description && <span className={styles.description}>{step.description}</span>}
            </motion.span>
          </AnimatePresence>
        </div>
        {count > 1 && (
          <div className={styles.controls}>
            <button type="button" className={styles.iconButton} disabled={index === 0} aria-label="Previous step" onClick={() => go(index - 1, "user")}>
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div className={styles.dots} role="group" aria-label="Steps">
              {steps.map((s, i) => (
                <button key={i} type="button" className={styles.dot} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === index ? "step" : undefined} onClick={() => go(i, "user")}>
                  <span className={styles.pip}>
                    <span className={styles.fill} ref={i === index ? fillRef : undefined} style={i === index ? undefined : { transform: "scaleX(1)", opacity: 0 }} />
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className={styles.iconButton} disabled={index === count - 1} aria-label="Next step" onClick={() => go(index + 1, "user")}>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        )}
      </footer>
      <span className={styles.srOnly} id={`${uid}-hint`}>
        Use the left and right arrow keys to move between steps.
      </span>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {message}
      </span>
    </section>
  );
}

export default CodeMagicMove;
