"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight, BookOpen, Check, FilePen, FileSearch, Files, FlaskConical, Globe, ListChecks, NotebookPen,
  Pause, Play, RotateCcw, Scale, Search, Square, SquareTerminal, X,
} from "lucide-react";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-status.module.css";

export type AgentRunStatus = "idle" | "working" | "needs-input" | "paused" | "done" | "failed" | "stopped";
export type AgentStepStatus = "pending" | "active" | "waiting" | "done" | "failed" | "skipped";
export type AgentIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string; "aria-hidden"?: boolean }>;

export interface AgentActivity {
  label: string;
  icon?: AgentIcon;
  progress?: { value: number; total: number };
}

export interface AgentStep {
  id: string;
  label: string;
  icon?: AgentIcon;
  status: AgentStepStatus;
  startedAt?: number | Date;
  durationMs?: number;
}

export interface AgentIdentity {
  name: string;
  mark?: ReactNode;
}

export interface AgentStatusProps {
  status?: AgentRunStatus;
  activity?: AgentActivity;
  steps?: AgentStep[];
  startedAt?: number | Date;
  endedAt?: number | Date;
  agent?: AgentIdentity;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onApprove?: () => void;
  onDeny?: () => void;
  onRetry?: () => void;
  onOpenRun?: () => void;
  settleAfter?: number | null;
  align?: "start" | "center" | "end";
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  maxSteps?: number;
  notice?: string;
  className?: string;
}

export type AgentRunScenarioId = "coding" | "research";
export interface UseAgentRunSimulationOptions {
  scenarioId?: AgentRunScenarioId;
  startDelay?: number;
}
export type AgentRunSimulation = Required<Pick<AgentStatusProps, "status" | "steps" | "agent" | "onPause" | "onResume" | "onStop" | "onApprove" | "onDeny" | "onRetry" | "onOpenRun">> &
  Pick<AgentStatusProps, "activity" | "startedAt" | "endedAt" | "notice"> & { replay: () => void };

/* ───────────────────────── Brand marks ───────────────────────── */

export function ClaudeMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} style={style}>
      <path fill="currentColor" d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

export function GeminiMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const d = "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} style={style}>
      <path d={d} fill="#3186FF" />
      <path d={d} fill={`url(#${id}-a)`} />
      <path d={d} fill={`url(#${id}-b)`} />
      <path d={d} fill={`url(#${id}-c)`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-a`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" /><stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-b`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" /><stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-c`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" /><stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

const toMs = (value: number | Date | undefined) => (value == null ? undefined : typeof value === "number" ? value : value.getTime());

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function formatShort(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function formatSpoken(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  const sec = `${s} second${s === 1 ? "" : "s"}`;
  return m > 0 ? `${m} minute${m === 1 ? "" : "s"} ${sec}` : sec;
}
function formatStep(ms: number) {
  return ms >= 60000 ? formatShort(ms) : `${(ms / 1000).toFixed(1)}s`;
}

const LIVE = new Set<AgentRunStatus>(["working", "needs-input"]);

/** Elapsed run time that leaves out paused and failed stretches. Ticks four times a second only while live. */
function useRunClock(status: AgentRunStatus, startedAt: number | undefined, endedAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const frozen = useRef({ total: 0, since: null as number | null, run: startedAt });
  const live = LIVE.has(status);
  const holding = status === "paused" || status === "failed";

  useEffect(() => {
    const f = frozen.current;
    if (f.run !== startedAt) { f.run = startedAt; f.total = 0; f.since = null; }
    if (holding) {
      if (f.since == null) f.since = Date.now();
    } else if (f.since != null) {
      f.total += Date.now() - f.since;
      f.since = null;
    }
    const sync = window.setTimeout(() => setNow(Date.now()), 0);
    if (!live) return () => window.clearTimeout(sync);
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => { window.clearTimeout(sync); window.clearInterval(id); };
  }, [live, holding, startedAt, status]);

  const [stamp, setStamp] = useState<{ status: AgentRunStatus; at: number } | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setStamp({ status, at: Date.now() }), 0);
    return () => window.clearTimeout(id);
  }, [status]);

  if (startedAt == null) return { elapsed: 0, now };
  const f = frozen.current;
  const ended = status === "done" || status === "stopped";
  // eslint-disable-next-line react-hooks/refs
  const end = ended ? endedAt ?? (stamp?.status === status ? stamp.at : now) : holding ? f.since ?? now : now;
  // eslint-disable-next-line react-hooks/refs
  return { elapsed: Math.max(0, end - startedAt - f.total), now };
}

function useSize(ref: React.RefObject<HTMLElement | null>, dep?: unknown) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => {
      const w = node.offsetWidth, h = node.offsetHeight;
      setSize(prev => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref, dep]);
  return size;
}

/* ───────────────────────── Component ───────────────────────── */

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export function AgentStatus(props: AgentStatusProps) {
  if (props.status === undefined) return <SimulatedAgentStatus {...props} />;
  return <AgentStatusView {...props} status={props.status} />;
}

function SimulatedAgentStatus(props: AgentStatusProps) {
  const { replay, ...run } = useAgentRunSimulation();
  void replay;
  return <AgentStatusView {...props} {...run} />;
}

function AgentStatusView({
  status: statusProp, activity, steps = [], startedAt, endedAt, agent = { name: "Agent" },
  onPause, onResume, onStop, onApprove, onDeny, onRetry, onOpenRun,
  settleAfter = 4000, align = "center", expanded: expandedProp, defaultExpanded = false, onExpandedChange,
  maxSteps = 5, notice, className,
}: AgentStatusProps & { status: AgentRunStatus }) {
  const reduced = !!useReducedMotion();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  /* Settle back to Ready after done/stopped. */
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const runKey = `${statusProp}:${toMs(startedAt) ?? ""}`;
  useEffect(() => {
    if (settleAfter == null || (statusProp !== "done" && statusProp !== "stopped")) return;
    const id = window.setTimeout(() => setSettledFor(runKey), settleAfter);
    return () => window.clearTimeout(id);
  }, [statusProp, settleAfter, runKey]);
  const status: AgentRunStatus = settledFor === runKey && (statusProp === "done" || statusProp === "stopped") ? "idle" : statusProp;

  const { elapsed, now } = useRunClock(statusProp, toMs(startedAt), toMs(endedAt));

  /* Expanded state. */
  const [expandedState, setExpandedState] = useState(defaultExpanded);
  const expanded = expandedProp ?? expandedState;
  const setExpanded = useCallback((next: boolean) => {
    if (expandedProp === undefined) setExpandedState(next);
    onExpandedChange?.(next);
  }, [expandedProp, onExpandedChange]);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [expanded, setExpanded]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape" && expanded) {
      event.stopPropagation();
      setExpanded(false);
      headRef.current?.focus();
    }
  };

  /* Label. */
  const label = useMemo(() => {
    const a = activity?.label;
    switch (status) {
      case "idle": return { text: "Ready", tone: "quiet" as const, icon: undefined };
      case "working": return { text: a ?? "Working", tone: "live" as const, icon: activity?.icon };
      case "needs-input": return { text: a ?? "Needs your approval", tone: "plain" as const, icon: activity?.icon };
      case "paused": return { text: a ? `Paused · ${a}` : "Paused", tone: "quiet" as const, icon: undefined };
      case "done": return { text: `Done in ${formatShort(elapsed)}${a ? ` · ${a}` : ""}`, tone: "plain" as const, icon: undefined };
      case "failed": return { text: a ?? "Failed", tone: "plain" as const, icon: undefined };
      case "stopped": return { text: `Stopped after ${formatShort(elapsed)}`, tone: "quiet" as const, icon: undefined };
    }
  }, [status, activity?.label, activity?.icon, elapsed]);
  const count = status === "working" && activity?.progress ? ` ${activity.progress.value} of ${activity.progress.total}` : "";
  const LabelIcon = label.icon;
  const showTimer = status !== "idle" && status !== "done" && status !== "stopped" && startedAt != null;
  const timerText = formatClock(elapsed);

  /* Inline actions. */
  const inline = status === "needs-input" && (onApprove || onDeny) ? "approve" : status === "failed" && onRetry ? "retry" : null;

  /* Measurements. */
  const [parentW, setParentW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const read = () => {
      const cs = getComputedStyle(parent);
      setParentW(Math.max(0, parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  const narrow = parentW != null && parentW < 400;
  const hideTimer = narrow && !!inline;
  const ghost = useSize(ghostRef);
  const body = useSize(bodyRef, expanded);
  const natural = ghost?.w ?? null;
  const cap = parentW ?? Infinity;
  const collapsedW = natural == null ? null : Math.min(natural, cap);
  const truncated = natural != null && natural > cap + 0.5;
  const expandedW = collapsedW == null ? 384 : Math.min(Math.max(384, collapsedW), Math.max(cap, collapsedW));
  const width = expanded ? expandedW : collapsedW;
  const height = expanded ? 40 + (body?.h ?? 0) : 40;
  const spring = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const measured = width != null;

  /* Steps. */
  const total = steps.length;
  const reached = steps.filter(step => step.status !== "pending");
  const finished = steps.filter(step => step.status === "done" || step.status === "skipped").length;
  const visible = reached.slice(-Math.max(1, maxSteps));
  const allDone = total > 0 && finished === total;

  /* Announcements. */
  const [announced, setAnnounced] = useState("");
  const spoken = status === "done"
    ? `done in ${formatSpoken(elapsed)}${activity?.label ? `, ${activity.label}` : ""}`
    : status === "stopped" ? `stopped after ${formatSpoken(elapsed)}` : label.text;
  const announcement = `${agent.name}: ${spoken}${notice ? `. ${notice}` : ""}`;
  useEffect(() => {
    const id = window.setTimeout(() => setAnnounced(announcement), 0);
    return () => window.clearTimeout(id);
  }, [announcement]);

  /* Open run confirmation. */
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    const id = window.setTimeout(() => setOpened(false), 1400);
    return () => window.clearTimeout(id);
  }, [opened]);

  /* If a focused control disappears, move focus to the pill. */
  const hadFocus = useRef(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onFocusIn = () => { hadFocus.current = true; };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next) { hadFocus.current = root.contains(next); return; }
      window.setTimeout(() => {
        if (hadFocus.current && document.activeElement === document.body && document.hasFocus()) headRef.current?.focus({ preventScroll: true });
        hadFocus.current = root.contains(document.activeElement);
      }, 0);
    };
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => { root.removeEventListener("focusin", onFocusIn); root.removeEventListener("focusout", onFocusOut); };
  }, []);

  const glyph = status === "done" ? "check" : status === "failed" ? "cross" : status === "stopped" ? "stop" : "mark";
  const closed = status === "done" || status === "failed";
  const draw = reduced ? { duration: 0 } : { duration: motionTokens.duration.considered, ease: EASE };
  const roll = reduced ? { duration: 0 } : { duration: 0.18, ease: EASE };

  const orb = (
    <span className={styles.orb} data-state={status} aria-hidden="true">
      <svg className={styles.ring} viewBox="0 0 24 24" fill="none">
        <circle className={styles.track} cx="12" cy="12" r="10.75" />
        <g className={styles.spinner}>
          <circle className={styles.arc} cx="12" cy="12" r="10.75" pathLength={100} strokeDasharray="24 76" />
        </g>
        <motion.circle
          className={styles.closed} cx="12" cy="12" r="10.75" initial={false}
          animate={{ pathLength: closed ? 1 : 0, opacity: closed ? 1 : 0 }}
          transition={closed ? draw : { duration: 0 }}
        />
      </svg>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={glyph} className={styles.glyph} data-glyph={glyph}
          initial={reduced ? false : { opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.7, transition: { duration: motionTokens.duration.exit } }}
          transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
        >
          {glyph === "mark" ? agent.mark ?? <DefaultMark /> : glyph === "stop" ? <span className={styles.stopGlyph} /> : (
            <svg viewBox="0 0 24 24" fill="none">
              {glyph === "check" ? (
                <motion.path d="M5.5 12.5l4.25 4.25L18.5 7.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...draw, delay: reduced ? 0 : 0.12 }} />
              ) : (
                <>
                  <motion.path d="M7 7l10 10" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...draw, delay: reduced ? 0 : 0.1 }} />
                  <motion.path d="M17 7L7 17" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...draw, delay: reduced ? 0 : 0.2 }} />
                </>
              )}
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {status === "needs-input" && (
          <motion.span
            key="dot" className={styles.dot}
            initial={reduced ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.4, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
          />
        )}
      </AnimatePresence>
    </span>
  );

  const inlineButtons = (ghostly: boolean) => inline && (
    <span className={styles.actions}>
      {inline === "approve" ? (
        <>
          {onDeny && (
            <Button variant="secondary" size="sm" tabIndex={ghostly ? -1 : undefined} className={`${styles.inlineButton} ${narrow ? styles.iconButton : ""}`} aria-label={narrow ? "Deny" : undefined} onClick={ghostly ? undefined : onDeny}>
              {narrow ? <X {...ICON} /> : "Deny"}
            </Button>
          )}
          {onApprove && (
            <Button variant="primary" size="sm" tabIndex={ghostly ? -1 : undefined} className={`${styles.inlineButton} ${styles.accentButton} ${narrow ? styles.iconButton : ""}`} aria-label={narrow ? "Approve" : undefined} onClick={ghostly ? undefined : onApprove}>
              {narrow ? <Check {...ICON} /> : "Approve"}
            </Button>
          )}
        </>
      ) : (
        <Button variant="primary" size="sm" tabIndex={ghostly ? -1 : undefined} className={`${styles.inlineButton} ${styles.accentButton} ${narrow ? styles.iconButton : ""}`} aria-label={narrow ? "Retry" : undefined} onClick={ghostly ? undefined : onRetry}>
          {narrow ? <RotateCcw {...ICON} /> : "Retry"}
        </Button>
      )}
    </span>
  );

  const labelKey = `${status}|${status === "done" || status === "stopped" ? "" : label.text}`;
  const headName = `${agent.name}: ${label.text}${count}${showTimer ? `, ${timerText} elapsed` : ""}`;

  const primarySlot = status === "needs-input" && onApprove
    ? { key: "approve", label: "Approve", icon: Check, accent: true, run: onApprove }
    : status === "failed" && onRetry ? { key: "retry", label: "Retry", icon: RotateCcw, accent: true, run: onRetry }
    : status === "working" && onPause ? { key: "pause", label: "Pause", icon: Pause, accent: false, run: onPause }
    : status === "paused" && onResume ? { key: "resume", label: "Resume", icon: Play, accent: false, run: onResume }
    : null;
  const secondarySlot = status === "needs-input" && onDeny
    ? { key: "deny", label: "Deny", icon: X, run: onDeny }
    : (status === "working" || status === "paused") && onStop ? { key: "stop", label: "Stop", icon: Square, run: onStop }
    : null;

  return (
    <div
      ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} data-align={align}
      style={{ width: collapsedW ?? undefined, visibility: measured ? undefined : "hidden" }} onKeyDown={onKeyDown}
    >
      <motion.div
        className={styles.surface} data-expanded={expanded} data-state={status} initial={false}
        animate={measured ? { width: width as number, height } : undefined} transition={spring}
        style={{ ["--panel-w" as string]: `${expandedW - 2}px`, ["--fade" as string]: truncated && !expanded ? "24px" : "0px", width: width ?? undefined, height }}
      >
        <div className={styles.row}>
          <button
            ref={headRef} type="button" className={styles.head} aria-expanded={expanded} aria-controls={panelId} aria-label={headName}
            data-actions={inline ? "" : undefined} onClick={() => setExpanded(!expanded)}
          >
            {orb}
            <span className={styles.labelSlot}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={labelKey} className={styles.labelUnit} data-tone={label.tone}
                  initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -12 }} transition={roll}
                >
                  {LabelIcon && <LabelIcon {...ICON} className={styles.labelIcon} />}
                  <span className={styles.labelText}>{label.text}{count && <span className={styles.count}>{count}</span>}</span>
                </motion.span>
              </AnimatePresence>
            </span>
            {showTimer && !hideTimer && <span className={styles.timer}>{timerText}</span>}
          </button>
          {inlineButtons(false)}
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="body" ref={bodyRef} id={panelId} className={styles.body} role="region" aria-label={`${agent.name} run details`}
              initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, delay: 0.1 } }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.instant } }}
            >
              <div className={styles.progress}>
                <div className={styles.meta}>
                  <span className={styles.agentName}>{agent.name}</span>
                  {total > 0 && <span>{allDone ? `${total} of ${total} steps` : `Step ${Math.max(1, reached.length)} of ${total}`}</span>}
                </div>
                {total > 0 && (
                  <div className={styles.segments} role="progressbar" aria-label="Run progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished} aria-valuetext={`${finished} of ${total} steps finished`}>
                    {steps.map(step => (
                      <span key={step.id} className={styles.segment} data-status={step.status}>
                        <span className={styles.segmentFill} style={{ transform: `scaleX(${step.status === "done" || step.status === "failed" || step.status === "skipped" ? 1 : 0})` }} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {visible.length === 0 ? <p className={styles.empty}>No steps yet.</p> : (
                <ol className={styles.steps}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {visible.map(step => {
                      const StepIcon = step.icon;
                      const active = step.status === "active";
                      const stepCount = active && activity?.progress && activity.label === step.label ? ` ${activity.progress.value} of ${activity.progress.total}` : "";
                      const begun = toMs(step.startedAt);
                      const time = step.durationMs != null && !active ? formatStep(step.durationMs)
                        : active && begun != null ? `${Math.max(0, Math.floor((now - begun) / 1000))}s` : "";
                      return (
                        <motion.li
                          key={step.id} layout={reduced ? false : "position"} className={styles.step} data-status={step.status}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.instant } }}
                          transition={reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}
                        >
                          <span className={styles.stepIcon}>{StepIcon ? <StepIcon {...ICON} /> : <span className={styles.stepDot} />}</span>
                          <span className={styles.stepText}>
                            <AnimatePresence initial={false} mode="popLayout">
                              <motion.span
                                key={step.label} className={`${styles.stepLabel} ${active && status === "working" ? styles.shimmer : ""}`}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.instant } }}
                                transition={{ duration: reduced ? 0 : motionTokens.duration.standard }}
                              >
                                {step.label}{stepCount && <span className={styles.count}>{stepCount}</span>}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                          <span className={styles.stepTime}>{time}</span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>
              )}
              {(primarySlot || secondarySlot || onOpenRun) && (
                <div className={styles.footer}>
                  {primarySlot && (
                    <span className={styles.slot}>
                      <Button variant={primarySlot.accent ? "primary" : "secondary"} size="sm" className={primarySlot.accent ? styles.accentButton : undefined} onClick={primarySlot.run}>
                        <primarySlot.icon {...ICON} />{primarySlot.label}
                      </Button>
                    </span>
                  )}
                  {secondarySlot && (
                    <span className={styles.slot}>
                      <Button variant="secondary" size="sm" onClick={secondarySlot.run}>
                        <secondarySlot.icon {...ICON} />{secondarySlot.label}
                      </Button>
                    </span>
                  )}
                  {onOpenRun && (
                    <Button
                      variant="ghost" size="sm" className={`${styles.open} ${narrow ? styles.openIcon : ""}`} aria-label={narrow ? "Open run" : undefined}
                      onClick={() => { setOpened(true); onOpenRun(); }}
                    >
                      {!narrow && "Open run"}{opened ? <Check {...ICON} /> : <ArrowUpRight {...ICON} />}
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className={styles.ghosts} aria-hidden="true" inert>
        <div ref={ghostRef} className={styles.ghost}>
          <span className={styles.head} data-actions={inline ? "" : undefined}>
            <span className={styles.orbSpace} />
            <span className={styles.labelSlot}>
              <span className={styles.labelUnit}>
                {LabelIcon && <LabelIcon {...ICON} className={styles.labelIcon} />}
                <span className={styles.labelText}>{label.text}{count && <span className={styles.count}>{count}</span>}</span>
              </span>
            </span>
            {showTimer && !hideTimer && <span className={styles.timer}>{timerText}</span>}
          </span>
          {inlineButtons(true)}
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">{announced}</span>
    </div>
  );
}

function DefaultMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6" fill="currentColor" />
    </svg>
  );
}

/* ───────────────────────── Simulation ───────────────────────── */

interface ScriptStep {
  id: string;
  icon: AgentIcon;
  active: string;
  done: string;
  duration: number;
  count?: number;
  /** Stop with a failure when the count reaches this value on the first try. */
  failAt?: number;
  failLabel?: string;
  failActivity?: string;
  retryNotice?: string;
  /** Wait for approval before this step runs. */
  gate?: string;
  approveNotice?: string;
}

interface Scenario {
  agent: AgentIdentity;
  steps: ScriptStep[];
  outcome: string;
}

const SCENARIOS: Record<AgentRunScenarioId, Scenario> = {
  coding: {
    agent: { name: "Claude Sonnet 5.5", mark: <ClaudeMark style={{ color: "#D97757" }} /> },
    outcome: "6 files changed",
    steps: [
      { id: "read", icon: FileSearch, active: "Reading 12 files", done: "Read 12 files", duration: 1900 },
      { id: "search", icon: Search, active: "Searching for prorateInvoice", done: "Found 4 call sites", duration: 1500 },
      { id: "edit", icon: FilePen, active: "Editing src/billing/invoice.ts", done: "Edited src/billing/invoice.ts", duration: 2500 },
      { id: "tests-update", icon: Files, active: "Updating 5 test files", done: "Updated 5 test files", duration: 1900 },
      { id: "tests", icon: FlaskConical, active: "Running tests", done: "Passed 12 of 12 tests", duration: 3300, count: 12 },
      {
        id: "push", icon: SquareTerminal, active: "Pushing fix/proration-rounding", done: "Pushed fix/proration-rounding", duration: 1400,
        gate: "Needs your approval to run git push", approveNotice: "Approved. The push is simulated in this preview.",
      },
    ],
  },
  research: {
    agent: { name: "Gemini 4 Argon", mark: <GeminiMark /> },
    outcome: "9 sources cited",
    steps: [
      { id: "plan", icon: ListChecks, active: "Planning 4 research questions", done: "Planned 4 questions", duration: 1400 },
      { id: "search", icon: Globe, active: "Searching the web", done: "Found 18 results", duration: 1900 },
      {
        id: "read", icon: BookOpen, active: "Reading sources", done: "Read 9 sources", duration: 3200, count: 9,
        failAt: 5, failLabel: "2 sources timed out", failActivity: "Fetch failed · 2 sources timed out", retryNotice: "Retrying the sources that timed out.",
      },
      { id: "compare", icon: Scale, active: "Comparing pricing across 5 vendors", done: "Compared 5 vendors", duration: 2200 },
      { id: "write", icon: NotebookPen, active: "Writing the brief", done: "Wrote a 640 word brief", duration: 2300 },
    ],
  },
};

interface SimState {
  status: AgentRunStatus;
  index: number;
  /** Milliseconds the current step has been running. */
  t: number;
  retried: boolean;
  approved: boolean;
  startedAt?: number;
  endedAt?: number;
  stepStartedAt?: number;
  notice?: string;
  wait: number;
}

const TICK = 50;

export function useAgentRunSimulation({ scenarioId = "coding", startDelay = 900 }: UseAgentRunSimulationOptions = {}): AgentRunSimulation {
  const scenario = SCENARIOS[scenarioId];
  const fresh = useCallback((wait: number): SimState => ({ status: "idle", index: 0, t: 0, retried: false, approved: false, wait }), []);
  const [state, setState] = useState<SimState>(() => fresh(startDelay));
  const [seen, setSeen] = useState(scenarioId);
  if (seen !== scenarioId) {
    setSeen(scenarioId);
    setState(fresh(Math.min(startDelay, 500)));
  }

  const ticking = (state.status === "idle" && state.wait >= 0 && state.startedAt === undefined) || state.status === "working";
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => {
      setState(prev => {
        if (prev.status === "idle") {
          if (prev.startedAt !== undefined) return prev;
          const wait = prev.wait - TICK;
          if (wait > 0) return { ...prev, wait };
          const nowMs = Date.now();
          return { ...prev, wait: -1, status: "working", startedAt: nowMs, stepStartedAt: nowMs };
        }
        if (prev.status !== "working") return prev;
        const step = scenario.steps[prev.index];
        if (!step) return prev;
        const t = prev.t + TICK;
        if (step.failAt && !prev.retried && step.count) {
          const failTime = (step.duration / step.count) * step.failAt;
          if (t >= failTime) return { ...prev, t: failTime, status: "failed", notice: undefined };
        }
        if (t < step.duration) return { ...prev, t };
        const nextIndex = prev.index + 1;
        const next = scenario.steps[nextIndex];
        const nowMs = Date.now();
        if (!next) return { ...prev, t: step.duration, index: nextIndex, status: "done", endedAt: nowMs, notice: undefined };
        if (next.gate) return { ...prev, index: nextIndex, t: 0, status: "needs-input", approved: false, stepStartedAt: nowMs, notice: undefined };
        return { ...prev, index: nextIndex, t: 0, stepStartedAt: nowMs, notice: undefined };
      });
    }, TICK);
    return () => window.clearInterval(id);
  }, [ticking, scenario]);

  const current = scenario.steps[state.index];
  const started = state.startedAt !== undefined;

  const steps = useMemo<AgentStep[]>(() => scenario.steps.map((step, i) => {
    if (!started || i > state.index) return { id: step.id, label: step.active, icon: step.icon, status: "pending" };
    if (i < state.index) return { id: step.id, label: step.done, icon: step.icon, status: "done", durationMs: step.duration };
    if (state.status === "failed") return { id: step.id, label: step.failLabel ?? step.active, icon: step.icon, status: "failed" };
    if (state.status === "needs-input") return { id: step.id, label: step.gate ?? step.active, icon: step.icon, status: "waiting" };
    if (state.status === "stopped") return { id: step.id, label: step.active, icon: step.icon, status: "skipped" };
    return { id: step.id, label: step.active, icon: step.icon, status: "active", startedAt: state.stepStartedAt };
  }), [scenario, started, state.index, state.status, state.stepStartedAt]);

  let activity: AgentActivity | undefined;
  if (state.status === "done") activity = { label: scenario.outcome };
  else if (current && started) {
    if (state.status === "failed") activity = { label: current.failActivity ?? "Failed" };
    else if (state.status === "needs-input") activity = { label: current.gate ?? "Needs your approval", icon: current.icon };
    else {
      activity = { label: current.active, icon: current.icon };
      if (current.count) {
        const value = Math.min(current.count, Math.max(1, Math.floor((state.t / current.duration) * current.count) + (state.t >= current.duration ? 0 : 1)));
        activity.progress = { value, total: current.count };
      }
    }
  }

  const replay = useCallback(() => setState(fresh(Math.min(startDelay, 500))), [fresh, startDelay]);
  const onPause = useCallback(() => setState(prev => (prev.status === "working" ? { ...prev, status: "paused", notice: "Paused." } : prev)), []);
  const onResume = useCallback(() => setState(prev => (prev.status === "paused" ? { ...prev, status: "working", notice: "Resumed." } : prev)), []);
  const onStop = useCallback(() => setState(prev => (prev.status === "working" || prev.status === "paused" ? { ...prev, status: "stopped", endedAt: Date.now(), notice: "Stopped." } : prev)), []);
  const onApprove = useCallback(() => setState(prev => {
    if (prev.status !== "needs-input") return prev;
    return { ...prev, status: "working", approved: true, t: 0, stepStartedAt: Date.now(), notice: scenario.steps[prev.index]?.approveNotice ?? "Approved." };
  }), [scenario]);
  const onDeny = useCallback(() => setState(prev => (prev.status === "needs-input" ? { ...prev, status: "stopped", endedAt: Date.now(), notice: "Denied. The run stopped." } : prev)), []);
  const onRetry = useCallback(() => setState(prev => {
    if (prev.status !== "failed") return prev;
    return { ...prev, status: "working", retried: true, notice: scenario.steps[prev.index]?.retryNotice ?? "Retrying." };
  }), [scenario]);
  const onOpenRun = useCallback(() => setState(prev => ({ ...prev, notice: "Open run is simulated in this preview." })), []);

  return {
    status: state.status, activity, steps, startedAt: state.startedAt, endedAt: state.endedAt, agent: scenario.agent, notice: state.notice,
    onPause, onResume, onStop, onApprove, onDeny, onRetry, onOpenRun, replay,
  };
}

export default AgentStatus;
