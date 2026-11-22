"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowLeft, CornerDownLeft, Loader2, Plus, X } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./action-morph.module.css";

export interface ActionMorphComposer {
  /** Title shown in the composer header. */
  title: string;
  placeholder: string;
  /** Use a textarea; Mod + Enter submits. */
  multiline?: boolean;
  /** A short radio group under the field. */
  choices?: { label: string; options: string[]; defaultValue?: string };
  submitLabel: string;
  /** Announced and added to the button label after a successful submit. */
  successLabel: string;
  /** Message shown when submitting an empty field. */
  emptyHint?: string;
}

export interface ActionMorphAction {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  /** A single letter that opens this action while the menu is open. */
  shortcut?: string;
  composer: ActionMorphComposer;
}

export interface ActionMorphSubmission {
  action: string;
  text: string;
  choice?: string;
}

export interface ActionMorphProps {
  actions: ActionMorphAction[];
  /** Accessible name of the button and the title of the menu. */
  label?: string;
  /** Return a promise to hold the sending state; a rejection keeps the composer open. */
  onSubmit?: (submission: ActionMorphSubmission) => void | Promise<unknown>;
  /** Which bottom corner the button sits in. */
  corner?: "end" | "start";
  /** Milliseconds the check stays before the button returns to its plus. */
  resetAfter?: number;
  className?: string;
}

const FAB = 56;
const GROW = { type: "spring", stiffness: 420, damping: 33, mass: 1 } as const;
const FOLD = { type: "spring", stiffness: 640, damping: 50, mass: 1 } as const;
const FACE = { type: "spring", stiffness: 520, damping: 42, mass: 1 } as const;
const GLIDE = { type: "spring", stiffness: 700, damping: 48, mass: 1 } as const;
const INSTANT = { duration: 0 } as const;
const FADE = { duration: 0.15 } as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const DEPTH: Record<string, number> = { fab: 0, menu: 1 };

interface FaceCustom {
  direction: number;
  /** The transition starts or ends at the button. */
  fab: boolean;
  reduced: boolean;
}

const FACE_VARIANTS = {
  enter: (c: FaceCustom) =>
    c.reduced
      ? { opacity: 0 }
      : c.fab
        ? { opacity: 0, filter: "blur(4px)", scale: 0.92, x: 0 }
        : { opacity: 0, filter: "blur(4px)", scale: 1, x: 28 * c.direction },
  show: (c: FaceCustom) => (c.reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", scale: 1, x: 0 }),
  exit: (c: FaceCustom) =>
    c.reduced
      ? { opacity: 0 }
      : c.fab
        ? { opacity: 0, filter: "blur(4px)", scale: 0.92, x: 0 }
        : { opacity: 0, filter: "blur(4px)", scale: 1, x: -28 * c.direction },
};

function depthOf(view: string) {
  return DEPTH[view] ?? 2;
}

function initialChoices(actions: ActionMorphAction[]) {
  const map: Record<string, string> = {};
  for (const action of actions) {
    const choices = action.composer.choices;
    if (choices) map[action.id] = choices.defaultValue ?? choices.options[0];
  }
  return map;
}

export function ActionMorph({
  actions,
  label = "Create",
  onSubmit,
  corner = "end",
  resetAfter = 1600,
  className,
}: ActionMorphProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [view, setView] = useState<string>("fab");
  const [direction, setDirection] = useState(1);
  const [fabEdge, setFabEdge] = useState(true);
  const [size, setSize] = useState({ width: FAB, height: FAB });
  const [active, setActive] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>(() => initialChoices(actions));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; invalid: boolean } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [shake, setShake] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const viewRef = useRef(view);
  const focusFab = useRef(false);
  const doneTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const [highlight, setHighlight] = useState({ y: 0, height: 54 });

  const go = useCallback((next: string) => {
    const from = viewRef.current;
    if (from === next) return;
    setDirection(depthOf(next) >= depthOf(from) ? 1 : -1);
    setFabEdge(next === "fab" || from === "fab");
    viewRef.current = next;
    setView(next);
    setError(null);
  }, []);

  const close = useCallback(
    (returnFocus = true) => {
      focusFab.current = returnFocus;
      go("fab");
    },
    [go],
  );

  const open = useCallback(() => {
    window.clearTimeout(doneTimer.current);
    setDone(null);
    setActive(0);
    go("menu");
  }, [go]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(doneTimer.current);
    };
  }, []);

  // The shape follows the size of the current face.
  useLayoutEffect(() => {
    const face = faceRef.current;
    if (!face) return;
    const measure = () => {
      const width = face.offsetWidth;
      const height = face.offsetHeight;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(face);
    return () => observer.disconnect();
  }, [view]);

  // Focus moves into each new face and back to the button on close.
  useEffect(() => {
    if (view === "fab") {
      if (focusFab.current) fabRef.current?.focus({ preventScroll: true });
      focusFab.current = false;
      return;
    }
    if (view === "menu") {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[Math.min(active, (items?.length ?? 1) - 1)]?.focus({ preventScroll: true });
      return;
    }
    fieldRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useLayoutEffect(() => {
    if (view !== "menu") return;
    const item = menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!item) return;
    const next = { y: item.offsetTop, height: item.offsetHeight };
    setHighlight((prev) => (prev.y === next.y && prev.height === next.height ? prev : next));
  }, [active, view, actions]);

  // A press outside folds everything back.
  useEffect(() => {
    if (view === "fab") return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (sending) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [view, sending, close]);

  const current = actions.find((action) => action.id === view);

  const focusItem = (index: number) => {
    const count = actions.length;
    const next = (index + count) % count;
    setActive(next);
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus({ preventScroll: true });
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.target instanceof HTMLElement && event.target.getAttribute("role") !== "menuitem") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusItem(0);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(active - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(actions.length - 1);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const key = event.key.toLowerCase();
      const index = actions.findIndex((action) => action.shortcut?.toLowerCase() === key);
      if (index >= 0) {
        event.preventDefault();
        setActive(index);
        go(actions[index].id);
      }
    }
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!current || sending) return;
    const text = (drafts[current.id] ?? "").trim();
    if (!text) {
      setError({ text: current.composer.emptyHint ?? "Write something first", invalid: true });
      if (!reduced) setShake((n) => n + 1);
      fieldRef.current?.focus({ preventScroll: true });
      return;
    }
    setError(null);
    const submission: ActionMorphSubmission = { action: current.id, text };
    if (current.composer.choices) submission.choice = choices[current.id];
    const succeed = () => {
      if (!mounted.current) return;
      setSending(false);
      setDrafts((prev) => ({ ...prev, [current.id]: "" }));
      setDone(current.composer.successLabel);
      setAnnouncement(current.composer.successLabel);
      close(true);
      window.clearTimeout(doneTimer.current);
      doneTimer.current = window.setTimeout(() => setDone(null), resetAfter);
    };
    let result: void | Promise<unknown>;
    try {
      result = onSubmit?.(submission);
    } catch {
      result = Promise.reject();
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setSending(true);
      (result as Promise<unknown>).then(succeed, () => {
        if (!mounted.current) return;
        setSending(false);
        setError({ text: "Couldn’t save. Try again.", invalid: true });
        if (!reduced) setShake((n) => n + 1);
        fieldRef.current?.focus({ preventScroll: true });
      });
    } else {
      succeed();
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!sending) go("menu");
    }
  };

  const onChoiceKeyDown = (event: KeyboardEvent<HTMLDivElement>, options: string[]) => {
    if (!current) return;
    const index = options.indexOf(choices[current.id]);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setChoices((prev) => ({ ...prev, [current.id]: options[next] }));
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus({ preventScroll: true });
  };

  const growing = view !== "fab";
  const shapeTransition = reduced ? INSTANT : growing ? GROW : FOLD;
  const radius = view === "fab" ? FAB / 2 : 24;
  const custom: FaceCustom = { direction, fab: fabEdge, reduced };
  const isFab = view === "fab";
  const faceTransition = reduced ? FADE : FACE;

  const row = (index: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          transition: { ...FACE, delay: 0.04 + index * 0.035 },
        };

  let face: ReactNode;
  if (view === "fab") {
    face = (
      <motion.div
        key="fab"
        ref={faceRef}
        className={`${styles.face} ${styles.fabFace}`}
        data-face="fab"
        initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", scale: 0.6 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", scale: 0.6 }}
        transition={faceTransition}
      >
        <button
          ref={fabRef}
          type="button"
          className={styles.fab}
          aria-label={done ? `${label}. ${done}` : label}
          aria-haspopup="menu"
          aria-expanded={false}
          onClick={open}
        >
          <span className={styles.glyph} aria-hidden="true">
            <AnimatePresence initial={false} mode="popLayout">
              {done ? (
                <motion.svg
                  key="check"
                  viewBox="0 0 24 24"
                  width={22}
                  height={22}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.12, delay: reduced ? 0 : 0.1 }}
                >
                  <motion.path
                    d="M5.5 12.5l4.2 4.2 8.8-9.2"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.36, delay: 0.14, ease: EASE_OUT }}
                  />
                </motion.svg>
              ) : (
                <motion.span
                  key="plus"
                  className={styles.plus}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={faceTransition}
                >
                  <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>
      </motion.div>
    );
  } else if (view === "menu" || !current) {
    face = (
      <motion.div
        key="menu"
        ref={faceRef}
        className={`${styles.face} ${styles.menuFace}`}
        data-face="menu"
        variants={FACE_VARIANTS}
        custom={custom}
        initial="enter"
        animate="show"
        exit="exit"
        transition={faceTransition}
        onKeyDown={onMenuKeyDown}
      >
        <motion.div className={styles.header} {...row(0)}>
          <p id={`${id}-menu-title`} className={styles.title}>
            {label}
          </p>
          <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => close()}>
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </motion.div>
        <div ref={menuRef} className={styles.menu} role="menu" aria-labelledby={`${id}-menu-title`}>
          <motion.span
            className={styles.highlight}
            aria-hidden="true"
            initial={false}
            animate={{ y: highlight.y, height: highlight.height, opacity: 1 }}
            transition={reduced ? INSTANT : GLIDE}
          />
          {actions.map((action, index) => (
            <motion.button
              key={action.id}
              type="button"
              role="menuitem"
              className={styles.item}
              data-index={index}
              data-action={action.id}
              aria-keyshortcuts={action.shortcut}
              tabIndex={index === active ? 0 : -1}
              onPointerMove={() => {
                if (active !== index) setActive(index);
              }}
              onFocus={() => setActive(index)}
              onClick={() => go(action.id)}
              {...row(index + 1)}
            >
              <span className={styles.itemIcon} aria-hidden="true">
                {action.icon}
              </span>
              <span className={styles.itemText}>
                <span className={styles.itemLabel}>{action.label}</span>
                {action.description ? <span className={styles.itemDescription}>{action.description}</span> : null}
              </span>
              {action.shortcut ? (
                <kbd className={styles.kbd} aria-hidden="true">
                  {action.shortcut.toUpperCase()}
                </kbd>
              ) : null}
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  } else {
    const composer = current.composer;
    const value = drafts[current.id] ?? "";
    const fieldProps = {
      ref: fieldRef,
      placeholder: composer.placeholder,
      "aria-label": composer.title,
      value,
      readOnly: sending || undefined,
      "aria-invalid": error?.invalid ? (true as const) : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
    };
    const setValue = (text: string) => {
      setDrafts((prev) => ({ ...prev, [current.id]: text }));
      if (error) setError(null);
    };
    face = (
      <motion.div
        key={current.id}
        ref={faceRef}
        className={`${styles.face} ${styles.composerFace}`}
        data-face={current.id}
        variants={FACE_VARIANTS}
        custom={custom}
        initial="enter"
        animate="show"
        exit="exit"
        transition={faceTransition}
      >
        <form
          className={styles.form}
          aria-labelledby={`${id}-${current.id}-title`}
          aria-busy={sending || undefined}
          onSubmit={submit}
          onKeyDown={onComposerKeyDown}
          noValidate
        >
          <motion.div className={styles.header} {...row(0)}>
            <button type="button" className={styles.iconButton} aria-label="Back to actions" disabled={sending} onClick={() => go("menu")}>
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <p id={`${id}-${current.id}-title`} className={styles.title}>
              {composer.title}
            </p>
            <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => !sending && close()}>
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.div>
          <motion.div {...row(1)}>
            <motion.div key={shake} initial={false} animate={shake && !reduced ? { x: [0, -6, 5, -3, 2, 0] } : { x: 0 }} transition={{ duration: 0.36 }}>
              {composer.multiline ? (
                <textarea
                  {...fieldProps}
                  className={`${styles.field} ${styles.textarea}`}
                  rows={3}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                />
              ) : (
                <input {...fieldProps} className={styles.field} autoComplete="off" type="text" onChange={(event) => setValue(event.target.value)} />
              )}
            </motion.div>
          </motion.div>
          {composer.choices ? (
            <motion.div className={styles.choiceBlock} {...row(2)}>
              <span id={`${id}-choices`} className={styles.choiceLabel}>
                {composer.choices.label}
              </span>
              <div
                className={styles.choices}
                role="radiogroup"
                aria-labelledby={`${id}-choices`}
                style={{ ["--count" as string]: composer.choices.options.length }}
                onKeyDown={(event) => onChoiceKeyDown(event, composer.choices!.options)}
              >
                {composer.choices.options.map((option) => {
                  const checked = choices[current.id] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      className={styles.choice}
                      disabled={sending}
                      onClick={() => setChoices((prev) => ({ ...prev, [current.id]: option }))}
                    >
                      {checked ? (
                        <motion.span
                          layoutId={`${id}-${current.id}-pill`}
                          className={styles.choicePill}
                          aria-hidden="true"
                          transition={reduced ? INSTANT : GLIDE}
                        />
                      ) : null}
                      <span className={styles.choiceText}>{option}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
          <motion.div className={styles.footer} {...row(composer.choices ? 3 : 2)}>
            <span id={`${id}-error`} className={styles.status} aria-live="polite">
              <AnimatePresence initial={false}>
                {error ? (
                  <motion.span
                    key={error.text}
                    className={styles.error}
                    initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, position: "absolute" }}
                    transition={reduced ? FADE : FACE}
                  >
                    <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
                    {error.text}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </span>
            <button type="submit" className={styles.submit} aria-disabled={sending || undefined}>
              <span className={styles.submitFace} data-on={sending ? undefined : true} aria-hidden={sending || undefined}>
                {composer.submitLabel}
                <CornerDownLeft size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className={styles.submitFace} data-on={sending ? true : undefined} aria-hidden={!sending}>
                <Loader2 className={styles.spinner} size={14} strokeWidth={1.75} aria-hidden="true" />
                Saving
              </span>
            </button>
          </motion.div>
        </form>
      </motion.div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-corner={corner}
      data-view={isFab ? "fab" : view === "menu" ? "menu" : "composer"}
      data-done={isFab && done ? true : undefined}
    >
      <motion.div
        className={styles.shape}
        initial={false}
        animate={{ width: size.width, height: size.height, borderRadius: radius }}
        transition={shapeTransition}
        style={{ width: FAB, height: FAB, borderRadius: FAB / 2 }}
      >
        <AnimatePresence initial={false} custom={custom}>
          {face}
        </AnimatePresence>
      </motion.div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        <span>{announcement}</span>
      </span>
    </div>
  );
}

export default ActionMorph;
