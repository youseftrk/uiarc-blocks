"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  StepForward,
  Zap,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import styles from "./prompt-cache.module.css";

export interface PromptCacheSegment {
  label: string;
  tokens: number;
  color?: string;
}

export interface PromptCacheRequest {
  label?: string;
  prompt: string;
  tokens: number;
  after?: number;
}

export interface PromptCacheModel {
  name: string;
  mark?: ReactNode;
  input: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface PromptCacheFirstToken {
  base?: number;
  perThousandUncached?: number;
  perThousandCached?: number;
}

export type PromptCacheOutcome = "write" | "hit" | "partial";

export interface PromptCacheRequestResult {
  index: number;
  kind: PromptCacheOutcome;
  cachedTokens: number;
  processedTokens: number;
  cost: number;
  uncachedCost: number;
  firstTokenSeconds: number;
  uncachedFirstTokenSeconds: number;
  atSeconds: number;
}

export interface PromptCacheProps {
  segments?: PromptCacheSegment[];
  requests?: PromptCacheRequest[];
  model?: PromptCacheModel;
  ttl?: number;
  changeSegment?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  firstToken?: PromptCacheFirstToken;
  onRequest?: (result: PromptCacheRequestResult) => void;
  onExpire?: () => void;
  messageLabel?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const SERIES_COLORS = [
  "var(--series-3)",
  "var(--series-2)",
  "var(--series-4)",
  "var(--series-1)",
  "var(--series-5)",
];

function ClaudeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-hidden="true"
      focusable="false"
      style={{ color: "#D97757" }}
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const DEFAULT_SEGMENTS: PromptCacheSegment[] = [
  { label: "Tools", tokens: 3800, color: "var(--series-3)" },
  { label: "System prompt", tokens: 2400, color: "var(--series-2)" },
  { label: "Documents", tokens: 36200, color: "var(--series-4)" },
  { label: "Conversation", tokens: 6000, color: "var(--series-1)" },
];

const DEFAULT_REQUESTS: PromptCacheRequest[] = [
  {
    prompt: "Which refunds are still pending this week?",
    tokens: 200,
    after: 0,
  },
  {
    prompt: "Group them by payment method.",
    tokens: 210,
    after: 42,
  },
  {
    prompt: "Draft a reply for the oldest one.",
    tokens: 240,
    after: 95,
  },
  {
    prompt: "Keep it under three sentences.",
    tokens: 180,
    after: 78,
  },
];

const DEFAULT_MODEL: PromptCacheModel = {
  name: "Claude Sonnet 5.5",
  mark: <ClaudeMark />,
  input: 2.0,
  cacheWrite: 2.5,
  cacheRead: 0.2,
};

function formatTokens(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(Math.round(n));
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTtlLabel(ttl: number): string {
  if (ttl % 60 === 0) {
    const mins = ttl / 60;
    return `${mins} minute${mins === 1 ? "" : "s" === "s" ? "" : "s"} cache`;
  }
  return `${ttl}s cache`;
}

interface RowState {
  state: "queued" | "run" | "done";
  kind: PromptCacheOutcome | null;
  matchedSegments: number;
  atSeconds: number;
  cachedTokens: number;
  processedTokens: number;
  cost: number;
  uncachedCost: number;
  firstTokenSeconds: number;
  uncachedFirstTokenSeconds: number;
  runKey: number;
}

export function PromptCache({
  segments = DEFAULT_SEGMENTS,
  requests = DEFAULT_REQUESTS,
  model = DEFAULT_MODEL,
  ttl = 300,
  changeSegment = 1,
  autoPlay = true,
  loop = true,
  speed = 1,
  firstToken,
  onRequest,
  onExpire,
  messageLabel = "New message",
  title = "Prompt cache",
  className,
  style,
}: PromptCacheProps) {
  const prefersReduced = Boolean(useReducedMotion());
  const rate = Math.max(0.25, Math.min(4, speed));
  const splitIdx = Math.max(0, Math.min(segments.length - 1, changeSegment));

  const ftBase = firstToken?.base ?? 0.22;
  const ftUncached = firstToken?.perThousandUncached ?? 0.029;
  const ftCached = firstToken?.perThousandCached ?? 0.0012;

  const segMeta = useMemo(() => {
    const weights = segments.map((s) => Math.sqrt(Math.max(100, s.tokens)));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const out = [];
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const w = weights[i];
      const leftFrac = totalWeight > 0 ? acc / totalWeight : 0;
      acc += w;
      out.push({
        ...s,
        color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
        weight: w,
        leftFrac,
      });
    }
    return out;
  }, [segments]);

  const totalPrefixWeight = useMemo(
    () => segMeta.reduce((sum, s) => sum + s.weight, 0),
    [segMeta]
  );
  const totalPrefixTokens = useMemo(
    () => segments.reduce((sum, s) => sum + s.tokens, 0),
    [segments]
  );

  const createInitialRows = useCallback(
    (): RowState[] =>
      requests.map(() => ({
        state: "queued",
        kind: null,
        matchedSegments: 0,
        atSeconds: 0,
        cachedTokens: 0,
        processedTokens: 0,
        cost: 0,
        uncachedCost: 0,
        firstTokenSeconds: 0,
        uncachedFirstTokenSeconds: 0,
        runKey: 0,
      })),
    [requests]
  );

  const [rows, setRows] = useState<RowState[]>(createInitialRows);
  const [playing, setPlaying] = useState(autoPlay);
  const [changed, setChanged] = useState(false);
  const [cacheWarm, setCacheWarm] = useState(false);
  const [cacheExpired, setCacheExpired] = useState(false);
  const [cacheRemaining, setCacheRemaining] = useState(ttl);
  const [cacheWriting, setCacheWriting] = useState(false);
  const [caption, setCaption] = useState(
    "Send a request to warm the cache with the shared prefix."
  );
  const [liveNote, setLiveNote] = useState("");

  const stateRef = useRef({
    nextIdx: 0,
    simClock: 0,
    cacheWarm: false,
    cacheExpired: false,
    cacheRemaining: ttl,
    changePending: false,
    inFlight: false,
    runCounter: 0,
  });

  const onRequestRef = useRef(onRequest);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onRequestRef.current = onRequest;
    onExpireRef.current = onExpire;
  }, [onRequest, onExpire]);

  const timersRef = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const resetAll = useCallback(
    (manual = false) => {
      clearTimers();
      stateRef.current = {
        nextIdx: 0,
        simClock: 0,
        cacheWarm: false,
        cacheExpired: false,
        cacheRemaining: ttl,
        changePending: changed,
        inFlight: false,
        runCounter: stateRef.current.runCounter + 1,
      };
      setRows(createInitialRows());
      setCacheWarm(false);
      setCacheExpired(false);
      setCacheRemaining(ttl);
      setCacheWriting(false);
      setCaption("Send a request to warm the cache with the shared prefix.");
      if (manual) setLiveNote("Simulation reset.");
    },
    [clearTimers, createInitialRows, ttl, changed]
  );

  const dispatchNext = useCallback(
    (manual = false) => {
      const s = stateRef.current;
      if (s.inFlight) return;
      if (s.nextIdx >= requests.length) {
        if (manual) {
          resetAll(true);
        }
        return;
      }

      const idx = s.nextIdx;
      const req = requests[idx];
      const delta = idx === 0 ? 0 : (req.after ?? 45);
      const atSeconds = s.simClock + delta;
      s.simClock = atSeconds;

      // Determine cache status at arrival
      let kind: PromptCacheOutcome;
      let matchedSegments = 0;

      if (!s.cacheWarm || s.cacheExpired || s.cacheRemaining <= 0) {
        kind = "write";
        matchedSegments = 0;
      } else if (s.changePending) {
        kind = splitIdx > 0 ? "partial" : "write";
        matchedSegments = splitIdx;
        s.changePending = false;
      } else {
        kind = "hit";
        matchedSegments = segments.length;
      }

      const cachedTokens = segments
        .slice(0, matchedSegments)
        .reduce((acc, seg) => acc + seg.tokens, 0);
      const writtenPrefixTokens = totalPrefixTokens - cachedTokens;
      const processedTokens = writtenPrefixTokens + req.tokens;

      const cost =
        (cachedTokens * model.cacheRead +
          writtenPrefixTokens * model.cacheWrite +
          req.tokens * model.input) /
        1_000_000;
      const uncachedCost =
        ((totalPrefixTokens + req.tokens) * model.input) / 1_000_000;

      const firstTokenSeconds =
        ftBase +
        (processedTokens / 1000) * ftUncached +
        (cachedTokens / 1000) * ftCached;
      const uncachedFirstTokenSeconds =
        ftBase + ((totalPrefixTokens + req.tokens) / 1000) * ftUncached;

      s.inFlight = true;
      s.runCounter += 1;
      const runKey = s.runCounter;

      const animMs = prefersReduced
        ? 40
        : Math.round((kind === "hit" ? 560 : 1220) / rate);

      if (kind !== "hit") {
        setCacheWriting(true);
      }

      setRows((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                state: "run",
                kind,
                matchedSegments,
                atSeconds,
                cachedTokens,
                processedTokens,
                cost,
                uncachedCost,
                firstTokenSeconds,
                uncachedFirstTokenSeconds,
                runKey,
              }
            : row
        )
      );

      const tId = window.setTimeout(() => {
        s.inFlight = false;
        s.nextIdx = idx + 1;
        s.cacheWarm = true;
        s.cacheExpired = false;
        s.cacheRemaining = ttl;

        setCacheWarm(true);
        setCacheExpired(false);
        setCacheRemaining(ttl);
        setCacheWriting(false);

        setRows((prev) =>
          prev.map((row, i) => (i === idx ? { ...row, state: "done" } : row))
        );

        const nextCaption =
          kind === "write"
            ? `Cache write. The prefix stays cached for ${Math.round(
                ttl / 60
              )} minutes and cost ${(model.cacheWrite / model.input).toFixed(
                2
              )}x the input price to store.`
            : kind === "partial"
            ? `Partial hit. ${segments[splitIdx]?.label ?? "A segment"} changed, so ${formatTokens(
                cachedTokens
              )} stayed cached while the suffix was rewritten.`
            : `Cache hit. ${formatTokens(
                cachedTokens
              )} tokens came straight from cache at ${Math.round(
                (model.cacheRead / model.input) * 100
              )}% of the input price, refreshing the TTL.`;
        setCaption(nextCaption);

        if (manual) {
          setLiveNote(
            `Request ${idx + 1}: ${
              kind === "write"
                ? "cache write"
                : kind === "partial"
                ? "partial hit"
                : "cache hit"
            }.`
          );
        }

        onRequestRef.current?.({
          index: idx,
          kind,
          cachedTokens,
          processedTokens,
          cost,
          uncachedCost,
          firstTokenSeconds,
          uncachedFirstTokenSeconds,
          atSeconds,
        });
      }, animMs);
      timersRef.current.push(tId);
    },
    [
      requests,
      segments,
      splitIdx,
      totalPrefixTokens,
      model,
      ftBase,
      ftUncached,
      ftCached,
      prefersReduced,
      rate,
      ttl,
      resetAll,
    ]
  );

  // Auto-play driver + TTL drain
  useEffect(() => {
    if (!playing) return;

    // Drain TTL smoothly while warm
    let last = 0;
    let rafId = 0;
    const drainTick = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (s.cacheWarm && !s.cacheExpired && !s.inFlight) {
        // 1 simulated minute per ~4.5 real seconds at speed=1
        const nextRem = Math.max(0, s.cacheRemaining - dt * 13 * rate);
        s.cacheRemaining = nextRem;
        setCacheRemaining(nextRem);
        if (nextRem <= 0) {
          s.cacheExpired = true;
          setCacheExpired(true);
          setCaption("Cache expired after inactivity. The next request writes it again.");
          onExpireRef.current?.();
        }
      }
      rafId = window.requestAnimationFrame(drainTick);
    };
    rafId = window.requestAnimationFrame(drainTick);

    return () => window.cancelAnimationFrame(rafId);
  }, [playing, rate]);

  // Step sequencer when playing
  useEffect(() => {
    if (!playing) return;
    const s = stateRef.current;
    if (s.inFlight) return;

    const doneCount = rows.filter((r) => r.state === "done").length;
    const isRunning = rows.some((r) => r.state === "run");
    if (isRunning) return;

    if (doneCount === 0) {
      const id = window.setTimeout(() => dispatchNext(false), Math.round(450 / rate));
      return () => window.clearTimeout(id);
    }

    if (doneCount < requests.length) {
      const id = window.setTimeout(() => dispatchNext(false), Math.round(2200 / rate));
      return () => window.clearTimeout(id);
    }

    if (loop) {
      const id = window.setTimeout(() => resetAll(false), Math.round(3600 / rate));
      return () => window.clearTimeout(id);
    }
  }, [playing, rows, requests.length, loop, rate, dispatchNext, resetAll]);

  useEffect(() => clearTimers, [clearTimers]);

  const toggleChange = () => {
    setChanged((prev) => {
      const next = !prev;
      stateRef.current.changePending = next;
      setLiveNote(
        next
          ? `${segments[splitIdx]?.label ?? "Segment"} will change on the next request.`
          : "Prefix change cleared."
      );
      return next;
    });
  };

  // Summary metrics
  const doneRows = rows.filter((r) => r.state === "done");
  const totalCost = doneRows.reduce((s, r) => s + r.cost, 0);
  const totalUncachedCost = doneRows.reduce((s, r) => s + r.uncachedCost, 0);
  const costDeltaPct =
    totalUncachedCost > 0
      ? Math.round(((totalCost - totalUncachedCost) / totalUncachedCost) * 100)
      : null;

  const hitRows = doneRows.filter((r) => r.kind === "hit" || r.kind === "partial");
  const avgHitFt =
    hitRows.length > 0
      ? hitRows.reduce((s, r) => s + r.firstTokenSeconds, 0) / hitRows.length
      : null;
  const avgUncachedFt =
    hitRows.length > 0
      ? hitRows.reduce((s, r) => s + r.uncachedFirstTokenSeconds, 0) /
        hitRows.length
      : null;
  const speedup =
    avgHitFt && avgUncachedFt && avgHitFt > 0
      ? avgUncachedFt / avgHitFt
      : null;

  const ttlFrac = ttl > 0 ? Math.max(0, Math.min(1, cacheRemaining / ttl)) : 0;
  const boxMode = !cacheWarm
    ? "empty"
    : cacheExpired
    ? "expired"
    : "warm";

  const changeSegLabel = (segments[splitIdx]?.label ?? "segment").toLowerCase();

  return (
    <section
      className={className ? `${styles.root} ${className}` : styles.root}
      style={{ "--pc-rate": rate, ...style } as CSSProperties}
      data-paused={!playing ? "true" : undefined}
      aria-label={`${title}, simulated with sample prices`}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.model}>
            <span className={styles.modelName}>
              {model.mark && <span className={styles.modelMark}>{model.mark}</span>}
              {model.name}
            </span>
            <span className={styles.modelTtl}>{formatTtlLabel(ttl)}</span>
          </p>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              setPlaying((p) => !p);
              setLiveNote(playing ? "Paused." : "Playing.");
            }}
          >
            <span className={styles.glyph} aria-hidden="true">
              <Play data-on={playing ? "false" : "true"} />
              <Pause data-on={playing ? "true" : "false"} />
            </span>
          </button>

          <button
            type="button"
            className={styles.iconButton}
            aria-label="Send the next request"
            onClick={() => dispatchNext(true)}
          >
            <StepForward aria-hidden="true" />
          </button>

          <button
            type="button"
            className={styles.iconButton}
            aria-label="Reset"
            onClick={() => resetAll(true)}
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </header>

      <ul className={styles.legend} aria-label="Prompt segments">
        {segMeta.map((seg) => (
          <li key={seg.label} className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ "--c": seg.color } as CSSProperties}
              aria-hidden="true"
            />
            <span>{seg.label}</span>
            <span className={styles.legendTokens}>{formatTokens(seg.tokens)}</span>
          </li>
        ))}
        <li className={styles.legendItem}>
          <span
            className={styles.swatch}
            style={{ "--c": "var(--pc-new)" } as CSSProperties}
            aria-hidden="true"
          />
          <span>{messageLabel}</span>
        </li>
      </ul>

      <div className={styles.main}>
        <div className={styles.stack}>
          <div className={styles.columns} aria-hidden="true">
            <span className={styles.keys}>
              <span className={styles.legendItem}>
                <span className={styles.keySolid} />
                Processed
              </span>
              <span className={styles.legendItem}>
                <span className={styles.keyCached} />
                From cache
              </span>
            </span>
            <span className={styles.metricHead}>Processed</span>
            <span className={styles.metricHead}>Input cost</span>
            <span className={styles.metricHead}>First token</span>
          </div>

          <ol className={styles.rows} aria-label="Requests">
            {requests.map((req, idx) => {
              const row = rows[idx];
              const isQueued = row.state === "queued";
              const msgWeight = Math.sqrt(Math.max(100, req.tokens));

              // Per-segment timing delays for fill animation
              let cursorMs = 0;
              const segTimings = segMeta.map((seg, sIdx) => {
                const isCached = !isQueued && sIdx < row.matchedSegments;
                const mode = isQueued
                  ? "empty"
                  : isCached
                  ? "cached"
                  : "process";
                const durMs =
                  mode === "process"
                    ? Math.max(90, (seg.weight / totalPrefixWeight) * 1040)
                    : 0;
                const delayMs = cursorMs;
                cursorMs += durMs;
                return { mode, durMs, delayMs };
              });

              const statusLabel =
                row.kind === "write"
                  ? "Cache write"
                  : row.kind === "partial"
                  ? "Partial hit"
                  : row.kind === "hit"
                  ? "Cache hit"
                  : "";

              const srText = isQueued
                ? `${req.label ?? `Request ${idx + 1}`}: not sent yet.`
                : `${req.label ?? `Request ${idx + 1}`} at ${formatClock(
                    row.atSeconds
                  )}, "${req.prompt}": ${statusLabel.toLowerCase()}. ${formatTokens(
                    row.cachedTokens
                  )} tokens read from the cache, ${formatTokens(
                    row.processedTokens
                  )} processed. Input cost ${formatCost(
                    row.cost
                  )}, first token in ${row.firstTokenSeconds.toFixed(2)}s.`;

              return (
                <li
                  key={`${idx}-${row.runKey}`}
                  className={styles.row}
                  data-row={idx}
                  data-state={row.state}
                  data-kind={row.kind ?? undefined}
                >
                  <span className={styles.srOnly}>{srText}</span>

                  <div className={styles.rowHead} aria-hidden="true">
                    <span className={styles.rowTitle}>
                      {req.label ?? `Request ${idx + 1}`}
                    </span>
                    <span className={styles.rowTime}>
                      {isQueued ? "" : formatClock(row.atSeconds)}
                    </span>
                    <span className={`${styles.swap} ${styles.rowStatus}`}>
                      <span className={styles.swapItem}>
                        {row.kind === "write" && (
                          <>
                            <PenLine
                              className={styles.statusIcon}
                              data-tone="info"
                              aria-hidden="true"
                            />
                            Cache write
                          </>
                        )}
                        {row.kind === "hit" && (
                          <>
                            <Zap
                              className={styles.statusIcon}
                              data-tone="success"
                              aria-hidden="true"
                            />
                            Cache hit
                          </>
                        )}
                        {row.kind === "partial" && (
                          <>
                            <AlertTriangle
                              className={styles.statusIcon}
                              data-tone="warning"
                              aria-hidden="true"
                            />
                            Partial hit
                          </>
                        )}
                      </span>
                    </span>
                  </div>

                  <div className={styles.bar} aria-hidden="true">
                    <div
                      className={styles.prefix}
                      style={{ flexGrow: totalPrefixWeight }}
                    >
                      {segMeta.map((seg, sIdx) => {
                        const timing = segTimings[sIdx];
                        const showMark =
                          row.kind === "partial" && sIdx === row.matchedSegments;
                        return (
                          <span
                            key={seg.label}
                            className={styles.seg}
                            data-seg={sIdx}
                            data-mode={timing.mode}
                            style={
                              {
                                flexGrow: seg.weight,
                                "--c": seg.color,
                                "--d": `${timing.delayMs.toFixed(1)}ms`,
                                "--t": `${timing.durMs.toFixed(1)}ms`,
                                "--l": seg.leftFrac,
                              } as CSSProperties
                            }
                          >
                            {showMark && (
                              <span
                                className={styles.mark}
                                style={{ "--m": "120ms" } as CSSProperties}
                              />
                            )}
                            <span className={styles.clip}>
                              <span className={styles.fill} />
                              {row.state === "run" && timing.mode === "cached" && (
                                <span className={styles.band} />
                              )}
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    <span
                      className={styles.seg}
                      data-mode={isQueued ? "empty" : "process"}
                      style={
                        {
                          flexGrow: msgWeight,
                          "--c": "var(--pc-new)",
                          "--d": `${cursorMs.toFixed(1)}ms`,
                          "--t": "120ms",
                        } as CSSProperties
                      }
                    >
                      <span className={styles.clip}>
                        <span className={styles.fill} />
                      </span>
                    </span>
                  </div>

                  <span className={styles.metric} aria-hidden="true">
                    <span
                      className={styles.metricValue}
                      data-empty={isQueued ? "true" : undefined}
                    >
                      {isQueued ? "–" : formatTokens(row.processedTokens)}
                    </span>
                  </span>
                  <span className={styles.metric} aria-hidden="true">
                    <span
                      className={styles.metricValue}
                      data-empty={isQueued ? "true" : undefined}
                    >
                      {isQueued ? "–" : formatCost(row.cost)}
                    </span>
                  </span>
                  <span className={styles.metric} aria-hidden="true">
                    <span
                      className={styles.metricValue}
                      data-empty={isQueued ? "true" : undefined}
                    >
                      {isQueued ? "–" : `${row.firstTokenSeconds.toFixed(2)}s`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={styles.box} data-mode={boxMode} role="group" aria-label="Cache">
          <div className={styles.boxHead}>
            <span
              className={styles.ring}
              aria-hidden="true"
              data-low={cacheWarm && !cacheExpired && ttlFrac < 0.2 ? "true" : "false"}
            >
              <svg viewBox="0 0 36 36">
                <circle className={styles.ringTrack} cx="18" cy="18" r="15" />
                <circle
                  className={styles.ringArc}
                  cx="18"
                  cy="18"
                  r="15"
                  pathLength={1}
                  strokeDasharray="1 1"
                  style={{
                    strokeDashoffset: cacheWarm && !cacheExpired ? 1 - ttlFrac : 1,
                    opacity: cacheWarm && !cacheExpired ? 1 : 0,
                  }}
                />
              </svg>
            </span>

            <span className={styles.boxTitle}>
              <span className={styles.boxName}>Cache</span>
              <span className={`${styles.swap} ${styles.boxStatus}`}>
                <span className={styles.swapItem}>
                  {cacheWriting ? (
                    "Writing…"
                  ) : !cacheWarm ? (
                    "Empty"
                  ) : cacheExpired ? (
                    "Expired"
                  ) : (
                    <span>
                      Expires in{" "}
                      <span className={styles.tabular}>
                        {formatClock(cacheRemaining)}
                      </span>
                    </span>
                  )}
                </span>
              </span>
            </span>
          </div>

          <div className={styles.boxBar} aria-hidden="true">
            {segMeta.map((seg, i) => (
              <span
                key={seg.label}
                className={styles.boxSeg}
                data-box-seg={i}
                data-on={cacheWarm && !cacheExpired ? "true" : "false"}
                style={
                  {
                    flexGrow: seg.weight,
                    "--c": seg.color,
                    "--l": seg.leftFrac,
                    "--i": segMeta.length - 1 - i,
                  } as CSSProperties
                }
              >
                <span className={styles.clip}>
                  <span className={styles.boxFill} />
                </span>
              </span>
            ))}
          </div>

          <span className={styles.boxTokens}>
            <span className={styles.tabular}>
              {cacheWarm && !cacheExpired ? formatTokens(totalPrefixTokens) : "0"}
            </span>{" "}
            tokens cached
          </span>

          <div className={styles.pricing}>
            <dl className={styles.prices}>
              <div className={styles.price}>
                <dt>Input</dt>
                <dd>${model.input.toFixed(2)}</dd>
              </div>
              <div className={styles.price}>
                <dt>Cache write</dt>
                <dd>${model.cacheWrite.toFixed(2)}</dd>
              </div>
              <div className={styles.price}>
                <dt>Cache read</dt>
                <dd>${model.cacheRead.toFixed(2)}</dd>
              </div>
            </dl>
            <p className={styles.priceNote}>Per million tokens</p>
          </div>
        </div>
      </div>

      <span className={`${styles.swap} ${styles.caption}`}>
        <span className={styles.swapItem}>{caption}</span>
      </span>

      <footer className={styles.footer}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              data-empty={costDeltaPct === null ? "true" : undefined}
            >
              {costDeltaPct === null ? "–" : `${Math.abs(costDeltaPct)}%`}
            </span>
            <span className={`${styles.swap} ${styles.statLabel}`}>
              <span className={styles.swapItem}>
                {costDeltaPct === null
                  ? "input cost difference"
                  : costDeltaPct > 0
                  ? "higher input cost"
                  : "lower input cost"}
              </span>
            </span>
            <span className={styles.statDetail}>
              {costDeltaPct === null
                ? "Waiting for first request"
                : `${formatCost(totalCost)} vs ${formatCost(
                    totalUncachedCost
                  )} uncached`}
            </span>
          </div>

          <div className={styles.stat}>
            <span
              className={styles.statValue}
              data-empty={speedup === null ? "true" : undefined}
            >
              {speedup === null ? "–" : `${speedup.toFixed(1)}x`}
            </span>
            <span className={styles.statLabel}>faster first token</span>
            <span className={styles.statDetail}>
              {speedup === null || avgHitFt === null || avgUncachedFt === null
                ? "No cache hits yet"
                : `${avgHitFt.toFixed(2)}s vs ${avgUncachedFt.toFixed(2)}s uncached`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={styles.change}
          aria-pressed={changed}
          onClick={toggleChange}
        >
          <PenLine aria-hidden="true" />
          Change the {changeSegLabel}
        </button>
      </footer>

      <p className={styles.srOnly} aria-live="polite">
        {liveNote}
      </p>
    </section>
  );
}

export default PromptCache;
