"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Bot, ChevronDown, CircleAlert, CircleCheck, Headset, LoaderCircle, RotateCcw } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { ClaudeMark } from "../agent-loop/marks";
import styles from "./agent-handoff.module.css";

export type HandoffStage = "assistant" | "transferring" | "connected" | "resolved" | "unavailable";
export type HandoffScenario = "handoff" | "unavailable";

export interface HandoffMessage {
  id: string;
  from: "customer" | "assistant" | "agent";
  text: string;
  time?: string;
  streaming?: boolean;
}

export interface HandoffSummary {
  issue: string;
  fields?: { label: string; value: string }[];
}

export interface HandoffAgent {
  name: string;
  role?: string;
  avatar?: string;
  joinedAt?: string;
}

export interface AgentHandoffProps {
  stage?: HandoffStage;
  messages?: HandoffMessage[];
  agentMessages?: HandoffMessage[];
  typing?: "assistant" | "agent" | null;
  summary?: HandoffSummary;
  assistant?: { name?: string; model?: string; mark?: ReactNode };
  agent?: HandoffAgent;
  provider?: "intercom" | "zendesk" | { name: string; mark: ReactNode };
  replyEstimate?: string;
  title?: string;
  subtitle?: string;
  /** Mark shown before the title. */
  logo?: ReactNode;
  onSend?: (text: string) => void;
  onRequestHuman?: () => void;
  onCancelTransfer?: () => void;
  onRetry?: () => void;
  /** Simulation only: shows the replay button. */
  onReplay?: () => void;
  placeholder?: string;
  height?: number | string;
  notice?: string;
  scenario?: HandoffScenario;
  className?: string;
}

const INTERCOM_PATH = "M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z";
function IntercomMark() {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Intercom" aria-hidden="true"><path d={INTERCOM_PATH} /></svg>;
}
function ZendeskMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Zendesk" aria-hidden="true">
      <path d="M11.09 8.1V20.6H.75L11.09 8.1zM11.09 3.4a5.17 5.17 0 0 1-10.34 0h10.34zM12.91 20.6a5.17 5.17 0 0 1 10.34 0H12.91zM12.91 15.9V3.4h10.34L12.91 15.9z" />
    </svg>
  );
}

function NorthwindMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" role="img" aria-label="Northwind" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-light`} x1="8" y1="3" x2="8" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" /><stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="16" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" /><stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 4.75 20.75 12 16.9Z" fill={`url(#${id}-light)`} />
      <path d="M12 2.5 19.25 20.75 12 16.9Z" fill={`url(#${id}-dark)`} />
    </svg>
  );
}

const JORDAN_AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c9a8"/><stop offset="1" stop-color="#d98f6c"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="26" r="11" fill="#fff" fill-opacity=".9"/><path d="M10 64c2-15 11-22 22-22s20 7 22 22z" fill="#fff" fill-opacity=".9"/></svg>',
)}`;

const SAMPLE_SUMMARY: HandoffSummary = {
  issue: "Halden desk in white oak arrived with a cracked leg and a scratched top. Priya wants a full refund, not a replacement.",
  fields: [
    { label: "Order", value: "NW-48213 · delivered Oct 27" },
    { label: "Paid", value: "$649 · $150 gift card, $499 Visa 4417" },
    { label: "Asks for", value: "Full refund" },
  ],
};
const SAMPLE_AGENT: HandoffAgent = { name: "Jordan Reyes", role: "Support specialist", avatar: JORDAN_AVATAR, joinedAt: "14:05" };

const SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

function chunkWords(text: string) {
  const words = text.split(" ");
  const sizes = [5, 4, 8, 4, 8, 3, 6];
  const chunks: string[] = [];
  for (let i = 0, n = 0; i < words.length; n++) {
    const size = sizes[n % sizes.length];
    chunks.push(words.slice(i, i + size).join(" ") + (i + size >= words.length ? "" : " "));
    i += size;
  }
  return chunks;
}

/* ── Simulation ───────────────────────────────────────────────────────── */

interface SimState {
  stage: HandoffStage;
  messages: HandoffMessage[];
  agentMessages: HandoffMessage[];
  typing: "assistant" | "agent" | null;
  notice: string;
  empty: boolean;
}
const BLANK: SimState = { stage: "assistant", messages: [], agentMessages: [], typing: null, notice: "", empty: true };
type SimStep = { wait: number; apply: (state: SimState) => SimState; stop?: boolean };

const customer = (id: string, text: string, time?: string): HandoffMessage => ({ id, from: "customer", text, time });
const A1 = "Sorry about that, Priya. I found order NW-48213, the Halden desk in white oak, delivered today at 11:42. I can ship a replacement leg in 2 business days, or start a return.";
const A2 = "Refunds split across a gift card and a card need someone on our team. I'm passing everything along, so you won't have to repeat yourself.";
const streamTime = (text: string) => chunkWords(text).length * 34 + 30;
const settle = (id: string) => (state: SimState): SimState => ({ ...state, messages: state.messages.map(m => (m.id === id ? { ...m, streaming: false } : m)) });
const TRANSFER_STEP = 9;

function buildScript(scenario: HandoffScenario, reduced: boolean): SimStep[] {
  const say = (id: string, text: string) => (state: SimState): SimState => ({ ...state, typing: null, messages: [...state.messages, { id, from: "assistant", text, streaming: !reduced }] });
  const steps: SimStep[] = [
    { wait: 110, apply: () => BLANK },
    { wait: 250, apply: state => ({ ...state, empty: false, messages: [customer("c1", "Hi, my Halden desk arrived this morning with a cracked leg. Order NW-48213.", "14:02")] }) },
    { wait: 360, apply: state => ({ ...state, typing: "assistant" }) },
    { wait: 750, apply: say("a1", A1) },
    { wait: streamTime(A1), apply: settle("a1") },
    { wait: 1500, apply: state => ({ ...state, messages: [...state.messages, customer("c2", "The top is scratched too, so I'd rather have a refund. I paid with a $150 gift card and my Visa.")] }) },
    { wait: 350, apply: state => ({ ...state, typing: "assistant" }) },
    { wait: 850, apply: say("a2", A2) },
    { wait: streamTime(A2), apply: settle("a2") },
    { wait: 900, apply: state => ({ ...state, empty: false, typing: null, stage: "transferring", messages: state.messages.map(m => ({ ...m, streaming: false })), notice: "Transferring to a person through Intercom. Simulated, nothing was sent." }) },
  ];
  if (scenario === "unavailable") {
    steps.push({ wait: 2600, apply: state => ({ ...state, stage: "unavailable", notice: "No one is available right now. Try again, or keep writing and the team replies by email." }) });
    steps.push({ wait: 4000, apply: state => state, stop: true });
    return steps;
  }
  const agentSay = (id: string, text: string, notice?: string) => (state: SimState): SimState => ({ ...state, typing: null, notice: notice ?? state.notice, agentMessages: [...state.agentMessages, { id, from: "agent", text }] });
  steps.push(
    { wait: 2600, apply: state => ({ ...state, stage: "connected", notice: "Jordan Reyes joined the conversation." }) },
    { wait: 500, apply: state => ({ ...state, typing: "agent" }) },
    { wait: 970, apply: agentSay("j1", "Hi Priya, I'm Jordan. I read the summary, so no need to repeat anything. I've refunded $150 to your gift card and $499 to your Visa ending 4417.", "Refund issued. Simulated, no money moved.") },
    { wait: 600, apply: state => ({ ...state, typing: "agent" }) },
    { wait: 1200, apply: agentSay("j2", "The Visa refund shows up in 3 to 5 business days. A courier picks up the desk on Thursday, Oct 29, between 9:00 and 12:00.") },
    { wait: 1400, apply: state => ({ ...state, agentMessages: [...state.agentMessages, customer("c3", "That's perfect, thank you!")] }) },
    { wait: 700, apply: state => ({ ...state, stage: "resolved", notice: "Resolved by Jordan Reyes." }) },
    { wait: 4250, apply: state => state, stop: true },
  );
  return steps;
}

export interface UseHandoffSimulationOptions {
  scenario: HandoffScenario;
  reduced: boolean;
}

export function useHandoffSimulation({ scenario, reduced }: UseHandoffSimulationOptions) {
  const script = useMemo(() => buildScript(scenario, reduced), [scenario, reduced]);
  const [state, setState] = useState<SimState>(() => script.slice(1, reduced ? script.length : 2).reduce((acc, step) => step.apply(acc), BLANK));
  const [step, setStep] = useState(reduced ? -1 : 2);
  const [seen, setSeen] = useState(script);
  if (seen !== script) { setSeen(script); setStep(0); }
  const extra = useRef(0);

  useEffect(() => {
    if (step < 0 || step >= script.length) return;
    const current = script[step];
    const timer = window.setTimeout(() => {
      if (current.stop) { setStep(reduced ? -1 : 0); return; }
      setState(current.apply);
      setStep(step + 1);
    }, current.wait);
    return () => window.clearTimeout(timer);
  }, [step, script, reduced]);

  const replay = useCallback(() => setStep(0), []);
  const onRequestHuman = useCallback(() => { setState(script[TRANSFER_STEP].apply); setStep(TRANSFER_STEP + 1); }, [script]);
  const onRetry = useCallback(() => {
    setState(current => ({ ...current, stage: "transferring", notice: "Trying again. Simulated, nothing was sent." }));
    setStep(TRANSFER_STEP + 1);
  }, []);
  const onCancelTransfer = useCallback(() => {
    setStep(-1);
    setState(current => ({ ...current, stage: "assistant", typing: null, notice: "Transfer cancelled. You are back with the assistant." }));
  }, []);
  const onSend = useCallback((text: string) => {
    const message = customer(`you-${++extra.current}`, text);
    setState(current => (current.stage === "assistant" ? { ...current, empty: false, messages: [...current.messages, message] } : { ...current, agentMessages: [...current.agentMessages, message] }));
  }, []);

  return { stage: state.stage, messages: state.messages, agentMessages: state.agentMessages, typing: state.typing, summary: SAMPLE_SUMMARY, notice: state.notice, empty: state.empty, onSend, onRequestHuman, onCancelTransfer, onRetry, replay };
}

/* ── View ─────────────────────────────────────────────────────────────── */

function Bubble({ message, reduced }: { message: HandoffMessage; reduced: boolean }) {
  const chunks = useMemo(() => chunkWords(message.text), [message.text]);
  const streaming = !!message.streaming && !reduced;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!streaming) return;
    let n = 0;
    const timer = window.setInterval(() => { n += 1; setShown(n); if (n >= chunks.length) window.clearInterval(timer); }, 34);
    return () => window.clearInterval(timer);
  }, [streaming, chunks]);
  return (
    <div className={styles.bubble} data-from={message.from} data-streaming={streaming ? "true" : undefined}>
      {streaming ? chunks.slice(0, shown).map((chunk, i) => <span key={i} className={styles.chunk}>{chunk}</span>) : message.text}
    </div>
  );
}

function Fade({ id, className, children, reduced }: { id: string; className: string; children: ReactNode; reduced: boolean }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={id} className={className} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }} transition={{ duration: reduced ? 0 : 0.16 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

type Row = { key: string; kind: string; node?: boolean; gap: number; body: ReactNode; gutter?: ReactNode };

function HandoffView({
  stage, messages = [], agentMessages = [], typing = null, summary, assistant, agent, provider = "intercom", replyEstimate = "2 min",
  title = "Support chat", subtitle, logo, onSend, onRequestHuman, onCancelTransfer, onRetry, onReplay, placeholder, height = 600, notice, className, empty,
}: AgentHandoffProps & { stage: HandoffStage; empty?: boolean }) {
  const reduced = !!useReducedMotion();
  const summaryId = useId();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const [threadHeight, setThreadHeight] = useState<number | null>(null);

  const desk = provider === "intercom" ? { name: "Intercom", mark: <IntercomMark /> } : provider === "zendesk" ? { name: "Zendesk", mark: <ZendeskMark /> } : provider;
  const model = { name: assistant?.name ?? "Assistant", model: assistant?.model ?? "Claude Sonnet 5.5", mark: assistant?.mark ?? <ClaudeMark style={{ color: "currentColor" }} /> };
  const first = agent?.name.split(" ")[0] ?? "the team";
  const handed = stage !== "assistant";
  const joined = stage === "connected" || stage === "resolved";
  const streamingNow = messages.some(message => message.streaming);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => setPaused(!entries[0]?.isIntersecting));
    io.observe(node);
    return () => io.disconnect();
  }, []);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setThreadHeight(node.offsetHeight));
    ro.observe(node);
    return () => { ro.disconnect(); setThreadHeight(null); };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft("");
  };

  const chip = stage === "assistant" ? <><Bot aria-hidden />{model.name}</>
    : stage === "transferring" ? <><LoaderCircle className={styles.spin} aria-hidden />Transferring</>
    : stage === "connected" ? <><Headset aria-hidden />With {first}</>
    : stage === "resolved" ? <><CircleCheck className={styles.okIcon} aria-hidden />Resolved</>
    : <><CircleAlert className={styles.warnIcon} aria-hidden />No one available</>;

  const rows: Row[] = [];
  let previous = "";
  const push = (row: Omit<Row, "gap"> & { gap?: number }) => {
    const gap = row.gap ?? (rows.length === 0 ? 0 : row.node ? 16 : previous === "node" ? 8 : 12);
    rows.push({ ...row, gap });
    previous = row.node ? "node" : row.kind;
  };
  const pushMessage = (message: HandoffMessage) => push({ key: message.id, kind: "message", body: <Bubble message={message} reduced={reduced} /> });

  push({
    key: "assistant-node", kind: "assistant-node", node: true,
    body: (
      <div className={styles.node}>
        <span className={styles.nodeMark}><span className={styles.modelMark}>{model.mark}</span></span>
        <span className={styles.nodeText}><span className={styles.nodeTitle}>{model.name}</span><span className={styles.nodeMeta}>{model.model}</span></span>
        {messages[0]?.time && <time className={styles.time}>{messages[0].time}</time>}
      </div>
    ),
  });
  messages.forEach(pushMessage);
  if (typing === "assistant") push({ key: "thinking", kind: "typing", body: <div className={styles.thinking}><TextShimmer>Thinking</TextShimmer></div> });
  if (stage === "assistant" && onRequestHuman && typing !== "assistant" && !streamingNow) {
    const afterCustomer = messages[messages.length - 1]?.from === "customer";
    push({
      key: `ask-${messages.length}`, kind: "ask", gap: afterCustomer ? 4 : 12,
      body: <div className={styles.askRow}><button type="button" className={styles.ask} onClick={onRequestHuman}><Headset aria-hidden />Talk to a person</button></div>,
    });
  }
  if (handed) {
    const status = stage === "transferring"
      ? { id: "transferring", title: <TextShimmer>Transferring to a person</TextShimmer>, meta: `${desk.name} · typical reply in ${replyEstimate}` }
      : stage === "unavailable"
        ? { id: "unavailable", title: <><CircleAlert className={styles.warnIcon} aria-hidden />No one is available right now</>, meta: `${desk.name} · the team replies by email` }
        : { id: "done", title: <><CircleCheck className={styles.okIcon} aria-hidden />Transferred to {agent?.name ?? "the team"}</>, meta: `${desk.name} · summary read` };
    const action = stage === "transferring" && onCancelTransfer ? { id: "cancel", label: "Cancel", run: onCancelTransfer }
      : stage === "unavailable" && onRetry ? { id: "retry", label: "Try again", run: onRetry } : null;
    push({
      key: "handoff", kind: "handoff", node: true,
      gutter: stage === "transferring" && !reduced ? <span className={styles.travel}><i /></span> : null,
      body: (
        <div>
          <span className={styles.deskMark} aria-hidden="true">{desk.mark}</span>
          <section className={styles.card} aria-label="Handoff to a person">
            <div className={styles.cardHead}>
              <div className={styles.cardStatus}>
                <Fade id={status.id} className={styles.cardStatusInner} reduced={reduced}>
                  <span className={styles.cardTitle}>{status.title}</span><span className={styles.cardMeta}>{status.meta}</span>
                </Fade>
              </div>
              <div className={styles.cardAction}>
                <AnimatePresence initial={false} mode="popLayout">
                  {action && (
                    <motion.div key={action.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }} transition={{ duration: reduced ? 0 : 0.16 }}>
                      <Button variant="secondary" size="sm" onClick={action.run}>{action.label}</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {summary && (
              <>
                <button type="button" className={styles.summaryToggle} aria-expanded={open} aria-controls={summaryId} onClick={() => setOpen(value => !value)}>
                  <span>Summary shared with the team</span><ChevronDown className={styles.chevron} data-open={open ? "true" : undefined} aria-hidden />
                </button>
                {open && (
                  <div id={summaryId} className={styles.summary}>
                    <p className={styles.issue}>{summary.issue}</p>
                    {!!summary.fields?.length && (
                      <dl className={styles.fields}>{summary.fields.map(field => <div key={field.label} className={styles.field}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      ),
    });
    const firstAgent = agentMessages.findIndex(message => message.from === "agent");
    const split = joined ? (firstAgent < 0 ? agentMessages.length : firstAgent) : agentMessages.length;
    agentMessages.slice(0, split).forEach(pushMessage);
    if (joined && agent) {
      push({
        key: "agent-node", kind: "agent-node", node: true,
        body: (
          <div className={styles.node}>
            <span className={styles.nodeMark}><Avatar name={agent.name} src={agent.avatar} size="sm" className={styles.nodeAvatar} /></span>
            <span className={styles.nodeText}><span className={styles.nodeTitle}>{agent.name} joined</span>{agent.role && <span className={styles.nodeMeta}>{agent.role}</span>}</span>
            {agent.joinedAt && <time className={styles.time}>{agent.joinedAt}</time>}
          </div>
        ),
      });
    }
    agentMessages.slice(split).forEach(pushMessage);
    if (typing === "agent") {
      push({ key: "agent-typing", kind: "typing", body: <div className={styles.bubble} data-from="agent" data-typing="" role="img" aria-label={`${first} is typing`}><i /><i /><i /></div> });
    }
    if (stage === "resolved") {
      push({
        key: "resolved-node", kind: "resolved-node", node: true,
        body: (
          <div className={styles.node}>
            <span className={styles.nodeMark}><CircleCheck className={styles.okIcon} aria-hidden /></span>
            <span className={styles.nodeText}><span className={styles.nodeTitle}>Resolved</span>{agent && <span className={styles.nodeMeta}>by {agent.name}</span>}</span>
          </div>
        ),
      });
    }
  }

  const hint = placeholder ?? (stage === "assistant" ? `Message the ${model.name.toLowerCase()}` : stage === "transferring" ? "Add details for the team"
    : stage === "connected" ? `Message ${first}` : stage === "resolved" ? `Reply to ${first}` : "Leave a message for the team");
  const isEmpty = empty ?? (messages.length === 0 && !handed);

  return (
    <section
      ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-label={title} data-paused={paused ? "true" : undefined}
      style={{ "--handoff-height": typeof height === "number" ? `${height}px` : height } as CSSProperties}
    >
      <header className={styles.header}>
        {logo && <span className={styles.logo}>{logo}</span>}
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.headerEnd}>
          <span className={styles.chip}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={stage} className={styles.chipInner} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }} transition={{ duration: reduced ? 0 : 0.16 }}
              >
                {chip}
              </motion.span>
            </AnimatePresence>
          </span>
          {onReplay && (
            <Button variant="ghost" size="sm" aria-label="Replay the demo" title="Replay" onClick={onReplay}><RotateCcw size={14} strokeWidth={1.75} aria-hidden /></Button>
          )}
        </div>
      </header>
      <div className={styles.scroll} role="log" aria-live="off" aria-label="Conversation" tabIndex={0}>
        <div className={styles.fill}>
          <AnimatePresence initial={false} mode="wait">
            {isEmpty ? (
              <motion.div key="empty" className={styles.run} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.1 }}>
                <div className={styles.empty}>
                  <span className={styles.modelMark}>{model.mark}</span>
                  <p className={styles.emptyTitle}>Ask the {model.name.toLowerCase()} anything</p>
                  <p className={styles.emptyMeta}>A person from the team can join at any time.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="thread" className={styles.run} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.1 }}>
                <motion.div className={styles.clip} initial={false} animate={{ height: threadHeight ?? "auto" }} transition={reduced ? { duration: 0 } : SPRING}>
                  <div ref={measure}>
                    <ol className={styles.thread}>
                      <AnimatePresence initial={false} mode="popLayout">
                        {rows.map(row => (
                          <motion.li
                            key={row.key} className={styles.row} data-kind={row.kind} data-node={row.node ? "true" : undefined}
                            style={{ paddingTop: row.gap, "--gap": `${row.gap}px` } as CSSProperties}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0 } }} transition={{ duration: reduced ? 0 : 0.16 }}
                          >
                            <div className={styles.gutter} aria-hidden="true">{row.gutter}</div>
                            <div className={styles.body}>{row.body}</div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {onSend && (
        <form className={styles.composer} onSubmit={submit}>
          <input className={styles.input} placeholder={hint} aria-label="Message" enterKeyHint="send" autoComplete="off" value={draft} onChange={event => setDraft(event.target.value)} />
          <Button variant="primary" size="sm" className={styles.send} type="submit" aria-label="Send" disabled={!draft.trim()}><ArrowUp size={16} strokeWidth={2} aria-hidden /></Button>
        </form>
      )}
      <p className={styles.srOnly} role="status" aria-live="polite">{notice}</p>
    </section>
  );
}

function SimulatedHandoff(props: AgentHandoffProps) {
  const reduced = !!useReducedMotion();
  const sim = useHandoffSimulation({ scenario: props.scenario ?? "handoff", reduced });
  return (
    <HandoffView
      title="Order NW-48213" subtitle="Northwind Home support" logo={<NorthwindMark />} agent={SAMPLE_AGENT} {...props}
      stage={sim.stage} messages={sim.messages} agentMessages={sim.agentMessages} typing={sim.typing} summary={sim.summary} notice={sim.notice} empty={sim.empty}
      onSend={sim.onSend} onRequestHuman={sim.onRequestHuman} onCancelTransfer={sim.onCancelTransfer} onRetry={sim.onRetry} onReplay={sim.replay}
    />
  );
}

export function AgentHandoff(props: AgentHandoffProps) {
  if (props.stage === undefined) return <SimulatedHandoff {...props} />;
  return <HandoffView {...props} stage={props.stage} />;
}

export default AgentHandoff;
