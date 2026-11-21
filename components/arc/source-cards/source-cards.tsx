"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import styles from "./source-cards.module.css";

export interface SourceCardsSource {
  title: string;
  url: string;
  snippet?: string;
  published?: string;
}

interface SourceContextValue {
  highlighted: number | null;
  setHighlighted: (n: number | null) => void;
}

const SourceContext = createContext<SourceContextValue | null>(null);

export function SourceCitation({ n }: { n: number }) {
  const ctx = useContext(SourceContext);
  const active = ctx?.highlighted === n;
  return (
    <button
      type="button"
      className={`${styles.citationBtn} ${active ? styles.citationBtnActive : ""}`}
      onMouseEnter={() => ctx?.setHighlighted(n)}
      onMouseLeave={() => ctx?.setHighlighted(null)}
      onFocus={() => ctx?.setHighlighted(n)}
      onBlur={() => ctx?.setHighlighted(null)}
      onClick={() => ctx?.setHighlighted(active ? null : n)}
      aria-label={`Source ${n}`}
    >
      {n}
    </button>
  );
}

export interface SourceCardsProps {
  sources?: SourceCardsSource[];
  status?: "searching" | "done";
  total?: number;
  query?: string;
  duration?: number;
  max?: number;
  onSourceClick?: (source: SourceCardsSource, index: number) => void;
  children?: ReactNode;
  className?: string;
}

const DEFAULT_SOURCES: SourceCardsSource[] = [
  {
    title: "Verify webhook signatures with the raw request body",
    url: "https://docs.stripe.com/webhooks/signature",
    snippet: "Pass the exact raw payload string to stripe.webhooks.constructEvent before JSON parsing.",
    published: "Stripe Docs · Updated 2026",
  },
  {
    title: "Route Handlers: reading raw request bodies in Next.js",
    url: "https://nextjs.org/docs/app/building-your-application/routing/route-handlers",
    snippet: "Call await request.text() inside your POST handler to preserve whitespace and byte order.",
    published: "Next.js Docs",
  },
  {
    title: "HMAC-SHA256 timing-safe comparison best practices",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify",
    snippet: "Use constant-time digest verification to prevent timing side-channel leaks on webhook secrets.",
    published: "MDN Web Docs",
  },
  {
    title: "Handling webhook retries and idempotency keys",
    url: "https://docs.stripe.com/webhooks/best-practices",
    snippet: "Store processed event IDs and return a 2xx response quickly before running downstream jobs.",
    published: "Stripe Docs",
  },
  {
    title: "Testing webhook endpoints locally with Stripe CLI",
    url: "https://docs.stripe.com/stripe-cli/use-cli",
    snippet: "Use stripe listen --forward-to localhost:3000/api/webhooks to replay signed test events.",
    published: "Stripe CLI",
  },
];

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SourceCards({
  sources = DEFAULT_SOURCES,
  status = "done",
  total,
  query,
  duration,
  max = 3,
  onSourceClick,
  children,
  className,
}: SourceCardsProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? sources : sources.slice(0, max);
  const overflow = showAll ? [] : sources.slice(max);
  const pendingSlots =
    status === "searching" && total
      ? Math.max(0, Math.min(max, total) - visible.length)
      : 0;

  const activeSource =
    highlighted !== null ? sources[highlighted - 1] : undefined;

  const ctx = useMemo(
    () => ({ highlighted, setHighlighted }),
    [highlighted]
  );

  return (
    <SourceContext.Provider value={ctx}>
      <div className={`${styles.root} ${className ?? ""}`}>
        {children && <div className={styles.answer}>{children}</div>}

        <div className={styles.bar}>
          <span className={styles.statusRow}>
            {status === "searching" ? (
              <>
                <Loader2 size={13} />
                Searching {sources.length} of {total ?? sources.length}
                {query ? ` · “${query}”` : ""}
              </>
            ) : (
              <>
                <Globe size={13} />
                {sources.length} sources
                {duration ? ` · ${(duration / 1000).toFixed(1)}s` : ""}
              </>
            )}
          </span>
        </div>

        <div className={styles.grid}>
          {visible.map((source, idx) => {
            const num = idx + 1;
            const domain = hostnameOf(source.url);
            const isActive = highlighted === num;
            return (
              <motion.button
                key={source.url}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                onMouseEnter={() => setHighlighted(num)}
                onMouseLeave={() => setHighlighted(null)}
                onFocus={() => setHighlighted(num)}
                onBlur={() => setHighlighted(null)}
                onClick={() => onSourceClick?.(source, idx)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.domainRow}>
                    <span className={styles.favicon}>
                      {domain[0]?.toUpperCase() ?? "S"}
                    </span>
                    <span className={styles.domain}>{domain}</span>
                  </span>
                  <span className={styles.indexBadge}>{num}</span>
                </div>
                <span className={styles.cardTitle}>{source.title}</span>
              </motion.button>
            );
          })}

          {Array.from({ length: pendingSlots }).map((_, i) => (
            <div key={`slot-${i}`} className={styles.skeletonCard} />
          ))}

          {overflow.length > 0 && (
            <button
              type="button"
              className={`${styles.card} ${styles.overflowCard}`}
              onClick={() => setShowAll(true)}
            >
              <div className={styles.avatarStack}>
                {overflow.slice(0, 3).map((s) => (
                  <span key={s.url} className={styles.favicon}>
                    {hostnameOf(s.url)[0]?.toUpperCase() ?? "S"}
                  </span>
                ))}
              </div>
              <span className={styles.cardTitle}>+{overflow.length} more</span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {activeSource && (
            <motion.div
              key={activeSource.url}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className={styles.preview}
            >
              <div className={styles.previewTitle}>{activeSource.title}</div>
              {activeSource.snippet && (
                <div className={styles.previewSnippet}>{activeSource.snippet}</div>
              )}
              <div className={styles.previewMeta}>
                {activeSource.published ?? hostnameOf(activeSource.url)}{" "}
                <ExternalLink size={11} style={{ display: "inline", verticalAlign: "-1px" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SourceContext.Provider>
  );
}
