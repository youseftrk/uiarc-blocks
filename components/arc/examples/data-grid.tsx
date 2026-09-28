"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUp,
  Check,
  ChevronDown,
  Columns3,
  Download,
  EyeOff,
  FilterX,
  ListFilter,
  Pin,
  PinOff,
  Redo2,
  RotateCcw,
  Rows3,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatedCounter } from "../animated-counter";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { cx } from "../tokens";
import styles from "./data-grid.module.css";

/* ---------------------------------- Data ---------------------------------- */

type Row = {
  id: number;
  account: string;
  owner: string;
  region: string;
  stage: string;
  seats: number;
  arr: number;
  health: number;
  renews: string;
};
type ColKey = keyof Omit<Row, "id">;
type Density = "compact" | "standard" | "comfortable";
type Dir = "asc" | "desc";
type Sort = { key: ColKey; dir: Dir };

type Column = {
  key: ColKey;
  label: string;
  width: number;
  kind: "text" | "enum" | "number";
  options?: readonly string[];
  agg?: "sum" | "avg";
  format?: (v: number) => string;
};

const ROW_COUNT = 10_000;
const prefixes = [
  "Northwind", "Lumen", "Cedar", "Brightline", "Harbor", "Pinecrest", "Atlas", "Summit", "Fieldstone", "Crescent",
  "Tidewater", "Vantage", "Copper Creek", "Granite", "Willow", "Aspen", "Moorland", "Quiet", "Signal", "Maple",
  "Juniper", "Iron", "Blue Ridge", "Meridian", "Sable",
];
const suffixes = ["Freight", "Health", "Labs", "Credit Union", "Foods", "Robotics", "Energy", "Studio", "Logistics", "Analytics"];
const owners = ["Owen Park", "Tyler Hayes", "Marcus Johnson", "Daniel Kim", "Noah Bennett", "Sofia Álvarez", "Ryan Sullivan", "Priya Raman"];
const regions = ["North America", "Europe", "Asia Pacific", "Latin America"] as const;
const stages = ["Discovery", "Proposal", "Negotiation", "Committed", "Closed won", "Closed lost"] as const;
const rates = [240, 300, 360, 420];

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

const START = Date.UTC(2026, 8, 1);
const SPAN = Date.UTC(2027, 8, 30) - START;

const ROWS: Row[] = Array.from({ length: ROW_COUNT }, (_, i) => {
  const seats = 10 + 5 * Math.floor(rand(i + 3) ** 1.6 * 158);
  const rate = rates[Math.floor(rand(i + 5) * rates.length)];
  return {
    id: i + 1,
    account: `${prefixes[i % prefixes.length]} ${suffixes[Math.floor(i / prefixes.length) % suffixes.length]}`,
    owner: owners[Math.floor(rand(i + 1) * owners.length)],
    region: regions[Math.floor(rand(i + 2) * regions.length)],
    stage: stages[Math.floor(rand(i + 4) * stages.length)],
    seats,
    arr: seats * rate,
    health: 30 + Math.floor(rand(i + 6) * 70),
    renews: new Date(START + Math.floor(rand(i + 7) * SPAN)).toISOString().slice(0, 10),
  };
});

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function compactParts(n: number): { value: number; suffix: string; decimals: number } {
  const abs = Math.abs(n);
  if (abs >= 1e9) return { value: n / 1e9, suffix: "B", decimals: 1 };
  if (abs >= 1e6) return { value: n / 1e6, suffix: "M", decimals: 1 };
  if (abs >= 1e3) return { value: n / 1e3, suffix: "K", decimals: 1 };
  return { value: n, suffix: "", decimals: 0 };
}

const selectionSpring = { type: "spring", stiffness: 640, damping: 42, mass: 0.6 } as const;

const columns: Column[] = [
  { key: "account", label: "Account", width: 188, kind: "text" },
  { key: "owner", label: "Owner", width: 148, kind: "text" },
  { key: "region", label: "Region", width: 144, kind: "enum", options: regions },
  { key: "stage", label: "Stage", width: 132, kind: "enum", options: stages },
  { key: "seats", label: "Seats", width: 96, kind: "number", agg: "sum", format: (v) => v.toLocaleString("en-US") },
  { key: "arr", label: "ARR", width: 128, kind: "number", agg: "sum", format: (v) => money.format(v) },
  { key: "health", label: "Health", width: 104, kind: "number", agg: "avg", format: (v) => `${v}%` },
  { key: "renews", label: "Renews", width: 124, kind: "text" },
];
const byKey = Object.fromEntries(columns.map((c) => [c.key, c])) as Record<ColKey, Column>;

const SEL_WIDTH = 48;
const HEAD_HEIGHT = 39;
const FILTER_HEIGHT = 39;
const SUM_HEIGHT = 40;
const rowHeights: Record<Density, number> = { compact: 32, standard: 40, comfortable: 48 };

/* --------------------------------- State ---------------------------------- */

type GridState = {
  query: string;
  filters: Partial<Record<ColKey, string>>;
  sorts: Sort[];
  hidden: ColKey[];
  pinned: ColKey[];
  density: Density;
};

const initialState: GridState = { query: "", filters: {}, sorts: [], hidden: [], pinned: ["account"], density: "standard" };
const initialWidths = Object.fromEntries(columns.map((c) => [c.key, c.width])) as Record<ColKey, number>;

function matchesNumber(expr: string, value: number) {
  const s = expr.trim();
  if (!s) return true;
  const range = s.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/);
  if (range) return value >= Number(range[1]) && value <= Number(range[2]);
  const cmp = s.match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!cmp) return true;
  const n = Number(cmp[2]);
  switch (cmp[1]) {
    case ">":
      return value > n;
    case "<":
      return value < n;
    case ">=":
      return value >= n;
    case "<=":
      return value <= n;
    default:
      return value === n;
  }
}

const ENUM_SEP = "|";
const NONE = "\u0000";

function enumSelection(col: Column, expr: string | undefined): string[] {
  if (!expr) return [...(col.options ?? [])];
  if (expr === NONE) return [];
  return expr.split(ENUM_SEP);
}

function enumLabel(col: Column, selected: string[]): string {
  const total = col.options?.length ?? 0;
  if (selected.length === total) return "All";
  if (selected.length === 0) return "None";
  if (selected.length === 1) return selected[0];
  return `${selected.length} of ${total}`;
}

function matches(row: Row, key: ColKey, expr: string) {
  const col = byKey[key];
  const v = row[key];
  if (col.kind === "number") return typeof v === "number" && matchesNumber(expr, v);
  if (col.kind === "enum") return !expr || (expr !== NONE && expr.split(ENUM_SEP).includes(String(v)));
  return String(v).toLowerCase().includes(expr.trim().toLowerCase());
}

const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);

/* -------------------------------- Component ------------------------------- */

export function DataGrid() {
  const [history, setHistory] = useState<{ stack: GridState[]; index: number }>({ stack: [initialState], index: 0 });
  const state = history.stack[history.index];
  const [widths, setWidths] = useState(initialWidths);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [extent, setExtent] = useState<{ row: number; col: number } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const viewport = useRef<HTMLDivElement>(null);
  const gridEl = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const filterInputs = useRef<Partial<Record<ColKey, HTMLInputElement | HTMLButtonElement | null>>>({});
  const pendingFocus = useRef<ColKey | null>(null);

  const commit = (patch: Partial<GridState>) =>
    setHistory(({ stack, index }) => {
      const next = { ...stack[index], ...patch };
      const trimmed = [...stack.slice(0, index + 1), next];
      return { stack: trimmed, index: trimmed.length - 1 };
    });
  const undo = () => setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
  const redo = () => setHistory((h) => ({ ...h, index: Math.min(h.stack.length - 1, h.index + 1) }));
  const isInitial = state === initialState && widths === initialWidths && !filtersOpen;
  const reset = () => {
    setHistory({ stack: [initialState], index: 0 });
    setWidths(initialWidths);
    setFiltersOpen(false);
    setChecked(new Set());
    setActive({ row: 0, col: 0 });
    setExtent(null);
  };

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = useMemo(() => {
    const shown = columns.filter((c) => !state.hidden.includes(c.key));
    return [...shown.filter((c) => state.pinned.includes(c.key)), ...shown.filter((c) => !state.pinned.includes(c.key))];
  }, [state.hidden, state.pinned]);

  const lefts = useMemo(() => {
    let x = SEL_WIDTH;
    const out: Partial<Record<ColKey, number>> = {};
    for (const c of visible) {
      if (!state.pinned.includes(c.key)) break;
      out[c.key] = x;
      x += widths[c.key];
    }
    return out;
  }, [visible, state.pinned, widths]);

  const rows = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const activeFilters = (Object.entries(state.filters) as [ColKey, string][]).filter(([, v]) => v.trim());
    let out = ROWS.filter(
      (r) =>
        (!q || r.account.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q) || r.region.toLowerCase().includes(q) || r.stage.toLowerCase().includes(q)) &&
        activeFilters.every(([k, v]) => matches(r, k, v)),
    );
    if (state.sorts.length) {
      out = [...out].sort((a, b) => {
        for (const { key, dir } of state.sorts) {
          const av = a[key];
          const bv = b[key];
          const d = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          if (d) return dir === "asc" ? d : -d;
        }
        return a.id - b.id;
      });
    }
    return out;
  }, [state.query, state.filters, state.sorts]);

  const aggregates = useMemo(() => {
    const out: Partial<Record<ColKey, number>> = {};
    for (const c of columns) {
      if (!c.agg) continue;
      const total = rows.reduce((s, r) => s + (r[c.key] as number), 0);
      out[c.key] = c.agg === "sum" ? total : rows.length ? total / rows.length : 0;
    }
    return out;
  }, [rows]);

  const h = rowHeights[state.density];
  const tableWidth = SEL_WIDTH + visible.reduce((s, c) => s + widths[c.key], 0);
  const chromeTop = HEAD_HEIGHT + (filtersOpen ? FILTER_HEIGHT : 0);
  const bodyHeight = Math.max(0, viewportHeight - chromeTop - SUM_HEIGHT);
  const first = Math.max(0, Math.floor(scrollTop / h) - 4);
  const last = Math.min(rows.length, Math.ceil((scrollTop + bodyHeight) / h) + 4);

  const clampRow = (r: number) => Math.min(Math.max(0, rows.length - 1), Math.max(0, r));
  const clampCol = (c: number) => Math.min(visible.length - 1, Math.max(0, c));

  const colLeft = (ci: number) => SEL_WIDTH + visible.slice(0, ci).reduce((sum, c) => sum + widths[c.key], 0);

  const scrollCellIntoView = (r: number, ci: number) => {
    const el = viewport.current;
    if (!el) return;
    const top = r * h;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + h > el.scrollTop + bodyHeight) el.scrollTop = top + h - bodyHeight;
    const col = visible[ci];
    if (!col || lefts[col.key] !== undefined) return;
    const frozen = SEL_WIDTH + Object.keys(lefts).reduce((sum, k) => sum + widths[k as ColKey], 0);
    const left = colLeft(ci);
    const right = left + widths[col.key];
    if (left < el.scrollLeft + frozen) el.scrollLeft = left - frozen;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  };

  const moveTo = (row: number, col: number, extend: boolean) => {
    const next = { row: clampRow(row), col: clampCol(col) };
    if (extend) setExtent(next);
    else {
      setExtent(null);
      setActive(next);
    }
    scrollCellIntoView(next.row, next.col);
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const page = Math.max(1, Math.floor(bodyHeight / h));
    const cur = event.shiftKey ? (extent ?? active) : active;
    const moves: Record<string, [number, number]> = {
      ArrowDown: [cur.row + 1, cur.col],
      ArrowUp: [cur.row - 1, cur.col],
      ArrowLeft: [cur.row, cur.col - 1],
      ArrowRight: [cur.row, cur.col + 1],
      PageDown: [cur.row + page, cur.col],
      PageUp: [cur.row - page, cur.col],
      Home: [event.ctrlKey || event.metaKey ? 0 : cur.row, 0],
      End: [event.ctrlKey || event.metaKey ? rows.length - 1 : cur.row, visible.length - 1],
    };
    if (event.key in moves) {
      event.preventDefault();
      moveTo(...moves[event.key], event.shiftKey);
    } else if (event.key === " ") {
      event.preventDefault();
      const row = rows[active.row];
      if (row) toggleChecked(row.id);
    } else if (event.key === "Escape") {
      setExtent(null);
    } else if (event.key === "a" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setActive({ row: 0, col: 0 });
      setExtent({ row: rows.length - 1, col: visible.length - 1 });
    }
  };

  const toggleChecked = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const someChecked = !allChecked && rows.some((r) => checked.has(r.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const setSort = (key: ColKey, dir: Dir | null, additive = false) => {
    const rest = state.sorts.filter((s) => s.key !== key);
    if (!dir) return commit({ sorts: rest });
    commit({ sorts: additive ? [...rest, { key, dir }] : [{ key, dir }] });
  };
  const cycleSort = (key: ColKey, additive: boolean) => {
    const current = state.sorts.find((s) => s.key === key);
    setSort(key, !current ? "asc" : current.dir === "asc" ? "desc" : null, additive);
  };
  const togglePin = (key: ColKey) =>
    commit({ pinned: state.pinned.includes(key) ? state.pinned.filter((k) => k !== key) : [...state.pinned, key] });
  const toggleHidden = (key: ColKey) =>
    commit({ hidden: state.hidden.includes(key) ? state.hidden.filter((k) => k !== key) : [...state.hidden, key] });
  const openFilterFor = (key: ColKey) => {
    pendingFocus.current = key;
    if (!filtersOpen) setFiltersOpen(true);
  };
  const focusPendingFilter = (event: Event) => {
    const key = pendingFocus.current;
    if (!key) return;
    event.preventDefault();
    pendingFocus.current = null;
    requestAnimationFrame(() => filterInputs.current[key]?.focus());
  };

  const startResize = (key: ColKey) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widths[key];
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const onMove = (e: PointerEvent) => setWidths((w) => ({ ...w, [key]: Math.max(72, Math.round(startWidth + e.clientX - startX)) }));
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  const onHeaderKeyDown = (key: ColKey) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    setWidths((w) => ({ ...w, [key]: Math.max(72, w[key] + (event.key === "ArrowRight" ? 16 : -16)) }));
  };

  const exportCsv = () => {
    const header = visible.map((c) => c.label).join(",");
    const body = rows.map((r) => visible.map((c) => JSON.stringify(r[c.key])).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "renewals.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* selection summary */
  const range = extent
    ? {
        r0: Math.min(extent.row, active.row),
        r1: Math.max(extent.row, active.row),
        c0: Math.min(extent.col, active.col),
        c1: Math.max(extent.col, active.col),
      }
    : { r0: active.row, r1: active.row, c0: active.col, c1: active.col };
  const inRange = (r: number, c: number) => r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
  const selectionBox = {
    x: colLeft(range.c0),
    y: range.r0 * h,
    width: colLeft(range.c1 + 1) - colLeft(range.c0),
    height: (range.r1 - range.r0 + 1) * h,
  };
  const activeBox = { x: colLeft(active.col), y: active.row * h, width: widths[visible[active.col]?.key ?? "account"] ?? 0, height: h };
  const hasRows = rows.length > 0 && visible.length > 0;
  const overPinned = (c0: number, c1: number) => visible.slice(c0, c1 + 1).every((c) => lefts[c.key] !== undefined);
  const selectionPinned = overPinned(range.c0, range.c1);
  const activePinned = overPinned(active.col, active.col);
  const selectionLabel =
    range.r0 === range.r1 && range.c0 === range.c1
      ? `${colLetter(range.c0)}${range.r0 + 1}`
      : `${colLetter(range.c0)}${range.r0 + 1}:${colLetter(range.c1)}${range.r1 + 1}`;
  const summary = useMemo(() => {
    const count = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
    const cols = visible.slice(range.c0, range.c1 + 1);
    if (!rows.length) return { count: 0 };
    if (!cols.length || !cols.every((c) => c.kind === "number") || count < 2) return { count };
    let sum = 0;
    for (let r = range.r0; r <= Math.min(range.r1, rows.length - 1); r++) for (const c of cols) sum += rows[r][c.key] as number;
    return { count, sum, avg: sum / count };
  }, [range.r0, range.r1, range.c0, range.c1, visible, rows]);

  const filterCount = Object.values(state.filters).filter((v) => v?.trim()).length;
  const rowCountLabel =
    rows.length === ROW_COUNT ? `${ROW_COUNT.toLocaleString("en-US")} rows` : `${rows.length.toLocaleString("en-US")} of ${ROW_COUNT.toLocaleString("en-US")} rows`;

  const cellStyle = (c: Column): CSSProperties => ({
    width: widths[c.key],
    ...(lefts[c.key] !== undefined ? { position: "sticky", left: lefts[c.key], zIndex: 2 } : {}),
  });
  const pinnedClass = (c: Column) => (lefts[c.key] !== undefined ? styles.pinnedCell : undefined);

  return (
    <div className={styles.wrap} style={{ "--row-h": `${h}px` } as CSSProperties}>
      <div className={styles.head}>
        <h3>Renewals</h3>
        <button type="button" className={styles.reset} disabled={isInitial} onClick={reset}>
          <RotateCcw size={16} aria-hidden />
          Reset
        </button>
      </div>

      <div className={styles.frame}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} aria-hidden />
            <input
              type="text"
              placeholder="Search"
              aria-label="Search Renewals"
              value={state.query}
              onChange={(e) => {
                commit({ query: e.target.value });
                setActive({ row: 0, col: active.col });
                setExtent(null);
              }}
            />
            {state.query && (
              <button type="button" aria-label="Clear search" className={styles.clear} onClick={() => commit({ query: "" })}>
                <X size={14} aria-hidden />
              </button>
            )}
          </label>
          <span className={styles.count}>{rowCountLabel}</span>
          <span className={styles.spacer} />
          <span className={styles.history}>
            <IconButton label="Undo" disabled={history.index === 0} onClick={undo}>
              <Undo2 size={16} aria-hidden />
            </IconButton>
            <IconButton label="Redo" disabled={history.index === history.stack.length - 1} onClick={redo}>
              <Redo2 size={16} aria-hidden />
            </IconButton>
          </span>
          <span className={styles.divider} aria-hidden />
          <button
            type="button"
            className={cx(styles.tool, filtersOpen && styles.toolOn)}
            aria-label="Filters"
            aria-pressed={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <ListFilter size={16} aria-hidden />
            <span className={styles.toolLabel}>Filter</span>
            {filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
          </button>

          <Menu.Root modal={false}>
            <Menu.Trigger asChild>
              <button type="button" className={styles.tool} aria-label="Columns">
                <Columns3 size={16} aria-hidden />
                <span className={styles.toolLabel}>Columns</span>
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={10}>
                {columns.map((c) => {
                  const pinned = state.pinned.includes(c.key);
                  return (
                    <Menu.CheckboxItem
                      key={c.key}
                      className={styles.checkItem}
                      checked={!state.hidden.includes(c.key)}
                      onCheckedChange={() => toggleHidden(c.key)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <span className={styles.checkbox} data-checked={!state.hidden.includes(c.key) || undefined}>
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                      {c.label}
                      {pinned && <Pin size={13} className={styles.pinMark} aria-label="Pinned" />}
                    </Menu.CheckboxItem>
                  );
                })}
                <Menu.Separator className={styles.separator} />
                <Menu.Item className={cx(styles.item, styles.itemMuted)} disabled={!state.hidden.length} onSelect={() => commit({ hidden: [] })}>
                  Show all columns
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>

          <Menu.Root modal={false}>
            <Menu.Trigger asChild>
              <button type="button" className={styles.tool} aria-label={`Row density, ${state.density}`}>
                <Rows3 size={16} aria-hidden />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={10}>
                <Menu.RadioGroup value={state.density} onValueChange={(v) => commit({ density: v as Density })}>
                  {(["compact", "standard", "comfortable"] as Density[]).map((d) => (
                    <Menu.RadioItem key={d} value={d} className={styles.item}>
                      <Rows3 size={16} aria-hidden className={styles.itemIcon} />
                      <span className={styles.itemText}>{d[0].toUpperCase() + d.slice(1)}</span>
                      <Menu.ItemIndicator>
                        <Check size={14} aria-hidden />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>

          <button type="button" className={styles.tool} aria-label="Export CSV" onClick={exportCsv}>
            <Download size={16} aria-hidden />
            <span className={styles.toolLabel}>Export</span>
          </button>
        </div>

        <div ref={viewport} className={styles.viewport} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
          <div
            ref={gridEl}
            role="grid"
            aria-label="Renewals"
            aria-rowcount={rows.length + 1}
            aria-colcount={visible.length + 1}
            aria-multiselectable
            tabIndex={0}
            className={styles.table}
            style={{ width: tableWidth }}
            onKeyDown={onGridKeyDown}
          >
            <div role="row" aria-rowindex={1} className={styles.headRow}>
              <div role="columnheader" className={cx(styles.selCell, styles.headSel)} style={{ width: SEL_WIDTH }}>
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  label={allChecked ? "Deselect all rows" : "Select all rows"}
                  onChange={toggleAll}
                />
              </div>
              {visible.map((c) => {
                const sort = state.sorts.find((s) => s.key === c.key);
                const sortIndex = state.sorts.length > 1 ? state.sorts.indexOf(sort as Sort) + 1 : 0;
                const pinned = state.pinned.includes(c.key);
                return (
                  <div
                    key={c.key}
                    role="columnheader"
                    aria-sort={sort ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cx(styles.headCell, c.kind === "number" && styles.num, pinned && styles.pinnedHead, pinnedClass(c))}
                    style={cellStyle(c)}
                  >
                    <button
                      type="button"
                      className={styles.sortButton}
                      aria-label={`${c.label}. Sort, shift to add a sort key. Alt and arrow keys resize`}
                      onClick={(e) => cycleSort(c.key, e.shiftKey)}
                      onKeyDown={onHeaderKeyDown(c.key)}
                    >
                      {sort && c.kind === "number" && <SortIcon dir={sort.dir} index={sortIndex} />}
                      <span className={styles.headLabel}>{c.label}</span>
                      {sort && c.kind !== "number" && <SortIcon dir={sort.dir} index={sortIndex} />}
                    </button>
                    <Menu.Root modal={false}>
                      <Menu.Trigger asChild>
                        <button type="button" className={styles.colMenuButton} aria-label={`${c.label} column options`}>
                          <ChevronDown size={14} aria-hidden />
                        </button>
                      </Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Content className={styles.menu} align="start" sideOffset={6} collisionPadding={10} onCloseAutoFocus={focusPendingFilter}>
                          <Menu.Item className={styles.item} onSelect={() => setSort(c.key, "asc")}>
                            <ArrowDownAZ size={16} aria-hidden className={styles.itemIcon} />
                            Sort ascending
                          </Menu.Item>
                          <Menu.Item className={styles.item} onSelect={() => setSort(c.key, "desc")}>
                            <ArrowDownZA size={16} aria-hidden className={styles.itemIcon} />
                            Sort descending
                          </Menu.Item>
                          <Menu.Separator className={styles.separator} />
                          <Menu.Item className={styles.item} onSelect={() => openFilterFor(c.key)}>
                            <ListFilter size={16} aria-hidden className={styles.itemIcon} />
                            Filter
                          </Menu.Item>
                          <Menu.Item className={styles.item} onSelect={() => togglePin(c.key)}>
                            {pinned ? <PinOff size={16} aria-hidden className={styles.itemIcon} /> : <Pin size={16} aria-hidden className={styles.itemIcon} />}
                            {pinned ? "Unpin column" : "Pin column"}
                          </Menu.Item>
                          <Menu.Item className={styles.item} disabled={visible.length === 1} onSelect={() => toggleHidden(c.key)}>
                            <EyeOff size={16} aria-hidden className={styles.itemIcon} />
                            Hide column
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Portal>
                    </Menu.Root>
                    <div className={styles.resizer} onPointerDown={startResize(c.key)} aria-hidden />
                  </div>
                );
              })}
            </div>

            {filtersOpen && (
              <div role="row" className={styles.filterRow} style={{ top: HEAD_HEIGHT }}>
                <div className={cx(styles.selCell, styles.filterSel)} style={{ width: SEL_WIDTH }}>
                  <IconButton label="Clear filters" disabled={filterCount === 0} onClick={() => commit({ filters: {} })}>
                    <FilterX size={15} aria-hidden />
                  </IconButton>
                </div>
                {visible.map((c) => (
                  <div key={c.key} className={cx(styles.filterCell, pinnedClass(c))} style={cellStyle(c)}>
                    {c.kind === "enum" ? (
                      (() => {
                        const selected = enumSelection(c, state.filters[c.key]);
                        const options = [...(c.options ?? [])];
                        const setSelected = (next: string[]) =>
                          commit({
                            filters: {
                              ...state.filters,
                              [c.key]: next.length === options.length ? "" : next.length === 0 ? NONE : next.join(ENUM_SEP),
                            },
                          });
                        return (
                          <Popover modal={false}>
                            <PopoverTrigger
                              ref={(el) => {
                                filterInputs.current[c.key] = el;
                              }}
                              className={cx(styles.enumTrigger, selected.length !== options.length && styles.enumOn)}
                              aria-label={`Filter ${c.label}`}
                            >
                              <span className={styles.enumLabel}>{enumLabel(c, selected)}</span>
                              <ChevronDown size={14} aria-hidden />
                            </PopoverTrigger>
                            <PopoverContent className={styles.enumMenu} align="start" sideOffset={4}>
                              <div className={styles.enumList}>
                                {options.map((o) => {
                                  const on = selected.includes(o);
                                  return (
                                    <label key={o} className={styles.enumItem}>
                                      <Checkbox
                                        checked={on}
                                        label={o}
                                        onChange={() => setSelected(on ? selected.filter((v) => v !== o) : options.filter((v) => v === o || selected.includes(v)))}
                                      />
                                      <span>{o}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <div className={styles.enumFooter}>
                                <button type="button" className={styles.enumAction} disabled={selected.length === options.length} onClick={() => setSelected(options)}>
                                  Select all
                                </button>
                                <button type="button" className={styles.enumAction} disabled={selected.length === 0} onClick={() => setSelected([])}>
                                  Clear
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })()
                    ) : (
                      <input
                        ref={(el) => {
                          filterInputs.current[c.key] = el;
                        }}
                        type="text"
                        aria-label={c.kind === "number" ? `Filter ${c.label}. Use > < = or a range like 10..50` : `Filter ${c.label}`}
                        placeholder={c.kind === "number" ? "> 100, 10..50" : "Contains"}
                        className={cx(c.kind === "number" && styles.num)}
                        value={state.filters[c.key] ?? ""}
                        onChange={(e) => commit({ filters: { ...state.filters, [c.key]: e.target.value } })}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div role="rowgroup" className={styles.body} style={{ height: rows.length * h }}>
              {rows.slice(first, last).map((row, i) => {
                const r = first + i;
                const isChecked = checked.has(row.id);
                const isActiveRow = r === active.row;
                return (
                  <div
                    key={row.id}
                    role="row"
                    aria-rowindex={r + 2}
                    aria-selected={isChecked}
                    className={cx(styles.row, isChecked && styles.rowChecked)}
                    style={{ top: r * h, height: h }}
                  >
                    <div role="gridcell" className={cx(styles.selCell, isActiveRow && styles.selCellActive)} style={{ width: SEL_WIDTH }}>
                      <span className={styles.rowIndex} aria-hidden>
                        {r + 1}
                      </span>
                      <Checkbox checked={isChecked} label={`Select ${row.account}`} onChange={() => toggleChecked(row.id)} />
                    </div>
                    {visible.map((c, ci) => {
                      const value = row[c.key];
                      return (
                        <div
                          key={c.key}
                          role="gridcell"
                          aria-colindex={ci + 2}
                          aria-selected={inRange(r, ci) || undefined}
                          className={cx(
                            styles.cell,
                            c.kind === "number" && styles.num,
                            c.key === "account" && styles.strong,
                            pinnedClass(c),
                          )}
                          style={cellStyle(c)}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            gridEl.current?.focus({ preventScroll: true });
                            dragging.current = true;
                            if (e.shiftKey) setExtent({ row: r, col: ci });
                            else {
                              setExtent(null);
                              setActive({ row: r, col: ci });
                            }
                          }}
                          onPointerEnter={() => {
                            if (!dragging.current) return;
                            setExtent({ row: r, col: ci });
                          }}
                        >
                          <span className={styles.cellText}>{typeof value === "number" && c.format ? c.format(value) : value}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {hasRows &&
                (() => {
                  const selectionEl = (
                    <motion.div
                      className={styles.selection}
                      aria-hidden
                      initial={false}
                      animate={selectionBox}
                      transition={selectionSpring}
                      data-multi={range.r0 !== range.r1 || range.c0 !== range.c1 || undefined}
                    >
                      <span
                        className={styles.fillHandle}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          gridEl.current?.focus({ preventScroll: true });
                          dragging.current = true;
                          setActive({ row: range.r0, col: range.c0 });
                          setExtent({ row: range.r1, col: range.c1 });
                        }}
                      />
                    </motion.div>
                  );
                  const activeEl = <motion.div className={styles.activeCell} aria-hidden initial={false} animate={activeBox} transition={selectionSpring} />;
                  return (
                    <>
                      <div className={styles.pinnedLayer} aria-hidden>
                        {selectionPinned && selectionEl}
                        {activePinned && activeEl}
                      </div>
                      {!selectionPinned && selectionEl}
                      {!activePinned && activeEl}
                    </>
                  );
                })()}
              {rows.length === 0 && <div className={styles.empty}>No rows match. Try a different search or clear a filter.</div>}
            </div>

            <div role="row" className={styles.sumRow}>
              <div className={cx(styles.selCell, styles.sumSel)} style={{ width: SEL_WIDTH }} />
              {visible.map((c, i) => (
                <div key={c.key} role="gridcell" className={cx(styles.sumCell, c.kind === "number" && styles.num, pinnedClass(c))} style={cellStyle(c)}>
                  {i === 0 && !c.agg ? (
                    <span className={styles.sumMuted}>{rowCountLabel}</span>
                  ) : c.agg ? (
                    <>
                      <span className={styles.sumMuted}>{c.agg === "sum" ? "Sum" : "Avg"}</span>
                      <strong>
                        {c.key === "health" ? (
                          <AnimatedCounter value={Math.round(aggregates[c.key] ?? 0)} suffix="%" />
                        ) : (
                          (() => {
                            const parts = compactParts(aggregates[c.key] ?? 0);
                            return <AnimatedCounter value={parts.value} prefix={c.key === "arr" ? "$" : ""} suffix={parts.suffix} decimals={parts.decimals} />;
                          })()
                        )}
                      </strong>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.status}>
          <span className={styles.address} aria-label={`Selection ${selectionLabel}`}>
            {selectionLabel}
          </span>
          {summary.sum !== undefined && (
            <>
              <span className={styles.stat}>
                <span className={styles.statLabel}>Sum</span>
                <strong>
                  <AnimatedCounter value={Math.round(summary.sum)} />
                </strong>
              </span>
              <span className={styles.stat}>
                <span className={styles.statLabel}>Average</span>
                <strong>
                  <AnimatedCounter value={summary.avg ?? 0} decimals={1} />
                </strong>
              </span>
            </>
          )}
          <span className={styles.stat}>
            <span className={styles.statLabel}>Count</span>
            <strong>
              <AnimatedCounter value={summary.count} />
            </strong>
          </span>
          <span className={styles.spacer} />
          {checked.size > 0 && (
            <span className={styles.stat}>
              <strong>{checked.size.toLocaleString("en-US")}</strong>
              <span className={styles.statLabel}>selected</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Partials -------------------------------- */

function SortIcon({ dir, index }: { dir: Dir; index: number }) {
  return (
    <span className={styles.sortIcon}>
      {dir === "asc" ? <ArrowUp size={11} strokeWidth={2.5} aria-hidden /> : <ArrowDown size={11} strokeWidth={2.5} aria-hidden />}
      {index > 0 && <sup>{index}</sup>}
    </span>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx(styles.tool, styles.iconOnly)} aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Checkbox({ checked, indeterminate, label, onChange }: { checked: boolean; indeterminate?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      data-state={checked ? "on" : indeterminate ? "mixed" : "off"}
      className={styles.check}
      onClick={onChange}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className={styles.checkbox} data-checked={checked || indeterminate || undefined}>
        {indeterminate && !checked ? <span className={styles.mixed} /> : <Check size={12} strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
}
