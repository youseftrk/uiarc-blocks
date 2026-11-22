"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Languages,
  RotateCcw,
} from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { ClaudeMark } from "../ai-command/marks";
import styles from "./ai-translate.module.css";

export type AiTranslateLanguageCode = "en" | "de" | "fr" | "es" | "ja" | "pt";

export interface AiTranslateAuthor {
  name: string;
  role?: string;
  avatar?: string;
}

export interface AiTranslateModel {
  name: string;
  mark?: ReactNode;
}

export interface AiTranslateRequest {
  text: string;
  from: AiTranslateLanguageCode;
  to: AiTranslateLanguageCode;
  signal: AbortSignal;
}

export interface AiTranslateResult {
  from: AiTranslateLanguageCode;
  to: AiTranslateLanguageCode;
  text: string;
}

export interface AiTranslateProps {
  text?: string;
  sourceLanguage?: AiTranslateLanguageCode;
  languages?: AiTranslateLanguageCode[];
  value?: AiTranslateLanguageCode;
  defaultValue?: AiTranslateLanguageCode;
  onValueChange?: (language: AiTranslateLanguageCode) => void;
  translate?: (
    request: AiTranslateRequest,
  ) => Promise<string> | AsyncIterable<string>;
  translations?: Partial<Record<AiTranslateLanguageCode, string>>;
  onTranslate?: (result: AiTranslateResult) => void;
  onError?: (
    error: Error,
    request: { from: AiTranslateLanguageCode; to: AiTranslateLanguageCode },
  ) => void;
  author?: AiTranslateAuthor | null;
  timestamp?: string;
  model?: AiTranslateModel;
  autoPlay?: boolean;
  simulated?: boolean;
  className?: string;
}

interface LanguageInfo {
  code: AiTranslateLanguageCode;
  nativeName: string;
  englishName: string;
}

const ALL_LANGUAGES: LanguageInfo[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese" },
];

const LANGUAGE_MAP: Record<AiTranslateLanguageCode, LanguageInfo> =
  Object.fromEntries(ALL_LANGUAGES.map((l) => [l.code, l])) as Record<
    AiTranslateLanguageCode,
    LanguageInfo
  >;

const DEFAULT_SAMPLE_TEXT =
  "Bonjour à tous ! La version 4.2 de l'app iOS est passée en revue chez Apple hier soir, avec le nouveau mode hors ligne. Les premiers retours de la bêta sont très bons : le temps de synchronisation passe de 9 à 3 secondes en moyenne. Pourriez-vous vérifier les traductions sur les écrans de paiement avant jeudi ? Merci d'avance, et beau travail sur ce sprint.";

const DEFAULT_SAMPLE_TRANSLATIONS: Record<AiTranslateLanguageCode, string> = {
  fr: DEFAULT_SAMPLE_TEXT,
  en: "Hi everyone! Version 4.2 of the iOS app went into Apple review last night, with the new offline mode. Early beta feedback is very good: sync time drops from 9 to 3 seconds on average. Could you check the translations on the payment screens before Thursday? Thanks in advance, and great work on this sprint.",
  de: "Hallo zusammen! Version 4.2 der iOS-App ging gestern Abend mit dem neuen Offline-Modus in die Apple-Prüfung. Das erste Beta-Feedback ist sehr gut: Die Synchronisierungszeit sinkt im Schnitt von 9 auf 3 Sekunden. Könntet ihr vor Donnerstag die Übersetzungen auf den Zahlungsbildschirmen prüfen? Vielen Dank vorab und starke Arbeit in diesem Sprint.",
  es: "¡Hola a todos! La versión 4.2 de la app de iOS entró anoche en revisión de Apple con el nuevo modo sin conexión. Los primeros comentarios de la beta son muy buenos: el tiempo de sincronización baja de 9 a 3 segundos de media. ¿Podríais revisar las traducciones en las pantallas de pago antes del jueves? Gracias de antemano y gran trabajo en este sprint.",
  ja: "みなさんこんにちは！新しいオフラインモードを搭載したiOSアプリ4.2が昨夜Appleの審査に入りました。初期ベータの反応はとても良く、同期時間は平均9秒から3秒に短縮されています。木曜までに決済画面の翻訳を確認してもらえますか？よろしくお願いします。今回のスプリントもお疲れさまでした。",
  pt: "Olá a todos! A versão 4.2 do app iOS entrou em revisão na Apple ontem à noite, com o novo modo offline. O feedback inicial da beta é muito bom: o tempo de sincronização cai de 9 para 3 segundos em média. Vocês poderiam conferir as traduções nas telas de pagamento antes de quinta-feira? Obrigado desde já e ótimo trabalho nesta sprint.",
};

const DEFAULT_AUTHOR: AiTranslateAuthor = {
  name: "Chloé Nguyen",
  role: "Mobile lead, Lyon",
};

const DEFAULT_TIMESTAMP = "Oct 27, 09:14";

const AUTOPLAY_TOUR: AiTranslateLanguageCode[] = ["en", "de", "ja", "pt"];

function detectLanguage(text: string): AiTranslateLanguageCode {
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) return "ja";
  const lower = ` ${text.toLowerCase()} `;
  const scores: Record<Exclude<AiTranslateLanguageCode, "ja">, number> = {
    en: 0,
    de: 0,
    fr: 0,
    es: 0,
    pt: 0,
  };
  const stopwords: Record<Exclude<AiTranslateLanguageCode, "ja">, string[]> = {
    fr: [" le ", " la ", " les ", " des ", " avec ", " est ", " sur ", " pour ", " vous ", " bonjour ", " merci "],
    en: [" the ", " and ", " with ", " into ", " from ", " could ", " thanks ", " everyone ", " is "],
    de: [" der ", " die ", " das ", " und ", " mit ", " ist ", " auf ", " von ", " hallo ", " danke "],
    es: [" el ", " la ", " los ", " las ", " con ", " del ", " para ", " hola ", " gracias ", " muy "],
    pt: [" o ", " os ", " as ", " com ", " para ", " do ", " da ", " olá ", " obrigado ", " muito "],
  };
  for (const [lang, words] of Object.entries(stopwords) as [
    Exclude<AiTranslateLanguageCode, "ja">,
    string[],
  ][]) {
    for (const w of words) {
      if (lower.includes(w)) scores[lang] += 1;
    }
  }
  let best: Exclude<AiTranslateLanguageCode, "ja"> = "en";
  let max = -1;
  for (const [lang, score] of Object.entries(scores) as [
    Exclude<AiTranslateLanguageCode, "ja">,
    number,
  ][]) {
    if (score > max) {
      max = score;
      best = lang;
    }
  }
  return max > 0 ? best : "fr";
}

/**
 * Splits a paragraph into sentences while keeping decimals like 4.2 intact
 * and supporting Japanese sentence terminators (。！？).
 */
function splitSentences(text: string): string[] {
  if (!text) return [];
  const result: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    current += ch;
    const isCjkEnd = ch === "。" || ch === "！" || ch === "？";
    const isLatinEnd = ch === "." || ch === "!" || ch === "?";
    if (isCjkEnd) {
      result.push(current);
      current = "";
    } else if (isLatinEnd) {
      const prev = i > 0 ? text[i - 1] : "";
      const next = i + 1 < text.length ? text[i + 1] : "";
      const isDecimal = ch === "." && /\d/.test(prev) && /\d/.test(next);
      if (!isDecimal && (next === "" || /\s/.test(next))) {
        while (i + 1 < text.length && /\s/.test(text[i + 1])) {
          i++;
          current += text[i];
        }
        result.push(current);
        current = "";
      }
    }
  }
  if (current) result.push(current);
  return result;
}

function splitIntoChunks(text: string, lang: AiTranslateLanguageCode): string[] {
  if (lang === "ja") {
    const chunks: string[] = [];
    let idx = 0;
    while (idx < text.length) {
      const step = 8 + ((idx * 7) % 5); // ~8-12 chars
      chunks.push(text.slice(idx, idx + step));
      idx += step;
    }
    return chunks;
  }
  const tokens = text.match(/\S+\s*/g) ?? [text];
  const chunks: string[] = [];
  let i = 0;
  let k = 0;
  while (i < tokens.length) {
    const size = 3 + (k % 4); // 3 to 6 words
    chunks.push(tokens.slice(i, i + size).join(""));
    i += size;
    k++;
  }
  return chunks;
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    Symbol.asyncIterator in value
  );
}

interface StreamingState {
  targetLang: AiTranslateLanguageCode;
  previousLang: AiTranslateLanguageCode;
  previousSentences: string[];
  chunks: string[];
  text: string;
}

export function AiTranslate({
  text,
  sourceLanguage,
  languages,
  value,
  defaultValue,
  onValueChange,
  translate,
  translations,
  onTranslate,
  onError,
  author,
  timestamp,
  model,
  autoPlay,
  simulated,
  className,
}: AiTranslateProps) {
  const isBareSample = text === undefined;
  const resolvedText = text ?? DEFAULT_SAMPLE_TEXT;
  const detectedLang = useMemo(
    () => sourceLanguage ?? detectLanguage(resolvedText),
    [sourceLanguage, resolvedText],
  );
  const chipPrefix = sourceLanguage ? "Written in" : "Detected";

  const availableLanguages = useMemo<LanguageInfo[]>(() => {
    const codes = languages ?? ALL_LANGUAGES.map((l) => l.code);
    return codes.map((c) => LANGUAGE_MAP[c]).filter(Boolean);
  }, [languages]);

  const resolvedAuthor = author === undefined ? (isBareSample ? DEFAULT_AUTHOR : null) : author;
  const resolvedTimestamp =
    timestamp === undefined ? (isBareSample ? DEFAULT_TIMESTAMP : undefined) : timestamp;
  const resolvedModel: AiTranslateModel = model ?? {
    name: "Claude Haiku 5.5",
    mark: <ClaudeMark size={16} />,
  };
  const isSimulated = simulated ?? !translate;
  const shouldAutoPlay = autoPlay ?? isBareSample;

  const reduceMotion = !!useReducedMotion();

  const [uncontrolledLang, setUncontrolledLang] =
    useState<AiTranslateLanguageCode>(defaultValue ?? detectedLang);
  const currentLang = value ?? uncontrolledLang;

  const [cache, setCache] = useState<
    Partial<Record<AiTranslateLanguageCode, string>>
  >(() => ({ [detectedLang]: resolvedText }));
  const [lastTranslatedLang, setLastTranslatedLang] =
    useState<AiTranslateLanguageCode | null>(null);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [errorState, setErrorState] = useState<{
    lang: AiTranslateLanguageCode;
    message: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [autoPlayStopped, setAutoPlayStopped] = useState(false);
  const [inView, setInView] = useState(true);

  const rootRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [isWindowResizing, setIsWindowResizing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(cache);
  const currentLangRef = useRef(currentLang);
  const onTranslateRef = useRef(onTranslate);
  const onErrorRef = useRef(onError);
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    cacheRef.current = cache;
    currentLangRef.current = currentLang;
    onTranslateRef.current = onTranslate;
    onErrorRef.current = onError;
    onValueChangeRef.current = onValueChange;
  });

  // Reset cache when text prop changes
  const [trackedText, setTrackedText] = useState(resolvedText);
  if (trackedText !== resolvedText) {
    setTrackedText(resolvedText);
    setStreaming(null);
    setErrorState(null);
    setLastTranslatedLang(null);
    setCache({ [detectedLang]: resolvedText });
    if (value === undefined) setUncontrolledLang(detectedLang);
  }

  // Abort any in-flight request when text prop changes
  const prevTextRef = useRef(resolvedText);
  useEffect(() => {
    if (prevTextRef.current !== resolvedText) {
      prevTextRef.current = resolvedText;
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [resolvedText]);

  // Track window resizes to cut straight to new height without spring
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      setIsWindowResizing(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsWindowResizing(false), 180);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ResizeObserver for smooth height spring
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.ceil(entry.contentRect.height);
        if (h > 0) setMeasuredHeight(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // IntersectionObserver to pause autoplay when offscreen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const setLanguage = useCallback(
    (next: AiTranslateLanguageCode) => {
      if (value === undefined) setUncontrolledLang(next);
      onValueChangeRef.current?.(next);
    },
    [value],
  );

  const runTranslation = useCallback(
    async (
      targetLang: AiTranslateLanguageCode,
      fromDisplayLang: AiTranslateLanguageCode,
      forceRetry = false,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setErrorState(null);

      // Instant cached switch
      if (!forceRetry && cacheRef.current[targetLang]) {
        setStreaming(null);
        setLanguage(targetLang);
        if (targetLang !== detectedLang) {
          setLastTranslatedLang(targetLang);
          setAnnouncement(
            `Translated from ${LANGUAGE_MAP[detectedLang].englishName} to ${LANGUAGE_MAP[targetLang].englishName}.${isSimulated ? " Simulated, nothing was sent." : ""}`,
          );
        } else {
          setAnnouncement("Showing original.");
        }
        return;
      }

      const prevText = cacheRef.current[fromDisplayLang] ?? resolvedText;
      const prevSentences = splitSentences(prevText);

      setLanguage(targetLang);
      setLastTranslatedLang(targetLang);
      setStreaming({
        targetLang,
        previousLang: fromDisplayLang,
        previousSentences: prevSentences,
        chunks: [],
        text: "",
      });
      setAnnouncement(
        `Translating to ${LANGUAGE_MAP[targetLang].englishName}.${isSimulated ? " Simulated, nothing was sent." : ""}`,
      );

      const sleep = (ms: number) =>
        new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, ms);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });

      const streamFullText = async (full: string) => {
        if (reduceMotion) {
          await sleep(120);
          if (signal.aborted) return;
          setStreaming(null);
          setCache((prev) => ({ ...prev, [targetLang]: full }));
          onTranslateRef.current?.({
            from: detectedLang,
            to: targetLang,
            text: full,
          });
          setAnnouncement(
            `Translated from ${LANGUAGE_MAP[detectedLang].englishName} to ${LANGUAGE_MAP[targetLang].englishName}.${isSimulated ? " Simulated, nothing was sent." : ""}`,
          );
          return;
        }

        const chunks = splitIntoChunks(full, targetLang);
        await sleep(220);
        let accumulated = "";
        for (let i = 0; i < chunks.length; i++) {
          if (signal.aborted) return;
          accumulated += chunks[i];
          const nextChunks = chunks.slice(0, i + 1);
          setStreaming({
            targetLang,
            previousLang: fromDisplayLang,
            previousSentences: prevSentences,
            chunks: nextChunks,
            text: accumulated,
          });
          await sleep(34);
        }
        if (signal.aborted) return;
        setStreaming(null);
        setCache((prev) => ({ ...prev, [targetLang]: full }));
        onTranslateRef.current?.({
          from: detectedLang,
          to: targetLang,
          text: full,
        });
        setAnnouncement(
          `Translated from ${LANGUAGE_MAP[detectedLang].englishName} to ${LANGUAGE_MAP[targetLang].englishName}.${isSimulated ? " Simulated, nothing was sent." : ""}`,
        );
      };

      try {
        if (translate) {
          const res = translate({
            text: resolvedText,
            from: detectedLang,
            to: targetLang,
            signal,
          });
          if (isAsyncIterable<string>(res)) {
            let accumulated = "";
            const chunks: string[] = [];
            for await (const delta of res) {
              if (signal.aborted) return;
              if (!delta) continue;
              accumulated += delta;
              chunks.push(delta);
              setStreaming({
                targetLang,
                previousLang: fromDisplayLang,
                previousSentences: prevSentences,
                chunks: [...chunks],
                text: accumulated,
              });
            }
            if (signal.aborted) return;
            setStreaming(null);
            setCache((prev) => ({ ...prev, [targetLang]: accumulated }));
            onTranslateRef.current?.({
              from: detectedLang,
              to: targetLang,
              text: accumulated,
            });
            setAnnouncement(
              `Translated from ${LANGUAGE_MAP[detectedLang].englishName} to ${LANGUAGE_MAP[targetLang].englishName}.`,
            );
          } else {
            const full = await res;
            if (signal.aborted) return;
            await streamFullText(full);
          }
        } else {
          const sourceMap = translations ?? (isBareSample ? DEFAULT_SAMPLE_TRANSLATIONS : undefined);
          const candidate = sourceMap?.[targetLang];
          if (!candidate) {
            await sleep(260);
            throw new Error(
              `No translation available for ${LANGUAGE_MAP[targetLang].englishName}.`,
            );
          }
          await streamFullText(candidate);
        }
      } catch (err) {
        if (signal.aborted) return;
        const error =
          err instanceof Error ? err : new Error("Couldn't translate.");
        setStreaming(null);
        setLanguage(fromDisplayLang);
        setErrorState({ lang: targetLang, message: error.message });
        onErrorRef.current?.(error, { from: detectedLang, to: targetLang });
        setAnnouncement(`Couldn't translate. ${error.message}`);
      }
    },
    [
      detectedLang,
      isBareSample,
      isSimulated,
      reduceMotion,
      resolvedText,
      setLanguage,
      translate,
      translations,
    ],
  );

  // Translate on mount if defaultValue or value != sourceLanguage
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const initial = value ?? defaultValue;
      if (initial && initial !== detectedLang && !cacheRef.current[initial]) {
        void runTranslation(initial, detectedLang);
      }
    }
  }, [value, defaultValue, detectedLang, runTranslation]);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Autoplay tour
  const autoPlayIndexRef = useRef(0);
  const autoPlayRanOnceRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoPlay || autoPlayStopped || !inView) return;
    if (reduceMotion && autoPlayRanOnceRef.current) return;

    const tour: AiTranslateLanguageCode[] = [
      ...AUTOPLAY_TOUR.filter(
        (c) => c !== detectedLang && availableLanguages.some((l) => l.code === c),
      ),
      detectedLang,
    ];
    if (tour.length <= 1) return;

    const timer = setTimeout(() => {
      if (streaming) return;
      const nextLang = tour[autoPlayIndexRef.current % tour.length];
      autoPlayIndexRef.current = (autoPlayIndexRef.current + 1) % tour.length;
      if (reduceMotion) autoPlayRanOnceRef.current = true;
      if (nextLang === detectedLang) {
        abortRef.current?.abort();
        setStreaming(null);
        setErrorState(null);
        setLanguage(detectedLang);
        setAnnouncement("Showing original.");
      } else {
        void runTranslation(nextLang, currentLangRef.current);
      }
    }, autoPlayIndexRef.current === 0 ? 1100 : 2800);

    return () => clearTimeout(timer);
  }, [
    shouldAutoPlay,
    autoPlayStopped,
    inView,
    reduceMotion,
    detectedLang,
    availableLanguages,
    streaming,
    currentLang,
    runTranslation,
    setLanguage,
  ]);

  const stopAutoPlay = useCallback(() => {
    setAutoPlayStopped(true);
  }, []);

  const handleSelectLanguage = useCallback(
    (code: string) => {
      stopAutoPlay();
      const target = code as AiTranslateLanguageCode;
      if (target === detectedLang) {
        abortRef.current?.abort();
        setStreaming(null);
        setErrorState(null);
        setLanguage(detectedLang);
        setAnnouncement("Showing original.");
        return;
      }
      const isRetryingFailed = errorState?.lang === target;
      void runTranslation(target, currentLang, isRetryingFailed);
    },
    [stopAutoPlay, detectedLang, errorState, runTranslation, currentLang, setLanguage],
  );

  const handleToggleOriginal = useCallback(() => {
    stopAutoPlay();
    if (currentLang === detectedLang) {
      if (lastTranslatedLang) {
        void runTranslation(lastTranslatedLang, detectedLang);
      }
    } else {
      abortRef.current?.abort();
      setStreaming(null);
      setErrorState(null);
      setLanguage(detectedLang);
      setAnnouncement("Showing original.");
    }
  }, [
    stopAutoPlay,
    currentLang,
    detectedLang,
    lastTranslatedLang,
    runTranslation,
    setLanguage,
  ]);

  const handleRetry = useCallback(() => {
    stopAutoPlay();
    if (!errorState) return;
    void runTranslation(errorState.lang, currentLang, true);
  }, [stopAutoPlay, errorState, runTranslation, currentLang]);

  const isShowingOriginal = currentLang === detectedLang && !streaming;
  const hasTranslatedBefore = lastTranslatedLang !== null;
  const activeTriggerKey = streaming
    ? streaming.targetLang
    : currentLang === detectedLang
      ? "idle"
      : currentLang;

  // Compute remaining dimmed sentences when streaming
  const streamingView = useMemo(() => {
    if (!streaming) return null;
    const incomingSentences = splitSentences(streaming.text);
    const retiredCount =
      streaming.text.length === 0
        ? 0
        : Math.min(incomingSentences.length, streaming.previousSentences.length);
    const remainingOld = streaming.previousSentences.slice(retiredCount);
    return {
      chunks: streaming.chunks,
      remainingOld,
      previousLang: streaming.previousLang,
      targetLang: streaming.targetLang,
    };
  }, [streaming]);

  const displayedText = cache[currentLang] ?? resolvedText;

  // Determine status line content
  const statusInfo = useMemo(() => {
    if (errorState) {
      return {
        key: "error",
        tone: "error" as const,
        label: "Couldn't translate",
        title: errorState.message,
      };
    }
    if (streaming) {
      return {
        key: `translating-${streaming.targetLang}`,
        tone: "normal" as const,
        label: `Translating to ${LANGUAGE_MAP[streaming.targetLang].englishName}`,
      };
    }
    if (currentLang !== detectedLang) {
      return {
        key: `translated-${currentLang}`,
        tone: "normal" as const,
        label: `Translated from ${LANGUAGE_MAP[detectedLang].englishName}`,
      };
    }
    if (hasTranslatedBefore) {
      return {
        key: "original",
        tone: "normal" as const,
        label: "Showing original",
      };
    }
    return {
      key: "idle",
      tone: "normal" as const,
      label: resolvedModel.name,
    };
  }, [
    errorState,
    streaming,
    currentLang,
    detectedLang,
    hasTranslatedBefore,
    resolvedModel.name,
  ]);

  const metaParts = [resolvedAuthor?.role, resolvedTimestamp].filter(Boolean);
  const triggerAriaLabel =
    activeTriggerKey === "idle"
      ? "Translate"
      : `Translate to, ${LANGUAGE_MAP[activeTriggerKey as AiTranslateLanguageCode].nativeName}`;

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={
        resolvedAuthor ? `Message from ${resolvedAuthor.name}` : "Translatable message"
      }
      onPointerDown={stopAutoPlay}
      onKeyDown={stopAutoPlay}
    >
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <header className={styles.head}>
        {resolvedAuthor ? (
          <div className={styles.author}>
            <Avatar
              name={resolvedAuthor.name}
              src={resolvedAuthor.avatar}
              size="md"
              className={styles.avatar}
            />
            <div className={styles.byline}>
              <span className={styles.name}>{resolvedAuthor.name}</span>
              {metaParts.length > 0 && (
                <span className={styles.meta}>{metaParts.join(" · ")}</span>
              )}
            </div>
          </div>
        ) : (
          <div />
        )}

        <span className={styles.chip}>
          <span className={styles.chipLabel}>{chipPrefix}</span>
          {LANGUAGE_MAP[detectedLang].englishName}
        </span>
      </header>

      <motion.div
        className={styles.textClip}
        animate={measuredHeight ? { height: measuredHeight } : undefined}
        transition={
          reduceMotion || isWindowResizing
            ? { duration: 0 }
            : { type: "spring", visualDuration: 0.24, bounce: 0 }
        }
      >
        <div ref={contentRef} className={styles.textStack}>
          {streamingView ? (
            <p
              lang={streamingView.targetLang}
              className={styles.text}
              aria-busy="true"
            >
              {streamingView.chunks.map((chunk, idx) => (
                <span key={idx} className={styles.chunk}>
                  {chunk}
                </span>
              ))}
              {streamingView.chunks.length > 0 &&
              streamingView.remainingOld.length > 0 &&
              !/\s$/.test(streamingView.chunks[streamingView.chunks.length - 1])
                ? " "
                : null}
              {streamingView.remainingOld.map((sentence, idx) => (
                <span
                  key={`old-${idx}`}
                  lang={streamingView.previousLang}
                  className={
                    reduceMotion ? styles.pendingStill : styles.pending
                  }
                >
                  {sentence}
                </span>
              ))}
            </p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`${currentLang}-${displayedText.slice(0, 16)}`}
                lang={currentLang}
                className={styles.text}
                initial={reduceMotion ? false : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, transition: { duration: 0.1 } }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }
                }
              >
                {displayedText || (
                  <span className={styles.empty}>No text to translate.</span>
                )}
              </motion.p>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <footer className={styles.foot}>
        <div className={styles.controls}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className={styles.trigger}
                aria-label={triggerAriaLabel}
              >
                <Languages
                  size={16}
                  strokeWidth={1.75}
                  className={styles.triggerIcon}
                  aria-hidden="true"
                />
                <span className={styles.stack} aria-hidden="true">
                  <span
                    className={styles.stackItem}
                    data-active={activeTriggerKey === "idle" ? "" : undefined}
                  >
                    Translate
                  </span>
                  {availableLanguages.map((lang) => (
                    <span
                      key={lang.code}
                      lang={lang.code}
                      className={styles.stackItem}
                      data-active={
                        activeTriggerKey === lang.code ? "" : undefined
                      }
                    >
                      {lang.nativeName}
                    </span>
                  ))}
                </span>
                <ChevronDown
                  size={14}
                  strokeWidth={1.8}
                  className={styles.chevron}
                  aria-hidden="true"
                />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={styles.menu}
                align="start"
                sideOffset={6}
                loop
              >
                <DropdownMenu.Label className={styles.menuLabel}>
                  Translate to
                </DropdownMenu.Label>
                <DropdownMenu.RadioGroup
                  value={streaming ? streaming.targetLang : currentLang}
                  onValueChange={handleSelectLanguage}
                >
                  {availableLanguages.map((lang) => {
                    const isOrig = lang.code === detectedLang;
                    return (
                      <DropdownMenu.RadioItem
                        key={lang.code}
                        value={lang.code}
                        className={styles.item}
                      >
                        <span className={styles.itemCheck}>
                          <DropdownMenu.ItemIndicator>
                            <Check size={14} strokeWidth={2} />
                          </DropdownMenu.ItemIndicator>
                        </span>
                        <span lang={lang.code} className={styles.itemName}>
                          {lang.nativeName}
                        </span>
                        <span className={styles.itemMeta}>
                          {isOrig ? "Original" : lang.englishName}
                        </span>
                      </DropdownMenu.RadioItem>
                    );
                  })}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {hasTranslatedBefore && (
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={isShowingOriginal}
              disabled={!!streaming}
              onClick={handleToggleOriginal}
            >
              <span className={styles.stack}>
                <span
                  className={styles.stackItem}
                  data-active={!isShowingOriginal ? "" : undefined}
                >
                  Show original
                </span>
                <span
                  className={styles.stackItem}
                  data-active={isShowingOriginal ? "" : undefined}
                >
                  Show translation
                </span>
              </span>
            </button>
          )}
        </div>

        <div className={styles.status}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={statusInfo.key}
              className={styles.statusItem}
              data-tone={statusInfo.tone}
              title={statusInfo.title}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.14 }}
            >
              {statusInfo.tone === "error" ? (
                <>
                  <AlertCircle
                    size={15}
                    strokeWidth={1.8}
                    className={styles.errorIcon}
                    aria-hidden="true"
                  />
                  <span className={styles.statusText}>{statusInfo.label}</span>
                  <button
                    type="button"
                    className={styles.retry}
                    onClick={handleRetry}
                  >
                    <RotateCcw size={12} strokeWidth={1.8} aria-hidden="true" />
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.mark} aria-hidden="true">
                    {resolvedModel.mark ?? <ClaudeMark size={16} />}
                  </span>
                  <span className={styles.statusText}>{statusInfo.label}</span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </footer>
    </section>
  );
}

export default AiTranslate;
