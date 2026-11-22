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
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CircleAlert,
  Download,
  KeyRound,
  Landmark,
  LayoutGrid,
  Link2,
  MessageSquare,
  Plus,
  Receipt,
  RotateCw,
  ScrollText,
  Search,
  Settings,
  SunMoon,
  Undo2,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { ClaudeMark, GitHubMark, LinearMark, NotionMark, SlackMark, StripeMark } from "./marks";
import styles from "./ai-command.module.css";

export type AiCommandMode = "search" | "ask";

export interface AiCommandItem {
  id: string;
  label: string;
  group?: string;
  icon?: ReactNode;
  meta?: string;
  shortcut?: string[];
  keywords?: string[];
  suggested?: boolean;
  onSelect?: () => void;
}

export interface AiCommandSource {
  id: string;
  title: string;
  description?: string;
  mark?: ReactNode;
  href?: string;
}

export interface AiCommandAction {
  id: string;
  label: string;
  meta?: string;
  mark?: ReactNode;
  run?: (signal: AbortSignal) => Promise<string | void>;
  runningLabel?: string;
  doneLabel?: string;
  errorLabel?: string;
  doneMeta?: string;
}

export interface AiCommandAnswer {
  text?: string;
  sources?: AiCommandSource[];
  actions?: AiCommandAction[];
}

export interface AiCommandAskContext {
  signal: AbortSignal;
  append: (delta: string) => void;
  setSources: (sources: AiCommandSource[]) => void;
}

export type AiCommandAsk = (question: string, context: AiCommandAskContext) => Promise<AiCommandAnswer | void>;

export interface AiCommandProps {
  items?: AiCommandItem[];
  onSelect?: (item: AiCommandItem) => void;
  onAsk?: AiCommandAsk;
  onAction?: (action: AiCommandAction, result: string) => void;
  onSourceSelect?: (source: AiCommandSource) => void;
  suggestedQuestions?: string[];
  model?: { name: string; mark?: ReactNode };
  defaultMode?: AiCommandMode;
  defaultQuery?: string;
  onModeChange?: (mode: AiCommandMode) => void;
  onClose?: () => void;
  placeholder?: { search?: string; ask?: string };
  thinkingLabel?: string;
  autoPlay?: boolean;
  hotkey?: boolean;
  height?: number;
  elevated?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const lucide = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export const sampleItems: AiCommandItem[] = [
  { id: "dashboard", label: "Dashboard", group: "Pages", icon: <LayoutGrid {...lucide} />, shortcut: ["G", "D"], suggested: true },
  { id: "invoices", label: "Invoices", group: "Pages", icon: <Receipt {...lucide} />, shortcut: ["G", "I"], suggested: true },
  { id: "customers", label: "Customers", group: "Pages", icon: <Users {...lucide} />, shortcut: ["G", "C"], suggested: true },
  { id: "payouts", label: "Payouts", group: "Pages", icon: <Landmark {...lucide} />, shortcut: ["G", "P"] },
  { id: "billing-settings", label: "Billing settings", group: "Pages", icon: <Settings {...lucide} />, meta: "Settings", keywords: ["plan", "tax"] },
  { id: "audit-log", label: "Audit log", group: "Pages", icon: <ScrollText {...lucide} />, meta: "Settings", keywords: ["history", "events"] },
  { id: "api-keys", label: "API keys", group: "Pages", icon: <KeyRound {...lucide} />, meta: "Developers", keywords: ["token", "secret"] },
  { id: "webhooks", label: "Webhooks", group: "Pages", icon: <Webhook {...lucide} />, meta: "Developers", keywords: ["endpoint", "events"] },
  { id: "create-invoice", label: "Create invoice", group: "Actions", icon: <Plus {...lucide} />, shortcut: ["C"], suggested: true },
  { id: "invite", label: "Invite teammate", group: "Actions", icon: <UserPlus {...lucide} />, shortcut: ["Ctrl", "Shift", "I"], suggested: true },
  { id: "theme", label: "Switch theme", group: "Actions", icon: <SunMoon {...lucide} />, shortcut: ["Ctrl", "Shift", "L"], suggested: true, keywords: ["dark", "light", "appearance"] },
  { id: "refund", label: "Refund a payment", group: "Actions", icon: <Undo2 {...lucide} /> },
  { id: "export", label: "Export invoices as CSV", group: "Actions", icon: <Download {...lucide} />, keywords: ["download"] },
  { id: "copy-link", label: "Copy page link", group: "Actions", icon: <Link2 {...lucide} />, shortcut: ["Ctrl", "Shift", "C"], keywords: ["url", "share"] },
  { id: "linear", label: "Search Linear issues", group: "Connected apps", icon: <LinearMark />, meta: "Billing team", suggested: true },
  { id: "notion", label: "Open Notion", group: "Connected apps", icon: <NotionMark />, meta: "Acme wiki", suggested: true, keywords: ["docs"] },
  { id: "github", label: "acme/billing-api", group: "Connected apps", icon: <GitHubMark />, meta: "GitHub", suggested: true, keywords: ["repo", "code"] },
  { id: "slack", label: "#eng-billing", group: "Connected apps", icon: <SlackMark />, meta: "Slack", suggested: true, keywords: ["channel"] },
  { id: "stripe", label: "Stripe dashboard", group: "Connected apps", icon: <StripeMark size={16} />, meta: "Live mode", keywords: ["payments"] },
];

export const sampleQuestions = [
  "Why did EU invoices fail last night?",
  "Which invoices are overdue?",
  "Who owns the webhooks service?",
];

const sampleSources: AiCommandSource[] = [
  { id: "stripe", title: "212 declines", description: "Stripe events, 27 Oct 02:00 to 02:40 CET, authentication_required", mark: <StripeMark size={14} /> },
  { id: "github", title: "billing-api #1893", description: "GitHub pull request: Skip 3-D Secure for saved cards, merged 26 Oct", mark: <GitHubMark size={14} /> },
  { id: "slack", title: "#eng-billing", description: "Slack, Maya Chen at 08:15: flag off, retry queued for 14:00", mark: <SlackMark size={14} /> },
  { id: "notion", title: "Failed renewals", description: "Notion runbook: Failed renewals and dunning", mark: <NotionMark size={14} /> },
];

const sampleText =
  "Stripe declined 212 of 1,348 EU renewals between 02:00 and 02:40 CET, all with authentication_required[1]. billing-api v4.12 started skipping 3-D Secure for saved cards, which EU issuers still require under SCA, so the nightly retry charged those cards without a challenge[2]. Maya Chen turned the flag off at 08:15 and queued the 212 invoices for another attempt at 14:00 today[3]. Dunning emails are paused, so no customer has been told yet[4].";

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function chunkWords(text: string) {
  const words = text.split(" ");
  const out: string[] = [];
  let i = 0;
  let n = 0;
  while (i < words.length) {
    const size = 3 + ((n * 7 + 2) % 5);
    out.push((i ? " " : "") + words.slice(i, i + size).join(" "));
    i += size;
    n += 1;
  }
  return out;
}

/** The simulated engine behind the sample. `shouldFail` makes the first answer and the first run of each action fail. */
export function createSampleAsk(shouldFail: () => boolean = () => false): AiCommandAsk {
  const failed = new Set<string>();
  const failOnce = (key: string) => {
    if (!shouldFail() || failed.has(key)) return false;
    failed.add(key);
    return true;
  };
  const simulate = (key: string, ms: number, label: string) => async (signal: AbortSignal) => {
    await wait(ms, signal);
    if (failOnce(key)) throw new Error("Simulated failure");
    return label;
  };
  return async (question, { signal, append, setSources }) => {
    await wait(720, signal);
    if (failOnce(`ask:${question}`)) throw new Error("The workspace index did not respond. Press Enter to try again.");
    setSources(sampleSources);
    await wait(250, signal);
    for (const chunk of chunkWords(sampleText)) {
      append(chunk);
      await wait(34, signal);
    }
    return {
      actions: [
        { id: "linear-issue", label: "Create issue in Linear", meta: "Billing team, links 4 sources", mark: <LinearMark />, runningLabel: "Creating issue", doneLabel: "Created ENG-2481", errorLabel: "Couldn’t create the issue", doneMeta: "Simulated, nothing was sent", run: simulate("linear-issue", 970, "Created ENG-2481") },
        { id: "notion-doc", label: "Open doc in Notion", meta: "Failed renewals runbook", mark: <NotionMark />, runningLabel: "Opening doc", doneLabel: "Opened the runbook", errorLabel: "Couldn’t open the doc", doneMeta: "Simulated, no page was opened", run: simulate("notion-doc", 670, "Opened the runbook") },
        { id: "slack-post", label: "Post summary to #eng-billing", meta: "As you, with sources", mark: <SlackMark />, runningLabel: "Posting summary", doneLabel: "Posted to #eng-billing", errorLabel: "Couldn’t post the summary", doneMeta: "Simulated, nothing was posted", run: simulate("slack-post", 900, "Posted to #eng-billing") },
      ],
    };
  };
}

const KEY_NAMES: Record<string, string> = { "↑": "Up arrow", "↓": "Down arrow", Esc: "Escape", Ctrl: "Control" };

function Keys({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <kbd className={[styles.k, className].filter(Boolean).join(" ")}>
      {keys.map((key, i) => (
        <span key={i} className={styles.kSlot}>
          {i > 0 && <span className={styles.kHidden}> </span>}
          <kbd className={styles.kKey}>
            {KEY_NAMES[key] ? (
              <>
                <span aria-hidden="true">{key}</span>
                <span className={styles.kHidden}>{KEY_NAMES[key]}</span>
              </>
            ) : (
              key
            )}
          </kbd>
        </span>
      ))}
    </kbd>
  );
}

function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduced ? 0.1 : 0.16, ease: [0.2, 0, 0, 1] }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type ActionStatus = "idle" | "running" | "done" | "error";
interface ActionState {
  status: ActionStatus;
  result?: string;
}
type AnswerPhase = "idle" | "thinking" | "streaming" | "done" | "error";
interface AnswerState {
  phase: AnswerPhase;
  question: string;
  chunks: string[];
  sources: AiCommandSource[];
  actions: AiCommandAction[];
  elapsed: number;
  error?: string;
}
const emptyAnswer: AnswerState = { phase: "idle", question: "", chunks: [], sources: [], actions: [], elapsed: 0 };

interface Row {
  key: string;
  dom: string;
  group: string;
  hideHead?: boolean;
  render: (active: boolean) => ReactNode;
}

/** Queries that read as a question skip the "no matches" line and go straight to the Ask AI row. */
const QUESTION = /^(why|what|who|whom|whose|how|when|where|which|is|are|was|were|can|could|do|does|did|should|will|would)\b|\?$/i;
const CITE = /(\S*?)\[(\d+)\]([.,;:!?]?)/g;

export function AiCommand({
  items,
  onSelect,
  onAsk,
  onAction,
  onSourceSelect,
  suggestedQuestions = sampleQuestions,
  model,
  defaultMode = "search",
  defaultQuery = "",
  onModeChange,
  onClose,
  placeholder,
  thinkingLabel = "Searching your workspace",
  autoPlay,
  hotkey = false,
  height = 392,
  elevated = false,
  className,
  style,
  "aria-label": ariaLabel = "Command palette",
}: AiCommandProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const list = items ?? sampleItems;
  const modelName = model?.name ?? "Claude Sonnet 5.5";
  const customMark = model?.mark;
  const modelMark = useMemo(() => customMark ?? <ClaudeMark />, [customMark]);
  const shouldAutoPlay = (autoPlay ?? (!items && !onAsk)) && !reduced;

  const [mode, setModeState] = useState<AiCommandMode>(defaultMode);
  const [query, setQuery] = useState(defaultQuery);
  const [answer, setAnswer] = useState<AnswerState>(emptyAnswer);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [focusedSource, setFocusedSource] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [bar, setBar] = useState<{ y: number; h: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const askAbort = useRef<AbortController | null>(null);
  const actionAbort = useRef<AbortController | null>(null);
  const defaultAsk = useRef<AiCommandAsk | null>(null);
  const stopped = useRef(false);

  const view = mode === "search" ? "search" : answer.phase === "idle" ? "prompt" : "answer";
  const trimmed = query.trim();

  const setMode = useCallback(
    (next: AiCommandMode) => {
      setModeState((prev) => {
        if (prev !== next) onModeChange?.(next);
        return next;
      });
    },
    [onModeChange],
  );

  const cancel = useCallback(() => {
    askAbort.current?.abort();
    askAbort.current = null;
    actionAbort.current?.abort();
    actionAbort.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;
      cancel();
      const controller = new AbortController();
      askAbort.current = controller;
      const { signal } = controller;
      const started = performance.now();
      setMode("ask");
      setQuery(q);
      setActionStates({});
      setFocusedSource(null);
      setAnswer({ ...emptyAnswer, phase: "thinking", question: q });
      setAnnouncement(`Asking: ${q}`);
      if (!defaultAsk.current) defaultAsk.current = createSampleAsk();
      const handler = onAsk ?? defaultAsk.current;
      handler(q, {
        signal,
        append: (delta) => {
          if (signal.aborted || !delta) return;
          setAnswer((a) => ({ ...a, phase: "streaming", chunks: [...a.chunks, delta] }));
        },
        setSources: (sources) => {
          if (signal.aborted) return;
          setAnswer((a) => ({ ...a, sources }));
        },
      }).then(
        (result) => {
          if (signal.aborted) return;
          const actions = result?.actions ?? [];
          setAnswer((a) => ({
            ...a,
            phase: "done",
            chunks: result?.text && !a.chunks.length ? [result.text] : a.chunks,
            sources: result?.sources ?? a.sources,
            actions,
            elapsed: performance.now() - started,
          }));
          setAnnouncement(
            actions.length ? `Answer ready, ${actions.length} suggested ${actions.length === 1 ? "action" : "actions"}` : "Answer ready",
          );
        },
        (error: unknown) => {
          if (signal.aborted) return;
          const message = error instanceof Error && error.message ? error.message : "Something went wrong. Press Enter to try again.";
          setAnswer((a) => ({ ...a, phase: "error", chunks: [], actions: [], error: message }));
          setAnnouncement(`Couldn’t answer. ${message}`);
        },
      );
    },
    [cancel, onAsk, setMode],
  );

  const runAction = useCallback(
    (action: AiCommandAction) => {
      const controller = new AbortController();
      actionAbort.current = controller;
      setActionStates((s) => {
        const current = s[action.id]?.status ?? "idle";
        if (current === "running" || current === "done") return s;
        Promise.resolve()
          .then(() => action.run?.(controller.signal))
          .then(
            (result) => {
              if (controller.signal.aborted) return;
              const label = result || action.doneLabel || action.label;
              setActionStates((p) => ({ ...p, [action.id]: { status: "done", result: label } }));
              setAnnouncement(`${label}.${action.doneMeta ? ` ${action.doneMeta}.` : ""}`);
              onAction?.(action, label);
            },
            () => {
              if (controller.signal.aborted) return;
              setActionStates((p) => ({ ...p, [action.id]: { status: "error" } }));
              setAnnouncement(`${action.errorLabel ?? `${action.label} failed`}. Press Enter to retry.`);
            },
          );
        return { ...s, [action.id]: { status: "running" } };
      });
    },
    [onAction],
  );

  const backToSearch = useCallback(
    (clear: boolean) => {
      cancel();
      setMode("search");
      setAnswer(emptyAnswer);
      setActionStates({});
      if (clear) setQuery("");
    },
    [cancel, setMode],
  );

  const selectSource = useCallback(
    (source: AiCommandSource) => {
      if (source.href) window.open(source.href, "_blank", "noopener,noreferrer");
      else onSourceSelect?.(source);
    },
    [onSourceSelect],
  );

  /* Rows of the current view, in keyboard order. */
  const { rows, activate, emptyText, listLabel } = useMemo(() => {
    const rows: Row[] = [];
    const handlers: Record<string, () => void> = {};
    let emptyText: string | null = null;
    let listLabel = "Results";
    const askRow = (group: string, hideHead: boolean, hint: string) => {
      rows.push({
        key: "ask",
        dom: `${uid}-ask`,
        group,
        hideHead,
        render: () => (
          <>
            <span className={styles.icon}>{modelMark}</span>
            <span className={styles.label}>
              Ask <span className={styles.quoted}>“{trimmed}”</span>
            </span>
            <span className={styles.end}>
              <Keys keys={[hint]} className={styles.kbd} />
            </span>
          </>
        ),
      });
      handlers.ask = () => ask(trimmed);
    };
    if (view === "search") {
      const q = trimmed.toLowerCase();
      const hasSuggested = list.some((i) => i.suggested);
      const matches = list.filter((item) =>
        q
          ? [item.label, item.meta, item.group, ...(item.keywords ?? [])].some((t) => t?.toLowerCase().includes(q))
          : !hasSuggested || item.suggested,
      );
      const groups: string[] = [];
      for (const item of matches) if (!groups.includes(item.group ?? "")) groups.push(item.group ?? "");
      for (const group of groups) {
        for (const item of matches) {
          if ((item.group ?? "") !== group) continue;
          const key = `item:${item.id}`;
          rows.push({
            key,
            dom: `${uid}-item_${item.id}`,
            group,
            hideHead: !group,
            render: () => (
              <>
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {item.meta && <span className={styles.meta}>{item.meta}</span>}
                {item.shortcut && (
                  <span className={styles.end}>
                    <Keys keys={item.shortcut} className={styles.kbd} />
                  </span>
                )}
              </>
            ),
          });
          handlers[key] = () => {
            item.onSelect?.();
            onSelect?.(item);
          };
        }
      }
      if (q && !matches.length && !QUESTION.test(trimmed)) emptyText = `No pages or actions match “${trimmed}”`;
      if (q) askRow("Ask AI", false, "Tab");
    } else if (view === "prompt") {
      listLabel = "Questions";
      if (trimmed) askRow("", true, "Enter");
      for (const question of suggestedQuestions) {
        if (question === trimmed) continue;
        const key = `q:${question}`;
        rows.push({
          key,
          dom: `${uid}-q_${question.replace(/[^A-Za-z0-9]/g, "_")}`,
          group: "Try asking",
          render: () => (
            <>
              <span className={styles.icon}>
                <MessageSquare {...lucide} />
              </span>
              <span className={styles.label}>{question}</span>
            </>
          ),
        });
        handlers[key] = () => ask(question);
      }
    } else {
      listLabel = "Suggested actions";
      if (answer.phase === "error") {
        rows.push({
          key: "retry",
          dom: `${uid}-retry`,
          group: "",
          hideHead: true,
          render: () => (
            <>
              <span className={styles.icon}>
                <RotateCw {...lucide} />
              </span>
              <span className={styles.label}>Try again</span>
              <span className={styles.end}>
                <Keys keys={["Enter"]} className={styles.kbd} />
              </span>
            </>
          ),
        });
        handlers.retry = () => ask(answer.question);
      }
      for (const action of answer.actions) {
        const key = `action:${action.id}`;
        const state = actionStates[action.id] ?? { status: "idle" as const };
        const label =
          state.status === "running"
            ? (action.runningLabel ?? action.label)
            : state.status === "done"
              ? (state.result ?? action.doneLabel ?? action.label)
              : state.status === "error"
                ? (action.errorLabel ?? action.label)
                : action.label;
        const meta = state.status === "done" ? (action.doneMeta ?? action.meta) : state.status === "error" ? "Press Enter to retry" : action.meta;
        rows.push({
          key,
          dom: `${uid}-action_${action.id}`,
          group: "Suggested actions",
          render: () => (
            <>
              <span className={styles.icon}>{action.mark}</span>
              <span className={styles.label}>
                <Swap id={label} reduced={reduced}>
                  {label}
                </Swap>
              </span>
              {meta && (
                <span className={styles.meta}>
                  <Swap id={meta} reduced={reduced}>
                    {meta}
                  </Swap>
                </span>
              )}
              <span className={styles.end}>
                <span className={styles.statusSlot}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {state.status !== "idle" && (
                      <motion.span
                        key={state.status}
                        className={styles.statusIcon}
                        initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                      >
                        {state.status === "running" ? (
                          <svg className={styles.spinner} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.75" />
                            <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                          </svg>
                        ) : state.status === "done" ? (
                          <span className={styles.done}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <motion.path
                                d="M3.25 8.5 6.5 11.75 12.75 4.75"
                                initial={{ pathLength: reduced ? 1 : 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: 0.06 }}
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className={styles.failed}>
                            <CircleAlert {...lucide} />
                          </span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </span>
            </>
          ),
        });
        handlers[key] = () => runAction(action);
      }
    }
    return { rows, activate: (key: string) => handlers[key]?.(), emptyText, listLabel };
  }, [view, trimmed, list, suggestedQuestions, answer.phase, answer.actions, answer.question, actionStates, uid, modelMark, reduced, ask, onSelect, runAction]);

  const keys = rows.map((r) => r.key).join("\n");
  const current = rows.some((r) => r.key === activeKey) ? activeKey : (rows[0]?.key ?? null);
  const currentRow = rows.find((r) => r.key === current);

  /* The highlight follows the active row. */
  useLayoutEffect(() => {
    const root = listRef.current;
    const el = current && root ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(current)}"]`) : null;
    const next = el ? { y: el.offsetTop, h: el.offsetHeight } : null;
    setBar((prev) => (prev?.y === next?.y && prev?.h === next?.h ? prev : next));
    el?.scrollIntoView?.({ block: "nearest" });
  }, [current, keys, view, answer.phase, emptyText]);

  const move = useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const i = rows.findIndex((r) => r.key === current);
      setActiveKey(rows[(i + delta + rows.length) % rows.length].key);
    },
    [rows, current],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter":
        event.preventDefault();
        if (current) activate(current);
        else if (view === "answer" && answer.phase === "error") ask(answer.question);
        break;
      case "Tab":
        if (event.shiftKey) break;
        if (view === "search") {
          event.preventDefault();
          if (trimmed) ask(trimmed);
          else setMode("ask");
        } else if (view === "prompt") {
          event.preventDefault();
          if (trimmed) ask(trimmed);
          else setMode("search");
        }
        break;
      case "Escape":
        if (mode === "ask") {
          event.preventDefault();
          backToSearch(false);
        } else if (query) {
          event.preventDefault();
          setQuery("");
        } else onClose?.();
        break;
    }
  };

  /* Cmd/Ctrl+K focuses the input. */
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  /* Sample walkthrough: loops while on screen until the first real pointer or key press inside. */
  const stage = useRef({ ask, backToSearch, runAction });
  useEffect(() => {
    stage.current = { ask, backToSearch, runAction };
  }, [ask, backToSearch, runAction]);
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });
  useEffect(() => {
    const root = rootRef.current;
    if (!shouldAutoPlay || !root || stopped.current) return;
    let controller: AbortController | null = null;
    const question = suggestedQuestions[0] ?? "Why did EU invoices fail last night?";
    const play = async (signal: AbortSignal) => {
      const s = () => stage.current;
      const type = async (text: string) => {
        for (let i = 1; i <= text.length; i++) {
          setQuery(text.slice(0, i));
          await wait(60, signal);
        }
      };
      const until = async (test: () => boolean) => {
        while (!test()) await wait(50, signal);
      };
      for (;;) {
        s().backToSearch(false);
        await wait(240, signal);
        setQuery("");
        setActiveKey(null);
        await wait(1090, signal);
        await type("inv");
        await wait(480, signal);
        setActiveKey("item:invite");
        await wait(300, signal);
        setActiveKey("item:create-invoice");
        await wait(660, signal);
        setQuery("");
        setActiveKey(null);
        await wait(420, signal);
        await type(question);
        await wait(130, signal);
        s().ask(question);
        await until(() => answerRef.current.phase === "done" || answerRef.current.phase === "error");
        const [first, second] = answerRef.current.actions;
        if (first) {
          await wait(970, signal);
          setActiveKey(`action:${first.id}`);
          s().runAction(first);
          await wait(1870, signal);
        }
        if (second) {
          setActiveKey(`action:${second.id}`);
          await wait(420, signal);
          s().runAction(second);
          await wait(670, signal);
        }
        await wait(2000, signal);
      }
    };
    const start = () => {
      if (controller || stopped.current) return;
      controller = new AbortController();
      play(controller.signal).catch(() => {});
    };
    const halt = () => {
      controller?.abort();
      controller = null;
    };
    const stop = (event: Event) => {
      if (!event.isTrusted) return;
      stopped.current = true;
      halt();
    };
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") start();
    else {
      io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : halt()), { threshold: 0.2 });
      io.observe(root);
    }
    root.addEventListener("pointerdown", stop, true);
    root.addEventListener("keydown", stop, true);
    return () => {
      io?.disconnect();
      halt();
      root.removeEventListener("pointerdown", stop, true);
      root.removeEventListener("keydown", stop, true);
    };
  }, [shouldAutoPlay, suggestedQuestions]);

  const sourceLabel = (i: number) => {
    const source = answer.sources[i];
    return `Source ${i + 1}: ${source?.description ?? source?.title ?? ""}`;
  };

  const renderChunk = (chunk: string) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of chunk.matchAll(CITE)) {
      const n = Number(match[2]);
      const source = answer.sources[n - 1];
      parts.push(chunk.slice(last, match.index));
      parts.push(
        <span key={match.index} className={styles.nowrap}>
          {match[1]}
          <button
            type="button"
            className={styles.cite}
            aria-label={sourceLabel(n - 1)}
            data-focused={focusedSource === n - 1 || undefined}
            tabIndex={-1}
            onPointerEnter={() => setFocusedSource(n - 1)}
            onPointerLeave={() => setFocusedSource(null)}
            onClick={() => source && selectSource(source)}
          >
            {n}
          </button>
          {match[3]}
        </span>,
      );
      last = (match.index ?? 0) + match[0].length;
    }
    parts.push(chunk.slice(last));
    return parts;
  };

  const plainText = answer.chunks.join("").replace(/\[(\d+)\]/g, "");
  const statusText =
    answer.phase === "error"
      ? "Couldn’t answer"
      : answer.phase === "done"
        ? answer.sources.length
          ? `Answered from ${answer.sources.length} ${answer.sources.length === 1 ? "source" : "sources"}`
          : "Answered"
        : answer.sources.length
          ? `Reading ${answer.sources.length} ${answer.sources.length === 1 ? "source" : "sources"}`
          : thinkingLabel;
  const working = answer.phase === "thinking" || answer.phase === "streaming";

  const renderList = () => {
    const groups: { name: string; hideHead?: boolean; rows: Row[] }[] = [];
    for (const row of rows) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.name === row.group) lastGroup.rows.push(row);
      else groups.push({ name: row.group, hideHead: row.hideHead, rows: [row] });
    }
    return (
      <div className={styles.list} role="listbox" id={`${uid}-list`} aria-label={listLabel} ref={listRef}>
        <div
          className={styles.highlight}
          aria-hidden="true"
          style={{ transform: `translateY(${bar?.y ?? 0}px)`, height: bar?.h ?? 40, opacity: bar ? 1 : 0 }}
        />
        {emptyText && <div className={styles.empty}>{emptyText}</div>}
        {groups.map((group) => (
          <div key={group.name} role="group" aria-label={group.name || undefined} className={styles.group}>
            {!group.hideHead && group.name && <div className={styles.groupHead}>{group.name}</div>}
            {group.rows.map((row) => {
              const active = row.key === current;
              const status = row.key.startsWith("action:") ? (actionStates[row.key.slice(7)]?.status ?? "idle") : undefined;
              return (
                <div
                  key={row.key}
                  id={row.dom}
                  role="option"
                  aria-selected={active}
                  data-key={row.key}
                  data-active={active ? "" : undefined}
                  data-status={status}
                  className={styles.row}
                  onPointerMove={() => {
                    if (!active) setActiveKey(row.key);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setActiveKey(row.key);
                    activate(row.key);
                    inputRef.current?.focus();
                  }}
                >
                  {row.render(active)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const hintAction = view === "search" ? "Open" : view === "prompt" ? "Ask" : answer.phase === "error" ? "Retry" : "Run";
  const fade = (duration: number) => ({ duration: reduced ? 0 : duration, ease: [0.2, 0, 0, 1] as [number, number, number, number] });

  return (
    <div
      ref={rootRef}
      className={[styles.root, elevated && styles.elevated, className].filter(Boolean).join(" ")}
      style={{ "--aic-height": `${height}px`, ...style } as CSSProperties}
      data-mode={mode}
      role="search"
      aria-label={ariaLabel}
    >
      <div className={styles.bar}>
        <span className={styles.barIcon} aria-hidden="true">
          <Swap id={mode} reduced={reduced}>
            {mode === "ask" ? modelMark : <Search {...lucide} />}
          </Swap>
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          placeholder={mode === "ask" ? (placeholder?.ask ?? "Ask anything about your workspace") : (placeholder?.search ?? "Search or ask a question")}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${uid}-list`}
          aria-autocomplete="list"
          aria-label={mode === "ask" ? "Ask AI" : "Search or ask"}
          aria-activedescendant={currentRow?.dom}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveKey(null);
            if (mode === "ask" && answer.phase !== "idle") {
              cancel();
              setAnswer(emptyAnswer);
              setActionStates({});
            }
          }}
          onKeyDown={onKeyDown}
        />
        <div className={styles.modes} role="group" aria-label="Mode" data-mode={mode}>
          <span className={styles.modePill} aria-hidden="true" />
          <button
            type="button"
            className={styles.modeButton}
            aria-pressed={mode === "search"}
            onClick={() => {
              if (mode !== "search") backToSearch(false);
              inputRef.current?.focus();
            }}
          >
            Search
          </button>
          <button
            type="button"
            className={styles.modeButton}
            aria-pressed={mode === "ask"}
            onClick={() => {
              setMode("ask");
              inputRef.current?.focus();
            }}
          >
            Ask AI
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            data-view={view}
            className={styles.view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: fade(0.16) }}
            exit={{ opacity: 0, transition: fade(0.1) }}
          >
            {view === "answer" ? (
              <>
                <div className={styles.answer}>
                  <div className={styles.status}>
                    <span className={styles.icon}>
                      <Swap id={answer.phase === "error" ? "error" : "mark"} reduced={reduced}>
                        {answer.phase === "error" ? (
                          <span className={styles.failed}>
                            <CircleAlert {...lucide} />
                          </span>
                        ) : (
                          modelMark
                        )}
                      </Swap>
                    </span>
                    <Swap id={statusText} className={styles.statusLabel} reduced={reduced}>
                      {working ? <TextShimmer>{statusText}</TextShimmer> : statusText}
                    </Swap>
                    <span className={styles.statusEnd}>
                      {answer.phase === "done" && (
                        <>
                          <motion.span className={styles.elapsed} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(0.16)}>
                            {(answer.elapsed / 1000).toFixed(1)}s
                          </motion.span>
                          <motion.span className={styles.copyWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(0.16)}>
                            <CopyButton value={plainText} label="Copy answer" iconOnly variant="plain" />
                          </motion.span>
                        </>
                      )}
                    </span>
                  </div>
                  {answer.sources.length > 0 && answer.phase !== "error" && (
                    <div className={styles.sources} role="list" aria-label="Sources">
                      {answer.sources.map((source, i) => (
                        <motion.button
                          key={source.id}
                          type="button"
                          role="listitem"
                          className={styles.source}
                          title={source.description}
                          aria-label={sourceLabel(i)}
                          data-focused={focusedSource === i || undefined}
                          tabIndex={-1}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...fade(0.16), delay: reduced ? 0 : i * 0.04 }}
                          onPointerEnter={() => setFocusedSource(i)}
                          onPointerLeave={() => setFocusedSource(null)}
                          onClick={() => selectSource(source)}
                        >
                          <span className={styles.sourceNum}>{i + 1}</span>
                          {source.mark && <span className={styles.sourceMark}>{source.mark}</span>}
                          <span className={styles.sourceTitle}>{source.title}</span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                  {answer.phase === "error" ? (
                    <p className={styles.errorText}>{answer.error}</p>
                  ) : (
                    answer.chunks.length > 0 && (
                      <p className={styles.text}>
                        {answer.chunks.map((chunk, i) => (
                          <span key={i} className={styles.chunk}>
                            {renderChunk(chunk)}
                          </span>
                        ))}
                      </p>
                    )
                  )}
                </div>
                {rows.length > 0 && (
                  <motion.div className={styles.actions} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(0.16)}>
                    {renderList()}
                  </motion.div>
                )}
              </>
            ) : (
              renderList()
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.footer}>
        <Swap id={modelName} className={styles.footerStart} reduced={reduced}>
          <span className={styles.footerItem}>
            <span className={styles.footerIcon} aria-hidden="true">
              {modelMark}
            </span>
            <span className={styles.footerText}>{modelName}</span>
          </span>
        </Swap>
        <Swap id={`${view}-${hintAction}`} className={styles.hints} reduced={reduced}>
          <span className={styles.hintRow}>
            <span className={[styles.hint, styles.hintNav].join(" ")}>
              <Keys keys={["↑"]} />
              <Keys keys={["↓"]} />
              Navigate
            </span>
            <span className={styles.hint}>
              <Keys keys={["Enter"]} />
              {hintAction}
            </span>
            {view === "search" ? (
              <span className={styles.hint}>
                <Keys keys={["Tab"]} />
                Ask AI
              </span>
            ) : (
              <span className={styles.hint}>
                <Keys keys={["Esc"]} />
                Back
              </span>
            )}
          </span>
        </Swap>
      </div>
      <div className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

export default AiCommand;
