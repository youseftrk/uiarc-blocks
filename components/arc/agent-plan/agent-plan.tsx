"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import { FilePen, FilePlus, FileText, Gauge, GripVertical, Pause, Play, Plus, RotateCcw, Search, SkipForward, SquareTerminal, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-plan.module.css";

export type AgentPlanStepState = "pending" | "active" | "done" | "failed" | "skipped";
export type AgentPlanStatus = "draft" | "running" | "paused" | "done";

export interface AgentPlanStep {
  id: string;
  title: string;
  state?: AgentPlanStepState;
  /** Short activity lines; the first word picks the icon. */
  substeps?: string[];
  note?: string;
  error?: string;
  /** Seconds, for a done step. */
  duration?: number;
}

export interface AgentPlanModel {
  name: string;
  mark?: ReactNode;
}

export interface AgentPlanStepAction {
  type: "retry" | "skip";
  step: AgentPlanStep;
}

export interface AgentPlanProps {
  steps?: AgentPlanStep[];
  status?: AgentPlanStatus;
  goal?: string;
  model?: AgentPlanModel;
  summary?: string;
  onApprove?: (steps: AgentPlanStep[]) => void;
  onChange?: (steps: AgentPlanStep[]) => void;
  onStepAction?: (action: AgentPlanStepAction) => void;
  onKeepPlanning?: () => void;
  onPauseChange?: (paused: boolean) => void;
  className?: string;
}

const CLAUDE_PATH = "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

export function ClaudeBrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" style={{ color: "#D97757" }}>
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

export const sampleSteps: AgentPlanStep[] = [
  { id: "routes", title: "Map the public routes under api/v1" },
  { id: "limiter", title: "Add a sliding window limiter to the API middleware" },
  { id: "store", title: "Keep request counters in Redis with a 60 second TTL" },
  { id: "headers", title: "Return 429 with Retry-After and RateLimit headers" },
  { id: "tests", title: "Write tests for limits, bursts and window resets" },
  { id: "docs", title: "Document the limits in the API reference" },
];

const DEFAULT_MODEL: AgentPlanModel = { name: "Claude Opus 5.5", mark: <ClaudeBrandMark /> };
const SAMPLE_SUMMARY = "Rate limiting is on for all 23 public routes, with an in-memory fallback and 12 passing tests.";
const SUGGESTIONS = [
  "Allow higher limits for enterprise API keys",
  "Emit a metric for every blocked request",
  "Load test the limiter at 2,000 requests per second",
];

interface Script {
  subs: string[];
  duration: number;
  insert?: { afterSub: number; step: AgentPlanStep };
  fail?: { error: string; subs: string[]; duration: number };
}
const SCRIPTS: Record<string, Script> = {
  routes: { subs: ["Read 4 files", "Searched for router.get and router.post", "Found 23 public routes"], duration: 21 },
  limiter: { subs: ["Read middleware/index.ts", "Created middleware/rate-limit.ts", "Edited 2 files"], duration: 48 },
  store: {
    subs: ["Read lib/redis.ts", "Edited middleware/rate-limit.ts", "Ran 6 tests"], duration: 37,
    insert: { afterSub: 2, step: { id: "fallback", title: "Fall back to in-memory counters when Redis is down", note: "Added by agent" } },
  },
  fallback: { subs: ["Edited lib/redis.ts", "Ran 8 tests"], duration: 29 },
  headers: { subs: ["Edited middleware/rate-limit.ts", "Ran 4 tests"], duration: 24 },
  tests: {
    subs: ["Created rate-limit.test.ts", "Ran 12 tests"], duration: 63,
    fail: { error: "2 of 12 tests failed: the window resets one second late", subs: ["Edited middleware/rate-limit.ts", "Ran 12 tests, all passed"], duration: 63 },
  },
  docs: { subs: ["Read docs/api/overview.md", "Edited docs/api/rate-limits.md"], duration: 19 },
};
const GENERIC: Script = { subs: ["Read 3 files", "Edited 2 files"], duration: 26 };

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const SPRING = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;
const STATE_WORDS: Record<AgentPlanStepState, string> = { pending: "Pending", active: "In progress", done: "Done", failed: "Failed", skipped: "Skipped" };

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function subIcon(text: string) {
  const verb = text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (verb === "read") return FileText;
  if (verb === "edited" || verb === "updated" || verb === "wrote") return FilePen;
  if (verb === "created" || verb === "added") return FilePlus;
  if (verb === "searched" || verb === "found") return Search;
  if (verb === "measured") return Gauge;
  return SquareTerminal;
}

function chunkWords(text: string) {
  const words = text.split(" ");
  const chunks: string[] = [];
  let i = 0, n = 0;
  while (i < words.length) {
    const size = [4, 3, 5, 4, 2][n++ % 5];
    const last = i + size >= words.length;
    chunks.push(words.slice(i, i + size).join(" ") + (last ? "" : " "));
    i += size;
  }
  return chunks;
}

/** Reveals chunks of a few words every 34ms. */
function useStream(text: string | undefined, active: boolean, reduced: boolean, onDone?: () => void) {
  const chunks = useMemo(() => (text ? chunkWords(text) : []), [text]);
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (!active || !chunks.length) return;
    let n = reduced ? chunks.length : 0;
    const start = window.setTimeout(() => setShown(n), 0);
    const id = window.setInterval(() => {
      n += 1;
      setShown(Math.min(n, chunks.length));
      if (n >= chunks.length) { window.clearInterval(id); done.current?.(); }
    }, reduced ? 0 : 34 * 3);
    return () => { window.clearTimeout(start); window.clearInterval(id); };
  }, [active, chunks, reduced]);
  return active ? chunks.slice(0, shown) : chunks;
}

function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  return (
    <span className={styles.roll} style={{ width: `${String(value).length}ch` }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value} className={styles.rollValue}
          initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }}
          transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Glyph({ state, paused, reduced }: { state: AgentPlanStepState; paused: boolean; reduced: boolean }) {
  const kind = state === "active" && paused ? "paused" : state;
  const fade = { duration: reduced ? 0 : motionTokens.duration.fast };
  const drawn = (d: string, delay = 0) => (
    <motion.path d={d} className={styles.ink} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.22, ease: EASE, delay }} />
  );
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={kind} className={styles.glyph} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
        {kind === "pending" && <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" className={styles.ring} /></svg>}
        {kind === "active" && (
          <svg viewBox="0 0 16 16" className={styles.spin} aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" className={styles.track} /><path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" className={styles.arc} />
          </svg>
        )}
        {kind === "paused" && (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" className={styles.pausedRing} /><path d="M6.6 5.9v4.2M9.4 5.9v4.2" className={styles.pausedBars} />
          </svg>
        )}
        {kind === "done" && <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" className={styles.doneDisc} />{drawn("M5 8.25 7.1 10.3 11 6")}</svg>}
        {kind === "failed" && (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" className={styles.failDisc} />{drawn("M8 4.9v3.6")}<circle cx="8" cy="11.1" r=".95" className={styles.inkDot} />
          </svg>
        )}
        {kind === "skipped" && <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" className={styles.skipRing} /><path d="M5.5 8h5" className={styles.skipDash} /></svg>}
      </motion.span>
    </AnimatePresence>
  );
}

interface RowProps {
  step: AgentPlanStep;
  index: number;
  count: number;
  draft: boolean;
  paused: boolean;
  fresh: boolean;
  streaming: boolean;
  reduced: boolean;
  hintId: string;
  model: AgentPlanModel;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, by: number, focus: "grip" | "field") => void;
  onRemove: (id: string, focus: "prev" | "next") => void;
  onStreamed: (id: string) => void;
  onAction: (type: "retry" | "skip", step: AgentPlanStep) => void;
  onDragEnd: () => void;
}

function Row({ step, index, count, draft, paused, fresh, streaming, reduced, hintId, model, onRename, onMove, onRemove, onStreamed, onAction, onDragEnd }: RowProps) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const [value, setValue] = useState(step.title);
  const [synced, setSynced] = useState(step.title);
  if (synced !== step.title) { setSynced(step.title); setValue(step.title); }
  const before = useRef(step.title);
  const state = step.state ?? "pending";
  const chunks = useStream(step.title, streaming, reduced, () => onStreamed(step.id));
  const collapse = reduced ? { duration: 0 } : SPRING;
  const subs = step.substeps ?? [];
  const showSubs = !draft && subs.length > 0 && (state === "active" || state === "failed");
  const swap = { initial: reduced ? { opacity: 0 } : { opacity: 0, y: 3 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: reduced ? 0 : motionTokens.duration.fast } };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onMove(step.id, event.key === "ArrowUp" ? -1 : 1, "field");
    } else if (event.key === "Enter") {
      event.preventDefault();
      before.current = value;
      onRename(step.id, value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setValue(before.current);
      onRename(step.id, before.current);
    } else if (event.key === "Backspace" && value === "") {
      event.preventDefault();
      onRemove(step.id, "prev");
    }
  };

  return (
    <Reorder.Item
      as="li" value={step.id} className={styles.row} data-state={state} data-step={step.id} data-fresh={fresh ? "true" : undefined} data-dragging={dragging ? "" : undefined}
      dragListener={false} dragControls={controls} layout={reduced ? undefined : "position"}
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={collapse}
      onDragStart={() => setDragging(true)} onDragEnd={() => { setDragging(false); onDragEnd(); }}
    >
      <div className={styles.rowInner}>
        <span className={styles.lead}>
          <AnimatePresence initial={false} mode="popLayout">
            {draft && !streaming ? (
              <motion.button
                key="grip" type="button" className={styles.grip} aria-label={`Move step ${index + 1}: ${step.title}`} aria-describedby={hintId} {...swap}
                onPointerDown={event => { event.preventDefault(); (event.currentTarget as HTMLElement).focus(); controls.start(event); }}
                onKeyDown={event => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onMove(step.id, event.key === "ArrowUp" ? -1 : 1, "grip"); }
                }}
              >
                <GripVertical size={16} strokeWidth={1.75} aria-hidden />
              </motion.button>
            ) : (
              <motion.span key="glyph" style={{ display: "grid" }} {...swap}><Glyph state={state} paused={paused} reduced={reduced} /></motion.span>
            )}
          </AnimatePresence>
        </span>
        <div className={styles.body}>
          {!draft && <span className={styles.srOnly}>{STATE_WORDS[state]}: </span>}
          {draft && !streaming ? (
            <div className={styles.title} data-value={value}>
              <textarea
                className={styles.field} rows={1} placeholder="Describe the step" aria-label={`Step ${index + 1}`} aria-describedby={hintId} spellCheck={false}
                value={value} onChange={event => setValue(event.target.value.replace(/\n/g, " "))} onKeyDown={onKeyDown}
                onFocus={() => { before.current = value; }} onBlur={() => { if (value !== step.title) onRename(step.id, value); }}
              />
            </div>
          ) : streaming ? (
            <div className={styles.title}>
              <span className={styles.titleText}>{chunks.map((chunk, i) => <span key={i} className={styles.chunk}>{chunk}</span>)}</span>
            </div>
          ) : (
            <div className={styles.title}>
              <TextShimmer className={styles.titleText} active={state === "active" && !paused}>{step.title}</TextShimmer>
            </div>
          )}
          {!draft && state === "skipped" && <p className={styles.note}>Skipped</p>}
          {step.note && !draft && (
            <p className={styles.note}><span className={styles.noteMark} aria-hidden="true">{model.mark}</span>{step.note}</p>
          )}
          <AnimatePresence initial={false}>
            {showSubs && (
              <motion.div key="subs" className={styles.collapse} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={collapse}>
                <ul className={styles.subs} aria-label="Activity">
                  {subs.map((sub, i) => {
                    const Icon = subIcon(sub);
                    return (
                      <motion.li key={i} className={styles.sub} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={collapse}>
                        <span className={styles.subInner}><Icon size={12} strokeWidth={1.75} aria-hidden /><SubText text={sub} reduced={reduced} /></span>
                      </motion.li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
            {!draft && state === "failed" && (
              <motion.div key="fail" className={styles.collapse} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={collapse}>
                <div className={styles.fail}>
                  <p className={styles.failText}><span className={styles.failLabel}>Failed</span>{step.error ? ` ${step.error}` : ""}</p>
                  <div className={styles.failActions}>
                    <button type="button" className={styles.mini} data-tone="accent" onClick={() => onAction("retry", step)}><RotateCcw size={14} strokeWidth={1.75} aria-hidden />Retry</button>
                    <button type="button" className={styles.mini} onClick={() => onAction("skip", step)}><SkipForward size={14} strokeWidth={1.75} aria-hidden />Skip</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className={styles.trail}>
          <AnimatePresence initial={false} mode="popLayout">
            {draft && !streaming ? (
              <motion.span key="remove" className={styles.trailItem} {...swap}>
                <button type="button" className={styles.remove} aria-label={`Remove step ${index + 1}: ${step.title}`} onClick={() => onRemove(step.id, index === count - 1 ? "prev" : "next")}>
                  <X size={14} strokeWidth={1.75} aria-hidden />
                </button>
              </motion.span>
            ) : state === "done" && step.duration != null ? (
              <motion.span key="time" className={styles.trailItem} {...swap}>{formatDuration(step.duration)}</motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
    </Reorder.Item>
  );
}

function SubText({ text, reduced }: { text: string; reduced: boolean }) {
  const [live, setLive] = useState(true);
  const chunks = useStream(text, live, reduced, () => setLive(false));
  return <span className={styles.subText}>{live ? chunks.map((chunk, i) => <span key={i} className={styles.chunk}>{chunk}</span>) : text}</span>;
}

function Summary({ total, text, reduced }: { total: string; text?: string; reduced: boolean }) {
  const chunks = useStream(text, true, reduced);
  return (
    <p className={styles.summary}>
      <strong>Done in {total}.</strong>{text ? " " : ""}{chunks.map((chunk, i) => <span key={i} className={styles.chunk}>{chunk}</span>)}
    </p>
  );
}

let uid = 0;

export function AgentPlan({
  steps: stepsProp, status: statusProp, goal = "Add rate limiting to the public API", model = DEFAULT_MODEL, summary: summaryProp,
  onApprove, onChange, onStepAction, onKeepPlanning, onPauseChange, className,
}: AgentPlanProps) {
  const reduced = !!useReducedMotion();
  const simulated = statusProp === undefined;
  const hintId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const source = stepsProp ?? sampleSteps;
  const [steps, setSteps] = useState<AgentPlanStep[]>(source);
  const [seen, setSeen] = useState(source);
  if (seen !== source) { setSeen(source); setSteps(source); }
  const [simStatus, setSimStatus] = useState<AgentPlanStatus>("draft");
  const status = statusProp ?? simStatus;
  const draft = status === "draft";
  const paused = status === "paused";
  const [announce, setAnnounce] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [suggested, setSuggested] = useState(0);
  /** Position in the active step's script. */
  const tick = useRef(0);
  const retried = useRef<Set<string>>(new Set());
  const inserted = useRef(false);
  const stepsRef = useRef(steps);
  useEffect(() => { stepsRef.current = steps; });

  const commit = useCallback((next: AgentPlanStep[], notify = true) => {
    setSteps(next);
    if (notify) onChange?.(next);
  }, [onChange]);

  const focusLater = useCallback((selector: string) => {
    window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>(selector)?.focus(), 0);
  }, []);

  /* Draft edits. */
  const rename = useCallback((id: string, title: string) => {
    const current = stepsRef.current;
    if (current.find(step => step.id === id)?.title === title) return;
    commit(current.map(step => (step.id === id ? { ...step, title } : step)));
  }, [commit]);
  const move = useCallback((id: string, by: number, focus: "grip" | "field") => {
    const current = stepsRef.current;
    const from = current.findIndex(step => step.id === id), to = from + by;
    if (from < 0 || to < 0 || to >= current.length) return;
    const next = [...current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next);
    setAnnounce(`Moved step to position ${to + 1} of ${next.length}`);
    focusLater(`[data-step="${id}"] ${focus === "grip" ? "button" : "textarea"}`);
  }, [commit, focusLater]);
  const remove = useCallback((id: string, focus: "prev" | "next") => {
    const current = stepsRef.current;
    const at = current.findIndex(step => step.id === id);
    if (at < 0) return;
    const neighbour = focus === "prev" ? current[at - 1] ?? current[at + 1] : current[at + 1] ?? current[at - 1];
    commit(current.filter(step => step.id !== id));
    setAnnounce(`Removed step ${at + 1}`);
    focusLater(neighbour ? `[data-step="${neighbour.id}"] textarea` : `.${styles.add}`);
  }, [commit, focusLater]);
  const addStep = () => {
    const id = `step-${++uid}`;
    commit([...steps, { id, title: "" }]);
    setAnnounce("Added a step");
    focusLater(`[data-step="${id}"] textarea`);
  };
  const keepPlanning = () => {
    onKeepPlanning?.();
    if (!simulated || suggested >= SUGGESTIONS.length || streamingId) return;
    const id = `suggested-${suggested + 1}`;
    const next = [...steps];
    next.splice(Math.max(0, next.length - 1), 0, { id, title: SUGGESTIONS[suggested] });
    setSuggested(suggested + 1);
    setStreamingId(id);
    setSteps(next);
  };
  const onStreamed = useCallback((id: string) => {
    setStreamingId(current => (current === id ? null : current));
    onChange?.(stepsRef.current);
    setAnnounce("Suggested one more step. Edit, move or remove it before approving.");
  }, [onChange]);

  const approve = () => {
    const final = steps.map(step => ({ ...step, title: step.title.trim() })).filter(step => step.title);
    onApprove?.(final);
    if (simulated) {
      setSteps(final.map(step => ({ id: step.id, title: step.title, note: step.note, state: "pending" })));
      tick.current = 0; retried.current = new Set(); inserted.current = false;
      setSimStatus("running");
      setAnnounce(`Plan approved. Running ${final.length} step${final.length === 1 ? "" : "s"} as a simulation.`);
    }
    focusLater(`.${styles.pauseSlot} button`);
  };
  const togglePause = () => {
    onPauseChange?.(!paused);
    if (simulated) { setSimStatus(paused ? "running" : "paused"); setAnnounce(paused ? "Resumed" : "Paused"); }
  };
  const stepAction = useCallback((type: "retry" | "skip", step: AgentPlanStep) => {
    onStepAction?.({ type, step });
    if (simulated) {
      if (type === "retry") {
        retried.current.add(step.id);
        tick.current = 0;
        setSteps(current => current.map(s => (s.id === step.id ? { ...s, state: "active", error: undefined } : s)));
        setAnnounce(`Retrying ${step.title}`);
      } else {
        setSteps(current => current.map(s => (s.id === step.id ? { ...s, state: "skipped", error: undefined } : s)));
        setAnnounce(`Skipped ${step.title}`);
      }
    }
    focusLater(`.${styles.pauseSlot} button`);
  }, [onStepAction, simulated, focusLater]);
  const startOver = () => {
    setSteps(source.map(step => ({ id: step.id, title: step.title })));
    setSuggested(0); setFresh([]);
    setSimStatus("draft");
    setAnnounce("Plan reset to a draft.");
  };

  /* Simulation: exactly one timer per state change. */
  useEffect(() => {
    if (!simulated || simStatus !== "running") return;
    const active = steps.find(step => step.state === "active");
    if (steps.some(step => step.state === "failed")) return;
    let delay: number, run: () => void;
    if (!active) {
      const next = steps.find(step => (step.state ?? "pending") === "pending");
      if (!next) {
        delay = 450;
        run = () => {
          const total = formatDuration(steps.reduce((sum, step) => sum + (step.state === "done" ? step.duration ?? 0 : 0), 0));
          setSimStatus("done");
          setAnnounce(`Plan done in ${total}. ${summaryProp ?? SAMPLE_SUMMARY}`);
        };
      } else {
        delay = steps.some(step => step.state && step.state !== "pending") ? 265 : 0;
        run = () => { tick.current = 0; setSteps(current => current.map(step => (step.id === next.id ? { ...step, state: "active", substeps: [] } : step))); };
      }
    } else {
      const script = SCRIPTS[active.id] ?? GENERIC;
      const retry = retried.current.has(active.id);
      const subs = retry && script.fail ? script.fail.subs : script.subs;
      const n = tick.current;
      const insertDue = !retry && script.insert && !inserted.current && n === script.insert.afterSub;
      if (insertDue && script.insert) {
        const extra = script.insert.step;
        delay = 430;
        run = () => {
          inserted.current = true;
          setFresh(current => [...current, extra.id]);
          setSteps(current => {
            if (current.some(step => step.id === extra.id)) return current;
            const at = current.findIndex(step => step.id === active.id);
            const next = [...current];
            next.splice(at + 1, 0, { ...extra, state: "pending" });
            return next;
          });
          setAnnounce(`The agent added a step: ${extra.title}`);
        };
      } else if (n < subs.length) {
        delay = n === 0 ? 365 : script.insert && inserted.current && n === script.insert.afterSub && !retry ? 115 : 545;
        run = () => {
          tick.current = n + 1;
          setSteps(current => current.map(step => (step.id === active.id ? { ...step, substeps: [...(step.substeps ?? []), subs[n]] } : step)));
        };
      } else if (script.fail && !retry) {
        const failure = script.fail;
        delay = 525;
        run = () => {
          const at = steps.findIndex(step => step.id === active.id) + 1;
          setSteps(current => current.map(step => (step.id === active.id ? { ...step, state: "failed", error: failure.error } : step)));
          setAnnounce(`Step ${at} failed: ${failure.error}. Retry or skip it.`);
        };
      } else {
        delay = 485;
        run = () => {
          setSteps(current => current.map(step => (step.id === active.id ? { ...step, state: "done", duration: retry && script.fail ? script.fail.duration : script.duration } : step)));
          setAnnounce(`Done: ${active.title}`);
        };
      }
    }
    const id = window.setTimeout(run, reduced ? Math.min(delay, 200) : delay);
    return () => window.clearTimeout(id);
  }, [simulated, simStatus, steps, reduced, summaryProp]);

  /* Derived. */
  const total = steps.length;
  const finished = steps.filter(step => step.state === "done" || step.state === "skipped").length;
  const activeIndex = steps.findIndex(step => step.state === "active");
  const failedIndex = steps.findIndex(step => step.state === "failed");
  const totalTime = formatDuration(steps.reduce((sum, step) => sum + (step.state === "done" ? step.duration ?? 0 : 0), 0));
  const summary = summaryProp ?? (simulated ? SAMPLE_SUMMARY : undefined);
  const phase = draft ? "draft" : status === "done" ? "done" : "run";
  const footStatus = failedIndex >= 0 ? `Step ${failedIndex + 1} failed`
    : paused ? `Paused on step ${Math.max(1, (activeIndex >= 0 ? activeIndex : finished) + 1)}`
    : `Working on step ${Math.min(total, (activeIndex >= 0 ? activeIndex : finished) + 1)}`;
  const fade = { duration: reduced ? 0 : motionTokens.duration.fast };
  const swap = { initial: reduced ? { opacity: 0 } : { opacity: 0, y: 3 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: fade };

  /* Footer height follows its content on the same spring. */
  const footRef = useRef<HTMLDivElement>(null);
  const [footH, setFootH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = footRef.current;
    if (!node) return;
    const read = () => setFootH(node.offsetHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-label={`${model.name} plan: ${goal}`} data-status={status}>
      <header className={styles.header}>
        <div className={styles.headRow}>
          {model.mark && <span className={styles.mark} aria-hidden="true">{model.mark}</span>}
          <h3 className={styles.heading}>
            Plan
            <span className={styles.count}><span aria-hidden="true"> · </span><Roll value={total} reduced={reduced} /> {total === 1 ? "step" : "steps"}</span>
          </h3>
          <span className={styles.headMeta}>
            <AnimatePresence initial={false} mode="popLayout">
              {draft ? <motion.span key="model" {...swap}>{model.name}</motion.span> : (
                <motion.span key="count" {...swap}><Roll value={finished} reduced={reduced} /> of <Roll value={total} reduced={reduced} /></motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
        {goal && <p className={`${styles.goal} ${model.mark ? "" : styles.goalFlush}`}>{goal}</p>}
        <div className={styles.progress} role="progressbar" aria-label="Plan progress" aria-hidden={draft ? true : undefined} aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished} aria-valuetext={`${finished} of ${total} steps finished`}>
          <motion.span
            className={styles.fill} initial={false} style={{ transformOrigin: "left center" }}
            animate={{ opacity: draft ? 0 : 1, scaleX: draft || total === 0 ? 0 : finished / total }} transition={reduced ? { duration: 0 } : SPRING}
          />
        </div>
      </header>
      <div className={styles.listWrap}>
        <span id={hintId} className={styles.srOnly}>Alt plus Arrow up or down moves a step. Escape undoes a rename.</span>
        {total === 0 && <p className={styles.empty}>No steps yet. Add one to start the plan.</p>}
        <Reorder.Group as="ol" axis="y" className={styles.list} aria-label="Plan steps" style={{ overflowAnchor: "none" }} values={steps.map(step => step.id)}
          onReorder={(ids: string[]) => setSteps(ids.map(id => steps.find(step => step.id === id)).filter((step): step is AgentPlanStep => !!step))}
        >
          <AnimatePresence initial={false}>
            {steps.map((step, index) => (
              <Row
                key={step.id} step={step} index={index} count={total} draft={draft} paused={paused} fresh={fresh.includes(step.id)} streaming={streamingId === step.id}
                reduced={reduced} hintId={hintId} model={model} onRename={rename} onMove={move} onRemove={remove} onStreamed={onStreamed} onAction={stepAction}
                onDragEnd={() => onChange?.(stepsRef.current)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
        <AnimatePresence initial={false}>
          {draft && (
            <motion.div key="add" className={styles.collapse} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : SPRING}>
              <button type="button" className={styles.add} onClick={addStep}>
                <span className={styles.lead}><Plus size={16} strokeWidth={1.75} aria-hidden /></span>Add step
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div className={styles.footWrap} initial={false} animate={footH == null ? undefined : { height: footH }} transition={reduced ? { duration: 0 } : SPRING}>
        <div ref={footRef}>
          <div className={styles.foot}>
            <AnimatePresence initial={false} mode="popLayout">
              {phase === "draft" && (
                <motion.div key="draft" className={styles.footRow} data-phase="draft" {...swap}>
                  <Button variant="secondary" size="sm" onClick={keepPlanning} disabled={!!streamingId || (simulated && suggested >= SUGGESTIONS.length)}>Keep planning</Button>
                  <Button variant="primary" size="sm" className={styles.approve} onClick={approve} disabled={!!streamingId || !steps.some(step => step.title.trim())}>Approve plan</Button>
                </motion.div>
              )}
              {phase === "run" && (
                <motion.div key="run" className={styles.footRow} data-phase="run" {...swap}>
                  <span className={styles.footStatus}>
                    <AnimatePresence initial={false} mode="popLayout"><motion.span key={footStatus} {...swap}>{footStatus}</motion.span></AnimatePresence>
                  </span>
                  <AnimatePresence initial={false}>
                    {failedIndex < 0 && (
                      <motion.span key="pause" className={styles.pauseSlot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                        <Button variant="secondary" size="sm" onClick={togglePause}>
                          {paused ? <Play size={16} strokeWidth={1.75} aria-hidden /> : <Pause size={16} strokeWidth={1.75} aria-hidden />}{paused ? "Resume" : "Pause"}
                        </Button>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
              {phase === "done" && (
                <motion.div key="done" className={styles.footRow} data-phase="done" {...swap}>
                  <Summary total={totalTime} text={summary} reduced={reduced} />
                  {simulated && (
                    <Button variant="ghost" size="sm" onClick={startOver}><RotateCcw size={16} strokeWidth={1.75} aria-hidden />Start over</Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
    </section>
  );
}

export default AgentPlan;
