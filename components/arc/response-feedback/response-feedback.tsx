"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../motion-tokens";
import styles from "./response-feedback.module.css";

export type FeedbackRating = "up" | "down" | null;

export interface FeedbackEvent {
  stage: "rating" | "details";
  rating: FeedbackRating;
  messageId?: string;
  reasons?: string[];
  comment?: string;
}

export interface FeedbackActionsProps {
  messageId?: string;
  rating?: FeedbackRating;
  defaultRating?: FeedbackRating;
  onRatingChange?: (rating: FeedbackRating) => void;
  onFeedback?: (
    event: FeedbackEvent,
    context: { signal: AbortSignal },
  ) => void | Promise<void>;
  negativeReasons?: string[];
  positiveReasons?: string[];
  allowComment?: boolean;
  commentPlaceholder?: string;
  commentMaxLength?: number;
  privacyNote?: ReactNode;
  thanksMessage?: ReactNode;
  thanksDuration?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export interface ResponseFeedbackModel {
  name: string;
  mark?: ReactNode;
}

export interface ResponseFeedbackProps extends Omit<FeedbackActionsProps, "leading"> {
  model?: ResponseFeedbackModel;
  prompt?: ReactNode | null;
  children?: ReactNode;
  copyText?: string | null;
  onRegenerate?: () => void;
}

const DEFAULT_NEGATIVE_REASONS = [
  "Inaccurate",
  "Not helpful",
  "Too long",
  "Unsafe",
  "Other",
];

const DEFAULT_POSITIVE_REASONS = [
  "Accurate",
  "Easy to follow",
  "Good examples",
  "Saved me time",
];

const DEFAULT_PROMPT =
  "Why did our orders query get slower after we added an index on created_at?";

const DEFAULT_COPY_TEXT = `The planner now prefers the new index to satisfy ORDER BY created_at, scanning backwards from the newest rows until it finds enough matches for your status filter. When matching rows are sparse, that reads most of the table in random order.

- Run EXPLAIN (ANALYZE, BUFFERS) and look for an Index Scan on orders_created_at_idx with a large Rows Removed by Filter.
- Replace it with a composite index on (status, created_at), so the filter and sort use one index.
- Run ANALYZE orders afterwards so the planner sees fresh statistics.`;

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.25c.55 0 1 .45 1 1v5.1l3.6-3.6a1 1 0 1 1 1.42 1.42l-3.6 3.6h5.33a1 1 0 1 1 0 2h-5.33l3.6 3.6a1 1 0 1 1-1.42 1.42l-3.6-3.6v5.56a1 1 0 1 1-2 0v-5.56l-3.6 3.6a1 1 0 0 1-1.42-1.42l3.6-3.6H4.25a1 1 0 1 1 0-2h5.33l-3.6-3.6A1 1 0 0 1 7.4 4.75l3.6 3.6v-5.1c0-.55.45-1 1-1Z" />
    </svg>
  );
}

function DefaultReplyBody() {
  return (
    <>
      <p>
        The planner now prefers the new index to satisfy{" "}
        <code>ORDER BY created_at</code>, scanning backwards from the newest
        rows until it finds enough matches for your status filter. When matching
        rows are sparse, that reads most of the table in random order.
      </p>
      <ul>
        <li>
          Run <code>EXPLAIN (ANALYZE, BUFFERS)</code> and look for an Index Scan
          on <code>orders_created_at_idx</code> with a large{" "}
          <code>Rows Removed by Filter</code>.
        </li>
        <li>
          Replace it with a composite index on <code>(status, created_at)</code>
          , so the filter and sort use one index.
        </li>
        <li>
          Run <code>ANALYZE orders</code> afterwards so the planner sees fresh
          statistics.
        </li>
      </ul>
    </>
  );
}

export function FeedbackActions({
  messageId,
  rating: controlledRating,
  defaultRating = null,
  onRatingChange,
  onFeedback,
  negativeReasons = DEFAULT_NEGATIVE_REASONS,
  positiveReasons = DEFAULT_POSITIVE_REASONS,
  allowComment = true,
  commentPlaceholder = "Add details (optional)",
  commentMaxLength = 1000,
  privacyNote = "Shares this reply for review",
  thanksMessage,
  thanksDuration = 1600,
  leading,
  trailing,
  disabled = false,
  className,
}: FeedbackActionsProps) {
  const reduced = useReducedMotion() ?? false;
  const panelId = useId();
  const [uncontrolledRating, setUncontrolledRating] =
    useState<FeedbackRating>(defaultRating);
  const rating =
    controlledRating !== undefined ? controlledRating : uncontrolledRating;

  const [panelView, setPanelView] = useState<"closed" | "form" | "thanks">(
    "closed",
  );
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const upButtonRef = useRef<HTMLButtonElement>(null);
  const downButtonRef = useRef<HTMLButtonElement>(null);
  const firstChipRef = useRef<HTMLButtonElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const panelInnerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number>(0);

  const abortRef = useRef<AbortController | null>(null);
  const thanksTimerRef = useRef<number | null>(null);
  const keyboardSubmitRef = useRef(false);
  const lastTriggerRef = useRef<"pointer" | "keyboard">("pointer");

  const clearThanksTimer = useCallback(() => {
    if (thanksTimerRef.current !== null) {
      window.clearTimeout(thanksTimerRef.current);
      thanksTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearThanksTimer();
    };
  }, [clearThanksTimer]);

  // Measure panel content height for smooth height spring
  useEffect(() => {
    const el = panelInnerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setPanelHeight(el.offsetHeight);
    });
    ro.observe(el);
    setPanelHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [panelView, rating, errorMsg]);

  const focusActiveThumb = useCallback((r: FeedbackRating) => {
    if (r === "up") upButtonRef.current?.focus();
    else if (r === "down") downButtonRef.current?.focus();
  }, []);

  const setRating = useCallback(
    (next: FeedbackRating) => {
      if (controlledRating === undefined) setUncontrolledRating(next);
      onRatingChange?.(next);
    },
    [controlledRating, onRatingChange],
  );

  const closePanel = useCallback(
    (returnFocus = false, targetRating: FeedbackRating = rating) => {
      abortRef.current?.abort();
      clearThanksTimer();
      setSending(false);
      setErrorMsg("");
      setPanelView("closed");
      if (returnFocus) {
        window.requestAnimationFrame(() => focusActiveThumb(targetRating));
      }
    },
    [clearThanksTimer, focusActiveThumb, rating],
  );

  const sendRatingStage = useCallback(
    (next: FeedbackRating) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (onFeedback) {
        void Promise.resolve(
          onFeedback(
            { stage: "rating", rating: next, messageId },
            { signal: controller.signal },
          ),
        ).catch(() => {
          // Rating-stage errors are non-blocking; details stage surfaces inline error.
        });
      }
    },
    [messageId, onFeedback],
  );

  const handleThumbClick = useCallback(
    (kind: "up" | "down") => {
      if (disabled) return;
      clearThanksTimer();
      setErrorMsg("");
      setSending(false);

      if (rating === kind) {
        setRating(null);
        setSelectedReasons([]);
        setComment("");
        setPanelView("closed");
        setAnnouncement("Rating cleared.");
        sendRatingStage(null);
        return;
      }

      setRating(kind);
      setSelectedReasons([]);
      setComment("");
      sendRatingStage(kind);

      const reasons = kind === "down" ? negativeReasons : positiveReasons;
      const shouldOpen = kind === "down" ? reasons.length > 0 || allowComment : reasons.length > 0;
      setPanelView(shouldOpen ? "form" : "closed");
      setAnnouncement(
        kind === "up"
          ? "Marked as good response."
          : "Marked as bad response.",
      );

      if (shouldOpen && kind === "down" && lastTriggerRef.current === "keyboard") {
        window.requestAnimationFrame(() => {
          firstChipRef.current?.focus();
        });
      }
    },
    [
      allowComment,
      clearThanksTimer,
      disabled,
      negativeReasons,
      positiveReasons,
      rating,
      sendRatingStage,
      setRating,
    ],
  );

  const toggleReason = useCallback((reason: string) => {
    setSelectedReasons((prev) => {
      const has = prev.includes(reason);
      const next = has ? prev.filter((r) => r !== reason) : [...prev, reason];
      if (!has && reason.toLowerCase() === "other") {
        window.requestAnimationFrame(() => commentRef.current?.focus());
      }
      return next;
    });
    setErrorMsg("");
  }, []);

  const handleSubmit = useCallback(
    async (viaKeyboard = false) => {
      if (sending || !rating) return;
      const trimmed = comment.trim();
      if (selectedReasons.length === 0 && !trimmed) return;

      keyboardSubmitRef.current = viaKeyboard;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSending(true);
      setErrorMsg("");
      setAnnouncement("Sending feedback.");

      try {
        if (onFeedback) {
          await onFeedback(
            {
              stage: "details",
              rating,
              messageId,
              reasons: selectedReasons,
              comment: trimmed || undefined,
            },
            { signal: controller.signal },
          );
        } else {
          await new Promise<void>((resolve, reject) => {
            const id = window.setTimeout(resolve, 200);
            controller.signal.addEventListener("abort", () => {
              window.clearTimeout(id);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }
        if (controller.signal.aborted) return;

        setSending(false);
        setPanelView("thanks");
        setAnnouncement(
          onFeedback
            ? "Thanks for the feedback."
            : "Thanks for the feedback. Simulated — nothing was sent.",
        );

        if (viaKeyboard) {
          window.requestAnimationFrame(() => thanksRef.current?.focus());
        }

        clearThanksTimer();
        thanksTimerRef.current = window.setTimeout(() => {
          setPanelView("closed");
          if (keyboardSubmitRef.current) {
            window.requestAnimationFrame(() => focusActiveThumb(rating));
          }
        }, thanksDuration);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "Couldn't send feedback.";
        setSending(false);
        setErrorMsg(msg);
        setAnnouncement(`Feedback failed: ${msg}`);
      }
    },
    [
      clearThanksTimer,
      comment,
      focusActiveThumb,
      messageId,
      onFeedback,
      rating,
      selectedReasons,
      sending,
      thanksDuration,
    ],
  );

  const handlePanelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel(true, rating);
      }
    },
    [closePanel, rating],
  );

  const reasons = rating === "down" ? negativeReasons : positiveReasons;
  const hasOther = selectedReasons.some((r) => r.toLowerCase() === "other");
  const canSubmit = selectedReasons.length > 0 || comment.trim().length > 0;
  const isOpen = panelView !== "closed";

  const resolvedThanksMessage =
    thanksMessage ??
    (onFeedback ? "It helps improve future replies." : "Simulated — nothing was sent.");

  return (
    <div
      className={[styles.feedback, className].filter(Boolean).join(" ")}
      onKeyDown={handlePanelKeyDown}
    >
      <div className={styles.row}>
        <div className={styles.actions}>
          {leading}

          <Tooltip content="Good response">
            <button
              ref={upButtonRef}
              type="button"
              className={styles.iconButton}
              aria-label="Good response"
              aria-pressed={rating === "up"}
              aria-expanded={rating === "up" && isOpen}
              aria-controls={panelId}
              data-active={rating === "up" ? "" : undefined}
              disabled={disabled}
              onPointerDown={() => {
                lastTriggerRef.current = "pointer";
              }}
              onKeyDown={() => {
                lastTriggerRef.current = "keyboard";
              }}
              onClick={() => handleThumbClick("up")}
            >
              <span className={styles.thumb} aria-hidden="true">
                <ThumbsUp size={16} strokeWidth={1.75} />
                <ThumbsUp
                  size={16}
                  strokeWidth={1.75}
                  fill="currentColor"
                  className={styles.thumbFill}
                />
              </span>
            </button>
          </Tooltip>

          <Tooltip content="Bad response">
            <button
              ref={downButtonRef}
              type="button"
              className={styles.iconButton}
              aria-label="Bad response"
              aria-pressed={rating === "down"}
              aria-expanded={rating === "down" && isOpen}
              aria-controls={panelId}
              data-active={rating === "down" ? "" : undefined}
              disabled={disabled}
              onPointerDown={() => {
                lastTriggerRef.current = "pointer";
              }}
              onKeyDown={() => {
                lastTriggerRef.current = "keyboard";
              }}
              onClick={() => handleThumbClick("down")}
            >
              <span className={styles.thumb} aria-hidden="true">
                <ThumbsDown size={16} strokeWidth={1.75} />
                <ThumbsDown
                  size={16}
                  strokeWidth={1.75}
                  fill="currentColor"
                  className={styles.thumbFill}
                />
              </span>
            </button>
          </Tooltip>
        </div>

        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            className={styles.panelClip}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={
              reduced
                ? { opacity: 1 }
                : { height: panelHeight > 0 ? panelHeight + 8 : "auto", opacity: 1 }
            }
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0.14 }
                : {
                    height: { type: "spring", visualDuration: 0.24, bounce: 0 },
                    opacity: { duration: 0.16, ease: motionTokens.ease.standard },
                  }
            }
          >
            <div className={styles.panelPad}>
              <div className={styles.panel}>
                <div ref={panelInnerRef} className={styles.panelInner}>
                  <AnimatePresence mode="wait" initial={false}>
                    {panelView === "form" ? (
                      <motion.form
                        key={`form-${rating}`}
                        className={styles.form}
                        initial={reduced ? false : { opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? undefined : { opacity: 0 }}
                        transition={{
                          duration: reduced ? 0 : 0.16,
                          ease: motionTokens.ease.standard,
                        }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSubmit(false);
                        }}
                      >
                        <div className={styles.head}>
                          <span className={styles.heading}>
                            {rating === "down"
                              ? "What went wrong?"
                              : "What was good?"}
                          </span>
                          <div className={styles.headRight}>
                            {rating === "up" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={styles.headAction}
                                onClick={() => closePanel(true, rating)}
                              >
                                Skip
                              </Button>
                            )}
                            <button
                              type="button"
                              className={styles.close}
                              aria-label="Close feedback"
                              onClick={() => closePanel(true, rating)}
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {reasons.length > 0 && (
                          <div
                            className={styles.chips}
                            role="group"
                            aria-label={
                              rating === "down"
                                ? "What went wrong"
                                : "What was good"
                            }
                          >
                            {reasons.map((reason, idx) => (
                              <button
                                key={reason}
                                ref={idx === 0 ? firstChipRef : undefined}
                                type="button"
                                className={styles.chip}
                                aria-pressed={selectedReasons.includes(reason)}
                                disabled={sending}
                                onClick={() => toggleReason(reason)}
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        )}

                        {rating === "down" && allowComment && (
                          <textarea
                            ref={commentRef}
                            className={styles.comment}
                            value={comment}
                            maxLength={commentMaxLength}
                            disabled={sending}
                            placeholder={
                              hasOther
                                ? "Tell us what went wrong"
                                : commentPlaceholder
                            }
                            aria-label="Feedback details"
                            onChange={(e) => {
                              setComment(e.target.value);
                              setErrorMsg("");
                            }}
                            onKeyDown={(e) => {
                              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                e.preventDefault();
                                void handleSubmit(true);
                              }
                            }}
                          />
                        )}

                        <div className={styles.footer}>
                          <div className={styles.swap}>
                            {errorMsg ? (
                              <div className={styles.swapItem} role="alert">
                                <span className={styles.error}>
                                  <AlertCircle size={14} aria-hidden="true" />
                                  <span className={styles.errorText}>
                                    {errorMsg}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <div
                                className={`${styles.swapItem} ${styles.noteCell}`}
                              >
                                {privacyNote && (
                                  <span className={styles.note}>
                                    {privacyNote}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className={styles.footActions}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`${styles.action} ${styles.cancel}`}
                              disabled={sending}
                              onClick={() => closePanel(true, rating)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              className={`${styles.action} ${styles.submit}`}
                              disabled={sending || !canSubmit}
                            >
                              {sending
                                ? "Sending…"
                                : errorMsg
                                  ? "Try again"
                                  : rating === "up"
                                    ? "Send"
                                    : "Submit"}
                            </Button>
                          </div>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.div
                        key="thanks"
                        ref={thanksRef}
                        tabIndex={-1}
                        className={styles.thanks}
                        initial={reduced ? false : { opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? undefined : { opacity: 0 }}
                        transition={{
                          duration: reduced ? 0 : 0.16,
                          ease: motionTokens.ease.standard,
                        }}
                      >
                        <span className={styles.thanksIcon} aria-hidden="true">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <motion.path
                              d="M3.25 8.5L6.5 11.75L12.75 4.75"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{
                                duration: reduced ? 0 : 0.28,
                                ease: motionTokens.ease.standard,
                              }}
                            />
                          </svg>
                        </span>
                        <span className={styles.thanksTitle}>
                          Thanks for the feedback
                        </span>
                        <span className={styles.muted}>
                          {resolvedThanksMessage}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

export function ResponseFeedback({
  model = { name: "Claude Sonnet 5.5" },
  prompt = DEFAULT_PROMPT,
  children,
  copyText = DEFAULT_COPY_TEXT,
  onRegenerate,
  className,
  ...feedbackProps
}: ResponseFeedbackProps) {
  const leading = (
    <>
      {copyText !== null && (
        <CopyButton
          value={copyText}
          iconOnly
          variant="plain"
          label="Copy reply"
          className={styles.copy}
        />
      )}
      {onRegenerate && (
        <Tooltip content="Regenerate">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Regenerate response"
            onClick={onRegenerate}
          >
            <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </>
  );

  return (
    <article
      className={[styles.card, className].filter(Boolean).join(" ")}
      aria-label={`Reply from ${model.name}`}
    >
      {prompt !== null && (
        <div className={styles.prompt}>
          <p className={styles.bubble}>{prompt}</p>
        </div>
      )}

      <div className={styles.reply}>
        <div className={styles.author}>
          <span className={styles.mark}>{model.mark ?? <ClaudeMark />}</span>
          <span className={styles.modelName}>{model.name}</span>
        </div>

        <div className={styles.body}>
          {children ?? <DefaultReplyBody />}
        </div>

        <FeedbackActions leading={leading} {...feedbackProps} />
      </div>
    </article>
  );
}
