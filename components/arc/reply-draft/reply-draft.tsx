"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { motionTokens } from "../motion-tokens";
import {
  replyDraftSampleMessage,
  replyDraftSampleSuggestions,
  simulateReplyDraft,
} from "./reply-draft-data";
import type {
  ReplyDraftLength,
  ReplyDraftMessage,
  ReplyDraftRequest,
  ReplyDraftSuggestion,
  ReplyDraftTone,
} from "./reply-draft-data";
import styles from "./reply-draft.module.css";

export type {
  ReplyDraftLength,
  ReplyDraftMessage,
  ReplyDraftRequest,
  ReplyDraftSuggestion,
  ReplyDraftTone,
};

export interface ReplyDraftModel {
  name: string;
  mark?: ReactNode;
}

export interface ReplyDraftMeta {
  tone: ReplyDraftTone;
  length: ReplyDraftLength;
  suggestion?: ReplyDraftSuggestion;
}

export interface ReplyDraftProps {
  message?: ReplyDraftMessage;
  suggestions?: ReplyDraftSuggestion[];
  defaultSuggestion?: string;
  onSuggestionSelect?: (suggestion: ReplyDraftSuggestion) => void;
  model?: ReplyDraftModel;
  tone?: ReplyDraftTone;
  defaultTone?: ReplyDraftTone;
  onToneChange?: (tone: ReplyDraftTone) => void;
  length?: ReplyDraftLength;
  defaultLength?: ReplyDraftLength;
  onLengthChange?: (length: ReplyDraftLength) => void;
  generate?: (request: ReplyDraftRequest) => Promise<string> | AsyncIterable<string>;
  onInsert?: (draft: string, meta: ReplyDraftMeta) => void | Promise<void>;
  onDraft?: (draft: string, meta: ReplyDraftMeta) => void;
  autoStart?: boolean;
  autoPlay?: boolean;
  className?: string;
}

type DraftPhase =
  | "idle"
  | "drafting"
  | "rewriting"
  | "ready"
  | "inserting"
  | "inserted"
  | "error";

const TONES: Array<{ id: ReplyDraftTone; label: string }> = [
  { id: "friendly", label: "Friendly" },
  { id: "concise", label: "Concise" },
  { id: "formal", label: "Formal" },
];

const LENGTHS: Array<{ id: ReplyDraftLength; label: string }> = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.25c.55 0 1 .45 1 1v5.1l3.6-3.6a1 1 0 1 1 1.42 1.42l-3.6 3.6h5.33a1 1 0 1 1 0 2h-5.33l3.6 3.6a1 1 0 1 1-1.42 1.42l-3.6-3.6v5.56a1 1 0 1 1-2 0v-5.56l-3.6 3.6a1 1 0 0 1-1.42-1.42l3.6-3.6H4.25a1 1 0 1 1 0-2h5.33l-3.6-3.6A1 1 0 0 1 7.4 4.75l3.6 3.6v-5.1c0-.55.45-1 1-1Z" />
    </svg>
  );
}

function GmailMark() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 18" fill="none" aria-hidden="true">
      <path
        d="M2.2 18h3.4V8.8L0 4.6V15.8C0 17.02.98 18 2.2 18Z"
        fill="#4285F4"
      />
      <path
        d="M18.4 18h3.4c1.22 0 2.2-.98 2.2-2.2V4.6l-5.6 4.2V18Z"
        fill="#34A853"
      />
      <path
        d="M18.4 2.2v6.6L24 4.6V3c0-2.48-2.83-3.9-4.8-2.4L18.4 2.2Z"
        fill="#FBBC04"
      />
      <path
        d="M5.6 8.8V2.2L12 7l6.4-4.8v6.6L12 13.6 5.6 8.8Z"
        fill="#EA4335"
      />
      <path
        d="M0 3v1.6l5.6 4.2V2.2L4.8 1.6C2.83.1 0 1.52 0 3Z"
        fill="#C5221F"
      />
    </svg>
  );
}

function splitIntoChunks(text: string): string[] {
  const tokens = text.match(/\S+\s*/g);
  if (!tokens) return text ? [text] : [];
  const chunks: string[] = [];
  let i = 0;
  let step = 0;
  while (i < tokens.length) {
    const size = 3 + ((step * 3 + 2) % 6); // 3 to 8 words
    chunks.push(tokens.slice(i, i + size).join(""));
    i += size;
    step += 1;
  }
  return chunks;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value
  );
}

export function ReplyDraft({
  message = replyDraftSampleMessage,
  suggestions = replyDraftSampleSuggestions,
  defaultSuggestion,
  onSuggestionSelect,
  model = { name: "Claude Sonnet 5.5" },
  tone: controlledTone,
  defaultTone = "friendly",
  onToneChange,
  length: controlledLength,
  defaultLength = "medium",
  onLengthChange,
  generate,
  onInsert,
  onDraft,
  autoStart = true,
  autoPlay: autoPlayProp,
  className,
}: ReplyDraftProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const bodyInnerRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);

  const resolvedAutoPlay = autoPlayProp ?? !generate;
  const [uncontrolledTone, setUncontrolledTone] =
    useState<ReplyDraftTone>(defaultTone);
  const [uncontrolledLength, setUncontrolledLength] =
    useState<ReplyDraftLength>(defaultLength);

  const activeTone = controlledTone ?? uncontrolledTone;
  const activeLength = controlledLength ?? uncontrolledLength;

  const [selectedSuggestionId, setSelectedSuggestionId] = useState<
    string | undefined
  >(defaultSuggestion ?? suggestions[0]?.id);

  const activeSuggestion = useMemo(
    () => suggestions.find((s) => s.id === selectedSuggestionId),
    [selectedSuggestionId, suggestions],
  );

  const [phase, setPhase] = useState<DraftPhase>("idle");
  const [chunks, setChunks] = useState<string[]>([]);
  const [finalText, setFinalText] = useState("");
  const [draftVersion, setDraftVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [holdHeight, setHoldHeight] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);
  const finalTextRef = useRef(finalText);
  const phaseRef = useRef(phase);

  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Measure body inner height for smooth height spring
  useEffect(() => {
    const el = bodyInnerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const h = el.offsetHeight;
      if (h > 0) setMeasuredHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track visibility via IntersectionObserver
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        setInView(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runGeneration = useCallback(
    async (opts: {
      tone: ReplyDraftTone;
      length: ReplyDraftLength;
      suggestion?: ReplyDraftSuggestion;
      mode: "draft" | "rewrite";
      hold?: boolean;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (opts.hold && measuredHeight) {
        setHoldHeight(measuredHeight);
      } else {
        setHoldHeight(null);
      }

      setErrorMessage("");
      setPhase(opts.mode === "rewrite" ? "rewriting" : "drafting");
      setAnnouncement(
        opts.mode === "rewrite" ? "Rewriting reply." : "Drafting reply.",
      );
      if (opts.mode === "draft") {
        setChunks([]);
      }

      const request: ReplyDraftRequest = {
        message,
        tone: opts.tone,
        length: opts.length,
        suggestion: opts.suggestion,
        mode: opts.mode,
        previous: finalTextRef.current,
        signal: controller.signal,
      };

      try {
        const fn = generate ?? simulateReplyDraft;
        const result = fn(request);

        let full = "";
        if (isAsyncIterable(result)) {
          const collected: string[] = [];
          for await (const delta of result) {
            if (controller.signal.aborted) return;
            full += delta;
            if (opts.mode === "draft" && !reduced) {
              collected.push(delta);
              setChunks([...collected]);
            }
          }
        } else {
          full = await result;
          if (controller.signal.aborted) return;

          if (opts.mode === "draft" && !reduced) {
            const parts = splitIntoChunks(full);
            for (let i = 0; i < parts.length; i += 1) {
              if (controller.signal.aborted) return;
              setChunks(parts.slice(0, i + 1));
              await new Promise<void>((resolve, reject) => {
                const tid = window.setTimeout(resolve, 34);
                controller.signal.addEventListener("abort", () => {
                  window.clearTimeout(tid);
                  reject(new DOMException("Aborted", "AbortError"));
                });
              });
            }
          }
        }

        if (controller.signal.aborted) return;
        setFinalText(full);
        setChunks([]);
        setDraftVersion((v) => v + 1);
        setHoldHeight(null);
        setPhase("ready");
        setAnnouncement("Draft ready.");
        onDraft?.(full, {
          tone: opts.tone,
          length: opts.length,
          suggestion: opts.suggestion,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "Could not generate a reply.";
        setErrorMessage(msg);
        setHoldHeight(null);
        setPhase("error");
        setAnnouncement(`Draft failed: ${msg}`);
      }
    },
    [generate, measuredHeight, message, onDraft, reduced],
  );

  // Sync contentEditable text when a new draft finishes
  useEffect(() => {
    if (phase === "ready" && editableRef.current) {
      if (editableRef.current.textContent !== finalText) {
        editableRef.current.textContent = finalText;
      }
    }
  }, [draftVersion, finalText, phase]);

  // Auto-start first draft on entering viewport
  useEffect(() => {
    if (!inView || !autoStart || startedRef.current) return;
    startedRef.current = true;
    const t = window.setTimeout(() => {
      void runGeneration({
        tone: activeTone,
        length: activeLength,
        suggestion: activeSuggestion,
        mode: "draft",
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [
    activeLength,
    activeSuggestion,
    activeTone,
    autoStart,
    inView,
    runGeneration,
  ]);

  const handleToneSelect = useCallback(
    (nextTone: ReplyDraftTone, fromUser = true) => {
      if (fromUser) setUserInteracted(true);
      if (nextTone === activeTone) return;
      if (controlledTone === undefined) setUncontrolledTone(nextTone);
      onToneChange?.(nextTone);
      const isRewrite =
        phaseRef.current === "ready" || phaseRef.current === "inserted";
      void runGeneration({
        tone: nextTone,
        length: activeLength,
        suggestion: activeSuggestion,
        mode: isRewrite ? "rewrite" : "draft",
      });
    },
    [
      activeLength,
      activeSuggestion,
      activeTone,
      controlledTone,
      onToneChange,
      runGeneration,
    ],
  );

  const handleLengthSelect = useCallback(
    (nextLength: ReplyDraftLength, fromUser = true) => {
      if (fromUser) setUserInteracted(true);
      if (nextLength === activeLength) return;
      if (controlledLength === undefined) setUncontrolledLength(nextLength);
      onLengthChange?.(nextLength);
      const isRewrite =
        phaseRef.current === "ready" || phaseRef.current === "inserted";
      void runGeneration({
        tone: activeTone,
        length: nextLength,
        suggestion: activeSuggestion,
        mode: isRewrite ? "rewrite" : "draft",
      });
    },
    [
      activeLength,
      activeSuggestion,
      activeTone,
      controlledLength,
      onLengthChange,
      runGeneration,
    ],
  );

  const handleSuggestionClick = useCallback(
    (s: ReplyDraftSuggestion, fromUser = true) => {
      if (fromUser) setUserInteracted(true);
      setSelectedSuggestionId(s.id);
      onSuggestionSelect?.(s);
      void runGeneration({
        tone: activeTone,
        length: activeLength,
        suggestion: s,
        mode: "draft",
      });
    },
    [activeLength, activeTone, onSuggestionSelect, runGeneration],
  );

  const handleInsert = useCallback(
    async (fromUser = true) => {
      if (fromUser) setUserInteracted(true);
      if (phaseRef.current !== "ready") return;
      const text = editableRef.current?.textContent ?? finalTextRef.current;
      setFinalText(text);
      setPhase("inserting");
      try {
        if (onInsert) {
          await onInsert(text, {
            tone: activeTone,
            length: activeLength,
            suggestion: activeSuggestion,
          });
          setPhase("inserted");
          setAnnouncement("Draft inserted.");
        } else {
          await new Promise<void>((r) => window.setTimeout(r, 260));
          setPhase("inserted");
          setAnnouncement("Draft inserted. Nothing was sent.");
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not insert draft.";
        setErrorMessage(msg);
        setPhase("error");
        setAnnouncement(`Insert failed: ${msg}`);
      }
    },
    [activeLength, activeSuggestion, activeTone, onInsert],
  );

  // AutoPlay demo tour (stops on first user interaction, pauses off-screen)
  useEffect(() => {
    if (!resolvedAutoPlay || userInteracted || !inView || reduced) return;
    if (phase !== "ready" && phase !== "inserted") return;

    const timer = window.setTimeout(() => {
      if (phase === "inserted") {
        // Loop back to initial friendly medium Thursday
        if (controlledTone === undefined) setUncontrolledTone("friendly");
        if (controlledLength === undefined) setUncontrolledLength("medium");
        const first = suggestions[0];
        setSelectedSuggestionId(first?.id);
        void runGeneration({
          tone: "friendly",
          length: "medium",
          suggestion: first,
          mode: "draft",
        });
        return;
      }
      if (activeTone === "friendly" && activeLength === "medium") {
        handleToneSelect("concise", false);
      } else if (activeTone === "concise" && activeLength === "medium") {
        handleLengthSelect("short", false);
      } else if (
        suggestions[1] &&
        selectedSuggestionId === suggestions[0]?.id
      ) {
        handleSuggestionClick(suggestions[1], false);
      } else {
        void handleInsert(false);
      }
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [
    activeLength,
    activeTone,
    controlledLength,
    controlledTone,
    handleInsert,
    handleLengthSelect,
    handleSuggestionClick,
    handleToneSelect,
    inView,
    phase,
    reduced,
    resolvedAutoPlay,
    runGeneration,
    selectedSuggestionId,
    suggestions,
    userInteracted,
  ]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      setUserInteracted(true);
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (phaseRef.current === "ready") {
          event.preventDefault();
          void handleInsert(true);
        }
      }
    },
    [handleInsert],
  );

  const handleRadioKeyDown = useCallback(
    <T extends string>(
      event: KeyboardEvent<HTMLButtonElement>,
      items: Array<{ id: T }>,
      current: T,
      onSelect: (id: T) => void,
    ) => {
      const idx = items.findIndex((i) => i.id === current);
      if (idx < 0) return;
      let nextIdx = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIdx = (idx + 1) % items.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIdx = (idx - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        nextIdx = 0;
      } else if (event.key === "End") {
        nextIdx = items.length - 1;
      }
      if (nextIdx >= 0) {
        event.preventDefault();
        onSelect(items[nextIdx].id);
        const group = event.currentTarget.parentElement;
        const buttons = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        buttons?.[nextIdx]?.focus();
      }
    },
    [],
  );

  const paragraphs = useMemo(
    () => message.body.split(/\n\s*\n/).filter(Boolean),
    [message.body],
  );

  const targetHeight = holdHeight ?? measuredHeight;
  const isBusy = phase === "drafting" || phase === "rewriting";

  return (
    <article
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={`Email from ${message.from.name}`}
      onPointerDown={() => setUserInteracted(true)}
      onKeyDown={handleCardKeyDown}
    >
      <div className={styles.card}>
        <div className={styles.mailHead}>
          <h3 className={styles.subject}>{message.subject}</h3>
          <span className={styles.source} aria-hidden="true">
            <GmailMark />
          </span>
        </div>

        <div className={styles.sender}>
          <Avatar
            name={message.from.name}
            src={message.from.avatar}
            size="sm"
            className={styles.avatar}
          />
          <div className={styles.senderText}>
            <div className={styles.senderLine}>
              <span className={styles.senderName}>{message.from.name}</span>
              <span className={styles.senderEmail}>{message.from.email}</span>
            </div>
            {message.to && <span className={styles.meta}>to {message.to}</span>}
          </div>
          <span className={styles.time}>{message.receivedAt}</span>
        </div>

        <div className={styles.mailBody}>
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>

        <section className={styles.reply} aria-label="AI reply draft">
          {suggestions.length > 0 && (
            <div className={styles.suggestions} role="group" aria-label="Quick replies">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.suggestion}
                  aria-pressed={selectedSuggestionId === s.id}
                  onClick={() => handleSuggestionClick(s, true)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className={styles.draft} data-phase={phase}>
            <div className={styles.draftHead}>
              <div className={styles.model}>
                <span className={styles.modelMark}>
                  {model.mark ?? <ClaudeMark />}
                </span>
                <span className={styles.modelName}>{model.name}</span>
              </div>

              <div className={styles.status}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={phase}
                    className={styles.statusItem}
                    data-phase={phase}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{
                      duration: reduced ? 0 : 0.14,
                      ease: motionTokens.ease.standard,
                    }}
                  >
                    {phase === "drafting" && (
                      <span className={styles.shimmer}>Drafting…</span>
                    )}
                    {phase === "rewriting" && (
                      <span className={styles.shimmer}>Rewriting…</span>
                    )}
                    {phase === "ready" && (
                      <>
                        <Check size={13} aria-hidden="true" />
                        <span>Draft ready</span>
                      </>
                    )}
                    {phase === "inserting" && (
                      <>
                        <Loader2 size={13} className={styles.spinner} aria-hidden="true" />
                        <span>Inserting…</span>
                      </>
                    )}
                    {phase === "inserted" && (
                      <>
                        <Check size={13} aria-hidden="true" />
                        <span>Inserted</span>
                      </>
                    )}
                    {phase === "error" && (
                      <>
                        <AlertCircle size={13} aria-hidden="true" />
                        <span>Couldn&apos;t draft</span>
                      </>
                    )}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            <motion.div
              className={styles.bodyClip}
              animate={targetHeight ? { height: targetHeight } : undefined}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", visualDuration: 0.24, bounce: 0 }
              }
            >
              <div
                ref={bodyInnerRef}
                className={styles.body}
                aria-busy={isBusy}
              >
                {phase === "idle" && (
                  <p className={styles.placeholder}>
                    Pick a quick reply or draft a response with {model.name}.
                  </p>
                )}

                {phase === "error" && (
                  <div className={styles.errorBlock} role="alert">
                    <AlertCircle size={15} aria-hidden="true" />
                    <div>
                      <div className={styles.errorTitle}>Draft failed</div>
                      <div className={styles.errorCopy}>{errorMessage}</div>
                    </div>
                  </div>
                )}

                {phase === "drafting" && chunks.length === 0 && (
                  <div className={styles.skeleton} aria-hidden="true">
                    <span style={{ width: "32%" }} />
                    <span style={{ width: "94%" }} />
                    <span style={{ width: "78%" }} />
                  </div>
                )}

                {phase === "drafting" && chunks.length > 0 && (
                  <div className={styles.textLayer}>
                    <div className={styles.text}>
                      {chunks.map((c, idx) => (
                        <span key={idx} className={styles.chunk}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(phase === "rewriting" ||
                  phase === "ready" ||
                  phase === "inserting" ||
                  phase === "inserted") && (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={draftVersion}
                      className={styles.textLayer}
                      initial={reduced ? false : { opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.16,
                        ease: motionTokens.ease.standard,
                      }}
                    >
                      <div
                        ref={editableRef}
                        role="textbox"
                        aria-multiline="true"
                        aria-label="Reply draft"
                        contentEditable={phase === "ready" ? "plaintext-only" : false}
                        suppressContentEditableWarning
                        className={styles.text}
                        data-editable={phase === "ready" ? "" : undefined}
                        data-dimmed={phase === "rewriting" ? "" : undefined}
                        onInput={(e) => {
                          setFinalText(e.currentTarget.textContent ?? "");
                        }}
                      >
                        {finalText}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </motion.div>

            <div className={styles.controls}>
              <div
                className={styles.chipGroup}
                role="radiogroup"
                aria-label="Tone"
              >
                {TONES.map((t) => {
                  const selected = activeTone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      className={styles.option}
                      data-selected={selected ? "" : undefined}
                      onClick={() => handleToneSelect(t.id, true)}
                      onKeyDown={(e) =>
                        handleRadioKeyDown(e, TONES, activeTone, (id) =>
                          handleToneSelect(id, true),
                        )
                      }
                    >
                      {selected && (
                        <motion.span
                          layoutId={`rd-tone-${uid}`}
                          className={styles.optionHighlight}
                          transition={
                            reduced
                              ? { duration: 0 }
                              : { type: "spring", visualDuration: 0.22, bounce: 0 }
                          }
                        />
                      )}
                      <span className={styles.optionLabel}>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <span className={styles.divider} aria-hidden="true" />

              <div
                className={styles.chipGroup}
                role="radiogroup"
                aria-label="Length"
              >
                {LENGTHS.map((l) => {
                  const selected = activeLength === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      className={styles.option}
                      data-selected={selected ? "" : undefined}
                      onClick={() => handleLengthSelect(l.id, true)}
                      onKeyDown={(e) =>
                        handleRadioKeyDown(e, LENGTHS, activeLength, (id) =>
                          handleLengthSelect(id, true),
                        )
                      }
                    >
                      {selected && (
                        <motion.span
                          layoutId={`rd-length-${uid}`}
                          className={styles.optionHighlight}
                          transition={
                            reduced
                              ? { duration: 0 }
                              : { type: "spring", visualDuration: 0.22, bounce: 0 }
                          }
                        />
                      )}
                      <span className={styles.optionLabel}>{l.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            {phase === "idle" ? (
              <Button
                variant="secondary"
                size="sm"
                className={styles.draftButton}
                onClick={() => {
                  setUserInteracted(true);
                  void runGeneration({
                    tone: activeTone,
                    length: activeLength,
                    suggestion: activeSuggestion,
                    mode: "draft",
                  });
                }}
              >
                <Sparkles size={14} aria-hidden="true" />
                Draft reply
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className={styles.footerButton}
                disabled={isBusy || phase === "inserting"}
                onClick={() => {
                  setUserInteracted(true);
                  void runGeneration({
                    tone: activeTone,
                    length: activeLength,
                    suggestion: activeSuggestion,
                    mode: "draft",
                    hold: true,
                  });
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {phase === "error" ? "Try again" : "Regenerate"}
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              className={styles.insert}
              disabled={phase !== "ready"}
              onClick={() => void handleInsert(true)}
            >
              <span className={styles.swap}>
                <span data-on={phase !== "inserting" && phase !== "inserted" ? "" : undefined}>
                  Insert
                </span>
                <span data-on={phase === "inserting" ? "" : undefined}>
                  <Loader2 size={14} className={styles.spinner} aria-hidden="true" />
                  Insert
                </span>
                <span data-on={phase === "inserted" ? "" : undefined}>
                  <Check size={14} aria-hidden="true" />
                  Inserted
                </span>
              </span>
            </Button>
          </div>
        </section>
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </article>
  );
}
