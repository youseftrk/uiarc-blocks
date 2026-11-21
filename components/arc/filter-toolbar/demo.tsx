"use client";

import { useState } from "react";
import { FilterToolbar, type FilterChip } from "./filter-toolbar";

const fields = [
  { id: "status", label: "Status", options: ["Open", "Closed"] },
  { id: "owner", label: "Owner", options: ["Maya", "Leo"] },
];

export default function IssueFilters() {
  const [filters, setFilters] = useState<FilterChip[]>([]);
  return (
    <FilterToolbar
      filters={filters}
      onRemove={id => setFilters(f => f.filter(x => x.id !== id))}
      onClearAll={() => setFilters([])}
      addFilter={{ fields, onAdd: chip => setFilters(f => [...f.filter(x => x.id !== chip.id), chip]) }}
    />
  );
}
