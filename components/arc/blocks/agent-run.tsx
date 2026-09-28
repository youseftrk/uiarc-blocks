"use client";

import {
  Check,
  ChevronDown,
  CircleCheck,
  FilePen,
  FileText,
  FlaskConical,
  GitPullRequest,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import Image from "next/image";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatedCounter } from "../animated-counter";
import { motionTokens as T, cx } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./agent-run.module.css";

type ThinkStep = { id: string; kind: "think"; running: string; done: string; duration: number; tokens: number; text: string };
type SearchStep = {
  id: string;
  kind: "search";
  running: string;
  done: string;
  duration: number;
  tokens: number;
  query: string;
  scope: string;
  hits: { file: string; line: number; text: string }[];
};
type ReadStep = {
  id: string;
  kind: "read";
  running: string;
  done: string;
  duration: number;
  tokens: number;
  path: string;
  lines: { n: number; text: string }[];
};
type EditStep = {
  id: string;
  kind: "edit";
  running: string;
  done: string;
  duration: number;
  tokens: number;
  path: string;
  diff: { kind: "same" | "add" | "remove"; n: number; text: string }[];
};
type TestStep = {
  id: string;
  kind: "test";
  running: string;
  done: string;
  duration: number;
  tokens: number;
  command: string;
  passed: number;
  results: { file: string; name: string; time: string }[];
};
type Step = ThinkStep | SearchStep | ReadStep | EditStep | TestStep;

const STEPS: Step[] = [
  {
    id: "plan",
    kind: "think",
    running: "Thinking",
    done: "Planned the investigation",
    duration: 2400,
    tokens: 420,
    text: "A double charge that only happens on timeouts points at the retry path. If each retry sends the gateway a fresh idempotency key, the gateway has no way to tell a retry from a new charge. I'll find where the key is created.",
  },
  {
    id: "search",
    kind: "search",
    running: "Searching the codebase",
    done: "Searched for idempotencyKey",
    duration: 1700,
    tokens: 910,
    query: "idempotencyKey",
    scope: "src/payments",
    hits: [
      { file: "retry.ts", line: 40, text: "const idempotencyKey = crypto.randomUUID();" },
      { file: "gateway.ts", line: 18, text: 'headers["Idempotency-Key"] = idempotencyKey;' },
      { file: "charge.test.ts", line: 73, text: "expect(gateway.charge).toHaveBeenCalledTimes(1);" },
    ],
  },
  {
    id: "read",
    kind: "read",
    running: "Reading retry.ts",
    done: "Read src/payments/retry.ts",
    duration: 1900,
    tokens: 2640,
    path: "src/payments/retry.ts",
    lines: [
      { n: 36, text: "export async function chargeWithRetry(order: Order, attempts = 3) {" },
      { n: 37, text: "  let lastError: unknown;" },
      { n: 38, text: "  for (let attempt = 1; attempt <= attempts; attempt++) {" },
      { n: 39, text: "    try {" },
      { n: 40, text: "      const idempotencyKey = crypto.randomUUID();" },
      { n: 41, text: "      return await gateway.charge(order, { idempotencyKey });" },
      { n: 42, text: "    } catch (error) {" },
      { n: 43, text: "      lastError = error;" },
      { n: 44, text: "      if (!isTimeout(error)) throw error;" },
      { n: 45, text: "      await sleep(backoff(attempt));" },
      { n: 46, text: "    }" },
      { n: 47, text: "  }" },
    ],
  },
  {
    id: "cause",
    kind: "think",
    running: "Thinking",
    done: "Found the cause",
    duration: 2100,
    tokens: 380,
    text: "Line 40 creates a new key inside the loop, so every attempt after a timeout looks like a brand-new charge. The key belongs to the order, not the attempt: create it once, before the loop, and reuse it.",
  },
  {
    id: "edit",
    kind: "edit",
    running: "Editing retry.ts",
    done: "Edited src/payments/retry.ts",
    duration: 1800,
    tokens: 1240,
    path: "src/payments/retry.ts",
    diff: [
      { kind: "same", n: 36, text: "export async function chargeWithRetry(order: Order, attempts = 3) {" },
      { kind: "add", n: 37, text: "  // One key per order, so the gateway drops a repeated charge." },
      { kind: "add", n: 38, text: "  const idempotencyKey = order.idempotencyKey ?? crypto.randomUUID();" },
      { kind: "same", n: 39, text: "  let lastError: unknown;" },
      { kind: "same", n: 40, text: "  for (let attempt = 1; attempt <= attempts; attempt++) {" },
      { kind: "same", n: 41, text: "    try {" },
      { kind: "remove", n: 40, text: "      const idempotencyKey = crypto.randomUUID();" },
      { kind: "same", n: 42, text: "      return await gateway.charge(order, { idempotencyKey });" },
    ],
  },
  {
    id: "test",
    kind: "test",
    running: "Running payment tests",
    done: "Ran payment tests",
    duration: 3300,
    tokens: 1680,
    command: "npm test -- src/payments",
    passed: 24,
    results: [
      { file: "charge.test.ts", name: "charges a new order once", time: "38 ms" },
      { file: "charge.test.ts", name: "reuses the key when the gateway times out", time: "412 ms" },
      { file: "charge.test.ts", name: "stops after three attempts", time: "1.2 s" },
      { file: "refund.test.ts", name: "refunds the captured amount", time: "22 ms" },
      { file: "webhook.test.ts", name: "ignores a duplicate charge.succeeded event", time: "17 ms" },
    ],
  },
  {
    id: "summary",
    kind: "think",
    running: "Writing the summary",
    done: "Wrote the summary",
    duration: 1500,
    tokens: 520,
    text: "The fix is one moved line and a comment. Every payment test passes, including the timeout retry case that now asserts a single charge.",
  },
];

const WINDOWS = STEPS.reduce<{ start: number; end: number }[]>((acc, step) => {
  const start = acc.length ? acc[acc.length - 1].end : 0;
  return [...acc, { start, end: start + step.duration }];
}, []);
const TOTAL = WINDOWS[WINDOWS.length - 1].end;
const EDIT_INDEX = STEPS.findIndex((s) => s.kind === "edit");
const APPROVAL_AT = WINDOWS[EDIT_INDEX].end;
const HEADLINE = "Retries reuse one idempotency key";
const seconds = (ms: number) => `${(ms / 1e3).toFixed(1)}s`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type Phase = "idle" | "running" | "paused" | "waiting" | "done" | "stopped";
type RunState = { clock: number; phase: Phase; approved: boolean };
type Status = "active" | "done" | "waiting" | "rejected";
const INITIAL: RunState = { clock: 0, phase: "idle", approved: false };
const PHASE_LABEL: Record<Phase, string> = {
  idle: "Starting",
  running: "Working",
  paused: "Paused",
  waiting: "Waiting for approval",
  done: "Done",
  stopped: "Stopped",
};
const ICONS: Record<Step["kind"], LucideIcon> = {
  think: Sparkles,
  search: Search,
  read: FileText,
  edit: FilePen,
  test: FlaskConical,
};

function useMotionPrefs() {
  const reduce = useReducedMotion();
  return { reduce, panel: reduce ? { duration: 0 } : T.spring.smooth };
}

function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const { panel } = useMotionPrefs();
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={styles.autoHeight} initial={false} animate={{ height }} transition={panel}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </motion.div>
  );
}

function Stack({ on, a, b }: { on: "a" | "b"; a: ReactNode; b: ReactNode }) {
  return (
    <span className={styles.stack}>
      <span data-on={on === "a" || undefined} aria-hidden={on !== "a" || undefined}>
        {a}
      </span>
      <span data-on={on === "b" || undefined} aria-hidden={on !== "b" || undefined}>
        {b}
      </span>
    </span>
  );
}

function Swap({ text, className }: { text: string; className?: string }) {
  const { reduce } = useMotionPrefs();
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className={className}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.25em" }}
          animate={{ opacity: 1, y: "0em" }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: "-0.2em", transition: { duration: T.duration.fast } }
          }
          transition={
            reduce
              ? { duration: T.duration.instant }
              : { duration: T.duration.standard, ease: T.ease.enter }
          }
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Thought({ text, progress }: { text: string; progress: number }) {
  const words = text.split(" ");
  const shown = Math.ceil(progress * words.length);
  return (
    <AutoHeight>
      <p className={styles.thought}>
        {words.slice(0, shown).map((word, i) => (
          <span key={i} className={styles.word}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </AutoHeight>
  );
}

function StepDetail({
  step,
  status,
  progress,
  onApprove,
  onReject,
}: {
  step: Step;
  status: Status;
  progress: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const settled = status !== "active";
  const reveal = (count: number, from = 0) =>
    settled ? count : Math.min(count, Math.floor(clamp01((progress - from) / (1 - from)) * (count + 1)));

  if (step.kind === "think") return <Thought text={step.text} progress={settled ? 1 : progress} />;

  if (step.kind === "search") {
    const hits = step.hits.slice(0, reveal(step.hits.length, 0.2));
    return (
      <div className={styles.detailBody}>
        <p className={styles.args}>
          <span className={styles.muted}>Query</span> <code>{step.query}</code>{" "}
          <span className={styles.muted}>in</span> <code>{step.scope}</code>
        </p>
        <ul className={styles.hits}>
          {hits.map((hit) => (
            <li key={hit.file} className={styles.line}>
              <span className={styles.hitFile}>
                {hit.file}
                <span className={styles.muted}>:{hit.line}</span>
              </span>
              <code className={styles.hitText}>{hit.text}</code>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (step.kind === "read") {
    const lines = step.lines.slice(0, reveal(step.lines.length, 0.1));
    return (
      <div className={styles.detailBody}>
        <p className={styles.args}>
          <code>{step.path}</code>{" "}
          <span className={styles.muted}>
            lines {step.lines[0].n}–{step.lines[step.lines.length - 1].n}
          </span>
        </p>
        <pre className={styles.code}>
          {lines.map((line) => (
            <span key={line.n} className={styles.line} data-hot={line.n === 40 || undefined}>
              <span className={styles.gutter}>{line.n}</span>
              <span className={styles.src}>{line.text}</span>
            </span>
          ))}
        </pre>
      </div>
    );
  }

  if (step.kind === "edit") {
    const rows = step.diff.slice(0, reveal(step.diff.length, 0.15));
    const added = step.diff.filter((d) => d.kind === "add").length;
    const removed = step.diff.filter((d) => d.kind === "remove").length;
    return (
      <div className={styles.detailBody}>
        <p className={styles.args}>
          <code>{step.path}</code> <span className={styles.added}>+{added}</span>{" "}
          <span className={styles.removed}>−{removed}</span>
        </p>
        <pre className={styles.code} data-rejected={status === "rejected" || undefined}>
          {rows.map((row, i) => (
            <span key={i} className={styles.line} data-kind={row.kind}>
              <span className={styles.gutter}>{row.kind === "remove" ? "" : row.n}</span>
              <span className={styles.sign} aria-hidden="true">
                {row.kind === "add" ? "+" : row.kind === "remove" ? "−" : ""}
              </span>
              <span className={styles.src}>
                <span className={styles.srOnly}>
                  {row.kind === "add" ? "Added: " : row.kind === "remove" ? "Removed: " : ""}
                </span>
                {row.text}
              </span>
            </span>
          ))}
        </pre>
        <AnimatePresence initial={false} mode="popLayout">
          {status === "waiting" && (
            <motion.div
              key="ask"
              className={styles.approval}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: T.duration.fast } }}
              transition={{ duration: T.duration.standard, ease: T.ease.enter }}
            >
              <span className={styles.approvalText}>Apply this change to retry.ts?</span>
              <span className={styles.approvalActions}>
                <button type="button" className={styles.ghost} onClick={onReject}>
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  Reject
                </button>
                <button type="button" className={styles.primary} onClick={onApprove}>
                  <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  Approve
                </button>
              </span>
            </motion.div>
          )}
          {status === "done" && (
            <motion.p
              key="yes"
              className={styles.verdict}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: T.duration.standard }}
            >
              <Check size={14} strokeWidth={1.75} aria-hidden="true" />
              Approved by you
            </motion.p>
          )}
          {status === "rejected" && (
            <motion.p
              key="no"
              className={styles.verdict}
              data-tone="danger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: T.duration.standard }}
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
              Rejected, nothing was written
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const results = step.results.slice(0, reveal(step.results.length, 0.12));
  const passed = settled ? step.passed : Math.floor(clamp01((progress - 0.12) / 0.88) * step.passed);
  return (
    <div className={styles.detailBody}>
      <p className={styles.args}>
        <span className={styles.muted}>$</span> <code>{step.command}</code>
      </p>
      <ul className={styles.hits}>
        {results.map((result) => (
          <li key={result.name} className={styles.line}>
            <span className={styles.pass}>
              <Check size={14} strokeWidth={2} aria-label="Passed" />
            </span>
            <span className={styles.testName}>
              <span className={styles.muted}>{result.file} ›</span> {result.name}
            </span>
            <span className={styles.testTime}>{result.time}</span>
          </li>
        ))}
      </ul>
      <p className={styles.tally}>
        <span className={styles.tallyCount}>
          <AnimatedCounter value={passed} />
        </span>
        <span>of {step.passed} tests passed</span>
      </p>
    </div>
  );
}

const StepItem = memo(function StepItem({
  step,
  status,
  progress,
  open,
  auto,
  paused,
  ids,
  onToggle,
  onApprove,
  onReject,
  isLast,
}: {
  step: Step;
  status: Status;
  progress: number;
  open: boolean;
  auto: boolean;
  paused: boolean;
  ids: string;
  onToggle: (id: string, auto: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  isLast: boolean;
}) {
  const { reduce, panel } = useMotionPrefs();
  const Icon = ICONS[step.kind];
  const detailsId = `${ids}-${step.id}-details`;
  const title =
    status === "done"
      ? step.done
      : status === "waiting"
        ? "Waiting for approval"
        : status === "rejected"
          ? "Change rejected"
          : step.running;
  const fill = status === "active" ? progress : status === "rejected" ? 0 : 1;

  return (
    <motion.li
      className={styles.step}
      data-status={status}
      data-paused={paused || undefined}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={
        reduce ? { duration: T.duration.instant } : { height: panel, opacity: { duration: T.duration.standard } }
      }
    >
      <div className={styles.rail} aria-hidden="true">
        <span className={styles.node}>
          <Icon size={14} strokeWidth={1.75} />
        </span>
        {!isLast && (
          <span className={styles.track}>
            <motion.span className={styles.fill} initial={false} animate={{ scaleY: fill }} transition={panel} />
          </span>
        )}
      </div>
      <div className={styles.stepMain}>
        <button
          type="button"
          id={`${ids}-${step.id}-toggle`}
          className={styles.stepHead}
          aria-expanded={open}
          aria-controls={open ? detailsId : undefined}
          onClick={() => onToggle(step.id, auto)}
        >
          <Swap
            text={title}
            className={status !== "active" || paused ? styles.stepTitle : cx(styles.stepTitle, styles.shimmer)}
          />
          <span className={styles.stepMeta}>
            {status === "done" ? seconds(step.duration) : status === "active" ? seconds(progress * step.duration) : ""}
          </span>
          <ChevronDown className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="details"
              id={detailsId}
              role="region"
              aria-label={`${step.done} details`}
              className={styles.details}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { height: panel, opacity: { duration: T.duration.standard } }}
            >
              <div className={styles.detailPad}>
                <StepDetail step={step} status={status} progress={progress} onApprove={onApprove} onReject={onReject} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
});

function tick(state: RunState, delta: number): RunState {
  if (state.phase !== "running" && state.phase !== "idle") return state;
  const clock = state.clock + delta;
  if (!state.approved && clock >= APPROVAL_AT) return { ...state, clock: APPROVAL_AT, phase: "waiting" };
  if (clock >= TOTAL) return { ...state, clock: TOTAL, phase: "done" };
  return { ...state, clock, phase: "running" };
}

export function AgentRun() {
  const { reduce, panel } = useMotionPrefs();
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rootRef = useRef<HTMLElement>(null);
  const started = useInView(rootRef, { once: true, amount: 0.35 });
  const visible = useInView(rootRef, { amount: 0 });
  const [state, setState] = useState<RunState>(INITIAL);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [showTimeline, setShowTimeline] = useState(false);
  const [pr, setPr] = useState<"idle" | "opening" | "opened">("idle");
  const prTimer = useRef<number | undefined>(undefined);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const phase: Phase = state.phase === "idle" && started ? "running" : state.phase;
  const ticking = phase === "running" && visible;

  useEffect(() => {
    if (!ticking) return;
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = document.hidden ? 0 : Math.min(now - last, 200);
      last = now;
      if (delta > 0) setState((s) => tick(s, delta));
    }, 60);
    return () => window.clearInterval(interval);
  }, [ticking]);
  useEffect(() => () => window.clearTimeout(prTimer.current), []);

  const focusToggle = useCallback(
    (id: string) =>
      requestAnimationFrame(() =>
        document.getElementById(`${ids}-${id}-toggle`)?.focus({ preventScroll: true }),
      ),
    [ids],
  );
  const restart = () => {
    window.clearTimeout(prTimer.current);
    setState({ ...INITIAL, phase: "running" });
    setOpenMap({});
    setShowTimeline(false);
    setPr("idle");
    requestAnimationFrame(() => pauseRef.current?.focus({ preventScroll: true }));
  };
  const approve = useCallback(() => {
    setState((s) => ({ ...s, approved: true, phase: "running" }));
    focusToggle(STEPS[EDIT_INDEX].id);
  }, [focusToggle]);
  const reject = useCallback(() => {
    setState((s) => ({ ...s, phase: "stopped" }));
    focusToggle(STEPS[EDIT_INDEX].id);
  }, [focusToggle]);
  const toggle = useCallback(
    (id: string, auto: boolean) => setOpenMap((m) => ({ ...m, [id]: !(m[id] ?? auto) })),
    [],
  );

  const { clock, approved } = state;
  const finished = phase === "done" || phase === "stopped";
  const visibleSteps =
    phase === "idle"
      ? []
      : STEPS.map((step, i) => ({ step, i })).filter(({ i }) => i === 0 || clock > WINDOWS[i].start);
  const current = visibleSteps[visibleSteps.length - 1];
  const timelineOpen = !finished || showTimeline;
  const bucket = 300 * Math.floor(clock / 300);
  const tokens = STEPS.reduce((sum, step, i) => {
    const { start, end } = WINDOWS[i];
    return sum + Math.round(step.tokens * clamp01((bucket - start) / (end - start)));
  }, 0);
  const elapsed = seconds(clock);
  const live =
    phase === "waiting"
      ? "Waiting for your approval to edit src/payments/retry.ts"
      : phase === "done"
        ? `Run finished in ${elapsed}. ${HEADLINE}.`
        : phase === "stopped"
          ? "Run stopped. The change was rejected and nothing was written."
          : phase === "paused"
            ? "Run paused"
            : current
              ? current.step.running
              : "";

  return (
    <section ref={rootRef} className={styles.root} aria-labelledby={`${ids}-title`}>
      <header className={styles.request}>
        <div className={styles.byline}>
          <Image className={styles.avatar} src="/media/people/olivia-bennett.jpg" alt="" width={28} height={28} />
          <span className={styles.author} id={`${ids}-title`}>
            Olivia Bennett
          </span>
          <span className={styles.muted}>northwind/checkout</span>
        </div>
        <p className={styles.prompt}>
          Customers are being charged twice when the payment gateway times out. Find the cause in the
          retry logic, fix it, and make sure the payment tests pass.
        </p>
      </header>
      <div className={styles.toolbar}>
        <span className={styles.status} data-phase={phase}>
          <span className={styles.dot} aria-hidden="true" />
          <Swap text={PHASE_LABEL[phase]} />
        </span>
        <span className={styles.counters}>
          <span className={styles.counter}>
            <span className={styles.srOnly}>Time</span>
            {elapsed}
          </span>
          <span className={styles.counter}>
            <span className={styles.tokens}>
              <AnimatedCounter value={tokens} />
            </span>{" "}
            tokens
          </span>
        </span>
        <span className={styles.controls}>
          <button
            ref={pauseRef}
            type="button"
            className={styles.ghost}
            onClick={() =>
              setState((s) =>
                s.phase === "running" || s.phase === "idle"
                  ? { ...s, phase: "paused" }
                  : s.phase === "paused"
                    ? { ...s, phase: "running" }
                    : s,
              )
            }
            disabled={phase !== "running" && phase !== "paused"}
          >
            <Stack
              on={phase === "paused" ? "b" : "a"}
              a={
                <>
                  <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
                  Pause
                </>
              }
              b={
                <>
                  <Play size={16} strokeWidth={1.75} aria-hidden="true" />
                  Resume
                </>
              }
            />
          </button>
          <button type="button" className={styles.iconButton} onClick={restart} aria-label="Restart run" title="Restart run">
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className={styles.run}>
        <AnimatePresence initial={false}>
          {finished && (
            <motion.div
              key="summary"
              className={styles.summaryWrap}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { height: panel, opacity: { duration: T.duration.standard } }}
            >
              <button type="button" className={styles.summary} aria-expanded={showTimeline} onClick={() => setShowTimeline((v) => !v)}>
                <span>Worked for {elapsed}</span>
                <span className={styles.muted}>
                  {visibleSteps.length} steps · {tokens.toLocaleString("en-US")} tokens
                </span>
                <ChevronDown className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          className={styles.timelineWrap}
          initial={false}
          animate={{ height: timelineOpen ? "auto" : 0, opacity: timelineOpen ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { height: panel, opacity: { duration: T.duration.standard } }}
          inert={!timelineOpen}
        >
          <ol className={styles.timeline} aria-label="Steps">
            <AnimatePresence initial={false}>
              {visibleSteps.map(({ step, i }, position) => {
                const status: Status =
                  i === EDIT_INDEX && phase === "stopped"
                    ? "rejected"
                    : i === EDIT_INDEX && phase === "waiting"
                      ? "waiting"
                      : clock >= WINDOWS[i].end && (i !== EDIT_INDEX || approved)
                        ? "done"
                        : "active";
                const auto = status === "active" || status === "waiting" || status === "rejected";
                return (
                  <StepItem
                    key={step.id}
                    step={step}
                    ids={ids}
                    status={status}
                    isLast={position === visibleSteps.length - 1 && finished}
                    progress={status === "active" ? clamp01((clock - WINDOWS[i].start) / step.duration) : 1}
                    paused={phase === "paused"}
                    open={status === "waiting" || (openMap[step.id] ?? auto)}
                    auto={auto}
                    onToggle={toggle}
                    onApprove={approve}
                    onReject={reject}
                  />
                );
              })}
            </AnimatePresence>
          </ol>
        </motion.div>
        <AnimatePresence initial={false}>
          {finished && (
            <motion.div
              key={phase}
              className={styles.resultWrap}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={
                reduce
                  ? { duration: T.duration.instant }
                  : { height: panel, opacity: { duration: T.duration.considered, ease: T.ease.enter } }
              }
            >
              <motion.div
                className={styles.result}
                data-tone={phase === "done" ? "success" : "danger"}
                initial={reduce ? false : { y: 10, scale: 0.985 }}
                animate={{ y: 0, scale: 1 }}
                transition={reduce ? { duration: 0 } : T.spring.smooth}
              >
                {phase === "done" ? (
                  <>
                    <h3 className={styles.resultTitle}>
                      <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
                      {HEADLINE}
                    </h3>
                    <p className={styles.resultBody}>
                      chargeWithRetry created a new key on every attempt, so a gateway timeout followed by a
                      retry charged the card again. The key is now created once per order, and all 24 payment
                      tests pass.
                    </p>
                    <dl className={styles.facts}>
                      <div>
                        <dt>Files changed</dt>
                        <dd>1</dd>
                      </div>
                      <div>
                        <dt>Lines</dt>
                        <dd>
                          <span className={styles.added}>+2</span> <span className={styles.removed}>−1</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Tests</dt>
                        <dd>24 passed</dd>
                      </div>
                      <div>
                        <dt>Tokens</dt>
                        <dd>{tokens.toLocaleString("en-US")}</dd>
                      </div>
                    </dl>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => {
                          if (pr !== "idle") return;
                          setPr("opening");
                          prTimer.current = window.setTimeout(() => setPr("opened"), 1100);
                        }}
                        aria-disabled={pr !== "idle" || undefined}
                        data-state={pr}
                      >
                        <span className={styles.stack3}>
                          <span data-on={pr === "idle" || undefined} aria-hidden={pr !== "idle" || undefined}>
                            <GitPullRequest size={16} strokeWidth={1.75} aria-hidden="true" />
                            Open pull request
                          </span>
                          <span data-on={pr === "opening" || undefined} aria-hidden={pr !== "opening" || undefined}>
                            <LoaderCircle className={styles.spin} size={16} strokeWidth={1.75} aria-hidden="true" />
                            Opening
                          </span>
                          <span data-on={pr === "opened" || undefined} aria-hidden={pr !== "opened" || undefined}>
                            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                            Draft #482 opened
                          </span>
                        </span>
                      </button>
                      <button type="button" className={styles.ghost} onClick={restart}>
                        <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                        Run again
                      </button>
                    </div>
                    <p className={styles.srOnly} aria-live="polite">
                      {pr === "opened" ? "Draft pull request 482 opened." : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className={styles.resultTitle}>
                      <X size={20} strokeWidth={1.75} aria-hidden="true" />
                      Run stopped
                    </h3>
                    <p className={styles.resultBody}>
                      You rejected the change to retry.ts, so nothing was written. The diagnosis above still
                      stands, and the agent can propose the edit again.
                    </p>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => {
                          setState({ clock: WINDOWS[EDIT_INDEX].start, phase: "running", approved: false });
                          setOpenMap((m) => ({ ...m, [STEPS[EDIT_INDEX].id]: true }));
                          focusToggle(STEPS[EDIT_INDEX].id);
                        }}
                      >
                        <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                        Retry the edit
                      </button>
                      <button type="button" className={styles.ghost} onClick={restart}>
                        Start over
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {live}
      </p>
    </section>
  );
}
