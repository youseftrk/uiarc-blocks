"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { GlassSegmented } from "./glass-segmented";
import styles from "./glass-segmented.module.css";

interface Scene {
  value: string;
  label: string;
  title: string;
  detail: string;
  src: string;
}

const makeSceneSvg = (top: string, mid: string, low: string, accent: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${top}"/>
          <stop offset="55%" stop-color="${mid}"/>
          <stop offset="100%" stop-color="${low}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky)"/>
      <circle cx="620" cy="150" r="64" fill="${accent}" opacity="0.42"/>
      <path d="M0 370 L120 310 L240 345 L380 280 L540 330 L690 290 L800 340 L800 600 L0 600 Z" fill="${low}" opacity="0.72"/>
      <path d="M0 440 L160 390 L310 420 L480 375 L640 415 L800 385 L800 600 L0 600 Z" fill="#1b1922" opacity="0.35"/>
    </svg>`,
  )}`;

const SCENES: Scene[] = [
  {
    value: "rooftops",
    label: "Alfama",
    title: "Alfama at sunset",
    detail: "Miradouro de Santa Luzia",
    src: makeSceneSvg("#8fa8c8", "#e5a67f", "#b65a3c", "#ffd699"),
  },
  {
    value: "tram",
    label: "Tram",
    title: "Tram 28",
    detail: "Rua da Conceição",
    src: makeSceneSvg("#6f8da8", "#d8b46a", "#7f5b3a", "#f5d76e"),
  },
  {
    value: "bridge",
    label: "Bridge",
    title: "25 de Abril Bridge",
    detail: "Across the Tagus",
    src: makeSceneSvg("#4f7396", "#c67b6d", "#5a3d49", "#f0a07c"),
  },
  {
    value: "coast",
    label: "Coast",
    title: "Praia da Ursa",
    detail: "Sintra coast, 40 min west",
    src: makeSceneSvg("#5c8fb0", "#89b7c4", "#2c4c63", "#dbeff5"),
  },
];

export default function GlassSegmentedDemo() {
  const reduced = useReducedMotion() ?? false;
  const [value, setValue] = useState("rooftops");
  const active = SCENES.find((s) => s.value === value) ?? SCENES[0];

  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={active.value}
            src={active.src}
            alt={active.title}
            className={styles.photo}
            draggable={false}
            initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.36 }}
          />
        </AnimatePresence>
        <div className={styles.scrim} aria-hidden="true" />
        <div className={styles.overlay}>
          <div className={styles.caption}>
            <h3 className={styles.title}>{active.title}</h3>
            <p className={styles.detail}>{active.detail}</p>
          </div>
          <GlassSegmented
            label="Lisbon photos"
            value={value}
            onValueChange={setValue}
            fullWidth
            options={SCENES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>
      </div>
    </div>
  );
}
