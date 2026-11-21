"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from "motion/react";
import { X } from "lucide-react";
import styles from "./card-to-article.module.css";

export interface ArticleItem {
  id: string;
  title: string;
  image: string;
  imageAlt: string;
  body: ReactNode;
  tag?: string;
  meta?: string;
}

export interface CardToArticleProps {
  /** Each item has id, title, image, imageAlt, body, and optional tag and meta. */
  items: ArticleItem[];
  /** Id of the open article. Leave it out for uncontrolled use. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  /** Ratio of the card and the article hero. They match, so the morph is a pure scale. */
  aspectRatio?: number;
  closeLabel?: string;
  className?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const OPEN: Transition = { type: "spring", stiffness: 300, damping: 32, mass: 1 };
const CLOSE: Transition = { type: "spring", stiffness: 380, damping: 40, mass: 1 };
const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

function Hero({ item, titleId, open }: { item: ArticleItem; titleId?: string; open?: boolean }) {
  return (
    <div className={styles.hero}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={item.image} alt={open ? item.imageAlt : ""} draggable={false} />
      <span className={styles.scrim} aria-hidden="true" />
      {item.tag && <span className={styles.tag}>{item.tag}</span>}
      <span className={styles.caption}>
        {titleId ? (
          <h2 id={titleId} className={styles.title}>
            {item.title}
          </h2>
        ) : (
          <span className={styles.title}>{item.title}</span>
        )}
        {item.meta && <span className={styles.meta}>{item.meta}</span>}
      </span>
    </div>
  );
}

/** A grid of story cards; a card opens into a full scrolling article with a shared element morph and closes back into its slot. */
export function CardToArticle({ items, value, defaultValue = null, onValueChange, aspectRatio = 4 / 3, closeLabel = "Close article", className }: CardToArticleProps) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion() ?? false;
  const [inner, setInner] = useState<string | null>(defaultValue);
  const openId = value !== undefined ? value : inner;
  /* The article that is on screen: it stays mounted while it shrinks back. */
  const [shown, setShown] = useState<{ id: string; rect: Rect; open: boolean } | null>(null);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pull = useMotionValue(0);
  const liftY = useTransform(pull, (v) => v * 0.9);
  const liftScale = useTransform(pull, (v) => 1 - Math.min(0.22, v / 1400));
  const fade = useTransform(pull, (v) => 1 - Math.min(0.7, v / 420));
  const progress = useMotionValue(0);

  const setOpen = useCallback(
    (id: string | null) => {
      if (value === undefined) setInner(id);
      onValueChange?.(id);
    },
    [value, onValueChange],
  );

  const measure = (id: string): Rect => {
    const el = cards.current.get(id)?.parentElement;
    const r = el?.getBoundingClientRect();
    return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : { top: 0, left: 0, width: 0, height: 0 };
  };

  /* Open: mount the sheet on the card's slot, then let it spring to the article. Close: re-measure the slot and land in it. */
  useLayoutEffect(() => {
    if (openId && items.some((item) => item.id === openId)) {
      if (shown?.id === openId && shown.open) return;
      if (shown?.id !== openId) {
        pull.set(0);
        progress.set(0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShown({ id: openId, rect: measure(openId), open: false });
        return;
      }
      const frame = requestAnimationFrame(() => setShown((s) => (s && s.id === openId ? { ...s, open: true } : s)));
      return () => cancelAnimationFrame(frame);
    }
    if (shown?.open) {
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
      progress.set(0);
      if (reduced) pull.set(0);
      else animate(pull, 0, CLOSE);
      setShown({ id: shown.id, rect: measure(shown.id), open: false });
      const done = setTimeout(() => setShown((s) => (s && !s.open ? null : s)), reduced ? 0 : 460);
      return () => clearTimeout(done);
    }
    if (shown && !shown.open) {
      const done = setTimeout(() => setShown((s) => (s && !s.open ? null : s)), reduced ? 0 : 460);
      return () => clearTimeout(done);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, shown, items, reduced]);

  /* Lock page scroll and keep the scrollbar's space. */
  const locked = !!shown;
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    const before = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    const bar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (bar > 0) root.style.paddingRight = `${bar}px`;
    return () => {
      root.style.overflow = before.overflow;
      root.style.paddingRight = before.paddingRight;
    };
  }, [locked]);

  const isOpen = !!shown?.open;
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (isOpen && shown) {
      lastId.current = shown.id;
      closeRef.current?.focus({ preventScroll: true });
    } else if (!locked && lastId.current) {
      cards.current.get(lastId.current)?.focus({ preventScroll: true });
      lastId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, locked]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(null);
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = [...(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !sheetRef.current?.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !sheetRef.current?.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  /* Pull to dismiss: touch anywhere at the top, the hero with a mouse, or a trackpad pull past the top. */
  const drag = useRef<{ id: number; y: number; t: number; v: number; active: boolean; hero: boolean } | null>(null);
  const release = (velocity: number) => {
    if (pull.get() > 110 || velocity > 0.6) setOpen(null);
    else animate(pull, 0, CLOSE);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOpen || (event.pointerType === "mouse" && event.button !== 0)) return;
    const hero = !!(event.target as HTMLElement).closest(`.${styles.heroWrap}`);
    if (event.pointerType === "mouse" && !hero) return;
    if ((event.target as HTMLElement).closest("button,a")) return;
    drag.current = { id: event.pointerId, y: event.clientY, t: performance.now(), v: 0, active: false, hero };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dy = event.clientY - d.y;
    const now = performance.now();
    if (!d.active) {
      if ((scrollerRef.current?.scrollTop ?? 0) > 0 || dy < 6) return;
      d.active = true;
      d.y = event.clientY;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    d.v = (event.clientY - d.y - pull.get()) / Math.max(1, now - d.t);
    d.t = now;
    pull.set(Math.max(0, dy));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (d.active) release(d.v);
  };
  const wheelEnd = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isOpen) return;
    const onWheel = (event: WheelEvent) => {
      if (el.scrollTop > 0 || (event.deltaY >= 0 && pull.get() <= 0)) return;
      event.preventDefault();
      pull.set(Math.max(0, Math.min(260, pull.get() - event.deltaY * 0.6)));
      if (wheelEnd.current) clearTimeout(wheelEnd.current);
      wheelEnd.current = setTimeout(() => release(0), 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelEnd.current) clearTimeout(wheelEnd.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const item = shown ? items.find((i) => i.id === shown.id) : undefined;
  const ratio = { "--ratio": aspectRatio } as CSSProperties;
  const move = reduced ? { duration: 0 } : isOpen ? OPEN : CLOSE;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={ratio}>
      <ul className={styles.grid}>
        {items.map((card) => (
          <li key={card.id} className={styles.slot}>
            <button
              type="button"
              ref={(el) => {
                if (el) cards.current.set(card.id, el);
                else cards.current.delete(card.id);
              }}
              className={styles.card}
              aria-haspopup="dialog"
              aria-expanded={openId === card.id}
              data-away={shown?.id === card.id ? "" : undefined}
              onClick={() => setOpen(card.id)}
            >
              <Hero item={card} />
            </button>
          </li>
        ))}
      </ul>
      {shown && item && typeof document !== "undefined"
        ? createPortal(
            <div className={styles.layer} style={ratio} onKeyDown={onKeyDown}>
              <motion.div
                className={styles.backdrop}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={reduced ? { duration: 0 } : { duration: isOpen ? 0.3 : 0.24, ease: [0.2, 0, 0, 1] }}
                style={isOpen ? { opacity: fade } : undefined}
                onClick={() => setOpen(null)}
              />
              <motion.div className={styles.lift} style={{ y: liftY, scale: liftScale }}>
                <motion.div
                  ref={sheetRef}
                  layout
                  className={styles.sheet}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`${uid}-title`}
                  data-open={isOpen ? "true" : undefined}
                  style={{ borderRadius: isOpen ? 32 : 26, ...(isOpen ? null : shown.rect) }}
                  transition={{ layout: move }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <motion.span className={styles.progress} aria-hidden="true" style={{ scaleX: progress }} />
                  <div
                    className={styles.scroller}
                    ref={scrollerRef}
                    onScroll={(event) => {
                      const el = event.currentTarget;
                      const max = el.scrollHeight - el.clientHeight;
                      progress.set(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
                    }}
                  >
                    <motion.div layout className={styles.heroWrap} transition={{ layout: move }}>
                      <Hero item={item} titleId={`${uid}-title`} open />
                    </motion.div>
                    <motion.div
                      layout="position"
                      className={styles.body}
                      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
                      animate={{ opacity: isOpen ? 1 : 0, y: isOpen || reduced ? 0 : 24 }}
                      transition={reduced ? { duration: 0 } : isOpen ? { duration: 0.36, delay: 0.16, ease: [0.2, 0, 0, 1], layout: move } : { duration: 0.12, layout: move }}
                    >
                      {item.body}
                    </motion.div>
                  </div>
                  <motion.button
                    type="button"
                    ref={closeRef}
                    className={styles.close}
                    aria-label={closeLabel}
                    initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                    animate={{ opacity: isOpen ? 1 : 0, scale: isOpen || reduced ? 1 : 0.6 }}
                    transition={reduced ? { duration: 0 } : isOpen ? { type: "spring", stiffness: 500, damping: 30, delay: 0.3 } : { duration: 0.1 }}
                    onClick={() => setOpen(null)}
                  >
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                </motion.div>
              </motion.div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default CardToArticle;
