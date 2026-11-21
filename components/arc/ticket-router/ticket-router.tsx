"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Play, RotateCcw } from "lucide-react";
import styles from "./ticket-router.module.css";

export interface InboundTicket {
  id: string;
  source: "gmail" | "intercom" | "slack" | "zendesk" | string;
  subject: string;
  intent: string;
  sentiment: "positive" | "neutral" | "frustrated";
  confidence: number;
  suggestedLane: string;
  assignee: string;
}

export interface RoutedTicket extends InboundTicket {
  lane: string;
}

export interface TicketRouterProps {
  tickets?: InboundTicket[];
  reviewThreshold?: number;
  classify?: (
    ticket: InboundTicket,
    opts: { signal: AbortSignal }
  ) => Promise<{ intent: string; sentiment: "positive" | "neutral" | "frustrated"; confidence: number }>;
  onRoute?: (ticket: RoutedTicket) => void;
  className?: string;
}

const DEFAULT_TICKETS: InboundTicket[] = [
  {
    id: "t1",
    source: "intercom",
    subject: "Invoice PDF missing VAT ID for April",
    intent: "Billing",
    sentiment: "neutral",
    confidence: 0.94,
    suggestedLane: "Billing",
    assignee: "Maya",
  },
  {
    id: "t2",
    source: "slack",
    subject: "Webhook retries timing out on EU cluster",
    intent: "Engineering",
    sentiment: "frustrated",
    confidence: 0.91,
    suggestedLane: "Engineering",
    assignee: "Liam",
  },
  {
    id: "t3",
    source: "gmail",
    subject: "Can we switch seats mid-cycle or pause?",
    intent: "Billing",
    sentiment: "neutral",
    confidence: 0.64,
    suggestedLane: "Billing",
    assignee: "Maya",
  },
  {
    id: "t4",
    source: "zendesk",
    subject: "SSO SAML metadata returns 403 on login",
    intent: "Engineering",
    sentiment: "frustrated",
    confidence: 0.88,
    suggestedLane: "Engineering",
    assignee: "Noah",
  },
];

export function TicketRouter({
  tickets = DEFAULT_TICKETS,
  reviewThreshold = 0.75,
  classify,
  onRoute,
  className,
}: TicketRouterProps) {
  const [routed, setRouted] = useState<RoutedTicket[]>([]);
  const [cursor, setCursor] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || cursor >= tickets.length) return;
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      const current = tickets[cursor];
      if (!current) return;
      let next = current;
      if (classify) {
        try {
          const res = await classify(current, { signal: ac.signal });
          next = { ...current, ...res };
        } catch {
          // fall back to ticket defaults
        }
      }
      const lane =
        next.confidence < reviewThreshold ? "Review" : next.suggestedLane;
      const item: RoutedTicket = { ...next, lane };
      setRouted((prev) => [item, ...prev]);
      setCursor((c) => c + 1);
      if (lane !== "Review") onRoute?.(item);
    }, 900);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [running, cursor, tickets, reviewThreshold, classify, onRoute]);

  const approveReview = (ticket: RoutedTicket) => {
    const updated: RoutedTicket = { ...ticket, lane: ticket.suggestedLane };
    setRouted((prev) =>
      prev.map((t) => (t.id === ticket.id ? updated : t))
    );
    onRoute?.(updated);
  };

  const laneNames = ["Review", "Billing", "Engineering"];

  return (
    <div className={`${styles.shell} ${className ?? ""}`}>
      <div className={styles.header}>
        <span className={styles.title}>
          AI Ticket Router ({routed.length}/{tickets.length} triaged)
        </span>
        <div className={styles.controls}>
          {cursor < tickets.length && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => setRunning((r) => !r)}
            >
              <Play size={12} />
              {running ? "Pause" : "Resume"}
            </button>
          )}
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setRouted([]);
              setCursor(0);
              setRunning(true);
            }}
          >
            <RotateCcw size={12} />
            Replay
          </button>
        </div>
      </div>

      <div className={styles.lanes}>
        {laneNames.map((lane) => {
          const laneTickets = routed.filter((t) => t.lane === lane);
          return (
            <div key={lane} className={styles.lane}>
              <div className={styles.laneHeader}>
                <span>{lane}</span>
                <span className={styles.count}>{laneTickets.length}</span>
              </div>
              <AnimatePresence initial={false}>
                {laneTickets.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    className={styles.ticket}
                  >
                    <div className={styles.ticketTop}>
                      <span className={styles.source}>{t.source}</span>
                      <span
                        className={`${styles.conf} ${
                          t.confidence >= reviewThreshold
                            ? styles.confHigh
                            : styles.confLow
                        }`}
                      >
                        {Math.round(t.confidence * 100)}%
                      </span>
                    </div>
                    <div className={styles.subject}>{t.subject}</div>
                    <div className={styles.metaRow}>
                      <span>{t.intent}</span>
                      <span>→ {t.assignee}</span>
                    </div>
                    {lane === "Review" && (
                      <button
                        type="button"
                        className={styles.approveBtn}
                        onClick={() => approveReview(t)}
                      >
                        <Check size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                        Route to {t.suggestedLane}
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
