"use client";

import { TreeTable } from "./tree-table";
import type { TreeTableColumn, TreeTableRow } from "./tree-table";

type Item = { name: string; size: number; owner: string };

const columns: TreeTableColumn<Item>[] = [
  { id: "name", header: "Name", cell: (item) => item.name, sortValue: (item) => item.name, width: "minmax(0, 2fr)" },
  { id: "size", header: "Size", cell: (item) => `${item.size} MB`, sortValue: (item) => item.size, align: "end", width: "96px" },
  { id: "owner", header: "Owner", cell: (item) => item.owner, hideBelow: 520 },
];

const ROWS: TreeTableRow<Item>[] = [
  {
    id: "design",
    data: { name: "Design System", size: 42, owner: "Elena" },
    children: [
      { id: "tokens", data: { name: "foundation.css", size: 12, owner: "Elena" } },
      { id: "motion", data: { name: "motion-tokens.ts", size: 8, owner: "Marcus" } },
    ],
  },
  { id: "readme", data: { name: "README.md", size: 2, owner: "Alex" } },
];

export default function Files() {
  return (
    <TreeTable
      label="Files"
      rows={ROWS}
      columns={columns}
      selectable
      rowLabel={(item) => item.name}
      defaultExpanded={["design"]}
      maxHeight={360}
    />
  );
}
