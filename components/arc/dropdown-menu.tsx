"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import styles from "./dropdown-menu.module.css";
import { motionTokens as T, cx } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";

export type DropdownItem = {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
};

function MorphLabel({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const measureRef = useRef<HTMLSpanElement>(null);
  const lastText = useRef<string | null>(null);
  const [size, setSize] = useState<{ width: number | "auto"; animate: boolean }>({
    width: "auto",
    animate: false,
  });

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const current = el.textContent;
      const changed = lastText.current !== null && lastText.current !== current;
      lastText.current = current;
      setSize({
        width: Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth),
        animate: changed,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.span
      className={styles.label}
      initial={false}
      animate={{ width: size.width }}
      transition={size.animate && !reduced ? T.spring.morph : { duration: 0 }}
    >
      <span ref={measureRef} className={styles.labelMeasure} aria-hidden="true">
        {text}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.labelText}
          initial={
            reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${T.blur.soft}px)` }
          }
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  opacity: 0,
                  y: "-0.3em",
                  filter: `blur(${T.blur.subtle}px)`,
                  transition: { duration: 0.15, ease: T.ease.standard },
                }
          }
          transition={{ duration: 0.24, ease: T.ease.enter }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

type Highlight = { top: number; height: number; danger: boolean; glide: boolean };

export function DropdownMenu({
  label,
  items,
  icon,
}: {
  label: string;
  items: DropdownItem[];
  icon?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const pointer = useRef(false);
  const clearTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const item =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[role="menuitem"]')
        : null;
    window.clearTimeout(clearTimer.current);
    if (!item) {
      clearTimer.current = window.setTimeout(() => setHighlight(null), pointer.current ? 70 : 0);
      return;
    }
    const next = {
      top: item.offsetTop,
      height: item.offsetHeight,
      danger: item.dataset.tone === "danger",
    };
    const byPointer = pointer.current;
    setHighlight((prev) => ({ ...next, glide: byPointer && prev !== null }));
  };

  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (open) {
          window.clearTimeout(clearTimer.current);
          setHighlight(null);
        }
      }}
    >
      <Menu.Trigger className={styles.trigger} type="button">
        {icon && (
          <span className={styles.triggerIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        <MorphLabel text={label} />
        <ChevronDown className={styles.chevron} size={15} strokeWidth={1.8} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className={styles.menu}
          sideOffset={6}
          align="end"
          collisionPadding={12}
          loop
          onFocus={onFocus}
          onPointerMoveCapture={() => {
            pointer.current = true;
          }}
          onKeyDownCapture={() => {
            pointer.current = false;
          }}
        >
          <motion.span
            className={styles.highlight}
            data-tone={highlight?.danger ? "danger" : undefined}
            aria-hidden="true"
            initial={false}
            animate={
              highlight
                ? { y: highlight.top, height: highlight.height, opacity: 1 }
                : { opacity: 0 }
            }
            transition={{
              default: highlight?.glide && !reduced ? T.spring.snappy : { duration: 0 },
              opacity: { duration: reduced ? 0 : 0.08 },
            }}
          />
          {items.map((item, i) => (
            <Fragment key={item.label}>
              {item.separatorBefore && <Menu.Separator className={styles.separator} />}
              <Menu.Item
                className={cx(styles.item, item.destructive && styles.destructive)}
                data-tone={item.destructive ? "danger" : undefined}
                style={{ "--i": i } as CSSProperties}
                disabled={item.disabled}
                onSelect={item.onSelect}
              >
                {item.icon && (
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </Menu.Item>
            </Fragment>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
