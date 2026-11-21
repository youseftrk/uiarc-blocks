"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./wallet-stack.module.css";

export interface WalletTransaction {
  id: string;
  merchant: string;
  detail: string;
  amount: number;
}

export interface WalletCard {
  id: string;
  issuer: string;
  product: string;
  lastFour: string;
  holder: string;
  expires: string;
  variant?: "metal" | "color";
  tint?: string;
  balance: number;
  balanceLabel: string;
  transactions: WalletTransaction[];
}

export interface WalletStackProps {
  cards: WalletCard[];
  onSelectedChange?: (card: WalletCard | null) => void;
  className?: string;
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

export function WalletStack({
  cards,
  onSelectedChange,
  className,
}: WalletStackProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  const choose = (card: WalletCard | null) => {
    setSelectedId(card?.id ?? null);
    onSelectedChange?.(card);
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.stack} style={{ height: selected ? 204 : 196 + (cards.length - 1) * 44 }}>
        {cards.map((card, idx) => {
          const isSelected = selected?.id === card.id;
          const hidden = selected !== null && !isSelected;
          return (
            <motion.button
              key={card.id}
              type="button"
              className={`${styles.card} ${
                card.variant === "color" ? styles.color : styles.metal
              }`}
              style={{
                background:
                  card.variant === "color" && card.tint
                    ? `linear-gradient(135deg, ${card.tint}, #1e1b4b)`
                    : undefined,
                zIndex: isSelected ? 20 : idx + 1,
              }}
              animate={{
                y: isSelected ? 0 : hidden ? 180 : idx * 44,
                scale: isSelected ? 1 : hidden ? 0.92 : 1 - (cards.length - 1 - idx) * 0.025,
                opacity: hidden ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={() => choose(isSelected ? null : card)}
            >
              <div className={styles.topRow}>
                <div>
                  <div className={styles.issuer}>{card.issuer}</div>
                  <div className={styles.product}>{card.product}</div>
                </div>
                <span className={styles.lastFour}>•••• {card.lastFour}</span>
              </div>
              <div className={styles.bottomRow}>
                <span>{card.holder}</span>
                <span>EXP {card.expires}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={styles.activity}
          >
            <div className={styles.balanceRow}>
              <span className={styles.balanceLabel}>{selected.balanceLabel}</span>
              <span className={styles.balanceVal}>{fmtMoney(selected.balance)}</span>
            </div>
            <div className={styles.txList}>
              {selected.transactions.length === 0 ? (
                <div className={styles.txDetail}>No recent activity</div>
              ) : (
                selected.transactions.map((tx) => (
                  <div key={tx.id} className={styles.tx}>
                    <div>
                      <div className={styles.txMerchant}>{tx.merchant}</div>
                      <div className={styles.txDetail}>{tx.detail}</div>
                    </div>
                    <span className={styles.txAmt}>{fmtMoney(tx.amount)}</span>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => choose(null)}
            >
              Back to wallet
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
