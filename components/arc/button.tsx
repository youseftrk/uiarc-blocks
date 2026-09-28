"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  type MotionValue,
} from "motion/react";
import {
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./button.module.css";
import { motionTokens as T, cx } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
  "data-state"?: string;
};

const pressedVariants = {
  pressed: (ref: React.RefObject<HTMLButtonElement | null>) => {
    const width = ref.current?.offsetWidth ?? 0;
    return {
      scale: width > 220 ? 0.985 : width && width <= 48 ? 0.96 : 0.97,
      transition: { duration: T.duration.instant, ease: T.ease.standard },
    };
  },
};

const shown = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };
const textHidden = { opacity: 0, y: 4, filter: `blur(${T.blur.soft}px)` };
const textGone = {
  opacity: 0,
  y: -3,
  filter: `blur(${T.blur.soft}px)`,
  transition: { duration: T.duration.fast, ease: T.ease.standard },
};
const iconHidden = { opacity: 0, scale: 0.6, filter: `blur(${T.blur.subtle}px)` };
const iconGone = {
  opacity: 0,
  scale: 0.6,
  filter: `blur(${T.blur.subtle}px)`,
  transition: { duration: T.duration.fast, ease: T.ease.standard },
};
const reducedHidden = { ...shown, opacity: 0 };
const reducedGone = { opacity: 0, transition: { duration: T.duration.instant } };
const iconTransition = {
  ...T.spring.snappy,
  opacity: { duration: T.duration.fast, ease: T.ease.enter },
  filter: { duration: T.duration.fast, ease: T.ease.enter },
};

function LabelPhase({
  children,
  icon,
  reduced,
}: {
  children: ReactNode;
  icon: boolean;
  reduced: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.span
      className={styles.labelPhase}
      aria-hidden={!present || undefined}
      initial={reduced ? reducedHidden : icon ? iconHidden : textHidden}
      animate={shown}
      exit={reduced ? reducedGone : icon ? iconGone : textGone}
      transition={
        reduced
          ? { duration: T.duration.instant }
          : icon
            ? iconTransition
            : { duration: T.duration.standard, ease: T.ease.enter }
      }
    >
      {children}
    </motion.span>
  );
}

function fingerprint(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(fingerprint).join("");
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  const type = node.type;
  const name =
    typeof type === "string"
      ? type
      : ((type as { displayName?: string; name?: string }).displayName ??
        (type as { name?: string }).name ??
        "");
  return `<${name}>${fingerprint(node.props.children)}`;
}

function useMorphWidth(
  contentRef: React.RefObject<HTMLSpanElement | null>,
  key: string,
  reduced: boolean,
): MotionValue<number | "auto"> {
  const width = useMotionValue<number | "auto">("auto");
  const lastKey = useRef(key);
  const until = useRef(0);
  useLayoutEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      until.current = performance.now() + 700;
    }
  }, [key]);
  useEffect(() => {
    const content = contentRef.current;
    const slot = content?.parentElement;
    if (!content || !slot || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (!next || !measured || reduced || performance.now() > until.current) {
        measured = next > 0;
        width.jump(next || "auto");
        delete slot.dataset.morphing;
        return;
      }
      slot.dataset.morphing = "";
      animate(width, next, {
        ...T.spring.morph,
        onComplete: () => {
          delete slot.dataset.morphing;
        },
      });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentRef, reduced, width]);
  return width;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    children,
    onClick,
    ...rest
  },
  forwardedRef,
) {
  const reduced = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const key = fingerprint(children);
  const width = useMorphWidth(contentRef, key, reduced);
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  const haspopup = rest["aria-haspopup"];
  const isTriggerLike =
    (haspopup !== undefined && haspopup !== false && haspopup !== "false") ||
    rest.role === "combobox" ||
    rest["data-state"] !== undefined;
  const inert =
    disabled ||
    loading ||
    rest["aria-disabled"] === true ||
    rest["aria-disabled"] === "true";
  const iconOnly = !/\S/.test(key.replace(/<[^>]*>/g, ""));

  return (
    <motion.button
      ref={setRef}
      tabIndex={rest.tabIndex ?? 0}
      className={cx(styles.button, styles[variant], styles[size], className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      custom={buttonRef}
      variants={pressedVariants}
      whileTap={reduced || isTriggerLike || inert ? undefined : "pressed"}
      transition={T.spring.snappy}
      {...rest}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
    >
      <AnimatePresence initial={false}>
        {loading ? (
          <motion.span
            key="loader"
            className={styles.loader}
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? reducedGone : { ...iconGone, scale: 0.8 }}
            transition={reduced ? { duration: T.duration.instant } : iconTransition}
          >
            <span className={styles.spinner} />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <motion.span
        className={cx(styles.labelSlot, loading && styles.loadingLabel)}
        style={{ width }}
      >
        <span ref={contentRef} className={styles.labelContent}>
          <AnimatePresence mode="popLayout" initial={false}>
            <LabelPhase key={key} icon={iconOnly} reduced={reduced}>
              {children}
            </LabelPhase>
          </AnimatePresence>
        </span>
      </motion.span>
    </motion.button>
  );
});
