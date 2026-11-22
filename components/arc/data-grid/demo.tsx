"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  DataGrid,
  type DataGridColumn,
  type DataGridFilters,
  type DataGridRow,
  type DataGridSort,
} from "./data-grid";
import styles from "./data-grid.module.css";

const PREFIXES = [
  "Northwind",
  "Lumen",
  "Cedar",
  "Brightline",
  "Harbor",
  "Meridian",
  "Summit",
  "Apex",
  "Solstice",
  "Cobalt",
  "Redwood",
  "Alder",
  "Beacon",
  "Vanguard",
  "Crest",
  "Horizon",
  "Vertex",
  "Cascade",
  "Granite",
  "Stratos",
];

const SUFFIXES = [
  "Freight",
  "Logistics",
  "Health",
  "Systems",
  "Cloud",
  "Labs",
  "Energy",
  "Retail",
  "Capital",
  "Bio",
  "Motors",
  "Works",
  "Grid",
  "Media",
  "Robotics",
];

const OWNERS = [
  "Owen Park",
  "Tyler Hayes",
  "Marcus Johnson",
  "Daniel Kim",
  "Maya Lin",
  "Hannah Reed",
  "Priya Patel",
  "Sofia Gomez",
  "Liam Brooks",
  "Chloe Bennett",
];

const REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"];

const STAGES = ["Discovery", "Proposal", "Negotiation", "Closed won", "At risk"];

const COLUMNS: DataGridColumn[] = [
  { key: "account", label: "Account", width: 188, pinned: true },
  { key: "owner", label: "Owner", width: 148 },
  {
    key: "region",
    label: "Region",
    type: "select",
    options: REGIONS,
    width: 144,
  },
  {
    key: "stage",
    label: "Stage",
    type: "select",
    options: STAGES,
    width: 132,
  },
  { key: "seats", label: "Seats", type: "number", width: 96 },
  { key: "arr", label: "ARR", type: "currency", width: 128 },
  {
    key: "health",
    label: "Health",
    type: "percent",
    decimals: 0,
    width: 104,
  },
  { key: "renewal", label: "Renewal", type: "date", width: 132 },
];

function buildRenewals(): DataGridRow[] {
  const rows: DataGridRow[] = [];
  let seed = 4219;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 10000; i++) {
    const p = PREFIXES[i % PREFIXES.length];
    const s = SUFFIXES[Math.floor(i / PREFIXES.length) % SUFFIXES.length];
    const owner = OWNERS[Math.floor(next() * OWNERS.length)];
    const region = REGIONS[Math.floor(next() * REGIONS.length)];
    const stage = STAGES[Math.floor(next() * STAGES.length)];
    const seats = (Math.floor(next() * 90) + 6) * 5;
    const pricePerSeat = 200 + Math.floor(next() * 240);
    const arr = seats * pricePerSeat;
    const health = 35 + Math.floor(next() * 65);
    const month = 1 + (i % 12);
    const day = 1 + ((i * 7) % 28);
    const renewal = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    rows.push({
      id: `ren-${i + 1}`,
      account: `${p} ${s}`,
      owner,
      region,
      stage,
      seats,
      arr,
      health,
      renewal,
    });
  }
  return rows;
}

export default function Demo() {
  const initialRows = useMemo(() => buildRenewals(), []);
  const [rows, setRows] = useState<DataGridRow[]>(initialRows);
  const [sort, setSort] = useState<DataGridSort[]>([]);
  const [filters, setFilters] = useState<DataGridFilters>({});
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const dirty =
    rows !== initialRows ||
    sort.length > 0 ||
    Object.keys(filters).length > 0 ||
    groupBy.length > 0 ||
    selectedIds.length > 0;

  const handleReset = () => {
    setRows(initialRows);
    setSort([]);
    setFilters({});
    setGroupBy([]);
    setSelectedIds([]);
  };

  return (
    <div className={styles.stage}>
      <div className={styles.header}>
        <div className={styles.titles}>
          <h3 className={styles.title}>Renewals</h3>
        </div>
        <button
          type="button"
          className={styles.reset}
          disabled={!dirty}
          onClick={handleReset}
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
          Reset
        </button>
      </div>

      <DataGrid
        label="Renewals"
        columns={COLUMNS}
        rows={rows}
        onRowsChange={setRows}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        maxHeight={440}
        exportFormats={["csv", "xlsx"]}
        exportFileName="renewals-2026"
      />
    </div>
  );
}
