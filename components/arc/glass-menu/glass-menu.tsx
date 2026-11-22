"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./glass-menu.module.css";

export interface GlassMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  items?: GlassMenuItem[];
  keepOpen?: boolean;
}

export interface GlassMenuGroup {
  id: string;
  label?: string;
  items: GlassMenuItem[];
}

export interface GlassMenuProps {
  groups: GlassMenuGroup[];
  children: ReactNode;
  label?: string;
  triggerLabel?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (id: string, item: GlassMenuItem) => void;
  align?: "start" | "end";
  width?: number;
  className?: string;
  style?: CSSProperties;
}

interface FlatRow {
  key: string;
  kind: "item" | "back";
  item?: GlassMenuItem;
  label: string;
  disabled?: boolean;
}

export function GlassMenu({
  groups,
  children,
  label = "Actions",
  triggerLabel,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  align = "start",
  width = 256,
  className,
  style,
}: GlassMenuProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const menuId = `${uid}-menu`;
  const shellLayoutId = `${uid}-shell`;
  const pillLayoutId = `${uid}-pill`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const typeaheadRef = useRef({ buffer: "", timer: 0 });

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? openProp : uncontrolledOpen;

  const [submenuId, setSubmenuId] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
      if (!next) {
        setSubmenuId(null);
        setActiveKey(null);
      }
    },
    [isControlled, onOpenChange],
  );

  const activeSubmenuItem = useMemo(() => {
    if (!submenuId) return null;
    for (const g of groups) {
      for (const item of g.items) {
        if (item.id === submenuId && item.items?.length) return item;
      }
    }
    return null;
  }, [groups, submenuId]);

  const flatRows = useMemo<FlatRow[]>(() => {
    if (activeSubmenuItem && activeSubmenuItem.items) {
      return [
        { key: "__back__", kind: "back", label: activeSubmenuItem.label },
        ...activeSubmenuItem.items.map((item) => ({
          key: item.id,
          kind: "item" as const,
          item,
          label: item.label,
          disabled: item.disabled,
        })),
      ];
    }
    const rows: FlatRow[] = [];
    for (const g of groups) {
      for (const item of g.items) {
        rows.push({
          key: item.id,
          kind: "item",
          item,
          label: item.label,
          disabled: item.disabled,
        });
      }
    }
    return rows;
  }, [activeSubmenuItem, groups]);

  const enabledRows = useMemo(
    () => flatRows.filter((r) => !r.disabled),
    [flatRows],
  );

  const focusRow = useCallback((key: string | null) => {
    setActiveKey(key);
    if (!key) return;
    window.requestAnimationFrame(() => {
      const btn = itemRefs.current.get(key);
      btn?.focus({ preventScroll: true });
    });
  }, []);

  const openMenu = useCallback(
    (focusTarget: "first" | "last" | "none" = "first") => {
      setSubmenuId(null);
      setDirection(1);
      setOpen(true);
      if (focusTarget === "none") return;
      const rootEnabled: FlatRow[] = [];
      for (const g of groups) {
        for (const item of g.items) {
          if (!item.disabled) {
            rootEnabled.push({ key: item.id, kind: "item", item, label: item.label });
          }
        }
      }
      const target =
        focusTarget === "last"
          ? rootEnabled[rootEnabled.length - 1]
          : rootEnabled[0];
      if (target) focusRow(target.key);
    },
    [groups, setOpen, focusRow],
  );

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) {
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    },
    [setOpen],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        closeMenu(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen, closeMenu]);

  const enterSubmenu = useCallback(
    (item: GlassMenuItem) => {
      if (!item.items?.length) return;
      setDirection(1);
      setSubmenuId(item.id);
      const firstChild = item.items.find((child) => !child.disabled);
      focusRow(firstChild ? firstChild.id : "__back__");
    },
    [focusRow],
  );

  const exitSubmenu = useCallback(() => {
    const parentId = submenuId;
    setDirection(-1);
    setSubmenuId(null);
    if (parentId) focusRow(parentId);
  }, [submenuId, focusRow]);

  const activateRow = useCallback(
    (row: FlatRow) => {
      if (row.disabled) return;
      if (row.kind === "back") {
        exitSubmenu();
        return;
      }
      const item = row.item;
      if (!item) return;
      if (item.items?.length) {
        enterSubmenu(item);
        return;
      }
      onSelect?.(item.id, item);
      if (!item.keepOpen) {
        closeMenu(true);
      }
    },
    [enterSubmenu, exitSubmenu, onSelect, closeMenu],
  );

  const handleTriggerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu("first");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        openMenu("last");
      }
    },
    [openMenu],
  );

  const handleMenuKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (submenuId) {
          exitSubmenu();
        } else {
          closeMenu(true);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        closeMenu(true);
        return;
      }
      if (e.key === "ArrowLeft" && submenuId) {
        e.preventDefault();
        exitSubmenu();
        return;
      }
      if (e.key === "ArrowRight") {
        const current = enabledRows.find((r) => r.key === activeKey);
        if (current?.item?.items?.length) {
          e.preventDefault();
          enterSubmenu(current.item);
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (enabledRows.length === 0) return;
        const idx = enabledRows.findIndex((r) => r.key === activeKey);
        const step = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          idx === -1
            ? step > 0
              ? 0
              : enabledRows.length - 1
            : (idx + step + enabledRows.length) % enabledRows.length;
        focusRow(enabledRows[nextIdx].key);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        if (enabledRows.length > 0) focusRow(enabledRows[0].key);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        if (enabledRows.length > 0) focusRow(enabledRows[enabledRows.length - 1].key);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const current = enabledRows.find((r) => r.key === activeKey);
        if (current) activateRow(current);
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        window.clearTimeout(typeaheadRef.current.timer);
        const query = (typeaheadRef.current.buffer + e.key).toLowerCase();
        typeaheadRef.current.buffer = query;
        typeaheadRef.current.timer = window.setTimeout(() => {
          typeaheadRef.current.buffer = "";
        }, 500);
        const match = enabledRows.find((r) =>
          r.label.toLowerCase().startsWith(query),
        );
        if (match) focusRow(match.key);
      }
    },
    [
      submenuId,
      exitSubmenu,
      closeMenu,
      enabledRows,
      activeKey,
      enterSubmenu,
      focusRow,
      activateRow,
    ],
  );

  const registerItemRef = useCallback(
    (key: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        itemRefs.current.set(key, el);
      } else {
        itemRefs.current.delete(key);
      }
    },
    [],
  );

  const renderItemRow = (item: GlassMenuItem) => {
    const isActive = activeKey === item.id;
    const isCheckbox = item.checked !== undefined;
    const hasSubmenu = Boolean(item.items?.length);
    return (
      <div key={item.id} className={styles.rowWrap}>
        <button
          ref={registerItemRef(item.id)}
          type="button"
          role={isCheckbox ? "menuitemcheckbox" : "menuitem"}
          aria-checked={isCheckbox ? item.checked : undefined}
          aria-haspopup={hasSubmenu ? "menu" : undefined}
          aria-disabled={item.disabled ? "true" : undefined}
          tabIndex={isActive ? 0 : -1}
          className={styles.item}
          data-active={isActive ? "" : undefined}
          data-danger={item.danger ? "" : undefined}
          onPointerMove={() => {
            if (!item.disabled && activeKey !== item.id) setActiveKey(item.id);
          }}
          onFocus={() => {
            if (!item.disabled) setActiveKey(item.id);
          }}
          onClick={() =>
            activateRow({
              key: item.id,
              kind: "item",
              item,
              label: item.label,
              disabled: item.disabled,
            })
          }
        >
          {isActive && (
            <motion.span
              layoutId={reduced ? undefined : pillLayoutId}
              className={styles.highlight}
              transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
              aria-hidden="true"
            />
          )}
          {item.icon != null && (
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span className={styles.label}>{item.label}</span>
          {item.shortcut && (
            <span className={styles.shortcut}>{item.shortcut}</span>
          )}
          {isCheckbox && (
            <Check
              size={14}
              strokeWidth={2}
              className={styles.check}
              data-on={item.checked ? "" : undefined}
              aria-hidden="true"
            />
          )}
          {hasSubmenu && (
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              className={styles.chevron}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-open={isOpen ? "" : undefined}
      style={style}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => (isOpen ? closeMenu(true) : openMenu("none"))}
        onKeyDown={handleTriggerKeyDown}
      >
        {!isOpen && (
          <motion.span
            layoutId={reduced ? undefined : shellLayoutId}
            className={styles.shell}
            style={{ borderRadius: 20 }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
            aria-hidden="true"
          />
        )}
        <span className={styles.triggerContent}>
          <span>{children}</span>
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.panel}
            data-align={align}
            style={{
              width: `min(${width}px, calc(100vw - 32px))`,
            }}
            initial={reduced ? { opacity: 1 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: motionTokens.duration.exit, ease: motionTokens.ease.exit }
            }
          >
            <motion.span
              layoutId={reduced ? undefined : shellLayoutId}
              className={styles.shell}
              style={{ borderRadius: 22 }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
              aria-hidden="true"
            />
            <motion.div
              id={menuId}
              role="menu"
              aria-label={activeSubmenuItem ? activeSubmenuItem.label : label}
              className={styles.menu}
              onKeyDown={handleMenuKeyDown}
              onPointerLeave={() => setActiveKey(null)}
              initial={
                reduced
                  ? { opacity: 1 }
                  : { opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` }
              }
              animate={
                reduced
                  ? { opacity: 1 }
                  : { opacity: 1, filter: "blur(0px)" }
              }
              exit={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      duration: motionTokens.duration.standard,
                      delay: 0.04,
                      ease: motionTokens.ease.enter,
                    }
              }
            >
              <div className={styles.viewport}>
                <AnimatePresence mode="wait" initial={false}>
                  {activeSubmenuItem && activeSubmenuItem.items ? (
                    <motion.div
                      key={`sub-${activeSubmenuItem.id}`}
                      className={styles.view}
                      initial={
                        reduced
                          ? { opacity: 1 }
                          : { opacity: 0, x: direction * 20 }
                      }
                      animate={{ opacity: 1, x: 0 }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, x: -direction * 20 }
                      }
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              duration: motionTokens.duration.fast,
                              ease: motionTokens.ease.standard,
                            }
                      }
                    >
                      <div className={styles.list}>
                        <div className={styles.rowWrap}>
                          <button
                            ref={registerItemRef("__back__")}
                            type="button"
                            role="menuitem"
                            tabIndex={activeKey === "__back__" ? 0 : -1}
                            className={styles.item}
                            data-back=""
                            data-active={activeKey === "__back__" ? "" : undefined}
                            onPointerMove={() => {
                              if (activeKey !== "__back__") setActiveKey("__back__");
                            }}
                            onFocus={() => setActiveKey("__back__")}
                            onClick={exitSubmenu}
                          >
                            {activeKey === "__back__" && (
                              <motion.span
                                layoutId={reduced ? undefined : pillLayoutId}
                                className={styles.highlight}
                                transition={
                                  reduced
                                    ? { duration: 0 }
                                    : motionTokens.spring.snappy
                                }
                                aria-hidden="true"
                              />
                            )}
                            <span className={styles.icon} aria-hidden="true">
                              <ChevronLeft size={16} strokeWidth={1.75} />
                            </span>
                            <span className={styles.label}>
                              {activeSubmenuItem.label}
                            </span>
                          </button>
                        </div>
                        <div className={styles.separator} role="separator" />
                        {activeSubmenuItem.items.map(renderItemRow)}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="root"
                      className={styles.view}
                      initial={
                        reduced
                          ? { opacity: 1 }
                          : { opacity: 0, x: direction * 20 }
                      }
                      animate={{ opacity: 1, x: 0 }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, x: -direction * 20 }
                      }
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              duration: motionTokens.duration.fast,
                              ease: motionTokens.ease.standard,
                            }
                      }
                    >
                      <div className={styles.list}>
                        {groups.map((group, gi) => (
                          <div key={group.id} role="group" aria-label={group.label}>
                            {gi > 0 && (
                              <div className={styles.separator} role="separator" />
                            )}
                            {group.label && (
                              <div className={styles.heading}>{group.label}</div>
                            )}
                            {group.items.map(renderItemRow)}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GlassMenu;
