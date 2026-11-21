"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import styles from "./vector-search.module.css";

export interface VectorTopic {
  name: string;
}

export interface VectorDocument {
  title: string;
  topic: number;
}

export interface VectorSearchProps {
  topics?: VectorTopic[];
  documents?: VectorDocument[];
  defaultQuery?: string;
  className?: string;
}

const DEFAULT_TOPICS: VectorTopic[] = [
  { name: "Billing" },
  { name: "Access" },
  { name: "Deploys" },
];

const DEFAULT_DOCS: VectorDocument[] = [
  { title: "Refund a charge", topic: 0 },
  { title: "Update a card on file", topic: 0 },
  { title: "Download invoices", topic: 0 },
  { title: "Rotate an API key", topic: 1 },
  { title: "Scope API tokens", topic: 1 },
  { title: "Revoke a session", topic: 1 },
  { title: "Roll back a release", topic: 2 },
  { title: "Preview branch deploys", topic: 2 },
  { title: "Zero-downtime migrations", topic: 2 },
];

const CLUSTER_CENTERS = [
  { x: 75, y: 66, color: "#3b82f6" },
  { x: 220, y: 62, color: "#10b981" },
  { x: 150, y: 165, color: "#8b5cf6" },
];

function inferTopic(q: string): number {
  const lower = q.toLowerCase();
  if (/key|token|auth|session|access|rotate|revoke/.test(lower)) return 1;
  if (/deploy|release|roll|branch|migrat|build/.test(lower)) return 2;
  return 0;
}

export function VectorSearch({
  topics = DEFAULT_TOPICS,
  documents = DEFAULT_DOCS,
  defaultQuery = "How do I rotate a leaked API token?",
  className,
}: VectorSearchProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [activeQuery, setActiveQuery] = useState(defaultQuery);

  const points = useMemo(() => {
    const counts = [0, 0, 0];
    return documents.map((doc, idx) => {
      const c = CLUSTER_CENTERS[doc.topic % CLUSTER_CENTERS.length];
      const offsetIdx = counts[doc.topic % 3]++;
      const angle = (offsetIdx * 2.1) + 0.5;
      const dist = 24 + (offsetIdx % 2) * 14;
      return {
        ...doc,
        id: idx,
        x: c.x + Math.cos(angle) * dist,
        y: c.y + Math.sin(angle) * dist,
        color: c.color,
      };
    });
  }, [documents]);

  const targetTopic = inferTopic(activeQuery);
  const queryPoint = useMemo(() => {
    const c = CLUSTER_CENTERS[targetTopic];
    return { x: c.x + 4, y: c.y - 2 };
  }, [targetTopic]);

  const ranked = useMemo(() => {
    return points
      .map((p) => {
        const dx = p.x - queryPoint.x;
        const dy = p.y - queryPoint.y;
        const dist = Math.hypot(dx, dy);
        const similarity = Math.max(0.18, Math.min(0.98, 1 - dist / 240));
        return { ...p, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);
  }, [points, queryPoint]);

  const topIds = new Set(ranked.slice(0, 3).map((r) => r.id));

  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      <form
        className={styles.queryBar}
        onSubmit={(e) => {
          e.preventDefault();
          setActiveQuery(query);
        }}
      >
        <Search size={14} style={{ color: "var(--text-muted)" }} />
        <input
          className={styles.queryInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about billing, API tokens, or deploys..."
          aria-label="Vector search query"
        />
        <button type="submit" className={styles.searchBtn}>
          Embed
        </button>
      </form>

      <div className={styles.layout}>
        <div className={styles.plane}>
          <svg viewBox="0 0 300 220" className={styles.svg} aria-label="Embedding space">
            <motion.circle
              key={activeQuery}
              cx={queryPoint.x}
              cy={queryPoint.y}
              r={12}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              initial={{ r: 8, opacity: 0.9 }}
              animate={{ r: 58, opacity: 0.22 }}
              transition={{ duration: 0.7 }}
            />

            {ranked.slice(0, 3).map((hit) => (
              <motion.line
                key={`line-${hit.id}-${activeQuery}`}
                x1={queryPoint.x}
                y1={queryPoint.y}
                x2={hit.x}
                y2={hit.y}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
              />
            ))}

            {points.map((p) => {
              const isHit = topIds.has(p.id);
              return (
                <g key={p.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHit ? 6.5 : 4.5}
                    fill={p.color}
                    opacity={isHit ? 1 : 0.45}
                  />
                </g>
              );
            })}

            <motion.circle
              cx={queryPoint.x}
              cy={queryPoint.y}
              r={6}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth={2}
              animate={{ cx: queryPoint.x, cy: queryPoint.y }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            />
          </svg>
        </div>

        <div className={styles.results}>
          <span className={styles.resultsTitle}>Nearest neighbors</span>
          {ranked.slice(0, 4).map((r, i) => (
            <div
              key={r.id}
              className={`${styles.resultRow} ${
                i < 3 ? styles.resultRowMatch : ""
              }`}
            >
              <div>
                <div className={styles.resultName}>{r.title}</div>
                <div className={styles.resultTopic}>
                  {topics[r.topic]?.name ?? "Docs"}
                </div>
              </div>
              <span className={styles.score}>{r.similarity.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
