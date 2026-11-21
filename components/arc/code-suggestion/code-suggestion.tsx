"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleDot, RotateCcw, Square, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { ClaudeMark, TypeScriptMark } from "./code-suggestion-marks";
import styles from "./code-suggestion.module.css";

export interface CodeSuggestionHunk {
  id: string;
  /** Zero based line where the change starts. */
  start: number;
  /** How many original lines it replaces. 0 inserts before `start`. */
  remove?: number;
  /** The new lines. Empty deletes. */
  insert?: string[];
  /** Two to six words on what the change does. */
  summary?: string;
}

export type CodeSuggestionStatus = "thinking" | "streaming" | "ready" | "error";
export type CodeSuggestionDecision = "accepted" | "rejected";

export interface CodeSuggestionResult {
  code: string;
  accepted: string[];
  rejected: string[];
}

export interface CodeSuggestionProps {
  /** The original file contents, lines split on \n. */
  code?: string;
  /** The proposed changes. Leave unset to play the built-in simulated suggestion. */
  hunks?: CodeSuggestionHunk[];
  /** Controlled status when you pass hunks. */
  status?: CodeSuggestionStatus;
  instruction?: string;
  model?: { name: string; mark?: ReactNode } | null;
  fileName?: string;
  filePath?: string;
  fileMark?: ReactNode | null;
  error?: string;
  onDecision?: (hunk: CodeSuggestionHunk, decision: CodeSuggestionDecision, code: string) => void;
  onResolve?: (result: CodeSuggestionResult) => void;
  onStop?: () => void;
  onRegenerate?: () => void;
  /** Simulated suggestion only: reviews itself and replays until someone touches it. */
  autoPlay?: boolean;
  shortcuts?: boolean;
  /** Caps the code area height in pixels. */
  maxCodeHeight?: number;
  className?: string;
  style?: CSSProperties;
}

const SAMPLE_CODE = `import type { Invoice } from "./types";

export async function fetchInvoice(id: string): Promise<Invoice> {
  const res = await fetch(\`/api/invoices/\${id}\`);
  if (!res.ok) throw new Error(\`Invoice \${id} failed: \${res.status}\`);
  return res.json();
}`;

const SAMPLE_HUNKS: CodeSuggestionHunk[] = [
  {
    id: "limits",
    start: 1,
    remove: 0,
    summary: "Add retry limits",
    insert: ['import { sleep } from "./sleep";', "", "const MAX_ATTEMPTS = 4;", "const BASE_DELAY_MS = 250;"],
  },
  {
    id: "loop",
    start: 3,
    remove: 1,
    summary: "Retry 429 and 5xx with backoff",
    insert: [
      "  let res = await fetch(`/api/invoices/${id}`);",
      "  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {",
      "    if (res.status !== 429 && res.status < 500) break;",
      "    await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));",
      "    res = await fetch(`/api/invoices/${id}`);",
      "  }",
    ],
  },
  {
    id: "error",
    start: 4,
    remove: 1,
    summary: "Mention retries in the error",
    insert: ["  if (!res.ok) {", "    throw new Error(`Invoice ${id} failed after retries: ${res.status}`);", "  }"],
  },
];

const DEFAULT_MODEL = { name: "Claude Sonnet 5.5", mark: <ClaudeMark aria-hidden style={{ color: "#D97757" }} /> };
const DEFAULT_ERROR = "The model stopped responding. Nothing was changed.";

const KEYWORDS = new Set(
  "abstract as async await break case catch class const continue debugger declare default delete do else enum export extends false finally for from function get if implements import in instanceof interface is keyof let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while yield".split(
    " ",
  ),
);

const highlighted = new Map<string, ReactNode>();
const TOKEN = /(\/\/.*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)/g;

/** A small TypeScript and JavaScript highlighter. Each line is highlighted once and kept by its text. */
function highlight(line: string): ReactNode {
  const hit = highlighted.get(line);
  if (hit !== undefined) return hit;
  if (!line) {
    highlighted.set(line, "\u200b");
    return "\u200b";
  }
  const out: ReactNode[] = [];
  let plain = "";
  let key = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = "";
  };
  const push = (cls: string, text: string) => {
    flush();
    out.push(
      <span key={key++} className={cls}>
        {text}
      </span>,
    );
  };
  let i = 0;
  while (i < line.length) {
    TOKEN.lastIndex = i;
    const match = TOKEN.exec(line);
    if (!match) {
      plain += line.slice(i);
      break;
    }
    plain += line.slice(i, match.index);
    i = match.index + match[0].length;
    if (match[1]) push(styles.tComment, match[0]);
    else if (match[2]) push(styles.tString, match[0]);
    else if (match[3]) {
      /* Template literal: string parts, with each ${...} set apart. */
      let part = "`";
      let closed = false;
      while (i < line.length && !closed) {
        if (line[i] === "\\") {
          part += line.slice(i, i + 2);
          i += 2;
        } else if (line[i] === "$" && line[i + 1] === "{") {
          const end = line.indexOf("}", i);
          if (end < 0) break;
          if (part) push(styles.tString, part);
          part = "";
          push(styles.tPunct, line.slice(i, end + 1));
          i = end + 1;
        } else {
          part += line[i];
          closed = line[i] === "`";
          i++;
        }
      }
      if (!closed) {
        part += line.slice(i);
        i = line.length;
      }
      if (part) push(styles.tString, part);
    } else if (match[4]) push(styles.tNumber, match[0]);
    else {
      const word = match[0];
      const before = line[match.index - 1];
      if (KEYWORDS.has(word) && before !== ".") push(styles.tKeyword, word);
      else if (line[i] === "(") push(styles.tFunction, word);
      else if (/^[A-Z]/.test(word)) push(styles.tType, word);
      else plain += word;
    }
  }
  flush();
  const node = out.length === 1 && typeof out[0] === "string" ? out[0] : out;
  highlighted.set(line, node);
  return node;
}

const noop = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const plural = (n: number) => `${n} change${n === 1 ? "" : "s"}`;

interface Sim {
  phase: CodeSuggestionStatus;
  /** Per hunk: -1 not started, otherwise how many new lines are in. */
  shown: number[];
  run: number;
}

type Decisions = Record<string, CodeSuggestionDecision>;

const fold = { type: "spring" as const, duration: 0.26, bounce: 0 };
const openBar = { type: "spring" as const, duration: 0.24, bounce: 0 };
const instant = { duration: 0 };

/** An AI code edit suggestion in a small editor panel. */
export function CodeSuggestion({
  code,
  hunks: hunksProp,
  status: statusProp = "ready",
  instruction = "Add retry with backoff",
  model = DEFAULT_MODEL,
  fileName = "fetch-invoice.ts",
  filePath,
  fileMark,
  error = DEFAULT_ERROR,
  onDecision,
  onResolve,
  onStop,
  onRegenerate,
  autoPlay = true,
  shortcuts = true,
  maxCodeHeight,
  className,
  style,
}: CodeSuggestionProps) {
  const reduced = useReducedMotion() ?? false;
  const simulated = hunksProp === undefined;
  const source = code ?? SAMPLE_CODE;
  const lines = useMemo(() => source.split("\n"), [source]);
  const hunks = useMemo(() => {
    /* Sorted, inside the file, and overlapping hunks after the first are ignored. */
    const sorted = [...(hunksProp ?? SAMPLE_HUNKS)].sort((a, b) => a.start - b.start);
    const out: CodeSuggestionHunk[] = [];
    let end = 0;
    for (const hunk of sorted) {
      const start = Math.max(0, Math.min(lines.length, Math.floor(hunk.start)));
      const remove = Math.max(0, Math.min(lines.length - start, Math.floor(hunk.remove ?? 0)));
      if (start < end || (start === end && out.some((h) => h.start === start && !(h.remove ?? 0) && !remove))) continue;
      out.push({ ...hunk, start, remove, insert: hunk.insert ?? [] });
      end = start + remove;
    }
    return out;
  }, [hunksProp, lines.length]);
  const path = filePath ?? (code === undefined ? "src/billing" : undefined);
  const mark = fileMark === undefined ? <TypeScriptMark aria-hidden /> : fileMark;
  const apple = useSyncExternalStore(noop, isApple, () => false);

  const [sim, setSim] = useState<Sim>(() => ({ phase: "thinking", shown: hunks.map(() => -1), run: 0 }));
  const [decisions, setDecisions] = useState<Decisions>({});
  const [message, setMessage] = useState("");
  const [inView, setInView] = useState(false);
  const [handsOn, setHandsOn] = useState(false);
  const [stopped, setStopped] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  /* Reduced motion opens on the finished suggestion. */
  const status: CodeSuggestionStatus = simulated ? (reduced && sim.run === 0 && sim.phase !== "ready" ? "ready" : sim.phase) : statusProp;
  const shownOf = (index: number) => {
    const total = hunks[index].insert!.length;
    if (!simulated) return status === "thinking" || status === "error" ? -1 : total;
    if (reduced && sim.run === 0 && sim.phase !== "ready") return total;
    return sim.shown[index] ?? -1;
  };
  const open = hunks.map((_, i) => shownOf(i) >= 0);
  const live = hunks.filter((_, i) => open[i]);
  const pending = status === "ready" ? live.filter((h) => !decisions[h.id]) : [];
  const accepted = live.filter((h) => decisions[h.id] === "accepted");
  const done = status === "ready" && live.length > 0 && pending.length === 0;

  const codeWith = useCallback(
    (map: Decisions) => {
      const out: string[] = [];
      let at = 0;
      for (const hunk of hunks) {
        if (map[hunk.id] !== "accepted") continue;
        out.push(...lines.slice(at, hunk.start), ...hunk.insert!);
        at = hunk.start + (hunk.remove ?? 0);
      }
      out.push(...lines.slice(at));
      return out.join("\n");
    },
    [hunks, lines],
  );

  /* The simulated suggestion: single timeouts per step, only while the card is in view. */
  const play = useCallback(() => {
    clearTimers();
    setDecisions({});
    setStopped(false);
    setSim((s) => ({ phase: "thinking", shown: hunks.map(() => -1), run: s.run + 1 }));
    setMessage(`Reading ${fileName}`);
    let at = 820;
    const later = (fn: () => void) => timers.current.push(setTimeout(fn, at));
    later(() => {
      setSim((s) => ({ ...s, phase: "streaming" }));
      setMessage("Writing changes");
    });
    hunks.forEach((hunk, index) => {
      at += index === 0 ? 90 : 150;
      const set = (n: number) => later(() => setSim((s) => ({ ...s, shown: s.shown.map((v, i) => (i === index ? n : v)) })));
      if (hunk.remove) {
        set(0);
        at += 180;
      }
      hunk.insert!.forEach((_, n) => {
        if (n > 0) at += 38;
        set(n + 1);
      });
      if (!hunk.insert!.length && !hunk.remove) set(0);
    });
    at += 150;
    later(() => {
      setSim((s) => ({ ...s, phase: "ready" }));
      setMessage(hunks.length ? `${plural(hunks.length)} to review` : "No changes needed");
    });
  }, [clearTimers, hunks, fileName]);

  const started = useRef(false);
  useEffect(() => {
    if (!simulated || reduced || !inView || started.current) return;
    started.current = true;
    play();
  }, [simulated, reduced, inView, play]);
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Controlled status: announce it, and going back to thinking clears earlier decisions. */
  const lastStatus = useRef<CodeSuggestionStatus | null>(null);
  useEffect(() => {
    if (simulated && !(reduced && sim.run === 0)) return;
    if (lastStatus.current === status) return;
    const first = lastStatus.current === null;
    lastStatus.current = status;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (status === "thinking") {
      setDecisions({});
      setMessage(`Reading ${fileName}`);
    } else if (status === "streaming") setMessage("Writing changes");
    else if (status === "error") setMessage(error);
    else if (!first || hunks.length === 0) setMessage(hunks.length ? `${plural(hunks.length)} to review` : "No changes needed");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [simulated, reduced, sim.run, status, fileName, error, hunks.length]);

  const resultText = (map: Decisions, list: CodeSuggestionHunk[]) => {
    const a = list.filter((h) => map[h.id] === "accepted").length;
    const r = list.length - a;
    return r === 0 ? (a === 1 ? "Change applied" : "All changes applied") : a === 0 ? (r === 1 ? "Change rejected" : "Suggestion rejected") : `${a} applied, ${r} rejected`;
  };

  const decide = useCallback(
    (targets: CodeSuggestionHunk[], decision: CodeSuggestionDecision, all: boolean) => {
      if (!targets.length) return;
      const next: Decisions = { ...decisions };
      for (const hunk of targets) {
        next[hunk.id] = decision;
        onDecision?.(hunk, decision, codeWith(next));
      }
      setDecisions(next);
      const left = live.filter((h) => !next[h.id]);
      const verb = decision === "accepted" ? "Accepted" : "Rejected";
      const head = all ? `${verb} ${plural(targets.length)}.` : `${verb}: ${targets[0].summary ?? `change ${hunks.indexOf(targets[0]) + 1}`}.`;
      if (left.length) setMessage(`${head} ${plural(left.length)} to review`);
      else {
        setMessage(`${head} ${resultText(next, live)}.${simulated ? " Simulated, nothing was written to disk" : ""}`.replace(/\.\.$/, "."));
        onResolve?.({ code: codeWith(next), accepted: live.filter((h) => next[h.id] === "accepted").map((h) => h.id), rejected: live.filter((h) => next[h.id] === "rejected").map((h) => h.id) });
      }
      /* Focus never falls back to the page when the pressed control leaves. */
      const root = rootRef.current;
      if (root && root.contains(document.activeElement) && document.activeElement !== codeRef.current) {
        const target = left[0] ? root.querySelector<HTMLElement>(`[data-accept="${CSS.escape(left[0].id)}"]`) : codeRef.current;
        (target ?? codeRef.current)?.focus({ preventScroll: true });
      }
    },
    [decisions, onDecision, codeWith, live, hunks, simulated, onResolve],
  );

  /* Autoplay reviews on its own, alternating one by one and Accept all, then replays. */
  const auto = simulated && autoPlay && !reduced && !handsOn;
  const decideRef = useRef(decide);
  useEffect(() => {
    decideRef.current = decide;
  });
  const pendingCount = pending.length;
  useEffect(() => {
    if (!auto || !inView || sim.phase !== "ready") return;
    let timer: ReturnType<typeof setTimeout>;
    if (pendingCount === 0) timer = setTimeout(play, 2580);
    else if (sim.run % 2 === 0) timer = setTimeout(() => decideRef.current(hunks.filter((h) => !decisions[h.id]), "accepted", true), 1670);
    else {
      const next = hunks.find((h) => !decisions[h.id])!;
      const first = pendingCount === hunks.length;
      const last = pendingCount === 1 && hunks.length > 1;
      timer = setTimeout(() => decideRef.current([next], last ? "rejected" : "accepted", false), first ? 1500 : 850);
    }
    return () => clearTimeout(timer);
  }, [auto, inView, sim.phase, sim.run, pendingCount, hunks, decisions, play]);

  const takeOver = () => {
    if (simulated && !handsOn) setHandsOn(true);
  };

  const stop = () => {
    if (simulated) {
      clearTimers();
      /* Keep only the hunks it finished. */
      setSim((s) => ({ ...s, phase: "ready", shown: s.shown.map((v, i) => (v === hunks[i].insert!.length && v >= 0 ? v : -1)) }));
      const kept = sim.shown.filter((v, i) => v === hunks[i].insert!.length && v >= 0).length;
      setStopped(true);
      setMessage(kept ? `Stopped early, ${plural(kept)} to review` : "Stopped before any changes");
    }
    onStop?.();
    codeRef.current?.focus({ preventScroll: true });
  };

  const regenerate = () => {
    onRegenerate?.();
    if (simulated) {
      setHandsOn(false);
      if (reduced) {
        setDecisions({});
        setStopped(false);
        setSim((s) => ({ phase: "ready", shown: hunks.map((h) => h.insert!.length), run: s.run + 1 }));
        setMessage(`${plural(hunks.length)} to review`);
      } else play();
    }
    codeRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    takeOver();
    if (!shortcuts || !(event.metaKey || event.ctrlKey) || !pending.length) return;
    if (event.key === "Enter") {
      event.preventDefault();
      decide(pending, "accepted", true);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      decide(pending, "rejected", true);
    }
  };

  /* Review bars stay pinned to the visible width while long lines scroll. */
  useEffect(() => {
    const el = codeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => el.style.setProperty("--cs-viewport", `${el.clientWidth}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Rows. */
  const rows: ReactNode[] = [];
  let number = 0;
  let added = 0;
  let removed = 0;
  const rowMotion = (enter: boolean) => ({
    initial: enter ? { height: 0, opacity: 0 } : false,
    animate: { height: 20, opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: reduced ? instant : { height: fold, opacity: { duration: 0.2 } },
  });
  const row = (key: string, kind: "ctx" | "add" | "del", text: string, decision?: string, numbered = true) => {
    const isPending = decision === "pending";
    rows.push(
      <motion.div key={key} className={styles.row} data-kind={kind} data-decision={decision} {...rowMotion(true)} style={{ height: 20, opacity: 1 }}>
        <span className={styles.gutter} aria-hidden="true">
          <span className={styles.num}>{numbered ? ++number : ""}</span>
          <span className={styles.sign}>{kind === "add" ? "+" : kind === "del" ? "−" : ""}</span>
        </span>
        {isPending && kind !== "ctx" && <span className={styles.srOnly}>{kind === "add" ? "Added:" : "Removed:"}</span>}
        <span className={styles.text}>{highlight(text)}</span>
      </motion.div>,
    );
  };
  let at = 0;
  hunks.forEach((hunk, index) => {
    for (; at < hunk.start; at++) row(`o${at}`, "ctx", lines[at]);
    const shown = shownOf(index);
    const decision = (decisions[hunk.id] ?? "pending") as CodeSuggestionDecision | "pending";
    const remove = hunk.remove ?? 0;
    for (let k = 0; k < remove; k++, at++) {
      if (shown < 0) row(`o${at}`, "ctx", lines[at]);
      else if (decision !== "accepted") row(`o${at}`, "del", lines[at], decision, decision === "rejected");
    }
    if (shown < 0) return;
    if (decision !== "rejected") {
      removed += remove;
      added += shown;
      for (let k = 0; k < shown; k++) row(`a${hunk.id}-${k}`, "add", hunk.insert![k], decision);
    }
    if (status === "ready" && decision === "pending") {
      const name = hunk.summary ?? `change ${index + 1}`;
      rows.push(
        <motion.div
          key={`bar-${hunk.id}`}
          className={styles.barRow}
          data-hunk-bar=""
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 40, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduced ? instant : { height: openBar, opacity: { duration: 0.16 } }}
        >
          <div className={styles.bar}>
            <span className={styles.barSummary}>{hunk.summary}</span>
            <div className={styles.barActions}>
              <Button variant="ghost" size="sm" className={`${styles.hunkButton} ${styles.reject}`} aria-label={`Reject ${name}`} onClick={() => decide([hunk], "rejected", false)}>
                Reject
              </Button>
              <Button variant="primary" size="sm" className={`${styles.hunkButton} ${styles.accept}`} data-accept={hunk.id} aria-label={`Accept ${name}`} onClick={() => decide([hunk], "accepted", false)}>
                Accept
              </Button>
            </div>
          </div>
        </motion.div>,
      );
    }
  });
  for (; at < lines.length; at++) row(`o${at}`, "ctx", lines[at]);

  /* Footer: an icon, a label and actions, each swapping in place. */
  let tone: "busy" | "review" | "done" | "muted" | "error" = "busy";
  let icon: ReactNode;
  let iconKey = "busy";
  let label: string;
  let actions: "stop" | "review" | "again" | "none" = "none";
  const canRegenerate = simulated || Boolean(onRegenerate);
  if (status === "thinking" || status === "streaming") {
    label = status === "thinking" ? `Reading ${fileName}` : "Writing changes";
    icon = (
      <svg className={styles.spinner} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
        <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
    actions = simulated || onStop ? "stop" : "none";
  } else if (status === "error") {
    tone = "error";
    iconKey = "error";
    label = error;
    icon = <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />;
    actions = canRegenerate ? "again" : "none";
  } else if (pending.length) {
    tone = "review";
    iconKey = "review";
    label = `${stopped && pending.length === live.length ? "Stopped early, " : ""}${plural(pending.length)} to review`;
    icon = <CircleDot size={16} strokeWidth={1.75} aria-hidden="true" />;
    actions = "review";
  } else if (done) {
    const allRejected = accepted.length === 0;
    tone = allRejected ? "muted" : "done";
    iconKey = allRejected ? "rejected" : "done";
    label = resultText(decisions, live);
    icon = allRejected ? <X size={16} strokeWidth={1.75} aria-hidden="true" /> : <Check size={16} strokeWidth={1.75} aria-hidden="true" />;
    actions = canRegenerate ? "again" : "none";
  } else {
    tone = "muted";
    iconKey = "none";
    label = stopped ? "Stopped before any changes" : "No changes needed";
    icon = <Check size={16} strokeWidth={1.75} aria-hidden="true" />;
    actions = canRegenerate ? "again" : "none";
  }
  const out = reduced ? instant : { duration: 0.1 };
  const enter = reduced ? instant : { duration: 0.16 };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`Code suggestion: ${instruction}`}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      data-status={status}
      onKeyDown={onKeyDown}
      onPointerDown={takeOver}
      onClickCapture={takeOver}
      onFocus={(event) => {
        /* Only focus that arrives from a person hands control over. */
        if (event.target.matches(":focus-visible")) takeOver();
      }}
    >
      <header className={styles.header}>
        {model?.mark && (
          <span className={styles.modelMark} aria-hidden="true">
            {model.mark}
          </span>
        )}
        <p className={styles.instruction}>{instruction}</p>
        {model && <p className={styles.model}>{model.name}</p>}
      </header>
      <div className={styles.editor}>
        <div className={styles.tabs}>
          <span className={styles.tab}>
            {mark && (
              <span className={styles.fileMark} aria-hidden="true">
                {mark}
              </span>
            )}
            <span className={styles.fileName}>{fileName}</span>
            {path && <span className={styles.filePath}>{path}</span>}
          </span>
          <span className={styles.stats}>
            <span className={styles.srOnly}>
              {added} lines added, {removed} removed
            </span>
            <span className={styles.statAdd} data-zero={added === 0 ? "true" : undefined} aria-hidden="true">
              +{added}
            </span>
            <span className={styles.statDel} data-zero={removed === 0 ? "true" : undefined} aria-hidden="true">
              −{removed}
            </span>
          </span>
        </div>
        <div
          ref={codeRef}
          className={styles.code}
          tabIndex={0}
          role="region"
          aria-label={`Suggested changes to ${fileName}`}
          style={maxCodeHeight ? { maxHeight: maxCodeHeight, overflowY: "auto" } : undefined}
        >
          <div className={styles.lines}>
            <AnimatePresence initial={false}>{rows}</AnimatePresence>
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <div className={styles.status} aria-hidden="true">
          <span className={styles.statusIcon}>
            <AnimatePresence initial={false}>
              <motion.span key={iconKey} data-tone={tone} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter }} exit={{ opacity: 0, transition: out }}>
                {icon}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className={styles.statusLabel}>
            <AnimatePresence initial={false}>
              <motion.span
                key={label}
                data-tone={tone}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, transition: enter }}
                exit={{ opacity: 0, transition: out }}
              >
                {tone === "busy" ? <TextShimmer className={styles.statusText}>{label}</TextShimmer> : <span className={styles.statusText}>{label}</span>}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <div className={styles.actionsSlot}>
          <AnimatePresence initial={false}>
            {actions !== "none" && (
              <motion.div key={actions} className={styles.actions} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter }} exit={{ opacity: 0, transition: out }}>
                {actions === "stop" && (
                  <Button variant="secondary" size="sm" className={styles.footButton} onClick={stop}>
                    <Square size={11} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    Stop
                  </Button>
                )}
                {actions === "review" && (
                  <>
                    <Button variant="secondary" size="sm" className={styles.footButton} aria-keyshortcuts={shortcuts ? "Meta+Backspace Control+Backspace" : undefined} onClick={() => decide(pending, "rejected", true)}>
                      Reject all
                    </Button>
                    <Button variant="primary" size="sm" className={`${styles.footButton} ${styles.accept}`} aria-keyshortcuts={shortcuts ? "Meta+Enter Control+Enter" : undefined} onClick={() => decide(pending, "accepted", true)}>
                      Accept all
                      {shortcuts && (
                        <span className={styles.shortcut} aria-hidden="true">
                          {apple ? "⌘↵" : "Ctrl↵"}
                        </span>
                      )}
                    </Button>
                  </>
                )}
                {actions === "again" && (
                  <Button variant="secondary" size="sm" className={styles.footButton} onClick={regenerate}>
                    <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                    {status === "error" ? "Retry" : "Regenerate"}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" role="status">
        {message}
      </p>
    </div>
  );
}

export default CodeSuggestion;
