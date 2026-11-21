"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Check, CircleAlert } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./confirm-popover.module.css";

export type ConfirmPopoverPhase = "idle" | "confirming" | "working" | "success" | "error";

export interface ConfirmPopoverContext {
  /** Report progress from 0 to 1. Without it the bar sweeps. */
  setProgress: (progress: number) => void;
  /** Aborts if the component unmounts. */
  signal: AbortSignal;
}

export interface ConfirmPopoverProps {
  children: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  successLabel?: string;
  errorTitle?: ReactNode;
  retryLabel?: string;
  tone?: "danger" | "neutral";
  onConfirm?: (ctx: ConfirmPopoverContext) => void | Promise<unknown>;
  onCancel?: () => void;
  onDone?: () => void;
  onError?: (error: unknown) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPhaseChange?: (phase: ConfirmPopoverPhase) => void;
  align?: "start" | "center" | "end";
  side?: "bottom" | "top" | "auto";
  width?: number;
  resultDuration?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Geometry { tw: number; th: number; radius: number; w: number; x: number; up: boolean; right: boolean }

const INSTANT = { duration: 0 };
const SMOOTH = { ...motionTokens.spring.smooth };
const SNAPPY = { ...motionTokens.spring.snappy };
const ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const normalize = (value: string) => value.trim().toLowerCase();

export function ConfirmPopover({
  children,
  icon,
  title,
  description,
  confirmText,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  pendingLabel = "Deleting",
  successLabel = "Deleted",
  errorTitle = "That didn't work",
  retryLabel = "Try again",
  tone = "danger",
  onConfirm,
  onCancel,
  onDone,
  onError,
  open,
  defaultOpen = false,
  onOpenChange,
  onPhaseChange,
  align = "start",
  side = "auto",
  width = 320,
  resultDuration = 1600,
  disabled,
  className,
  style,
}: ConfirmPopoverProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const inputId = `${id}-input`;
  const [phase, setPhaseState] = useState<ConfirmPopoverPhase>(defaultOpen ? "confirming" : "idle");
  const [mounted, setMounted] = useState(defaultOpen);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [typed, setTyped] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const resultTimer = useRef<number | undefined>(undefined);
  const restoreFocus = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fill = useMotionValue(0);
  const shakeX = useMotionValue(0);

  const shake = useCallback(() => {
    if (!reduced) animate(shakeX, [0, -6, 5, -3, 2, 0], { duration: 0.32, ease: motionTokens.ease.standard });
  }, [reduced, shakeX]);

  const clipPath = useTransform(fill, value => `inset(0 ${(1 - Math.min(1, Math.max(0, value))) * 100}% 0 0)`);
  const surfaceX = useMotionValue(0);
  const targetX = useMotionValue(0);
  const faceX = useTransform(surfaceX, value => -value);
  const panelX = useTransform(() => targetX.get() - surfaceX.get());

  const setPhase = useCallback((next: ConfirmPopoverPhase) => {
    setPhaseState(next);
    onPhaseChange?.(next);
  }, [onPhaseChange]);

  const measure = useCallback((): Geometry | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const w = Math.max(rect.width, Math.min(width, viewportWidth - 32));
    const x = Math.min(
      Math.max(align === "end" ? rect.width - w : align === "center" ? (rect.width - w) / 2 : 0, 16 - rect.left),
      viewportWidth - 16 - w - rect.left,
    );
    const right = Math.abs(x - (rect.width - w)) < 0.5 && x < 0;
    const up = side === "top" || (side === "auto" && viewportHeight - rect.bottom < 280 && rect.top > viewportHeight - rect.bottom);
    return { tw: rect.width, th: rect.height, radius: parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 14, w, x: right ? 0 : x, up, right };
  }, [align, side, width]);

  const isOpen = phase === "confirming" || phase === "working" || phase === "error";

  const openPanel = useCallback(() => {
    const next = measure();
    if (!next) return;
    window.clearTimeout(resultTimer.current);
    setGeometry(next);
    targetX.set(next.x);
    setTyped("");
    setErrorMessage("");
    setProgress(null);
    setMounted(true);
    setPhase("confirming");
    fill.set(confirmText ? 0 : 1);
  }, [confirmText, fill, measure, targetX, setPhase]);

  const close = useCallback((restore = true) => {
    restoreFocus.current = restore;
    if (restore && rootRef.current?.contains(document.activeElement)) surfaceRef.current?.focus({ preventScroll: true });
    setPhase("idle");
  }, [setPhase]);

  useEffect(() => {
    if (!mounted && restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [mounted]);

  useEffect(() => {
    if (phase !== "idle" || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 900);
    return () => window.clearTimeout(timer);
  }, [phase, mounted]);

  const openRef = useRef(open);
  useEffect(() => {
    if (open === undefined || open === openRef.current) return;
    openRef.current = open;
    const frame = requestAnimationFrame(() => {
      if (open && !isOpen) openPanel();
      else if (!open && (phase === "confirming" || phase === "error")) close(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, isOpen, phase, openPanel, close]);

  const defaultOpened = useRef(false);
  useEffect(() => {
    if (!defaultOpen || defaultOpened.current) return;
    defaultOpened.current = true;
    const frame = requestAnimationFrame(openPanel);
    return () => cancelAnimationFrame(frame);
  }, [defaultOpen, openPanel]);

  const cancel = useCallback(() => {
    if (phase !== "confirming" && phase !== "error") return;
    openRef.current = false;
    onCancel?.();
    onOpenChange?.(false);
    close();
  }, [close, onCancel, onOpenChange, phase]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isOpen) return;
    setPanelHeight(panel.offsetHeight);
    const observer = new ResizeObserver(() => setPanelHeight(panel.offsetHeight));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      const next = measure();
      if (next) {
        setGeometry(next);
        targetX.set(next.x);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, measure, targetX]);

  useEffect(() => {
    if (phase !== "confirming") return;
    const frame = requestAnimationFrame(() => (inputRef.current ?? cancelRef.current)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    if (phase !== "confirming" && phase !== "error") return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) cancel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [phase, cancel]);

  useEffect(() => () => {
    abortRef.current?.abort();
    window.clearTimeout(resultTimer.current);
  }, []);

  const unlocked = !confirmText || normalize(typed) === normalize(confirmText);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (phase === "working") return;
    if (!unlocked) {
      shake();
      inputRef.current?.focus();
      return;
    }
    const run = ++runRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage("");
    setProgress(null);
    animate(fill, 0, reduced ? INSTANT : motionTokens.spring.snappy);
    setPhase("working");
    surfaceRef.current?.focus({ preventScroll: true });
    try {
      await onConfirm?.({
        setProgress: value => {
          if (runRef.current !== run) return;
          const next = Math.min(1, Math.max(0, value));
          setProgress(next);
          animate(fill, next, reduced ? INSTANT : motionTokens.spring.smooth);
        },
        signal: controller.signal,
      });
      if (runRef.current !== run) return;
      await animate(fill, 1, reduced ? INSTANT : motionTokens.spring.snappy);
      setPhase("success");
      onOpenChange?.(false);
      openRef.current = false;
      resultTimer.current = window.setTimeout(() => {
        const focused = document.activeElement;
        restoreFocus.current = focused === document.body || !!rootRef.current?.contains(focused);
        setPhase("idle");
        onDone?.();
      }, resultDuration);
    } catch (error) {
      if (runRef.current !== run || controller.signal.aborted) return;
      onError?.(error);
      setErrorMessage(error instanceof Error ? error.message : typeof error === "string" ? error : "");
      animate(fill, 1, reduced ? INSTANT : motionTokens.spring.smooth);
      setPhase("error");
      shake();
      requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
    }
  };

  const changeTyped = (value: string) => {
    setTyped(value);
    if (!confirmText) return;
    const phrase = normalize(confirmText);
    const entered = value.trimStart().toLowerCase();
    let matched = 0;
    while (matched < entered.length && matched < phrase.length && entered[matched] === phrase[matched]) matched++;
    const ratio = matched === entered.length || normalize(value) === phrase ? matched / phrase.length : 0;
    animate(fill, ratio, reduced ? INSTANT : motionTokens.spring.snappy);
  };

  const target = geometry
    ? isOpen
      ? { width: geometry.w, height: panelHeight || geometry.th, x: geometry.x, borderRadius: 22 }
      : { width: geometry.tw, height: geometry.th, x: 0, borderRadius: geometry.radius }
    : undefined;
  const surfaceTransition = reduced ? INSTANT : isOpen ? SMOOTH : SNAPPY;
  const shape = isOpen ? "panel" : phase === "success" ? "success" : "trigger";
  const faceTransition = (delay = 0) =>
    reduced
      ? { duration: motionTokens.duration.instant }
      : {
          ...motionTokens.spring.snappy,
          delay,
          opacity: { duration: motionTokens.duration.fast, ease: ENTER, delay },
          filter: { duration: motionTokens.duration.fast, ease: ENTER, delay },
        };
  const status =
    phase === "confirming" ? ""
    : phase === "working" ? `${pendingLabel}${progress !== null ? `, ${Math.round(100 * progress)} percent` : ""}`
    : phase === "success" ? successLabel
    : phase === "error" ? `${typeof errorTitle === "string" ? errorTitle : "Failed"}. ${errorMessage}`
    : "";
  const actionLabel = phase === "working" ? `${pendingLabel}…` : phase === "error" ? retryLabel : confirmLabel;
  const label = (
    <span className={styles.confirmLabel}>
      <span>{actionLabel}</span>
      {phase === "working" && progress !== null ? <span className={styles.percent}>{Math.round(100 * progress)}%</span> : null}
    </span>
  );
  const blur = `blur(${motionTokens.blur.subtle}px)`;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-tone={tone} data-phase={phase}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => {
          if (disabled || isOpen) return;
          openRef.current = true;
          openPanel();
          onOpenChange?.(true);
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        data-hidden={mounted || undefined}
        tabIndex={mounted ? -1 : undefined}
      >
        {icon ? <span className={styles.icon} aria-hidden>{icon}</span> : null}
        <span>{children}</span>
      </button>
      {mounted && geometry ? (
        <motion.div
          ref={surfaceRef}
          className={styles.surface}
          data-shape={shape}
          data-up={geometry.up || undefined}
          data-right={geometry.right || undefined}
          role={isOpen ? "alertdialog" : undefined}
          aria-modal={isOpen ? false : undefined}
          aria-labelledby={isOpen ? titleId : undefined}
          aria-describedby={isOpen ? descId : undefined}
          aria-busy={phase === "working" || undefined}
          tabIndex={-1}
          style={{ x: surfaceX }}
          initial={{ width: geometry.tw, height: geometry.th, x: 0, borderRadius: geometry.radius }}
          animate={target}
          transition={surfaceTransition}
          onAnimationComplete={() => {
            if (phase === "idle") setMounted(false);
          }}
          onKeyDown={event => {
            if (event.key === "Escape") {
              event.stopPropagation();
              event.preventDefault();
              cancel();
              return;
            }
            if (event.key !== "Tab") return;
            const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")].filter(node => !node.closest("[inert]"));
            if (!items.length) return void event.preventDefault();
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <AnimatePresence initial={false}>
            {shape === "trigger" ? (
              <motion.span
                key="trigger"
                className={styles.faceTrigger}
                style={{ width: geometry.tw, height: geometry.th, x: faceX }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={faceTransition(0.04)}
                aria-hidden
              >
                {icon ? <span className={styles.icon}>{icon}</span> : null}
                <span>{children}</span>
              </motion.span>
            ) : null}
            {shape === "success" ? (
              <motion.span
                key="success"
                className={styles.faceSuccess}
                style={{ width: geometry.tw, height: geometry.th, x: faceX }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, filter: blur }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={faceTransition(0.04)}
              >
                <motion.span
                  className={styles.check}
                  initial={!reduced && { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reduced ? INSTANT : { ...motionTokens.spring.snappy, delay: 0.06, opacity: { duration: motionTokens.duration.instant, delay: 0.06 } }}
                >
                  <Check size={16} strokeWidth={2.25} aria-hidden />
                </motion.span>
                <span>{successLabel}</span>
              </motion.span>
            ) : null}
            {shape === "panel" ? (
              <motion.div
                key="panel"
                ref={panelRef}
                className={styles.panel}
                data-up={geometry.up || undefined}
                style={{ width: geometry.w, x: panelX }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: geometry.up ? 4 : -4, filter: blur }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, filter: blur, transition: { duration: motionTokens.duration.instant } }}
                transition={faceTransition(0.03)}
              >
                <motion.form className={styles.form} onSubmit={submit} style={{ x: shakeX }} noValidate>
                  <div className={styles.copy}>
                    <h2 id={titleId} className={styles.title}>{title}</h2>
                    {description ? <p id={descId} className={styles.description}>{description}</p> : null}
                  </div>
                  {confirmText ? (
                    <div className={styles.field}>
                      <label htmlFor={inputId} className={styles.fieldLabel}>
                        Type <span className={styles.phrase}>{confirmText}</span> to confirm
                      </label>
                      <input
                        ref={inputRef}
                        id={inputId}
                        className={styles.input}
                        value={typed}
                        onChange={event => changeTyped(event.target.value)}
                        placeholder={confirmText}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={phase === "working"}
                        aria-invalid={(typed.length > 0 && !unlocked) || undefined}
                      />
                    </div>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {phase === "error" ? (
                      <motion.div
                        key="error"
                        className={styles.errorWrap}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={reduced ? INSTANT : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}
                      >
                        <p className={styles.error} role="alert">
                          <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
                          <span>
                            <span className={styles.errorTitle}>{errorTitle}</span>
                            {errorMessage ? <span className={styles.errorText}>{errorMessage}</span> : null}
                          </span>
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <div className={styles.actions}>
                    <motion.span
                      className={styles.cancelSlot}
                      initial={false}
                      animate={phase === "working" ? { flexGrow: 0, opacity: 0, marginRight: 0 } : { flexGrow: 1, opacity: 1, marginRight: 8 }}
                      transition={reduced ? INSTANT : { ...motionTokens.spring.morph, opacity: { duration: motionTokens.duration.instant } }}
                      inert={phase === "working"}
                    >
                      <button ref={cancelRef} type="button" className={styles.cancel} onClick={cancel}>{cancelLabel}</button>
                    </motion.span>
                    <button
                      ref={confirmRef}
                      type="submit"
                      className={styles.confirm}
                      data-locked={!unlocked || undefined}
                      data-working={phase === "working" || undefined}
                      data-indeterminate={(phase === "working" && progress === null) || undefined}
                      aria-disabled={!unlocked || phase === "working" || undefined}
                    >
                      {label}
                      <motion.span className={styles.fill} style={{ clipPath }} aria-hidden>{label}</motion.span>
                      {phase === "working" && progress === null ? <span className={styles.sweep} aria-hidden /> : null}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
      <span className={styles.srOnly} role="status" aria-live="polite">{status}</span>
    </div>
  );
}
