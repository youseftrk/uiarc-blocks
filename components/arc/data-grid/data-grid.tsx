"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  EyeOff,
  Filter,
  Layers,
  Minus,
  MoreHorizontal,
  Pin,
  PinOff,
  Redo2,
  Rows3,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  aggregate,
  colLetter,
  dateFilter,
  defaultAggregate,
  extend,
  format,
  formatNumberValue,
  isIsoDay,
  isNumericColumn,
  numberFilter,
  parse,
  parseHtmlTable,
  parseTsv,
  rowMatcher,
  sortRows,
  toCsv,
  toHtml,
  toTsv,
  type DataGridAggregate,
  type DataGridBulkAction,
  type DataGridColumn,
  type DataGridColumnType,
  type DataGridDataSource,
  type DataGridDensity,
  type DataGridExportFormat,
  type DataGridExportNode,
  type DataGridFilters,
  type DataGridProps,
  type DataGridRow,
  type DataGridRowsRequest,
  type DataGridRowsResult,
  type DataGridSort,
  type DataGridValue,
} from "./data-grid-model";
import { toXlsx } from "./data-grid-xlsx";
import styles from "./data-grid.module.css";

export type {
  DataGridAggregate,
  DataGridBulkAction,
  DataGridColumn,
  DataGridColumnType,
  DataGridDataSource,
  DataGridDensity,
  DataGridExportFormat,
  DataGridExportNode,
  DataGridFilters,
  DataGridProps,
  DataGridRow,
  DataGridRowsRequest,
  DataGridRowsResult,
  DataGridSort,
  DataGridValue,
};

const DENSITY_HEIGHT: Record<DataGridDensity, number> = {
  compact: 32,
  standard: 40,
  comfortable: 48,
};

const MAX_HISTORY = 50;
const OVERSCAN = 6;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CellCoord {
  r: number;
  c: number;
}

interface Range {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

interface EditingState {
  r: number;
  c: number;
  rowId: string;
  colKey: string;
  draft: string;
  replaceMode: boolean;
  invalid: boolean;
  popupOpen: boolean;
  optionIndex: number;
}

interface GroupEntry {
  kind: "group";
  id: string;
  key: string;
  depth: number;
  label: string;
  rows: DataGridRow[];
}

interface DataEntry {
  kind: "row";
  id: string;
  row: DataGridRow;
  dataIndex: number;
}

interface PlaceholderEntry {
  kind: "placeholder";
  id: string;
  index: number;
}

type DisplayEntry = GroupEntry | DataEntry | PlaceholderEntry;

interface StatusMessage {
  id: number;
  text: string;
  canUndo?: boolean;
}

function normalizeRange(a: CellCoord, b: CellCoord): Range {
  return {
    r1: Math.min(a.r, b.r),
    c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r),
    c2: Math.max(a.c, b.c),
  };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function aggLabel(kind: DataGridAggregate): string {
  switch (kind) {
    case "sum":
      return "Sum";
    case "average":
      return "Avg";
    case "min":
      return "Min";
    case "max":
      return "Max";
    case "count":
      return "Count";
    default:
      return "";
  }
}

function CalendarPopup({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const parsed = isIsoDay(value) ? value.split("-").map(Number) : null;
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed ? parsed[0] : now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed[1] : now.getUTCMonth() + 1);

  const firstDay = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const dim = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const prevDim = new Date(Date.UTC(viewYear, viewMonth - 1, 0)).getUTCDate();

  const cells: Array<{ iso: string; day: number; outside: boolean }> = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDim - i;
    const pm = viewMonth === 1 ? 12 : viewMonth - 1;
    const py = viewMonth === 1 ? viewYear - 1 : viewYear;
    cells.push({
      iso: `${String(py).padStart(4, "0")}-${String(pm).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      outside: true,
    });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({
      iso: `${String(viewYear).padStart(4, "0")}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      outside: false,
    });
  }
  while (cells.length < 42) {
    const d = cells.length - (firstDay + dim) + 1;
    const nm = viewMonth === 12 ? 1 : viewMonth + 1;
    const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
    cells.push({
      iso: `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      outside: true,
    });
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(viewYear, viewMonth - 1, 1)));

  const shiftMonth = (delta: number) => {
    const total = viewYear * 12 + (viewMonth - 1) + delta;
    setViewYear(Math.floor(total / 12));
    setViewMonth((total % 12) + 1);
  };

  return (
    <div
      className={`${styles.options} ${styles.datePopover}`}
      role="dialog"
      aria-label="Choose date"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.calHeader}>
        <button
          type="button"
          className={styles.calNav}
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft size={14} aria-hidden />
        </button>
        <span className={styles.calTitle}>{monthLabel}</span>
        <button
          type="button"
          className={styles.calNav}
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>
      <div className={styles.calGrid}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.calWeekday}>
            {w}
          </div>
        ))}
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            className={styles.calDay}
            data-outside={cell.outside ? "true" : undefined}
            data-selected={cell.iso === value ? "true" : undefined}
            onClick={() => onSelect(cell.iso)}
          >
            {cell.day}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DataGrid({
  columns,
  label,
  rows: controlledRows,
  defaultRows = [],
  onRowsChange,
  maxHeight = 400,
  sort: controlledSort,
  defaultSort = [],
  onSortChange,
  filters: controlledFilters,
  defaultFilters = {},
  onFiltersChange,
  selectedRowIds: controlledSelectedIds,
  defaultSelectedRowIds = [],
  onSelectedRowIdsChange,
  hiddenColumns: controlledHidden,
  defaultHiddenColumns,
  onHiddenColumnsChange,
  pinnedColumns: controlledPinned,
  defaultPinnedColumns,
  onPinnedColumnsChange,
  density: controlledDensity,
  defaultDensity = "standard",
  onDensityChange,
  rowSelection = true,
  rowNumbers = true,
  selectionStats = true,
  toolbar = true,
  totals = true,
  groupBy: controlledGroupBy,
  defaultGroupBy = [],
  onGroupByChange,
  exportFormats = ["csv"],
  dataSource,
  bulkActions = [],
  canDeleteRows = true,
  exportFileName,
  loading = false,
  emptyMessage = "No rows yet",
  className,
}: DataGridProps) {
  const baseId = useId();
  const reducedMotion = useReducedMotion();
  const isServer = Boolean(dataSource);

  // Controlled / uncontrolled state
  const [innerRows, setInnerRows] = useState<DataGridRow[]>(defaultRows);
  const rows = controlledRows ?? innerRows;
  const setRows = useCallback(
    (next: DataGridRow[]) => {
      if (controlledRows === undefined) setInnerRows(next);
      onRowsChange?.(next);
    },
    [controlledRows, onRowsChange],
  );

  const [innerSort, setInnerSort] = useState<DataGridSort[]>(defaultSort);
  const sort = controlledSort ?? innerSort;
  const setSort = useCallback(
    (next: DataGridSort[]) => {
      if (controlledSort === undefined) setInnerSort(next);
      onSortChange?.(next);
    },
    [controlledSort, onSortChange],
  );

  const [innerFilters, setInnerFilters] = useState<DataGridFilters>(defaultFilters);
  const filters = controlledFilters ?? innerFilters;
  const setFilters = useCallback(
    (next: DataGridFilters) => {
      if (controlledFilters === undefined) setInnerFilters(next);
      onFiltersChange?.(next);
    },
    [controlledFilters, onFiltersChange],
  );

  const [innerSelectedIds, setInnerSelectedIds] = useState<string[]>(defaultSelectedRowIds);
  const selectedRowIds = controlledSelectedIds ?? innerSelectedIds;
  const setSelectedRowIds = useCallback(
    (next: string[]) => {
      if (controlledSelectedIds === undefined) setInnerSelectedIds(next);
      onSelectedRowIdsChange?.(next);
    },
    [controlledSelectedIds, onSelectedRowIdsChange],
  );

  const initialHidden = useMemo(
    () =>
      defaultHiddenColumns ??
      columns.filter((c) => c.hidden).map((c) => c.key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [innerHidden, setInnerHidden] = useState<string[]>(initialHidden);
  const hiddenColumns = controlledHidden ?? innerHidden;
  const setHiddenColumns = useCallback(
    (next: string[]) => {
      if (controlledHidden === undefined) setInnerHidden(next);
      onHiddenColumnsChange?.(next);
    },
    [controlledHidden, onHiddenColumnsChange],
  );

  const initialPinned = useMemo(() => {
    if (defaultPinnedColumns !== undefined) return defaultPinnedColumns;
    const explicit = columns.filter((c) => c.pinned).map((c) => c.key);
    if (explicit.length > 0) return explicit;
    return columns.length > 0 ? [columns[0].key] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [innerPinned, setInnerPinned] = useState<string[]>(initialPinned);
  const pinnedColumns = controlledPinned ?? innerPinned;
  const setPinnedColumns = useCallback(
    (next: string[]) => {
      if (controlledPinned === undefined) setInnerPinned(next);
      onPinnedColumnsChange?.(next);
    },
    [controlledPinned, onPinnedColumnsChange],
  );

  const [innerDensity, setInnerDensity] = useState<DataGridDensity>(defaultDensity);
  const density = controlledDensity ?? innerDensity;
  const setDensity = useCallback(
    (next: DataGridDensity) => {
      if (controlledDensity === undefined) setInnerDensity(next);
      onDensityChange?.(next);
    },
    [controlledDensity, onDensityChange],
  );

  const [innerGroupBy, setInnerGroupBy] = useState<string[]>(defaultGroupBy);
  const groupBy = useMemo(
    () => (isServer ? [] : (controlledGroupBy ?? innerGroupBy)),
    [isServer, controlledGroupBy, innerGroupBy],
  );
  const setGroupBy = useCallback(
    (next: string[]) => {
      if (controlledGroupBy === undefined) setInnerGroupBy(next);
      onGroupByChange?.(next);
    },
    [controlledGroupBy, onGroupByChange],
  );

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(
    () => Object.keys(defaultFilters).length > 0,
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizingKey, setResizingKey] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<{ past: DataGridRow[][]; future: DataGridRow[][] }>({
    past: [],
    future: [],
  });

  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const statusSeqRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);

  const flashStatus = useCallback((text: string, canUndo = false) => {
    statusSeqRef.current += 1;
    setStatusMsg({ id: statusSeqRef.current, text, canUndo });
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMsg(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  const commitRows = useCallback(
    (next: DataGridRow[], message?: string) => {
      setHistory((prev) => ({
        past: [...prev.past.slice(-(MAX_HISTORY - 1)), rows],
        future: [],
      }));
      setRows(next);
      if (message) flashStatus(message, true);
    },
    [rows, setRows, flashStatus],
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      setRows(previous);
      flashStatus("Undone");
      return {
        past: prev.past.slice(0, -1),
        future: [rows, ...prev.future.slice(0, MAX_HISTORY - 1)],
      };
    });
  }, [rows, setRows, flashStatus]);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      setRows(next);
      flashStatus("Redone");
      return {
        past: [...prev.past.slice(-(MAX_HISTORY - 1)), rows],
        future: prev.future.slice(1),
      };
    });
  }, [rows, setRows, flashStatus]);

  // Server data source state
  const [serverRowCount, setServerRowCount] = useState(0);
  const [serverTotals, setServerTotals] = useState<Record<string, number | null> | undefined>(
    undefined,
  );
  const [serverBlocks, setServerBlocks] = useState<Map<number, DataGridRow[]>>(() => new Map());
  const inFlightBlocksRef = useRef<Set<number>>(new Set());
  const serverAbortRef = useRef<AbortController | null>(null);

  const queryKey = useMemo(
    () => JSON.stringify({ sort, filters, search }),
    [sort, filters, search],
  );

  useEffect(() => {
    if (!dataSource) return;
    serverAbortRef.current?.abort();
    const ctrl = new AbortController();
    serverAbortRef.current = ctrl;
    inFlightBlocksRef.current.clear();

    const blockSize = dataSource.blockSize ?? 100;
    inFlightBlocksRef.current.add(0);
    dataSource
      .getRows({
        start: 0,
        end: blockSize,
        sort,
        filters,
        search,
        signal: ctrl.signal,
      })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setServerRowCount(res.rowCount);
        setServerTotals(res.totals);
        setServerBlocks(new Map([[0, res.rows]]));
      })
      .catch(() => {
        // aborted or failed
      });

    return () => {
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, queryKey]);

  // Visible columns (pinned first, then unpinned in definition order)
  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const pinnedSet = useMemo(() => new Set(pinnedColumns), [pinnedColumns]);

  const visibleColumns = useMemo(() => {
    const visible = columns.filter((c) => !hiddenSet.has(c.key));
    const pinned = visible.filter((c) => pinnedSet.has(c.key));
    const unpinned = visible.filter((c) => !pinnedSet.has(c.key));
    return [...pinned, ...unpinned];
  }, [columns, hiddenSet, pinnedSet]);

  const pinnedCount = useMemo(
    () => visibleColumns.filter((c) => pinnedSet.has(c.key)).length,
    [visibleColumns, pinnedSet],
  );

  const gutterWidth = rowSelection ? (rowNumbers ? 48 : 40) : 0;

  // Column widths + positions
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [scrollerWidth, setScrollerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrolledX, setScrolledX] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScrollerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colLayout = useMemo(() => {
    const baseWidths = visibleColumns.map((c) => colWidths[c.key] ?? c.width ?? 140);
    const baseTotal = gutterWidth + baseWidths.reduce((a, b) => a + b, 0);
    const widths = [...baseWidths];
    if (scrollerWidth > baseTotal && widths.length > 0) {
      widths[widths.length - 1] += scrollerWidth - baseTotal;
    }
    const lefts: number[] = [];
    let x = gutterWidth;
    for (let i = 0; i < widths.length; i++) {
      lefts.push(x);
      x += widths[i];
    }
    return { widths, lefts, totalWidth: x };
  }, [visibleColumns, colWidths, gutterWidth, scrollerWidth]);

  // Distinct options for select columns
  const columnOptionsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of columns) {
      if (col.type !== "select") continue;
      if (col.options && col.options.length > 0) {
        map.set(col.key, col.options);
      } else {
        const set = new Set<string>();
        for (const r of rows) {
          const v = r[col.key];
          if (v !== null && v !== undefined && v !== "") set.add(String(v));
        }
        map.set(col.key, Array.from(set).sort());
      }
    }
    return map;
  }, [columns, rows]);

  // Client-side filter + sort
  const filteredRows = useMemo(() => {
    if (isServer) return [];
    const matcher = rowMatcher(columns, filters, search, visibleColumns);
    const kept = matcher ? rows.filter(matcher) : rows;
    return sortRows(kept, sort, columns);
  }, [isServer, columns, filters, search, visibleColumns, rows, sort]);

  // Build display entries (flat or grouped)
  const displayEntries = useMemo<DisplayEntry[]>(() => {
    if (isServer) {
      const blockSize = dataSource?.blockSize ?? 100;
      const entries: DisplayEntry[] = [];
      for (let i = 0; i < serverRowCount; i++) {
        const b = Math.floor(i / blockSize);
        const row = serverBlocks.get(b)?.[i % blockSize];
        if (row) {
          entries.push({ kind: "row", id: row.id, row, dataIndex: i });
        } else {
          entries.push({ kind: "placeholder", id: `ph-${i}`, index: i });
        }
      }
      return entries;
    }

    if (groupBy.length === 0) {
      return filteredRows.map((row, idx) => ({
        kind: "row",
        id: row.id,
        row,
        dataIndex: idx,
      }));
    }

    const entries: DisplayEntry[] = [];
    let dataIdx = 0;

    const buildGroups = (list: DataGridRow[], depth: number, prefix: string) => {
      if (depth >= groupBy.length) {
        for (const row of list) {
          entries.push({ kind: "row", id: row.id, row, dataIndex: dataIdx++ });
        }
        return;
      }
      const key = groupBy[depth];
      const buckets = new Map<string, DataGridRow[]>();
      for (const row of list) {
        const raw = row[key];
        const labelStr = raw === null || raw === undefined || raw === "" ? "(Empty)" : String(raw);
        const arr = buckets.get(labelStr);
        if (arr) arr.push(row);
        else buckets.set(labelStr, [row]);
      }
      for (const [gLabel, gRows] of buckets) {
        const gId = `${prefix}/${key}=${gLabel}`;
        entries.push({
          kind: "group",
          id: gId,
          key,
          depth,
          label: gLabel,
          rows: gRows,
        });
        if (!collapsedGroups.has(gId)) {
          buildGroups(gRows, depth + 1, gId);
        }
      }
    };

    buildGroups(filteredRows, 0, "g");
    return entries;
  }, [isServer, dataSource, serverRowCount, serverBlocks, groupBy, filteredRows, collapsedGroups]);

  const rowHeight = DENSITY_HEIGHT[density];
  const totalDisplayRows = displayEntries.length;
  const bodyHeight = totalDisplayRows * rowHeight;

  // Virtual window
  const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const visibleCount = Math.ceil(maxHeight / rowHeight) + OVERSCAN * 2;
  const visibleEnd = Math.min(totalDisplayRows, visibleStart + visibleCount);

  // Request missing server blocks for visible range
  useEffect(() => {
    if (!dataSource || serverRowCount === 0) return;
    const blockSize = dataSource.blockSize ?? 100;
    const firstBlock = Math.floor(visibleStart / blockSize);
    const lastBlock = Math.floor(Math.max(0, visibleEnd - 1) / blockSize);
    const ctrl = serverAbortRef.current;
    if (!ctrl || ctrl.signal.aborted) return;

    for (let b = firstBlock; b <= lastBlock; b++) {
      if (serverBlocks.has(b) || inFlightBlocksRef.current.has(b)) continue;
      inFlightBlocksRef.current.add(b);
      dataSource
        .getRows({
          start: b * blockSize,
          end: (b + 1) * blockSize,
          sort,
          filters,
          search,
          signal: ctrl.signal,
        })
        .then((res) => {
          if (ctrl.signal.aborted) return;
          setServerBlocks((prev) => {
            const next = new Map(prev);
            next.set(b, res.rows);
            if (next.size > 40) {
              const oldest = next.keys().next().value;
              if (oldest !== undefined) next.delete(oldest);
            }
            return next;
          });
        })
        .catch(() => {
          inFlightBlocksRef.current.delete(b);
        });
    }
  }, [dataSource, serverRowCount, visibleStart, visibleEnd, serverBlocks, sort, filters, search]);

  // Selection & Editing state
  const [anchor, setAnchor] = useState<CellCoord>({ r: 0, c: 0 });
  const [focusCell, setFocusCell] = useState<CellCoord>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [fillTarget, setFillTarget] = useState<Range | null>(null);

  const clampedAnchor = useMemo<CellCoord>(
    () => ({
      r: Math.min(anchor.r, Math.max(0, totalDisplayRows - 1)),
      c: Math.min(anchor.c, Math.max(0, visibleColumns.length - 1)),
    }),
    [anchor, totalDisplayRows, visibleColumns.length],
  );
  const clampedFocus = useMemo<CellCoord>(
    () => ({
      r: Math.min(focusCell.r, Math.max(0, totalDisplayRows - 1)),
      c: Math.min(focusCell.c, Math.max(0, visibleColumns.length - 1)),
    }),
    [focusCell, totalDisplayRows, visibleColumns.length],
  );

  const selectionRange = useMemo(
    () => normalizeRange(clampedAnchor, clampedFocus),
    [clampedAnchor, clampedFocus],
  );

  const mountedRowIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = visibleStart; i < visibleEnd; i++) set.add(i);
    if (totalDisplayRows > 0) {
      set.add(clampedFocus.r);
      if (editing && editing.r < totalDisplayRows) set.add(editing.r);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [visibleStart, visibleEnd, totalDisplayRows, clampedFocus.r, editing]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    for (const v of Object.values(filters)) {
      if (Array.isArray(v)) {
        if (v.length > 0) n++;
      } else if (v.trim()) {
        n++;
      }
    }
    return n;
  }, [filters]);

  const checkedSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);

  const allVisibleRowIds = useMemo(() => {
    if (isServer) return [];
    return filteredRows.map((r) => r.id);
  }, [isServer, filteredRows]);

  const checkedVisibleCount = useMemo(() => {
    if (selectedRowIds.length === 0) return 0;
    if (isServer) return selectedRowIds.length;
    let c = 0;
    for (const id of allVisibleRowIds) {
      if (checkedSet.has(id)) c++;
    }
    return c;
  }, [selectedRowIds.length, isServer, allVisibleRowIds, checkedSet]);

  const selectAllState: "off" | "mixed" | "on" =
    allVisibleRowIds.length > 0 && checkedVisibleCount === allVisibleRowIds.length
      ? "on"
      : checkedVisibleCount > 0
        ? "mixed"
        : "off";

  const toggleSelectAll = useCallback(() => {
    if (isServer) return;
    if (selectAllState === "on") {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(allVisibleRowIds);
    }
  }, [isServer, selectAllState, allVisibleRowIds, setSelectedRowIds]);

  const toggleRowCheck = useCallback(
    (rowId: string) => {
      if (checkedSet.has(rowId)) {
        setSelectedRowIds(selectedRowIds.filter((id) => id !== rowId));
      } else {
        setSelectedRowIds([...selectedRowIds, rowId]);
      }
    },
    [checkedSet, selectedRowIds, setSelectedRowIds],
  );

  // Scroll active cell into view
  const scrollCellIntoView = useCallback(
    (r: number, c: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const top = r * rowHeight;
      const bottom = top + rowHeight;
      const headH = 40 + (showFilters ? 40 : 0);
      const footH = totals ? 40 : 0;
      const viewH = scroller.clientHeight - headH - footH;
      if (top < scroller.scrollTop) {
        scroller.scrollTop = top;
      } else if (bottom > scroller.scrollTop + viewH) {
        scroller.scrollTop = Math.max(0, bottom - viewH);
      }

      if (c >= pinnedCount && c < colLayout.lefts.length) {
        const pinnedW =
          pinnedCount > 0
            ? colLayout.lefts[pinnedCount - 1] + colLayout.widths[pinnedCount - 1]
            : gutterWidth;
        const left = colLayout.lefts[c];
        const right = left + colLayout.widths[c];
        if (left < scroller.scrollLeft + pinnedW) {
          scroller.scrollLeft = Math.max(0, left - pinnedW);
        } else if (right > scroller.scrollLeft + scroller.clientWidth) {
          scroller.scrollLeft = Math.max(0, right - scroller.clientWidth);
        }
      }
    },
    [rowHeight, showFilters, totals, pinnedCount, colLayout, gutterWidth],
  );

  const moveFocus = useCallback(
    (r: number, c: number, extendRange = false) => {
      if (totalDisplayRows === 0 || visibleColumns.length === 0) return;
      const nr = Math.max(0, Math.min(totalDisplayRows - 1, r));
      const nc = Math.max(0, Math.min(visibleColumns.length - 1, c));
      setFocusCell({ r: nr, c: nc });
      if (!extendRange) setAnchor({ r: nr, c: nc });
      scrollCellIntoView(nr, nc);
    },
    [totalDisplayRows, visibleColumns.length, scrollCellIntoView],
  );

  // Start / Commit / Cancel editing
  const editorInputRef = useRef<HTMLInputElement | null>(null);

  const startEdit = useCallback(
    (r: number, c: number, initialText?: string, openPopup = false) => {
      if (isServer) return;
      const entry = displayEntries[r];
      const col = visibleColumns[c];
      if (!entry || entry.kind !== "row" || !col || col.editable === false) return;
      const raw = entry.row[col.key];
      const draft =
        initialText !== undefined
          ? initialText
          : raw === null || raw === undefined
            ? ""
            : String(raw);
      const opts = col.type === "select" ? (columnOptionsMap.get(col.key) ?? []) : [];
      const curIdx = opts.findIndex((o) => o.toLowerCase() === draft.toLowerCase());
      setEditing({
        r,
        c,
        rowId: entry.row.id,
        colKey: col.key,
        draft,
        replaceMode: initialText !== undefined,
        invalid: false,
        popupOpen: openPopup || col.type === "select" || col.type === "date",
        optionIndex: Math.max(0, curIdx),
      });
    },
    [isServer, displayEntries, visibleColumns, columnOptionsMap],
  );

  useEffect(() => {
    if (editing && editorInputRef.current) {
      editorInputRef.current.focus();
      if (!editing.replaceMode) {
        editorInputRef.current.select();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.rowId, editing?.colKey]);

  const commitEdit = useCallback(
    (
      overrideDraft?: string,
      moveDelta?: { dr: number; dc: number },
    ): boolean => {
      if (!editing) return true;
      const col = visibleColumns.find((c) => c.key === editing.colKey);
      if (!col) {
        setEditing(null);
        return true;
      }
      const text = overrideDraft ?? editing.draft;
      const opts = col.type === "select" ? columnOptionsMap.get(col.key) : undefined;
      const parsed = parse(text, col, opts);
      if (!parsed.ok) {
        setEditing((prev) => (prev ? { ...prev, invalid: true } : null));
        return false;
      }

      const targetRow = rows.find((r) => r.id === editing.rowId);
      if (targetRow && targetRow[col.key] !== parsed.value) {
        const nextRows = rows.map((r) =>
          r.id === editing.rowId ? { ...r, [col.key]: parsed.value } : r,
        );
        commitRows(nextRows);
      }

      const nextR = editing.r + (moveDelta?.dr ?? 0);
      const nextC = editing.c + (moveDelta?.dc ?? 0);
      setEditing(null);
      if (moveDelta) {
        moveFocus(nextR, nextC, false);
      }
      gridRef.current?.focus();
      return true;
    },
    [editing, visibleColumns, columnOptionsMap, rows, commitRows, moveFocus],
  );

  const cancelEdit = useCallback(() => {
    setEditing(null);
    gridRef.current?.focus();
  }, []);

  // Sorting
  const toggleSort = useCallback(
    (key: string, shift: boolean) => {
      setMoving(true);
      window.setTimeout(() => setMoving(false), 360);
      const existingIdx = sort.findIndex((s) => s.key === key);
      if (!shift) {
        if (existingIdx === -1) {
          setSort([{ key, dir: "asc" }]);
        } else if (sort[existingIdx].dir === "asc") {
          setSort([{ key, dir: "desc" }]);
        } else {
          setSort([]);
        }
        return;
      }
      if (existingIdx === -1) {
        setSort([...sort, { key, dir: "asc" }]);
      } else if (sort[existingIdx].dir === "asc") {
        setSort(sort.map((s, i) => (i === existingIdx ? { ...s, dir: "desc" } : s)));
      } else {
        setSort(sort.filter((_, i) => i !== existingIdx));
      }
    },
    [sort, setSort],
  );

  const setDirectSort = useCallback(
    (key: string, dir: "asc" | "desc" | null) => {
      setMoving(true);
      window.setTimeout(() => setMoving(false), 360);
      if (dir === null) {
        setSort(sort.filter((s) => s.key !== key));
      } else {
        const rest = sort.filter((s) => s.key !== key);
        setSort([{ key, dir }, ...rest]);
      }
    },
    [sort, setSort],
  );

  // Column resize
  const onResizeStart = useCallback(
    (col: DataGridColumn, e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = colWidths[col.key] ?? col.width ?? 140;
      const minW = col.minWidth ?? 72;
      setResizingKey(col.key);

      const onMove = (ev: PointerEvent) => {
        const nextW = Math.max(minW, Math.min(560, Math.round(startW + (ev.clientX - startX))));
        setColWidths((prev) => ({ ...prev, [col.key]: nextW }));
      };
      const onUp = () => {
        setResizingKey(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [colWidths],
  );

  // Pointer drag range selection
  const onCellPointerDown = useCallback(
    (r: number, c: number, e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (editing && editing.r === r && editing.c === c) return;
      if (editing) {
        if (!commitEdit()) return;
      }
      gridRef.current?.focus();

      if (e.shiftKey) {
        setFocusCell({ r, c });
        return;
      }

      setAnchor({ r, c });
      setFocusCell({ r, c });

      const onMove = (ev: PointerEvent) => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const rect = scroller.getBoundingClientRect();
        const headH = 40 + (showFilters ? 40 : 0);
        const y = ev.clientY - rect.top + scroller.scrollTop - headH;
        const x = ev.clientX - rect.left + scroller.scrollLeft;
        const nr = Math.max(0, Math.min(totalDisplayRows - 1, Math.floor(y / rowHeight)));
        let nc = visibleColumns.length - 1;
        for (let i = 0; i < colLayout.lefts.length; i++) {
          if (x < colLayout.lefts[i] + colLayout.widths[i]) {
            nc = i;
            break;
          }
        }
        setFocusCell({ r: nr, c: Math.max(0, nc) });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editing, commitEdit, showFilters, totalDisplayRows, rowHeight, visibleColumns.length, colLayout],
  );

  // Fill handle drag
  const onFillHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isServer) return;
      e.preventDefault();
      e.stopPropagation();
      const src = selectionRange;
      let latestTarget: Range | null = null;

      const onMove = (ev: PointerEvent) => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const rect = scroller.getBoundingClientRect();
        const headH = 40 + (showFilters ? 40 : 0);
        const y = ev.clientY - rect.top + scroller.scrollTop - headH;
        const nr = Math.max(0, Math.min(totalDisplayRows - 1, Math.floor(y / rowHeight)));
        if (nr > src.r2) {
          latestTarget = { r1: src.r1, c1: src.c1, r2: nr, c2: src.c2 };
        } else if (nr < src.r1) {
          latestTarget = { r1: nr, c1: src.c1, r2: src.r2, c2: src.c2 };
        } else {
          latestTarget = null;
        }
        setFillTarget(latestTarget);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setFillTarget(null);
        if (!latestTarget) return;

        const target = latestTarget;
        const forward = target.r2 > src.r2;
        const count = forward ? target.r2 - src.r2 : src.r1 - target.r1;
        if (count <= 0) return;

        const updates = new Map<string, Record<string, DataGridValue>>();
        for (let ci = src.c1; ci <= src.c2; ci++) {
          const col = visibleColumns[ci];
          if (!col || col.editable === false) continue;
          const srcVals: DataGridValue[] = [];
          for (let ri = src.r1; ri <= src.r2; ri++) {
            const entry = displayEntries[ri];
            if (entry?.kind === "row") srcVals.push(entry.row[col.key] ?? null);
          }
          const extended = extend(srcVals, count, forward, col.type);
          for (let i = 0; i < count; i++) {
            const destR = forward ? src.r2 + 1 + i : target.r1 + i;
            const entry = displayEntries[destR];
            if (entry?.kind === "row") {
              const cur = updates.get(entry.row.id) ?? {};
              cur[col.key] = extended[i];
              updates.set(entry.row.id, cur);
            }
          }
        }

        if (updates.size > 0) {
          const nextRows = rows.map((r) => {
            const patch = updates.get(r.id);
            return patch ? { ...r, ...patch } : r;
          });
          commitRows(nextRows, `Filled ${count} ${count === 1 ? "row" : "rows"}`);
          setAnchor({ r: target.r1, c: target.c1 });
          setFocusCell({ r: target.r2, c: target.c2 });
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [isServer, selectionRange, showFilters, totalDisplayRows, rowHeight, visibleColumns, displayEntries, rows, commitRows],
  );

  // Clear range
  const clearRange = useCallback(() => {
    if (isServer) return;
    const updates = new Map<string, Record<string, DataGridValue>>();
    for (let ri = selectionRange.r1; ri <= selectionRange.r2; ri++) {
      const entry = displayEntries[ri];
      if (!entry || entry.kind !== "row") continue;
      for (let ci = selectionRange.c1; ci <= selectionRange.c2; ci++) {
        const col = visibleColumns[ci];
        if (!col || col.editable === false) continue;
        const cur = updates.get(entry.row.id) ?? {};
        cur[col.key] = isNumericColumn(col.type) ? null : "";
        updates.set(entry.row.id, cur);
      }
    }
    if (updates.size > 0) {
      const nextRows = rows.map((r) => {
        const patch = updates.get(r.id);
        return patch ? { ...r, ...patch } : r;
      });
      commitRows(nextRows, "Cleared cells");
    }
  }, [isServer, selectionRange, displayEntries, visibleColumns, rows, commitRows]);

  // Fill down (Cmd/Ctrl+D)
  const fillDown = useCallback(() => {
    if (isServer || selectionRange.r2 <= selectionRange.r1) return;
    const topEntry = displayEntries[selectionRange.r1];
    if (!topEntry || topEntry.kind !== "row") return;
    const updates = new Map<string, Record<string, DataGridValue>>();
    for (let ri = selectionRange.r1 + 1; ri <= selectionRange.r2; ri++) {
      const entry = displayEntries[ri];
      if (!entry || entry.kind !== "row") continue;
      for (let ci = selectionRange.c1; ci <= selectionRange.c2; ci++) {
        const col = visibleColumns[ci];
        if (!col || col.editable === false) continue;
        const cur = updates.get(entry.row.id) ?? {};
        cur[col.key] = topEntry.row[col.key] ?? null;
        updates.set(entry.row.id, cur);
      }
    }
    if (updates.size > 0) {
      const nextRows = rows.map((r) => {
        const patch = updates.get(r.id);
        return patch ? { ...r, ...patch } : r;
      });
      commitRows(nextRows, "Filled down");
    }
  }, [isServer, selectionRange, displayEntries, visibleColumns, rows, commitRows]);

  // Copy / Cut / Paste
  const copyRange = useCallback(
    async (isCut = false) => {
      const matrix: string[][] = [];
      for (let ri = selectionRange.r1; ri <= selectionRange.r2; ri++) {
        const entry = displayEntries[ri];
        if (!entry || entry.kind !== "row") continue;
        const rowCells: string[] = [];
        for (let ci = selectionRange.c1; ci <= selectionRange.c2; ci++) {
          const col = visibleColumns[ci];
          if (!col) continue;
          rowCells.push(format(entry.row[col.key], col));
        }
        matrix.push(rowCells);
      }
      if (matrix.length === 0) return;
      const tsv = toTsv(matrix);
      const html = toHtml(matrix);
      try {
        if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": new Blob([tsv], { type: "text/plain" }),
              "text/html": new Blob([html], { type: "text/html" }),
            }),
          ]);
        } else {
          await navigator.clipboard?.writeText(tsv);
        }
      } catch {
        // clipboard may be blocked in non-HTTPS contexts
      }
      if (isCut && !isServer) {
        clearRange();
        flashStatus("Cut to clipboard", true);
      } else {
        flashStatus("Copied to clipboard");
      }
    },
    [selectionRange, displayEntries, visibleColumns, isServer, clearRange, flashStatus],
  );

  const pasteMatrix = useCallback(
    (matrix: string[][]) => {
      if (isServer || matrix.length === 0) return;
      const updates = new Map<string, Record<string, DataGridValue>>();
      const startR = selectionRange.r1;
      const startC = selectionRange.c1;

      for (let dr = 0; dr < matrix.length; dr++) {
        const entry = displayEntries[startR + dr];
        if (!entry || entry.kind !== "row") continue;
        for (let dc = 0; dc < matrix[dr].length; dc++) {
          const col = visibleColumns[startC + dc];
          if (!col || col.editable === false) continue;
          const opts = col.type === "select" ? columnOptionsMap.get(col.key) : undefined;
          const parsed = parse(matrix[dr][dc], col, opts);
          if (!parsed.ok) continue;
          const cur = updates.get(entry.row.id) ?? {};
          cur[col.key] = parsed.value;
          updates.set(entry.row.id, cur);
        }
      }

      if (updates.size > 0) {
        const nextRows = rows.map((r) => {
          const patch = updates.get(r.id);
          return patch ? { ...r, ...patch } : r;
        });
        commitRows(nextRows, `Pasted ${updates.size} ${updates.size === 1 ? "row" : "rows"}`);
        setAnchor({ r: startR, c: startC });
        setFocusCell({
          r: Math.min(totalDisplayRows - 1, startR + matrix.length - 1),
          c: Math.min(visibleColumns.length - 1, startC + matrix[0].length - 1),
        });
      }
    },
    [isServer, selectionRange, displayEntries, visibleColumns, columnOptionsMap, rows, commitRows, totalDisplayRows],
  );

  // Bulk delete
  const deleteCheckedRows = useCallback(() => {
    if (isServer || selectedRowIds.length === 0) return;
    const delSet = new Set(selectedRowIds);
    const nextRows = rows.filter((r) => !delSet.has(r.id));
    const count = rows.length - nextRows.length;
    setSelectedRowIds([]);
    commitRows(nextRows, `Deleted ${count} ${count === 1 ? "row" : "rows"}`);
  }, [isServer, selectedRowIds, rows, setSelectedRowIds, commitRows]);

  // Export CSV / XLSX
  const runExport = useCallback(
    (fmt: DataGridExportFormat, onlyChecked = false) => {
      const targetRows = onlyChecked
        ? rows.filter((r) => checkedSet.has(r.id))
        : isServer
          ? rows.filter((r) => checkedSet.has(r.id))
          : filteredRows;
      const base = exportFileName ?? slugify(label);
      if (fmt === "csv") {
        const csv = toCsv(visibleColumns, targetRows);
        triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
        flashStatus(`Exported ${targetRows.length.toLocaleString()} rows to CSV`);
      } else {
        const buildExportNodes = (list: DataGridRow[], depth: number): DataGridExportNode[] => {
          if (depth >= groupBy.length) return list;
          const key = groupBy[depth];
          const buckets = new Map<string, DataGridRow[]>();
          for (const row of list) {
            const k = String(row[key] ?? "(Empty)");
            const arr = buckets.get(k);
            if (arr) arr.push(row);
            else buckets.set(k, [row]);
          }
          return Array.from(buckets.entries()).map(([gLabel, gRows]) => ({
            label: gLabel,
            children: buildExportNodes(gRows, depth + 1),
          }));
        };
        const nodes = onlyChecked ? targetRows : buildExportNodes(targetRows, 0);
        const bytes = toXlsx(visibleColumns, nodes, {
          sheetName: label,
          freezeColumns: pinnedCount,
          totals,
          widths: colWidths,
        });
        const buf = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buf).set(bytes);
        triggerDownload(
          new Blob([buf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          `${base}.xlsx`,
        );
        flashStatus(`Exported ${targetRows.length.toLocaleString()} rows to Excel`);
      }
    },
    [rows, checkedSet, isServer, filteredRows, exportFileName, label, visibleColumns, flashStatus, groupBy, pinnedCount, totals, colWidths],
  );

  // Copy checked rows
  const copyCheckedRows = useCallback(async () => {
    const checked = rows.filter((r) => checkedSet.has(r.id));
    if (checked.length === 0) return;
    const matrix = [
      visibleColumns.map((c) => c.label),
      ...checked.map((r) => visibleColumns.map((c) => format(r[c.key], c))),
    ];
    try {
      await navigator.clipboard?.writeText(toTsv(matrix));
    } catch {
      // ignore
    }
    flashStatus(`Copied ${checked.length} ${checked.length === 1 ? "row" : "rows"}`);
  }, [rows, checkedSet, visibleColumns, flashStatus]);

  // Grid keyboard navigation
  const onGridKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (editing) return;
      const target = e.target as HTMLElement;
      if (target !== gridRef.current && target.closest("input, button, [role='menuitem']")) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const pageRows = Math.max(1, Math.floor(maxHeight / rowHeight) - 2);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.altKey) {
          startEdit(clampedFocus.r, clampedFocus.c, undefined, true);
        } else {
          moveFocus(mod ? totalDisplayRows - 1 : clampedFocus.r + 1, clampedFocus.c, e.shiftKey);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveFocus(mod ? 0 : clampedFocus.r - 1, clampedFocus.c, e.shiftKey);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveFocus(clampedFocus.r, mod ? visibleColumns.length - 1 : clampedFocus.c + 1, e.shiftKey);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveFocus(clampedFocus.r, mod ? 0 : clampedFocus.c - 1, e.shiftKey);
      } else if (e.key === "Home") {
        e.preventDefault();
        moveFocus(mod ? 0 : clampedFocus.r, 0, e.shiftKey);
      } else if (e.key === "End") {
        e.preventDefault();
        moveFocus(
          mod ? totalDisplayRows - 1 : clampedFocus.r,
          visibleColumns.length - 1,
          e.shiftKey,
        );
      } else if (e.key === "PageDown") {
        e.preventDefault();
        moveFocus(clampedFocus.r + pageRows, clampedFocus.c, e.shiftKey);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        moveFocus(clampedFocus.r - pageRows, clampedFocus.c, e.shiftKey);
      } else if (e.key === "Tab") {
        e.preventDefault();
        moveFocus(clampedFocus.r, clampedFocus.c + (e.shiftKey ? -1 : 1), false);
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (totalDisplayRows > 0 && visibleColumns.length > 0) {
          setAnchor({ r: 0, c: 0 });
          setFocusCell({ r: totalDisplayRows - 1, c: visibleColumns.length - 1 });
        }
      } else if (e.ctrlKey && e.key === " ") {
        e.preventDefault();
        if (totalDisplayRows > 0) {
          setAnchor({ r: 0, c: selectionRange.c1 });
          setFocusCell({ r: totalDisplayRows - 1, c: selectionRange.c2 });
        }
      } else if (e.shiftKey && e.key === " " && rowSelection) {
        e.preventDefault();
        const rangeRowIds: string[] = [];
        for (let ri = selectionRange.r1; ri <= selectionRange.r2; ri++) {
          const entry = displayEntries[ri];
          if (entry?.kind === "row") rangeRowIds.push(entry.row.id);
        }
        const allChecked = rangeRowIds.every((id) => checkedSet.has(id));
        if (allChecked) {
          const drop = new Set(rangeRowIds);
          setSelectedRowIds(selectedRowIds.filter((id) => !drop.has(id)));
        } else {
          const next = new Set(selectedRowIds);
          for (const id of rangeRowIds) next.add(id);
          setSelectedRowIds(Array.from(next));
        }
      } else if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        startEdit(clampedFocus.r, clampedFocus.c);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (
          selectionRange.r1 !== selectionRange.r2 ||
          selectionRange.c1 !== selectionRange.c2
        ) {
          setAnchor(clampedFocus);
        } else if (selectedRowIds.length > 0) {
          setSelectedRowIds([]);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        clearRange();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        fillDown();
      } else if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copyRange(false);
      } else if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        void copyRange(true);
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (!mod && !e.altKey && e.key.length === 1) {
        e.preventDefault();
        startEdit(clampedFocus.r, clampedFocus.c, e.key);
      }
    },
    [
      editing,
      maxHeight,
      rowHeight,
      startEdit,
      clampedFocus,
      moveFocus,
      totalDisplayRows,
      visibleColumns.length,
      selectionRange,
      rowSelection,
      displayEntries,
      checkedSet,
      selectedRowIds,
      setSelectedRowIds,
      clearRange,
      fillDown,
      copyRange,
      redo,
      undo,
    ],
  );

  // Totals row computations
  const computedTotals = useMemo(() => {
    const map = new Map<string, { kind: DataGridAggregate; value: number | null }>();
    for (const col of visibleColumns) {
      const kind = defaultAggregate(col);
      if (kind === "none") continue;
      if (isServer) {
        map.set(col.key, { kind, value: serverTotals?.[col.key] ?? null });
      } else {
        map.set(col.key, { kind, value: aggregate(filteredRows, col, kind) });
      }
    }
    return map;
  }, [visibleColumns, isServer, serverTotals, filteredRows]);

  // Selection stats
  const selStats = useMemo(() => {
    if (!selectionStats || totalDisplayRows === 0 || visibleColumns.length === 0) {
      return null;
    }
    const r1 = selectionRange.r1;
    const r2 = selectionRange.r2;
    const c1 = selectionRange.c1;
    const c2 = selectionRange.c2;
    const single = r1 === r2 && c1 === c2;
    const addr = single
      ? `${colLetter(c1)}${r1 + 1}`
      : `${colLetter(c1)}${r1 + 1}:${colLetter(c2)}${r2 + 1}`;

    let count = 0;
    let numCount = 0;
    let sum = 0;
    let numericCol: DataGridColumn | null = null;
    const cap = Math.min(r2, r1 + 5000);
    for (let ri = r1; ri <= cap; ri++) {
      const entry = displayEntries[ri];
      if (!entry || entry.kind !== "row") continue;
      for (let ci = c1; ci <= c2; ci++) {
        const col = visibleColumns[ci];
        if (!col) continue;
        const v = entry.row[col.key];
        if (v !== null && v !== undefined && v !== "") count++;
        if (typeof v === "number" && Number.isFinite(v)) {
          numCount++;
          sum += v;
          if (!numericCol) numericCol = col;
        }
      }
    }

    return {
      addr,
      single,
      count,
      numCount,
      sum,
      avg: numCount > 0 ? sum / numCount : 0,
      numericCol,
    };
  }, [selectionStats, totalDisplayRows, visibleColumns, selectionRange, displayEntries]);

  // Geometry for selection overlay
  const selectionRect = useMemo(() => {
    if (totalDisplayRows === 0 || visibleColumns.length === 0) return null;
    const left = colLayout.lefts[selectionRange.c1] ?? 0;
    const right =
      (colLayout.lefts[selectionRange.c2] ?? 0) + (colLayout.widths[selectionRange.c2] ?? 0);
    return {
      left,
      top: selectionRange.r1 * rowHeight,
      width: Math.max(0, right - left),
      height: (selectionRange.r2 - selectionRange.r1 + 1) * rowHeight,
    };
  }, [totalDisplayRows, visibleColumns.length, colLayout, selectionRange, rowHeight]);

  const activeRect = useMemo(() => {
    if (totalDisplayRows === 0 || visibleColumns.length === 0) return null;
    return {
      left: colLayout.lefts[clampedFocus.c] ?? 0,
      top: clampedFocus.r * rowHeight,
      width: colLayout.widths[clampedFocus.c] ?? 0,
      height: rowHeight,
    };
  }, [totalDisplayRows, visibleColumns.length, colLayout, clampedFocus, rowHeight]);

  const fillRect = useMemo(() => {
    if (!fillTarget) return null;
    const left = colLayout.lefts[fillTarget.c1] ?? 0;
    const right =
      (colLayout.lefts[fillTarget.c2] ?? 0) + (colLayout.widths[fillTarget.c2] ?? 0);
    return {
      left,
      top: fillTarget.r1 * rowHeight,
      width: Math.max(0, right - left),
      height: (fillTarget.r2 - fillTarget.r1 + 1) * rowHeight,
    };
  }, [fillTarget, colLayout, rowHeight]);

  const totalRowCount = isServer ? serverRowCount : filteredRows.length;
  const activeCellId =
    totalDisplayRows > 0 && visibleColumns.length > 0
      ? `${baseId}-${clampedFocus.r}-${clampedFocus.c}`
      : undefined;

  const hasFiltersOrSearch = activeFilterCount > 0 || search.trim().length > 0;
  const hasBulk = rowSelection && selectedRowIds.length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`${styles.root}${className ? ` ${className}` : ""}`}
        data-density={density}
        data-row-numbers={rowNumbers ? "on" : "off"}
        data-scrolled-x={scrolledX ? "true" : undefined}
        style={
          {
            "--row-h": `${rowHeight}px`,
            "--gutter-w": `${gutterWidth}px`,
          } as CSSProperties
        }
      >
        {/* Toolbar */}
        {toolbar && (
          <div className={styles.toolbar}>
            <AnimatePresence mode="wait" initial={false}>
              {hasBulk ? (
                <motion.div
                  key="bulk"
                  className={styles.toolbarRow}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                  transition={{ duration: 0.16 }}
                >
                  <span className={styles.bulkCount}>
                    <span>{selectedRowIds.length.toLocaleString()}</span>
                    <span>selected</span>
                  </span>
                  <button
                    type="button"
                    className={styles.toolButton}
                    onClick={() => setSelectedRowIds([])}
                    aria-label="Clear selection"
                  >
                    <X size={15} aria-hidden />
                    <span className={styles.toolLabel}>Clear</span>
                  </button>
                  <span className={styles.toolSpacer} />
                  <button
                    type="button"
                    className={styles.toolButton}
                    onClick={() => void copyCheckedRows()}
                    aria-label="Copy selected rows"
                  >
                    <Copy size={15} aria-hidden />
                    <span className={styles.toolLabel}>Copy</span>
                  </button>
                  <button
                    type="button"
                    className={styles.toolButton}
                    onClick={() => runExport(exportFormats[0] ?? "csv", true)}
                    aria-label="Export selected rows"
                  >
                    <Download size={15} aria-hidden />
                    <span className={styles.toolLabel}>Export</span>
                  </button>
                  {bulkActions.map((act) => (
                    <button
                      key={act.label}
                      type="button"
                      className={styles.toolButton}
                      data-tone={act.tone}
                      onClick={() => {
                        const checked = rows.filter((r) => checkedSet.has(r.id));
                        act.onAction(checked);
                      }}
                    >
                      {act.icon}
                      <span className={styles.toolLabel}>{act.label}</span>
                    </button>
                  ))}
                  {canDeleteRows && !isServer && (
                    <button
                      type="button"
                      className={styles.toolButton}
                      data-tone="danger"
                      onClick={deleteCheckedRows}
                      aria-label="Delete selected rows"
                    >
                      <Trash2 size={15} aria-hidden />
                      <span className={styles.toolLabel}>Delete</span>
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="main"
                  className={styles.toolbarRow}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                  transition={{ duration: 0.16 }}
                >
                  <label className={styles.search}>
                    <Search size={16} strokeWidth={1.75} aria-hidden />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search"
                      aria-label={`Search ${label}`}
                      spellCheck={false}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowDown") {
                          e.preventDefault();
                          gridRef.current?.focus();
                        } else if (e.key === "Escape") {
                          if (search) setSearch("");
                          else gridRef.current?.focus();
                        }
                      }}
                    />
                    {search && (
                      <button
                        type="button"
                        className={styles.searchClear}
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={13} aria-hidden />
                      </button>
                    )}
                  </label>
                  <span className={styles.rowCount} aria-live="polite">
                    {totalRowCount.toLocaleString()} {totalRowCount === 1 ? "row" : "rows"}
                  </span>
                  <span className={styles.toolSpacer} />
                  {!isServer && (
                    <span className={styles.toolGroup}>
                      <button
                        type="button"
                        className={styles.toolIcon}
                        aria-label="Undo"
                        disabled={history.past.length === 0}
                        onClick={undo}
                      >
                        <Undo2 size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={styles.toolIcon}
                        aria-label="Redo"
                        disabled={history.future.length === 0}
                        onClick={redo}
                      >
                        <Redo2 size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    className={styles.toolButton}
                    aria-pressed={showFilters}
                    aria-label="Filters"
                    onClick={() => setShowFilters((v) => !v)}
                  >
                    <Filter size={15} strokeWidth={1.75} aria-hidden />
                    <span className={styles.toolLabel}>Filter</span>
                    {activeFilterCount > 0 && (
                      <span className={styles.toolCount}>{activeFilterCount}</span>
                    )}
                  </button>

                  {/* Columns menu */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" className={styles.toolButton} aria-label="Columns">
                        <Columns3 size={15} strokeWidth={1.75} aria-hidden />
                        <span className={styles.toolLabel}>Columns</span>
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
                        <div className={styles.menuScroll}>
                          {columns.map((col) => {
                            const visible = !hiddenSet.has(col.key);
                            const isLastVisible = visible && visibleColumns.length <= 1;
                            return (
                              <DropdownMenu.Item
                                key={col.key}
                                className={styles.menuItem}
                                disabled={isLastVisible}
                                onSelect={(ev) => {
                                  ev.preventDefault();
                                  if (isLastVisible) return;
                                  if (visible) {
                                    setHiddenColumns([...hiddenColumns, col.key]);
                                  } else {
                                    setHiddenColumns(hiddenColumns.filter((k) => k !== col.key));
                                  }
                                }}
                              >
                                <span
                                  className={styles.menuCheck}
                                  data-on={visible ? "true" : undefined}
                                  aria-hidden
                                >
                                  <Check size={11} strokeWidth={2.5} />
                                </span>
                                <span className={styles.menuText}>{col.label}</span>
                              </DropdownMenu.Item>
                            );
                          })}
                        </div>
                        {hiddenColumns.length > 0 && (
                          <div className={styles.menuFooter}>
                            <button
                              type="button"
                              className={styles.menuLink}
                              onClick={() => setHiddenColumns([])}
                            >
                              Show all
                            </button>
                          </div>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>

                  {/* Density menu */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className={styles.toolButton}
                        aria-label={`Row density, ${density}`}
                      >
                        <Rows3 size={15} strokeWidth={1.75} aria-hidden />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
                        {(["compact", "standard", "comfortable"] as DataGridDensity[]).map((d) => (
                          <DropdownMenu.Item
                            key={d}
                            className={styles.menuItem}
                            data-active={density === d ? "true" : undefined}
                            onSelect={() => setDensity(d)}
                          >
                            <span className={styles.menuText} style={{ textTransform: "capitalize" }}>
                              {d}
                            </span>
                            {density === d && <Check size={14} aria-hidden />}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>

                  {/* Export */}
                  {exportFormats.length > 1 ? (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button type="button" className={styles.toolButton} aria-label="Export">
                          <Download size={15} strokeWidth={1.75} aria-hidden />
                          <span className={styles.toolLabel}>Export</span>
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
                          {exportFormats.includes("csv") && (
                            <DropdownMenu.Item
                              className={styles.menuItem}
                              onSelect={() => runExport("csv")}
                            >
                              <span className={styles.menuText}>Export CSV</span>
                              <span className={styles.menuMeta}>.csv</span>
                            </DropdownMenu.Item>
                          )}
                          {exportFormats.includes("xlsx") && (
                            <DropdownMenu.Item
                              className={styles.menuItem}
                              onSelect={() => runExport("xlsx")}
                            >
                              <span className={styles.menuText}>Export Excel</span>
                              <span className={styles.menuMeta}>.xlsx</span>
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  ) : (
                    <button
                      type="button"
                      className={styles.toolButton}
                      aria-label="Export"
                      onClick={() => runExport(exportFormats[0] ?? "csv")}
                    >
                      <Download size={15} strokeWidth={1.75} aria-hidden />
                      <span className={styles.toolLabel}>Export</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Scrollable Grid Area */}
        <div
          ref={scrollerRef}
          className={styles.scroller}
          style={{ maxHeight }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setScrollTop(el.scrollTop);
            setScrolledX(el.scrollLeft > 0);
          }}
        >
          <div
            ref={gridRef}
            className={styles.grid}
            role="grid"
            tabIndex={0}
            aria-label={label}
            aria-multiselectable="true"
            aria-rowcount={totalDisplayRows + 1 + (totals ? 1 : 0)}
            aria-colcount={visibleColumns.length + (rowSelection ? 1 : 0)}
            aria-activedescendant={activeCellId}
            aria-busy={loading || undefined}
            style={{ width: colLayout.totalWidth }}
            onKeyDown={onGridKeyDown}
            onPaste={(e) => {
              if (editing) return;
              const html = e.clipboardData.getData("text/html");
              const htmlMatrix = html ? parseHtmlTable(html) : null;
              if (htmlMatrix) {
                e.preventDefault();
                pasteMatrix(htmlMatrix);
                return;
              }
              const text = e.clipboardData.getData("text/plain");
              if (text) {
                e.preventDefault();
                pasteMatrix(parseTsv(text));
              }
            }}
          >
            {/* Sticky Header */}
            <div role="rowgroup" className={styles.head}>
              <div role="row" aria-rowindex={1} className={styles.headRow}>
                {rowSelection && (
                  <div role="columnheader" aria-colindex={1} className={styles.gutterHead}>
                    {!isServer && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={
                          selectAllState === "on"
                            ? true
                            : selectAllState === "mixed"
                              ? "mixed"
                              : false
                        }
                        aria-label="Select all rows"
                        tabIndex={0}
                        className={styles.checkbox}
                        data-state={selectAllState}
                        onClick={toggleSelectAll}
                      >
                        <span className={styles.checkboxMark} aria-hidden="true">
                          {selectAllState === "mixed" ? (
                            <Minus size={11} strokeWidth={2.5} />
                          ) : (
                            <Check size={11} strokeWidth={2.5} />
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {visibleColumns.map((col, ci) => {
                  const isPinned = ci < pinnedCount;
                  const isPinEdge = isPinned && ci === pinnedCount - 1;
                  const isNum = isNumericColumn(col.type);
                  const sortIdx = sort.findIndex((s) => s.key === col.key);
                  const sortEntry = sortIdx !== -1 ? sort[sortIdx] : null;
                  const colInRange = ci >= selectionRange.c1 && ci <= selectionRange.c2;
                  const canSort = col.sortable !== false;
                  const canFilter = col.filterable !== false;
                  const canGroup =
                    !isServer && (col.groupable ?? !isNumericColumn(col.type));
                  const isGrouped = groupBy.includes(col.key);

                  const sortAria = canSort
                    ? `${col.label}${
                        sortEntry
                          ? `, sorted ${sortEntry.dir === "asc" ? "ascending" : "descending"}${
                              sort.length > 1 ? `, priority ${sortIdx + 1}` : ""
                            }`
                          : ""
                      }. Sort, shift to add a sort key. Alt and arrow keys resize`
                    : `${col.label}. Alt and arrow keys resize`;

                  return (
                    <div
                      key={col.key}
                      role="columnheader"
                      aria-colindex={ci + (rowSelection ? 2 : 1)}
                      aria-sort={
                        sortEntry
                          ? sortEntry.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={styles.headCell}
                      data-pinned={isPinned ? "true" : undefined}
                      data-pin-edge={isPinEdge ? "true" : undefined}
                      data-selected={colInRange ? "true" : undefined}
                      data-sorted={sortEntry ? "true" : undefined}
                      data-num={isNum ? "true" : undefined}
                      style={{
                        width: colLayout.widths[ci],
                        left: isPinned ? colLayout.lefts[ci] : undefined,
                      }}
                    >
                      <button
                        type="button"
                        className={styles.sortButton}
                        disabled={!canSort}
                        aria-label={sortAria}
                        onClick={(e) => {
                          if (canSort) toggleSort(col.key, e.shiftKey);
                        }}
                        onKeyDown={(e) => {
                          if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                            e.preventDefault();
                            const cur = colWidths[col.key] ?? col.width ?? 140;
                            const minW = col.minWidth ?? 72;
                            const nextW = Math.max(
                              minW,
                              Math.min(560, cur + (e.key === "ArrowRight" ? 16 : -16)),
                            );
                            setColWidths((prev) => ({ ...prev, [col.key]: nextW }));
                          }
                        }}
                      >
                        <span className={styles.headLabel}>{col.label}</span>
                        {canSort && (
                          <span
                            className={styles.sortIcon}
                            data-dir={sortEntry?.dir}
                            aria-hidden="true"
                          >
                            <ArrowUp size={13} strokeWidth={2} />
                            {sort.length > 1 && sortEntry && (
                              <span className={styles.sortOrder}>{sortIdx + 1}</span>
                            )}
                          </span>
                        )}
                      </button>

                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            className={styles.headMenuButton}
                            aria-label={`${col.label} column options`}
                          >
                            <MoreHorizontal size={14} aria-hidden />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className={styles.menu} align="end" sideOffset={4}>
                            {canSort && (
                              <>
                                <DropdownMenu.Item
                                  className={styles.menuItem}
                                  data-active={sortEntry?.dir === "asc" ? "true" : undefined}
                                  onSelect={() => setDirectSort(col.key, "asc")}
                                >
                                  <ArrowUp size={14} aria-hidden />
                                  <span className={styles.menuText}>Sort ascending</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className={styles.menuItem}
                                  data-active={sortEntry?.dir === "desc" ? "true" : undefined}
                                  onSelect={() => setDirectSort(col.key, "desc")}
                                >
                                  <ArrowDown size={14} aria-hidden />
                                  <span className={styles.menuText}>Sort descending</span>
                                </DropdownMenu.Item>
                                {sortEntry && (
                                  <DropdownMenu.Item
                                    className={styles.menuItem}
                                    onSelect={() => setDirectSort(col.key, null)}
                                  >
                                    <X size={14} aria-hidden />
                                    <span className={styles.menuText}>Clear sort</span>
                                  </DropdownMenu.Item>
                                )}
                                <div className={styles.menuSeparator} />
                              </>
                            )}

                            {canFilter && (
                              <DropdownMenu.Item
                                className={styles.menuItem}
                                onSelect={() => setShowFilters(true)}
                              >
                                <Filter size={14} aria-hidden />
                                <span className={styles.menuText}>Filter</span>
                              </DropdownMenu.Item>
                            )}

                            {canGroup && (
                              <DropdownMenu.Item
                                className={styles.menuItem}
                                onSelect={() => {
                                  if (isGrouped) {
                                    setGroupBy(groupBy.filter((k) => k !== col.key));
                                  } else {
                                    setGroupBy([...groupBy, col.key]);
                                  }
                                }}
                              >
                                <Layers size={14} aria-hidden />
                                <span className={styles.menuText}>
                                  {isGrouped ? "Ungroup" : `Group by ${col.label}`}
                                </span>
                              </DropdownMenu.Item>
                            )}

                            <DropdownMenu.Item
                              className={styles.menuItem}
                              onSelect={() => {
                                if (isPinned) {
                                  setPinnedColumns(pinnedColumns.filter((k) => k !== col.key));
                                } else {
                                  setPinnedColumns([...pinnedColumns, col.key]);
                                }
                              }}
                            >
                              {isPinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
                              <span className={styles.menuText}>
                                {isPinned ? "Unpin column" : "Pin column"}
                              </span>
                            </DropdownMenu.Item>

                            <DropdownMenu.Item
                              className={styles.menuItem}
                              disabled={visibleColumns.length <= 1}
                              onSelect={() => {
                                if (visibleColumns.length <= 1) return;
                                setHiddenColumns([...hiddenColumns, col.key]);
                              }}
                            >
                              <EyeOff size={14} aria-hidden />
                              <span className={styles.menuText}>Hide column</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>

                      <div
                        className={styles.resizer}
                        data-active={resizingKey === col.key ? "true" : undefined}
                        aria-hidden="true"
                        onPointerDown={(e) => onResizeStart(col, e)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Filter Row */}
              {showFilters && (
                <div role="row" className={styles.filterRow}>
                  {rowSelection && (
                    <div className={styles.gutterHead}>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          className={styles.clearFilters}
                          aria-label="Clear all filters"
                          onClick={() => setFilters({})}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                  )}

                  {visibleColumns.map((col, ci) => {
                    const isPinned = ci < pinnedCount;
                    const isPinEdge = isPinned && ci === pinnedCount - 1;
                    const isNum = isNumericColumn(col.type);
                    const rawFilter = filters[col.key];

                    if (col.filterable === false) {
                      return (
                        <div
                          key={col.key}
                          className={styles.filterCell}
                          data-pinned={isPinned ? "true" : undefined}
                          data-pin-edge={isPinEdge ? "true" : undefined}
                          style={{
                            width: colLayout.widths[ci],
                            left: isPinned ? colLayout.lefts[ci] : undefined,
                          }}
                        />
                      );
                    }

                    if (col.type === "select") {
                      const opts = columnOptionsMap.get(col.key) ?? [];
                      const selected = Array.isArray(rawFilter) ? rawFilter : [];
                      const active = selected.length > 0;
                      return (
                        <div
                          key={col.key}
                          className={styles.filterCell}
                          data-pinned={isPinned ? "true" : undefined}
                          data-pin-edge={isPinEdge ? "true" : undefined}
                          style={{
                            width: colLayout.widths[ci],
                            left: isPinned ? colLayout.lefts[ci] : undefined,
                          }}
                        >
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <button
                                type="button"
                                className={styles.filterSelect}
                                data-active={active ? "true" : undefined}
                                aria-label={`Filter ${col.label}`}
                              >
                                <span className={styles.filterSelectText}>
                                  {active ? `${selected.length} selected` : "All"}
                                </span>
                                <ChevronDown size={12} aria-hidden />
                              </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content className={styles.menu} align="start" sideOffset={4}>
                                <div
                                  className={styles.menuScroll}
                                  role="group"
                                  aria-label={`Filter ${col.label} options`}
                                >
                                  {opts.map((opt) => {
                                    const on = selected.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        className={styles.menuItem}
                                        onClick={() => {
                                          const nextList = on
                                            ? selected.filter((v) => v !== opt)
                                            : [...selected, opt];
                                          setFilters({ ...filters, [col.key]: nextList });
                                        }}
                                      >
                                        <span
                                          className={styles.menuCheck}
                                          data-on={on ? "true" : undefined}
                                          aria-hidden
                                        >
                                          <Check size={11} strokeWidth={2.5} />
                                        </span>
                                        <span className={styles.menuText}>{opt}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {active && (
                                  <div className={styles.menuFooter}>
                                    <button
                                      type="button"
                                      className={styles.menuLink}
                                      onClick={() => setFilters({ ...filters, [col.key]: [] })}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                )}
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                        </div>
                      );
                    }

                    const val = typeof rawFilter === "string" ? rawFilter : "";
                    const invalid =
                      val.trim().length > 0 &&
                      ((isNum && numberFilter(val) === "invalid") ||
                        (col.type === "date" && dateFilter(val) === "invalid"));

                    return (
                      <div
                        key={col.key}
                        className={styles.filterCell}
                        data-pinned={isPinned ? "true" : undefined}
                        data-pin-edge={isPinEdge ? "true" : undefined}
                        style={{
                          width: colLayout.widths[ci],
                          left: isPinned ? colLayout.lefts[ci] : undefined,
                        }}
                      >
                        <input
                          className={styles.filterInput}
                          value={val}
                          onChange={(e) =>
                            setFilters({ ...filters, [col.key]: e.target.value })
                          }
                          placeholder={
                            isNum ? ">100 or 10..50" : col.type === "date" ? "2026-03" : "Filter…"
                          }
                          aria-label={
                            isNum
                              ? `Filter ${col.label}. Supports >100, >=100, <5, !=0, or 10..50`
                              : `Filter ${col.label}`
                          }
                          aria-invalid={invalid || undefined}
                          data-num={isNum ? "true" : undefined}
                          data-active={val.trim().length > 0 ? "true" : undefined}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "ArrowDown") {
                              e.preventDefault();
                              gridRef.current?.focus();
                            } else if (e.key === "Escape") {
                              if (val) setFilters({ ...filters, [col.key]: "" });
                              else gridRef.current?.focus();
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Body */}
            <div
              role="rowgroup"
              className={styles.body}
              data-moving={moving ? "true" : undefined}
              data-any-checked={selectedRowIds.length > 0 ? "true" : undefined}
              style={{ height: loading ? 6 * rowHeight : Math.max(bodyHeight, totalDisplayRows === 0 ? 200 : 0) }}
            >
              {loading ? (
                Array.from({ length: 6 }).map((_, ri) => (
                  <div
                    key={`skel-${ri}`}
                    role="row"
                    className={styles.row}
                    style={{ transform: `translateY(${ri * rowHeight}px)` }}
                  >
                    {rowSelection && <div className={styles.gutter} />}
                    {visibleColumns.map((col, ci) => (
                      <div
                        key={col.key}
                        role="gridcell"
                        className={styles.cell}
                        style={{ width: colLayout.widths[ci] }}
                      >
                        <span
                          className={styles.skeleton}
                          style={{ width: `${45 + ((ri * 19 + ci * 13) % 40)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                ))
              ) : totalDisplayRows === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>
                    {hasFiltersOrSearch ? "No rows match" : emptyMessage}
                  </p>
                  {hasFiltersOrSearch && (
                    <button
                      type="button"
                      className={styles.toolButton}
                      onClick={() => {
                        setFilters({});
                        setSearch("");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {mountedRowIndices.map((ri) => {
                    const entry = displayEntries[ri];
                    if (!entry) return null;

                    if (entry.kind === "placeholder") {
                      return (
                        <div
                          key={entry.id}
                          role="row"
                          aria-rowindex={ri + 2}
                          className={styles.row}
                          style={{ transform: `translateY(${ri * rowHeight}px)` }}
                        >
                          {rowSelection && (
                            <div className={styles.gutter}>
                              <span className={styles.rowNumber}>{ri + 1}</span>
                            </div>
                          )}
                          {visibleColumns.map((col, ci) => (
                            <div
                              key={col.key}
                              role="gridcell"
                              className={styles.cell}
                              style={{ width: colLayout.widths[ci] }}
                            >
                              <span className={styles.skeleton} style={{ width: "60%" }} />
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (entry.kind === "group") {
                      const expanded = !collapsedGroups.has(entry.id);
                      return (
                        <div
                          key={entry.id}
                          role="row"
                          aria-rowindex={ri + 2}
                          className={styles.row}
                          data-group-row="true"
                          style={{ transform: `translateY(${ri * rowHeight}px)` }}
                        >
                          {rowSelection && <div className={styles.gutter} />}
                          {visibleColumns.map((col, ci) => {
                            const isPinned = ci < pinnedCount;
                            const isPinEdge = isPinned && ci === pinnedCount - 1;
                            const isNum = isNumericColumn(col.type);
                            const aggKind = defaultAggregate(col);
                            const subVal =
                              ci > 0 && aggKind !== "none"
                                ? aggregate(entry.rows, col, aggKind)
                                : null;

                            return (
                              <div
                                key={col.key}
                                id={`${baseId}-${ri}-${ci}`}
                                role="gridcell"
                                aria-colindex={ci + (rowSelection ? 2 : 1)}
                                className={styles.cell}
                                data-pinned={isPinned ? "true" : undefined}
                                data-pin-edge={isPinEdge ? "true" : undefined}
                                data-num={isNum ? "true" : undefined}
                                style={{
                                  width: colLayout.widths[ci],
                                  left: isPinned ? colLayout.lefts[ci] : undefined,
                                }}
                              >
                                {ci === 0 ? (
                                  <button
                                    type="button"
                                    className={styles.groupToggle}
                                    aria-expanded={expanded}
                                    style={{ paddingLeft: 4 + entry.depth * 14 }}
                                    onClick={() => {
                                      setCollapsedGroups((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entry.id)) next.delete(entry.id);
                                        else next.add(entry.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    <ChevronRight size={14} className={styles.groupChevron} aria-hidden />
                                    <span
                                      className={styles.groupLabel}
                                      data-empty={entry.label === "(Empty)" ? "true" : undefined}
                                    >
                                      {entry.label}
                                    </span>
                                    <span className={styles.groupCount}>{entry.rows.length}</span>
                                  </button>
                                ) : subVal !== null ? (
                                  <span className={styles.value}>
                                    {aggKind === "count"
                                      ? subVal.toLocaleString("en-US")
                                      : formatNumberValue(subVal, col, true)}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    // Normal data row
                    const row = entry.row;
                    const isChecked = checkedSet.has(row.id);
                    const rowInRange = ri >= selectionRange.r1 && ri <= selectionRange.r2;
                    const rowIsEditing = editing?.r === ri;
                    const firstColVal =
                      visibleColumns[0] ? String(row[visibleColumns[0].key] ?? row.id) : row.id;

                    return (
                      <div
                        key={row.id}
                        role="row"
                        aria-rowindex={ri + 2}
                        aria-selected={isChecked}
                        className={styles.row}
                        data-checked={isChecked ? "true" : undefined}
                        data-editing={rowIsEditing ? "true" : undefined}
                        style={{ transform: `translateY(${ri * rowHeight}px)` }}
                      >
                        {rowSelection && (
                          <div
                            role="gridcell"
                            aria-colindex={1}
                            className={styles.gutter}
                            data-in-range={rowInRange ? "true" : undefined}
                          >
                            <span className={styles.rowNumber} aria-hidden="true">
                              {entry.dataIndex + 1}
                            </span>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              aria-label={`Select ${firstColVal}`}
                              tabIndex={-1}
                              className={styles.checkbox}
                              data-state={isChecked ? "on" : "off"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowCheck(row.id);
                              }}
                            >
                              <span className={styles.checkboxMark} aria-hidden="true">
                                <Check size={11} strokeWidth={2.5} />
                              </span>
                            </button>
                          </div>
                        )}

                        {visibleColumns.map((col, ci) => {
                          const isPinned = ci < pinnedCount;
                          const isPinEdge = isPinned && ci === pinnedCount - 1;
                          const isNum = isNumericColumn(col.type);
                          const isSelected =
                            ri >= selectionRange.r1 &&
                            ri <= selectionRange.r2 &&
                            ci >= selectionRange.c1 &&
                            ci <= selectionRange.c2;
                          const isEditingCell =
                            editing !== null && editing.r === ri && editing.c === ci;
                          const readOnly = isServer || col.editable === false;

                          const selectOptions =
                            isEditingCell && col.type === "select"
                              ? (columnOptionsMap.get(col.key) ?? []).filter((o) =>
                                  editing.replaceMode
                                    ? o.toLowerCase().includes(editing.draft.toLowerCase())
                                    : true,
                                )
                              : [];

                          return (
                            <div
                              key={col.key}
                              id={`${baseId}-${ri}-${ci}`}
                              role="gridcell"
                              aria-colindex={ci + (rowSelection ? 2 : 1)}
                              aria-selected={isSelected}
                              aria-readonly={readOnly || undefined}
                              className={styles.cell}
                              data-pinned={isPinned ? "true" : undefined}
                              data-pin-edge={isPinEdge ? "true" : undefined}
                              data-num={isNum ? "true" : undefined}
                              data-editing={isEditingCell ? "true" : undefined}
                              style={{
                                width: colLayout.widths[ci],
                                left: isPinned ? colLayout.lefts[ci] : undefined,
                              }}
                              onPointerDown={(e) => onCellPointerDown(ri, ci, e)}
                              onDoubleClick={() => startEdit(ri, ci)}
                            >
                              {isEditingCell ? (
                                <>
                                  <input
                                    ref={editorInputRef}
                                    className={styles.editor}
                                    value={editing.draft}
                                    role={col.type === "select" ? "combobox" : undefined}
                                    aria-label={`${col.label} for ${firstColVal}`}
                                    aria-invalid={editing.invalid || undefined}
                                    aria-expanded={
                                      col.type === "select" ? editing.popupOpen : undefined
                                    }
                                    aria-controls={
                                      col.type === "select" ? `${baseId}-listbox` : undefined
                                    }
                                    aria-activedescendant={
                                      col.type === "select" && editing.popupOpen && selectOptions[editing.optionIndex]
                                        ? `${baseId}-opt-${editing.optionIndex}`
                                        : undefined
                                    }
                                    onChange={(e) =>
                                      setEditing((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              draft: e.target.value,
                                              invalid: false,
                                              optionIndex: 0,
                                            }
                                          : null,
                                      )
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (editing.popupOpen && (col.type === "select" || col.type === "date")) {
                                          setEditing((prev) => (prev ? { ...prev, popupOpen: false } : null));
                                        } else {
                                          cancelEdit();
                                        }
                                      } else if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (
                                          col.type === "select" &&
                                          editing.popupOpen &&
                                          selectOptions[editing.optionIndex]
                                        ) {
                                          commitEdit(selectOptions[editing.optionIndex], {
                                            dr: e.shiftKey ? -1 : 1,
                                            dc: 0,
                                          });
                                        } else {
                                          commitEdit(undefined, {
                                            dr: e.shiftKey ? -1 : 1,
                                            dc: 0,
                                          });
                                        }
                                      } else if (e.key === "Tab") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (
                                          col.type === "select" &&
                                          editing.popupOpen &&
                                          selectOptions[editing.optionIndex]
                                        ) {
                                          commitEdit(selectOptions[editing.optionIndex], {
                                            dr: 0,
                                            dc: e.shiftKey ? -1 : 1,
                                          });
                                        } else {
                                          commitEdit(undefined, {
                                            dr: 0,
                                            dc: e.shiftKey ? -1 : 1,
                                          });
                                        }
                                      } else if (
                                        col.type === "select" &&
                                        (e.key === "ArrowDown" || e.key === "ArrowUp")
                                      ) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!editing.popupOpen) {
                                          setEditing((prev) => (prev ? { ...prev, popupOpen: true } : null));
                                        } else if (selectOptions.length > 0) {
                                          setEditing((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  optionIndex:
                                                    e.key === "ArrowDown"
                                                      ? (prev.optionIndex + 1) % selectOptions.length
                                                      : (prev.optionIndex - 1 + selectOptions.length) %
                                                        selectOptions.length,
                                                }
                                              : null,
                                          );
                                        }
                                      } else if (
                                        editing.replaceMode &&
                                        (e.key === "ArrowDown" ||
                                          e.key === "ArrowUp" ||
                                          e.key === "ArrowLeft" ||
                                          e.key === "ArrowRight")
                                      ) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const dr =
                                          e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
                                        const dc =
                                          e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                                        commitEdit(undefined, { dr, dc });
                                      } else if (e.altKey && e.key === "ArrowDown") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditing((prev) => (prev ? { ...prev, popupOpen: true } : null));
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const nextFocus = e.relatedTarget as HTMLElement | null;
                                      if (nextFocus && e.currentTarget.parentElement?.contains(nextFocus)) {
                                        return;
                                      }
                                      commitEdit();
                                    }}
                                  />

                                  {col.type === "select" && editing.popupOpen && (
                                    <div
                                      id={`${baseId}-listbox`}
                                      role="listbox"
                                      className={styles.options}
                                      data-up={ri > visibleEnd - 5 ? "true" : undefined}
                                      onPointerDown={(e) => e.preventDefault()}
                                    >
                                      {selectOptions.length === 0 ? (
                                        <div className={styles.optionEmpty}>No matches</div>
                                      ) : (
                                        selectOptions.map((opt, oi) => (
                                          <div
                                            key={opt}
                                            id={`${baseId}-opt-${oi}`}
                                            role="option"
                                            aria-selected={opt === String(row[col.key] ?? "")}
                                            className={styles.option}
                                            data-active={oi === editing.optionIndex ? "true" : undefined}
                                            data-current={
                                              opt === String(row[col.key] ?? "") ? "true" : undefined
                                            }
                                            onClick={() => commitEdit(opt)}
                                          >
                                            {opt}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}

                                  {col.type === "date" && editing.popupOpen && (
                                    <CalendarPopup
                                      value={editing.draft}
                                      onSelect={(iso) => commitEdit(iso)}
                                      onClose={() =>
                                        setEditing((prev) =>
                                          prev ? { ...prev, popupOpen: false } : null,
                                        )
                                      }
                                    />
                                  )}
                                </>
                              ) : (
                                <span className={styles.value}>
                                  {format(row[col.key], col)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Selection, Active Cell, and Fill Preview Overlays */}
                  {selectionRect && (
                    <div
                      className={styles.selection}
                      data-editing={editing ? "true" : undefined}
                      style={{
                        transform: `translate3d(${selectionRect.left}px, ${selectionRect.top}px, 0)`,
                        width: selectionRect.width,
                        height: selectionRect.height,
                      }}
                    >
                      {!editing && !isServer && (
                        <div
                          className={styles.fillHandle}
                          onPointerDown={onFillHandlePointerDown}
                        />
                      )}
                    </div>
                  )}

                  {activeRect && (
                    <div
                      className={styles.activeCell}
                      style={{
                        transform: `translate3d(${activeRect.left}px, ${activeRect.top}px, 0)`,
                        width: activeRect.width,
                        height: activeRect.height,
                      }}
                    />
                  )}

                  {fillRect && (
                    <div
                      className={styles.fillPreview}
                      style={{
                        transform: `translate3d(${fillRect.left}px, ${fillRect.top}px, 0)`,
                        width: fillRect.width,
                        height: fillRect.height,
                      }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Sticky Totals Row */}
            {totals && !loading && (
              <div role="rowgroup" className={styles.foot}>
                <div
                  role="row"
                  aria-rowindex={totalDisplayRows + 2}
                  className={styles.totalsRow}
                >
                  {rowSelection && (
                    <div role="gridcell" aria-colindex={1} className={styles.gutterHead} />
                  )}
                  {visibleColumns.map((col, ci) => {
                    const isPinned = ci < pinnedCount;
                    const isPinEdge = isPinned && ci === pinnedCount - 1;
                    const isNum = isNumericColumn(col.type);
                    const totalInfo = computedTotals.get(col.key);

                    if (ci === 0 && !totalInfo) {
                      const txt = `${totalRowCount.toLocaleString()} ${totalRowCount === 1 ? "row" : "rows"}`;
                      return (
                        <div
                          key={col.key}
                          role="gridcell"
                          aria-colindex={ci + (rowSelection ? 2 : 1)}
                          className={styles.totalCell}
                          data-pinned={isPinned ? "true" : undefined}
                          data-pin-edge={isPinEdge ? "true" : undefined}
                          aria-label={txt}
                          style={{
                            width: colLayout.widths[ci],
                            left: isPinned ? colLayout.lefts[ci] : undefined,
                          }}
                        >
                          <span className={styles.totalLabel}>{txt}</span>
                        </div>
                      );
                    }

                    const fullFormatted =
                      totalInfo && totalInfo.value !== null
                        ? totalInfo.kind === "count"
                          ? totalInfo.value.toLocaleString("en-US")
                          : formatNumberValue(totalInfo.value, col, false)
                        : null;
                    const compactFormatted =
                      totalInfo && totalInfo.value !== null
                        ? totalInfo.kind === "count"
                          ? totalInfo.value.toLocaleString("en-US")
                          : formatNumberValue(
                              totalInfo.value,
                              { ...col, decimals: col.type === "percent" ? Math.max(1, col.decimals ?? 1) : col.decimals },
                              true,
                            )
                        : null;

                    return (
                      <div
                        key={col.key}
                        role="gridcell"
                        aria-colindex={ci + (rowSelection ? 2 : 1)}
                        className={styles.totalCell}
                        data-pinned={isPinned ? "true" : undefined}
                        data-pin-edge={isPinEdge ? "true" : undefined}
                        data-num={isNum ? "true" : undefined}
                        aria-label={
                          totalInfo && fullFormatted
                            ? `${col.label} ${totalInfo.kind} ${fullFormatted}`
                            : undefined
                        }
                        style={{
                          width: colLayout.widths[ci],
                          left: isPinned ? colLayout.lefts[ci] : undefined,
                        }}
                      >
                        {totalInfo && compactFormatted && (
                          <>
                            <span className={styles.totalLabel} aria-hidden="true">
                              {aggLabel(totalInfo.kind)}
                            </span>
                            <span className={styles.totalValue} aria-hidden="true">
                              {compactFormatted}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        {(selectionStats || statusMsg) && (
          <div
            className={styles.statusBar}
            data-stats={selectionStats ? "on" : "off"}
          >
            {selectionStats && selStats && (
              <>
                <span className={styles.address}>{selStats.addr}</span>
                {!selStats.single && (
                  <span className={styles.stats}>
                    <span className={styles.stat}>
                      <span className={styles.statLabel}>Count</span>
                      <span className={styles.statValue}>
                        {selStats.count.toLocaleString("en-US")}
                      </span>
                    </span>
                    {selStats.numCount > 0 && selStats.numericCol && (
                      <>
                        <span className={styles.stat}>
                          <span className={styles.statLabel}>Sum</span>
                          <span className={styles.statValue}>
                            {formatNumberValue(selStats.sum, selStats.numericCol, false)}
                          </span>
                        </span>
                        <span className={styles.stat}>
                          <span className={styles.statLabel}>Average</span>
                          <span className={styles.statValue}>
                            {formatNumberValue(
                              selStats.avg,
                              { ...selStats.numericCol, decimals: 1 },
                              false,
                            )}
                          </span>
                        </span>
                      </>
                    )}
                  </span>
                )}
              </>
            )}

            <div className={styles.status} aria-live="polite">
              <AnimatePresence mode="wait">
                {statusMsg && (
                  <motion.span
                    key={statusMsg.id}
                    className={styles.statusText}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                  >
                    <span>{statusMsg.text}</span>
                    {statusMsg.canUndo && history.past.length > 0 && (
                      <button
                        type="button"
                        className={styles.statusAction}
                        onClick={undo}
                      >
                        Undo
                      </button>
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
