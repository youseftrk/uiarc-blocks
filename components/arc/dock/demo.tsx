"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  Hand,
  MessageCircle,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Type,
} from "lucide-react";
import { Dock, type DockItem } from "./dock";
import styles from "./dock.module.css";

const INITIAL_ITEMS: DockItem[] = [
  {
    id: "move",
    label: "Move",
    icon: <MousePointer2 size={18} />,
    shortcut: "v",
  },
  {
    id: "hand",
    label: "Hand",
    icon: <Hand size={18} />,
    shortcut: "h",
  },
  {
    id: "shapes",
    label: "Shapes",
    icon: <Square size={18} />,
    items: [
      {
        id: "rectangle",
        label: "Rectangle",
        icon: <Square size={16} />,
        shortcut: "r",
      },
      {
        id: "ellipse",
        label: "Ellipse",
        icon: <Circle size={16} />,
        shortcut: "o",
      },
      {
        id: "line",
        label: "Line",
        icon: <Minus size={16} />,
        shortcut: "l",
      },
    ],
  },
  {
    id: "text",
    label: "Text",
    icon: <Type size={18} />,
    shortcut: "t",
  },
  {
    id: "comment",
    label: "Comment",
    icon: <MessageCircle size={18} />,
    shortcut: "c",
    badge: 2,
  },
  {
    id: "draw",
    label: "Draw",
    icon: <Pencil size={18} />,
    shortcut: "p",
  },
];

const TOOL_LABELS: Record<string, string> = {
  move: "Move",
  hand: "Hand",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  text: "Text",
  comment: "Comment",
  draw: "Draw",
};

const SHORTCUTS: Record<string, string> = {
  v: "move",
  h: "hand",
  r: "rectangle",
  o: "ellipse",
  l: "line",
  t: "text",
  c: "comment",
  p: "draw",
};

export default function DockDemo() {
  const [items, setItems] = useState<DockItem[]>(INITIAL_ITEMS);
  const [tool, setTool] = useState("move");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const id = SHORTCUTS[e.key.toLowerCase()];
      if (id) setTool(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={styles.demo}>
      <div className={styles.board} data-tool={tool}>
        <figure className={styles.frame} style={{ left: "8%", top: "12%" }}>
          <span
            className={styles.photo}
            style={{
              background:
                "linear-gradient(135deg, #2b6cb0 0%, #63b3ed 52%, #e2e8f0 100%)",
            }}
          />
          <figcaption className={styles.frameCaption}>
            Lake Louise, sunrise
          </figcaption>
        </figure>

        <figure className={styles.frame} style={{ right: "10%", top: "16%" }}>
          <span
            className={styles.photo}
            style={{
              background:
                "linear-gradient(135deg, #744210 0%, #dd6b20 48%, #f6ad55 100%)",
            }}
          />
          <figcaption className={styles.frameCaption}>
            Ocean Beach, dusk
          </figcaption>
        </figure>

        <div className={styles.pin} style={{ left: "26%", top: "54%" }}>
          Lead the deck with this one?
        </div>

        <div className={styles.pin} style={{ right: "16%", top: "58%" }}>
          Warmer grade, please
        </div>

        <Dock
          items={items}
          value={tool}
          onValueChange={setTool}
          onItemsChange={(next) => setItems(next)}
          label="Canvas tools"
        />
      </div>
      <p className={styles.status}>
        {TOOL_LABELS[tool] ?? tool} is active. Pick a tool from the dock, press
        its key, or drag / Alt+Arrow to reorder.
      </p>
    </div>
  );
}
