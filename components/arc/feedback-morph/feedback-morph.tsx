"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Angry,
  Check,
  Frown,
  Laugh,
  Meh,
  MessageSquare,
  Smile,
  X,
} from "lucide-react";
import styles from "./feedback-morph.module.css";

export interface FeedbackMood {
  value: string;
  label: string;
  icon: ReactNode;
  prompt: string;
}

export interface FeedbackMorphProps {
  label?: string;
  title?: string;
  moods?: FeedbackMood[];
  placeholder?: string;
  maxLength?: number;
  successLabel?: string;
  onSubmit?: (feedback: {
    mood: string | null;
    message: string;
  }) => void | Promise<unknown>;
  resetAfter?: number;
  side?: "bottom" | "top";
  align?: "start" | "center" | "end";
  className?: string;
}

const DEFAULT_MOODS: FeedbackMood[] = [
  {
    value: "terrible",
    label: "Terrible",
    icon: <Angry size={18} aria-hidden="true" />,
    prompt: "What went wrong?",
  },
  {
    value: "bad",
    label: "Bad",
    icon: <Frown size={18} aria-hidden="true" />,
    prompt: "What tripped you up?",
  },
  {
    value: "okay",
    label: "Okay",
    icon: <Meh size={18} aria-hidden="true" />,
    prompt: "What could be better?",
  },
  {
    value: "good",
    label: "Good",
    icon: <Smile size={18} aria-hidden="true" />,
    prompt: "What worked well?",
  },
  {
    value: "great",
    label: "Great",
    icon: <Laugh size={18} aria-hidden="true" />,
    prompt: "What stood out?",
  },
];

type Phase = "idle" | "open" | "sending" | "sent";

export function FeedbackMorph({
  label = "Send feedback",
  title = "How is it going?",
  moods = DEFAULT_MOODS,
  placeholder = "Tell us what you think",
  maxLength = 500,
  successLabel = "Thanks, we read every note",
  onSubmit,
  resetAfter = 3200,
  side = "bottom",
  align = "center",
  className,
}: FeedbackMorphProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  const titleId = `${id}-title`;

  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const moodRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const resetTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState("");

  const activeMoodObj = moods.find((m) => m.value === selectedMood) ?? null;
  const effectivePlaceholder = activeMoodObj?.prompt || placeholder;
  const canSubmit =
    phase === "open" && (selectedMood !== null || message.trim().length > 0);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearResetTimer();
  }, [clearResetTimer]);

  const closePanel = useCallback((returnFocus: boolean) => {
    setErrorText(null);
    setPhase("idle");
    if (returnFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  // Outside click closes while preserving draft
  useEffect(() => {
    if (phase !== "open") return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closePanel(false);
      }
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, closePanel]);

  // Focus textarea when opening
  useEffect(() => {
    if (phase === "open") {
      const raf = requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [phase]);

  const handleOpen = () => {
    clearResetTimer();
    setErrorText(null);
    setPhase("open");
  };

  const handleMoodKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (moods.length === 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (idx + 1) % moods.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (idx - 1 + moods.length) % moods.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = moods.length - 1;
    }
    if (next >= 0) {
      e.preventDefault();
      setSelectedMood(moods[next].value);
      moodRefs.current[next]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorText(null);
    setPhase("sending");
    setStatusAnnouncement("Sending feedback");

    try {
      await onSubmit?.({ mood: selectedMood, message: message.trim() });
      setPhase("sent");
      setStatusAnnouncement(successLabel);
      setSelectedMood(null);
      setMessage("");
      clearResetTimer();
      resetTimerRef.current = window.setTimeout(() => {
        setPhase("idle");
      }, resetAfter);
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Could not send feedback. Please try again.";
      setErrorText(msg);
      setStatusAnnouncement(msg);
      setPhase("open");
    }
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const springTransition = reducedMotion
    ? { duration: 0.14 }
    : { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 };

  const fadeTransition = reducedMotion
    ? { duration: 0.12 }
    : { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

  const activeMoodIndex = moods.findIndex((m) => m.value === selectedMood);
  const rovingIndex = activeMoodIndex >= 0 ? activeMoodIndex : 0;

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-side={side}
      data-align={align}
      data-phase={phase}
    >
      {/* Ghost keeps layout space anchored to the trigger pill */}
      <span className={`${styles.pill} ${styles.ghost}`} aria-hidden="true">
        <MessageSquare size={15} />
        <span>{label}</span>
      </span>

      <div className={styles.anchor}>
        <motion.div
          layout={!reducedMotion}
          transition={springTransition}
          className={styles.shape}
          style={{
            borderRadius: phase === "open" || phase === "sending" ? 20 : 9999,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === "idle" ? (
              <motion.button
                key="idle"
                ref={triggerRef}
                type="button"
                className={`${styles.pill} ${styles.trigger}`}
                aria-haspopup="dialog"
                aria-expanded={false}
                aria-controls={panelId}
                onClick={handleOpen}
                initial={{ opacity: 0, filter: reducedMotion ? "none" : "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: reducedMotion ? "none" : "blur(3px)" }}
                transition={fadeTransition}
              >
                <span className={styles.glyph} aria-hidden="true">
                  <MessageSquare size={15} />
                </span>
                <span>{label}</span>
              </motion.button>
            ) : phase === "sent" ? (
              <motion.div
                key="sent"
                className={`${styles.pill} ${styles.successPill}`}
                initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.94 }}
                transition={fadeTransition}
              >
                <span className={styles.successIcon} aria-hidden="true">
                  <Check size={15} strokeWidth={2.5} />
                </span>
                <span>{successLabel}</span>
              </motion.div>
            ) : (
              <motion.div
                key="panel"
                id={panelId}
                role="dialog"
                aria-labelledby={titleId}
                className={styles.panel}
                initial={{
                  opacity: 0,
                  scale: reducedMotion ? 1 : 0.95,
                  filter: reducedMotion ? "none" : "blur(4px)",
                }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  scale: reducedMotion ? 1 : 0.95,
                  filter: reducedMotion ? "none" : "blur(4px)",
                }}
                transition={fadeTransition}
              >
                <div className={styles.header}>
                  <p id={titleId} className={styles.title}>
                    {title}
                  </p>
                  <button
                    type="button"
                    className={styles.close}
                    aria-label="Close feedback"
                    onClick={() => closePanel(true)}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>

                {moods.length > 0 ? (
                  <div
                    className={styles.moodBar}
                    role="radiogroup"
                    aria-label="Mood"
                  >
                    {moods.map((m, idx) => {
                      const checked = selectedMood === m.value;
                      return (
                        <button
                          key={m.value}
                          ref={(el) => {
                            moodRefs.current[idx] = el;
                          }}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          aria-label={m.label}
                          title={m.label}
                          tabIndex={idx === rovingIndex ? 0 : -1}
                          className={styles.moodBtn}
                          onClick={() =>
                            setSelectedMood((prev) =>
                              prev === m.value ? null : m.value
                            )
                          }
                          onKeyDown={(e) => handleMoodKeyDown(e, idx)}
                        >
                          {m.icon}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className={styles.field}>
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder={effectivePlaceholder}
                    maxLength={maxLength}
                    disabled={phase === "sending"}
                    aria-label={title}
                  />
                  {errorText ? (
                    <p className={styles.error} role="alert">
                      {errorText}
                    </p>
                  ) : null}
                </div>

                <div className={styles.footer}>
                  <span className={styles.hint}>
                    {message.length > maxLength * 0.75
                      ? `${message.length}/${maxLength}`
                      : "⌘↵ to send"}
                  </span>
                  <button
                    type="button"
                    className={styles.submit}
                    disabled={!canSubmit || phase === "sending"}
                    onClick={() => void handleSubmit()}
                  >
                    {phase === "sending" ? "Sending…" : "Send"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {statusAnnouncement}
      </span>
    </div>
  );
}
