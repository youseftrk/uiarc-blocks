"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import styles from "./animated-counter.module.css";
import { motionTokens as T } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const labelVariants = {
  hidden: { opacity: 0, y: "0.3em", filter: `blur(${T.blur.soft}px)` },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: T.duration.standard, ease: T.ease.enter },
  },
  gone: {
    opacity: 0,
    y: "-0.3em",
    filter: `blur(${T.blur.subtle}px)`,
    transition: { duration: T.duration.fast, ease: T.ease.standard },
  },
};
const labelVariantsReduced = {
  hidden: { opacity: 0, y: 0, filter: "blur(0px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.duration.instant } },
  gone: { opacity: 0, y: 0, filter: "blur(0px)", transition: { duration: T.duration.instant } },
};
const revealSpring = { ...T.spring.smooth, visualDuration: T.duration.considered };
const widthMotion = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, (p) => ((((digit - p) % 10) + 15) % 10) - 5);
  const y = useTransform(offset, (o) => `${o}em`);
  const opacity = useTransform(offset, (o) => Math.max(0, 1 - Math.abs(o)));
  const visibility = useTransform(offset, (o) => (Math.abs(o) >= 1 ? "hidden" : "visible"));
  const filter = useTransform(offset, (o) =>
    Math.abs(o) < 0.02 || Math.abs(o) >= 1
      ? "none"
      : `blur(${(Math.abs(o) * T.blur.subtle).toFixed(2)}px)`,
  );
  return (
    <motion.span className={styles.glyph} style={{ y, opacity, filter, visibility }}>
      {digit}
    </motion.span>
  );
}

function DigitColumn({
  digit,
  direction,
  armed,
  delay,
  reduceMotion,
}: {
  digit: number;
  direction: number;
  armed: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const position = useMotionValue(armed ? 0 : digit);
  const state = useRef({ digit: armed ? 0 : digit, target: armed ? 0 : digit, revealed: !armed });

  useEffect(() => {
    const s = state.current;
    if (armed || s.digit === digit) {
      if (!armed) s.revealed = true;
      return;
    }
    s.target +=
      direction < 0 && s.revealed ? -((s.digit - digit + 10) % 10) : (digit - s.digit + 10) % 10;
    s.digit = digit;
    if (reduceMotion) position.jump(s.target);
    else animate(position, s.target, s.revealed ? T.spring.smooth : { ...revealSpring, delay });
    s.revealed = true;
  }, [armed, delay, digit, direction, position, reduceMotion]);

  return (
    <motion.span
      className={styles.column}
      {...widthMotion}
      transition={reduceMotion ? { duration: 0 } : T.spring.morph}
    >
      <span className={styles.sizer}>0</span>
      {DIGITS.map((d) => (
        <Glyph key={d} position={position} digit={d} />
      ))}
    </motion.span>
  );
}

type Part =
  | { key: string; digit: number; order: number }
  | { key: string; text: string };

export function AnimatedCounter({
  value,
  label,
  prefix = "",
  suffix = "",
  decimals = 0,
  animateOnView = false,
  locale = "en-US",
}: {
  value: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  animateOnView?: boolean;
  locale?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState(1);
  if (value !== previous) {
    setPrevious(value);
    setDirection(value > previous ? 1 : -1);
  }

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    numberingSystem: "latn",
  }).formatToParts(value);
  let integerPlace = formatted.reduce(
    (n, part) => n + (part.type === "integer" ? part.value.length : 0),
    0,
  );
  let fraction = 0;
  let order = 0;
  const parts = formatted.flatMap<Part>((part, i) =>
    part.type === "integer"
      ? [...part.value].map((ch) => ({ key: `i${--integerPlace}`, digit: Number(ch), order: order++ }))
      : part.type === "fraction"
        ? [...part.value].map((ch) => ({ key: `f${fraction++}`, digit: Number(ch), order: order++ }))
        : [
            {
              key:
                part.type === "group"
                  ? `g${integerPlace}`
                  : part.type === "decimal"
                    ? "d"
                    : `${part.type}${i}`,
              text: part.value,
            },
          ],
  );
  const text = `${prefix}${parts.map((p) => ("text" in p ? p.text : p.digit)).join("")}${suffix}`;
  const armed = animateOnView && !inView;

  return (
    <span ref={ref} className={styles.counter}>
      {label && (
        <span className={styles.label}>
          <span className={styles.labelSwap}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={label}
                className={styles.labelText}
                variants={reduced ? labelVariantsReduced : labelVariants}
                initial="hidden"
                animate="shown"
                exit="gone"
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      )}
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.value} aria-hidden="true">
        {prefix && <span className={styles.symbol}>{prefix}</span>}
        <AnimatePresence initial={false}>
          {parts.map((part) =>
            "digit" in part ? (
              <DigitColumn
                key={part.key}
                digit={part.digit}
                direction={direction}
                armed={armed}
                delay={Math.min(part.order * T.stagger.item, 0.25)}
                reduceMotion={reduced}
              />
            ) : (
              <motion.span
                key={part.key}
                className={styles.symbol}
                {...widthMotion}
                transition={reduced ? { duration: 0 } : T.spring.morph}
              >
                {part.text}
              </motion.span>
            ),
          )}
        </AnimatePresence>
        {suffix && <span className={styles.symbol}>{suffix}</span>}
      </span>
    </span>
  );
}
