import type { ReactNode } from "react";

export type DataGridValue = string | number | null;

export interface DataGridRow {
  id: string;
  [key: string]: DataGridValue;
}

export interface DataGridSort {
  key: string;
  dir: "asc" | "desc";
}

export type DataGridFilters = Record<string, string | string[]>;

export type DataGridColumnType =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "select"
  | "date";

export type DataGridAggregate =
  | "sum"
  | "average"
  | "min"
  | "max"
  | "count"
  | "none";

export type DataGridDensity = "compact" | "standard" | "comfortable";

export type DataGridExportFormat = "csv" | "xlsx";

export type DataGridExportNode =
  | DataGridRow
  | { label: string; children: DataGridExportNode[] };

export interface DataGridColumn {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  type?: DataGridColumnType;
  dateFormat?: Intl.DateTimeFormatOptions;
  decimals?: number;
  editable?: boolean;
  options?: string[];
  pinned?: boolean;
  hidden?: boolean;
  aggregate?: DataGridAggregate;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
}

export interface DataGridBulkAction {
  label: string;
  icon?: ReactNode;
  tone?: "danger";
  onAction: (rows: DataGridRow[]) => void;
}

export interface DataGridRowsRequest {
  start: number;
  end: number;
  sort: DataGridSort[];
  filters: DataGridFilters;
  search: string;
  signal: AbortSignal;
}

export interface DataGridRowsResult {
  rows: DataGridRow[];
  rowCount: number;
  totals?: Record<string, number | null>;
}

export interface DataGridDataSource {
  getRows: (request: DataGridRowsRequest) => Promise<DataGridRowsResult>;
  blockSize?: number;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  label: string;
  rows?: DataGridRow[];
  defaultRows?: DataGridRow[];
  onRowsChange?: (rows: DataGridRow[]) => void;
  maxHeight?: number;
  sort?: DataGridSort[];
  defaultSort?: DataGridSort[];
  onSortChange?: (sort: DataGridSort[]) => void;
  filters?: DataGridFilters;
  defaultFilters?: DataGridFilters;
  onFiltersChange?: (filters: DataGridFilters) => void;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;
  hiddenColumns?: string[];
  defaultHiddenColumns?: string[];
  onHiddenColumnsChange?: (keys: string[]) => void;
  pinnedColumns?: string[];
  defaultPinnedColumns?: string[];
  onPinnedColumnsChange?: (keys: string[]) => void;
  density?: DataGridDensity;
  defaultDensity?: DataGridDensity;
  onDensityChange?: (density: DataGridDensity) => void;
  rowSelection?: boolean;
  rowNumbers?: boolean;
  selectionStats?: boolean;
  toolbar?: boolean;
  totals?: boolean;
  groupBy?: string[];
  defaultGroupBy?: string[];
  onGroupByChange?: (keys: string[]) => void;
  exportFormats?: DataGridExportFormat[];
  dataSource?: DataGridDataSource;
  bulkActions?: DataGridBulkAction[];
  canDeleteRows?: boolean;
  exportFileName?: string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const MINUS = "\u2212";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  return d >= 1 && d <= daysInMonth(y, mo);
}

export function parseDay(text: string): string | null {
  const s = text.trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/M/D
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)) {
      return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
    }
    return null;
  }

  // Reject ambiguous all-number forms like 01/02/2026
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) return null;

  // "Jan 31, 2026" or "Jan 31 2026"
  const mdy = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (mdy) {
    const mo = MONTHS[mdy[1].toLowerCase()];
    const d = Number(mdy[2]);
    const y = Number(mdy[3]);
    if (mo && d >= 1 && d <= daysInMonth(y, mo)) {
      return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
    }
    return null;
  }

  // "31 January 2026"
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(s);
  if (dmy) {
    const d = Number(dmy[1]);
    const mo = MONTHS[dmy[2].toLowerCase()];
    const y = Number(dmy[3]);
    if (mo && d >= 1 && d <= daysInMonth(y, mo)) {
      return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
    }
    return null;
  }

  return null;
}

const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function formatDay(
  iso: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isIsoDay(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    ...(options ?? DEFAULT_DATE_FORMAT),
    timeZone: "UTC",
  }).format(dt);
}

export function isNumericColumn(type?: DataGridColumnType): boolean {
  return type === "number" || type === "currency" || type === "percent";
}

export function defaultAggregate(column: DataGridColumn): DataGridAggregate {
  if (column.aggregate) return column.aggregate;
  if (column.type === "number" || column.type === "currency") return "sum";
  if (column.type === "percent") return "average";
  return "none";
}

export function formatNumberValue(
  num: number,
  column: DataGridColumn,
  compact = false,
): string {
  const decimals = column.decimals ?? 0;
  const neg = num < 0;
  const abs = Math.abs(num);

  let body: string;
  if (compact && abs >= 1_000_000) {
    body = `${(abs / 1_000_000).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M`;
  } else if (compact && abs >= 100_000) {
    body = `${(abs / 1_000).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}K`;
  } else {
    body = abs.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const sign = neg ? MINUS : "";
  if (column.type === "currency") return `${sign}$${body}`;
  if (column.type === "percent") return `${sign}${body}%`;
  return `${sign}${body}`;
}

export function format(
  value: DataGridValue | undefined,
  column: DataGridColumn,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (column.type === "date") {
    return typeof value === "string" ? formatDay(value, column.dateFormat) : String(value);
  }
  if (isNumericColumn(column.type)) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return String(value);
    return formatNumberValue(n, column, false);
  }
  return String(value);
}

export function parse(
  text: string,
  column: DataGridColumn,
  options?: string[],
): { ok: true; value: DataGridValue } | { ok: false } {
  const trimmed = text.trim();
  const type = column.type ?? "text";

  if (type === "text") {
    return { ok: true, value: text };
  }

  if (trimmed === "") {
    if (isNumericColumn(type)) return { ok: true, value: null };
    return { ok: true, value: "" };
  }

  if (type === "date") {
    const iso = parseDay(trimmed);
    if (!iso) return { ok: false };
    return { ok: true, value: iso };
  }

  if (type === "select") {
    const list = options ?? column.options ?? [];
    if (list.length === 0) return { ok: true, value: trimmed };
    const found = list.find((o) => o.toLowerCase() === trimmed.toLowerCase());
    if (!found) return { ok: false };
    return { ok: true, value: found };
  }

  // Numeric: number | currency | percent
  let raw = trimmed.replace(/\u2212/g, "-");
  let negative = false;
  if (raw.startsWith("(") && raw.endsWith(")")) {
    negative = true;
    raw = raw.slice(1, -1).trim();
  }
  raw = raw.replace(/[$,%\s]/g, "");
  if (!raw || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(raw)) {
    return { ok: false };
  }
  let num = Number(raw);
  if (!Number.isFinite(num)) return { ok: false };
  if (negative && num > 0) num = -num;
  return { ok: true, value: num };
}

export function numberFilter(
  expression: string,
): ((value: number) => boolean) | null | "invalid" {
  const s = expression.trim();
  if (!s) return null;

  const parseNum = (part: string): number | null => {
    const clean = part.trim().replace(/\u2212/g, "-").replace(/[$,%\s]/g, "");
    if (!clean || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  };

  const rangeIdx = s.indexOf("..");
  if (rangeIdx !== -1) {
    const left = s.slice(0, rangeIdx).trim();
    const right = s.slice(rangeIdx + 2).trim();
    const lo = left ? parseNum(left) : null;
    const hi = right ? parseNum(right) : null;
    if ((left && lo === null) || (right && hi === null) || (lo === null && hi === null)) {
      return "invalid";
    }
    return (v: number) =>
      (lo === null || v >= lo) && (hi === null || v <= hi);
  }

  const opMatch = /^(>=|<=|!=|>|<|=)\s*(.+)$/.exec(s);
  if (opMatch) {
    const op = opMatch[1];
    const n = parseNum(opMatch[2]);
    if (n === null) return "invalid";
    switch (op) {
      case ">":
        return (v) => v > n;
      case ">=":
        return (v) => v >= n;
      case "<":
        return (v) => v < n;
      case "<=":
        return (v) => v <= n;
      case "!=":
        return (v) => v !== n;
      case "=":
        return (v) => v === n;
    }
  }

  const exact = parseNum(s);
  if (exact === null) return "invalid";
  return (v) => v === exact;
}

function parseDateBound(token: string): [string, string] | null {
  const s = token.trim();
  if (/^\d{4}$/.test(s)) {
    return [`${s}-01-01`, `${s}-12-31`];
  }
  const ym = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (ym) {
    const y = Number(ym[1]);
    const mo = Number(ym[2]);
    if (mo >= 1 && mo <= 12) {
      return [
        `${pad4(y)}-${pad2(mo)}-01`,
        `${pad4(y)}-${pad2(mo)}-${pad2(daysInMonth(y, mo))}`,
      ];
    }
    return null;
  }
  const day = parseDay(s);
  if (day) return [day, day];
  return null;
}

export function dateFilter(
  expression: string,
): ((iso: string) => boolean) | null | "invalid" {
  const s = expression.trim();
  if (!s) return null;

  const rangeIdx = s.indexOf("..");
  if (rangeIdx !== -1) {
    const left = s.slice(0, rangeIdx).trim();
    const right = s.slice(rangeIdx + 2).trim();
    const lo = left ? parseDateBound(left) : null;
    const hi = right ? parseDateBound(right) : null;
    if ((left && !lo) || (right && !hi) || (!lo && !hi)) return "invalid";
    return (iso: string) =>
      isIsoDay(iso) &&
      (!lo || iso >= lo[0]) &&
      (!hi || iso <= hi[1]);
  }

  const opMatch = /^(>=|<=|!=|>|<|=)\s*(.+)$/.exec(s);
  if (opMatch) {
    const op = opMatch[1];
    const bound = parseDateBound(opMatch[2]);
    if (!bound) return "invalid";
    switch (op) {
      case ">":
        return (iso) => isIsoDay(iso) && iso > bound[1];
      case ">=":
        return (iso) => isIsoDay(iso) && iso >= bound[0];
      case "<":
        return (iso) => isIsoDay(iso) && iso < bound[0];
      case "<=":
        return (iso) => isIsoDay(iso) && iso <= bound[1];
      case "!=":
        return (iso) => isIsoDay(iso) && (iso < bound[0] || iso > bound[1]);
      case "=":
        return (iso) => isIsoDay(iso) && iso >= bound[0] && iso <= bound[1];
    }
  }

  const exact = parseDateBound(s);
  if (!exact) return "invalid";
  return (iso) => isIsoDay(iso) && iso >= exact[0] && iso <= exact[1];
}

export function rowMatcher(
  columns: DataGridColumn[],
  filters: DataGridFilters,
  search: string,
  searchColumns?: DataGridColumn[],
): ((row: DataGridRow) => boolean) | null {
  const checks: Array<(row: DataGridRow) => boolean> = [];

  for (const col of columns) {
    const raw = filters[col.key];
    if (raw === undefined) continue;
    const type = col.type ?? "text";

    if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      const set = new Set(raw);
      checks.push((row) => set.has(String(row[col.key] ?? "")));
      continue;
    }

    const q = raw.trim();
    if (!q) continue;

    if (isNumericColumn(type)) {
      const pred = numberFilter(q);
      if (pred && pred !== "invalid") {
        checks.push((row) => {
          const v = row[col.key];
          return typeof v === "number" && Number.isFinite(v) && pred(v);
        });
      }
    } else if (type === "date") {
      const pred = dateFilter(q);
      if (pred && pred !== "invalid") {
        checks.push((row) => {
          const v = row[col.key];
          return typeof v === "string" && pred(v);
        });
      }
    } else {
      const lower = q.toLowerCase();
      checks.push((row) =>
        String(row[col.key] ?? "")
          .toLowerCase()
          .includes(lower),
      );
    }
  }

  const trimmedSearch = search.trim().toLowerCase();
  if (trimmedSearch) {
    const cols = searchColumns ?? columns;
    checks.push((row) =>
      cols.some((col) => {
        const v = row[col.key];
        if (v === null || v === undefined || v === "") return false;
        return format(v, col).toLowerCase().includes(trimmedSearch);
      }),
    );
  }

  if (checks.length === 0) return null;
  return (row) => checks.every((fn) => fn(row));
}

export function sortRows(
  rows: DataGridRow[],
  sort: DataGridSort[],
  columns: DataGridColumn[],
): DataGridRow[] {
  if (sort.length === 0) return rows;
  const colMap = new Map(columns.map((c) => [c.key, c]));
  const indexed = rows.map((row, index) => ({ row, index }));

  indexed.sort((a, b) => {
    for (const s of sort) {
      const col = colMap.get(s.key);
      if (!col) continue;
      const av = a.row[s.key];
      const bv = b.row[s.key];
      const aEmpty = av === null || av === undefined || av === "";
      const bEmpty = bv === null || bv === undefined || bv === "";
      if (aEmpty && bEmpty) continue;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      let cmp = 0;
      if (isNumericColumn(col.type)) {
        cmp = Number(av) - Number(bv);
      } else if (col.type === "select" && col.options && col.options.length > 0) {
        const ai = col.options.indexOf(String(av));
        const bi = col.options.indexOf(String(bv));
        if (ai !== -1 && bi !== -1) {
          cmp = ai - bi;
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
      } else {
        cmp = String(av).localeCompare(String(bv), "en-US", { numeric: true });
      }

      if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
    }
    return a.index - b.index;
  });

  return indexed.map((x) => x.row);
}

export function aggregate(
  rows: DataGridRow[],
  column: DataGridColumn,
  kind: DataGridAggregate = defaultAggregate(column),
): number | null {
  if (kind === "none") return null;
  if (kind === "count") {
    let count = 0;
    for (const row of rows) {
      const v = row[column.key];
      if (v !== null && v !== undefined && v !== "") count++;
    }
    return count;
  }

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const row of rows) {
    const v = row[column.key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    sum += v;
    count++;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (count === 0) return null;
  if (kind === "sum") return sum;
  if (kind === "average") return sum / count;
  if (kind === "min") return min;
  if (kind === "max") return max;
  return null;
}

export function toTsv(matrix: string[][]): string {
  return matrix
    .map((row) =>
      row
        .map((cell) => {
          if (/[\t\n\r"]/.test(cell)) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join("\t"),
    )
    .join("\n");
}

export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.length === 0) {
      inQuotes = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (rows.length > 0 && row.length === 1 && row[0] === "") {
    return rows;
  }
  rows.push(row);
  return rows;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toHtml(matrix: string[][]): string {
  const trs = matrix
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table><tbody>${trs}</tbody></table>`;
}

export function parseHtmlTable(html: string): string[][] | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const trs = doc.querySelectorAll("tr");
  if (trs.length === 0) return null;
  const rows: string[][] = [];
  trs.forEach((tr) => {
    const cells = tr.querySelectorAll("td, th");
    if (cells.length === 0) return;
    const r: string[] = [];
    cells.forEach((cell) => {
      r.push(cell.textContent ?? "");
    });
    rows.push(r);
  });
  return rows.length > 0 ? rows : null;
}

export function toCsv(columns: DataGridColumn[], rows: DataGridRow[]): string {
  const esc = (s: string) => {
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key];
        if (v === null || v === undefined) return "";
        return esc(String(v));
      })
      .join(","),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

export function extend(
  source: DataGridValue[],
  count: number,
  forward: boolean,
  type?: DataGridColumnType,
): DataGridValue[] {
  if (source.length === 0 || count <= 0) return [];

  // Number series
  const allNums = source.every((v) => typeof v === "number" && Number.isFinite(v));
  if (allNums && source.length >= 2) {
    const nums = source as number[];
    const step = nums[1] - nums[0];
    const even = nums.every((n, i) => i === 0 || Math.abs(n - nums[i - 1] - step) < 1e-9);
    if (even) {
      const out: number[] = [];
      for (let i = 1; i <= count; i++) {
        if (forward) {
          out.push(Number((nums[nums.length - 1] + step * i).toFixed(10)));
        } else {
          out.unshift(Number((nums[0] - step * i).toFixed(10)));
        }
      }
      return out;
    }
  }

  // Date series
  if (type === "date" && source.every((v) => isIsoDay(v))) {
    const dates = (source as string[]).map((iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return { y, m, d, ms: Date.UTC(y, m - 1, d) };
    });

    if (dates.length >= 2) {
      const allSameDay = dates.every((dt) => dt.d === dates[0].d);
      const allMonthEnd = dates.every((dt) => dt.d === daysInMonth(dt.y, dt.m));
      const monthStep = (dates[1].y - dates[0].y) * 12 + (dates[1].m - dates[0].m);
      const evenMonths =
        monthStep !== 0 &&
        dates.every(
          (dt, i) =>
            i === 0 ||
            (dt.y - dates[i - 1].y) * 12 + (dt.m - dates[i - 1].m) === monthStep,
        );

      if ((allSameDay || allMonthEnd) && evenMonths) {
        const out: string[] = [];
        for (let i = 1; i <= count; i++) {
          const base = forward ? dates[dates.length - 1] : dates[0];
          const totalMonths = base.y * 12 + (base.m - 1) + (forward ? monthStep * i : -monthStep * i);
          const ny = Math.floor(totalMonths / 12);
          const nm = (totalMonths % 12) + 1;
          const dim = daysInMonth(ny, nm);
          const nd = allMonthEnd ? dim : Math.min(base.d, dim);
          const iso = `${pad4(ny)}-${pad2(nm)}-${pad2(nd)}`;
          if (forward) out.push(iso);
          else out.unshift(iso);
        }
        return out;
      }

      const dayStep = Math.round((dates[1].ms - dates[0].ms) / 86400000);
      const evenDays = dates.every(
        (dt, i) => i === 0 || Math.round((dt.ms - dates[i - 1].ms) / 86400000) === dayStep,
      );
      if (evenDays) {
        const out: string[] = [];
        for (let i = 1; i <= count; i++) {
          const baseMs = forward ? dates[dates.length - 1].ms : dates[0].ms;
          const next = new Date(baseMs + (forward ? dayStep * i : -dayStep * i) * 86400000);
          const iso = `${pad4(next.getUTCFullYear())}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
          if (forward) out.push(iso);
          else out.unshift(iso);
        }
        return out;
      }
    } else if (dates.length === 1) {
      const out: string[] = [];
      for (let i = 1; i <= count; i++) {
        const next = new Date(dates[0].ms + (forward ? i : -i) * 86400000);
        const iso = `${pad4(next.getUTCFullYear())}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
        if (forward) out.push(iso);
        else out.unshift(iso);
      }
      return out;
    }
  }

  // Repeat cyclically
  const out: DataGridValue[] = [];
  for (let i = 0; i < count; i++) {
    if (forward) {
      out.push(source[i % source.length]);
    } else {
      const idx = ((source.length - 1 - (i % source.length)) + source.length) % source.length;
      out.unshift(source[idx]);
    }
  }
  return out;
}

export function colLetter(index: number): string {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
