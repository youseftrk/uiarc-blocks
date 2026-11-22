"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./dock.module.css";

export interface DockItem {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  badge?: number;
  items?: DockItem[];
}

export interface DockProps {
  items: DockItem[];
  value?: string | null;
  onValueChange?: (id: string) => void;
  onItemsChange?: (
    items: DockItem[],
    change: { type: "move"; id: string; index: number }
  ) => void;
  label?: string;
  className?: string;
}

function formatAccessibleName(item: DockItem): string {
  const parts = [item.label];
  if (item.shortcut) parts.push(`shortcut ${item.shortcut}`);
  if (item.badge && item.badge > 0) parts.push(`${item.badge} unread`);
  return parts.join(", ");
}

function findActiveMember(
  item: DockItem,
  value: string | null | undefined
): DockItem | null {
  if (!item.items || !value) return null;
  return item.items.find((child) => child.id === value) ?? null;
}

export function Dock({
  items,
  value,
  onValueChange,
  onItemsChange,
  label = "Tools",
  className,
}: DockProps) {
  const baseId = useId();
  const reducedMotion = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState<number | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ id: string; startX: number; index: number } | null>(
    null
  );

  const safeFocusedIndex = Math.min(focusedIndex, Math.max(0, items.length - 1));

  const updateTooltipForIndex = useCallback((idx: number | null) => {
    setHoveredIndex(idx);
    if (idx === null) return;
    const btn = itemRefs.current[idx];
    const root = rootRef.current;
    if (btn && root) {
      const btnRect = btn.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setTooltipX(btnRect.left - rootRect.left + btnRect.width / 2);
    }
  }, []);

  // Close open tray on outside pointer down
  useEffect(() => {
    if (!openGroupId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenGroupId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openGroupId]);

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!onItemsChange) return;
      if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onItemsChange(next, { type: "move", id: moved.id, index: toIndex });
      setFocusedIndex(toIndex);
      requestAnimationFrame(() => {
        itemRefs.current[toIndex]?.focus();
        updateTooltipForIndex(toIndex);
      });
    },
    [items, onItemsChange, updateTooltipForIndex]
  );

  const handleDockKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    idx: number,
    item: DockItem
  ) => {
    const isGroup = Boolean(item.items && item.items.length > 0);

    if (e.altKey && onItemsChange) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveItem(idx, idx - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveItem(idx, idx + 1);
        return;
      }
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % items.length;
      setFocusedIndex(next);
      setOpenGroupId(null);
      itemRefs.current[next]?.focus();
      updateTooltipForIndex(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (idx - 1 + items.length) % items.length;
      setFocusedIndex(next);
      setOpenGroupId(null);
      itemRefs.current[next]?.focus();
      updateTooltipForIndex(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
      setOpenGroupId(null);
      itemRefs.current[0]?.focus();
      updateTooltipForIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = items.length - 1;
      setFocusedIndex(last);
      setOpenGroupId(null);
      itemRefs.current[last]?.focus();
      updateTooltipForIndex(last);
    } else if (e.key === "ArrowUp" && isGroup) {
      e.preventDefault();
      setOpenGroupId(item.id);
      requestAnimationFrame(() => trayRefs.current[0]?.focus());
    } else if (e.key === "ArrowDown" || e.key === "Escape") {
      if (openGroupId) {
        e.preventDefault();
        setOpenGroupId(null);
      }
    } else if (e.key === "Tab" && openGroupId) {
      setOpenGroupId(null);
    }
  };

  const handleTrayKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    groupIdx: number,
    memberIdx: number,
    members: DockItem[]
  ) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (memberIdx + 1) % members.length;
      trayRefs.current[next]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (memberIdx - 1 + members.length) % members.length;
      trayRefs.current[next]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpenGroupId(null);
      itemRefs.current[groupIdx]?.focus();
    } else if (e.key === "Tab") {
      setOpenGroupId(null);
    }
  };

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    idx: number,
    item: DockItem
  ) => {
    if (!onItemsChange || e.button !== 0) return;
    dragStartRef.current = { id: item.id, startX: e.clientX, index: idx };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStartRef.current;
    if (!drag || !onItemsChange) return;
    const dx = e.clientX - drag.startX;
    if (!draggingId && Math.abs(dx) > 10) {
      setDraggingId(drag.id);
      setOpenGroupId(null);
    }
    if (draggingId || Math.abs(dx) > 22) {
      const steps = Math.trunc(dx / 44);
      if (steps !== 0) {
        const targetIndex = Math.max(
          0,
          Math.min(items.length - 1, drag.index + steps)
        );
        if (targetIndex !== drag.index) {
          moveItem(drag.index, targetIndex);
          dragStartRef.current = {
            id: drag.id,
            startX: e.clientX,
            index: targetIndex,
          };
        }
      }
    }
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    if (draggingId) {
      requestAnimationFrame(() => setDraggingId(null));
    }
  };

  const hoveredItem =
    hoveredIndex !== null && !openGroupId && !draggingId
      ? items[hoveredIndex] ?? null
      : null;

  const activeHoveredDisplay = hoveredItem
    ? findActiveMember(hoveredItem, value) ?? hoveredItem
    : null;

  const spring = reducedMotion
    ? { duration: 0.1 }
    : { type: "spring" as const, stiffness: 520, damping: 34, mass: 0.8 };

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      onPointerLeave={() => updateTooltipForIndex(null)}
    >
      {/* Gliding hover/focus label */}
      <AnimatePresence>
        {activeHoveredDisplay && tooltipX !== null ? (
          <motion.div
            key="tooltip"
            className={styles.tooltip}
            role="tooltip"
            initial={{
              opacity: 0,
              x: tooltipX,
              y: reducedMotion ? 0 : 4,
              translateX: "-50%",
            }}
            animate={{
              opacity: 1,
              x: tooltipX,
              y: 0,
              translateX: "-50%",
            }}
            exit={{
              opacity: 0,
              y: reducedMotion ? 0 : 4,
            }}
            transition={
              reducedMotion
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 540, damping: 36 }
            }
          >
            <span>{activeHoveredDisplay.label}</span>
            {activeHoveredDisplay.shortcut ? (
              <kbd className={styles.kbd}>{activeHoveredDisplay.shortcut}</kbd>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        ref={dockRef}
        className={styles.dock}
        role="toolbar"
        aria-label={label}
      >
        {items.map((item, idx) => {
          const isGroup = Boolean(item.items && item.items.length > 0);
          const activeMember = findActiveMember(item, value);
          const isActive = isGroup ? Boolean(activeMember) : value === item.id;
          const isOpen = isGroup && openGroupId === item.id;
          const trayId = `${baseId}-tray-${item.id}`;
          const displayItem = activeMember ?? item;

          return (
            <motion.div
              key={item.id}
              layout={!reducedMotion}
              transition={spring}
              className={styles.slot}
              data-dragging={draggingId === item.id ? "true" : undefined}
            >
              {/* Expandable group tray */}
              <AnimatePresence>
                {isOpen && item.items ? (
                  <motion.div
                    id={trayId}
                    role="group"
                    aria-label={item.label}
                    className={styles.tray}
                    initial={{
                      opacity: 0,
                      y: reducedMotion ? 0 : 8,
                      scale: reducedMotion ? 1 : 0.94,
                    }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      y: reducedMotion ? 0 : 6,
                      scale: reducedMotion ? 1 : 0.96,
                    }}
                    transition={
                      reducedMotion
                        ? { duration: 0.1 }
                        : { type: "spring", stiffness: 460, damping: 30 }
                    }
                  >
                    {item.items.map((member, mIdx) => {
                      const memberActive = value === member.id;
                      return (
                        <motion.button
                          key={member.id}
                          ref={(el) => {
                            trayRefs.current[mIdx] = el;
                          }}
                          type="button"
                          className={styles.trayItem}
                          data-active={memberActive ? "true" : undefined}
                          aria-pressed={memberActive}
                          aria-label={formatAccessibleName(member)}
                          initial={{
                            opacity: 0,
                            y: reducedMotion ? 0 : 4,
                          }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: reducedMotion ? 0.08 : 0.16,
                            delay: reducedMotion ? 0 : mIdx * 0.03,
                          }}
                          onClick={() => {
                            onValueChange?.(member.id);
                            setOpenGroupId(null);
                            itemRefs.current[idx]?.focus();
                          }}
                          onKeyDown={(e) =>
                            handleTrayKeyDown(e, idx, mIdx, item.items!)
                          }
                        >
                          <span aria-hidden="true">{member.icon}</span>
                          <span>{member.label}</span>
                          {member.shortcut ? (
                            <span className={styles.trayKbd}>
                              {member.shortcut}
                            </span>
                          ) : null}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.button
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                className={styles.item}
                data-active={isActive ? "true" : undefined}
                tabIndex={idx === safeFocusedIndex ? 0 : -1}
                aria-label={formatAccessibleName(displayItem)}
                aria-pressed={isGroup ? undefined : isActive}
                aria-haspopup={isGroup ? "true" : undefined}
                aria-expanded={isGroup ? isOpen : undefined}
                aria-controls={isGroup ? trayId : undefined}
                whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                transition={spring}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch") {
                    updateTooltipForIndex(idx);
                  }
                }}
                onFocus={() => {
                  setFocusedIndex(idx);
                  updateTooltipForIndex(idx);
                }}
                onBlur={(e) => {
                  if (
                    rootRef.current &&
                    !rootRef.current.contains(e.relatedTarget as Node)
                  ) {
                    updateTooltipForIndex(null);
                  }
                }}
                onPointerDown={(e) => handlePointerDown(e, idx, item)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={(e) => handleDockKeyDown(e, idx, item)}
                onClick={() => {
                  if (draggingId) return;
                  if (isGroup) {
                    setOpenGroupId((prev) => (prev === item.id ? null : item.id));
                  } else {
                    setOpenGroupId(null);
                    onValueChange?.(item.id);
                  }
                }}
              >
                {isActive ? (
                  <motion.span
                    layoutId={`${baseId}-selection`}
                    className={styles.selection}
                    transition={spring}
                    aria-hidden="true"
                  />
                ) : null}

                <span className={styles.glyph} aria-hidden="true">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={displayItem.id}
                      initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.78 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.78 }}
                      transition={{ duration: reducedMotion ? 0.08 : 0.14 }}
                      style={{ display: "inline-flex" }}
                    >
                      {displayItem.icon}
                    </motion.span>
                  </AnimatePresence>
                </span>

                {isGroup ? (
                  <span className={styles.caret} aria-hidden="true" />
                ) : null}

                {item.badge && item.badge > 0 ? (
                  <span className={styles.badge} aria-hidden="true">
                    {item.badge}
                  </span>
                ) : null}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
