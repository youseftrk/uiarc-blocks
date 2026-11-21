"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import styles from "./upgrade-prompt.module.css";

export interface UpgradeSelection {
  interval: "monthly" | "yearly";
  price: number;
}

export interface UpgradePromptProps {
  used?: number;
  limit?: number;
  unit?: string;
  resetsOn?: string;
  planName?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  unlocks?: string[];
  onUpgrade?: (
    selection: UpgradeSelection,
    signal: AbortSignal
  ) => void | Promise<unknown>;
  onDismiss?: () => void;
  className?: string;
}

const DEFAULT_UNLOCKS = [
  "2,500 AI credits per month (50× more)",
  "Priority access to Frontier reasoning models",
  "Shared team workspaces & SSO audit log",
];

export function UpgradePrompt({
  used = 50,
  limit = 50,
  unit = "AI credits",
  resetsOn = "Nov 1",
  planName = "Pro",
  monthlyPrice = 24,
  yearlyPrice = 19,
  unlocks = DEFAULT_UNLOCKS,
  onUpgrade,
  onDismiss,
  className,
}: UpgradePromptProps) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const [phase, setPhase] = useState<"offer" | "upgrading" | "done">("offer");

  const price = interval === "yearly" ? yearlyPrice : monthlyPrice;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  const handleUpgrade = async () => {
    if (phase !== "offer") return;
    setPhase("upgrading");
    const ac = new AbortController();
    try {
      await onUpgrade?.({ interval, price }, ac.signal);
      setPhase("done");
    } catch {
      setPhase("offer");
    }
  };

  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      <AnimatePresence mode="wait">
        {phase !== "done" ? (
          <motion.div
            key="offer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 16,
              flex: 1,
            }}
          >
            <div className={styles.meterBlock}>
              <div className={styles.meterHeader}>
                <span className={styles.meterLabel}>
                  You’ve reached your {unit} limit
                </span>
                <span className={styles.meterCount}>
                  {used} / {limit}
                </span>
              </div>
              <div className={styles.track}>
                <motion.div
                  className={styles.fill}
                  initial={{ width: "60%" }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className={styles.resetNote}>
                Free quota resets on {resetsOn}
              </span>
            </div>

            <div className={styles.priceRow}>
              <div className={styles.price}>
                <motion.span
                  key={price}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={styles.amount}
                >
                  ${price}
                </motion.span>
                <span className={styles.period}>/ mo</span>
              </div>
              <div className={styles.toggle} role="group" aria-label="Billing interval">
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${
                    interval === "monthly" ? styles.toggleActive : ""
                  }`}
                  onClick={() => setInterval("monthly")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${
                    interval === "yearly" ? styles.toggleActive : ""
                  }`}
                  onClick={() => setInterval("yearly")}
                >
                  Yearly
                </button>
              </div>
            </div>

            <ul className={styles.unlocks}>
              {unlocks.map((item) => (
                <li key={item} className={styles.unlock}>
                  <Sparkles size={14} style={{ color: "var(--accent)", flex: "none" }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={phase === "upgrading"}
                onClick={() => void handleUpgrade()}
              >
                {phase === "upgrading"
                  ? `Upgrading to ${planName}...`
                  : `Upgrade to ${planName}`}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onDismiss}
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={styles.successBody}
          >
            <div className={styles.checkCircle}>
              <Check size={22} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              Welcome to {planName}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 260 }}>
              Your workspace now has 2,500 {unit} available immediately.
            </div>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPhase("offer")}
            >
              Reset preview
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
