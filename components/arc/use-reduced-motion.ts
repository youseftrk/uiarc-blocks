"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion as useMotionReducedMotion } from "motion/react";

const noop = () => () => {};

/** Reduced-motion preference, always `false` during SSR / first paint. */
export function useReducedMotion(): boolean {
  const reduced = useMotionReducedMotion();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return mounted && !!reduced;
}
