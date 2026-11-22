"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ExternalLink,
  Pencil,
  Play,
  RotateCw,
  Sparkles,
  Square,
} from "lucide-react";
import styles from "./enrich-column.module.css";

export interface EnrichColumnRow {
  id: string;
  name: string;
  domain?: string;
  logo?: ReactNode;
}

export interface EnrichColumnDefinition {
  name: string;
  prompt: string;
}

export interface EnrichColumnCell {
  status: "queued" | "running" | "done" | "failed";
  value?: string;
  source?: { label: string; href: string };
  error?: string;
}

export interface EnrichColumnProps {
  title?: string;
  rows?: EnrichColumnRow[];
  defaultColumn?: EnrichColumnDefinition;
  onColumnChange?: (column: EnrichColumnDefinition) => void;
  enrich?: (
    row: EnrichColumnRow,
    context: {
      prompt: string;
      column: EnrichColumnDefinition;
      signal: AbortSignal;
      attempt: number;
      setActivity: (text: string) => void;
    }
  ) => Promise<{ value: string; source?: { label: string; href: string } }>;
  initialCells?: Record<string, EnrichColumnCell>;
  concurrency?: number;
  autoRun?: boolean;
  model?: { name: string; detail?: string; mark?: ReactNode } | null;
  editable?: boolean;
  note?: string;
  onCellChange?: (row: EnrichColumnRow, cell: EnrichColumnCell) => void;
  onRunComplete?: (cells: Record<string, EnrichColumnCell>) => void;
  className?: string;
}

const DEFAULT_ROWS: EnrichColumnRow[] = [
  { id: "linear", name: "Linear", domain: "linear.app" },
  { id: "vercel", name: "Vercel", domain: "vercel.com" },
  { id: "notion", name: "Notion", domain: "notion.com" },
  { id: "figma", name: "Figma", domain: "figma.com" },
  { id: "stripe", name: "Stripe", domain: "stripe.com" },
  { id: "ramp", name: "Ramp", domain: "ramp.com" },
  { id: "retool", name: "Retool", domain: "retool.com" },
];

const DEFAULT_COLUMN: EnrichColumnDefinition = {
  name: "Headcount and funding",
  prompt: "Find the headcount and latest funding round",
};

const SAMPLE_RESULTS: Record<
  string,
  {
    value: string;
    source: { label: string; href: string };
    failFirst?: boolean;
  }
> = {
  linear: {
    value: "~85 employees · $52M Series B",
    source: { label: "linear.app", href: "https://linear.app" },
  },
  vercel: {
    value: "~580 employees · $250M Series E",
    source: { label: "vercel.com", href: "https://vercel.com" },
  },
  notion: {
    value: "~800 employees · $275M Series C",
    source: { label: "notion.com", href: "https://notion.com" },
  },
  figma: {
    value: "~1,400 employees · $200M Series E",
    source: { label: "figma.com", href: "https://figma.com" },
    failFirst: true,
  },
  stripe: {
    value: "~8,000 employees · $6.5B Series I",
    source: { label: "stripe.com", href: "https://stripe.com" },
  },
  ramp: {
    value: "~1,000 employees · $150M Series D-2",
    source: { label: "ramp.com", href: "https://ramp.com" },
  },
  retool: {
    value: "~420 employees · $45M Series C-2",
    source: { label: "retool.com", href: "https://retool.com" },
  },
};

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function simulateEnrich(
  row: EnrichColumnRow,
  context: {
    prompt: string;
    column: EnrichColumnDefinition;
    signal: AbortSignal;
    attempt: number;
    setActivity: (text: string) => void;
  }
): Promise<{ value: string; source?: { label: string; href: string } }> {
  context.setActivity(`Searching ${row.domain ?? row.name}…`);
  await sleepAbortable(650 + (row.name.length % 4) * 140, context.signal);

  context.setActivity("Reading filings and news…");
  await sleepAbortable(600 + (row.id.length % 3) * 180, context.signal);

  const sample = SAMPLE_RESULTS[row.id];
  if (sample?.failFirst && context.attempt === 1) {
    throw new Error("Rate limit hit while fetching source");
  }

  if (sample) {
    return { value: sample.value, source: sample.source };
  }

  return {
    value: `${row.name} · verified`,
    source: row.domain
      ? { label: row.domain, href: `https://${row.domain}` }
      : undefined,
  };
}

export function EnrichColumn({
  title = "Target accounts",
  rows = DEFAULT_ROWS,
  defaultColumn = DEFAULT_COLUMN,
  onColumnChange,
  enrich,
  initialCells,
  concurrency = 2,
  autoRun = false,
  model = { name: "Claude Haiku 5.5", detail: "web search" },
  editable = true,
  note,
  onCellChange,
  onRunComplete,
  className,
}: EnrichColumnProps) {
  const reducedMotion = useReducedMotion();
  const isSimulated = !enrich;
  const effectiveNote = note ?? (isSimulated ? "sample data" : undefined);

  const [column, setColumn] = useState<EnrichColumnDefinition>(defaultColumn);
  const [cells, setCells] = useState<Record<string, EnrichColumnCell>>(
    () => initialCells ?? {}
  );
  const [activities, setActivities] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(column.name);
  const [draftPrompt, setDraftPrompt] = useState(column.prompt);
  const [announcement, setAnnouncement] = useState("");

  const editBtnRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const attemptsRef = useRef<Record<string, number>>({});
  const cellsRef = useRef(cells);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const updateCell = useCallback(
    (row: EnrichColumnRow, cell: EnrichColumnCell) => {
      setCells((prev) => {
        const next = { ...prev, [row.id]: cell };
        cellsRef.current = next;
        return next;
      });
      onCellChange?.(row, cell);
    },
    [onCellChange]
  );

  const runRows = useCallback(
    async (
      targetRows: EnrichColumnRow[],
      activeColumn: EnrichColumnDefinition,
      isFullRun: boolean
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);
      setAnnouncement(
        isFullRun
          ? `Running ${activeColumn.name} on ${targetRows.length} rows`
          : `Retrying ${targetRows[0]?.name ?? "row"}`
      );

      // Mark queued
      setCells((prev) => {
        const next = { ...prev };
        for (const r of targetRows) {
          next[r.id] = { status: "queued" };
        }
        cellsRef.current = next;
        return next;
      });

      const runner = enrich ?? simulateEnrich;
      const limit = Math.max(1, concurrency);
      let cursor = 0;

      const worker = async () => {
        while (cursor < targetRows.length) {
          if (controller.signal.aborted) return;
          const row = targetRows[cursor++];
          const attempt = (attemptsRef.current[row.id] ?? 0) + 1;
          attemptsRef.current[row.id] = attempt;

          updateCell(row, { status: "running" });
          setActivities((prev) => ({ ...prev, [row.id]: "Starting…" }));

          try {
            const res = await runner(row, {
              prompt: activeColumn.prompt,
              column: activeColumn,
              signal: controller.signal,
              attempt,
              setActivity: (text) => {
                if (!controller.signal.aborted) {
                  setActivities((prev) => ({ ...prev, [row.id]: text }));
                }
              },
            });
            if (controller.signal.aborted) return;
            updateCell(row, {
              status: "done",
              value: res.value,
              source: res.source,
            });
          } catch (err) {
            if (controller.signal.aborted) return;
            const message =
              err instanceof Error && err.message
                ? err.message
                : "Enrichment failed";
            updateCell(row, { status: "failed", error: message });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(limit, targetRows.length) }, () =>
          worker()
        )
      );

      if (!controller.signal.aborted) {
        setIsRunning(false);
        const doneCount = Object.values(cellsRef.current).filter(
          (c) => c.status === "done"
        ).length;
        setAnnouncement(
          `Finished ${activeColumn.name}: ${doneCount} of ${rows.length} rows enriched`
        );
        onRunComplete?.(cellsRef.current);
      }
    },
    [concurrency, enrich, onRunComplete, rows.length, updateCell]
  );

  // Optional autoRun on mount
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRun && !autoRanRef.current && rows.length > 0) {
      autoRanRef.current = true;
      const timer = window.setTimeout(() => {
        void runRows(rows, column, true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [autoRun, column, rows, runRows]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setCells((prev) => {
      const next: Record<string, EnrichColumnCell> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v.status === "done" || v.status === "failed") {
          next[k] = v;
        }
      }
      cellsRef.current = next;
      return next;
    });
    setAnnouncement("Enrichment stopped");
  };

  const openEditor = () => {
    setDraftName(column.name);
    setDraftPrompt(column.prompt);
    setIsEditing(true);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const cancelEditor = () => {
    setIsEditing(false);
    requestAnimationFrame(() => editBtnRef.current?.focus());
  };

  const saveEditorAndRun = () => {
    const nextCol: EnrichColumnDefinition = {
      name: draftName.trim() || column.name,
      prompt: draftPrompt.trim() || column.prompt,
    };
    setColumn(nextCol);
    onColumnChange?.(nextCol);
    setIsEditing(false);
    attemptsRef.current = {};
    void runRows(rows, nextCol, true);
  };

  const handleEditorKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditor();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      saveEditorAndRun();
    }
  };

  const hasAnyRun = Object.keys(cells).length > 0;
  const doneCount = rows.filter((r) => cells[r.id]?.status === "done").length;

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <div className={styles.card}>
        <div className={styles.top}>
          <div className={styles.heading}>
            <span className={styles.title}>{title}</span>
            <span className={styles.count}>
              {rows.length} {rows.length === 1 ? "row" : "rows"}
              {effectiveNote ? ` · ${effectiveNote}` : ""}
            </span>
          </div>

          <button
            type="button"
            className={styles.runBtn}
            data-running={isRunning ? "true" : undefined}
            aria-label={
              isRunning
                ? `Stop ${column.name}`
                : `${hasAnyRun ? "Rerun" : "Run"} ${column.name} on every row`
            }
            onClick={() => {
              if (isRunning) {
                handleStop();
              } else {
                void runRows(rows, column, true);
              }
            }}
          >
            {isRunning ? (
              <>
                <Square size={12} fill="currentColor" aria-hidden="true" />
                Stop
              </>
            ) : hasAnyRun ? (
              <>
                <RotateCw size={13} aria-hidden="true" />
                Rerun
              </>
            ) : (
              <>
                <Play size={12} fill="currentColor" aria-hidden="true" />
                Run column
              </>
            )}
          </button>
        </div>

        {isEditing ? (
          <div
            className={styles.editor}
            onKeyDown={handleEditorKeyDown}
            role="region"
            aria-label="Edit column prompt"
          >
            <div className={styles.editorRow}>
              <label className={styles.editorLabel} htmlFor="enrich-col-name">
                Column name
              </label>
              <input
                id="enrich-col-name"
                ref={nameInputRef}
                className={styles.editorInput}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </div>
            <div className={styles.editorRow}>
              <label className={styles.editorLabel} htmlFor="enrich-col-prompt">
                Prompt
              </label>
              <textarea
                id="enrich-col-prompt"
                className={styles.editorTextarea}
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
              />
            </div>
            <div className={styles.editorActions}>
              <span className={styles.editorHint}>⌘↵ to save and rerun</span>
              <div className={styles.editorBtns}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={cancelEditor}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={saveEditorAndRun}
                >
                  Save &amp; run
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colCompany} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">
                  <div className={styles.aiHead}>
                    <Sparkles
                      size={14}
                      className={styles.sparkle}
                      aria-hidden="true"
                    />
                    <span className={styles.aiText}>
                      <span className={styles.aiName}>{column.name}</span>
                      <span className={styles.aiPrompt} title={column.prompt}>
                        {column.prompt}
                      </span>
                    </span>
                    {editable ? (
                      <button
                        ref={editBtnRef}
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Edit column: ${column.name}`}
                        aria-expanded={isEditing}
                        onClick={() =>
                          isEditing ? cancelEditor() : openEditor()
                        }
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cell = cells[row.id];
                const activity = activities[row.id];
                return (
                  <tr key={row.id}>
                    <th scope="row" className={styles.companyCell}>
                      <span className={styles.company}>
                        <span className={styles.logo} aria-hidden="true">
                          {row.logo ?? row.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className={styles.companyText}>
                          <span className={styles.name}>{row.name}</span>
                          {row.domain ? (
                            <span className={styles.domain}>{row.domain}</span>
                          ) : null}
                        </span>
                      </span>
                    </th>

                    <td className={styles.resultCell}>
                      <div className={styles.cellInner}>
                        <div className={styles.cellMain}>
                          {!cell ? (
                            <span className={styles.idle}>Not run</span>
                          ) : cell.status === "queued" ? (
                            <span className={styles.queued}>
                              <span className={styles.dot} aria-hidden="true" />
                              Queued
                            </span>
                          ) : cell.status === "running" ? (
                            <span className={styles.running}>
                              <span
                                className={styles.spinner}
                                aria-hidden="true"
                              />
                              <span className={styles.shimmer}>
                                {activity || "Searching…"}
                              </span>
                            </span>
                          ) : cell.status === "failed" ? (
                            <span className={styles.failed}>
                              <AlertCircle size={13} aria-hidden="true" />
                              <span>{cell.error ?? "Failed"}</span>
                            </span>
                          ) : (
                            <motion.span
                              className={styles.value}
                              initial={
                                reducedMotion
                                  ? false
                                  : { opacity: 0, y: 3 }
                              }
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {cell.value}
                            </motion.span>
                          )}
                        </div>

                        {cell?.status === "done" && cell.source ? (
                          <a
                            href={cell.source.href}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.source}
                          >
                            <span className={styles.sourceLabel}>
                              {cell.source.label}
                            </span>
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        ) : null}

                        {cell?.status === "failed" ? (
                          <button
                            type="button"
                            className={styles.retryBtn}
                            onClick={() => void runRows([row], column, false)}
                          >
                            <RotateCw size={11} aria-hidden="true" />
                            Retry
                          </button>
                        ) : null}

                        {cell?.status === "done" ? (
                          <button
                            type="button"
                            className={`${styles.iconButton} ${styles.rowAction}`}
                            aria-label={`Rerun ${row.name}`}
                            onClick={() => void runRows([row], column, false)}
                          >
                            <RotateCw size={12} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {model !== null ? (
          <div className={styles.footer}>
            <span className={styles.model}>
              {model.mark ?? (
                <Sparkles
                  size={12}
                  className={styles.sparkle}
                  aria-hidden="true"
                />
              )}
              <span className={styles.modelName}>{model.name}</span>
              {model.detail ? (
                <span className={styles.modelDetail}>· {model.detail}</span>
              ) : null}
            </span>
            <span className={styles.progressText}>
              {isRunning
                ? `Enriching… ${doneCount}/${rows.length}`
                : hasAnyRun
                  ? `${doneCount}/${rows.length} complete`
                  : "Ready"}
            </span>
          </div>
        ) : null}
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
