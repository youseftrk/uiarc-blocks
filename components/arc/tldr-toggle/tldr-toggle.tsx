"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { Check, CircleAlert, CircleCheck, CircleDashed, CircleStop, RotateCcw, Square } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Slider } from "../slider/slider";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { useReducedMotion } from "../use-reduced-motion";
import { ClaudeMark, LinearMark } from "./marks";
import styles from "./tldr-toggle.module.css";

export type TldrMode = "full" | "summary" | "points";
export type TldrLength = 1 | 2 | 3 | 4 | 5;
export interface TldrParagraph { id: string; text: string }
export interface TldrArticle {
  title: string;
  paragraphs: TldrParagraph[];
  source?: { name: string; mark?: ReactNode };
  author?: { name: string; avatar?: string };
  date?: string;
  /** Worked out at 230 words a minute when left out. */
  readingTime?: string;
}
export interface TldrKeyPoint { text: string; /** Id of the paragraph the point came from. */ source: string }
export type TldrStreamEvent = { type: "text"; text: string } | { type: "point"; source: string };
export interface TldrRequest {
  mode: "summary" | "points";
  length: TldrLength;
  targetWords: number;
  pointCount: number;
  article: TldrArticle;
  signal: AbortSignal;
}
export type TldrSummarize = (request: TldrRequest) => AsyncIterable<TldrStreamEvent> | Promise<string | TldrKeyPoint[]>;
export interface TldrModel { name: string; mark?: ReactNode }
export interface TldrResult { mode: "summary" | "points"; length: TldrLength; text: string; points?: TldrKeyPoint[]; words: number }
export interface TldrToggleProps {
  article?: TldrArticle;
  summarize?: TldrSummarize;
  model?: TldrModel;
  mode?: TldrMode;
  defaultMode?: TldrMode;
  onModeChange?: (mode: TldrMode) => void;
  length?: TldrLength;
  defaultLength?: TldrLength;
  onLengthChange?: (length: TldrLength) => void;
  onComplete?: (result: TldrResult) => void;
  onJump?: (paragraphId: string) => void;
  autoPlay?: boolean;
  simulated?: boolean;
  className?: string;
}

const TARGET_WORDS = [35, 60, 85, 100, 130];
const POINT_COUNT = [3, 4, 5, 6, 7];
const SIMULATED = "Simulated, nothing was sent.";
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const tldrSampleArticle: TldrArticle = {
  title: "How we made sync 4x faster for the largest workspaces",
  source: { name: "Linear blog", mark: <LinearMark aria-hidden="true" /> },
  author: { name: "Olivia Bennett", avatar: "/media/people/olivia-bennett.jpg" },
  date: "Oct 21, 2026",
  paragraphs: [
    { id: "problem", text: "Last spring our largest customers started to feel it. Workspaces with more than 400,000 issues took up to 11 seconds to become interactive on a cold start, and every reconnect after a laptop woke from sleep replayed thousands of changes the client already had. Sync was designed for teams of fifty. It was now serving companies of five thousand." },
    { id: "cause", text: "The root cause was the bootstrap payload. On first load, the client downloaded a full snapshot of every issue, comment and project it could see, then applied changes on top. For a workspace with 400,000 issues that snapshot was 180 MB of JSON, and parsing it blocked the main thread long before anything appeared on screen." },
    { id: "partial", text: "We replaced the snapshot with partial bootstrapping. The client now loads only the teams, views and issues the first screen needs, about 2 percent of a typical large workspace, and streams the rest in the background over the same connection. Anything else is fetched the first time a view asks for it, then kept in IndexedDB for the next visit." },
    { id: "reconnect", text: "Reconnects now carry a sequence number per model instead of one global cursor. A client coming back online sends the last number it saw for each model, and the server returns only what changed since. A laptop that slept through the weekend catches up in about 300 milliseconds instead of replaying 40,000 changes." },
    { id: "results", text: "The results held across every cohort we measured. Median time to interactive for the largest workspaces fell from 11.2 to 2.6 seconds, memory on first load dropped by 58 percent, and sync-related support tickets fell by two thirds in the month after the rollout finished on October 6." },
    { id: "next", text: "Partial bootstrapping is now on for every workspace, with no setting to change. Next we are moving search indexing into a web worker, so typing in the command menu never waits on the network, and in November we are publishing the sync protocol docs for integration partners." },
  ],
};

const S = {
  lead: "Linear made sync about 4x faster for its largest workspaces by replacing the full bootstrap snapshot with partial bootstrapping.",
  old: "The old 180 MB snapshot blocked the main thread for up to 11 seconds in workspaces with 400,000 issues.",
  client: "The client now loads only what the first screen needs, about 2 percent of the workspace, and streams the rest in the background.",
  reconnect: "Reconnects use a sequence number per model, so a laptop that slept all weekend catches up in about 300 ms instead of replaying 40,000 changes.",
  median: "Median time to interactive fell from 11.2 to 2.6 seconds, and first-load memory dropped 58 percent.",
  tickets: "Sync-related support tickets fell by two thirds after the rollout finished on October 6.",
  next: "Next up: search indexing in a web worker, and public sync protocol docs for partners in November.",
};
const SAMPLE_SUMMARIES: Record<TldrLength, string> = {
  1: [S.lead, S.median].join(" "),
  2: [S.lead, S.client, S.median].join(" "),
  3: [S.lead, S.client, S.reconnect, S.median].join(" "),
  4: `${[S.lead, S.old, S.client, S.reconnect].join(" ")}\n\n${S.median}`,
  5: `${[S.lead, S.old, S.client, S.reconnect].join(" ")}\n\n${[S.median, S.tickets, S.next].join(" ")}`,
};
const SAMPLE_POINTS: TldrKeyPoint[] = [
  { source: "problem", text: "Workspaces with over 400,000 issues took up to 11 seconds to become interactive on a cold start." },
  { source: "cause", text: "The old 180 MB JSON snapshot blocked the main thread before anything rendered." },
  { source: "partial", text: "Partial bootstrapping loads about 2 percent of a workspace up front and streams the rest in the background." },
  { source: "reconnect", text: "A sequence number per model lets a client that slept all weekend catch up in about 300 ms." },
  { source: "results", text: "Median time to interactive fell from 11.2 to 2.6 seconds for the largest workspaces." },
  { source: "results", text: "First-load memory dropped 58 percent and sync support tickets fell by two thirds." },
  { source: "next", text: "Search indexing moves to a web worker next, and the sync protocol docs open to partners in November." },
];
const SAMPLE_POINT_PICKS: Record<TldrLength, number[]> = { 1: [2, 3, 4], 2: [1, 2, 3, 4], 3: [1, 2, 3, 4, 5], 4: [0, 1, 2, 3, 4, 5], 5: [0, 1, 2, 3, 4, 5, 6] };

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const done = () => { signal.removeEventListener("abort", stop); resolve(); };
    const stop = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Splits text into chunks of 3 to 8 words, each keeping its trailing space. */
function chunkText(text: string) {
  const words = text.split(/(?<= )/), chunks: string[] = [];
  for (let at = 0; at < words.length;) {
    const size = 3 + Math.floor(Math.random() * 6);
    chunks.push(words.slice(at, at + size).join(""));
    at += size;
  }
  return chunks;
}

/** Turns a finished string or key point list into paced stream events. */
export async function* streamResult(result: string | TldrKeyPoint[], signal: AbortSignal): AsyncGenerator<TldrStreamEvent> {
  const parts = typeof result === "string" ? [{ source: null, text: result }] : result;
  for (const part of parts) {
    if (part.source !== null) yield { type: "point", source: part.source };
    for (const text of chunkText(part.text)) {
      await pause(30 + Math.random() * 10, signal);
      yield { type: "text", text };
    }
  }
}

const sentences = (text: string) => text.match(/[^.!?]+[.!?]+/g)?.map(sentence => sentence.trim()) ?? [text];

/** The simulation behind the preview. Nothing is sent anywhere. */
export async function* simulateTldr(request: TldrRequest, options: { fail?: boolean; thinkMs?: number } = {}): AsyncGenerator<TldrStreamEvent> {
  const { mode, length, article, signal, targetWords, pointCount } = request;
  await pause(options.thinkMs ?? 700, signal);
  if (options.fail) throw new Error("The model did not respond in time.");
  let result: string | TldrKeyPoint[];
  if (article === tldrSampleArticle) {
    result = mode === "summary" ? SAMPLE_SUMMARIES[length] : SAMPLE_POINT_PICKS[length].map(index => SAMPLE_POINTS[index]);
  } else if (mode === "points") {
    result = article.paragraphs.slice(0, pointCount).map(paragraph => ({ source: paragraph.id, text: sentences(paragraph.text)[0] }));
  } else {
    const picked: string[] = [];
    let words = 0;
    for (const paragraph of article.paragraphs) {
      if (words >= targetWords) break;
      const lead = sentences(paragraph.text)[0];
      picked.push(lead);
      words += countWords(lead);
    }
    result = picked.join(" ");
  }
  yield* streamResult(result, signal);
}

type Status = "idle" | "thinking" | "streaming" | "done" | "stopped" | "error";
interface PointView { source: string; chunks: string[]; done: boolean }
interface Run { status: Status; chunks: string[]; points: PointView[]; error?: string; cached?: boolean }
const EMPTY: Run = { status: "idle", chunks: [], points: [] };
const isAsyncIterable = (value: unknown): value is AsyncIterable<TldrStreamEvent> => !!value && typeof (value as AsyncIterable<TldrStreamEvent>)[Symbol.asyncIterator] === "function";
const swapIn = { opacity: 1, transition: { duration: .16 } }, swapOut = { opacity: 0, transition: { duration: .1 } };

export function TldrToggle({
  article = tldrSampleArticle,
  summarize,
  model,
  mode: modeProp,
  defaultMode = "full",
  onModeChange,
  length: lengthProp,
  defaultLength = 2,
  onLengthChange,
  onComplete,
  onJump,
  autoPlay,
  simulated,
  className,
}: TldrToggleProps) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const isSimulated = simulated ?? !summarize;
  const auto = autoPlay ?? !summarize;
  const credit = useMemo<TldrModel>(() => model ?? { name: "Claude Haiku 5.5", mark: <ClaudeMark aria-hidden="true" style={{ color: "#D97757" }} /> }, [model]);

  const [modeState, setModeState] = useState<TldrMode>(defaultMode);
  const [lengthState, setLengthState] = useState<TldrLength>(defaultLength);
  const mode = modeProp ?? modeState, length = lengthProp ?? lengthState;
  const [draft, setDraft] = useState<number | null>(null);
  const [run, setRun] = useState<Run>(EMPTY);
  const [announcement, setAnnouncement] = useState("");
  const [lit, setLit] = useState<string | null>(null);

  const cache = useRef(new Map<string, Run>());
  const controller = useRef<AbortController | null>(null);
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const paragraphs = useRef(new Map<string, HTMLParagraphElement>());
  const jumpTimers = useRef<number[]>([]);
  const latest = useRef({ summarize, article, onComplete, credit, isSimulated });
  useEffect(() => { latest.current = { summarize, article, onComplete, credit, isSimulated }; });

  const readingTime = article.readingTime ?? `${Math.max(1, Math.ceil(article.paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph.text), 0) / 230))} min read`;
  const meta = [article.date, readingTime].filter(Boolean).join(" · ");
  const empty = article.paragraphs.length === 0;

  const stop = useCallback((announce: boolean) => {
    if (!controller.current) return;
    controller.current.abort();
    controller.current = null;
    setRun(current => (current.status === "thinking" || current.status === "streaming" ? { ...current, status: "stopped", points: current.points.map(point => ({ ...point, done: true })) } : current));
    if (announce) setAnnouncement("Stopped. What arrived is kept.");
  }, []);

  const start = useCallback(async (kind: "summary" | "points", size: TldrLength, fresh: boolean) => {
    controller.current?.abort();
    controller.current = null;
    const key = `${kind}:${size}`, saved = cache.current.get(key);
    if (saved && !fresh) {
      setRun({ ...saved, cached: true });
      setAnnouncement(kind === "summary" ? "Showing the saved summary." : "Showing the saved key points.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const now = latest.current, tail = now.isSimulated ? ` ${SIMULATED}` : "";
    setRun({ status: "thinking", chunks: [], points: [] });
    setAnnouncement(`${kind === "summary" ? "Summarizing" : "Finding key points"} with ${now.credit.name}.`);
    const chunks: string[] = [];
    let points: PointView[] = [];
    const publish = (status: Status) => setRun({ status, chunks: [...chunks], points: points.map(point => ({ ...point, chunks: [...point.chunks] })) });
    try {
      const request: TldrRequest = { mode: kind, length: size, targetWords: TARGET_WORDS[size - 1], pointCount: POINT_COUNT[size - 1], article: now.article, signal: abort.signal };
      const produced = now.summarize ? now.summarize(request) : simulateTldr(request);
      const events = isAsyncIterable(produced) ? produced : streamResult(await produced, abort.signal);
      for await (const event of events) {
        if (abort.signal.aborted) return;
        if (event.type === "point") {
          points = [...points.map(point => ({ ...point, done: true })), { source: event.source, chunks: [], done: false }];
        } else if (kind === "points") {
          if (!points.length) points = [{ source: "", chunks: [], done: false }];
          points[points.length - 1].chunks.push(event.text);
        } else chunks.push(event.text);
        publish("streaming");
      }
      if (abort.signal.aborted) return;
      points = points.map(point => ({ ...point, done: true }));
      const finished: Run = { status: "done", chunks: [...chunks], points };
      cache.current.set(key, finished);
      controller.current = null;
      setRun(finished);
      const text = kind === "summary" ? chunks.join("").trim() : points.map(point => point.chunks.join("").trim()).join("\n");
      const words = countWords(text);
      setAnnouncement(kind === "summary" ? `Summary ready, ${words} words.${tail}` : `${points.length} key points ready.${tail}`);
      now.onComplete?.({ mode: kind, length: size, text, words, points: kind === "points" ? points.map(point => ({ source: point.source, text: point.chunks.join("").trim() })) : undefined });
    } catch (error) {
      if (abort.signal.aborted) return;
      controller.current = null;
      const message = `${error instanceof Error && error.message ? error.message : "Something went wrong."}${tail}`;
      setRun({ status: "error", chunks: [...chunks], points: points.map(point => ({ ...point, done: true })), error: message });
      setAnnouncement(`Couldn’t summarize. ${message}`);
    }
  }, []);

  useEffect(() => () => { controller.current?.abort(); jumpTimers.current.forEach(clearTimeout); }, []);

  // One request per mode or length change; Full only stops what is running.
  const requested = useRef("");
  useEffect(() => {
    const key = `${mode}:${length}`;
    if (requested.current === key) return;
    requested.current = key;
    queueMicrotask(() => { if (mode === "full" || empty) stop(false); else void start(mode, length, false); });
  }, [mode, length, empty, start, stop]);

  const changeMode = useCallback((next: TldrMode) => {
    if (modeProp === undefined) setModeState(next);
    onModeChange?.(next);
  }, [modeProp, onModeChange]);

  const commitLength = (next: number) => {
    const value = Math.min(5, Math.max(1, Math.round(next))) as TldrLength;
    touched.current = true;
    setDraft(null);
    if (value === length) return;
    if (lengthProp === undefined) setLengthState(value);
    onLengthChange?.(value);
  };

  // Opens the summary once the card has been half in view for a second.
  useEffect(() => {
    const node = rootRef.current;
    if (!auto || !node || mode !== "full" || empty || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (entry.isIntersecting && !touched.current) timer = window.setTimeout(() => { if (!touched.current) { touched.current = true; changeMode("summary"); } }, 1000);
    }, { threshold: .5 });
    observer.observe(node);
    return () => { clearTimeout(timer); observer.disconnect(); };
    // Runs for the first Full view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, empty]);

  // The body's height follows its content on one critically damped spring; a width change cuts to the new height.
  const height = useMotionValue<number | string>("auto");
  const measured = useRef({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let playing: ReturnType<typeof animate> | undefined;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight, width = node.offsetWidth, last = measured.current;
      if (next === last.height && width === last.width) return;
      const from = typeof height.get() === "number" ? (height.get() as number) : last.height;
      const jump = reduced || !last.height || width !== last.width;
      measured.current = { width, height: next };
      playing?.stop();
      if (jump) { height.set("auto"); return; }
      height.set(from);
      playing = animate(height as never, next, { type: "spring", visualDuration: .26, bounce: 0, onComplete: () => height.set("auto") });
    });
    observer.observe(node);
    return () => { playing?.stop(); observer.disconnect(); };
  }, [height, reduced]);

  const jump = (id: string) => {
    touched.current = true;
    onJump?.(id);
    changeMode("full");
    jumpTimers.current.forEach(clearTimeout);
    const index = article.paragraphs.findIndex(paragraph => paragraph.id === id);
    jumpTimers.current = [
      window.setTimeout(() => {
        const node = paragraphs.current.get(id);
        if (!node) return;
        node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
        node.focus({ preventScroll: true });
        setLit(id);
        setAnnouncement(`Showing paragraph ${index + 1} in the article.`);
      }, reduced ? 60 : 420),
      window.setTimeout(() => setLit(null), 2400),
    ];
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && controller.current) { event.stopPropagation(); stop(true); }
  };

  const busy = run.status === "thinking" || run.status === "streaming";
  const kind = mode === "points" ? "points" : "summary";
  const shown = draft ?? length;
  const text = kind === "summary" ? run.chunks.join("").trim() : run.points.map(point => point.chunks.join("").trim()).join("\n");
  const words = countWords(text);
  const format = (value: number) => (mode === "points" ? `${POINT_COUNT[value - 1]} points` : `~${TARGET_WORDS[value - 1]} words`);

  // Summary chunks grouped into paragraphs wherever a blank line arrives.
  const prose = useMemo(() => {
    const groups: { key: number; text: string }[][] = [[]];
    run.chunks.forEach((chunk, key) => {
      const pieces = chunk.split(/\n\n+/);
      pieces.forEach((piece, at) => {
        if (at > 0) groups.push([]);
        if (piece) groups[groups.length - 1].push({ key: key * 10 + at, text: piece });
      });
    });
    return groups.filter(group => group.length);
  }, [run.chunks]);

  const fade = run.cached ? undefined : styles.chunk;
  const state = run.status === "thinking" ? <>Thinking</>
    : run.status === "streaming" ? <TextShimmer>Writing</TextShimmer>
    : run.status === "stopped" ? <><CircleStop size={14} aria-hidden="true" />Stopped</>
    : run.status === "error" ? <><CircleAlert size={14} aria-hidden="true" />Failed</>
    : <><Check size={14} className={styles.ok} aria-hidden="true" />{kind === "summary" ? `${words} words` : `${run.points.length} points`}</>;
  const actionKind = busy ? "running" : run.status === "error" ? "error" : "result";

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <article className={styles.card} aria-labelledby={titleId} aria-busy={busy || undefined} onKeyDown={onKeyDown} onPointerDownCapture={() => { touched.current = true; }}>
        <header className={styles.head}>
          {article.source && <div className={styles.source}>{article.source.mark && <span className={styles.sourceMark}>{article.source.mark}</span>}<span className={styles.truncate}>{article.source.name}</span></div>}
          <h3 id={titleId} className={styles.title}>{article.title}</h3>
          {(article.author || meta) && (
            <div className={styles.byline}>
              {article.author && <><Avatar name={article.author.name} src={article.author.avatar} size="sm" className={styles.avatar} /><span className={styles.author}>{article.author.name}</span>{meta && <span aria-hidden="true">·</span>}</>}
              {meta && <span className={styles.truncate}>{meta}</span>}
            </div>
          )}
        </header>
        <div className={styles.controls}>
          <SegmentedControl label="Reading mode" value={mode} onValueChange={value => { touched.current = true; changeMode(value as TldrMode); }}
            options={[{ value: "full", label: "Full" }, { value: "summary", label: "Summary" }, { value: "points", label: "Key points" }]} />
          <div className={styles.length}>
            <Slider label="Length" min={1} max={5} step={1} largeStep={1} marks={[1, 2, 3, 4, 5]} value={shown} format={format} disabled={mode === "full" || empty}
              onValueChange={value => setDraft(value)} onValueCommit={commitLength} />
          </div>
        </div>
        <motion.div className={styles.clip} style={{ height }}>
          <div ref={bodyRef} className={styles.body}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode === "full" ? "full" : kind} initial={{ opacity: 0 }} animate={swapIn} exit={swapOut}>
                {mode === "full" ? (
                  empty ? <p className={styles.empty}>Nothing to read yet.</p> : (
                    <div className={styles.article}>
                      {article.paragraphs.map(paragraph => (
                        <p key={paragraph.id} ref={node => { if (node) paragraphs.current.set(paragraph.id, node); else paragraphs.current.delete(paragraph.id); }}
                          className={styles.para} tabIndex={-1} data-lit={lit === paragraph.id || undefined}>{paragraph.text}</p>
                      ))}
                    </div>
                  )
                ) : (
                  <div className={styles.gen}>
                    {run.status === "thinking" && <span className={styles.thinking}><TextShimmer>{kind === "summary" ? `Reading ${article.paragraphs.length} paragraphs` : "Finding key points"}</TextShimmer></span>}
                    {kind === "summary" ? (
                      <div className={styles.summary}>{prose.map((group, index) => <p key={index}>{group.map(piece => <span key={piece.key} className={fade}>{piece.text}</span>)}</p>)}</div>
                    ) : run.points.length > 0 && (
                      <ul className={styles.points}>
                        {run.points.map((point, index) => {
                          const number = article.paragraphs.findIndex(paragraph => paragraph.id === point.source) + 1;
                          const label = point.chunks.join("").trim();
                          return (
                            <li key={index} className={cx(styles.point, !run.cached && styles.enter)}>
                              <span className={styles.pointIcon} data-done={point.done || undefined} aria-hidden="true"><CircleDashed size={16} className={styles.pending} /><CircleCheck size={16} className={styles.check} /></span>
                              <span className={styles.pointText}>{point.chunks.map((chunk, at) => <span key={at} className={fade}>{chunk}</span>)}</span>
                              {number > 0 && (busy
                                ? <span className={styles.jumpSlot} aria-hidden="true">¶{number}</span>
                                : <Tooltip content="Show in article"><button type="button" className={cx(styles.jump, fade)} aria-label={`Jump to paragraph ${number}: ${label}`} onClick={() => jump(point.source)}>¶{number}</button></Tooltip>)}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {run.status === "error" && (
                      <div className={styles.error} role="alert">
                        <CircleAlert size={16} aria-hidden="true" />
                        <div className={styles.errorCopy}><p className={styles.errorTitle}>Couldn’t summarize this article</p><p className={styles.errorText}>{run.error}</p></div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {mode !== "full" && run.status !== "idle" && (
                <motion.div key="foot" className={styles.foot} initial={{ opacity: 0 }} animate={swapIn} exit={swapOut}>
                  <div className={styles.status}>
                    {credit.mark && <span className={styles.modelMark}>{credit.mark}</span>}
                    <span className={styles.modelName}>{credit.name}</span>
                    <span className={styles.dot} aria-hidden="true">·</span>
                    <span className={styles.stateSlot}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={run.status} className={styles.state} data-status={run.status} initial={{ opacity: 0 }} animate={swapIn} exit={swapOut}>{state}</motion.span>
                      </AnimatePresence>
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={actionKind} className={styles.actionSet} data-kind={actionKind} initial={{ opacity: 0 }} animate={swapIn} exit={swapOut}>
                        {actionKind === "running" && <Button variant="ghost" size="sm" className={styles.action} onClick={() => stop(true)}><Square size={10} fill="currentColor" aria-hidden="true" />Stop</Button>}
                        {actionKind === "error" && <Button variant="primary" size="sm" className={styles.action} onClick={() => void start(kind, length, true)}><RotateCcw size={14} aria-hidden="true" />Try again</Button>}
                        {actionKind === "result" && <>
                          <CopyButton value={text} label={kind === "summary" ? "Copy summary" : "Copy key points"} iconOnly variant="plain" className={styles.iconAction} />
                          <Tooltip content="Regenerate"><Button variant="ghost" size="sm" className={cx(styles.action, styles.iconAction)} aria-label="Regenerate" onClick={() => void start(kind, length, true)}><RotateCcw size={16} aria-hidden="true" /></Button></Tooltip>
                        </>}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </article>
      <div className={styles.srOnly} role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}

export default TldrToggle;
