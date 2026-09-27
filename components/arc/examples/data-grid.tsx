"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Download,
  Filter,
  Redo2,
  Rows3,
  Search,
  Undo2,
} from "lucide-react";
import { motionTokens, cx } from "../tokens";
import styles from "./data-grid.module.css";

type Row = {
  id: number;
  account: string;
  owner: string;
  plan: "Starter" | "Team" | "Business" | "Enterprise";
  seats: number;
  arr: number;
  health: number;
  renews: string;
};
type Key = keyof Omit<Row, "id">;
type Density = "compact" | "standard" | "comfortable";

const ROW_COUNT = 10_000;
const prefixes = ["North", "Blue", "Quiet", "Bright", "Iron", "Maple", "Harbor", "Cedar", "Signal", "Lumen", "Atlas", "Juniper"];
const suffixes = ["Labs", "Works", "Studio", "Systems", "Supply", "Health", "Logistics", "Foods", "Capital", "Robotics"];
const owners = ["Ava Chen", "Marcus Hill", "Priya Nair", "Leo Park", "Sofia Ruiz", "Noah Brooks", "Maya Singh", "Eli Carter"];
const plans: Row["plan"][] = ["Starter", "Team", "Business", "Enterprise"];

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

const ROWS: Row[] = Array.from({ length: ROW_COUNT }, (_, i) => {
  const plan = plans[Math.floor(rand(i + 3) * 4)];
  const seats = Math.round((plans.indexOf(plan) + 1) ** 2 * 18 * (0.3 + rand(i + 7)));
  const month = 1 + Math.floor(rand(i + 11) * 12);
  const day = 1 + Math.floor(rand(i + 13) * 28);
  return {
    id: i + 1,
    account: `${prefixes[Math.floor(rand(i) * prefixes.length)]} ${suffixes[Math.floor(rand(i + 1) * suffixes.length)]} ${i + 1}`,
    owner: owners[Math.floor(rand(i + 2) * owners.length)],
    plan,
    seats,
    arr: seats * (120 + plans.indexOf(plan) * 140),
    health: Math.round(35 + rand(i + 5) * 64),
    renews: `2027-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
});

const columns: { key: Key; label: string; numeric?: boolean; width: number }[] = [
  { key: "account", label: "Account", width: 220 },
  { key: "owner", label: "Owner", width: 140 },
  { key: "plan", label: "Plan", width: 110 },
  { key: "seats", label: "Seats", numeric: true, width: 90 },
  { key: "arr", label: "ARR", numeric: true, width: 120 },
  { key: "health", label: "Health", numeric: true, width: 110 },
  { key: "renews", label: "Renews", width: 120 },
];

const rowHeight: Record<Density, number> = { compact: 30, standard: 38, comfortable: 48 };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

type State = {
  query: string;
  plan: Row["plan"] | "all";
  sort: { key: Key; dir: 1 | -1 } | null;
  hidden: Key[];
  density: Density;
};

const initial: State = { query: "", plan: "all", sort: null, hidden: [], density: "standard" };

export function DataGrid() {
  const [history, setHistory] = useState<{ stack: State[]; index: number }>({ stack: [initial], index: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [cell, setCell] = useState({ row: 0, col: 0 });
  const [panel, setPanel] = useState<"filters" | "columns" | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const state = history.stack[history.index];

  const update = (patch: Partial<State>) =>
    setHistory(({ stack, index }) => {
      const next = [...stack.slice(0, index + 1), { ...stack[index], ...patch }];
      return { stack: next, index: next.length - 1 };
    });

  const visibleColumns = columns.filter((c) => !state.hidden.includes(c.key));
  const rows = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    let out = ROWS.filter(
      (r) =>
        (state.plan === "all" || r.plan === state.plan) &&
        (!q || r.account.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)),
    );
    if (state.sort) {
      const { key, dir } = state.sort;
      out = [...out].sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
    }
    return out;
  }, [state.query, state.plan, state.sort]);

  const totals = useMemo(() => {
    const seats = rows.reduce((s, r) => s + r.seats, 0);
    const arr = rows.reduce((s, r) => s + r.arr, 0);
    const health = rows.length ? rows.reduce((s, r) => s + r.health, 0) / rows.length : 0;
    return { seats, arr, health };
  }, [rows]);

  const h = rowHeight[state.density];
  const viewportHeight = 360;
  const start = Math.max(0, Math.floor(scrollTop / h) - 6);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / h) + 6);

  const format = (key: Key, row: Row) =>
    key === "arr" ? money.format(row.arr) : key === "health" ? `${row.health}%` : key === "seats" ? row.seats.toLocaleString("en-US") : row[key];

  const exportCsv = () => {
    const header = visibleColumns.map((c) => c.label).join(",");
    const body = rows.map((r) => visibleColumns.map((c) => JSON.stringify(r[c.key])).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "renewals.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveTo = (row: number, col: number) => {
    const r = Math.min(rows.length - 1, Math.max(0, row));
    const c = Math.min(visibleColumns.length - 1, Math.max(0, col));
    setCell({ row: r, col: c });
    const el = viewport.current;
    if (!el) return;
    const top = r * h;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + h > el.scrollTop + el.clientHeight - h) el.scrollTop = top - el.clientHeight + h * 2;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const page = Math.floor(viewportHeight / h);
    const map: Record<string, [number, number]> = {
      ArrowDown: [cell.row + 1, cell.col],
      ArrowUp: [cell.row - 1, cell.col],
      ArrowLeft: [cell.row, cell.col - 1],
      ArrowRight: [cell.row, cell.col + 1],
      PageDown: [cell.row + page, cell.col],
      PageUp: [cell.row - page, cell.col],
      Home: [event.ctrlKey ? 0 : cell.row, 0],
      End: [event.ctrlKey ? rows.length - 1 : cell.row, visibleColumns.length - 1],
    };
    if (!(event.key in map)) return;
    event.preventDefault();
    moveTo(...map[event.key]);
  };

  const toggleSort = (key: Key) => {
    const s = state.sort;
    update({ sort: s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null });
  };

  const densities: Density[] = ["compact", "standard", "comfortable"];
  const template = visibleColumns.map((c) => `minmax(${c.width}px, 1fr)`).join(" ");
  const cellName = `${String.fromCharCode(65 + cell.col)}${cell.row + 1}`;

  return (
    <div className={styles.grid}>
      <div className={styles.toolbar}>
        <p className={styles.title}>Renewals</p>
        <label className={styles.search}>
          <Search size={14} aria-hidden />
          <input
            type="search"
            placeholder="Search"
            aria-label="Search Renewals"
            value={state.query}
            onChange={(e) => {
              update({ query: e.target.value });
              setCell({ row: 0, col: cell.col });
            }}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" aria-label="Undo" disabled={history.index === 0} onClick={() => setHistory((x) => ({ ...x, index: x.index - 1 }))}>
            <Undo2 size={15} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={history.index === history.stack.length - 1}
            onClick={() => setHistory((x) => ({ ...x, index: x.index + 1 }))}
          >
            <Redo2 size={15} aria-hidden />
          </button>
          <span className={styles.popWrap}>
            <button type="button" aria-label="Filters" aria-expanded={panel === "filters"} onClick={() => setPanel(panel === "filters" ? null : "filters")}>
              <Filter size={15} aria-hidden /> <span className={styles.btnLabel}>Filters</span>{state.plan !== "all" && <span className={styles.dot} />}
            </button>
            <AnimatePresence>
              {panel === "filters" && (
                <motion.div className={styles.pop} role="radiogroup" aria-label="Plan" {...popMotion}>
                  {(["all", ...plans] as const).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={state.plan === p} onClick={() => update({ plan: p })}>
                      {p === "all" ? "All plans" : p}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </span>
          <span className={styles.popWrap}>
            <button type="button" aria-label="Columns" aria-expanded={panel === "columns"} onClick={() => setPanel(panel === "columns" ? null : "columns")}>
              <Columns3 size={15} aria-hidden /> <span className={styles.btnLabel}>Columns</span>
            </button>
            <AnimatePresence>
              {panel === "columns" && (
                <motion.div className={styles.pop} {...popMotion}>
                  {columns.map((c) => (
                    <label key={c.key}>
                      <input
                        type="checkbox"
                        checked={!state.hidden.includes(c.key)}
                        disabled={c.key === "account"}
                        onChange={() =>
                          update({
                            hidden: state.hidden.includes(c.key) ? state.hidden.filter((k) => k !== c.key) : [...state.hidden, c.key],
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </span>
          <button
            type="button"
            aria-label={`Row density, ${state.density}`}
            onClick={() => update({ density: densities[(densities.indexOf(state.density) + 1) % densities.length] })}
          >
            <Rows3 size={15} aria-hidden />
          </button>
          <button type="button" aria-label="Export CSV" onClick={exportCsv}>
            <Download size={15} aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={viewport}
        className={styles.viewport}
        style={{ height: viewportHeight }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div
          role="grid"
          aria-label="Renewals"
          aria-rowcount={rows.length + 1}
          aria-colcount={visibleColumns.length}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setPanel(null)}
          className={styles.table}
        >
          <div role="row" aria-rowindex={1} className={cx(styles.row, styles.head)} style={{ gridTemplateColumns: template }}>
            {visibleColumns.map((c) => {
              const sorted = state.sort?.key === c.key ? state.sort.dir : 0;
              return (
                <div
                  key={c.key}
                  role="columnheader"
                  aria-sort={sorted === 1 ? "ascending" : sorted === -1 ? "descending" : "none"}
                  className={cx(styles.cell, c.numeric && styles.numeric)}
                >
                  <button type="button" tabIndex={-1} onClick={() => toggleSort(c.key)}>
                    {c.label}
                    {sorted === 1 && <ArrowUp size={12} aria-hidden />}
                    {sorted === -1 && <ArrowDown size={12} aria-hidden />}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ height: rows.length * h, position: "relative" }}>
            {rows.slice(start, end).map((row, i) => {
              const r = start + i;
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={r + 2}
                  aria-selected={cell.row === r}
                  className={styles.row}
                  style={{ gridTemplateColumns: template, height: h, transform: `translateY(${r * h}px)` }}
                >
                  {visibleColumns.map((c, ci) => (
                    <div
                      key={c.key}
                      role="gridcell"
                      aria-colindex={ci + 1}
                      className={cx(
                        styles.cell,
                        c.numeric && styles.numeric,
                        cell.row === r && cell.col === ci && styles.active,
                      )}
                      onPointerDown={() => setCell({ row: r, col: ci })}
                    >
                      {c.key === "health" ? (
                        <span className={styles.health}>
                          <span className={styles.meter}>
                            <span style={{ width: `${row.health}%`, background: row.health < 50 ? "var(--danger)" : row.health < 70 ? "var(--warning)" : "var(--success)" }} />
                          </span>
                          {format(c.key, row)}
                        </span>
                      ) : c.key === "plan" ? (
                        <span className={styles.plan} data-plan={row.plan}>
                          {row.plan}
                        </span>
                      ) : (
                        format(c.key, row)
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span>
          {rows.length.toLocaleString("en-US")} rows · Selection {cellName}
        </span>
        <span>
          Seats sum <strong>{totals.seats.toLocaleString("en-US")}</strong>
        </span>
        <span>
          ARR sum <strong>{compactMoney.format(totals.arr)}</strong>
        </span>
        <span>
          Health avg <strong>{totals.health.toFixed(1)}%</strong>
        </span>
      </div>
    </div>
  );
}

const popMotion = {
  initial: { opacity: 0, y: -4, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.97 },
  transition: motionTokens.spring.snappy,
};
