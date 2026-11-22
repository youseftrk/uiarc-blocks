"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  X,
} from "lucide-react";
import styles from "./dictation-button.module.css";

export type DictationStatus =
  | "idle"
  | "starting"
  | "listening"
  | "processing"
  | "denied"
  | "error";

export type DictationErrorCode =
  | "not-allowed"
  | "unsupported"
  | "no-speech"
  | "network"
  | "audio-capture"
  | "unknown";

export interface DictationTranscript {
  final: string;
  interim: string;
}

export interface DictationPhrase {
  interim?: string;
  final: string;
}

export interface DictationRecognizerHandlers {
  onTranscript: (transcript: DictationTranscript) => void;
  onLevel: (level: number) => void;
  onSpeechEnd: () => void;
  onError: (code: DictationErrorCode) => void;
}

export type DictationRecognizer = (
  handlers: DictationRecognizerHandlers,
  signal: AbortSignal,
) => Promise<{ stop: () => Promise<string> }>;

export class DictationError extends Error {
  code: DictationErrorCode;
  constructor(code: DictationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DictationError";
    this.code = code;
  }
}

const DEFAULT_SCRIPTS: DictationPhrase[][] = [
  [
    { interim: "Draft a reply", final: "Draft a reply to Priya" },
    { interim: "saying the Q4", final: "saying the Q4 pricing review" },
    { interim: "moves to Thursday", final: "moves to Thursday at 2 PM," },
    { interim: "and attach", final: "and attach the updated margin sheet." },
  ],
  [
    { interim: "Summarize the", final: "Summarize the onboarding feedback" },
    { interim: "from last week", final: "from last week into three themes" },
    { interim: "with one quote", final: "with one customer quote for each." },
  ],
];

export function createSimulatedRecognizer(options?: {
  scripts?: DictationPhrase[][];
  deny?: boolean;
  startDelay?: number;
  finalizeDelay?: number;
  wordInterval?: number;
}): DictationRecognizer {
  const scripts = options?.scripts ?? DEFAULT_SCRIPTS;
  const deny = options?.deny ?? false;
  const startDelay = options?.startDelay ?? 160;
  const finalizeDelay = options?.finalizeDelay ?? 260;
  const wordInterval = options?.wordInterval ?? 145;
  let scriptIdx = 0;

  return async (handlers, signal) => {
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => {
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
        } else if (deny) {
          reject(new DictationError("not-allowed"));
        } else {
          resolve();
        }
      }, startDelay);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });

    const script = scripts[scriptIdx % scripts.length];
    scriptIdx += 1;

    let stopped = false;
    let settledFinal = "";
    let latestInterim = "";
    let stepTimer: number | null = null;
    let levelTimer: number | null = null;
    let phase = 0;

    const cleanup = () => {
      stopped = true;
      if (stepTimer !== null) window.clearTimeout(stepTimer);
      if (levelTimer !== null) window.clearInterval(levelTimer);
      handlers.onLevel(0);
    };

    signal.addEventListener("abort", cleanup, { once: true });

    let speaking = true;
    levelTimer = window.setInterval(() => {
      if (stopped) return;
      phase += 0.45;
      const base = speaking
        ? 0.28 +
          0.32 * Math.abs(Math.sin(phase * 1.15)) +
          0.25 * Math.abs(Math.sin(phase * 2.7 + 0.6))
        : 0.04;
      handlers.onLevel(Math.min(1, Math.max(0.03, base)));
    }, 60);

    // Build flat timeline of incremental updates
    const events: Array<{ final: string; interim: string; pause?: boolean }> = [];
    let runningFinal = "";
    for (const phrase of script) {
      const interimWords = (phrase.interim ?? phrase.final).split(/\s+/).filter(Boolean);
      for (let i = 1; i <= interimWords.length; i++) {
        events.push({
          final: runningFinal,
          interim: interimWords.slice(0, i).join(" "),
        });
      }
      runningFinal = runningFinal ? `${runningFinal} ${phrase.final}` : phrase.final;
      events.push({ final: runningFinal, interim: "", pause: true });
    }

    let eventIdx = 0;
    const pump = () => {
      if (stopped || signal.aborted) return;
      if (eventIdx >= events.length) {
        speaking = false;
        handlers.onSpeechEnd();
        return;
      }
      const ev = events[eventIdx++];
      settledFinal = ev.final;
      latestInterim = ev.interim;
      speaking = !ev.pause;
      handlers.onTranscript({ final: settledFinal, interim: latestInterim });
      stepTimer = window.setTimeout(pump, ev.pause ? wordInterval * 2.2 : wordInterval);
    };

    stepTimer = window.setTimeout(pump, 180);

    return {
      stop: async () => {
        cleanup();
        await new Promise<void>((resolve) => window.setTimeout(resolve, finalizeDelay));
        const combined = [settledFinal, latestInterim].filter(Boolean).join(" ").trim();
        return combined;
      },
    };
  };
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function createWebSpeechRecognizer(options?: {
  lang?: string;
  levels?: boolean;
}): DictationRecognizer {
  const lang = options?.lang ?? "en-US";
  const wantLevels = options?.levels ?? true;

  return async (handlers, signal) => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      throw new DictationError("unsupported");
    }

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let levelInterval: number | null = null;

    if (wantLevels && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        levelInterval = window.setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          handlers.onLevel(Math.min(1, rms * 3.5));
        }, 60);
      } catch {
        throw new DictationError("not-allowed");
      }
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    let finalText = "";
    let interimText = "";
    let closed = false;

    const releaseAudio = () => {
      if (levelInterval !== null) {
        window.clearInterval(levelInterval);
        levelInterval = null;
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      if (audioCtx) {
        void audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      handlers.onLevel(0);
    };

    rec.onresult = (ev) => {
      let f = "";
      let it = "";
      for (let i = 0; i < ev.results.length; i++) {
        const res = ev.results[i];
        const piece = res[0]?.transcript ?? "";
        if (res.isFinal) f += piece;
        else it += piece;
      }
      finalText = f.trim();
      interimText = it.trim();
      handlers.onTranscript({ final: finalText, interim: interimText });
    };

    rec.onerror = (ev) => {
      if (closed) return;
      const map: Record<string, DictationErrorCode> = {
        "not-allowed": "not-allowed",
        "service-not-allowed": "not-allowed",
        "no-speech": "no-speech",
        network: "network",
        "audio-capture": "audio-capture",
      };
      handlers.onError(map[ev.error] ?? "unknown");
    };

    rec.onend = () => {
      if (!closed) {
        handlers.onSpeechEnd();
      }
    };

    signal.addEventListener(
      "abort",
      () => {
        closed = true;
        try {
          rec.abort();
        } catch {
          // ignore
        }
        releaseAudio();
      },
      { once: true },
    );

    rec.start();

    return {
      stop: async () => {
        closed = true;
        try {
          rec.stop();
        } catch {
          // ignore
        }
        releaseAudio();
        return [finalText, interimText].filter(Boolean).join(" ").trim();
      },
    };
  };
}

export interface UseDictationOptions {
  recognizer?: DictationRecognizer;
  maxDuration?: number;
  onTranscript?: (transcript: DictationTranscript) => void;
  onCommit?: (text: string) => void;
  onCancel?: () => void;
  onSpeechEnd?: () => void;
  onStatusChange?: (status: DictationStatus, error?: DictationErrorCode) => void;
}

export interface UseDictationReturn {
  status: DictationStatus;
  transcript: DictationTranscript;
  error: DictationErrorCode | null;
  startedAt: number | null;
  levelRef: MutableRefObject<number>;
  start: () => Promise<void>;
  confirm: () => Promise<string>;
  cancel: () => void;
  dismiss: () => void;
}

const DEFAULT_RECOGNIZER = createSimulatedRecognizer();

export function useDictation(options: UseDictationOptions = {}): UseDictationReturn {
  const {
    recognizer = DEFAULT_RECOGNIZER,
    maxDuration = 120,
    onTranscript,
    onCommit,
    onCancel,
    onSpeechEnd,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<DictationStatus>("idle");
  const [transcript, setTranscript] = useState<DictationTranscript>({
    final: "",
    interim: "",
  });
  const [error, setError] = useState<DictationErrorCode | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const levelRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<{ stop: () => Promise<string> } | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const statusRef = useRef<DictationStatus>("idle");

  const callbacksRef = useRef({
    recognizer,
    onTranscript,
    onCommit,
    onCancel,
    onSpeechEnd,
    onStatusChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      recognizer,
      onTranscript,
      onCommit,
      onCancel,
      onSpeechEnd,
      onStatusChange,
    };
  });

  const transition = useCallback((next: DictationStatus, err?: DictationErrorCode) => {
    statusRef.current = next;
    setStatus(next);
    setError(err ?? null);
    callbacksRef.current.onStatusChange?.(next, err);
  }, []);

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const confirm = useCallback(async () => {
    if (statusRef.current !== "listening" && statusRef.current !== "starting") {
      return "";
    }
    clearMaxTimer();
    const session = sessionRef.current;
    sessionRef.current = null;
    transition("processing");

    let text = "";
    try {
      if (session) {
        text = await session.stop();
      }
    } catch {
      // fallback to empty
    } finally {
      abortRef.current = null;
      levelRef.current = 0;
      setStartedAt(null);
      setTranscript({ final: "", interim: "" });
      transition("idle");
    }

    if (text) {
      callbacksRef.current.onCommit?.(text);
    }
    return text;
  }, [clearMaxTimer, transition]);

  const confirmRef = useRef(confirm);
  useEffect(() => {
    confirmRef.current = confirm;
  }, [confirm]);

  const cancel = useCallback(() => {
    clearMaxTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current = null;
    levelRef.current = 0;
    setStartedAt(null);
    setTranscript({ final: "", interim: "" });
    transition("idle");
    callbacksRef.current.onCancel?.();
  }, [clearMaxTimer, transition]);

  const dismiss = useCallback(() => {
    if (statusRef.current === "denied" || statusRef.current === "error") {
      transition("idle");
    }
  }, [transition]);

  const start = useCallback(async () => {
    if (statusRef.current === "listening" || statusRef.current === "starting") return;
    clearMaxTimer();
    abortRef.current?.abort();

    const ac = new AbortController();
    abortRef.current = ac;
    setTranscript({ final: "", interim: "" });
    levelRef.current = 0;
    transition("starting");

    try {
      const session = await callbacksRef.current.recognizer(
        {
          onTranscript: (t) => {
            if (ac.signal.aborted) return;
            setTranscript(t);
            callbacksRef.current.onTranscript?.(t);
          },
          onLevel: (lvl) => {
            levelRef.current = lvl;
          },
          onSpeechEnd: () => {
            if (ac.signal.aborted) return;
            callbacksRef.current.onSpeechEnd?.();
          },
          onError: (code) => {
            if (ac.signal.aborted) return;
            clearMaxTimer();
            abortRef.current = null;
            sessionRef.current = null;
            levelRef.current = 0;
            setStartedAt(null);
            transition(code === "not-allowed" ? "denied" : "error", code);
          },
        },
        ac.signal,
      );

      if (ac.signal.aborted) return;
      sessionRef.current = session;
      setStartedAt(Date.now());
      transition("listening");

      if (maxDuration > 0) {
        maxTimerRef.current = window.setTimeout(() => {
          void confirmRef.current();
        }, maxDuration * 1000);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      abortRef.current = null;
      sessionRef.current = null;
      levelRef.current = 0;
      setStartedAt(null);
      const code: DictationErrorCode =
        err instanceof DictationError ? err.code : "unknown";
      transition(code === "not-allowed" ? "denied" : "error", code);
    }
  }, [clearMaxTimer, maxDuration, transition]);

  useEffect(() => {
    return () => {
      clearMaxTimer();
      abortRef.current?.abort();
    };
  }, [clearMaxTimer]);

  return {
    status,
    transcript,
    error,
    startedAt,
    levelRef,
    start,
    confirm,
    cancel,
    dismiss,
  };
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ClaudeMark() {
  return (
    <svg
      className={styles.claude}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.25a.9.9 0 0 1 .9.9v5.4l3.82-3.82a.9.9 0 1 1 1.27 1.27L14.17 9.82h5.4a.9.9 0 1 1 0 1.8h-5.4l3.82 3.82a.9.9 0 1 1-1.27 1.27L12.9 12.9v5.4a.9.9 0 1 1-1.8 0v-5.4l-3.82 3.82a.9.9 0 1 1-1.27-1.27l3.82-3.82h-5.4a.9.9 0 1 1 0-1.8h5.4L6.01 6a.9.9 0 1 1 1.27-1.27l3.82 3.82v-5.4a.9.9 0 0 1 .9-.9Z" />
    </svg>
  );
}

function IconTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.tooltip} sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface PillProps {
  dictation: UseDictationReturn;
  label?: string;
  disabled?: boolean;
  maxActiveWidth?: number;
  onFocusInsert?: boolean;
  onAfterConfirm?: () => void;
  onAfterCancel?: () => void;
}

function DictationPill({
  dictation,
  label = "Dictate",
  disabled = false,
  maxActiveWidth = 216,
  onAfterConfirm,
  onAfterCancel,
}: PillProps) {
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced);
  const { status, startedAt, levelRef, start, confirm, cancel, dismiss } = dictation;

  const view: "idle" | "active" | "retry" =
    status === "starting" || status === "listening" || status === "processing"
      ? "active"
      : status === "denied" || status === "error"
        ? "retry"
        : "idle";

  const micRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);

  const [barCount, setBarCount] = useState(18);
  const [retryWidth, setRetryWidth] = useState(112);

  // Measure retry button width
  useEffect(() => {
    const el = retryRef.current;
    if (!el) return;
    const w = Math.ceil(el.getBoundingClientRect().width);
    if (w > 40) setRetryWidth(w);
  }, [status]);

  // Fit 3px bars with 2px gap inside wave track
  useEffect(() => {
    const el = waveRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 10) {
        setBarCount(Math.max(8, Math.floor((w + 2) / 5)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Waveform + timer RAF loop (writes directly to DOM, zero React re-renders)
  useEffect(() => {
    const isListening = status === "listening";
    const isActive = status === "listening" || status === "starting" || status === "processing";

    const waveEl = waveRef.current;
    const bars = waveEl ? Array.from(waveEl.children) as HTMLSpanElement[] : [];
    const targets = new Float32Array(bars.length).fill(3);
    const current = new Float32Array(bars.length).fill(3);

    let rafId: number | null = null;
    let lastSample = 0;

    const step = (now: number) => {
      rafId = null;
      if (document.hidden) return;

      if (timeRef.current && startedAt && isListening) {
        timeRef.current.textContent = formatElapsed(Date.now() - startedAt);
      }

      if (isListening && now - lastSample >= 60) {
        lastSample = now;
        const lvl = levelRef.current;
        if (reduced) {
          const h = 3 + lvl * 13;
          for (let i = 0; i < targets.length; i++) {
            const weight = 0.55 + 0.45 * Math.sin((i / Math.max(1, targets.length - 1)) * Math.PI);
            targets[i] = 3 + (h - 3) * weight;
          }
        } else {
          for (let i = 0; i < targets.length - 1; i++) {
            targets[i] = targets[i + 1];
          }
          const h = 3 + Math.min(1, Math.max(0, lvl)) * 16;
          if (targets.length > 0) targets[targets.length - 1] = h;
        }
      } else if (!isListening) {
        for (let i = 0; i < targets.length; i++) targets[i] = 3;
      }

      let settled = true;
      for (let i = 0; i < bars.length; i++) {
        const diff = targets[i] - current[i];
        if (Math.abs(diff) > 0.15) {
          current[i] += diff * 0.28;
          settled = false;
        } else {
          current[i] = targets[i];
        }
        bars[i].style.height = `${current[i].toFixed(1)}px`;
      }

      if (isActive || !settled) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    if (timeRef.current && !startedAt) {
      timeRef.current.textContent = "0:00";
    }

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [barCount, levelRef, reduced, startedAt, status]);

  // Focus transitions
  const prevViewRef = useRef(view);
  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = view;
    if (prev === view) return;
    if (view === "active") {
      confirmRef.current?.focus({ preventScroll: true });
    } else if (view === "retry") {
      retryRef.current?.focus({ preventScroll: true });
    }
  }, [view]);

  const targetWidth =
    view === "active"
      ? maxActiveWidth
      : view === "retry"
        ? retryWidth
        : 36;

  const isProcessing = status === "processing";

  return (
    <motion.div
      className={styles.pill}
      data-view={view}
      data-status={status}
      animate={{ width: targetWidth }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", visualDuration: 0.24, bounce: 0 }
      }
      style={{ width: 36 }}
    >
      {/* Idle face */}
      <div
        className={styles.layer}
        data-on={view === "idle" ? "" : undefined}
        aria-hidden={view !== "idle"}
        {...(view !== "idle" ? { inert: true } : {})}
      >
        <IconTip label={label}>
          <button
            ref={micRef}
            type="button"
            className={styles.mic}
            aria-label={label}
            disabled={disabled}
            onClick={() => void start()}
          >
            <Mic size={16} aria-hidden="true" />
          </button>
        </IconTip>
      </div>

      {/* Active recording face */}
      <div
        className={`${styles.layer} ${styles.active}`}
        data-on={view === "active" ? "" : undefined}
        aria-hidden={view !== "active"}
        {...(view !== "active" ? { inert: true } : {})}
      >
        <IconTip label="Cancel">
          <button
            type="button"
            className={styles.cancel}
            aria-label="Cancel"
            aria-disabled={isProcessing ? true : undefined}
            onClick={() => {
              if (isProcessing) return;
              cancel();
              onAfterCancel?.();
              window.requestAnimationFrame(() =>
                micRef.current?.focus({ preventScroll: true }),
              );
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </IconTip>

        <div ref={waveRef} className={styles.wave} aria-hidden="true">
          {Array.from({ length: barCount }, (_, i) => (
            <span key={i} />
          ))}
        </div>

        <span ref={timeRef} className={styles.time} role="timer" aria-label="Elapsed time">
          0:00
        </span>

        <IconTip label={isProcessing ? "Transcribing" : "Insert"}>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirm}
            aria-label={isProcessing ? "Transcribing" : "Insert"}
            aria-disabled={isProcessing ? true : undefined}
            onClick={() => {
              if (isProcessing) return;
              void confirm().then(() => onAfterConfirm?.());
            }}
          >
            <span className={styles.swap} data-on={!isProcessing ? "" : undefined}>
              <Check size={14} aria-hidden="true" />
            </span>
            <span className={styles.swap} data-on={isProcessing ? "" : undefined}>
              <Loader2 size={14} className={styles.spin} aria-hidden="true" />
            </span>
          </button>
        </IconTip>
      </div>

      {/* Retry face */}
      <div
        className={styles.layer}
        data-on={view === "retry" ? "" : undefined}
        aria-hidden={view !== "retry"}
        {...(view !== "retry" ? { inert: true } : {})}
      >
        <button
          ref={retryRef}
          type="button"
          className={styles.retry}
          disabled={disabled}
          onClick={() => void start()}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              ev.preventDefault();
              dismiss();
              window.requestAnimationFrame(() =>
                micRef.current?.focus({ preventScroll: true }),
              );
            }
          }}
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>Try again</span>
        </button>
      </div>
    </motion.div>
  );
}

export interface DictationControlProps {
  recognizer?: DictationRecognizer;
  onTranscript?: (transcript: DictationTranscript) => void;
  onCommit?: (text: string) => void;
  onCancel?: () => void;
  onSpeechEnd?: () => void;
  onStatusChange?: (status: DictationStatus, error?: DictationErrorCode) => void;
  maxDuration?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function DictationControl({
  recognizer,
  onTranscript,
  onCommit,
  onCancel,
  onSpeechEnd,
  onStatusChange,
  maxDuration = 120,
  label = "Dictate",
  disabled = false,
  className,
}: DictationControlProps) {
  const dictation = useDictation({
    recognizer,
    maxDuration,
    onTranscript,
    onCommit,
    onCancel,
    onSpeechEnd,
    onStatusChange,
  });

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={[styles.control, className].filter(Boolean).join(" ")}>
        <DictationPill dictation={dictation} label={label} disabled={disabled} />
      </div>
    </Tooltip.Provider>
  );
}

export interface DictationButtonProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  recognizer?: DictationRecognizer;
  onTranscript?: (transcript: DictationTranscript) => void;
  onCommit?: (text: string) => void;
  onSend?: (text: string) => void | Promise<void>;
  onStatusChange?: (status: DictationStatus, error?: DictationErrorCode) => void;
  autoPlay?: boolean;
  maxDuration?: number;
  model?: { name: string; mark?: ReactNode } | null;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

const DEFAULT_MODEL = {
  name: "Claude Sonnet 5.5",
  mark: <ClaudeMark />,
};

function errorCopy(code: DictationErrorCode | null): { wide: string; narrow: string } {
  switch (code) {
    case "not-allowed":
      return { wide: "Microphone blocked in site settings", narrow: "Mic blocked" };
    case "unsupported":
      return { wide: "Voice input not supported in this browser", narrow: "Unsupported" };
    case "no-speech":
      return { wide: "No speech detected", narrow: "No speech" };
    case "network":
      return { wide: "Speech service unreachable", narrow: "Network error" };
    default:
      return { wide: "Could not start dictation", narrow: "Dictation error" };
  }
}

export function DictationButton({
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Message Claude",
  recognizer,
  onTranscript,
  onCommit,
  onSend,
  onStatusChange,
  autoPlay,
  maxDuration = 120,
  model = DEFAULT_MODEL,
  disabled = false,
  "aria-label": ariaLabel = "Message",
  className,
}: DictationButtonProps) {
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced);

  const isSimulated = recognizer === undefined;
  const shouldAutoPlay = autoPlay ?? isSimulated;

  const [uncontrolledText, setUncontrolledText] = useState(defaultValue);
  const text = value ?? uncontrolledText;
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const setText = useCallback(
    (next: string) => {
      if (value === undefined) setUncontrolledText(next);
      textRef.current = next;
      onValueChange?.(next);
    },
    [onValueChange, value],
  );

  const [sending, setSending] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [interacted, setInteracted] = useState(false);
  const [inView, setInView] = useState(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoTimerRef = useRef<number | null>(null);

  const handleCommit = useCallback(
    (finalText: string) => {
      const prefix = textRef.current.trimEnd();
      const next = prefix ? `${prefix} ${finalText}` : finalText;
      setText(next);
      onCommit?.(finalText);
      const wc = finalText.split(/\s+/).filter(Boolean).length;
      setAnnouncement(`Inserted ${wc} ${wc === 1 ? "word" : "words"}.`);
    },
    [onCommit, setText],
  );

  const handleStatusChange = useCallback(
    (next: DictationStatus, err?: DictationErrorCode) => {
      onStatusChange?.(next, err);
      if (next === "listening") {
        setAnnouncement(
          isSimulated
            ? "Listening. Simulated dictation, nothing is recorded."
            : "Listening.",
        );
      } else if (next === "processing") {
        setAnnouncement("Transcribing.");
      } else if (next === "denied") {
        setAnnouncement("Microphone blocked in site settings.");
      } else if (next === "error") {
        setAnnouncement(errorCopy(err ?? null).wide);
      }
    },
    [isSimulated, onStatusChange],
  );

  const dictation = useDictation({
    recognizer,
    maxDuration,
    onTranscript,
    onCommit: handleCommit,
    onCancel: () => setAnnouncement("Dictation cancelled."),
    onStatusChange: handleStatusChange,
  });

  const isDictating =
    dictation.status === "starting" ||
    dictation.status === "listening" ||
    dictation.status === "processing";

  // Keep newest dictated words scrolled into view
  useEffect(() => {
    if (!isDictating || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [dictation.transcript.final, dictation.transcript.interim, isDictating]);

  // IntersectionObserver for autoPlay pause offscreen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = textRef.current.trim();
    if (!trimmed || sending || disabled || isDictating) return;
    setSending(true);
    try {
      if (onSend) {
        await onSend(trimmed);
      } else {
        await new Promise<void>((r) => window.setTimeout(r, 420));
      }
      setText("");
      setSentFlash(true);
      setAnnouncement("Message sent.");
      window.setTimeout(() => setSentFlash(false), 1600);
    } finally {
      setSending(false);
    }
  }, [disabled, isDictating, onSend, sending, setText]);

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Auto-play demo loop until first user interaction
  useEffect(() => {
    if (!shouldAutoPlay || interacted || !inView || disabled) return;

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        autoTimerRef.current = window.setTimeout(resolve, ms);
      });

    const loop = async () => {
      while (!cancelled) {
        await wait(700);
        if (cancelled) break;
        await dictation.start();
        await wait(5200);
        if (cancelled) break;
        await dictation.confirm();
        await wait(1100);
        if (cancelled) break;
        await handleSendRef.current();
        await wait(1800);
      }
    };

    void loop();

    return () => {
      cancelled = true;
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoPlay, interacted, inView, disabled]);

  const stopAutoPlay = useCallback(() => {
    if (!interacted) {
      setInteracted(true);
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    }
  }, [interacted]);

  const focusFieldEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus({ preventScroll: true });
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    });
  }, []);

  const handleCardKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      stopAutoPlay();
      if (dictation.status === "listening") {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          void dictation.confirm().then(focusFieldEnd);
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          dictation.cancel();
        }
      }
    },
    [dictation, focusFieldEnd, stopAutoPlay],
  );

  // Split words for smooth fade-in mirror during dictation
  const finalWords = useMemo(
    () => dictation.transcript.final.split(/\s+/).filter(Boolean),
    [dictation.transcript.final],
  );
  const interimWords = useMemo(
    () => dictation.transcript.interim.split(/\s+/).filter(Boolean),
    [dictation.transcript.interim],
  );

  // Determine left toolbar slot content
  const slotKey =
    dictation.status === "denied"
      ? "denied"
      : dictation.status === "error"
        ? "error"
        : dictation.status === "processing"
          ? "processing"
          : dictation.status === "listening" || dictation.status === "starting"
            ? "listening"
            : sentFlash
              ? "sent"
              : "model";

  const errText = errorCopy(dictation.error);
  const canSend = text.trim().length > 0 && !isDictating && !sending && !disabled;

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        ref={rootRef}
        className={[styles.root, className].filter(Boolean).join(" ")}
        onPointerDown={stopAutoPlay}
        onFocus={stopAutoPlay}
        onKeyDown={handleCardKeyDown}
      >
        <div
          className={styles.card}
          data-dictating={isDictating ? "true" : undefined}
          data-disabled={disabled ? "true" : undefined}
        >
          <div className={styles.field}>
            <div ref={scrollRef} className={styles.scroll}>
              <div
                className={styles.stack}
                data-dictating={isDictating ? "true" : undefined}
              >
                <div className={styles.mirror} aria-hidden="true">
                  {text ? <span>{text} </span> : null}
                  {finalWords.map((w, i) => (
                    <span key={`f-${i}-${w}`}>
                      <span className={styles.word}>{w}</span>{" "}
                    </span>
                  ))}
                  {interimWords.map((w, i) => (
                    <span key={`i-${i}-${w}`}>
                      <span className={styles.word} data-interim="">
                        {w}
                      </span>{" "}
                    </span>
                  ))}
                  {isDictating &&
                  !text &&
                  finalWords.length === 0 &&
                  interimWords.length === 0 ? (
                    <span className={styles.hint}>Listening...</span>
                  ) : null}
                  {"\u200B"}
                </div>

                <textarea
                  ref={textareaRef}
                  className={styles.input}
                  value={text}
                  onChange={(ev) => setText(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" && !ev.shiftKey && !isDictating) {
                      ev.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={placeholder}
                  aria-label={ariaLabel}
                  rows={2}
                  disabled={disabled}
                  readOnly={isDictating}
                  tabIndex={isDictating ? -1 : 0}
                />
              </div>
            </div>
          </div>

          <div className={styles.bar}>
            <div className={styles.slot}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slotKey}
                  className={styles.slotItem}
                  initial={reduced ? false : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -2 }}
                  transition={{ duration: reduced ? 0 : 0.14 }}
                >
                  {slotKey === "model" && model ? (
                    <>
                      {model.mark}
                      <span className={styles.slotText}>{model.name}</span>
                    </>
                  ) : null}

                  {slotKey === "listening" ? (
                    <span className={styles.hints}>
                      <kbd className={styles.kbd}>Enter</kbd>
                      <span>Insert</span>
                      <kbd className={`${styles.kbd} ${styles.gap}`}>Esc</kbd>
                      <span>Cancel</span>
                    </span>
                  ) : null}

                  {slotKey === "processing" ? (
                    <span className={styles.slotText}>Transcribing...</span>
                  ) : null}

                  {slotKey === "denied" ? (
                    <>
                      <MicOff size={15} className={styles.warn} aria-hidden="true" />
                      <span className={`${styles.slotText} ${styles.wide}`}>
                        {errText.wide}
                      </span>
                      <span className={`${styles.slotText} ${styles.narrow}`}>
                        {errText.narrow}
                      </span>
                    </>
                  ) : null}

                  {slotKey === "error" ? (
                    <>
                      <AlertCircle size={15} className={styles.warn} aria-hidden="true" />
                      <span className={`${styles.slotText} ${styles.wide}`}>
                        {errText.wide}
                      </span>
                      <span className={`${styles.slotText} ${styles.narrow}`}>
                        {errText.narrow}
                      </span>
                    </>
                  ) : null}

                  {slotKey === "sent" ? (
                    <>
                      <Check size={15} className={styles.ok} aria-hidden="true" />
                      <span className={styles.slotText}>Sent</span>
                    </>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <DictationPill
              dictation={dictation}
              disabled={disabled}
              onAfterConfirm={focusFieldEnd}
            />

            <IconTip label={sending ? "Sending" : "Send"}>
              <button
                type="button"
                className={styles.send}
                aria-label={sending ? "Sending" : "Send"}
                disabled={!canSend}
                onClick={() => void handleSend()}
              >
                {sending ? (
                  <Loader2 size={16} className={styles.spin} aria-hidden="true" />
                ) : (
                  <ArrowUp size={16} aria-hidden="true" />
                )}
              </button>
            </IconTip>
          </div>
        </div>

        <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      </div>
    </Tooltip.Provider>
  );
}
