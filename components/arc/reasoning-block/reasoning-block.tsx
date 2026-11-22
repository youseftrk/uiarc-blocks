"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useInView, usePageInView, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  RotateCcw,
  Square,
} from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../motion-tokens";
import styles from "./reasoning-block.module.css";

export type ReasoningStatus = "thinking" | "done" | "stopped" | "error";

export interface ReasoningStep {
  title?: string;
  text: string;
}

export interface ReasoningModel {
  name: string;
  mark?: ReactNode;
}

export interface ReasoningBlockProps {
  reasoning?: string | ReasoningStep[];
  status?: ReasoningStatus;
  seconds?: number;
  model?: ReasoningModel;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStop?: () => void;
  onRetry?: () => void;
  error?: string;
  variant?: "card" | "plain";
  className?: string;
}

export interface ClaudeMarkProps {
  title?: string;
  mono?: boolean;
}

export function ClaudeMark({ title = "Claude", mono = false }: ClaudeMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={mono ? "currentColor" : "#D97757"}
      role="img"
      aria-label={title}
      width="18"
      height="18"
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/**
 * Parses a streamed reasoning string (or pre-structured steps) into `{ title?, text }[]`.
 * Blank lines split paragraphs; `**Heading**` or `## Heading` lines start a new step.
 * A half-streamed heading (e.g. `**Check` without closing `**`) never leaks raw asterisks.
 */
export function parseReasoning(
  reasoning: string | ReasoningStep[] | undefined,
): ReasoningStep[] {
  if (!reasoning) return [];
  if (Array.isArray(reasoning)) {
    return reasoning
      .map((s) => ({ title: s.title?.trim() || undefined, text: s.text.trim() }))
      .filter((s) => s.title || s.text);
  }

  const lines = reasoning.replace(/\r\n/g, "\n").split("\n");
  const steps: ReasoningStep[] = [];
  let current: { title?: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.lines.join("\n").trim();
    if (current.title || text) {
      steps.push({ title: current.title, text });
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const isLast = i === lines.length - 1;

    // Suppress half-streamed heading at the tail
    if (isLast) {
      if (/^\*\*[^*]*$/.test(trimmed) || /^#{1,3}\s*$/.test(trimmed)) {
        continue;
      }
    }

    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    const hashMatch = trimmed.match(/^#{1,3}\s+(.+)$/);

    if (boldMatch) {
      flush();
      current = { title: boldMatch[1].trim(), lines: [] };
      continue;
    }
    if (hashMatch) {
      flush();
      current = { title: hashMatch[1].trim(), lines: [] };
      continue;
    }

    if (!current) {
      if (!trimmed) continue;
      current = { lines: [raw] };
    } else {
      current.lines.push(raw);
    }
  }

  flush();
  return steps;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

function formatDurationSpoken(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} ${s === 1 ? "second" : "seconds"}`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const mStr = `${m} ${m === 1 ? "minute" : "minutes"}`;
  return rem === 0 ? mStr : `${mStr} ${rem} ${rem === 1 ? "second" : "seconds"}`;
}

const DEMO_REASONING = `**Trace the duplicate charge**
The webhook handler retries on a 504 from the billing service, and each retry calls createUsageCharge again with an idempotency key built from Date.now(), so Stripe sees a brand new request instead of a repeat.

**Check the idempotency key**
The invoice line item already has a stable invoiceId and periodStart. Hashing those two values gives the same key across every retry without touching the schema.

**Verify the rollback path**
If the local ledger write fails after Stripe succeeds, the next retry will hit Stripe with the same key and receive the original charge object back, so the ledger can upsert cleanly.`;

const DEMO_CHUNKS = DEMO_REASONING.match(/\S+\s*/g) ?? [DEMO_REASONING];

function stepsToPlainText(steps: ReasoningStep[]): string {
  return steps
    .map((s) => (s.title ? `${s.title}\n${s.text}` : s.text))
    .join("\n\n");
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, " ").trim())
    .filter(Boolean);
}

export function ReasoningBlock({
  reasoning: controlledReasoning,
  status: controlledStatus,
  seconds: controlledSeconds,
  model = { name: "Claude Opus 5.5" },
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  onStop,
  onRetry,
  error,
  variant = "card",
  className,
}: ReasoningBlockProps) {
  const reduced = Boolean(useReducedMotion());
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "64px" });
  const pageVisible = usePageInView();

  const isSimulated = controlledReasoning === undefined;

  // Simulated loop state when no props passed
  const [simChunkIdx, setSimChunkIdx] = useState(0);
  const [simStatus, setSimStatus] = useState<ReasoningStatus>("thinking");
  const [simSeconds, setSimSeconds] = useState(0);
  const [simRun, setSimRun] = useState(0);

  useEffect(() => {
    if (!isSimulated || reduced || !inView || !pageVisible) return;

    if (simStatus === "thinking") {
      if (simChunkIdx >= DEMO_CHUNKS.length) {
        const timer = window.setTimeout(() => setSimStatus("done"), 0);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(() => {
        setSimChunkIdx((n) => Math.min(DEMO_CHUNKS.length, n + 1));
      }, 65);
      return () => window.clearTimeout(timer);
    }

    if (simStatus === "done" || simStatus === "stopped") {
      const timer = window.setTimeout(() => {
        setSimChunkIdx(0);
        setSimSeconds(0);
        setSimStatus("thinking");
        setSimRun((r) => r + 1);
      }, 4200);
      return () => window.clearTimeout(timer);
    }
  }, [isSimulated, reduced, inView, pageVisible, simStatus, simChunkIdx, simRun]);

  useEffect(() => {
    if (!isSimulated || reduced || !inView || !pageVisible || simStatus !== "thinking") return;
    const id = window.setInterval(() => {
      setSimSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isSimulated, reduced, inView, pageVisible, simStatus]);

  const effectiveStatus: ReasoningStatus = isSimulated
    ? controlledStatus ?? (reduced ? "done" : simStatus)
    : controlledStatus ?? "done";

  const effectiveReasoning: string | ReasoningStep[] = isSimulated
    ? reduced
      ? DEMO_REASONING
      : DEMO_CHUNKS.slice(0, simChunkIdx).join("")
    : controlledReasoning;

  // Measure elapsed seconds automatically when controlledSeconds is omitted
  const [measuredSeconds, setMeasuredSeconds] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isSimulated || controlledSeconds !== undefined) return;
    if (effectiveStatus === "thinking") {
      if (startedAtRef.current === null) {
        startedAtRef.current = Date.now();
      }
      const id = window.setInterval(() => {
        if (startedAtRef.current !== null) {
          setMeasuredSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 1000);
      return () => window.clearInterval(id);
    } else if (startedAtRef.current !== null) {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      startedAtRef.current = null;
      const timer = window.setTimeout(() => setMeasuredSeconds(elapsed), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isSimulated, controlledSeconds, effectiveStatus]);

  const displaySeconds = isSimulated
    ? controlledSeconds ?? (reduced ? 7 : simSeconds)
    : controlledSeconds ?? measuredSeconds;

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const toggleOpen = useCallback(() => {
    const next = !isOpen;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, isOpen, onOpenChange]);

  const steps = useMemo(() => parseReasoning(effectiveReasoning), [effectiveReasoning]);

  // Track streamed chunks for live preview tail
  const liveText = useMemo(() => {
    if (steps.length === 0) return "";
    const last = steps[steps.length - 1];
    return last.text || last.title || "";
  }, [steps]);

  // Split live preview text into word chunks for fade-in
  const tailChunks = useMemo(() => {
    if (!liveText) return [];
    if (effectiveStatus !== "thinking" || reduced) return [liveText];
    return liveText.match(/\S+\s*/g) ?? [liveText];
  }, [liveText, effectiveStatus, reduced]);

  // Measure live preview overflow to apply top gradient mask & smooth glide
  const liveSlotRef = useRef<HTMLDivElement>(null);
  const liveTailRef = useRef<HTMLDivElement>(null);
  const [liveOverflow, setLiveOverflow] = useState(false);

  useLayoutEffect(() => {
    const slot = liveSlotRef.current;
    const tail = liveTailRef.current;
    if (!slot || !tail) return;
    const check = () => {
      setLiveOverflow(tail.scrollHeight > slot.clientHeight + 2);
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(tail);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [tailChunks]);

  // Copy reasoning button state
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const text = stepsToPlainText(steps);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be unavailable
    }
    setCopied(true);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
  }, [steps]);

  // Status announcement derived from status changes only
  const announcement = useMemo(() => {
    if (effectiveStatus === "thinking") {
      return `${model.name} is thinking.`;
    }
    if (effectiveStatus === "done") {
      return displaySeconds != null
        ? `Thought for ${formatDurationSpoken(displaySeconds)}.`
        : "Thought process complete.";
    }
    if (effectiveStatus === "stopped") {
      return displaySeconds != null
        ? `Stopped after ${formatDurationSpoken(displaySeconds)}.`
        : "Thinking stopped.";
    }
    return error ? `Thinking interrupted. ${error}` : "Thinking interrupted.";
    // Intentionally omit displaySeconds while thinking so live region only fires on status transitions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStatus, error, model.name]);

  const handleStopClick = useCallback(() => {
    if (onStop) {
      onStop();
    } else if (isSimulated) {
      setSimStatus("stopped");
    }
  }, [onStop, isSimulated]);

  const showLivePreview = effectiveStatus === "thinking" && !isOpen && liveText.length > 0;
  const showStop = effectiveStatus === "thinking" && (Boolean(onStop) || isSimulated);
  const showRetry = effectiveStatus === "error" && Boolean(onRetry);

  const labelText =
    effectiveStatus === "thinking"
      ? "Thinking"
      : effectiveStatus === "done"
        ? displaySeconds != null
          ? `Thought for ${formatDuration(displaySeconds)}`
          : "Thought process"
        : effectiveStatus === "stopped"
          ? displaySeconds != null
            ? `Stopped after ${formatDuration(displaySeconds)}`
            : "Stopped"
          : "Thinking interrupted";

  const panelId = `${uid}-panel`;
  const labelId = `${uid}-label`;

  const heightSpring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, visualDuration: 0.26, bounce: 0 };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${model.name} reasoning`}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-variant={variant}
      data-status={effectiveStatus}
      data-open={isOpen ? "" : undefined}
    >
      {isSimulated && (
        <span className={styles.srOnly}>Simulated, nothing was sent to a model.</span>
      )}

      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <div className={styles.top} data-expandable="true">
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-labelledby={labelId}
          onClick={toggleOpen}
        />

        <div className={styles.head}>
          <span className={styles.mark} aria-hidden="true">
            {model.mark ?? <ClaudeMark title={model.name} />}
          </span>

          <div className={styles.label} id={labelId}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={effectiveStatus}
                className={styles.labelInner}
                initial={reduced ? false : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -2 }}
                transition={{
                  duration: reduced ? 0 : motionTokens.duration.fast,
                  ease: motionTokens.ease.enter,
                }}
              >
                {effectiveStatus === "error" && (
                  <AlertCircle size={14} className={styles.alert} aria-hidden="true" />
                )}
                {effectiveStatus === "thinking" ? (
                  <TextShimmer active={!reduced && inView && pageVisible} className={styles.shimmer}>
                    Thinking
                  </TextShimmer>
                ) : (
                  <span className={styles.labelText}>{labelText}</span>
                )}
                {effectiveStatus === "thinking" && displaySeconds != null && (
                  <span className={styles.counter} aria-hidden="true">
                    <span className={styles.counterValue}>
                      {formatDuration(displaySeconds)}
                    </span>
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className={styles.actions}>
            {showStop && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.action}
                onClick={handleStopClick}
                aria-label="Stop thinking"
              >
                <Square size={10} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                <span>Stop</span>
              </Button>
            )}
            {showRetry && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.action}
                onClick={onRetry}
                aria-label="Retry"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Retry</span>
              </Button>
            )}
          </div>

          <ChevronDown size={15} className={styles.chevron} aria-hidden="true" />
        </div>

        <AnimatePresence initial={false}>
          {showLivePreview && (
            <motion.div
              key="live-preview"
              className={styles.liveClip}
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={heightSpring}
              aria-hidden="true"
            >
              <div className={styles.live}>
                <div className={styles.liveLayer}>
                  <div
                    ref={liveSlotRef}
                    className={styles.liveSlot}
                    data-overflow={liveOverflow ? "" : undefined}
                  >
                    <div ref={liveTailRef} className={styles.liveTail}>
                      {tailChunks.map((chunk, idx) => (
                        <span key={idx} className={styles.chunk}>
                          {chunk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={labelId}
            aria-busy={effectiveStatus === "thinking"}
            className={styles.panelClip}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={heightSpring}
          >
            <div className={styles.panel}>
              {steps.length > 0 && (
                <ol className={styles.steps}>
                  {steps.map((step, idx) => {
                    const isCurrent =
                      effectiveStatus === "thinking" && idx === steps.length - 1;
                    const paragraphs = splitParagraphs(step.text);
                    return (
                      <li
                        key={`${step.title ?? "step"}-${idx}`}
                        className={styles.step}
                        data-current={isCurrent ? "" : undefined}
                      >
                        <span className={styles.dot} aria-hidden="true" />
                        {step.title && <h4 className={styles.stepTitle}>{step.title}</h4>}
                        {paragraphs.map((p, pIdx) => (
                          <p key={pIdx} className={styles.para}>
                            {p}
                          </p>
                        ))}
                      </li>
                    );
                  })}
                </ol>
              )}

              {effectiveStatus !== "thinking" && (
                <div className={styles.foot} data-status={effectiveStatus}>
                  <span className={styles.footIcon} aria-hidden="true">
                    {effectiveStatus === "done" ? (
                      <Check size={14} />
                    ) : effectiveStatus === "stopped" ? (
                      <Square size={10} fill="currentColor" strokeWidth={0} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                  </span>
                  <span className={styles.footText}>
                    {effectiveStatus === "done"
                      ? "Done"
                      : effectiveStatus === "stopped"
                        ? "Stopped"
                        : error || "Connection lost before the model finished."}
                  </span>
                  {steps.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${styles.action} ${styles.copy}`}
                      onClick={handleCopy}
                      aria-label={copied ? "Copied reasoning" : "Copy reasoning"}
                    >
                      {copied ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        <Copy size={12} aria-hidden="true" />
                      )}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
