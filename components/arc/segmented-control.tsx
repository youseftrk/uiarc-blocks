"use client";

import { LayoutGroup, motion } from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./segmented-control.module.css";
import { motionTokens as T, cx } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";

export type SegmentedOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  accessory?: ReactNode;
};

export function SegmentedControl<V extends string>({
  options,
  value,
  onValueChange,
  label,
  onOptionIntent,
  className,
}: {
  options: SegmentedOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
  label: string;
  onOptionIntent?: (value: V) => void;
  className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const end = track.scrollWidth - track.clientWidth - track.scrollLeft;
      track.toggleAttribute("data-fade-start", track.scrollLeft > 1);
      track.toggleAttribute("data-fade-end", end > 1);
    };
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [options.length]);

  const firstScroll = useRef(true);
  useEffect(() => {
    const track = trackRef.current;
    const selected = track?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!track || !selected || track.scrollWidth <= track.clientWidth) {
      firstScroll.current = false;
      return;
    }
    const min = selected.offsetLeft - 20;
    const max = selected.offsetLeft + selected.offsetWidth + 20 - track.clientWidth;
    const next =
      track.scrollLeft > min ? min : track.scrollLeft < max ? max : track.scrollLeft;
    if (next !== track.scrollLeft) {
      track.scrollTo({
        left: Math.max(0, next),
        behavior: firstScroll.current || reduced ? "auto" : "smooth",
      });
    }
    firstScroll.current = false;
  }, [value, reduced]);

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0 || !options[next]) return;
    event.preventDefault();
    onValueChange(options[next].value);
    trackRef.current
      ?.querySelector<HTMLElement>(`[data-value="${CSS.escape(options[next].value)}"]`)
      ?.focus({ preventScroll: true });
  };

  return (
    <div className={cx(styles.root, className)} role="group" aria-label={label}>
      <LayoutGroup id={id}>
        <motion.div ref={trackRef} layoutScroll className={styles.track}>
          {options.map((option, i) => (
            <button
              key={option.value}
              id={`${id}-${option.value}`}
              className={styles.button}
              type="button"
              data-value={option.value}
              aria-pressed={value === option.value}
              tabIndex={i === index ? 0 : -1}
              onClick={() => onValueChange(option.value)}
              onKeyDown={onKeyDown}
              onPointerEnter={onOptionIntent ? () => onOptionIntent(option.value) : undefined}
              onFocus={onOptionIntent ? () => onOptionIntent(option.value) : undefined}
            >
              {value === option.value && (
                <motion.span
                  className={styles.selection}
                  layoutId="selection"
                  layoutDependency={value}
                  transition={reduced ? { duration: 0 } : T.spring.morph}
                  aria-hidden="true"
                />
              )}
              <span className={styles.label}>
                {option.label}
                {option.accessory}
              </span>
            </button>
          ))}
        </motion.div>
      </LayoutGroup>
    </div>
  );
}
