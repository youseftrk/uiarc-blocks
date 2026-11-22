"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  MorphLoader,
  type MorphLoaderStatus,
  type MorphLoaderVariant,
} from "./morph-loader";
import styles from "./morph-loader.module.css";

const VARIANTS: { id: MorphLoaderVariant; label: string }[] = [
  { id: "dots", label: "Dots" },
  { id: "bars", label: "Bars" },
  { id: "ring", label: "Ring" },
  { id: "square", label: "Square" },
];

export default function MorphLoaderDemo() {
  const reduced = Boolean(useReducedMotion());
  const [variant, setVariant] = useState<MorphLoaderVariant>("dots");
  const [status, setStatus] = useState<MorphLoaderStatus>("loading");

  // Auto-return to loading shortly after resolve so users can keep exploring
  useEffect(() => {
    if (status === "loading") return;
    const t = setTimeout(() => setStatus("loading"), 1800);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <MorphLoader variant={variant} status={status} size={72} />
      </div>

      <div className={styles.controls}>
        <div className={styles.segment} role="radiogroup" aria-label="Loader shape">
          {VARIANTS.map((v) => {
            const active = variant === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={styles.option}
                onClick={() => {
                  setVariant(v.id);
                  setStatus("loading");
                }}
              >
                {active && (
                  <motion.span
                    layoutId="morph-loader-demo-thumb"
                    className={styles.thumb}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", visualDuration: 0.24, bounce: 0 }
                    }
                  />
                )}
                <span className={styles.optionLabel}>{v.label}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            disabled={status === "success"}
            onClick={() => setStatus("success")}
          >
            Succeed
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={status === "error"}
            onClick={() => setStatus("error")}
          >
            Fail
          </button>
        </div>
      </div>
    </div>
  );
}
