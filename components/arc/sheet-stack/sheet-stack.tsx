"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, X } from "lucide-react";
import styles from "./sheet-stack.module.css";

export interface SheetDefinition {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  backLabel?: string;
  dismissible?: boolean;
  className?: string;
  panelRef?: Ref<HTMLDivElement>;
}

export interface SheetStackContextValue {
  stack: string[];
  push: (id: string) => void;
  pop: () => void;
  popTo: (id: string) => void;
  close: () => void;
}

interface InternalContextValue extends SheetStackContextValue {
  registerSheet: (def: SheetDefinition) => void;
  unregisterSheet: (id: string) => void;
}

const SheetStackContext = createContext<InternalContextValue | null>(null);

export function useSheetStack(): SheetStackContextValue {
  const ctx = useContext(SheetStackContext);
  if (!ctx) {
    throw new Error("useSheetStack must be used inside a SheetStack");
  }
  return {
    stack: ctx.stack,
    push: ctx.push,
    pop: ctx.pop,
    popTo: ctx.popTo,
    close: ctx.close,
  };
}

export interface SheetStackProps {
  children: ReactNode;
  stack?: string[];
  defaultStack?: string[];
  onStackChange?: (stack: string[]) => void;
  mode?: "auto" | "sheet" | "dialog";
  breakpoint?: number;
  contained?: boolean;
}

export function SheetStack({
  children,
  stack: controlledStack,
  defaultStack = [],
  onStackChange,
  mode = "auto",
  breakpoint = 640,
  contained = false,
}: SheetStackProps) {
  const prefersReduced = useReducedMotion();
  const [uncontrolledStack, setUncontrolledStack] = useState<string[]>(defaultStack);
  const stack = controlledStack ?? uncontrolledStack;

  const [sheetsMap, setSheetsMap] = useState<Record<string, SheetDefinition>>({});
  const [containerWidth, setContainerWidth] = useState<number>(breakpoint);
  const anchorRef = useRef<HTMLDivElement>(null);
  const returnFocusStack = useRef<Array<HTMLElement | null>>([]);

  const updateStack = useCallback(
    (updater: (prev: string[]) => string[]) => {
      const next = updater(stack);
      if (controlledStack === undefined) {
        setUncontrolledStack(next);
      }
      onStackChange?.(next);
    },
    [stack, controlledStack, onStackChange]
  );

  const push = useCallback(
    (id: string) => {
      returnFocusStack.current.push(
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      );
      updateStack((prev) => {
        const existingIdx = prev.indexOf(id);
        if (existingIdx !== -1) {
          return prev.slice(0, existingIdx + 1);
        }
        return [...prev, id];
      });
    },
    [updateStack]
  );

  const pop = useCallback(() => {
    const prevFocus = returnFocusStack.current.pop();
    updateStack((prev) => prev.slice(0, -1));
    if (prevFocus) {
      requestAnimationFrame(() => prevFocus.focus());
    }
  }, [updateStack]);

  const popTo = useCallback(
    (id: string) => {
      updateStack((prev) => {
        const idx = prev.indexOf(id);
        return idx === -1 ? prev : prev.slice(0, idx + 1);
      });
    },
    [updateStack]
  );

  const close = useCallback(() => {
    const firstFocus = returnFocusStack.current[0];
    returnFocusStack.current = [];
    updateStack(() => []);
    if (firstFocus) {
      requestAnimationFrame(() => firstFocus.focus());
    }
  }, [updateStack]);

  const registerSheet = useCallback((def: SheetDefinition) => {
    setSheetsMap((prev) => ({ ...prev, [def.id]: def }));
  }, []);

  const unregisterSheet = useCallback((id: string) => {
    setSheetsMap((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    if (contained && anchorRef.current?.parentElement) {
      const target = anchorRef.current.parentElement;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      ro.observe(target);
      setContainerWidth(target.getBoundingClientRect().width);
      return () => ro.disconnect();
    }
    const onResize = () => setContainerWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, contained]);

  const isDialog =
    mode === "dialog" || (mode === "auto" && containerWidth >= breakpoint);

  useEffect(() => {
    if (stack.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        pop();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [stack.length, pop]);

  useEffect(() => {
    if (contained || stack.length === 0) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [contained, stack.length]);

  const ctxValue = useMemo<InternalContextValue>(
    () => ({
      stack,
      push,
      pop,
      popTo,
      close,
      registerSheet,
      unregisterSheet,
    }),
    [stack, push, pop, popTo, close, registerSheet, unregisterSheet]
  );

  return (
    <SheetStackContext.Provider value={ctxValue}>
      <div ref={anchorRef} style={{ display: "contents" }}>
        {children}
      </div>

      <AnimatePresence>
        {stack.length > 0 && (
          <div
            className={`${contained ? styles.layerContained : styles.layer} ${
              isDialog ? styles.layerDialog : styles.layerSheet
            }`}
          >
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={close}
            />

            <AnimatePresence initial={false}>
              {stack.map((sheetId, index) => {
                const def = sheetsMap[sheetId];
                if (!def) return null;
                const depthFromTop = stack.length - 1 - index;
                const isTop = depthFromTop === 0;
                const parentDef = index > 0 ? sheetsMap[stack[index - 1]] : null;
                const peekPx = isDialog ? 14 : 10;
                const scale = prefersReduced ? 1 : Math.max(0.85, 1 - depthFromTop * 0.05);
                const yOffset = prefersReduced
                  ? 0
                  : isDialog
                    ? -depthFromTop * peekPx
                    : -depthFromTop * peekPx;

                return (
                  <SheetPanel
                    key={sheetId}
                    def={def}
                    parentBackLabel={parentDef?.backLabel ?? parentDef?.title}
                    isTop={isTop}
                    isDialog={isDialog}
                    depthFromTop={depthFromTop}
                    stackCount={stack.length}
                    scale={scale}
                    yOffset={yOffset}
                    prefersReduced={Boolean(prefersReduced)}
                    onPop={pop}
                    onCloseAll={close}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </SheetStackContext.Provider>
  );
}

interface SheetPanelProps {
  def: SheetDefinition;
  parentBackLabel?: string;
  isTop: boolean;
  isDialog: boolean;
  depthFromTop: number;
  stackCount: number;
  scale: number;
  yOffset: number;
  prefersReduced: boolean;
  onPop: () => void;
  onCloseAll: () => void;
}

function SheetPanel({
  def,
  parentBackLabel,
  isTop,
  isDialog,
  depthFromTop,
  stackCount,
  scale,
  yOffset,
  prefersReduced,
  onPop,
  onCloseAll,
}: SheetPanelProps) {
  const titleId = useId();
  const descId = useId();
  const localRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTop) {
      requestAnimationFrame(() => localRef.current?.focus());
    }
  }, [isTop]);

  const dismissible = def.dismissible !== false;
  const maxHeightCalc = isDialog
    ? `calc(82% - ${depthFromTop * 14}px)`
    : `calc(84% - ${depthFromTop * 10}px)`;

  const panelRefProp = def.panelRef;

  const setCombinedRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof panelRefProp === "function") {
      panelRefProp(node);
    } else if (panelRefProp && "current" in panelRefProp) {
      Object.assign(panelRefProp, { current: node });
    }
  };

  return (
    <motion.div
      ref={setCombinedRef}
      role="dialog"
      aria-modal={isTop ? "true" : undefined}
      aria-labelledby={titleId}
      aria-describedby={def.description ? descId : undefined}
      tabIndex={-1}
      className={`${styles.panel} ${
        isDialog ? styles.panelDialog : styles.panelSheet
      } ${def.className ?? ""}`}
      style={{
        maxHeight: maxHeightCalc,
        zIndex: 10 + (stackCount - depthFromTop),
        pointerEvents: isTop ? "auto" : "none",
      }}
      drag={isTop && dismissible && !prefersReduced ? "y" : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.08, bottom: 0.65 }}
      onDragEnd={(_, info) => {
        const h = localRef.current?.offsetHeight ?? 320;
        if (info.offset.y > h * 0.35 || info.velocity.y > 450) {
          onPop();
        }
      }}
      initial={
        prefersReduced
          ? { opacity: 0 }
          : isDialog
            ? { opacity: 0, scale: 0.94, y: 18 }
            : { opacity: 0.6, y: "100%" }
      }
      animate={{
        opacity: 1,
        scale,
        y: yOffset,
      }}
      exit={
        prefersReduced
          ? { opacity: 0 }
          : isDialog
            ? { opacity: 0, scale: 0.95, y: 16 }
            : { opacity: 0.6, y: "100%" }
      }
      transition={
        prefersReduced
          ? { duration: 0.14 }
          : { type: "spring", stiffness: 420, damping: 36 }
      }
    >
      {!isDialog && dismissible && (
        <div className={styles.grabberWrap} aria-hidden="true">
          <div className={styles.grabber} />
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {parentBackLabel && (
            <button type="button" className={styles.backBtn} onClick={onPop}>
              <ChevronLeft size={14} />
              <span>{parentBackLabel}</span>
            </button>
          )}
          <h3 id={titleId} className={styles.title}>
            {def.title}
          </h3>
          {def.description && (
            <p id={descId} className={styles.description}>
              {def.description}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label={stackCount > 1 ? "Close all" : "Close"}
          onClick={stackCount > 1 ? onCloseAll : onPop}
        >
          <X size={15} />
        </button>
      </div>

      <div ref={bodyRef} className={styles.body}>
        {def.children}
      </div>

      {def.footer && <div className={styles.footer}>{def.footer}</div>}

      {depthFromTop > 0 && !prefersReduced && (
        <div
          className={styles.dimOverlay}
          style={{ opacity: Math.min(0.85, depthFromTop * 0.45) }}
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}

export interface SheetProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  backLabel?: string;
  dismissible?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function Sheet({
  id,
  title,
  description,
  children,
  footer,
  backLabel,
  dismissible = true,
  className,
  ref,
}: SheetProps) {
  const ctx = useContext(SheetStackContext);
  if (!ctx) {
    throw new Error("Sheet must be rendered inside a SheetStack");
  }

  const { registerSheet, unregisterSheet } = ctx;

  useLayoutEffect(() => {
    registerSheet({
      id,
      title,
      description,
      children,
      footer,
      backLabel,
      dismissible,
      className,
      panelRef: ref,
    });
  }, [
    registerSheet,
    id,
    title,
    description,
    children,
    footer,
    backLabel,
    dismissible,
    className,
    ref,
  ]);

  useEffect(() => {
    return () => unregisterSheet(id);
  }, [unregisterSheet, id]);

  return null;
}

export interface SheetTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  sheet: string;
  ref?: Ref<HTMLButtonElement>;
}

export function SheetTrigger({
  sheet,
  onClick,
  className,
  ref,
  ...props
}: SheetTriggerProps) {
  const { push } = useSheetStack();
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.trigger} ${className ?? ""}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          push(sheet);
        }
      }}
      {...props}
    />
  );
}
