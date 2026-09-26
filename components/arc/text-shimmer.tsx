"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  createElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import styles from "./text-shimmer.module.css";
import { motionTokens as T, cx } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";

const noop = () => () => {};
const STOPS: Array<[number, number]> = [
  [-1, 0],
  [-0.5, 0.5],
  [-0.2, 0.9],
  [0, 1],
  [0.2, 0.9],
  [0.5, 0.5],
  [1, 0],
];
const pct = (v: number) => `${(100 * v).toFixed(1)}%`;

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    if (document.hidden) update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function TextShimmer({
  children,
  active = true,
  duration = 1.8,
  as = "span",
  className,
  id,
}: {
  children: ReactNode;
  active?: boolean;
  duration?: number;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  id?: string;
}) {
  const stageRef = useRef<HTMLSpanElement>(null);
  const reducedPref = useReducedMotion();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const reduced = mounted && reducedPref;
  const inView = useInView(stageRef, { margin: "64px" });
  const pageVisible = usePageVisible();
  const progress = useMotionValue(0);
  const rest = useMotionValue(active ? 0 : 1);
  const backgroundImage = useTransform(() => {
    const p = progress.get();
    const r = rest.get();
    const base = `color-mix(in oklab, var(--ts-highlight) ${pct(r)}, var(--ts-base))`;
    const stops = STOPS.map(
      ([offset, strength]) =>
        `color-mix(in oklab, var(--ts-highlight) ${pct(strength)}, ${base}) calc(${(100 * p).toFixed(2)}% + ${((2 * p - 1 + offset) * 2.2).toFixed(3)}em)`,
    );
    return `linear-gradient(90deg, ${base}, ${stops.join(", ")}, ${base})`;
  });
  const running = active && !reduced && inView && pageVisible;

  useEffect(() => {
    let controls: ReturnType<typeof animate> | undefined;
    if (reduced) progress.jump(0);
    if (!running) return;
    const loop = (delay: number) => {
      if (progress.get() >= 1) progress.jump(0);
      controls = animate(progress, 1, {
        duration: duration * (1 - progress.get()),
        delay,
        ease: "linear",
        onComplete: () => loop(0.32 * duration),
      });
    };
    loop(progress.get() > 0 ? 0 : 0.12);
    return () => controls?.stop();
  }, [running, reduced, duration, progress]);

  useEffect(() => {
    if (active) {
      const c = animate(rest, 0, {
        duration: reduced ? 0 : T.duration.standard,
        ease: T.ease.standard,
      });
      return () => c.stop();
    }
    const p = progress.get();
    const finish =
      !reduced && p > 0 && p < 1
        ? animate(progress, 1, {
            duration: Math.min(0.42, duration * (1 - p) * 0.5),
            ease: T.ease.enter,
          })
        : undefined;
    const settle = animate(rest, 1, {
      duration: reduced ? T.duration.instant : 0.36,
      ease: T.ease.standard,
    });
    return () => {
      finish?.stop();
      settle.stop();
    };
  }, [active, reduced, duration, progress, rest]);

  return createElement(
    as,
    {
      id,
      className: cx(styles.shimmer, className),
      "data-state": active ? "active" : "idle",
      "aria-busy": active || undefined,
    },
    <span ref={stageRef} className={styles.stage}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={typeof children === "string" ? children : "label"}
          className={styles.label}
          style={{ backgroundImage }}
          initial={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, y: "0.3em", filter: `blur(${T.blur.soft}px)` }
          }
          animate={
            reduced ? { opacity: 1 } : { opacity: 1, y: "0em", filter: "blur(0px)" }
          }
          exit={
            reduced
              ? { opacity: 0, transition: { duration: T.duration.instant } }
              : {
                  opacity: 0,
                  y: "-0.24em",
                  filter: `blur(${T.blur.subtle}px)`,
                  transition: {
                    duration: T.duration.fast,
                    ease: T.ease.standard,
                  },
                }
          }
          transition={{
            duration: reduced ? T.duration.instant : T.duration.standard,
            ease: T.ease.enter,
          }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>,
  );
}
