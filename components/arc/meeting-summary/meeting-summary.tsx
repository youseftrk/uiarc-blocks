"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import styles from "./meeting-summary.module.css";

export type MeetingPlatform = "google-meet" | "zoom";

export interface MeetingAttendee {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface MeetingQuote {
  timestamp: string;
  speaker: string;
  avatar?: string;
  excerpt: string;
}

export interface MeetingPoint {
  id: string;
  text: string;
  quote?: MeetingQuote;
}

export interface MeetingActionItem {
  id: string;
  text: string;
  owner: string;
  ownerAvatar?: string;
  due?: string;
  done?: boolean;
  quote?: MeetingQuote;
}

export interface MeetingSummaryData {
  title: string;
  platform?: MeetingPlatform;
  date: string;
  timeRange: string;
  durationMinutes: number;
  attendees: MeetingAttendee[];
  wordCount?: number;
  summary: MeetingPoint[];
  decisions: MeetingPoint[];
  actionItems: MeetingActionItem[];
}

export interface MeetingSendTarget {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface MeetingSendResult {
  ref?: string;
  url?: string;
}

export type MeetingSummaryStatus = "loading" | "streaming" | "ready" | "error" | "empty";

export interface MeetingSummaryProps {
  meeting: MeetingSummaryData;
  status?: MeetingSummaryStatus;
  error?: string;
  autoplay?: boolean;
  streaming?: boolean;
  model?: { name: string; icon?: ReactNode };
  sendTargets?: MeetingSendTarget[];
  onSend?: (
    item: MeetingActionItem,
    target: MeetingSendTarget
  ) => Promise<MeetingSendResult | void> | MeetingSendResult | void;
  onActionItemChange?: (id: string, done: boolean) => void;
  onRegenerate?: () => void;
  className?: string;
}

function GoogleMeetIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Google Meet" width={20} height={20}>
      <path fill="#EA4335" d="M5.53 2.13 0 7.75h5.53z" />
      <path
        fill="#FFBA00"
        d="M5.928 2.13v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46-.148-1.09-1.287-1.47-2.236-1.36z"
      />
      <path
        fill="#00832D"
        d="M23.1 4.32c-.802.295-1.358.995-2.047 1.49-2.506 2.05-4.982 4.12-7.468 6.19 3.025 2.59 6.04 5.18 9.065 7.76 1.218.671 1.428-.814 1.328-1.64v-13a.828.828 0 0 0-.877-.825z"
      />
      <path fill="#2684FC" d="M.038 8.15v7.7h5.53v-7.7z" />
      <path
        fill="#00AC47"
        d="M13.615 16.25H6.008v5.62c3.864-.006 7.737.011 11.58-.009 1.02-.07 1.618-1.12 1.468-2.07v-2.51l-5.47-4.68v3.65z"
      />
      <path
        fill="#0066DA"
        d="M.038 16.25c.02 1.44-.041 2.88.033 4.31.162.948 1.158 1.43 2.047 1.31h3.464v-5.62z"
      />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Zoom" width={20} height={20}>
      <rect width="24" height="24" rx="6" fill="#2D8CFF" />
      <path
        fill="#FFFFFF"
        d="M5.5 8.5A1.5 1.5 0 0 1 7 7h6.5A1.5 1.5 0 0 1 15 8.5v7a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-7Zm10.5 2.2 3.2-2.2c.5-.35 1.3 0 1.3.65v5.7c0 .65-.8 1-1.3.65L16 13.3v-2.6Z"
      />
    </svg>
  );
}

export function LinearIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Linear" width={14} height={14} aria-hidden="true">
      <path
        fill="#5E6AD2"
        d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"
      />
    </svg>
  );
}

export function NotionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="Notion"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function ClaudeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" width={14} height={14} style={{ color: "#D97757" }}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const DEFAULT_SEND_TARGETS: MeetingSendTarget[] = [
  { id: "linear", label: "Linear", icon: <LinearIcon /> },
  { id: "notion", label: "Notion", icon: <NotionIcon /> },
];

type SendState =
  | { view: "idle" }
  | { view: "sending" }
  | { view: "sent"; ref?: string; url?: string }
  | { view: "failed" };

interface StreamSegment {
  section: "summary" | "decisions" | "actions";
  itemId: string;
  chunks: string[];
}

function splitChunks(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const size = Math.min(words.length - i, 3 + ((i * 7 + text.length) % 5));
    const slice = words.slice(i, i + size).join(" ");
    chunks.push(i === 0 ? slice : " " + slice);
    i += size;
  }
  return chunks;
}

function formatMarkdown(meeting: MeetingSummaryData, checked: Record<string, boolean>): string {
  const lines: string[] = [];
  lines.push(`# ${meeting.title}`);
  lines.push(`${meeting.date} · ${meeting.timeRange} · ${meeting.durationMinutes} min`);
  lines.push("");
  if (meeting.summary.length > 0) {
    lines.push("## Summary");
    for (const p of meeting.summary) {
      lines.push(`- ${p.text}${p.quote ? ` (${p.quote.timestamp})` : ""}`);
    }
    lines.push("");
  }
  if (meeting.decisions.length > 0) {
    lines.push("## Decisions");
    for (const d of meeting.decisions) {
      lines.push(`- ${d.text}${d.quote ? ` (${d.quote.timestamp})` : ""}`);
    }
    lines.push("");
  }
  if (meeting.actionItems.length > 0) {
    lines.push("## Action items");
    for (const a of meeting.actionItems) {
      const box = checked[a.id] ? "x" : " ";
      const meta = [a.owner, a.due ? `Due ${a.due}` : null].filter(Boolean).join(", ");
      lines.push(`- [${box}] ${a.text}${meta ? ` (${meta})` : ""}`);
    }
  }
  return lines.join("\n").trim();
}

export function MeetingSummary({
  meeting,
  status: controlledStatus,
  error,
  autoplay = false,
  streaming = true,
  model = { name: "Claude Sonnet 5.5", icon: <ClaudeIcon /> },
  sendTargets = DEFAULT_SEND_TARGETS,
  onSend,
  onActionItemChange,
  onRegenerate,
  className,
}: MeetingSummaryProps) {
  const idPrefix = useId();
  const reduced = useReducedMotion();

  const [internalStatus, setInternalStatus] = useState<MeetingSummaryStatus>(
    autoplay && !reduced ? "loading" : "ready"
  );
  const status = controlledStatus ?? internalStatus;

  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of meeting.actionItems) {
      if (item.done) init[item.id] = true;
    }
    return init;
  });

  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});
  const [hoveredQuoteId, setHoveredQuoteId] = useState<string | null>(null);
  const [pinnedQuoteId, setPinnedQuoteId] = useState<string | null>(null);
  const [quoteAbove, setQuoteAbove] = useState(false);

  const activeQuoteId = pinnedQuoteId ?? hoveredQuoteId;

  const segments = useMemo<StreamSegment[]>(() => {
    const segs: StreamSegment[] = [];
    for (const p of meeting.summary) {
      segs.push({ section: "summary", itemId: p.id, chunks: splitChunks(p.text) });
    }
    for (const d of meeting.decisions) {
      segs.push({ section: "decisions", itemId: d.id, chunks: splitChunks(d.text) });
    }
    for (const a of meeting.actionItems) {
      segs.push({ section: "actions", itemId: a.id, chunks: splitChunks(a.text) });
    }
    return segs;
  }, [meeting]);

  const totalChunks = useMemo(
    () => segments.reduce((sum, s) => sum + s.chunks.length, 0),
    [segments]
  );

  const [revealedChunks, setRevealedChunks] = useState<number>(
    status === "ready" || reduced || !streaming ? totalChunks : 0
  );

  // Run autoplay / regeneration lifecycle when uncontrolled
  const [runNonce, setRunNonce] = useState(0);

  useEffect(() => {
    if (controlledStatus !== undefined) return;
    if (runNonce === 0 && (!autoplay || reduced || !streaming)) return;
    const loadTimer = setTimeout(() => {
      if (reduced || !streaming) {
        setRevealedChunks(totalChunks);
        setInternalStatus("ready");
      } else {
        setRevealedChunks(0);
        setInternalStatus("streaming");
      }
    }, 950);
    return () => clearTimeout(loadTimer);
  }, [controlledStatus, autoplay, reduced, streaming, totalChunks, runNonce]);

  useEffect(() => {
    if (status !== "streaming") return;
    if (reduced || !streaming || revealedChunks >= totalChunks) {
      const doneTimer = setTimeout(() => {
        setRevealedChunks(totalChunks);
        if (controlledStatus === undefined) setInternalStatus("ready");
      }, 0);
      return () => clearTimeout(doneTimer);
    }
    const timer = setTimeout(() => {
      setRevealedChunks((c) => Math.min(totalChunks, c + 1));
    }, 34);
    return () => clearTimeout(timer);
  }, [status, revealedChunks, totalChunks, reduced, streaming, controlledStatus]);

  const effectiveRevealed =
    status === "ready" || reduced || !streaming
      ? totalChunks
      : status === "loading"
        ? 0
        : revealedChunks;

  // Smooth body height measurement
  const bodyInnerRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const el = bodyInnerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBodyHeight(Math.ceil(entry.contentRect.height));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close pinned quote on Escape or outside click
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!pinnedQuoteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedQuoteId(null);
        setHoveredQuoteId(null);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinnedQuoteId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [pinnedQuoteId]);

  const checkPlacement = useCallback((el: HTMLElement | null) => {
    if (!el || !rootRef.current) return;
    const rowRect = el.getBoundingClientRect();
    const cardRect = rootRef.current.getBoundingClientRect();
    setQuoteAbove(cardRect.bottom - rowRect.bottom < 120);
  }, []);

  const toggleItem = (id: string) => {
    setCheckedMap((prev) => {
      const next = !prev[id];
      onActionItemChange?.(id, next);
      return { ...prev, [id]: next };
    });
  };

  const handleSend = async (item: MeetingActionItem, target: MeetingSendTarget) => {
    const key = `${item.id}:${target.id}`;
    const current = sendStates[key];
    if (current?.view === "sending" || current?.view === "sent") return;

    setSendStates((prev) => ({ ...prev, [key]: { view: "sending" } }));
    try {
      let result: MeetingSendResult | void;
      if (onSend) {
        result = await onSend(item, target);
      } else {
        await new Promise((r) => setTimeout(r, 550));
        result =
          target.id === "linear"
            ? { ref: `BIL-${100 + meeting.actionItems.findIndex((x) => x.id === item.id) + 1}` }
            : { ref: "Saved" };
      }
      setSendStates((prev) => ({
        ...prev,
        [key]: { view: "sent", ref: result?.ref ?? "Sent", url: result?.url },
      }));
    } catch {
      setSendStates((prev) => ({ ...prev, [key]: { view: "failed" } }));
    }
  };

  const handleRegenerate = () => {
    setPinnedQuoteId(null);
    setHoveredQuoteId(null);
    setSendStates({});
    onRegenerate?.();
    if (controlledStatus === undefined) {
      setInternalStatus("loading");
      setRevealedChunks(0);
      setRunNonce((n) => n + 1);
    }
  };

  // Compute chunk visibility map per item
  const itemReveal = useMemo(() => {
    const map = new Map<string, { visible: boolean; chunks: string[]; complete: boolean }>();
    let cursor = 0;
    for (const seg of segments) {
      const remaining = Math.max(0, effectiveRevealed - cursor);
      const shown = Math.min(seg.chunks.length, remaining);
      map.set(seg.itemId, {
        visible: shown > 0,
        chunks: seg.chunks.slice(0, shown),
        complete: shown >= seg.chunks.length,
      });
      cursor += seg.chunks.length;
    }
    return map;
  }, [segments, effectiveRevealed]);

  const doneCount = meeting.actionItems.filter((a) => checkedMap[a.id]).length;
  const isNotesVisible = status === "streaming" || status === "ready";
  const markdownText = useMemo(
    () => formatMarkdown(meeting, checkedMap),
    [meeting, checkedMap]
  );

  const visibleAttendees = meeting.attendees.slice(0, 4);
  const extraAttendees = Math.max(0, meeting.attendees.length - visibleAttendees.length);
  const attendeeNames = meeting.attendees.map((a) => a.name).join(", ");
  const platformLabel = meeting.platform === "zoom" ? "Zoom" : "Google Meet";

  const statusAnnouncement =
    status === "loading"
      ? "Summarizing meeting transcript"
      : status === "streaming"
      ? "Writing meeting notes"
      : status === "error"
      ? error || "Could not summarize this meeting"
      : status === "empty"
      ? "No transcript available for this meeting"
      : `Summary ready: ${meeting.summary.length} points, ${meeting.decisions.length} decisions, ${meeting.actionItems.length} action items`;

  const renderQuote = (rowKey: string, quote: MeetingQuote) => {
    const open = activeQuoteId === rowKey;
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            key={rowKey}
            id={`${idPrefix}-quote-${rowKey}`}
            role="region"
            aria-label={`Transcript quote from ${quote.speaker} at ${quote.timestamp}`}
            className={styles.quote}
            data-above={quoteAbove ? "" : undefined}
            initial={reduced ? false : { opacity: 0, y: quoteAbove ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: quoteAbove ? 4 : -4 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.quoteHead}>
              <Avatar
                name={quote.speaker}
                src={quote.avatar}
                size="sm"
                className={styles.quoteAvatar}
                aria-hidden="true"
              />
              <span className={styles.quoteName}>{quote.speaker}</span>
              <span className={styles.quoteTime}>{quote.timestamp}</span>
            </div>
            <p className={styles.quoteText}>&ldquo;{quote.excerpt}&rdquo;</p>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <article
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={`Meeting notes: ${meeting.title}`}
      aria-busy={status === "loading" || status === "streaming"}
    >
      <header className={styles.header}>
        <span className={styles.platform}>
          {meeting.platform === "zoom" ? <ZoomIcon /> : <GoogleMeetIcon />}
        </span>
        <div className={styles.heading}>
          <h2 className={styles.title}>{meeting.title}</h2>
          <p className={styles.when}>
            <span className={styles.srOnly}>{platformLabel}, </span>
            <span>{meeting.date}</span>
            <span className={styles.dot} aria-hidden="true" />
            <span>{meeting.timeRange}</span>
            <span className={styles.dot} aria-hidden="true" />
            <span>{meeting.durationMinutes} min</span>
          </p>
        </div>

        <Tooltip content={attendeeNames}>
          <span
            className={styles.stack}
            tabIndex={0}
            role="group"
            aria-label={`${meeting.attendees.length} attendees: ${attendeeNames}`}
          >
            <span className={styles.stackFaces} aria-hidden="true">
              {visibleAttendees.map((a) => (
                <Avatar
                  key={a.id}
                  name={a.name}
                  src={a.avatar}
                  size="sm"
                  className={styles.face}
                />
              ))}
            </span>
            {extraAttendees > 0 && (
              <span className={styles.more} aria-hidden="true">
                +{extraAttendees}
              </span>
            )}
          </span>
        </Tooltip>
      </header>

      <motion.div
        className={styles.bodyOuter}
        animate={bodyHeight === "auto" ? undefined : { height: bodyHeight }}
        transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.24, bounce: 0 }}
      >
        <div ref={bodyInnerRef} className={styles.body}>
          <AnimatePresence mode="wait" initial={false}>
            {status === "loading" && (
              <motion.div
                key="loading"
                className={styles.loading}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <Loader2 size={15} className={styles.spinner} aria-hidden="true" />
                <span className={styles.loadingLabel}>Summarizing transcript…</span>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                className={styles.state}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <span className={`${styles.stateIcon} ${styles.stateDanger}`} aria-hidden="true">
                  <AlertCircle size={16} />
                </span>
                <div className={styles.stateCopy}>
                  <p className={styles.stateTitle}>Could not summarize meeting</p>
                  <p className={styles.stateText}>
                    {error || "The transcript service returned an error. Try regenerating the notes."}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.retry}
                    onClick={handleRegenerate}
                  >
                    Try again
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "empty" && (
              <motion.div
                key="empty"
                className={styles.state}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <span className={styles.stateIcon} aria-hidden="true">
                  <FileText size={16} />
                </span>
                <div className={styles.stateCopy}>
                  <p className={styles.stateTitle}>No transcript recorded</p>
                  <p className={styles.stateText}>
                    Recording or transcription was off for this call, so there are no notes to generate.
                  </p>
                </div>
              </motion.div>
            )}

            {isNotesVisible && (
              <motion.div
                key="notes"
                className={styles.notes}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                {meeting.summary.some((p) => itemReveal.get(p.id)?.visible) && (
                  <section className={styles.section} aria-labelledby={`${idPrefix}-summary`}>
                    <h3 id={`${idPrefix}-summary`} className={styles.sectionTitle}>
                      Summary
                    </h3>
                    <ul className={styles.list}>
                      {meeting.summary.map((point) => {
                        const rev = itemReveal.get(point.id);
                        if (!rev?.visible) return null;
                        const rowKey = `${idPrefix}-${point.id}`;
                        const isPinned = pinnedQuoteId === rowKey;
                        const isActive = activeQuoteId === rowKey;
                        return (
                          <li
                            key={point.id}
                            className={`${styles.point} ${styles.enter}`}
                            data-quote-row={rowKey}
                            data-active={isActive ? "" : undefined}
                          >
                            <span className={styles.marker} aria-hidden="true">
                              <span className={styles.bullet} />
                            </span>
                            <span className={styles.pointText}>
                              {rev.chunks.map((chunk, i) => (
                                <span key={i} className={styles.chunk}>
                                  {chunk}
                                </span>
                              ))}
                            </span>
                            {point.quote && (
                              <span
                                className={[
                                  styles.pointAside,
                                  !rev.complete && styles.hidden,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <button
                                  type="button"
                                  className={styles.timestamp}
                                  aria-label={`Transcript quote at ${point.quote.timestamp}`}
                                  aria-expanded={isActive}
                                  onMouseEnter={(e) => {
                                    checkPlacement(e.currentTarget);
                                    setHoveredQuoteId(rowKey);
                                  }}
                                  onMouseLeave={() =>
                                    setHoveredQuoteId((cur) => (cur === rowKey ? null : cur))
                                  }
                                  onFocus={(e) => {
                                    checkPlacement(e.currentTarget);
                                    setHoveredQuoteId(rowKey);
                                  }}
                                  onBlur={() =>
                                    setHoveredQuoteId((cur) => (cur === rowKey ? null : cur))
                                  }
                                  onClick={(e) => {
                                    checkPlacement(e.currentTarget);
                                    setPinnedQuoteId(isPinned ? null : rowKey);
                                  }}
                                >
                                  {point.quote.timestamp}
                                </button>
                              </span>
                            )}
                            {point.quote && renderQuote(rowKey, point.quote)}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {meeting.decisions.some((d) => itemReveal.get(d.id)?.visible) && (
                  <section className={styles.section} aria-labelledby={`${idPrefix}-decisions`}>
                    <h3 id={`${idPrefix}-decisions`} className={styles.sectionTitle}>
                      Decisions
                    </h3>
                    <ul className={styles.list}>
                      {meeting.decisions.map((decision) => {
                        const rev = itemReveal.get(decision.id);
                        if (!rev?.visible) return null;
                        const rowKey = `${idPrefix}-${decision.id}`;
                        const isPinned = pinnedQuoteId === rowKey;
                        const isActive = activeQuoteId === rowKey;
                        return (
                          <li
                            key={decision.id}
                            className={`${styles.point} ${styles.enter}`}
                            data-quote-row={rowKey}
                            data-active={isActive ? "" : undefined}
                          >
                            <span className={styles.marker} aria-hidden="true">
                              <Check size={13} strokeWidth={2} />
                            </span>
                            <span className={styles.pointText}>
                              {rev.chunks.map((chunk, i) => (
                                <span key={i} className={styles.chunk}>
                                  {chunk}
                                </span>
                              ))}
                            </span>
                            {decision.quote && (
                              <span
                                className={[
                                  styles.pointAside,
                                  !rev.complete && styles.hidden,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <button
                                  type="button"
                                  className={styles.timestamp}
                                  aria-label={`Transcript quote at ${decision.quote.timestamp}`}
                                  aria-expanded={isActive}
                                  onMouseEnter={(e) => {
                                    checkPlacement(e.currentTarget);
                                    setHoveredQuoteId(rowKey);
                                  }}
                                  onMouseLeave={() =>
                                    setHoveredQuoteId((cur) => (cur === rowKey ? null : cur))
                                  }
                                  onFocus={(e) => {
                                    checkPlacement(e.currentTarget);
                                    setHoveredQuoteId(rowKey);
                                  }}
                                  onBlur={() =>
                                    setHoveredQuoteId((cur) => (cur === rowKey ? null : cur))
                                  }
                                  onClick={(e) => {
                                    checkPlacement(e.currentTarget);
                                    setPinnedQuoteId(isPinned ? null : rowKey);
                                  }}
                                >
                                  {decision.quote.timestamp}
                                </button>
                              </span>
                            )}
                            {decision.quote && renderQuote(rowKey, decision.quote)}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {meeting.actionItems.some((a) => itemReveal.get(a.id)?.visible) && (
                  <section className={styles.section} aria-labelledby={`${idPrefix}-actions`}>
                    <div className={styles.sectionHead}>
                      <h3 id={`${idPrefix}-actions`} className={styles.sectionTitle}>
                        Action items
                      </h3>
                      <span
                        className={[
                          styles.progress,
                          status === "streaming" && styles.hidden,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className={styles.count}>
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={doneCount}
                              initial={reduced ? false : { opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={reduced ? undefined : { opacity: 0, y: 4 }}
                              transition={{ duration: 0.14 }}
                            >
                              {doneCount}
                            </motion.span>
                          </AnimatePresence>
                        </span>{" "}
                        of {meeting.actionItems.length} done
                      </span>
                    </div>

                    <ul className={styles.list}>
                      {meeting.actionItems.map((item) => {
                        const rev = itemReveal.get(item.id);
                        if (!rev?.visible) return null;
                        const rowKey = `${idPrefix}-${item.id}`;
                        const isDone = Boolean(checkedMap[item.id]);
                        const isPinned = pinnedQuoteId === rowKey;
                        const isActive = activeQuoteId === rowKey;
                        const shortOwner = item.owner.split(/\s+/)[0] || item.owner;

                        return (
                          <li
                            key={item.id}
                            className={`${styles.item} ${styles.enter}`}
                            data-quote-row={rowKey}
                            data-done={isDone ? "" : undefined}
                          >
                            <span className={styles.checkCell}>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isDone}
                                aria-label={item.text}
                                className={styles.checkbox}
                                data-checked={isDone ? "" : undefined}
                                onClick={() => toggleItem(item.id)}
                              >
                                <motion.span
                                  className={styles.checkFill}
                                  aria-hidden="true"
                                  animate={{
                                    opacity: isDone ? 1 : 0,
                                    scale: isDone ? 1 : 0.7,
                                  }}
                                  transition={
                                    reduced
                                      ? { duration: 0 }
                                      : { duration: 0.14, ease: [0.22, 1, 0.36, 1] }
                                  }
                                />
                                <svg
                                  className={styles.checkMark}
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <motion.path
                                    d="M4.2 8.3 6.8 10.9 11.8 5.6"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    animate={{ pathLength: isDone ? 1 : 0, opacity: isDone ? 1 : 0 }}
                                    transition={
                                      reduced
                                        ? { duration: 0 }
                                        : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }
                                    }
                                  />
                                </svg>
                              </button>
                            </span>

                            <div className={styles.itemBody}>
                              <span className={styles.itemText}>
                                <span className={styles.strike}>
                                  {rev.chunks.map((chunk, i) => (
                                    <span key={i} className={styles.chunk}>
                                      {chunk}
                                    </span>
                                  ))}
                                </span>
                              </span>

                              <div
                                className={[styles.meta, !rev.complete && styles.hidden]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <span className={styles.owner}>
                                  <Avatar
                                    name={item.owner}
                                    src={item.ownerAvatar}
                                    size="sm"
                                    className={styles.ownerAvatar}
                                    aria-hidden="true"
                                  />
                                  <span className={styles.ownerFull}>{item.owner}</span>
                                  <span className={styles.ownerShort} aria-hidden="true">
                                    {shortOwner}
                                  </span>
                                </span>

                                {item.due && (
                                  <span className={styles.due}>
                                    <CalendarDays size={12} aria-hidden="true" />
                                    <span>
                                      <span className={styles.srOnly}>Due </span>
                                      {item.due}
                                    </span>
                                  </span>
                                )}

                                {item.quote && (
                                  <span className={styles.metaQuote}>
                                    <button
                                      type="button"
                                      className={styles.timestamp}
                                      aria-label={`Transcript quote at ${item.quote.timestamp}`}
                                      aria-expanded={isActive}
                                      onMouseEnter={(e) => {
                                        checkPlacement(e.currentTarget);
                                        setHoveredQuoteId(rowKey);
                                      }}
                                      onMouseLeave={() =>
                                        setHoveredQuoteId((cur) => (cur === rowKey ? null : cur))
                                      }
                                      onFocus={(e) => {
                                        checkPlacement(e.currentTarget);
                                        setHoveredQuoteId(rowKey);
                                      }}
                                      onBlur={() =>
                                        setHoveredQuoteId((cur) => (cur === rowKey ? null : cur))
                                      }
                                      onClick={(e) => {
                                        checkPlacement(e.currentTarget);
                                        setPinnedQuoteId(isPinned ? null : rowKey);
                                      }}
                                    >
                                      {item.quote.timestamp}
                                    </button>
                                  </span>
                                )}

                                {sendTargets.length > 0 && (
                                  <span className={styles.sendGroup}>
                                    {sendTargets.map((target) => {
                                      const key = `${item.id}:${target.id}`;
                                      const st: SendState = sendStates[key] ?? { view: "idle" };
                                      return (
                                        <div key={target.id} className={styles.sizer}>
                                          <div className={styles.sizerInner}>
                                            <AnimatePresence mode="wait" initial={false}>
                                              {st.view === "sent" ? (
                                                <motion.span
                                                  key="sent"
                                                  className={styles.sentWrap}
                                                  initial={reduced ? false : { opacity: 0, scale: 0.96 }}
                                                  animate={{ opacity: 1, scale: 1 }}
                                                  exit={reduced ? undefined : { opacity: 0 }}
                                                  transition={{ duration: 0.14 }}
                                                >
                                                  {st.url ? (
                                                    <a
                                                      href={st.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className={styles.sent}
                                                    >
                                                      {target.icon}
                                                      <span className={styles.sentRef}>{st.ref}</span>
                                                      <Check size={12} className={styles.sentCheck} aria-hidden="true" />
                                                    </a>
                                                  ) : (
                                                    <span className={styles.sent}>
                                                      {target.icon}
                                                      <span className={styles.sentRef}>{st.ref}</span>
                                                      <Check size={12} className={styles.sentCheck} aria-hidden="true" />
                                                    </span>
                                                  )}
                                                </motion.span>
                                              ) : (
                                                <motion.span
                                                  key="btn"
                                                  className={styles.sentWrap}
                                                  initial={reduced ? false : { opacity: 0 }}
                                                  animate={{ opacity: 1 }}
                                                  exit={reduced ? undefined : { opacity: 0 }}
                                                  transition={{ duration: 0.14 }}
                                                >
                                                  <Tooltip
                                                    content={
                                                      st.view === "failed"
                                                        ? `Retry ${target.label}`
                                                        : `Send to ${target.label}`
                                                    }
                                                  >
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className={styles.iconButton}
                                                      aria-label={`Send to ${target.label}: ${item.text}`}
                                                      data-view={st.view}
                                                      onClick={() => handleSend(item, target)}
                                                    >
                                                      <span className={styles.iconSwap}>
                                                        <span className={styles.iconSlot} data-view={st.view}>
                                                          {st.view === "sending" ? (
                                                            <Loader2 size={14} className={styles.spinner} />
                                                          ) : st.view === "failed" ? (
                                                            <AlertCircle size={14} />
                                                          ) : (
                                                            target.icon
                                                          )}
                                                        </span>
                                                      </span>
                                                    </Button>
                                                  </Tooltip>
                                                </motion.span>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.quote && renderQuote(rowKey, item.quote)}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <footer className={styles.footer}>
        <p className={styles.credit}>
          {model.icon && <span className={styles.modelIcon}>{model.icon}</span>}
          <span className={styles.modelName}>{model.name}</span>
          {meeting.wordCount !== undefined && (
            <>
              <span className={styles.dot} aria-hidden="true" />
              <span>{meeting.wordCount.toLocaleString("en-US")} words</span>
            </>
          )}
        </p>

        <div className={styles.tools}>
          <CopyButton
            value={markdownText}
            label="Copy notes as Markdown"
            iconOnly
            variant="plain"
            disabled={!isNotesVisible}
          />
          <Tooltip content="Regenerate notes">
            <Button
              variant="ghost"
              size="sm"
              className={styles.iconButton}
              aria-label="Regenerate notes"
              onClick={handleRegenerate}
            >
              <RotateCcw size={14} />
            </Button>
          </Tooltip>
        </div>
      </footer>

      <p className={styles.srOnly} aria-live="polite">
        {statusAnnouncement}
      </p>
    </article>
  );
}

export default MeetingSummary;
