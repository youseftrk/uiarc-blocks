"use client";

import { useState, type CSSProperties } from "react";
import { KeycapKeyboard } from "./keycap-keyboard";
import styles from "./keycap-keyboard.module.css";

export default function KeycapKeyboardDemo() {
  const [layout, setLayout] = useState<"compact" | "letters">("compact");

  return (
    <div className={styles.demo}>
      <KeycapKeyboard
        layout={layout}
        listen="window"
        placeholder="Type anything"
      />
      <div
        className={styles.segment}
        role="group"
        aria-label="Keyboard layout"
        style={{ "--index": layout === "compact" ? 0 : 1 } as CSSProperties}
      >
        <button
          type="button"
          className={styles.option}
          aria-pressed={layout === "compact"}
          onClick={() => setLayout("compact")}
        >
          Compact
        </button>
        <button
          type="button"
          className={styles.option}
          aria-pressed={layout === "letters"}
          onClick={() => setLayout("letters")}
        >
          Letters
        </button>
      </div>
    </div>
  );
}
