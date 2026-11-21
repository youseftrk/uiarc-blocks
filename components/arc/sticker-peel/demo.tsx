"use client";

import { StickerPeel, type StickerItem } from "./sticker-peel";

const STICKERS: StickerItem[] = [
  {
    id: "ship",
    label: "Ship it sticker",
    shape: "pill",
    x: 0.28,
    y: 0.34,
    rotate: -6,
    content: (
      <span
        style={{
          background: "#111827",
          color: "#ffffff",
          padding: "2px 6px",
          borderRadius: 999,
        }}
      >
        SHIP IT
      </span>
    ),
  },
  {
    id: "arc",
    label: "Arc sticker",
    shape: "circle",
    x: 0.66,
    y: 0.38,
    rotate: 8,
    content: (
      <span style={{ color: "#2563eb", fontSize: 16, fontWeight: 800 }}>
        ARC
      </span>
    ),
  },
  {
    id: "craft",
    label: "Craft sticker",
    shape: "rounded",
    x: 0.45,
    y: 0.68,
    rotate: -3,
    content: (
      <span style={{ color: "#059669", fontSize: 13 }}>100% CRAFT</span>
    ),
  },
];

export default function StickerPeelDemo() {
  return <StickerPeel stickers={STICKERS} label="Laptop lid" />;
}
