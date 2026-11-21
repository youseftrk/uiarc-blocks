"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  UIARC_CATEGORIES,
  UIARC_COMPONENTS,
  type ComponentTier,
} from "@/lib/uiarc-catalog";
import { ThemeToggle } from "../theme-toggle";
import styles from "./components-catalog.module.css";

export function ComponentsCatalog() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"all" | ComponentTier>("all");
  const [category, setCategory] = useState<string>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return UIARC_COMPONENTS.filter((item) => {
      if (tier !== "all" && item.tier !== tier) return false;
      if (category !== "All" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [query, tier, category]);

  const counts = useMemo(() => {
    const free = UIARC_COMPONENTS.filter((c) => c.tier === "free").length;
    const pro = UIARC_COMPONENTS.filter((c) => c.tier === "pro").length;
    return { all: UIARC_COMPONENTS.length, free, pro };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <Link href="/" className={styles.brandLink}>
              UIarc
            </Link>
            <nav className={styles.navLinks} aria-label="Main navigation">
              <Link href="/" className={styles.navLink}>
                Blocks
              </Link>
              <Link
                href="/components"
                className={`${styles.navLink} ${styles.navLinkActive}`}
              >
                Components ({counts.all})
              </Link>
            </nav>
          </div>
          <ThemeToggle className={styles.themeBtn} />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Components</h1>
          <p className={styles.subtitle}>
            All {counts.all} UIArc components ({counts.free} MIT free +{" "}
            {counts.pro} Pro) recreated with exact visuals, Motion springs, and
            interactions.
          </p>
        </div>

        <div className={styles.controls}>
          <div className={styles.topRow}>
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 252 components..."
                className={styles.searchInput}
                aria-label="Search components"
              />
            </div>

            <div className={styles.pillRow} role="group" aria-label="Filter by tier">
              {(
                [
                  ["all", "All", counts.all],
                  ["pro", "Pro", counts.pro],
                  ["free", "Free", counts.free],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTier(value)}
                  className={`${styles.pill} ${
                    tier === value ? styles.pillActive : ""
                  }`}
                >
                  {label}
                  <span className={styles.pillCount}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.pillRow} role="group" aria-label="Filter by category">
            {["All", ...UIARC_CATEGORIES].map((cat) => {
              const count =
                cat === "All"
                  ? UIARC_COMPONENTS.filter(
                      (c) => tier === "all" || c.tier === tier
                    ).length
                  : UIARC_COMPONENTS.filter(
                      (c) =>
                        c.category === cat &&
                        (tier === "all" || c.tier === tier)
                    ).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`${styles.pill} ${
                    category === cat ? styles.pillActive : ""
                  }`}
                >
                  {cat}
                  <span className={styles.pillCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            No components match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((item) => (
              <Link
                key={item.name}
                href={`/components/${item.name}`}
                className={styles.card}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{item.title}</span>
                  <div className={styles.badges}>
                    <span className={styles.catBadge}>{item.category}</span>
                    {item.tier === "pro" ? (
                      <span className={styles.proBadge}>Pro</span>
                    ) : (
                      <span className={styles.freeBadge}>Free</span>
                    )}
                  </div>
                </div>
                <p className={styles.cardDesc}>{item.description}</p>
                <span className={styles.cardSlug}>{item.name}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
