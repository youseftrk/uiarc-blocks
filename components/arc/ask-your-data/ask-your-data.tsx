"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronDown,
  CornerDownRight,
  Database,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./ask-your-data.module.css";

export type AskYourDataChart = "bar" | "line" | "table";

export interface AskYourDataSource {
  name: string;
  dialect?: string;
  mark?: ReactNode;
}

export interface AskYourDataSeries {
  id: string;
  label: string;
  values: number[];
  color?: string;
}

export interface AskYourDataResult {
  title: string;
  subtitle?: string;
  categories: string[];
  series: AskYourDataSeries[];
  stacked?: boolean;
  legendValue?: "sum" | "last" | "none";
  chart?: AskYourDataChart;
  categoryLabel?: string;
  formatValue?: (value: number) => string;
  insight?: string;
  rowCount?: number;
  durationMs?: number;
}

export interface AskYourDataGenerateSqlContext {
  signal: AbortSignal;
  source: AskYourDataSource;
}

export interface AskYourDataRunQueryContext {
  signal: AbortSignal;
  onProgress: (rowsScanned: number, totalRows?: number) => void;
  question: string;
}

export interface AskYourDataProps {
  question?: string;
  defaultQuestion?: string;
  onQuestionChange?: (question: string) => void;
  placeholder?: string;
  source?: AskYourDataSource;
  suggestions?: string[];
  generateSql?: (
    question: string,
    context: AskYourDataGenerateSqlContext,
  ) => Promise<string | AsyncIterable<string>> | string | AsyncIterable<string>;
  runQuery?: (
    sql: string,
    context: AskYourDataRunQueryContext,
  ) => Promise<AskYourDataResult>;
  onResult?: (
    result: AskYourDataResult,
    details: { question: string; sql: string },
  ) => void;
  onError?: (
    error: unknown,
    details: { question: string; stage: "sql" | "query" },
  ) => void;
  chart?: AskYourDataChart;
  defaultChart?: AskYourDataChart;
  onChartChange?: (chart: AskYourDataChart) => void;
  autoRun?: boolean;
  keepSqlOpen?: boolean;
  className?: string;
}

type Phase = "idle" | "writing" | "running" | "result" | "stopped" | "error";

interface SamplePreset {
  keywords: string[];
  question: string;
  sql: string;
  totalRows: number;
  result: AskYourDataResult;
}

const DEFAULT_SUGGESTIONS = [
  "Weekly signups by plan since August",
  "Monthly recurring revenue by tier",
  "Trial to paid conversion rate by week",
];

const SERIES_COLORS = [
  "var(--series-1, oklch(56% 0.21 258))",
  "var(--series-2, oklch(62% 0.19 162))",
  "var(--series-3, oklch(72% 0.17 72))",
  "var(--series-4, oklch(60% 0.2 310))",
];

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    keywords: ["signup", "signups", "plan", "august", "weekly"],
    question: "Weekly signups by plan since August",
    sql: `SELECT
  date_trunc('week', created_at)::date AS week,
  plan,
  count(*) AS signups
FROM accounts
WHERE created_at >= '2025-08-03'
  AND status != 'spam'
GROUP BY 1, 2
ORDER BY 1 ASC, 2 ASC;`,
    totalRows: 48,
    result: {
      title: "Weekly signups by plan",
      subtitle: "Aug 3 to Oct 25 · 1,284 signups",
      categoryLabel: "Week",
      categories: [
        "Aug 3",
        "Aug 10",
        "Aug 17",
        "Aug 24",
        "Aug 31",
        "Sep 7",
        "Sep 14",
        "Sep 21",
        "Sep 28",
        "Oct 5",
        "Oct 12",
        "Oct 19",
      ],
      series: [
        { id: "free", label: "Free", values: [60, 61, 59, 62, 48, 58, 60, 59, 58, 60, 58, 58] },
        { id: "pro", label: "Pro", values: [24, 26, 28, 29, 25, 30, 32, 34, 36, 36, 38, 40] },
        { id: "team", label: "Team", values: [8, 10, 11, 12, 10, 13, 14, 16, 17, 17, 18, 19] },
        { id: "enterprise", label: "Enterprise", values: [2, 2, 3, 3, 2, 3, 4, 4, 4, 4, 4, 5] },
      ],
      stacked: true,
      legendValue: "sum",
      chart: "bar",
      rowCount: 48,
      durationMs: 214,
      insight:
        "Pro is up 67% since August, from 24 to 40 a week, and Team more than doubled. Free held flat near 60, with a dip in Labor Day week.",
    },
  },
  {
    keywords: ["mrr", "revenue", "recurring", "tier"],
    question: "Monthly recurring revenue by tier",
    sql: `SELECT
  to_char(month, 'Mon') AS month,
  plan,
  sum(mrr_cents) / 100.0 AS mrr
FROM billing_mrr_monthly
WHERE month >= '2025-05-01'
GROUP BY 1, 2, month
ORDER BY month ASC, 2 ASC;`,
    totalRows: 24,
    result: {
      title: "Monthly recurring revenue by tier",
      subtitle: "May to Oct · $258k current MRR",
      categoryLabel: "Month",
      categories: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
      series: [
        { id: "pro", label: "Pro", values: [42000, 46000, 51000, 56000, 62000, 68000] },
        { id: "team", label: "Team", values: [64000, 70000, 76000, 84000, 92000, 102000] },
        { id: "enterprise", label: "Enterprise", values: [58000, 62000, 68000, 74000, 81000, 88000] },
      ],
      stacked: true,
      legendValue: "last",
      chart: "line",
      formatValue: (v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`),
      rowCount: 24,
      durationMs: 186,
      insight:
        "Total MRR grew from $164k in May to $258k in October, led by Team seats expanding 59% over six months.",
    },
  },
  {
    keywords: ["conversion", "trial", "paid", "rate"],
    question: "Trial to paid conversion rate by week",
    sql: `SELECT
  date_trunc('week', started_at)::date AS week,
  channel,
  round(100.0 * count(*) FILTER (WHERE converted) / count(*), 1) AS rate
FROM trials
WHERE started_at >= '2025-08-31'
GROUP BY 1, 2
ORDER BY 1 ASC, 2 ASC;`,
    totalRows: 16,
    result: {
      title: "Trial to paid conversion rate",
      subtitle: "Aug 31 to Oct 19 · Self-serve vs. sales-assisted",
      categoryLabel: "Week",
      categories: ["Aug 31", "Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5", "Oct 12", "Oct 19"],
      series: [
        { id: "self-serve", label: "Self-serve", values: [3.2, 3.4, 3.5, 3.8, 3.7, 4.0, 4.1, 4.3] },
        { id: "sales", label: "Sales-assisted", values: [14.2, 14.8, 15.1, 15.6, 16.0, 16.4, 16.9, 17.4] },
      ],
      stacked: false,
      legendValue: "last",
      chart: "line",
      formatValue: (v) => `${v.toFixed(1)}%`,
      rowCount: 16,
      durationMs: 142,
      insight:
        "Self-serve conversion climbed from 3.2% to 4.3% after the onboarding checklist shipped, while sales-assisted reached 17.4%.",
    },
  },
];

const SKELETON_HEIGHTS = [42, 68, 56, 78, 62, 86, 74, 92, 66, 82, 72, 95];

const SQL_KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "AS",
  "GROUP",
  "BY",
  "ORDER",
  "ASC",
  "DESC",
  "LIMIT",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "ON",
  "HAVING",
  "DISTINCT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "WITH",
  "IN",
  "IS",
  "NULL",
  "FILTER",
  "UNION",
  "ALL",
]);

const SQL_FUNCTIONS = new Set([
  "date_trunc",
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "round",
  "to_char",
  "coalesce",
  "lower",
  "upper",
]);

type SqlTokenKind = "keyword" | "function" | "string" | "number" | "comment" | "punct" | "plain";

interface SqlToken {
  text: string;
  kind: SqlTokenKind;
}

const SQL_TOKEN_REGEX =
  /(--[^\n]*|'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|::|!=|>=|<=|[(),.;=<>+\-*/]|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+)/g;

function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let match: RegExpExecArray | null;
  SQL_TOKEN_REGEX.lastIndex = 0;
  while ((match = SQL_TOKEN_REGEX.exec(sql)) !== null) {
    const text = match[0];
    let kind: SqlTokenKind = "plain";
    if (text.startsWith("--")) {
      kind = "comment";
    } else if (text.startsWith("'")) {
      kind = "string";
    } else if (/^\d/.test(text)) {
      kind = "number";
    } else if (/^[(),.;=<>+\-*/:!]+$/.test(text)) {
      kind = "punct";
    } else if (SQL_KEYWORDS.has(text.toUpperCase())) {
      kind = "keyword";
    } else if (SQL_FUNCTIONS.has(text.toLowerCase())) {
      kind = "function";
    }
    tokens.push({ text, kind });
  }
  return tokens;
}

function tokenClassName(kind: SqlTokenKind): string | undefined {
  switch (kind) {
    case "keyword":
      return styles.tkKeyword;
    case "function":
      return styles.tkFunction;
    case "string":
      return styles.tkString;
    case "number":
      return styles.tkNumber;
    case "comment":
      return styles.tkComment;
    case "punct":
      return styles.tkPunct;
    default:
      return undefined;
  }
}

function defaultFormatValue(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function matchSamplePreset(question: string): SamplePreset {
  const q = question.toLowerCase();
  for (const preset of SAMPLE_PRESETS) {
    if (preset.keywords.some((kw) => q.includes(kw))) {
      return preset;
    }
  }
  return SAMPLE_PRESETS[0];
}

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value
  );
}

function niceTicks(maxValue: number, count = 4): number[] {
  if (maxValue <= 0) return [0, 1];
  const roughStep = maxValue / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;
  let step: number;
  if (norm <= 1) step = 1 * mag;
  else if (norm <= 2) step = 2 * mag;
  else if (norm <= 2.5) step = 2.5 * mag;
  else if (norm <= 5) step = 5 * mag;
  else step = 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= maxValue + step * 0.99; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
    if (ticks.length >= count + 2) break;
  }
  return ticks;
}

function PostgresMark({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="8" cy="3.6" rx="5.2" ry="2.1" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M2.8 3.6v4.4c0 1.16 2.33 2.1 5.2 2.1s5.2-.94 5.2-2.1V3.6"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M2.8 8v4.2c0 1.16 2.33 2.1 5.2 2.1s5.2-.94 5.2-2.1V8"
        stroke="currentColor"
        strokeWidth="1.35"
      />
    </svg>
  );
}

const CHART_OPTIONS = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "table", label: "Table" },
];

export function AskYourData({
  question: controlledQuestion,
  defaultQuestion = "Weekly signups by plan since August",
  onQuestionChange,
  placeholder = "Ask a question about your data",
  source = { name: "analytics", dialect: "PostgreSQL" },
  suggestions = DEFAULT_SUGGESTIONS,
  generateSql,
  runQuery,
  onResult,
  onError,
  chart: controlledChart,
  defaultChart = "bar",
  onChartChange,
  autoRun,
  keepSqlOpen = false,
  className,
}: AskYourDataProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const sqlPanelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const isQuestionControlled = controlledQuestion !== undefined;
  const [uncontrolledQuestion, setUncontrolledQuestion] = useState(defaultQuestion);
  const question = isQuestionControlled ? controlledQuestion : uncontrolledQuestion;

  const isChartControlled = controlledChart !== undefined;
  const [uncontrolledChart, setUncontrolledChart] = useState<AskYourDataChart>(defaultChart);
  const activeChart = isChartControlled ? controlledChart : uncontrolledChart;

  const [phase, setPhase] = useState<Phase>("idle");
  const [fullSql, setFullSql] = useState("");
  const [visibleTokenCount, setVisibleTokenCount] = useState(0);
  const [streamingAsync, setStreamingAsync] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const userToggledSqlRef = useRef(false);

  const [rowsScanned, setRowsScanned] = useState(0);
  const [totalRowsHint, setTotalRowsHint] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<AskYourDataResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [insightVisibleWords, setInsightVisibleWords] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [plotSize, setPlotSize] = useState({ width: 640, height: 210 });
  const [isOffscreen, setIsOffscreen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const autoRanRef = useRef(false);
  const simulated = !generateSql && !runQuery;
  const effectiveAutoRun = autoRun ?? !generateSql;

  const setQuestionValue = useCallback(
    (next: string) => {
      if (!isQuestionControlled) setUncontrolledQuestion(next);
      onQuestionChange?.(next);
    },
    [isQuestionControlled, onQuestionChange],
  );

  const setChartValue = useCallback(
    (next: AskYourDataChart) => {
      if (!isChartControlled) setUncontrolledChart(next);
      onChartChange?.(next);
      setActiveIndex(null);
    },
    [isChartControlled, onChartChange],
  );

  const tokens = useMemo(() => tokenizeSql(fullSql), [fullSql]);
  const sqlLinesCount = useMemo(() => (fullSql ? fullSql.split("\n").length : 0), [fullSql]);
  const visibleSqlText = useMemo(() => {
    if (streamingAsync || reducedMotion || visibleTokenCount >= tokens.length) return fullSql;
    return tokens
      .slice(0, visibleTokenCount)
      .map((t) => t.text)
      .join("");
  }, [fullSql, reducedMotion, streamingAsync, tokens, visibleTokenCount]);

  const visibleLineCount = useMemo(() => {
    if (!visibleSqlText) return 0;
    return visibleSqlText.split("\n").length;
  }, [visibleSqlText]);

  const insightWords = useMemo(() => {
    if (!result?.insight) return [];
    return result.insight.split(/\s+/).filter(Boolean);
  }, [result]);

  const stopRun = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (phase === "writing" || phase === "running") {
      setPhase("stopped");
      setLiveMessage("Query stopped.");
    }
  }, [phase]);

  const runQuestion = useCallback(
    async (rawQuestion: string) => {
      const q = rawQuestion.trim();
      if (!q) return;

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setErrorMsg(null);
      setResult(null);
      setActiveIndex(null);
      setRowsScanned(0);
      setTotalRowsHint(undefined);
      setInsightVisibleWords(0);
      setFullSql("");
      setVisibleTokenCount(0);
      setStreamingAsync(false);
      setPhase("writing");
      if (!userToggledSqlRef.current) {
        setSqlOpen(true);
      }
      setLiveMessage(`Writing ${source.dialect ?? "PostgreSQL"} SQL for "${q}".`);

      const preset = matchSamplePreset(q);
      let generatedSql = "";

      try {
        if (generateSql) {
          const sqlOut = await generateSql(q, { signal, source });
          if (signal.aborted) return;

          if (isAsyncIterable(sqlOut)) {
            setStreamingAsync(true);
            let acc = "";
            for await (const chunk of sqlOut) {
              if (signal.aborted) return;
              acc += chunk;
              setFullSql(acc);
              setVisibleTokenCount(tokenizeSql(acc).length);
            }
            generatedSql = acc;
          } else {
            generatedSql = sqlOut;
            const toks = tokenizeSql(generatedSql);
            setFullSql(generatedSql);
            if (reducedMotion) {
              setVisibleTokenCount(toks.length);
            } else {
              for (let i = 4; i <= toks.length + 4; i += 4) {
                if (signal.aborted) return;
                setVisibleTokenCount(Math.min(i, toks.length));
                await new Promise<void>((res) => window.setTimeout(res, 34));
              }
            }
          }
        } else {
          generatedSql = preset.sql;
          const toks = tokenizeSql(generatedSql);
          setFullSql(generatedSql);
          if (reducedMotion) {
            setVisibleTokenCount(toks.length);
          } else {
            for (let i = 4; i <= toks.length + 4; i += 4) {
              if (signal.aborted) return;
              setVisibleTokenCount(Math.min(i, toks.length));
              await new Promise<void>((res) => window.setTimeout(res, 34));
            }
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to generate SQL.";
        setErrorMsg(msg);
        setPhase("error");
        setLiveMessage(`SQL generation failed: ${msg}`);
        onError?.(err, { question: q, stage: "sql" });
        return;
      }

      if (signal.aborted) return;

      setPhase("running");
      if (!userToggledSqlRef.current && !keepSqlOpen) {
        setSqlOpen(false);
      }
      setLiveMessage(`Running query against ${source.name}.`);

      try {
        let queryResult: AskYourDataResult;
        if (runQuery) {
          queryResult = await runQuery(generatedSql, {
            signal,
            question: q,
            onProgress: (scanned, total) => {
              if (signal.aborted) return;
              setRowsScanned(scanned);
              if (total !== undefined) setTotalRowsHint(total);
            },
          });
        } else {
          const total = preset.totalRows;
          setTotalRowsHint(total);
          const steps = reducedMotion ? 1 : 8;
          for (let s = 1; s <= steps; s++) {
            if (signal.aborted) return;
            setRowsScanned(Math.round((total * s) / steps));
            await new Promise<void>((res) =>
              window.setTimeout(res, reducedMotion ? 40 : 65),
            );
          }
          queryResult = preset.result;
        }

        if (signal.aborted) return;

        setResult(queryResult);
        if (queryResult.chart && !isChartControlled) {
          setUncontrolledChart(queryResult.chart);
        }
        setPhase("result");
        onResult?.(queryResult, { question: q, sql: generatedSql });

        const summaryParts = [
          queryResult.title,
          queryResult.rowCount !== undefined ? `${queryResult.rowCount} rows` : null,
          queryResult.durationMs !== undefined ? formatDuration(queryResult.durationMs) : null,
        ].filter(Boolean);
        const simNote = simulated
          ? " Simulated with sample data, nothing was queried."
          : "";
        setLiveMessage(
          `${summaryParts.join(", ")}.${queryResult.insight ? ` ${queryResult.insight}` : ""}${simNote}`,
        );

        if (queryResult.insight) {
          const words = queryResult.insight.split(/\s+/).filter(Boolean);
          if (reducedMotion) {
            setInsightVisibleWords(words.length);
          } else {
            for (let i = 4; i <= words.length + 4; i += 4) {
              if (signal.aborted) return;
              setInsightVisibleWords(Math.min(i, words.length));
              await new Promise<void>((res) => window.setTimeout(res, 55));
            }
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Query execution failed.";
        setErrorMsg(msg);
        setPhase("error");
        setLiveMessage(`Query failed: ${msg}`);
        onError?.(err, { question: q, stage: "query" });
      }
    },
    [
      generateSql,
      isChartControlled,
      keepSqlOpen,
      onError,
      onResult,
      reducedMotion,
      runQuery,
      simulated,
      source,
    ],
  );

  // IntersectionObserver for autoRun (35% visible) and offscreen animation pause
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsOffscreen(!entry.isIntersecting);
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.35 &&
          effectiveAutoRun &&
          !autoRanRef.current &&
          question.trim().length > 0
        ) {
          autoRanRef.current = true;
          void runQuestion(question);
        }
      },
      { threshold: [0, 0.35] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [effectiveAutoRun, question, runQuestion]);

  // Measure plot container via ResizeObserver
  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPlotSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase, activeChart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isBusy = phase === "writing" || phase === "running";
  const hasSql = fullSql.length > 0;
  const sqlSettled = phase !== "writing" && hasSql;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isBusy) {
      stopRun();
    } else if (question.trim()) {
      void runQuestion(question);
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && isBusy) {
      e.preventDefault();
      stopRun();
    }
  };

  const handleToggleSql = () => {
    if (!hasSql) return;
    userToggledSqlRef.current = true;
    setSqlOpen((prev) => !prev);
  };

  const handleSuggestionClick = (text: string) => {
    setQuestionValue(text);
    void runQuestion(text);
  };

  // SQL meta text
  const dialect = source.dialect ?? "PostgreSQL";
  const sqlMetaFull = useMemo(() => {
    if (phase === "writing") return `${dialect} · Writing…`;
    if (phase === "running") return `${dialect} · Running…`;
    if (phase === "result" && result) {
      const parts = [dialect];
      if (result.rowCount !== undefined) parts.push(`${result.rowCount} rows`);
      if (result.durationMs !== undefined) parts.push(formatDuration(result.durationMs));
      return parts.join(" · ");
    }
    if (phase === "error") return `${dialect} · Error`;
    if (phase === "stopped") return `${dialect} · Stopped`;
    return dialect;
  }, [dialect, phase, result]);

  const sqlMetaShort = useMemo(() => {
    if (phase === "result" && result?.rowCount !== undefined) {
      return `${result.rowCount} rows`;
    }
    if (phase === "writing") return "Writing…";
    if (phase === "running") return "Running…";
    return dialect;
  }, [dialect, phase, result]);

  // Chart geometry
  const stacked = result?.stacked ?? true;
  const legendValueMode = result?.legendValue ?? (stacked ? "sum" : "none");
  const formatVal = result?.formatValue ?? defaultFormatValue;

  const padLeft = 44;
  const padRight = 12;
  const padTop = 10;
  const padBottom = 24;
  const chartW = Math.max(120, plotSize.width - padLeft - padRight);
  const chartH = Math.max(80, plotSize.height - padTop - padBottom);

  const chartData = useMemo(() => {
    if (!result || result.categories.length === 0) return null;
    const catCount = result.categories.length;
    const totals = result.categories.map((_, ci) =>
      result.series.reduce((acc, s) => acc + (s.values[ci] ?? 0), 0),
    );
    const maxVal = stacked
      ? Math.max(...totals, 1)
      : Math.max(...result.series.flatMap((s) => s.values), 1);
    const ticks = niceTicks(maxVal, 4);
    const yMax = ticks[ticks.length - 1] || 1;
    const stepX = chartW / catCount;
    const labelStride = Math.max(1, Math.ceil(46 / Math.max(1, stepX)));
    return { catCount, totals, ticks, yMax, stepX, labelStride };
  }, [chartW, result, stacked]);

  const handlePlotPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!chartData || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padLeft;
    const idx = Math.floor(x / chartData.stepX);
    if (idx >= 0 && idx < chartData.catCount) {
      setActiveIndex(idx);
    } else {
      setActiveIndex(null);
    }
  };

  const handlePlotKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!result || result.categories.length === 0) return;
    const last = result.categories.length - 1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveIndex((prev) => (prev === null ? 0 : Math.min(last, prev + 1)));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveIndex((prev) => (prev === null ? last : Math.max(0, prev - 1)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(last);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveIndex(null);
    }
  };

  const readoutText = useMemo(() => {
    if (activeIndex === null || !result) return "";
    const cat = result.categories[activeIndex];
    const parts = result.series.map(
      (s) => `${s.label} ${formatVal(s.values[activeIndex] ?? 0)}`,
    );
    if (stacked) {
      const total = result.series.reduce((sum, s) => sum + (s.values[activeIndex] ?? 0), 0);
      parts.push(`total ${formatVal(total)}`);
    }
    return `${cat}: ${parts.join(", ")}`;
  }, [activeIndex, formatVal, result, stacked]);

  const statusGlyphKind =
    phase === "writing" || phase === "running"
      ? "spinner"
      : phase === "result"
        ? "check"
        : phase === "error"
          ? "alert"
          : "idle";

  const tooltipTransform = useMemo(() => {
    if (activeIndex === null || !chartData) return undefined;
    const colCenterX = padLeft + (activeIndex + 0.5) * chartData.stepX;
    const tooltipW = 176;
    const flipLeft = colCenterX + tooltipW + 16 > plotSize.width;
    const tx = flipLeft
      ? Math.max(8, colCenterX - tooltipW - 12)
      : Math.min(plotSize.width - tooltipW - 8, colCenterX + 12);
    return `translate3d(${Math.round(tx)}px, 8px, 0)`;
  }, [activeIndex, chartData, plotSize.width]);

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-offscreen={isOffscreen ? "" : undefined}
      aria-label="Ask your data"
    >
      <form className={styles.ask} onSubmit={handleSubmit}>
        <div
          className={styles.field}
          onClick={() => inputRef.current?.focus()}
        >
          <span className={styles.source}>
            {source.mark ?? <Database size={14} strokeWidth={1.75} aria-hidden="true" />}
            <span className={styles.sourceName}>{source.name}</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={question}
            onChange={(e) => setQuestionValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            aria-label="Ask a question about your data"
          />
          <button
            type="submit"
            className={styles.send}
            disabled={!isBusy && !question.trim()}
            aria-label={isBusy ? "Stop" : "Ask"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isBusy ? (
                <motion.span
                  key="stop"
                  className={styles.sendIcon}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12 }}
                >
                  <span className={styles.stopIcon} aria-hidden="true" />
                </motion.span>
              ) : (
                <motion.span
                  key="ask"
                  className={styles.sendIcon}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12 }}
                >
                  <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </form>

      {/* Collapsible Generated SQL section */}
      <div
        className={styles.sql}
        data-open={sqlOpen ? "" : undefined}
        data-empty={!hasSql ? "" : undefined}
      >
        <div className={styles.sqlHead}>
          <button
            type="button"
            className={styles.sqlToggle}
            aria-expanded={sqlOpen}
            aria-controls={sqlPanelId}
            aria-label={`Generated SQL, ${sqlMetaFull}`}
            disabled={!hasSql}
            onClick={handleToggleSql}
          />
          <PostgresMark className={styles.pgMark} />
          <span className={styles.sqlTitle}>
            <span className={styles.sqlTitleText}>Generated SQL</span>
          </span>
          <span className={styles.sqlMeta}>
            <span className={styles.swap}>
              <span className={styles.swapItem}>
                <span className={styles.metaFull}>{sqlMetaFull}</span>
                <span className={styles.metaShort}>{sqlMetaShort}</span>
              </span>
            </span>
          </span>
          <span className={styles.glyph} aria-hidden="true">
            {statusGlyphKind === "spinner" && (
              <span className={styles.glyphItem} data-kind="spinner">
                <Loader2 size={14} className={styles.spinner} />
              </span>
            )}
            {statusGlyphKind === "check" && (
              <span className={styles.glyphItem} data-kind="check">
                <Check size={14} strokeWidth={2.2} />
              </span>
            )}
            {statusGlyphKind === "alert" && (
              <span className={styles.glyphItem} data-kind="alert">
                <AlertCircle size={14} strokeWidth={2} />
              </span>
            )}
          </span>
          <span className={styles.sqlCopy}>
            <CopyButton
              value={fullSql}
              label="Copy SQL"
              iconOnly
              variant="plain"
              disabled={!hasSql}
            />
          </span>
          <ChevronDown
            size={15}
            strokeWidth={1.8}
            className={styles.chevron}
            aria-hidden="true"
          />
        </div>

        <AnimatePresence initial={false}>
          {sqlOpen && hasSql && (
            <motion.div
              id={sqlPanelId}
              className={styles.sqlClip}
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: "spring", visualDuration: 0.3, bounce: 0 }
              }
            >
              <div className={styles.sqlBody}>
                <div
                  className={styles.code}
                  data-settled={sqlSettled ? "" : undefined}
                >
                  <div className={styles.gutter} aria-hidden="true">
                    {Array.from({ length: sqlLinesCount }, (_, idx) => (
                      <span
                        key={idx}
                        data-on={idx < visibleLineCount ? "" : undefined}
                      >
                        {idx + 1}
                      </span>
                    ))}
                  </div>
                  <pre className={styles.pre} tabIndex={0}>
                    <code>
                      {tokens.map((tok, i) => {
                        const isVisible =
                          streamingAsync || reducedMotion || i < visibleTokenCount;
                        if (!isVisible) {
                          return (
                            <span
                              key={i}
                              className={styles.ghost}
                              aria-hidden="true"
                            >
                              {tok.text}
                            </span>
                          );
                        }
                        const cls = tokenClassName(tok.kind);
                        return (
                          <span
                            key={i}
                            className={[styles.tk, cls].filter(Boolean).join(" ")}
                          >
                            {tok.text}
                          </span>
                        );
                      })}
                    </code>
                  </pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stage section */}
      <div className={styles.stage} aria-busy={isBusy}>
        <div className={styles.stageHead}>
          <div className={styles.headText}>
            <div className={styles.swap}>
              <AnimatePresence mode="wait" initial={false}>
                {phase === "result" && result ? (
                  <motion.div
                    key={`res-${result.title}`}
                    className={styles.swapItem}
                    initial={reducedMotion ? false : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                  >
                    <span className={styles.headCopy}>
                      <span className={styles.headTitle}>
                        <span className={styles.headTitleText}>{result.title}</span>
                      </span>
                      {result.subtitle && (
                        <span className={styles.headSub}>{result.subtitle}</span>
                      )}
                    </span>
                  </motion.div>
                ) : phase === "writing" ? (
                  <motion.div
                    key="writing"
                    className={styles.swapItem}
                    initial={reducedMotion ? false : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                  >
                    <div className={styles.headLine}>
                      <span className={styles.glyph} aria-hidden="true">
                        <span className={styles.glyphItem}>
                          <Loader2 size={14} className={styles.spinner} />
                        </span>
                      </span>
                      <span className={styles.headCopy}>
                        <span className={styles.headTitle}>
                          <span className={styles.headTitleText}>Writing SQL…</span>
                        </span>
                        <span className={styles.headSub}>
                          Translating question for {source.name}
                        </span>
                      </span>
                    </div>
                  </motion.div>
                ) : phase === "running" ? (
                  <motion.div
                    key="running"
                    className={styles.swapItem}
                    initial={reducedMotion ? false : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                  >
                    <div className={styles.headLine}>
                      <span className={styles.glyph} aria-hidden="true">
                        <span className={styles.glyphItem}>
                          <Loader2 size={14} className={styles.spinner} />
                        </span>
                      </span>
                      <span className={styles.headCopy}>
                        <span className={styles.headTitle}>
                          <span className={styles.headTitleText}>Running query</span>
                          <span className={styles.headCount}>
                            <span
                              className={styles.count}
                              style={{
                                minWidth: `${String(totalRowsHint ?? rowsScanned).length}ch`,
                              }}
                            >
                              {rowsScanned}
                            </span>
                            <span>rows</span>
                          </span>
                        </span>
                        <span className={styles.headSub}>
                          Scanning {source.name} ({dialect})
                        </span>
                      </span>
                    </div>
                  </motion.div>
                ) : phase === "error" ? (
                  <motion.div
                    key="error"
                    className={styles.swapItem}
                    initial={reducedMotion ? false : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                  >
                    <div className={styles.headLine}>
                      <span className={styles.glyph} aria-hidden="true">
                        <span className={styles.glyphItem} data-kind="alert">
                          <AlertCircle size={14} strokeWidth={2} />
                        </span>
                      </span>
                      <span className={styles.headCopy}>
                        <span className={styles.headTitle}>
                          <span className={styles.headTitleText}>Query error</span>
                        </span>
                        <span className={styles.headSub}>
                          {source.name} returned an error
                        </span>
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    className={styles.swapItem}
                    initial={reducedMotion ? false : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                  >
                    <span className={styles.headCopy}>
                      <span className={styles.headTitle}>
                        <span className={styles.headTitleText}>
                          {phase === "stopped" ? "Query stopped" : `Ask ${source.name}`}
                        </span>
                      </span>
                      <span className={styles.headSub}>
                        {phase === "stopped"
                          ? "Edit your question or pick a suggestion below"
                          : "Ask in plain English to generate SQL and chart the answer"}
                      </span>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {phase === "result" && result && (
            <div className={styles.views}>
              <SegmentedControl
                options={CHART_OPTIONS}
                value={activeChart}
                onValueChange={(v) => setChartValue(v as AskYourDataChart)}
                label="Chart view"
              />
            </div>
          )}
        </div>

        <div className={styles.stageBody}>
          <AnimatePresence mode="wait" initial={false}>
            {(phase === "writing" || phase === "running") && (
              <motion.div
                key="skeleton"
                className={styles.stageLayer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <div
                  className={styles.skeleton}
                  data-running={phase === "running" ? "" : undefined}
                >
                  <div className={styles.skeletonLegend}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.skeletonPlot}>
                    {SKELETON_HEIGHTS.map((h, i) => (
                      <span
                        key={i}
                        style={{
                          height: `${h}%`,
                          animationDelay: `${i * 70}ms`,
                        }}
                      />
                    ))}
                  </div>
                  <div className={styles.skeletonInsight} />
                </div>
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div
                key="error-body"
                className={styles.stageLayer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <div className={styles.message}>
                  <pre className={styles.errorDetail}>{errorMsg}</pre>
                  <div className={styles.messageActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void runQuestion(question)}
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {(phase === "idle" || phase === "stopped") && (
              <motion.div
                key="idle-body"
                className={styles.stageLayer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <div className={styles.message}>
                  <p className={styles.messageText}>
                    Try one of these questions against {source.name}:
                  </p>
                  {suggestions.length > 0 && (
                    <ul className={styles.suggestions}>
                      {suggestions.map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            className={styles.suggestion}
                            onClick={() => handleSuggestionClick(s)}
                          >
                            <CornerDownRight
                              size={14}
                              className={styles.suggestionIcon}
                              aria-hidden="true"
                            />
                            <span className={styles.suggestionText}>{s}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}

            {phase === "result" && result && (
              <motion.div
                key="result-body"
                className={styles.stageLayer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <div className={styles.result}>
                  <div className={styles.viewsInline}>
                    <SegmentedControl
                      options={CHART_OPTIONS}
                      value={activeChart}
                      onValueChange={(v) => setChartValue(v as AskYourDataChart)}
                      label="Chart view"
                      fullWidth
                    />
                  </div>

                  {/* Legend */}
                  <ul className={styles.legend}>
                    {result.series.map((s, si) => {
                      const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
                      const val =
                        legendValueMode === "sum"
                          ? s.values.reduce((a, b) => a + b, 0)
                          : legendValueMode === "last"
                            ? (s.values[s.values.length - 1] ?? 0)
                            : null;
                      return (
                        <li key={s.id} className={styles.legendItem}>
                          <span
                            className={styles.dot}
                            style={{ background: color }}
                            aria-hidden="true"
                          />
                          <span>{s.label}</span>
                          {val !== null && (
                            <span className={styles.legendValue}>
                              {formatVal(val)}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Chart / Table area */}
                  <div className={styles.chartArea}>
                    <AnimatePresence mode="wait" initial={false}>
                      {activeChart === "table" ? (
                        <motion.div
                          key="table"
                          className={styles.chartLayer}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.14 }}
                        >
                          <div className={styles.tableWrap} tabIndex={0}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th scope="col">
                                    {result.categoryLabel ?? "Category"}
                                  </th>
                                  {result.series.map((s, si) => (
                                    <th key={s.id} scope="col" className={styles.num}>
                                      <span className={styles.thInner}>
                                        <span
                                          className={styles.dot}
                                          style={{
                                            background:
                                              s.color ??
                                              SERIES_COLORS[si % SERIES_COLORS.length],
                                          }}
                                          aria-hidden="true"
                                        />
                                        <span>{s.label}</span>
                                      </span>
                                    </th>
                                  ))}
                                  {stacked && (
                                    <th scope="col" className={styles.num}>
                                      Total
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {result.categories.map((cat, ci) => {
                                  const rowTotal = result.series.reduce(
                                    (acc, s) => acc + (s.values[ci] ?? 0),
                                    0,
                                  );
                                  return (
                                    <tr key={cat}>
                                      <th scope="row">{cat}</th>
                                      {result.series.map((s) => (
                                        <td key={s.id} className={styles.num}>
                                          {formatVal(s.values[ci] ?? 0)}
                                        </td>
                                      ))}
                                      {stacked && (
                                        <td className={styles.num}>
                                          {formatVal(rowTotal)}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={activeChart}
                          className={styles.chartLayer}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.14 }}
                        >
                          <div
                            ref={plotRef}
                            className={styles.plot}
                            role="group"
                            tabIndex={0}
                            aria-label={`${result.title} ${activeChart} chart. Use left and right arrow keys to inspect values.`}
                            onPointerMove={handlePlotPointer}
                            onPointerDown={handlePlotPointer}
                            onPointerLeave={() => setActiveIndex(null)}
                            onKeyDown={handlePlotKeyDown}
                          >
                            {chartData && (
                              <svg
                                className={styles.svg}
                                width={plotSize.width}
                                height={plotSize.height}
                                viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
                                aria-hidden="true"
                              >
                                {/* Gridlines & Y labels */}
                                {chartData.ticks.map((tick) => {
                                  const y =
                                    padTop +
                                    chartH -
                                    (tick / chartData.yMax) * chartH;
                                  return (
                                    <g key={tick}>
                                      <line
                                        x1={padLeft}
                                        x2={padLeft + chartW}
                                        y1={y}
                                        y2={y}
                                        className={
                                          tick === 0 ? styles.baseline : styles.grid
                                        }
                                      />
                                      <text
                                        x={padLeft - 8}
                                        y={y + 4}
                                        textAnchor="end"
                                        className={styles.axisText}
                                      >
                                        {formatVal(tick)}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Hover band */}
                                {activeIndex !== null && (
                                  <rect
                                    x={padLeft + activeIndex * chartData.stepX}
                                    y={padTop}
                                    width={chartData.stepX}
                                    height={chartH}
                                    rx={6}
                                    className={styles.hoverBand}
                                  />
                                )}

                                {/* Bars */}
                                {activeChart === "bar" &&
                                  result.categories.map((cat, ci) => {
                                    const colX = padLeft + ci * chartData.stepX;
                                    const barW = Math.max(
                                      6,
                                      Math.min(28, chartData.stepX * 0.56),
                                    );
                                    const barX = colX + (chartData.stepX - barW) / 2;
                                    const delay = reducedMotion
                                      ? 0
                                      : (ci / Math.max(1, chartData.catCount - 1)) * 0.18;
                                    const isDim =
                                      activeIndex !== null && activeIndex !== ci;

                                    if (stacked) {
                                      let accY = padTop + chartH;
                                      return (
                                        <g
                                          key={cat}
                                          className={styles.column}
                                          data-dim={isDim ? "" : undefined}
                                        >
                                          {result.series.map((s, si) => {
                                            const v = s.values[ci] ?? 0;
                                            const h = (v / chartData.yMax) * chartH;
                                            const y = accY - h;
                                            accY = y;
                                            const color =
                                              s.color ??
                                              SERIES_COLORS[si % SERIES_COLORS.length];
                                            const isTop = si === result.series.length - 1;
                                            return (
                                              <motion.rect
                                                key={s.id}
                                                x={barX}
                                                y={y}
                                                width={barW}
                                                height={Math.max(0, h)}
                                                rx={isTop ? 3 : 0}
                                                fill={color}
                                                style={{
                                                  transformOrigin: `${barX + barW / 2}px ${padTop + chartH}px`,
                                                }}
                                                initial={
                                                  reducedMotion ? false : { scaleY: 0 }
                                                }
                                                animate={{ scaleY: 1 }}
                                                transition={
                                                  reducedMotion
                                                    ? { duration: 0 }
                                                    : {
                                                        duration: 0.32,
                                                        delay,
                                                        ease: [0.22, 1, 0.36, 1],
                                                      }
                                                }
                                              />
                                            );
                                          })}
                                        </g>
                                      );
                                    }

                                    // Grouped bars
                                    const subGap = 2;
                                    const subW = Math.max(
                                      4,
                                      (barW - subGap * (result.series.length - 1)) /
                                        result.series.length,
                                    );
                                    return (
                                      <g
                                        key={cat}
                                        className={styles.column}
                                        data-dim={isDim ? "" : undefined}
                                      >
                                        {result.series.map((s, si) => {
                                          const v = s.values[ci] ?? 0;
                                          const h = (v / chartData.yMax) * chartH;
                                          const x = barX + si * (subW + subGap);
                                          const y = padTop + chartH - h;
                                          const color =
                                            s.color ??
                                            SERIES_COLORS[si % SERIES_COLORS.length];
                                          return (
                                            <motion.rect
                                              key={s.id}
                                              x={x}
                                              y={y}
                                              width={subW}
                                              height={Math.max(0, h)}
                                              rx={2.5}
                                              fill={color}
                                              style={{
                                                transformOrigin: `${x + subW / 2}px ${padTop + chartH}px`,
                                              }}
                                              initial={
                                                reducedMotion ? false : { scaleY: 0 }
                                              }
                                              animate={{ scaleY: 1 }}
                                              transition={
                                                reducedMotion
                                                  ? { duration: 0 }
                                                  : {
                                                      duration: 0.32,
                                                      delay,
                                                      ease: [0.22, 1, 0.36, 1],
                                                    }
                                              }
                                            />
                                          );
                                        })}
                                      </g>
                                    );
                                  })}

                                {/* Lines */}
                                {activeChart === "line" &&
                                  result.series.map((s, si) => {
                                    const color =
                                      s.color ??
                                      SERIES_COLORS[si % SERIES_COLORS.length];
                                    const pts = s.values.map((v, ci) => {
                                      const x =
                                        padLeft + (ci + 0.5) * chartData.stepX;
                                      const y =
                                        padTop +
                                        chartH -
                                        (v / chartData.yMax) * chartH;
                                      return { x, y };
                                    });
                                    const d = pts
                                      .map(
                                        (p, idx) =>
                                          `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
                                      )
                                      .join(" ");
                                    return (
                                      <g key={s.id}>
                                        <motion.path
                                          d={d}
                                          fill="none"
                                          stroke={color}
                                          strokeWidth={2}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          initial={
                                            reducedMotion
                                              ? false
                                              : { pathLength: 0, opacity: 0.4 }
                                          }
                                          animate={{ pathLength: 1, opacity: 1 }}
                                          transition={
                                            reducedMotion
                                              ? { duration: 0 }
                                              : {
                                                  duration: 0.46,
                                                  ease: [0.22, 1, 0.36, 1],
                                                }
                                          }
                                        />
                                        {activeIndex !== null && pts[activeIndex] && (
                                          <circle
                                            cx={pts[activeIndex].x}
                                            cy={pts[activeIndex].y}
                                            r={4}
                                            fill="var(--surface)"
                                            stroke={color}
                                            strokeWidth={2}
                                          />
                                        )}
                                      </g>
                                    );
                                  })}

                                {/* X axis labels */}
                                {result.categories.map((cat, ci) => {
                                  if (ci % chartData.labelStride !== 0) return null;
                                  const x =
                                    padLeft + (ci + 0.5) * chartData.stepX;
                                  return (
                                    <text
                                      key={cat}
                                      x={x}
                                      y={padTop + chartH + 17}
                                      textAnchor="middle"
                                      className={styles.axisLabel}
                                    >
                                      {cat}
                                    </text>
                                  );
                                })}
                              </svg>
                            )}

                            {/* Tooltip */}
                            {activeIndex !== null && chartData && (
                              <div
                                className={styles.tooltip}
                                style={{ transform: tooltipTransform }}
                              >
                                <div className={styles.tipHead}>
                                  {result.categories[activeIndex]}
                                </div>
                                {result.series.map((s, si) => (
                                  <div key={s.id} className={styles.tipRow}>
                                    <span
                                      className={styles.dot}
                                      style={{
                                        background:
                                          s.color ??
                                          SERIES_COLORS[si % SERIES_COLORS.length],
                                      }}
                                    />
                                    <span className={styles.tipLabel}>{s.label}</span>
                                    <span className={styles.tipValue}>
                                      {formatVal(s.values[activeIndex] ?? 0)}
                                    </span>
                                  </div>
                                ))}
                                {stacked && (
                                  <div
                                    className={`${styles.tipRow} ${styles.tipTotal}`}
                                  >
                                    <span className={styles.tipLabel}>Total</span>
                                    <span className={styles.tipValue}>
                                      {formatVal(chartData.totals[activeIndex] ?? 0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Insight */}
                  {result.insight ? (
                    <p className={styles.insight}>
                      <Sparkles
                        size={14}
                        strokeWidth={1.8}
                        className={styles.insightIcon}
                        aria-hidden="true"
                      />
                      <span className={styles.insightText}>
                        {insightWords.map((word, idx) => {
                          const visible =
                            reducedMotion || idx < insightVisibleWords;
                          return (
                            <span
                              key={idx}
                              className={visible ? styles.tk : styles.ghost}
                              aria-hidden={visible ? undefined : true}
                            >
                              {word}
                              {idx < insightWords.length - 1 ? " " : ""}
                            </span>
                          );
                        })}
                      </span>
                    </p>
                  ) : (
                    <div className={styles.insightSpacer} aria-hidden="true" />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Live region for status & chart keyboard readout */}
      <div className={styles.srOnly} role="status" aria-live="polite">
        {readoutText || liveMessage}
      </div>
    </section>
  );
}

export default AskYourData;
