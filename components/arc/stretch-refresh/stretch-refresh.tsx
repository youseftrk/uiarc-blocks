"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import styles from "./stretch-refresh.module.css";

export interface StretchRefreshProps<T> {
  title?: string;
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onRefresh: () => Promise<string | void> | string | void;
  threshold?: number;
  className?: string;
}

export function StretchRefresh<T>({
  title = "Inbox",
  items,
  getKey,
  renderItem,
  onRefresh,
  threshold = 72,
  className,
}: StretchRefreshProps<T>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const startYRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const runRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setPull(48);
    try {
      const msg = await onRefresh();
      setStatusMessage(typeof msg === "string" ? msg : "Updated");
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const progress = Math.min(1, pull / threshold);

  return (
    <div className={`${styles.shell} ${className ?? ""}`}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={runRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={12} />
          {refreshing ? "Refreshing..." : "Pull or click"}
        </button>
      </div>

      <motion.div
        className={styles.pullZone}
        animate={{ height: pull > 2 || refreshing ? Math.max(36, pull) : statusMessage ? 28 : 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
      >
        <motion.div
          className={styles.stretchLine}
          animate={{
            width: refreshing ? 96 : Math.round(24 + progress * 120),
            opacity: pull > 2 || refreshing ? 1 : 0,
          }}
        />
        <span className={styles.statusText} role="status" aria-live="polite">
          {refreshing
            ? "Refreshing feed..."
            : pull >= threshold
              ? "Release to refresh"
              : pull > 4
                ? "Pull to refresh"
                : statusMessage ?? ""}
        </span>
      </motion.div>

      <div
        ref={listRef}
        className={styles.list}
        onPointerDown={(e) => {
          if (refreshing) return;
          if ((listRef.current?.scrollTop ?? 0) <= 0) {
            startYRef.current = e.clientY;
          }
        }}
        onPointerMove={(e) => {
          if (startYRef.current === null || refreshing) return;
          const dy = e.clientY - startYRef.current;
          if (dy > 0) {
            setPull(Math.min(110, dy * 0.55));
          }
        }}
        onPointerUp={() => {
          if (startYRef.current === null) return;
          startYRef.current = null;
          if (pull >= threshold) {
            void runRefresh();
          } else {
            setPull(0);
          }
        }}
        onPointerCancel={() => {
          startYRef.current = null;
          setPull(0);
        }}
      >
        {items.map((item) => (
          <div
            key={getKey(item)}
            className={styles.item}
            style={{ paddingTop: Math.round(progress * 4), paddingBottom: Math.round(progress * 4) }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
