"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import { SandText } from "./sand-text";
import styles from "./sand-text.module.css";

const WORDS = ["Dunes", "Hourglass", "Shore"] as const;

export default function SandTextDemo() {
  const [word, setWord] = useState<(typeof WORDS)[number]>("Dunes");
  const reducedMotion = useReducedMotion();
  const groupId = useId();

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <SandText as="h2" text={word} className={styles.text} />
      </div>

      <div className={styles.words} role="radiogroup" aria-label="Word">
        {WORDS.map((item) => {
          const checked = word === item;
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={checked}
              className={styles.word}
              onClick={() => setWord(item)}
            >
              {checked && (
                <motion.span
                  layoutId={`sand-text-thumb-${groupId}`}
                  className={styles.thumb}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : motionTokens.spring.snappy
                  }
                />
              )}
              <span className={styles.label}>{item}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
