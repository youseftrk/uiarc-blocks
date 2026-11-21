"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./ticket-tear.module.css";

export interface TicketTearProps {
  children: ReactNode;
  stub: ReactNode;
  torn?: boolean;
  defaultTorn?: boolean;
  onTornChange?: (torn: boolean) => void;
  label?: string;
  className?: string;
}

export function TicketTear({
  children,
  stub,
  torn: controlled,
  defaultTorn = false,
  onTornChange,
  label = "Tear off stub",
  className,
}: TicketTearProps) {
  const [internalTorn, setInternalTorn] = useState(defaultTorn);
  const isTorn = controlled ?? internalTorn;

  const setTorn = (next: boolean) => {
    if (controlled === undefined) setInternalTorn(next);
    onTornChange?.(next);
  };

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div className={styles.ticket}>
        <div className={styles.main}>{children}</div>
        <div className={styles.perf} aria-hidden="true" />
        <AnimatePresence>
          {!isTorn && (
            <motion.div
              key="stub"
              role="button"
              tabIndex={0}
              aria-label={label}
              className={styles.stub}
              drag="x"
              dragConstraints={{ left: 0, right: 140 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x > 64 || info.velocity.x > 300) {
                  setTorn(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTorn(true);
                }
              }}
              initial={{ opacity: 0, x: 16, rotate: 4 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{
                opacity: 0,
                x: 110,
                y: 44,
                rotate: 22,
                transition: { duration: 0.32, ease: [0.32, 0, 0.67, 0] },
              }}
            >
              {stub}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!isTorn ? (
        <span className={styles.hint}>Drag stub right to tear along perforation</span>
      ) : (
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => setTorn(false)}
        >
          Re-attach stub
        </button>
      )}
    </div>
  );
}
