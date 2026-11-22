"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { UIARC_COMPONENTS, type ComponentTier } from "@/lib/uiarc-catalog";
import styles from "./replica.module.css";
import { ThemeToggle } from "./theme-toggle";

export function ReplicaIndex() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"all" | ComponentTier>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return UIARC_COMPONENTS.filter((item) => {
      if (tier !== "all" && item.tier !== tier) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [query, tier]);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            uiarc component replica — {UIARC_COMPONENTS.length} components
          </h1>
          <div className={styles.actions}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter components…"
              aria-label="Filter components"
              className={styles.search}
            />
            <div className={styles.tabs} role="group" aria-label="Filter by tier">
              {(["all", "pro", "free"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`${styles.tab} ${tier === t ? styles.tabActive : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Link href="/blocks" className={styles.navBtn}>
              Blocks
            </Link>
            <ThemeToggle className={styles.navBtn} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>No components match &ldquo;{query}&rdquo;.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((item) => (
              <Link
                key={item.name}
                href={`/preview/${item.name}`}
                className={styles.card}
              >
                <span className={styles.slug}>{item.name}</span>
                <span
                  className={
                    item.tier === "pro" ? styles.tierPro : styles.tierFree
                  }
                >
                  {item.tier}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
