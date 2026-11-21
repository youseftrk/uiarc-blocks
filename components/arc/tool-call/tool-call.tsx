"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, ChevronDown, CircleAlert, Globe, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import { TOOL_MARKS } from "./marks";
import styles from "./tool-call.module.css";

export type ToolCallStatus = "running" | "success" | "error" | "approval" | "denied";
export type ToolCallToolId = "github" | "linear" | "postgres" | "slack" | "gmail" | "web";
export type ToolCallTool = ToolCallToolId | { name: string; mark: ReactNode };
export type ToolCallValue = string | number | boolean | null | ToolCallValue[] | { [key: string]: ToolCallValue };
export interface ToolCallListItem { lead?: string; title: string; tag?: string }
export type ToolCallOutput =
  | { type: "list"; items: ToolCallListItem[] }
  | { type: "table"; columns: string[]; rows: ToolCallValue[][] }
  | { type: "json"; value: ToolCallValue }
  | { type: "text"; text: string };
export interface ToolCallData {
  id: string;
  tool: ToolCallTool;
  title: string;
  titles?: Partial<Record<ToolCallStatus, string>>;
  status: ToolCallStatus;
  input?: Record<string, ToolCallValue>;
  output?: ToolCallOutput;
  summary?: string;
  message?: string;
  durationMs?: number;
}
export interface ToolCallProps extends Partial<ToolCallData> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onApprove?: () => void;
  onDeny?: () => void;
  onRetry?: () => void;
  renderOutput?: (call: ToolCallData) => ReactNode | undefined;
  className?: string;
}
export interface ToolCallGroupProps {
  calls?: ToolCallData[];
  active?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  autoCollapse?: boolean;
  onApprove?: (call: ToolCallData) => void;
  onDeny?: (call: ToolCallData) => void;
  onRetry?: (call: ToolCallData) => void;
  renderOutput?: (call: ToolCallData) => ReactNode | undefined;
  className?: string;
}

export const toolCallSampleCalls: ToolCallData[] = [
  {
    id: "search-issues", tool: "github", title: "Searched issues in arc-ui/web", titles: { running: "Searching issues in arc-ui/web" }, status: "success", durationMs: 1180,
    input: { repo: "arc-ui/web", query: "is:open label:release-blocker milestone:2.8", sort: "updated" },
    output: { type: "list", items: [
      { lead: "#1284", title: "Checkout button stays disabled after a coupon is removed", tag: "checkout" },
      { lead: "#1291", title: "Webhook retry posts a second charge after a 504", tag: "billing" },
      { lead: "#1302", title: "Session is lost after SSO sign in on iPad", tag: "auth" },
      { lead: "#1306", title: "Release notes page returns 404 on docs preview", tag: "docs" },
    ] },
  },
  {
    id: "read-project", tool: "linear", title: "Read the Web 2.8 release project", titles: { running: "Reading the Web 2.8 release project" }, status: "success", summary: "2 blocked", durationMs: 760,
    input: { project: "Web 2.8 release", team: "WEB", include: "issues, milestones" },
    output: { type: "json", value: {
      project: "Web 2.8 release", lead: "Maya Chen", target: "2026-10-23", progress: .86, health: "at risk",
      milestones: [{ name: "Code freeze", date: "2026-10-20", done: true }, { name: "Release candidate", date: "2026-10-22", done: false }],
      blocked: [
        { id: "WEB-412", title: "Ship the coupon fix to checkout", assignee: "Daniel Okafor", blockedBy: "arc-ui/web#1284" },
        { id: "WEB-418", title: "Run migration 0047 on production", assignee: "Priya Raman", blockedBy: null },
      ],
      openIssues: 7, doneIssues: 43,
    } },
  },
  {
    id: "query-migrations", tool: "postgres", title: "Queried pending migrations", titles: { running: "Querying pending migrations", error: "Could not query pending migrations" }, status: "success", durationMs: 420,
    input: { database: "app_production", sql: "select version, name, applied_at from schema_migrations where applied_at is null order by version" },
    output: { type: "table", columns: ["version", "name", "applied_at"], rows: [["0047", "add_coupon_redemptions_index", null], ["0048", "backfill_invoice_currency", null]] },
  },
  {
    id: "post-summary", tool: "slack", title: "Posted to #release", titles: { approval: "Post a summary to #release", running: "Posting to #release", denied: "Did not post to #release" }, status: "success", summary: "1 message", durationMs: 610,
    input: { channel: "#release", text: "2.8 is blocked by #1284 (coupon checkout) and migration 0047, still pending on production. The Oct 23 target holds if both land by Wednesday." },
    output: { type: "text", text: "Sent to #release at 10:42 as Arc agent." },
  },
];

const { spring, duration } = motionTokens;
const smooth = { ...spring.smooth }, snappy = { ...spring.snappy }, morph = { ...spring.morph };
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const formatDuration = (ms: number) => ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const cell = (value: ToolCallValue) => value === null ? "null" : typeof value === "object" ? JSON.stringify(value) : String(value);
const toolName = (tool: ToolCallTool) => typeof tool === "string" ? tool === "web" ? "Web search" : TOOL_MARKS[tool]?.name ?? tool : tool.name;
const toolKey = (tool: ToolCallTool) => typeof tool === "string" ? tool : `custom:${tool.name}`;
const titleOf = (call: ToolCallData) => call.titles?.[call.status] ?? call.title;
function summaryOf(call: ToolCallData) {
  if (call.summary) return call.summary;
  const output = call.output;
  if (!output) return undefined;
  if (output.type === "list") return plural(output.items.length, "result");
  if (output.type === "table") return plural(output.rows.length, "row");
  if (output.type === "json" && output.value && typeof output.value === "object") return plural(Array.isArray(output.value) ? output.value.length : Object.keys(output.value).length, Array.isArray(output.value) ? "item" : "field");
  return undefined;
}
function copyText(output: ToolCallOutput) {
  if (output.type === "json") return JSON.stringify(output.value, null, 2);
  if (output.type === "text") return output.text;
  if (output.type === "list") return output.items.map(item => [item.lead, item.title, item.tag].filter(Boolean).join(" ")).join("\n");
  return [output.columns, ...output.rows.map(row => row.map(cell))].map(row => row.join("\t")).join("\n");
}

function ToolMark({ tool, size }: { tool: ToolCallTool; size: number }) {
  if (typeof tool !== "string") return <>{tool.mark}</>;
  if (tool === "web") return <Globe size={size} strokeWidth={1.75} aria-hidden="true" />;
  const mark = TOOL_MARKS[tool];
  return <svg viewBox="0 0 24 24" fill={mark.fill} aria-hidden="true" focusable="false" width={size} height={size}>{mark.body}</svg>;
}

function Collapse({ open, id, className, children }: { open: boolean; id?: string; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div id={id} className={className} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { height: smooth, opacity: { duration: duration.fast } }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  const reduced = useReducedMotion();
  return (
    <span className={styles.status} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span key={status} className={styles.statusIcon} data-status={status} initial={reduced ? false : { opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: .6 }} transition={snappy}>
          {status === "running" ? <LoaderCircle size={16} strokeWidth={1.75} className={styles.spinner} />
            : status === "success" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M3.25 8.5 6.5 11.75 12.75 4.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .26, delay: .06, ease: [...motionTokens.ease.standard] }} />
              </svg>
            ) : status === "error" ? <CircleAlert size={16} strokeWidth={1.75} />
            : status === "approval" ? <ShieldCheck size={16} strokeWidth={1.75} />
            : <Ban size={16} strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Fold({ total, limit, row, head = 0, unit, children }: { total: number; limit: number; row: number; head?: number; unit: string; children: (shown: boolean) => ReactNode }) {
  const id = useId(), reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  const folds = total > limit;
  if (!folds) return <div className={styles.foldBody}>{children(true)}</div>;
  return (
    <>
      <motion.div id={id} className={styles.foldBody} style={{ overflow: "hidden" }} initial={false} animate={{ height: head + (shown ? total : limit) * row }} transition={reduced ? { duration: 0 } : smooth}>{children(shown)}</motion.div>
      <button type="button" className={styles.more} aria-expanded={shown} aria-controls={id} onClick={() => setShown(value => !value)}>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" /><span>{shown ? "Show less" : `Show ${total - limit} more ${unit}`}</span>
      </button>
    </>
  );
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
function JsonLine({ line }: { line: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(JSON_TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(line.slice(last, at));
    if (match[1]) { parts.push(<span key={at} className={match[2] ? styles.jsonKey : styles.jsonString}>{match[1]}</span>); if (match[2]) parts.push(match[2]); }
    else if (match[3]) parts.push(<span key={at} className={styles.literal}>{match[3]}</span>);
    else parts.push(<span key={at} className={styles.jsonNumber}>{match[4]}</span>);
    last = at + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <>{parts}</>;
}

function Output({ output }: { output: ToolCallOutput }) {
  if (output.type === "text") return <p className={styles.text}>{output.text}</p>;
  if (output.type === "list") return (
    <Fold total={output.items.length} limit={5} row={32} unit="results">{shown => (
      <ul className={styles.list}>
        {output.items.map((item, index) => (
          <li key={index} className={styles.listRow} aria-hidden={!shown && index >= 5 ? true : undefined}>
            <span className={styles.listLead}>{item.lead}</span><span className={styles.listTitle}>{item.title}</span><span className={styles.listTag}>{item.tag}</span>
          </li>
        ))}
      </ul>
    )}</Fold>
  );
  if (output.type === "table") return (
    <Fold total={output.rows.length} limit={5} row={30} head={30} unit="rows">{shown => (
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr>{output.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{output.rows.map((row, index) => (
            <tr key={index} aria-hidden={!shown && index >= 5 ? true : undefined}>{row.map((value, at) => <td key={at} className={value === null || typeof value === "boolean" ? styles.literal : undefined}>{cell(value)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    )}</Fold>
  );
  const lines = JSON.stringify(output.value, null, 2).split("\n");
  return (
    <Fold total={lines.length} limit={10} row={20} unit="lines">{shown => (
      <pre className={styles.json}>{lines.map((line, index) => <span key={index} className={styles.jsonLine} aria-hidden={!shown && index >= 10 ? true : undefined}><JsonLine line={line} /></span>)}</pre>
    )}</Fold>
  );
}

function Section({ label, copy, children }: { label: string; copy: string; children: ReactNode }) {
  return (
    <div className={styles.section} role="group" aria-label={label}>
      <div className={styles.sectionHead}><span className={styles.sectionLabel} aria-hidden="true">{label}</span><CopyButton className={styles.copy} value={copy} label={`Copy ${label.toLowerCase()}`} iconOnly variant="plain" /></div>
      <div className={styles.well}>{children}</div>
    </div>
  );
}

const GroupContext = createContext<{ touch: () => void } | null>(null);
const SAMPLE = toolCallSampleCalls[0];

interface RowProps extends ToolCallProps { flush?: boolean }
function Row({ flush, defaultOpen = false, open, onOpenChange, onApprove, onDeny, onRetry, renderOutput, className, ...data }: RowProps) {
  const base = useId(), group = useContext(GroupContext);
  const given: ToolCallData = data.tool && data.title && data.status
    ? { ...data, id: data.id ?? base, tool: data.tool, title: data.title, status: data.status }
    : { ...SAMPLE, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) };
  // Without handlers the preview plays the action locally and says so to assistive technology.
  const [local, setLocal] = useState<{ from: ToolCallStatus; status: ToolCallStatus; note: string } | null>(null);
  const simulated = local && local.from === given.status ? local : null;
  const call: ToolCallData = simulated ? { ...given, status: simulated.status, message: simulated.status === "success" || simulated.status === "running" ? undefined : given.message } : given;
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const simulate = (to: ToolCallStatus, note: string) => {
    const from = given.status;
    clearTimeout(timer.current);
    if (to === "denied") { setLocal({ from, status: "denied", note }); return; }
    setLocal({ from, status: "running", note: "" });
    timer.current = window.setTimeout(() => setLocal({ from, status: to, note }), 900);
  };
  const approve = () => onApprove ? onApprove() : simulate("success", "Allowed. This preview simulates the call, so nothing was sent.");
  const deny = () => onDeny ? onDeny() : simulate("denied", "Denied. The call did not run.");
  const retry = () => onRetry ? onRetry() : simulate("success", "This preview simulates a successful retry.");

  const [openState, setOpenState] = useState(defaultOpen);
  const isOpen = open ?? openState;
  const toggle = () => { group?.touch(); if (open === undefined) setOpenState(!isOpen); onOpenChange?.(!isOpen); };

  const { status } = call, title = titleOf(call), name = toolName(call.tool);
  const summary = status === "success" ? summaryOf(call) : undefined;
  const time = status === "success" && call.durationMs !== undefined ? formatDuration(call.durationMs) : undefined;
  const note = status === "error" || status === "approval" ? call.message : status === "denied" ? call.message ?? "Denied, so this call never ran" : undefined;
  const state = status === "running" ? "Running"
    : status === "success" ? ["Done", summary, time].filter(Boolean).join(", ")
    : status === "error" ? `Failed${call.message ? `: ${call.message}` : ""}`
    : status === "approval" ? `Needs approval${call.message ? `: ${call.message}` : ""}`
    : "Denied, did not run";
  const announcement = simulated?.note || (status === "success" ? `${name}: ${title}${summary ? `, ${summary}` : ""}` : status === "error" ? `${name}: ${title}.${call.message ? ` ${call.message}` : ""}` : status === "approval" ? `${name}: ${title}. Needs approval.` : status === "denied" ? `${name}: ${title}. Denied.` : `${name}: ${title}`);
  const custom = status === "success" ? renderOutput?.(call) : undefined;
  const hasBody = !!call.input || !!call.output || custom !== undefined;
  const aside = status === "approval" ? "approval" : status === "error" ? "error" : status === "success" && (summary || time) ? "meta" : "";

  return (
    <div className={cx(styles.call, flush ? styles.flush : styles.solo, className)} data-status={status} data-open={isOpen || undefined}>
      <div className={styles.headClip}>
        <div className={styles.head} data-note={note ? "" : undefined}>
          <button type="button" className={styles.toggle} aria-expanded={isOpen} aria-controls={`${base}-body`} aria-labelledby={`${base}-name ${base}-title ${base}-state`} onClick={toggle} />
          <span className={styles.mark} aria-hidden="true"><ToolMark tool={call.tool} size={16} /></span>
          <span className={styles.title} aria-hidden="true">
            <span id={`${base}-name`} className={styles.srOnly}>{name}:</span>
            <span id={`${base}-title`} className={styles.titleInner}><TextShimmer className={styles.titleText} active={status === "running"}>{title}</TextShimmer></span>
          </span>
          {note && <span className={styles.note} aria-hidden="true">{note}</span>}
          <span className={styles.aside}>
            <AnimatePresence mode="popLayout" initial={false}>
              {aside && (
                <motion.span key={aside} className={styles.asideInner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>
                  {aside === "meta" ? (
                    <span className={styles.meta} aria-hidden="true">{summary && <span className={styles.metaSummary}>{summary}{time && <span className={styles.metaDot}>·</span>}</span>}{time && <span>{time}</span>}</span>
                  ) : aside === "approval" ? (
                    <span className={styles.actions}>
                      <Button variant="secondary" size="sm" className={styles.action} aria-label={`Deny: ${title}`} onClick={deny}>Deny</Button>
                      <Button variant="primary" size="sm" className={cx(styles.action, styles.allow)} aria-label={`Allow: ${title}`} onClick={approve}>Allow</Button>
                    </span>
                  ) : (
                    <span className={styles.actions}><Button variant="secondary" size="sm" className={styles.action} aria-label={`Retry: ${title}`} onClick={retry}><RotateCcw size={13} strokeWidth={1.75} aria-hidden="true" />Retry</Button></span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <StatusIcon status={status} />
          <span id={`${base}-state`} className={styles.srOnly}>{state}</span>
          <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
        </div>
      </div>
      <Collapse open={isOpen} id={`${base}-body`} className={styles.bodyClip}>
        <div className={styles.body}>
          {call.input && (
            <Section label="Input" copy={JSON.stringify(call.input, null, 2)}>
              <dl className={styles.kv}>{Object.entries(call.input).map(([key, value]) => <div key={key} className={styles.kvRow}><dt className={styles.kvKey}>{key}</dt><dd className={styles.kvValue}>{cell(value)}</dd></div>)}</dl>
            </Section>
          )}
          {custom !== undefined ? <Section label="Output" copy={call.output ? copyText(call.output) : ""}>{custom}</Section>
            : status === "success" && call.output ? <Section label="Output" copy={copyText(call.output)}><Output output={call.output} /></Section>
            : null}
          {!hasBody && <p className={styles.empty}>No input or output for this call.</p>}
        </div>
      </Collapse>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

export function ToolCall(props: ToolCallProps) {
  return <div className={styles.root}><Row {...props} /></div>;
}

const settled = (status: ToolCallStatus) => status === "success" || status === "denied";

export function ToolCallGroup({ calls = toolCallSampleCalls, active, defaultOpen, open, onOpenChange, autoCollapse = true, onApprove, onDeny, onRetry, renderOutput, className }: ToolCallGroupProps) {
  const id = useId(), reduced = useReducedMotion();
  const running = calls.some(call => call.status === "running"), waiting = calls.some(call => call.status === "approval");
  const failed = calls.filter(call => call.status === "error").length;
  const done = calls.length > 0 && calls.every(call => settled(call.status));
  const working = (active ?? running) && !waiting;
  const [openState, setOpenState] = useState(defaultOpen ?? (running || waiting || failed > 0));
  const isOpen = open ?? openState;
  const touched = useRef(false);
  const context = useMemo(() => ({ touch: () => { touched.current = true; } }), []);
  const change = (next: boolean) => { if (open === undefined) setOpenState(next); onOpenChange?.(next); };
  const latest = useRef({ change, isOpen, uncontrolled: open === undefined });
  useEffect(() => { latest.current = { change, isOpen, uncontrolled: open === undefined }; });

  // A call that needs a decision opens a closed group; a finished run folds itself away.
  useEffect(() => {
    if (!waiting || !latest.current.uncontrolled || latest.current.isOpen) return;
    const frame = requestAnimationFrame(() => latest.current.change(true));
    return () => cancelAnimationFrame(frame);
  }, [waiting]);
  const wasDone = useRef(done);
  useEffect(() => {
    const finished = done && !active && !wasDone.current;
    wasDone.current = done && !active;
    if (!finished || !autoCollapse || touched.current || !latest.current.isOpen) return;
    const timer = window.setTimeout(() => { if (!touched.current) latest.current.change(false); }, 450);
    return () => clearTimeout(timer);
  }, [done, active, autoCollapse]);

  // Rows that arrive while the list is already open grow in; rows that open with the list stagger.
  const [listReady, setListReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setListReady(isOpen)); return () => cancelAnimationFrame(frame); }, [isOpen]);

  const tools = useMemo(() => { const seen = new Map<string, ToolCallTool>(); for (const call of calls) if (!seen.has(toolKey(call.tool))) seen.set(toolKey(call.tool), call.tool); return [...seen]; }, [calls]);
  const total = calls.reduce((sum, call) => sum + (call.status === "success" ? call.durationMs ?? 0 : 0), 0);
  const label = waiting ? "Waiting for approval" : `${working ? "Using" : "Used"} ${plural(calls.length, "tool")}`;
  const meta = failed ? "failed" : done && !working && total ? "total" : "";

  return (
    <GroupContext.Provider value={context}>
      <div className={cx(styles.root, styles.group, className)} data-open={isOpen || undefined}>
        <div className={styles.groupHead}>
          <button type="button" className={styles.groupToggle} aria-expanded={isOpen} aria-controls={`${id}-list`} onClick={() => { touched.current = true; change(!isOpen); }}>
            <span className={styles.stack} aria-hidden="true">
              <AnimatePresence initial={false}>
                {tools.map(([key, tool], index) => (
                  <motion.span key={key} className={styles.stackItem} style={{ zIndex: index + 1 }} initial={reduced ? false : { width: 0, opacity: 0, marginLeft: 0 }} animate={{ width: 20, opacity: 1, marginLeft: index ? -4 : 0 }} exit={{ width: 0, opacity: 0, marginLeft: 0 }} transition={reduced ? { duration: 0 } : morph}>
                    <span className={styles.stackMark}><ToolMark tool={tool} size={12} /></span>
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
            <TextShimmer className={styles.groupLabel} active={working}>{label}</TextShimmer>
            <span className={styles.groupMeta}>
              <AnimatePresence mode="popLayout" initial={false}>
                {meta && <motion.span key={meta} className={meta === "failed" ? styles.groupMetaFailed : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>{meta === "failed" ? `${failed} failed` : formatDuration(total)}</motion.span>}
              </AnimatePresence>
            </span>
            <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
          </button>
        </div>
        <Collapse open={isOpen} id={`${id}-list`} className={styles.listClip}>
          <div className={styles.calls} role="list">
            {calls.map((call, index) => (
              <motion.div key={call.id} role="listitem" className={styles.item}
                initial={reduced ? false : listReady ? { opacity: 0, height: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                transition={reduced ? { duration: 0 } : listReady ? { height: smooth, opacity: { duration: duration.fast } } : { ...smooth, delay: index * .02 }}>
                <Row {...call} flush renderOutput={renderOutput}
                  onApprove={onApprove && (() => onApprove(call))} onDeny={onDeny && (() => onDeny(call))} onRetry={onRetry && (() => onRetry(call))} />
              </motion.div>
            ))}
          </div>
        </Collapse>
      </div>
    </GroupContext.Provider>
  );
}

export default ToolCall;
