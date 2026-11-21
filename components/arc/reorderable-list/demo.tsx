"use client";

import { useState } from "react";
import { ReorderableList } from "./reorderable-list";

export default function Priorities() {
  const [items, setItems] = useState([
    { id: "a", title: "Ship pricing page", detail: "Due Friday" },
    { id: "b", title: "Fix login redirect" },
    { id: "c", title: "Write changelog" },
  ]);
  return <ReorderableList items={items} onReorder={setItems} label="Priorities" />;
}
