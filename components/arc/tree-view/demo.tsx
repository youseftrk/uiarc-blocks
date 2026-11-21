"use client";

import { TreeView, type TreeNode } from "./tree-view";

const files: TreeNode[] = [
  { id: "app", label: "app", children: [
    { id: "page", label: "page.tsx" },
    { id: "layout", label: "layout.tsx" },
  ] },
  { id: "readme", label: "README.md" },
];

export default function Files() {
  return <TreeView nodes={files} defaultExpandedIds={["app"]} onSelect={node => open(node.id)} />;
}
