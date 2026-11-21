"use client";

import { memo, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls, type Transition } from "motion/react";
import { Archive, Check, CircleAlert, Trash2 } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./undo-toast.module.css";

/** One kind of removal: its button label, its past tense for the toast and an optional icon. */
export interface UndoAction { label: string; done: string; icon?: ReactNode }
/** A removed item with the kind of removal and the index it had in the list. */
export interface UndoEntry<T> { key: string; item: T; kind: string; index: number }
export interface UndoRowContext {
  /** Removes this row with an action kind; the first key of `actions` when omitted. */
  remove: (kind?: string) => void;
  /** True while the row is folded away. */
  removed: boolean;
  /** Changes each time the row is put back. */
  restoredAt: number | undefined;
}
export interface UndoToastHandle { remove: (key: string, kind?: string) => void; undo: () => void; commit: () => void }

export interface UndoToastProps<T> {
  /** A stable key for each item. */
  getKey: (item: T) => string;
  /** Renders one row. */
  renderItem: (item: T, ctx: UndoRowContext) => ReactNode;
  /** Accessible name of the list. */
  label: string;
  /** Controlled items. Removed rows stay in this array, folded away, until the batch is committed. */
  items?: readonly T[];
  defaultItems?: readonly T[];
  /** Called with the new list when a batch is committed, never while it can still be undone. */
  onItemsChange?: (items: T[]) => void;
  /** The kinds of removal. The first key is the default kind. */
  actions?: Record<string, UndoAction>;
  /** Singular and plural nouns for the toast. */
  noun?: readonly [string, string];
  /** Milliseconds the undo window stays open. */
  duration?: number;
  onRemove?: (entries: UndoEntry<T>[]) => void;
  onUndo?: (entries: UndoEntry<T>[]) => void | Promise<unknown>;
  onCommit?: (entries: UndoEntry<T>[]) => void | Promise<unknown>;
  /** Cmd+Z or Ctrl+Z undo the pending batch. */
  undoShortcut?: boolean;
  /** Hovering or focusing the toast pauses the countdown. */
  pauseOnHover?: boolean;
  /** Shown once every row is gone. */
  empty?: ReactNode;
  toastPlacement?: "container" | "viewport";
  ref?: Ref<UndoToastHandle>;
  className?: string;
  style?: CSSProperties;
}

export interface UndoToastRowProps {
  title: ReactNode;
  leading?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Single key shortcuts on the focused row. */
  shortcuts?: Record<string, () => void>;
  label?: string;
  unread?: boolean;
  className?: string;
}

export interface UndoToastRowActionProps { label: string; icon: ReactNode; onClick: () => void }

const DEFAULT_ACTIONS: Record<string, UndoAction> = {
  archive: { label: "Archive", done: "archived", icon: <Archive size={16} /> },
  delete: { label: "Delete", done: "deleted", icon: <Trash2 size={16} /> },
};
const DEFAULT_NOUN = ["item", "items"] as const;
const FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const RESTORED_MS = 2200;
const ERROR_MS = 4200;

type Phase = "pending" | "restoring" | "restored" | "error";
type Token = string | number;
interface State<T> {
  phase: Phase | null;
  batch: UndoEntry<T>[];
  committing: UndoEntry<T>[];
  tokens: Token[];
  restored: Record<string, { at: number; order: number }>;
  merges: number;
}

const subscribeNever = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const isThenable = (value: unknown): value is PromiseLike<unknown> => !!value && typeof (value as PromiseLike<unknown>).then === "function";

function describe<T>(entries: UndoEntry<T>[], actions: Record<string, UndoAction>, noun: readonly [string, string]): Token[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  const kinds = [...Object.keys(actions).filter(kind => counts.has(kind)), ...[...counts.keys()].filter(kind => !(kind in actions))];
  const done = (kind: string) => actions[kind]?.done ?? "removed";
  if (kinds.length === 1) return entries.length === 1 ? [`${capitalize(noun[0])} ${done(kinds[0])}`] : [entries.length, ` ${noun[1]} ${done(kinds[0])}`];
  return kinds.flatMap<Token>((kind, i) => [counts.get(kind) ?? 0, ` ${done(kind)}${i < kinds.length - 1 ? ", " : ""}`]);
}

function failure<T>(entries: UndoEntry<T>[], actions: Record<string, UndoAction>, noun: readonly [string, string]): Token[] {
  const kinds = new Set(entries.map(entry => entry.kind));
  const verb = kinds.size === 1 ? (actions[entries[0].kind]?.label ?? "Remove").toLowerCase() : "remove";
  return entries.length === 1 ? [`Couldn't ${verb} ${noun[0]}`] : [`Couldn't ${verb} `, entries.length, ` ${noun[1]}`];
}

function reopen<T>(current: State<T>, entries: UndoEntry<T>[]) {
  const restored = { ...current.restored };
  const at = performance.now();
  [...entries].sort((a, b) => a.index - b.index).forEach((entry, order) => { restored[entry.key] = { at: at + order, order }; });
  return restored;
}

/** A number whose digits roll up as it changes. */
function Roll({ value, reduce }: { value: number | string; reduce: boolean }) {
  const transition: Transition = reduce ? { duration: 0 } : motionTokens.spring.snappy;
  return <span className={styles.roll}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={value} className={styles.rollDigit} initial={reduce ? false : { opacity: 0, y: "80%", filter: "blur(2px)" }} animate={{ opacity: 1, y: "0%", filter: "blur(0px)" }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-80%", filter: "blur(2px)" }} transition={transition}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

interface RowProps<T> {
  item: T;
  itemKey: string;
  removed: boolean;
  restoredAt: number | undefined;
  order: number;
  reduce: boolean;
  renderItem: (item: T, ctx: UndoRowContext) => ReactNode;
  removeKey: (key: string, kind?: string) => void;
}

function RowView<T>({ item, itemKey, removed, restoredAt, order, reduce, renderItem, removeKey }: RowProps<T>) {
  const ctx = useMemo<UndoRowContext>(() => ({ remove: kind => removeKey(itemKey, kind), removed, restoredAt }), [itemKey, removeKey, removed, restoredAt]);
  const delay = removed || reduce ? 0 : order * motionTokens.stagger.item;
  const instant: Transition = { duration: 0 };
  return <motion.li
    data-key={itemKey}
    className={styles.row}
    aria-hidden={removed || undefined}
    inert={removed || undefined}
    initial={false}
    animate={{ height: removed ? 0 : "auto" }}
    transition={reduce ? instant : { ...motionTokens.spring.smooth, delay }}
  >
    <motion.div
      className={styles.rowInner}
      initial={false}
      animate={removed ? { opacity: 0, x: 28, scale: .985, filter: "blur(2px)" } : { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
      transition={reduce ? instant : removed ? { duration: .18, ease: [...motionTokens.ease.standard] } : { ...motionTokens.spring.snappy, delay: delay + .09 }}
    >
      {restoredAt !== undefined && !removed && <span key={restoredAt} className={styles.flash} aria-hidden="true" />}
      {renderItem(item, ctx)}
    </motion.div>
  </motion.li>;
}
const Row = memo(RowView) as typeof RowView;

export function UndoToast<T>({ getKey, renderItem, label, items: controlledItems, defaultItems, onItemsChange, actions = DEFAULT_ACTIONS, noun = DEFAULT_NOUN, duration = 6000, onRemove, onUndo, onCommit, undoShortcut = true, pauseOnHover = true, empty, toastPlacement = "container", ref, className, style }: UndoToastProps<T>) {
  const reduce = !!useReducedMotion();
  const apple = useSyncExternalStore(subscribeNever, isApple, () => false);
  const liveId = useId();
  const [ownItems, setOwnItems] = useState<readonly T[]>(() => defaultItems ?? []);
  const items = controlledItems ?? ownItems;
  const [state, setState] = useState<State<T>>({ phase: null, batch: [], committing: [], tokens: [], restored: {}, merges: 0 });
  const [seconds, setSeconds] = useState(() => Math.ceil(duration / 1000));

  const root = useRef<HTMLDivElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const progress = useMotionValue(1);
  const nudge = useMotionValue(1);
  const dash = useTransform(progress, value => `${Math.max(0, Math.min(1, value))} 1`);
  const drain = useRef<AnimationPlaybackControls | null>(null);
  const refill = useRef<AnimationPlaybackControls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holds = useRef({ hover: false, focus: false, hidden: false });

  // The latest props and state, read by handlers that outlive a render (timers, promises, the ref handle).
  const live = useRef({ state, items, getKey, actions, noun, duration, onRemove, onUndo, onCommit, onItemsChange, controlled: controlledItems !== undefined, reduce, pauseOnHover });
  useLayoutEffect(() => {
    Object.assign(live.current, { items, getKey, actions, noun, duration, onRemove, onUndo, onCommit, onItemsChange, controlled: controlledItems !== undefined, reduce, pauseOnHover });
  });
  const update = useCallback((next: State<T>) => { live.current.state = next; setState(next); }, []);

  useMotionValueEvent(progress, "change", value => {
    const next = Math.max(1, Math.ceil((value * live.current.duration) / 1000 - .001));
    setSeconds(current => (current === next ? current : next));
  });

  const held = () => { const h = holds.current; return h.hidden || (live.current.pauseOnHover && (h.hover || h.focus)); };
  const syncPause = useCallback(() => {
    if (!drain.current) return;
    if (held()) drain.current.pause(); else drain.current.play();
  }, []);

  const stopClock = useCallback(() => {
    drain.current?.stop(); drain.current = null;
    refill.current?.stop(); refill.current = null;
  }, []);
  const clearHide = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };
  const hideLater = useCallback((ms: number, phase: Phase) => {
    clearHide();
    hideTimer.current = setTimeout(() => {
      const current = live.current.state;
      if (current.phase === phase) update({ ...current, phase: null });
    }, ms);
  }, [update]);

  const finalize = useCallback((entries: UndoEntry<T>[]) => {
    const l = live.current;
    const gone = new Set(entries.map(entry => entry.key));
    const next = l.items.filter(item => !gone.has(l.getKey(item)));
    update({ ...l.state, committing: l.state.committing.filter(entry => !gone.has(entry.key)) });
    if (!l.controlled) setOwnItems(next);
    l.onItemsChange?.(next);
  }, [update]);

  const commit = useCallback(() => {
    const l = live.current;
    const current = l.state;
    if (current.phase !== "pending") return;
    stopClock();
    const entries = current.batch;
    update({ ...current, phase: null, batch: [], committing: [...current.committing, ...entries] });
    let result: unknown;
    try { result = l.onCommit?.(entries); } catch (error) { result = Promise.reject(error); }
    Promise.resolve(result).then(() => finalize(entries), () => {
      const now = live.current.state;
      const gone = new Set(entries.map(entry => entry.key));
      const committing = now.committing.filter(entry => !gone.has(entry.key));
      const restored = reopen(now, entries);
      if (now.phase === "pending" || now.phase === "restoring") { update({ ...now, committing, restored }); return; }
      update({ ...now, committing, restored, phase: "error", tokens: failure(entries, live.current.actions, live.current.noun) });
      hideLater(ERROR_MS, "error");
    });
  }, [finalize, hideLater, stopClock, update]);

  const startClock = useCallback((spring: boolean) => {
    stopClock();
    const run = () => {
      refill.current = null;
      drain.current = animate(progress, 0, { duration: (progress.get() * live.current.duration) / 1000, ease: "linear", onComplete: () => { drain.current = null; commit(); } });
      if (held()) drain.current.pause();
    };
    if (spring && !live.current.reduce) refill.current = animate(progress, 1, { ...motionTokens.spring.snappy, onComplete: run });
    else { progress.set(1); run(); }
  }, [commit, progress, stopClock]);

  const removeKey = useCallback((key: string, kind?: string) => {
    const l = live.current;
    const current = l.state;
    if (current.phase === "restoring") return;
    if (current.batch.some(entry => entry.key === key) && current.phase === "pending") return;
    if (current.committing.some(entry => entry.key === key)) return;
    const index = l.items.findIndex(item => l.getKey(item) === key);
    if (index < 0) return;
    const entry: UndoEntry<T> = { key, item: l.items[index], kind: kind ?? Object.keys(l.actions)[0] ?? "remove", index };
    const merging = current.phase === "pending";
    const batch = merging ? [...current.batch, entry] : [entry];

    // Hand focus to the same control on the next row, or the previous one; with none left, to Undo.
    const list = root.current?.querySelector(`.${styles.list}`);
    const row = list?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    const active = document.activeElement;
    if (row && active instanceof HTMLElement && row.contains(active)) {
      const slot = [...row.querySelectorAll<HTMLElement>(FOCUSABLE)].indexOf(active);
      const rows = [...(list?.querySelectorAll<HTMLElement>(`.${styles.row}`) ?? [])];
      const at = rows.indexOf(row);
      const open = (node: HTMLElement) => node.getAttribute("aria-hidden") !== "true";
      const target = rows.slice(at + 1).find(open) ?? rows.slice(0, at).reverse().find(open);
      if (target) { const controls = target.querySelectorAll<HTMLElement>(FOCUSABLE); (controls[slot] ?? controls[0])?.focus(); }
      else requestAnimationFrame(() => undoButton.current?.focus());
    }

    clearHide();
    const restored = { ...current.restored };
    delete restored[key];
    update({ ...current, phase: "pending", batch, tokens: describe(batch, l.actions, l.noun), restored, merges: current.merges + (merging ? 1 : 0) });
    if (merging && !l.reduce) animate(nudge, 1, { type: "spring", stiffness: 520, damping: 30, velocity: 1.1 });
    startClock(merging);
    l.onRemove?.([entry]);
  }, [nudge, startClock, update]);

  const undo = useCallback(() => {
    const l = live.current;
    const current = l.state;
    if (current.phase !== "pending" || current.batch.length === 0) return;
    stopClock();
    const entries = current.batch;
    const fromToast = !!root.current?.querySelector(`.${styles.toast}`)?.contains(document.activeElement);
    const done = () => {
      const now = live.current.state;
      const first = [...entries].sort((a, b) => a.index - b.index)[0];
      update({ ...now, phase: "restored", batch: [], restored: reopen(now, entries), tokens: entries.length === 1 ? [`${capitalize(live.current.noun[0])} restored`] : [entries.length, ` ${live.current.noun[1]} restored`] });
      hideLater(RESTORED_MS, "restored");
      if (fromToast && first) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(first.key)}"]`)?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
    };
    let result: unknown;
    try { result = l.onUndo?.(entries); } catch (error) { result = Promise.reject(error); }
    if (!isThenable(result)) { done(); return; }
    update({ ...current, phase: "restoring", tokens: ["Restoring"] });
    result.then(done, () => {
      update({ ...live.current.state, phase: "pending", tokens: ["Couldn't undo, try again"] });
      startClock(true);
    });
  }, [hideLater, startClock, stopClock, update]);

  useImperativeHandle(ref, () => ({ remove: removeKey, undo, commit }), [removeKey, undo, commit]);

  useEffect(() => {
    const onVisibility = () => { holds.current.hidden = document.visibilityState === "hidden"; syncPause(); };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [syncPause]);

  useEffect(() => {
    if (!undoShortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "z" || event.shiftKey || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (live.current.state.phase !== "pending") return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, undoShortcut]);

  useEffect(() => () => { drain.current?.stop(); refill.current?.stop(); if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const { phase, tokens } = state;
  const folded = useMemo(() => {
    const keys = new Set(state.committing.map(entry => entry.key));
    if (phase === "pending" || phase === "restoring") for (const entry of state.batch) keys.add(entry.key);
    return keys;
  }, [phase, state.batch, state.committing]);
  const allGone = items.every(item => folded.has(getKey(item)));

  const text = tokens.join("");
  const shape = tokens.map(token => (typeof token === "number" ? "#" : token)).join("");
  const announcement = phase === null ? "" : phase === "pending" && state.batch.length > 0 && !text.startsWith("Couldn't") ? `${text}. Press ${apple ? "Command" : "Control"} Z or the Undo button to undo.` : text;
  const lead = phase === "pending" ? "ring" : phase === "restoring" ? "spinner" : phase === "restored" ? "done" : "error";
  const spring: Transition = reduce ? { duration: 0 } : motionTokens.spring.snappy;
  const faceExit = { opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit } };

  const onToastKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && live.current.state.phase === "pending") { event.stopPropagation(); commit(); }
  };

  return <div ref={root} className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
    <ul className={styles.list} aria-label={label}>
      {items.map(item => {
        const key = getKey(item);
        const restored = state.restored[key];
        return <Row key={key} item={item} itemKey={key} removed={folded.has(key)} restoredAt={restored?.at} order={restored?.order ?? 0} reduce={reduce} renderItem={renderItem} removeKey={removeKey} />;
      })}
    </ul>
    <AnimatePresence initial={false}>
      {allGone && empty !== undefined && <motion.div key="empty" className={styles.empty} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit } }} transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.considered, ease: [...motionTokens.ease.enter], delay: .12 }}>{empty}</motion.div>}
    </AnimatePresence>
    <div id={liveId} className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    <div className={styles.toastLayer} data-placement={toastPlacement}>
      <AnimatePresence>
        {phase !== null && <motion.div
          key="toast"
          className={styles.toastShell}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: .94, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: motionTokens.duration.exit } } : { opacity: 0, y: 12, scale: .97, filter: "blur(2px)", transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          transition={reduce ? { duration: motionTokens.duration.fast } : motionTokens.spring.morph}
        >
          <motion.div
            className={styles.toast}
            data-phase={phase}
            role="group"
            aria-label="Undo"
            aria-describedby={liveId}
            style={{ scale: nudge }}
            onKeyDown={onToastKey}
            onPointerEnter={() => { holds.current.hover = true; syncPause(); }}
            onPointerLeave={() => { holds.current.hover = false; syncPause(); }}
            onFocus={() => { holds.current.focus = true; syncPause(); }}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { holds.current.focus = false; syncPause(); } }}
          >
            <span className={styles.lead} aria-hidden="true">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span key={lead} className={styles.leadFace} data-lead={lead} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: .5, rotate: lead === "ring" || lead === "spinner" ? 0 : -45 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={reduce ? faceExit : { opacity: 0, scale: .5, transition: { duration: motionTokens.duration.exit } }} transition={spring}>
                  {lead === "ring" ? <span className={styles.countdown}>
                    <svg viewBox="0 0 24 24" className={styles.ring}>
                      <circle cx="12" cy="12" r="10" className={styles.ringTrack} />
                      <motion.circle cx="12" cy="12" r="10" className={styles.ringFill} pathLength={1} strokeDashoffset={0} strokeDasharray={dash} />
                    </svg>
                    <span className={styles.seconds}><Roll value={seconds} reduce={reduce} /></span>
                  </span> : lead === "spinner" ? <span className={styles.spinner} /> : lead === "done" ? <Check size={16} strokeWidth={2} /> : <CircleAlert size={16} strokeWidth={2} />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={styles.message}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span key={shape} className={styles.messageFace} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduce ? faceExit : { opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: motionTokens.duration.exit } }} transition={spring}>
                  {tokens.map((token, i) => (typeof token === "number" ? <Roll key={i} value={token} reduce={reduce} /> : token))}
                </motion.span>
              </AnimatePresence>
            </span>
            <AnimatePresence initial={false} mode="popLayout">
              {(phase === "pending" || phase === "restoring") && <motion.button
                key="undo"
                ref={undoButton}
                type="button"
                className={styles.undo}
                aria-keyshortcuts={undoShortcut ? "Meta+Z Control+Z" : undefined}
                disabled={phase === "restoring"}
                onClick={undo}
                initial={{ opacity: 0, scale: reduce ? 1 : .9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : .9, transition: { duration: reduce ? 0 : motionTokens.duration.exit } }}
                transition={spring}
              >
                Undo{undoShortcut && <kbd className={styles.kbd} aria-hidden="true">{apple ? "⌘Z" : "Ctrl Z"}</kbd>}
              </motion.button>}
            </AnimatePresence>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>
  </div>;
}

/** A ready made row: leading media, a title and description, and metadata that gives way to the actions on hover and focus. */
export function UndoToastRow({ title, leading, description, meta, actions, shortcuts, label, unread, className }: UndoToastRowProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!shortcuts || event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return;
    const run = shortcuts[event.key] ?? shortcuts[event.key.toLowerCase()];
    if (!run) return;
    event.preventDefault();
    run();
  };
  return <div className={[styles.item, className].filter(Boolean).join(" ")} data-unread={unread || undefined} tabIndex={0} aria-label={label} onKeyDown={onKeyDown}>
    {leading !== undefined && <span className={styles.leading}>{leading}</span>}
    <span className={styles.body}>
      <span className={styles.title}>{title}</span>
      {description !== undefined && <span className={styles.description}>{description}</span>}
    </span>
    <span className={styles.trailing}>
      {meta !== undefined && <span className={styles.meta}>{meta}</span>}
      {actions !== undefined && <span className={styles.actions}>{actions}</span>}
    </span>
  </div>;
}

/** A round icon button for a row action, named by its label. */
export function UndoToastRowAction({ label, icon, onClick }: UndoToastRowActionProps) {
  return <button type="button" className={styles.rowAction} aria-label={label} title={label} onClick={event => { event.stopPropagation(); onClick(); }}>{icon}</button>;
}

export default UndoToast;
