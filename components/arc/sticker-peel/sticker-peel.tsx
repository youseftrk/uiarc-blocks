"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import styles from "./sticker-peel.module.css";

export interface StickerPlacement {
  x: number;
  y: number;
  rotate?: number;
}

export interface StickerItem {
  id: string;
  label: string;
  shape?: "pill" | "circle" | "rounded";
  x: number;
  y: number;
  rotate?: number;
  content: ReactNode;
}

export interface StickerPeelProps {
  stickers: StickerItem[];
  positions?: Record<string, StickerPlacement>;
  onPositionsChange?: (next: Record<string, StickerPlacement>) => void;
  label?: string;
  className?: string;
}

export function StickerPeel({
  stickers,
  positions: controlled,
  onPositionsChange,
  label = "Sticker surface",
  className,
}: StickerPeelProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [internal, setInternal] = useState<Record<string, StickerPlacement>>(() =>
    Object.fromEntries(
      stickers.map((s) => [s.id, { x: s.x, y: s.y, rotate: s.rotate ?? 0 }])
    )
  );
  const [peelingId, setPeelingId] = useState<string | null>(null);
  const [zOrder, setZOrder] = useState<string[]>(() => stickers.map((s) => s.id));

  const positions = controlled ?? internal;

  const updatePosition = (id: string, dx: number, dy: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const cur = positions[id] ?? { x: 0.5, y: 0.5, rotate: 0 };
    const nextPos: StickerPlacement = {
      x: Math.min(0.88, Math.max(0.12, cur.x + dx / rect.width)),
      y: Math.min(0.85, Math.max(0.15, cur.y + dy / rect.height)),
      rotate: cur.rotate,
    };
    const nextMap = { ...positions, [id]: nextPos };
    if (!controlled) setInternal(nextMap);
    onPositionsChange?.(nextMap);
  };

  return (
    <div
      ref={surfaceRef}
      className={`${styles.surface} ${className ?? ""}`}
      role="region"
      aria-label={label}
    >
      {stickers.map((s) => {
        const pos = positions[s.id] ?? { x: s.x, y: s.y, rotate: s.rotate ?? 0 };
        const isPeeling = peelingId === s.id;
        const shapeClass =
          s.shape === "circle"
            ? styles.circle
            : s.shape === "rounded"
              ? styles.rounded
              : styles.pill;

        return (
          <motion.div
            key={s.id}
            drag
            dragConstraints={surfaceRef}
            dragElastic={0.12}
            dragMomentum={false}
            whileHover={{ scale: 1.04 }}
            whileDrag={{ scale: 1.1, rotate: (pos.rotate ?? 0) + 4 }}
            onDragStart={() => {
              setPeelingId(s.id);
              setZOrder((prev) => [...prev.filter((id) => id !== s.id), s.id]);
            }}
            onDragEnd={(_, info) => {
              setPeelingId(null);
              updatePosition(s.id, info.offset.x, info.offset.y);
            }}
            className={`${styles.sticker} ${
              isPeeling ? styles.stickerPeeling : ""
            }`}
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              x: "-50%",
              y: "-50%",
              rotate: pos.rotate ?? 0,
              zIndex: zOrder.indexOf(s.id) + 1,
            }}
            aria-label={s.label}
            tabIndex={0}
          >
            <div className={`${styles.body} ${shapeClass}`}>
              {s.content}
              <span className={styles.curl} aria-hidden="true" />
            </div>
          </motion.div>
        );
      })}
      <span className={styles.hint}>Hover to curl · Drag to peel and re-stick</span>
    </div>
  );
}
