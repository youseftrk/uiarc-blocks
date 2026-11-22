"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import * as Popover from "@radix-ui/react-popover";
import {
  AlertCircle,
  Check,
  GitBranch,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  X,
} from "lucide-react";
import { Button } from "../button/button";
import { ClaudeMark, LinearMark, NotionMark } from "../ai-command/marks";
import styles from "./ai-workflow.module.css";

export type WorkflowAppId =
  | "gmail"
  | "slack"
  | "linear"
  | "claude"
  | "notion"
  | "sheets"
  | "hubspot"
  | "zendesk"
  | "github"
  | "stripe"
  | "branch";

export type WorkflowApp = WorkflowAppId | { name: string; mark: ReactNode };

export type WorkflowStepKind = "trigger" | "ai" | "action" | "branch";

export type WorkflowOutput =
  | {
      type: "email";
      from: string;
      address?: string;
      subject: string;
      preview: string;
    }
  | {
      type: "label";
      label: string;
      confidence?: number;
      reason?: string;
    }
  | {
      type: "route";
      pathId: string;
      note?: string;
    }
  | {
      type: "message";
      channel: string;
      author: string;
      text: string;
    }
  | {
      type: "record";
      id: string;
      title: string;
      meta?: string;
    }
  | {
      type: "text";
      text: string;
    };

export interface WorkflowBranchPath {
  id: string;
  label: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  kind: WorkflowStepKind;
  app: WorkflowApp;
  title: string;
  detail?: string;
  activity?: string;
  output?: WorkflowOutput;
  durationMs?: number;
  error?: string;
  paths?: WorkflowBranchPath[];
}

export type WorkflowCatalogItem = Omit<WorkflowStep, "id">;

export interface WorkflowRunContext {
  signal: AbortSignal;
  previous: Record<string, WorkflowOutput>;
  attempt: number;
}

export interface WorkflowRunResult {
  status: "passed" | "failed";
  durationMs: number;
  outputs: Record<string, WorkflowOutput>;
  failedStepId?: string;
}

export interface AiWorkflowProps {
  title?: string;
  description?: string;
  steps?: WorkflowStep[];
  defaultSteps?: WorkflowStep[];
  onStepsChange?: (steps: WorkflowStep[]) => void;
  catalog?: WorkflowCatalogItem[];
  onRunStep?: (
    step: WorkflowStep,
    context: WorkflowRunContext,
  ) => Promise<WorkflowOutput | void>;
  onRunComplete?: (result: WorkflowRunResult) => void;
  loading?: boolean;
  autoPlay?: boolean;
  editable?: boolean;
  className?: string;
}

type StepRunStatus = "idle" | "running" | "done" | "error" | "skipped";

interface StepRuntime {
  status: StepRunStatus;
  durationMs?: number;
  output?: WorkflowOutput;
  error?: string;
}

const APP_NAMES: Record<WorkflowAppId, string> = {
  gmail: "Gmail",
  slack: "Slack",
  linear: "Linear",
  claude: "Claude",
  notion: "Notion",
  sheets: "Google Sheets",
  hubspot: "HubSpot",
  zendesk: "Zendesk",
  github: "GitHub",
  stripe: "Stripe",
  branch: "Branch",
};

function GmailMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.2 4.5v7.3c0 .66.54 1.2 1.2 1.2h1.3V7.9L2.2 6.05V4.5Z" fill="#4285F4" />
      <path d="M11.3 13h1.3c.66 0 1.2-.54 1.2-1.2V4.5l-2.5 1.55V13Z" fill="#34A853" />
      <path d="M11.3 3.4v4.5l2.5-1.85V4.5c0-.99-1.13-1.56-1.92-.96L11.3 3.4Z" fill="#FBBC04" />
      <path d="M4.7 7.9V3.4L8 5.9l3.3-2.5v4.5L8 10.4 4.7 7.9Z" fill="#EA4335" />
      <path d="M2.2 4.5v1.55L4.7 7.9V3.4l-.58-.46C3.33 2.34 2.2 2.91 2.2 3.9v.6Z" fill="#C5221F" />
    </svg>
  );
}

function SlackMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.3 9.7a1.3 1.3 0 1 1-1.3-1.3h1.3v1.3Zm.65 0a1.3 1.3 0 1 1 2.6 0v3.25a1.3 1.3 0 1 1-2.6 0V9.7Z" fill="#E01E5A" />
      <path d="M6.25 4.3a1.3 1.3 0 1 1 1.3-1.3v1.3H6.25Zm0 .65a1.3 1.3 0 1 1 0 2.6H3a1.3 1.3 0 1 1 0-2.6h3.25Z" fill="#36C5F0" />
      <path d="M11.7 6.25a1.3 1.3 0 1 1 1.3 1.3h-1.3v-1.3Zm-.65 0a1.3 1.3 0 1 1-2.6 0V3a1.3 1.3 0 1 1 2.6 0v3.25Z" fill="#2EB67D" />
      <path d="M9.75 11.7a1.3 1.3 0 1 1-1.3 1.3v-1.3h1.3Zm0-.65a1.3 1.3 0 1 1 0-2.6H13a1.3 1.3 0 1 1 0 2.6H9.75Z" fill="#ECB22E" />
    </svg>
  );
}

function SheetsMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="1.75" width="11" height="12.5" rx="1.75" fill="#0F9D58" />
      <path d="M5 6.25h6M5 8.75h6M5 11.25h6M7.5 6.25v5" stroke="#fff" strokeWidth="1.1" />
    </svg>
  );
}

function HubSpotMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="8" r="2.75" stroke="#FF7A59" strokeWidth="1.6" />
      <circle cx="9.5" cy="3" r="1.2" fill="#FF7A59" />
      <circle cx="3.8" cy="11.2" r="1.4" fill="#FF7A59" />
      <circle cx="13.2" cy="12" r="1.1" fill="#FF7A59" />
      <path d="M9.5 4.2v1.1M7.3 9.4l-2.3 1.2M11.5 9.8l1 1.3" stroke="#FF7A59" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ZendeskMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 3.5h5.2L2 9.8V3.5Z" fill="currentColor" />
      <path d="M14 12.5H8.8L14 6.2v6.3Z" fill="currentColor" />
      <path d="M2 12.5a2.6 2.6 0 0 1 5.2 0H2Z" fill="currentColor" />
      <path d="M14 3.5a2.6 2.6 0 0 1-5.2 0H14Z" fill="currentColor" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 1.5a6.5 6.5 0 0 0-2.05 12.67c.32.06.44-.14.44-.31v-1.1c-1.8.39-2.18-.77-2.18-.77-.3-.75-.72-.95-.72-.95-.59-.4.04-.4.04-.4.65.05 1 .67 1 .67.58 1 1.52.71 1.9.54.06-.42.23-.71.41-.87-1.44-.16-2.95-.72-2.95-3.2 0-.71.25-1.28.67-1.74-.07-.16-.29-.82.06-1.71 0 0 .55-.18 1.8.66a6.2 6.2 0 0 1 3.26 0c1.24-.84 1.79-.66 1.79-.66.35.89.13 1.55.06 1.71.42.46.67 1.03.67 1.74 0 2.49-1.52 3.04-2.96 3.2.23.2.44.6.44 1.2v1.78c0 .17.12.38.45.31A6.5 6.5 0 0 0 8 1.5Z"
      />
    </svg>
  );
}

function StripeMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3" fill="#635BFF" />
      <path
        d="M7.35 6.45c0-.46.38-.64 1.01-.64.9 0 2.04.27 2.94.76V4.52a7.7 7.7 0 0 0-2.94-.54c-2.4 0-4 1.26-4 3.36 0 3.27 4.5 2.75 4.5 4.16 0 .54-.47.72-1.13.72-.98 0-2.23-.4-3.22-.95v2.09c1.1.47 2.21.67 3.22.67 2.46 0 4.15-1.22 4.15-3.35-.01-3.53-4.53-2.91-4.53-4.23Z"
        fill="#fff"
      />
    </svg>
  );
}

function AppMark({ app }: { app: WorkflowApp }) {
  if (typeof app !== "string") {
    return <span className={styles.mark} aria-hidden="true">{app.mark}</span>;
  }
  let icon: ReactNode;
  switch (app) {
    case "gmail":
      icon = <GmailMark />;
      break;
    case "slack":
      icon = <SlackMark />;
      break;
    case "linear":
      icon = <LinearMark />;
      break;
    case "claude":
      icon = <ClaudeMark />;
      break;
    case "notion":
      icon = <NotionMark />;
      break;
    case "sheets":
      icon = <SheetsMark />;
      break;
    case "hubspot":
      icon = <HubSpotMark />;
      break;
    case "zendesk":
      icon = <ZendeskMark />;
      break;
    case "github":
      icon = <GitHubMark />;
      break;
    case "stripe":
      icon = <StripeMark />;
      break;
    case "branch":
      icon = <GitBranch size={15} strokeWidth={1.75} aria-hidden="true" />;
      break;
  }
  return <span className={styles.mark} aria-hidden="true">{icon}</span>;
}

function getAppName(app: WorkflowApp): string {
  return typeof app === "string" ? APP_NAMES[app] : app.name;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export const workflowSampleSteps: WorkflowStep[] = [
  {
    id: "trigger-gmail",
    kind: "trigger",
    app: "gmail",
    title: "New email in Gmail",
    detail: "support@northwind.dev",
    activity: "Fetching the latest email",
    durationMs: 420,
    output: {
      type: "email",
      from: "Maya Chen",
      address: "maya.chen@ledgerline.io",
      subject: "SSO sign-in broken for our whole team since this morning",
      preview:
        "Since the 2.14 update none of our 42 seats can sign in through Okta. We demo to our board on Thursday, can someone look today?",
    },
  },
  {
    id: "ai-classify",
    kind: "ai",
    app: "claude",
    title: "Classify with Claude Sonnet 5.5",
    detail: "Urgent, billing, question or feedback",
    activity: "Reading the email",
    durationMs: 1100,
    output: {
      type: "label",
      label: "Urgent",
      confidence: 0.96,
      reason:
        "Full team lockout after the 2.14 release, 42 seats affected and a board demo on Thursday. Route to on-call now.",
    },
  },
  {
    id: "branch-route",
    kind: "branch",
    app: "branch",
    title: "Route by label",
    detail: "If label is Urgent",
    activity: "Checking the rule",
    durationMs: 260,
    output: {
      type: "route",
      pathId: "urgent",
      note: "Label is Urgent, so the email took the Urgent path.",
    },
    paths: [
      {
        id: "urgent",
        label: "Urgent",
        steps: [
          {
            id: "action-slack",
            kind: "action",
            app: "slack",
            title: "Post to #support in Slack",
            detail: "As Triage bot, mentions @oncall",
            activity: "Posting the message",
            durationMs: 540,
            output: {
              type: "message",
              channel: "#support",
              author: "Triage bot",
              text: "@oncall Urgent SSO lockout at Ledgerline (42 seats) after 2.14. Board demo Thursday.",
            },
          },
          {
            id: "action-linear",
            kind: "action",
            app: "linear",
            title: "Create Linear issue",
            detail: "Support team, priority Urgent",
            activity: "Creating the issue",
            durationMs: 700,
            output: {
              type: "record",
              id: "SUP-418",
              title: "Okta SSO sign-in broken after 2.14 (Ledgerline)",
              meta: "Urgent · Unassigned",
            },
          },
        ],
      },
      {
        id: "other",
        label: "Everything else",
        steps: [
          {
            id: "action-draft",
            kind: "ai",
            app: "claude",
            title: "Draft reply with Claude Sonnet 5.5",
            detail: "Friendly tone, cite help center",
            activity: "Writing the reply",
            durationMs: 880,
            output: {
              type: "text",
              text: "Thanks for reaching out — we received your note and routed it to our support queue. Someone will reply within a few hours.",
            },
          },
          {
            id: "action-notion",
            kind: "action",
            app: "notion",
            title: "Log to Notion inbox",
            detail: "Support triage database",
            activity: "Adding the page",
            durationMs: 490,
            output: {
              type: "record",
              id: "NOT-209",
              title: "Support email logged",
              meta: "Inbox · Normal",
            },
          },
        ],
      },
    ],
  },
];

export const workflowSampleCatalog: WorkflowCatalogItem[] = [
  {
    kind: "trigger",
    app: "gmail",
    title: "New email in Gmail",
    detail: "support@northwind.dev",
    activity: "Fetching the latest email",
    durationMs: 420,
    output: {
      type: "email",
      from: "Maya Chen",
      address: "maya.chen@ledgerline.io",
      subject: "SSO sign-in broken for our whole team since this morning",
      preview:
        "Since the 2.14 update none of our 42 seats can sign in through Okta. We demo to our board on Thursday, can someone look today?",
    },
  },
  {
    kind: "trigger",
    app: "stripe",
    title: "Payment failed in Stripe",
    detail: "invoice.payment_failed",
    activity: "Loading the invoice event",
    durationMs: 380,
    output: {
      type: "record",
      id: "in_1Qv92L",
      title: "Acme Corp · $1,480.00 past due",
      meta: "3rd attempt failed",
    },
  },
  {
    kind: "trigger",
    app: "github",
    title: "New GitHub issue",
    detail: "northwind/app · labeled bug",
    activity: "Fetching the issue",
    durationMs: 360,
    output: {
      type: "record",
      id: "#1842",
      title: "Webhook signature fails on retry",
      meta: "Opened by @jlin",
    },
  },
  {
    kind: "ai",
    app: "claude",
    title: "Draft reply with Claude Sonnet 5.5",
    detail: "Concise, cites recent release notes",
    activity: "Drafting the reply",
    durationMs: 920,
    output: {
      type: "text",
      text: "Hi Maya — we spotted an Okta SAML redirect regression in 2.14 and have on-call rolling out a hotfix now. We will follow up as soon as sign-in is green.",
    },
  },
  {
    kind: "action",
    app: "notion",
    title: "Append to Notion database",
    detail: "Escalations log",
    activity: "Creating the page",
    durationMs: 480,
    output: {
      type: "record",
      id: "ESC-104",
      title: "Ledgerline SSO lockout",
      meta: "Escalations · Active",
    },
  },
  {
    kind: "action",
    app: "sheets",
    title: "Add row in Google Sheets",
    detail: "Weekly triage metrics",
    activity: "Appending row",
    durationMs: 410,
    output: {
      type: "record",
      id: "Row 312",
      title: "Urgent · Ledgerline · Okta",
      meta: "Q4 Triage",
    },
  },
  {
    kind: "action",
    app: "hubspot",
    title: "Update HubSpot deal",
    detail: "Flag renewal risk",
    activity: "Updating contact",
    durationMs: 520,
    output: {
      type: "record",
      id: "HS-884",
      title: "Ledgerline Enterprise",
      meta: "At risk · CSM notified",
    },
  },
  {
    kind: "action",
    app: "zendesk",
    title: "Create Zendesk ticket",
    detail: "Priority High · Enterprise",
    activity: "Opening ticket",
    durationMs: 560,
    output: {
      type: "record",
      id: "ZD-7712",
      title: "Okta SSO sign-in broken",
      meta: "High · Tier 2",
    },
  },
  {
    kind: "action",
    app: "slack",
    title: "Send Slack DM",
    detail: "Notify account owner",
    activity: "Sending DM",
    durationMs: 390,
    output: {
      type: "message",
      channel: "@elena",
      author: "Triage bot",
      text: "Heads up: Ledgerline hit an urgent SSO issue before their Thursday board demo.",
    },
  },
];

function splitIntoChunks(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 5) {
    chunks.push(words.slice(i, i + 5).join(" "));
  }
  return chunks;
}

function StreamedText({
  text,
  reduced,
  className,
}: {
  text: string;
  reduced: boolean;
  className?: string;
}) {
  const chunks = useMemo(() => splitIntoChunks(text), [text]);
  const [shown, setShown] = useState(0);
  const [prevText, setPrevText] = useState(text);
  if (prevText !== text) {
    setPrevText(text);
    setShown(0);
  }

  useEffect(() => {
    if (reduced) return;
    let idx = 0;
    const id = window.setInterval(() => {
      idx += 1;
      setShown(idx);
      if (idx >= chunks.length) window.clearInterval(id);
    }, 34);
    return () => window.clearInterval(id);
  }, [chunks, reduced]);

  const effectiveShown = reduced ? chunks.length : shown;

  return (
    <p className={className}>
      {chunks.map((chunk, i) => (
        <span
          key={`${i}-${chunk}`}
          className={styles.chunk}
          data-shown={i < effectiveShown ? "" : undefined}
        >
          {i > 0 ? " " : ""}
          {chunk}
        </span>
      ))}
    </p>
  );
}

function Fold({ open, reduced, children }: { open: boolean; reduced: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          className={styles.fold}
          initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={
            reduced
              ? { duration: 0.12 }
              : {
                  height: { type: "spring", visualDuration: 0.22, bounce: 0 },
                  opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
                }
          }
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function OutputPreview({
  output,
  reduced,
}: {
  output: WorkflowOutput;
  reduced: boolean;
}) {
  switch (output.type) {
    case "email":
      return (
        <div className={styles.output}>
          <div className={styles.outLine}>
            <span className={styles.name}>{output.from}</span>
            {output.address ? <span className={styles.muted}>{output.address}</span> : null}
          </div>
          <p className={`${styles.outStrong} ${styles.clamp1}`}>{output.subject}</p>
          <p className={styles.clamp2}>{output.preview}</p>
        </div>
      );
    case "label": {
      const isUrgent = /urgent|critical|high|fail/i.test(output.label);
      return (
        <div className={styles.output}>
          <div className={styles.outLine}>
            <span className={styles.label}>
              <span
                className={styles.labelDot}
                data-tone={isUrgent ? "urgent" : undefined}
                aria-hidden="true"
              />
              {output.label}
            </span>
            {output.confidence != null ? (
              <span className={`${styles.mono} ${styles.tabular}`}>
                {output.confidence.toFixed(2)} confidence
              </span>
            ) : null}
          </div>
          {output.reason ? (
            <StreamedText text={output.reason} reduced={reduced} />
          ) : null}
        </div>
      );
    }
    case "message":
      return (
        <div className={styles.output}>
          <div className={styles.outLine}>
            <span className={styles.name}>{output.channel}</span>
            <span className={styles.muted}>{output.author}</span>
          </div>
          <p className={styles.clamp2}>{output.text}</p>
        </div>
      );
    case "record":
      return (
        <div className={styles.output}>
          <div className={styles.outLine}>
            <span className={styles.mono}>{output.id}</span>
            <span className={styles.outStrong}>{output.title}</span>
          </div>
          {output.meta ? <p className={styles.muted}>{output.meta}</p> : null}
        </div>
      );
    case "text":
      return (
        <div className={styles.output}>
          <StreamedText text={output.text} reduced={reduced} />
        </div>
      );
    case "route":
      return null;
  }
}

function getKindDefaultStatus(kind: WorkflowStepKind): string {
  switch (kind) {
    case "trigger":
      return "Trigger";
    case "ai":
      return "AI";
    case "branch":
      return "Branch";
    case "action":
      return "Action";
  }
}

export function AiWorkflow({
  title = "Escalate urgent support email",
  description = "Runs on every new email to support@northwind.dev",
  steps: controlledSteps,
  defaultSteps = workflowSampleSteps,
  onStepsChange,
  catalog = workflowSampleCatalog,
  onRunStep,
  onRunComplete,
  loading = false,
  autoPlay = true,
  editable = true,
  className,
}: AiWorkflowProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [uncontrolledSteps, setUncontrolledSteps] = useState<WorkflowStep[]>(defaultSteps);
  const steps = controlledSteps ?? uncontrolledSteps;

  const setSteps = useCallback(
    (updater: WorkflowStep[] | ((prev: WorkflowStep[]) => WorkflowStep[])) => {
      const next = typeof updater === "function" ? updater(steps) : updater;
      if (controlledSteps === undefined) {
        setUncontrolledSteps(next);
      }
      onStepsChange?.(next);
    },
    [controlledSteps, onStepsChange, steps],
  );

  const branchStep = useMemo(
    () => steps.find((s) => s.kind === "branch" && s.paths && s.paths.length > 0),
    [steps],
  );

  const [rawSelectedPathId, setSelectedPathId] = useState<string>(
    branchStep?.paths?.[0]?.id ?? "",
  );

  const selectedPathId = useMemo(() => {
    if (!branchStep?.paths?.length) return rawSelectedPathId;
    if (branchStep.paths.some((p) => p.id === rawSelectedPathId)) {
      return rawSelectedPathId;
    }
    return branchStep.paths[0].id;
  }, [branchStep, rawSelectedPathId]);

  const [runtimes, setRuntimes] = useState<Record<string, StepRuntime>>({});
  const [travelingStepId, setTravelingStepId] = useState<string | null>(null);
  const [runState, setRunState] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [totalDurationMs, setTotalDurationMs] = useState<number>(0);
  const [liveMessage, setLiveMessage] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [activeOptionIdx, setActiveOptionIdx] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const outputsRef = useRef<Record<string, WorkflowOutput>>({});
  const attemptsRef = useRef<Record<string, number>>({});
  const userInteractedRef = useRef(false);
  const inViewRef = useRef(true);
  const replayTimerRef = useRef<number | null>(null);
  const nextIdCounterRef = useRef(1);

  const isSimulated = !onRunStep;

  const stopRun = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setTravelingStepId(null);
    setRunState("idle");
  }, []);

  const sleep = useCallback((ms: number, signal: AbortSignal) => {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const id = window.setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(id);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }, []);

  const executeFlowRef = useRef<((startFromStepId?: string) => Promise<void>) | null>(null);

  const executeFlow = useCallback(
    async (startFromStepId?: string) => {
      if (loading || steps.length === 0) return;

      if (abortRef.current) abortRef.current.abort();
      if (replayTimerRef.current !== null) {
        window.clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setRunState("running");
      setTravelingStepId(null);

      if (!startFromStepId) {
        outputsRef.current = {};
        attemptsRef.current = {};
        setRuntimes({});
        setTotalDurationMs(0);
        setLiveMessage(
          isSimulated
            ? "Test run started. Simulated, nothing was sent."
            : "Test run started.",
        );
      } else {
        setRuntimes((prev) => {
          const next = { ...prev };
          delete next[startFromStepId];
          return next;
        });
      }

      let elapsed = 0;
      let started = !startFromStepId;
      let chosenPathId: string | null = null;

      const runOneStep = async (step: WorkflowStep, isFirst: boolean): Promise<boolean> => {
        if (signal.aborted) return false;

        if (!isFirst && !reduced) {
          setTravelingStepId(step.id);
          try {
            await sleep(240, signal);
          } catch {
            return false;
          }
          setTravelingStepId(null);
        }

        const attempt = (attemptsRef.current[step.id] ?? 0) + 1;
        attemptsRef.current[step.id] = attempt;

        setRuntimes((prev) => ({
          ...prev,
          [step.id]: { status: "running" },
        }));

        const t0 = performance.now();
        try {
          let output: WorkflowOutput | undefined;
          let durationMs = step.durationMs ?? 520;

          if (onRunStep) {
            const res = await onRunStep(step, {
              signal,
              previous: { ...outputsRef.current },
              attempt,
            });
            durationMs = Math.max(120, Math.round(performance.now() - t0));
            output = res ?? step.output;
          } else {
            await sleep(reduced ? Math.min(280, durationMs) : durationMs, signal);
            if (step.error) {
              throw new Error(step.error);
            }
            output = step.output;
          }

          if (signal.aborted) return false;

          elapsed += durationMs;
          if (output) outputsRef.current[step.id] = output;

          setRuntimes((prev) => ({
            ...prev,
            [step.id]: { status: "done", durationMs, output },
          }));

          if (step.kind === "branch" && step.paths?.length) {
            const targetPath =
              (output?.type === "route" &&
                step.paths.find((p) => p.id === output.pathId)?.id) ||
              step.paths[0].id;
            chosenPathId = targetPath;
            setSelectedPathId(targetPath);

            // Mark untaken paths as skipped
            setRuntimes((prev) => {
              const next = { ...prev };
              for (const p of step.paths ?? []) {
                if (p.id !== targetPath) {
                  for (const sub of p.steps) {
                    next[sub.id] = { status: "skipped" };
                  }
                }
              }
              return next;
            });

            if (output?.type === "route" && output.note) {
              setLiveMessage(`${step.title}: ${output.note}`);
            } else {
              setLiveMessage(`${step.title}: Done in ${formatDuration(durationMs)}.`);
            }
          } else {
            setLiveMessage(`${step.title}: Done in ${formatDuration(durationMs)}.`);
          }

          return true;
        } catch (err) {
          if (signal.aborted) return false;
          const message =
            err instanceof Error ? err.message : "Step failed unexpectedly.";
          const durationMs = Math.max(120, Math.round(performance.now() - t0));
          elapsed += durationMs;

          setRuntimes((prev) => ({
            ...prev,
            [step.id]: { status: "error", durationMs, error: message },
          }));
          setRunState("failed");
          setTotalDurationMs(elapsed);
          setLiveMessage(`${step.title} failed: ${message}`);
          onRunComplete?.({
            status: "failed",
            durationMs: elapsed,
            outputs: { ...outputsRef.current },
            failedStepId: step.id,
          });
          return false;
        }
      };

      // Run top-level steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!started) {
          if (step.id === startFromStepId) {
            started = true;
          } else {
            if (step.kind === "branch") {
              const existingOut = outputsRef.current[step.id];
              chosenPathId =
                existingOut?.type === "route"
                  ? existingOut.pathId
                  : selectedPathId || step.paths?.[0]?.id || null;
            }
            continue;
          }
        }
        const ok = await runOneStep(step, i === 0);
        if (!ok) return;

        // If branch, run the chosen path's steps
        if (step.kind === "branch" && step.paths?.length) {
          const path =
            step.paths.find((p) => p.id === chosenPathId) ?? step.paths[0];
          for (let j = 0; j < path.steps.length; j++) {
            const subStep = path.steps[j];
            const subOk = await runOneStep(subStep, false);
            if (!subOk) return;
          }
        }
      }

      // If retrying a step inside a branch path
      if (!started && branchStep?.paths?.length) {
        const path =
          branchStep.paths.find((p) =>
            p.steps.some((s) => s.id === startFromStepId),
          ) ?? branchStep.paths[0];
        for (let j = 0; j < path.steps.length; j++) {
          const subStep = path.steps[j];
          if (!started) {
            if (subStep.id === startFromStepId) started = true;
            else continue;
          }
          const subOk = await runOneStep(subStep, false);
          if (!subOk) return;
        }
      }

      if (signal.aborted) return;

      setRunState("passed");
      setTotalDurationMs(elapsed);
      setLiveMessage(
        isSimulated
          ? `Test run passed in ${formatDuration(elapsed)}. Simulated, nothing was sent.`
          : `Test run passed in ${formatDuration(elapsed)}.`,
      );
      onRunComplete?.({
        status: "passed",
        durationMs: elapsed,
        outputs: { ...outputsRef.current },
      });

      if (autoPlay && !userInteractedRef.current && inViewRef.current) {
        replayTimerRef.current = window.setTimeout(() => {
          replayTimerRef.current = null;
          if (!userInteractedRef.current && inViewRef.current) {
            void executeFlowRef.current?.();
          }
        }, 2600);
      }
    },
    [
      autoPlay,
      branchStep,
      isSimulated,
      loading,
      onRunComplete,
      onRunStep,
      reduced,
      selectedPathId,
      sleep,
      steps,
    ],
  );

  useEffect(() => {
    executeFlowRef.current = executeFlow;
  }, [executeFlow]);

  // Autoplay when visible
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      if (autoPlay && !loading && steps.length > 0 && !userInteractedRef.current) {
        void executeFlow();
      }
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        inViewRef.current = visible;
        if (visible && autoPlay && !loading && steps.length > 0 && !userInteractedRef.current) {
          if (abortRef.current === null && replayTimerRef.current === null) {
            void executeFlow();
          }
        } else if (!visible && replayTimerRef.current !== null) {
          window.clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (abortRef.current) abortRef.current.abort();
      if (replayTimerRef.current !== null) window.clearTimeout(replayTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, loading]);

  const markUserInteraction = useCallback(() => {
    userInteractedRef.current = true;
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  }, []);

  // Catalog filtering
  const triggerCatalog = useMemo(
    () => catalog.filter((item) => item.kind === "trigger"),
    [catalog],
  );
  const actionCatalog = useMemo(
    () => catalog.filter((item) => item.kind !== "trigger"),
    [catalog],
  );

  const filteredMenuOptions = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return actionCatalog;
    return actionCatalog.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        getAppName(item.app).toLowerCase().includes(q) ||
        (item.detail?.toLowerCase().includes(q) ?? false),
    );
  }, [actionCatalog, menuQuery]);

  const clampedOptionIdx = Math.min(
    activeOptionIdx,
    Math.max(0, filteredMenuOptions.length - 1),
  );

  const addCatalogStep = useCallback(
    (item: WorkflowCatalogItem) => {
      markUserInteraction();
      const newStep: WorkflowStep = {
        ...item,
        id: `step-${Date.now()}-${nextIdCounterRef.current++}`,
      };
      setSteps((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.kind === "branch" && last.paths?.length) {
          const targetId = selectedPathId || last.paths[0].id;
          return prev.map((s) =>
            s.id === last.id
              ? {
                  ...s,
                  paths: s.paths?.map((p) =>
                    p.id === targetId
                      ? { ...p, steps: [...p.steps, newStep] }
                      : p,
                  ),
                }
              : s,
          );
        }
        return [...prev, newStep];
      });
      setMenuOpen(false);
      setMenuQuery("");
      setLiveMessage(`Added ${item.title}.`);
    },
    [markUserInteraction, selectedPathId, setSteps],
  );

  const removeStep = useCallback(
    (stepId: string, stepTitle: string) => {
      markUserInteraction();
      setSteps((prev) =>
        prev
          .filter((s) => s.id !== stepId)
          .map((s) =>
            s.kind === "branch" && s.paths
              ? {
                  ...s,
                  paths: s.paths.map((p) => ({
                    ...p,
                    steps: p.steps.filter((sub) => sub.id !== stepId),
                  })),
                }
              : s,
          ),
      );
      setLiveMessage(`Removed ${stepTitle}.`);
    },
    [markUserInteraction, setSteps],
  );

  const onMenuKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActiveOptionIdx((i) =>
          filteredMenuOptions.length ? (i + 1) % filteredMenuOptions.length : 0,
        );
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActiveOptionIdx((i) =>
          filteredMenuOptions.length
            ? (i - 1 + filteredMenuOptions.length) % filteredMenuOptions.length
            : 0,
        );
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        const chosen = filteredMenuOptions[clampedOptionIdx];
        if (chosen) addCatalogStep(chosen);
      } else if (
        !menuQuery &&
        ev.key >= "1" &&
        ev.key <= "9" &&
        !ev.metaKey &&
        !ev.ctrlKey &&
        !ev.altKey
      ) {
        const idx = Number(ev.key) - 1;
        if (filteredMenuOptions[idx]) {
          ev.preventDefault();
          addCatalogStep(filteredMenuOptions[idx]);
        }
      }
    },
    [clampedOptionIdx, addCatalogStep, filteredMenuOptions, menuQuery],
  );

  const selectedPath = useMemo(() => {
    if (!branchStep?.paths?.length) return null;
    return (
      branchStep.paths.find((p) => p.id === selectedPathId) ??
      branchStep.paths[0]
    );
  }, [branchStep, selectedPathId]);

  const addButtonLabel = selectedPath
    ? `Add to ${selectedPath.label}`
    : "Add step";

  const renderStepItem = (
    step: WorkflowStep,
    opts: {
      hasHead: boolean;
      hasTail: boolean;
      prevDone: boolean;
      isPathStep?: boolean;
    },
  ) => {
    const rt = runtimes[step.id];
    const st: StepRunStatus = rt?.status ?? "idle";
    const isRunning = st === "running";
    const isDone = st === "done";
    const isError = st === "error";
    const isSkipped = st === "skipped";
    const isTraveling = travelingStepId === step.id;

    const headFillState = isTraveling
      ? "active"
      : isRunning || isDone || isError
        ? "done"
        : undefined;
    const tailFillState = isDone ? "done" : undefined;

    const statusLabel = isRunning
      ? "Running"
      : isDone && rt?.durationMs != null
        ? formatDuration(rt.durationMs)
        : isError
          ? "Failed"
          : isSkipped
            ? "Skipped"
            : getKindDefaultStatus(step.kind);

    const srStatus = isDone && rt?.durationMs != null
      ? `Done in ${formatDuration(rt.durationMs)}`
      : statusLabel;

    const canRemove = editable && step.kind !== "trigger" && runState !== "running";

    return (
      <motion.li
        key={step.id}
        className={opts.isPathStep ? styles.pathItem : styles.item}
        initial={reduced ? false : { opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
        transition={
          reduced
            ? { duration: 0.1 }
            : {
                height: { type: "spring", visualDuration: 0.22, bounce: 0 },
                opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
              }
        }
      >
        <div
          className={styles.inner}
          data-head={opts.hasHead ? "" : undefined}
        >
          {opts.hasHead ? (
            <>
              <span className={styles.head} aria-hidden="true">
                <span className={styles.fill} data-state={headFillState} />
              </span>
              {isTraveling && !reduced ? (
                <span className={styles.dot} aria-hidden="true" />
              ) : null}
            </>
          ) : null}

          <div className={styles.body} data-status={st}>
            {opts.hasTail ? (
              <span className={styles.tail} aria-hidden="true">
                <span className={styles.fill} data-state={tailFillState} />
              </span>
            ) : null}

            <div className={styles.row}>
              <AppMark app={step.app} />

              <div className={styles.text}>
                <span className={styles.stepTitle}>
                  {step.title}
                  <span className={styles.srOnly}>
                    , {getAppName(step.app)}, {srStatus}
                  </span>
                </span>

                {step.detail || step.activity ? (
                  <span className={styles.stepDetail}>
                    <span
                      className={styles.detailText}
                      data-hidden={isRunning ? "" : undefined}
                      aria-hidden={isRunning ? true : undefined}
                    >
                      {step.detail}
                    </span>
                    <span
                      className={styles.activity}
                      data-hidden={!isRunning ? "" : undefined}
                      aria-hidden={!isRunning ? true : undefined}
                    >
                      {step.activity ?? "Running…"}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className={styles.status}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={st}
                    className={`${styles.statusInner} ${styles.tabular}`}
                    data-status={st}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.12 }}
                  >
                    {isRunning ? (
                      <Loader2 size={13} className={styles.spinner} aria-hidden="true" />
                    ) : isDone ? (
                      <Check size={13} strokeWidth={2} aria-hidden="true" />
                    ) : isError ? (
                      <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
                    ) : null}
                    <span>{statusLabel}</span>
                  </motion.span>
                </AnimatePresence>
              </div>

              {editable ? (
                <span className={styles.removeSlot}>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${step.title}`}
                    disabled={!canRemove}
                    onClick={() => removeStep(step.id, step.title)}
                  >
                    <X size={13} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </span>
              ) : null}
            </div>

            {step.kind === "branch" && step.paths?.length ? (
              <LayoutGroup id={`${uid}-branch`}>
                <div
                  className={styles.tabs}
                  role="radiogroup"
                  aria-label="Branch paths"
                >
                  {step.paths.map((p, idx) => {
                    const selected = p.id === selectedPath?.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        className={styles.tab}
                        data-selected={selected ? "" : undefined}
                        onClick={() => {
                          markUserInteraction();
                          setSelectedPathId(p.id);
                        }}
                        onKeyDown={(ev) => {
                          const paths = step.paths ?? [];
                          let targetIdx = -1;
                          if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
                            targetIdx = (idx + 1) % paths.length;
                          } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
                            targetIdx = (idx - 1 + paths.length) % paths.length;
                          } else if (ev.key === "Home") {
                            targetIdx = 0;
                          } else if (ev.key === "End") {
                            targetIdx = paths.length - 1;
                          }
                          if (targetIdx >= 0) {
                            ev.preventDefault();
                            markUserInteraction();
                            setSelectedPathId(paths[targetIdx].id);
                            const buttons = ev.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                            buttons?.[targetIdx]?.focus();
                          }
                        }}
                      >
                        {selected ? (
                          <motion.span
                            layoutId={`${uid}-tab-highlight`}
                            className={styles.tabHighlight}
                            transition={
                              reduced
                                ? { duration: 0 }
                                : { type: "spring", visualDuration: 0.22, bounce: 0 }
                            }
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className={styles.tabLabel}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            ) : null}

            <Fold open={isDone && Boolean(rt?.output) && rt?.output?.type !== "route"} reduced={reduced}>
              {rt?.output ? <OutputPreview output={rt.output} reduced={reduced} /> : null}
            </Fold>

            <Fold open={isError && Boolean(rt?.error)} reduced={reduced}>
              <div className={`${styles.output} ${styles.errorOut}`}>
                <p className={styles.errorText}>{rt?.error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.retry}
                  onClick={() => {
                    markUserInteraction();
                    void executeFlow(step.id);
                  }}
                >
                  <RotateCcw size={12} strokeWidth={1.75} aria-hidden="true" />
                  Retry
                </Button>
              </div>
            </Fold>
          </div>
        </div>

        {step.kind === "branch" && selectedPath ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={selectedPath.id}
              className={styles.list}
              aria-label={`${selectedPath.label} path steps`}
              initial={reduced ? { opacity: 0 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              {selectedPath.steps.length === 0 ? (
                <li className={styles.pathItem}>
                  <div className={styles.inner} data-head="">
                    <span className={styles.head} aria-hidden="true">
                      <span className={styles.fill} data-state={isDone ? "done" : undefined} />
                    </span>
                    <div className={`${styles.row} ${styles.pathEmpty}`}>
                      <span className={styles.emptyMark} aria-hidden="true" />
                      <p className={styles.emptyText}>No steps on this path yet.</p>
                    </div>
                  </div>
                </li>
              ) : (
                <AnimatePresence initial={false}>
                  {selectedPath.steps.map((sub, subIdx) =>
                    renderStepItem(sub, {
                      hasHead: true,
                      hasTail: subIdx < selectedPath.steps.length - 1,
                      prevDone: isDone,
                      isPathStep: true,
                    }),
                  )}
                </AnimatePresence>
              )}
            </motion.ol>
          </AnimatePresence>
        ) : null}
      </motion.li>
    );
  };

  return (
    <section
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      aria-label={title}
      aria-busy={loading || runState === "running" ? true : undefined}
      onPointerDown={markUserInteraction}
      onKeyDown={markUserInteraction}
    >
      <header className={styles.header}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className={styles.runButton}
          disabled={loading || steps.length === 0}
          onClick={() => {
            markUserInteraction();
            if (runState === "running") {
              stopRun();
            } else {
              void executeFlow();
            }
          }}
        >
          {runState === "running" ? (
            <>
              <Square size={12} fill="currentColor" aria-hidden="true" />
              Stop
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" aria-hidden="true" />
              Test run
            </>
          )}
        </Button>
      </header>

      <div className={styles.canvas}>
        {loading ? (
          <ol className={styles.list} aria-label="Loading workflow steps">
            {[
              { w: "52%" },
              { w: "68%" },
              { w: "44%" },
            ].map((skel, idx) => (
              <li key={idx} className={styles.item}>
                <div className={styles.inner} data-head={idx > 0 ? "" : undefined}>
                  {idx > 0 ? <span className={styles.head} aria-hidden="true" /> : null}
                  <div className={styles.body}>
                    {idx < 2 ? <span className={styles.tail} aria-hidden="true" /> : null}
                    <div className={styles.row}>
                      <span className={styles.skeletonMark} aria-hidden="true" />
                      <span
                        className={styles.skeletonLine}
                        style={{ ["--w" as string]: skel.w }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : steps.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Choose a trigger to start</p>
            <p className={styles.emptyText}>
              Pick an event that kicks off this workflow.
            </p>
            {triggerCatalog.length > 0 ? (
              <ul className={styles.triggerList}>
                {triggerCatalog.map((item) => (
                  <li key={item.title}>
                    <button
                      type="button"
                      className={styles.triggerOption}
                      onClick={() => addCatalogStep(item)}
                    >
                      <AppMark app={item.app} />
                      <span>{item.title}</span>
                      {item.detail ? (
                        <span className={styles.triggerDetail}>{item.detail}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <ol className={styles.list} aria-label="Workflow steps">
            <AnimatePresence initial={false}>
              {steps.map((step, idx) =>
                renderStepItem(step, {
                  hasHead: idx > 0,
                  hasTail:
                    idx < steps.length - 1 ||
                    (step.kind === "branch" && Boolean(selectedPath)),
                  prevDone: idx > 0 && runtimes[steps[idx - 1].id]?.status === "done",
                }),
              )}
            </AnimatePresence>
          </ol>
        )}
      </div>

      <footer className={styles.footer}>
        <div className={styles.summary}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${loading ? "loading" : runState}-${steps.length}`}
              className={styles.summaryInner}
              data-state={loading ? "loading" : runState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.14 }}
            >
              {loading ? (
                <span className={styles.summaryText}>Loading steps…</span>
              ) : runState === "running" ? (
                <>
                  <span className={styles.summaryIcon} aria-hidden="true">
                    <span className={styles.liveDot} />
                  </span>
                  <span className={styles.summaryText}>Test run in progress</span>
                </>
              ) : runState === "passed" ? (
                <>
                  <span className={styles.summaryIcon} aria-hidden="true">
                    <Check size={13} strokeWidth={2} />
                  </span>
                  <span className={`${styles.summaryText} ${styles.tabular}`}>
                    Passed in {formatDuration(totalDurationMs)}
                    {isSimulated ? (
                      <span className={styles.summarySuffix}>
                        {" "}
                        · Simulated, nothing sent
                      </span>
                    ) : null}
                  </span>
                </>
              ) : runState === "failed" ? (
                <>
                  <span className={styles.summaryIcon} aria-hidden="true">
                    <AlertCircle size={13} strokeWidth={2} />
                  </span>
                  <span className={styles.summaryText}>
                    Stopped on error · Retry from failed step
                  </span>
                </>
              ) : (
                <span className={styles.summaryText}>
                  {steps.length === 0
                    ? "No steps yet"
                    : isSimulated
                      ? "Ready to test · Simulated, nothing sent"
                      : "Ready to test"}
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {editable && actionCatalog.length > 0 && steps.length > 0 ? (
          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={styles.addButton}
                disabled={loading || runState === "running"}
              >
                <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.addLabel}>{addButtonLabel}</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className={styles.menu}
                align="end"
                sideOffset={6}
                onOpenAutoFocus={(ev) => {
                  ev.preventDefault();
                  searchInputRef.current?.focus();
                }}
              >
                <div className={styles.search}>
                  <Search size={14} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={menuOpen}
                    aria-controls={`${uid}-menu-list`}
                    aria-activedescendant={
                      filteredMenuOptions[clampedOptionIdx]
                        ? `${uid}-opt-${clampedOptionIdx}`
                        : undefined
                    }
                    aria-label="Search steps"
                    placeholder="Search steps…"
                    className={styles.searchInput}
                    value={menuQuery}
                    onChange={(ev) => {
                      setMenuQuery(ev.target.value);
                      setActiveOptionIdx(0);
                    }}
                    onKeyDown={onMenuKeyDown}
                  />
                </div>
                <ul
                  id={`${uid}-menu-list`}
                  role="listbox"
                  aria-label="Available steps"
                  className={styles.options}
                >
                  {filteredMenuOptions.length === 0 ? (
                    <li className={styles.noMatch}>No matching steps</li>
                  ) : (
                    filteredMenuOptions.map((item, idx) => (
                      <li
                        key={item.title}
                        id={`${uid}-opt-${idx}`}
                        role="option"
                        aria-selected={idx === clampedOptionIdx}
                        className={styles.option}
                        data-active={idx === clampedOptionIdx ? "" : undefined}
                        onPointerEnter={() => setActiveOptionIdx(idx)}
                        onClick={() => addCatalogStep(item)}
                      >
                        <AppMark app={item.app} />
                        <span className={styles.optionTitle}>{item.title}</span>
                        <span className={styles.optionMeta}>
                          {!menuQuery && idx < 9 ? idx + 1 : getAppName(item.app)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
      </footer>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {liveMessage}
      </p>
    </section>
  );
}

export default AiWorkflow;
