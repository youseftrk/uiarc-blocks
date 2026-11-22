"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./ghost-text.module.css";

export type GhostTextStatus = "idle" | "loading" | "ready" | "error";

export type GhostSuggestFn = (
  text: string,
  signal: AbortSignal
) =>
  | string
  | null
  | Promise<string | null>
  | AsyncIterable<string>;

export interface GhostTextModel {
  name: string;
  mark?: ReactNode;
}

export interface GhostTextHandle {
  focus: () => void;
  acceptAll: () => void;
  acceptWord: () => void;
  dismiss: () => void;
  request: () => void;
  getState: () => {
    status: GhostTextStatus;
    suggestion: string;
    streaming: boolean;
  };
}

export interface GhostTextProps {
  suggest?: GhostSuggestFn;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  delay?: number;
  minLength?: number;
  multiline?: boolean;
  variant?: "field" | "plain";
  rows?: number;
  maxRows?: number;
  placeholder?: string;
  label?: ReactNode;
  footer?: ReactNode;
  model?: GhostTextModel;
  hint?: boolean;
  onAccept?: (accepted: string, mode: "all" | "word") => void;
  onDismiss?: (suggestion: string) => void;
  onStatusChange?: (status: GhostTextStatus) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  autoFocus?: boolean;
  notice?: string;
  ariaLabel?: string;
  className?: string;
}

function isAsyncIterable(val: unknown): val is AsyncIterable<string> {
  return (
    val !== null &&
    typeof val === "object" &&
    Symbol.asyncIterator in val &&
    typeof (val as AsyncIterable<string>)[Symbol.asyncIterator] === "function"
  );
}

function splitFirstWord(text: string): { word: string; rest: string } {
  const match = text.match(/^(\s*\S+)/);
  if (!match) return { word: text, rest: "" };
  const word = match[1];
  return { word, rest: text.slice(word.length) };
}

function DefaultModelMark() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5l1.65 4.35L14 7.5l-4.35 1.65L8 13.5l-1.65-4.35L2 7.5l4.35-1.65L8 1.5z" />
    </svg>
  );
}

const SIMULATED_COMPLETIONS: { match: RegExp; completion: string }[] = [
  {
    match: /upgraded mid-cycle were\s*$/i,
    completion:
      "billed the full monthly rate on top of the prorated invoice because Stripe finalized the draft before the credit line item was attached.\n\nThis change defers invoice finalization until proration credits are calculated and adds a regression test covering mid-cycle tier upgrades.",
  },
  {
    match: /regression test/i,
    completion:
      " for both monthly and annual billing intervals, ensuring zero duplicate charges on upgrade.",
  },
  {
    match: /proration/i,
    completion:
      " now computes the unused-time credit before finalizing the invoice, eliminating double charges.",
  },
];

async function* defaultSimulatedSuggest(
  text: string,
  signal: AbortSignal
): AsyncIterable<string> {
  const trimmed = text.trimEnd();
  let candidate =
    "billed twice when switching plans mid-cycle. This fix calculates proration credits before finalizing the invoice and adds an integration test for plan upgrades.";

  for (const item of SIMULATED_COMPLETIONS) {
    if (item.match.test(text)) {
      candidate = item.completion;
      break;
    }
  }

  // Avoid duplicating already-typed tail
  if (trimmed.length > 0 && candidate.toLowerCase().startsWith(trimmed.slice(-16).toLowerCase())) {
    return;
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const id = window.setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(id);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true }
      );
    });

  await sleep(340);
  const words = candidate.match(/\S+\s*/g) ?? [candidate];
  for (const w of words) {
    if (signal.aborted) return;
    yield w;
    await sleep(34);
  }
}

export const GhostText = forwardRef<GhostTextHandle, GhostTextProps>(
  function GhostText(
    {
      suggest,
      value: valueProp,
      defaultValue = "",
      onValueChange,
      delay = 420,
      minLength = 3,
      multiline = true,
      variant = "field",
      rows = 4,
      maxRows = 14,
      placeholder = "Start typing...",
      label,
      footer,
      model,
      hint = true,
      onAccept,
      onDismiss,
      onStatusChange,
      disabled = false,
      name,
      id: idProp,
      autoFocus = false,
      notice,
      ariaLabel,
      className,
    },
    ref
  ) {
    const prefersReduced = useReducedMotion();
    const reduced = Boolean(prefersReduced);
    const autoId = useId();
    const fieldId = idProp ?? `ghost-text-${autoId}`;
    const descId = `${fieldId}-desc`;

    const isControlled = valueProp !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const value = isControlled ? valueProp : uncontrolledValue;

    const [chunks, setChunks] = useState<{ id: number; text: string }[]>([]);
    const [status, setStatus] = useState<GhostTextStatus>("idle");
    const [streaming, setStreaming] = useState(false);
    const [dismissing, setDismissing] = useState(false);
    const [merging, setMerging] = useState(false);
    const [recentlyAccepted, setRecentlyAccepted] = useState(false);
    const [announcement, setAnnouncement] = useState("");
    const isTouch = useSyncExternalStore(
      (onStoreChange) => {
        if (typeof window === "undefined") return () => {};
        const mq = window.matchMedia("(pointer: coarse)");
        mq.addEventListener("change", onStoreChange);
        return () => mq.removeEventListener("change", onStoreChange);
      },
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches,
      () => false
    );

    const suggestion = chunks.map((c) => c.text).join("");
    const effectiveSuggest = suggest ?? defaultSimulatedSuggest;

    const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<number | null>(null);
    const chunkCounterRef = useRef(0);
    const acceptedTimerRef = useRef<number | null>(null);
    const mergeTimerRef = useRef<number | null>(null);
    const dismissTimerRef = useRef<number | null>(null);

    const onStatusChangeRef = useRef(onStatusChange);
    useEffect(() => {
      onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    const updateStatus = useCallback((next: GhostTextStatus) => {
      setStatus(next);
      onStatusChangeRef.current?.(next);
    }, []);

    const cancelInFlight = useCallback(() => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setStreaming(false);
    }, []);

    const setValue = useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolledValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange]
    );

    const isCaretAtEnd = useCallback(() => {
      const el = inputRef.current;
      if (!el) return true;
      return (
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length
      );
    }, []);

    const runRequest = useCallback(
      async (text: string) => {
        cancelInFlight();
        if (disabled || text.length < minLength) {
          setChunks([]);
          updateStatus("idle");
          return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setChunks([]);
        setDismissing(false);
        updateStatus("loading");

        try {
          const result = effectiveSuggest(text, controller.signal);

          if (isAsyncIterable(result)) {
            setStreaming(true);
            let acc = "";
            for await (const piece of result) {
              if (controller.signal.aborted) return;
              if (!piece) continue;
              acc += piece;
              const nextId = ++chunkCounterRef.current;
              setChunks((prev) => [...prev, { id: nextId, text: piece }]);
              updateStatus("ready");
            }
            if (controller.signal.aborted) return;
            setStreaming(false);
            if (!acc) {
              updateStatus("idle");
            } else {
              setAnnouncement("Suggestion available. Press Tab to accept.");
            }
          } else {
            const resolved = await result;
            if (controller.signal.aborted) return;
            if (resolved) {
              const nextId = ++chunkCounterRef.current;
              setChunks([{ id: nextId, text: resolved }]);
              updateStatus("ready");
              setAnnouncement("Suggestion available. Press Tab to accept.");
            } else {
              setChunks([]);
              updateStatus("idle");
            }
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setStreaming(false);
          setChunks([]);
          updateStatus("error");
          setAnnouncement("Suggestion failed. Activate retry to try again.");
        }
      },
      [cancelInFlight, disabled, effectiveSuggest, minLength, updateStatus]
    );

    const scheduleRequest = useCallback(
      (text: string) => {
        cancelInFlight();
        if (disabled || text.length < minLength) {
          setChunks([]);
          updateStatus("idle");
          return;
        }
        debounceRef.current = window.setTimeout(() => {
          debounceRef.current = null;
          void runRequest(text);
        }, delay);
      },
      [cancelInFlight, delay, disabled, minLength, runRequest, updateStatus]
    );

    // Kick off initial suggestion if defaultValue/value already meets minLength
    const didInitRef = useRef(false);
    useEffect(() => {
      if (didInitRef.current) return;
      didInitRef.current = true;
      if (value.length >= minLength && !disabled) {
        debounceRef.current = window.setTimeout(() => {
          debounceRef.current = null;
          void runRequest(value);
        }, delay);
      }
    }, [delay, disabled, minLength, runRequest, value]);

    useEffect(() => {
      return () => {
        cancelInFlight();
        if (acceptedTimerRef.current) window.clearTimeout(acceptedTimerRef.current);
        if (mergeTimerRef.current) window.clearTimeout(mergeTimerRef.current);
        if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      };
    }, [cancelInFlight]);

    const triggerAcceptVisual = useCallback(() => {
      if (acceptedTimerRef.current) window.clearTimeout(acceptedTimerRef.current);
      setRecentlyAccepted(true);
      acceptedTimerRef.current = window.setTimeout(() => {
        setRecentlyAccepted(false);
      }, 1100);

      if (!reduced) {
        if (mergeTimerRef.current) window.clearTimeout(mergeTimerRef.current);
        setMerging(true);
        mergeTimerRef.current = window.setTimeout(() => {
          setMerging(false);
        }, 200);
      }
    }, [reduced]);

    const acceptAll = useCallback(() => {
      if (!suggestion) return;
      cancelInFlight();
      const accepted = suggestion;
      const nextValue = value + accepted;
      triggerAcceptVisual();
      setChunks([]);
      setValue(nextValue);
      updateStatus("idle");
      onAccept?.(accepted, "all");
      setAnnouncement("Suggestion accepted.");
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.setSelectionRange(nextValue.length, nextValue.length);
        }
      });
    }, [
      cancelInFlight,
      onAccept,
      setValue,
      suggestion,
      triggerAcceptVisual,
      updateStatus,
      value,
    ]);

    const acceptWord = useCallback(() => {
      if (!suggestion) return;
      const { word, rest } = splitFirstWord(suggestion);
      if (!word) return;
      const nextValue = value + word;
      setValue(nextValue);
      if (rest) {
        const nextId = ++chunkCounterRef.current;
        setChunks([{ id: nextId, text: rest }]);
      } else {
        cancelInFlight();
        setChunks([]);
        updateStatus("idle");
        triggerAcceptVisual();
      }
      onAccept?.(word, "word");
      setAnnouncement(`Accepted word: ${word.trim()}`);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.setSelectionRange(nextValue.length, nextValue.length);
        }
      });
    }, [
      cancelInFlight,
      onAccept,
      setValue,
      suggestion,
      triggerAcceptVisual,
      updateStatus,
      value,
    ]);

    const dismiss = useCallback(() => {
      if (!suggestion) return;
      cancelInFlight();
      const prev = suggestion;
      onDismiss?.(prev);
      setAnnouncement("Suggestion dismissed.");
      if (reduced) {
        setChunks([]);
        updateStatus("idle");
        return;
      }
      setDismissing(true);
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = window.setTimeout(() => {
        setChunks([]);
        setDismissing(false);
        updateStatus("idle");
      }, 110);
    }, [cancelInFlight, onDismiss, reduced, suggestion, updateStatus]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        acceptAll,
        acceptWord,
        dismiss,
        request: () => {
          void runRequest(value);
        },
        getState: () => ({ status, suggestion, streaming }),
      }),
      [acceptAll, acceptWord, dismiss, runRequest, status, streaming, suggestion, value]
    );

    const handleChange = (
      e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
      const nextValue = e.target.value;
      const prevValue = value;
      setValue(nextValue);

      // Check if user typed a matching prefix of the current suggestion
      if (
        suggestion &&
        nextValue.startsWith(prevValue) &&
        nextValue.length > prevValue.length
      ) {
        const typed = nextValue.slice(prevValue.length);
        if (suggestion.startsWith(typed)) {
          const remaining = suggestion.slice(typed.length);
          if (remaining) {
            const nextId = ++chunkCounterRef.current;
            setChunks([{ id: nextId, text: remaining }]);
            return;
          } else {
            cancelInFlight();
            setChunks([]);
            updateStatus("idle");
            return;
          }
        }
      }

      setChunks([]);
      scheduleRequest(nextValue);
    };

    const handleKeyDown = (
      e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
      if (!suggestion) return;

      if (e.key === "Tab" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        acceptAll();
        return;
      }

      if (
        e.key === "ArrowRight" &&
        (e.metaKey || e.ctrlKey || e.altKey) &&
        !e.shiftKey
      ) {
        e.preventDefault();
        acceptWord();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };

    const handleSelectionCheck = () => {
      if (!isCaretAtEnd() && (suggestion || status === "loading")) {
        cancelInFlight();
        setChunks([]);
        updateStatus("idle");
      }
    };

    const handleBlur = () => {
      if (status === "loading") {
        cancelInFlight();
        updateStatus("idle");
      }
    };

    const modelName = model?.name ?? "Claude Haiku 5.5";
    const chipState = recentlyAccepted ? "accepted" : status;
    const chipInteractive =
      chipState === "error" || (chipState === "ready" && Boolean(suggestion));

    const handleChipClick = () => {
      if (chipState === "error") {
        void runRequest(value);
        inputRef.current?.focus();
      } else if (chipState === "ready" && suggestion) {
        acceptAll();
        inputRef.current?.focus();
      }
    };

    const chipAriaLabel =
      chipState === "loading"
        ? `${modelName} is thinking`
        : chipState === "error"
          ? `Retry suggestion from ${modelName}`
          : chipState === "accepted"
            ? "Suggestion accepted"
            : chipState === "ready"
              ? isTouch
                ? "Tap to accept suggestion"
                : `Accept suggestion from ${modelName}`
              : modelName;

    const rootStyle = {
      "--gt-rows": rows,
      "--gt-max-rows": maxRows,
    } as CSSProperties;

    return (
      <div
        className={[styles.root, className].filter(Boolean).join(" ")}
        data-multiline={multiline ? "true" : "false"}
        data-variant={variant}
        data-merging={merging ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        style={rootStyle}
      >
        {label && (
          <label htmlFor={fieldId} className={styles.label}>
            {label}
          </label>
        )}

        <div className={styles.viewport}>
          <div className={styles.stack}>
            <div className={styles.mirror} aria-hidden="true">
              {value}
              {chunks.map((c) => (
                <span
                  key={c.id}
                  className={styles.ghostChunk}
                  data-dismissing={dismissing ? "true" : undefined}
                >
                  {c.text}
                </span>
              ))}
              <span className={styles.marker}>&#8203;</span>
            </div>

            {multiline ? (
              <textarea
                ref={inputRef}
                id={fieldId}
                name={name}
                className={styles.input}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSelect={handleSelectionCheck}
                onClick={handleSelectionCheck}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                spellCheck
                autoComplete="off"
                aria-label={ariaLabel}
                aria-describedby={descId}
              />
            ) : (
              <input
                ref={inputRef}
                id={fieldId}
                name={name}
                type="text"
                className={styles.input}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSelect={handleSelectionCheck}
                onClick={handleSelectionCheck}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                spellCheck
                autoComplete="off"
                aria-label={ariaLabel}
                aria-describedby={descId}
              />
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {footer ??
              (notice ? (
                <span className={styles.notice}>{notice}</span>
              ) : null)}
            {hint && suggestion && !isTouch && (
              <span className={styles.hints} aria-hidden="true">
                <span className={styles.hintItem}>
                  <kbd className={styles.kbd}>Tab</kbd> accept
                </span>
                <span className={styles.hintItem}>
                  <kbd className={styles.kbd}>⌘→</kbd> word
                </span>
                <span className={styles.hintItem}>
                  <kbd className={styles.kbd}>Esc</kbd> dismiss
                </span>
              </span>
            )}
          </div>

          <button
            type="button"
            className={styles.chip}
            data-state={chipState}
            data-interactive={chipInteractive ? "true" : undefined}
            tabIndex={chipState === "error" ? 0 : -1}
            aria-disabled={chipInteractive ? undefined : "true"}
            aria-label={chipAriaLabel}
            onClick={handleChipClick}
          >
            <span className={styles.chipMark}>
              {chipState === "error" ? (
                <RotateCcw size={12} />
              ) : chipState === "accepted" ? (
                <Check size={12} />
              ) : (
                model?.mark ?? <DefaultModelMark />
              )}
            </span>

            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={chipState}
                className={styles.chipLabel}
                initial={reduced ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -3 }}
                transition={{ duration: reduced ? 0 : 0.14 }}
              >
                {chipState === "loading" ? (
                  <TextShimmer active>Thinking</TextShimmer>
                ) : chipState === "error" ? (
                  "Retry"
                ) : chipState === "accepted" ? (
                  "Accepted"
                ) : chipState === "ready" && isTouch ? (
                  "Tap to accept"
                ) : (
                  modelName
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <span id={descId} className={styles.srOnly}>
          Inline autocomplete enabled. Press Tab to accept the full suggestion,
          Command or Control plus Right Arrow to accept one word, or Escape to
          dismiss.
        </span>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </span>
      </div>
    );
  }
);

export default GhostText;
