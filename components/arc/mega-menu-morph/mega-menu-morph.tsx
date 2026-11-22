"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import styles from "./mega-menu-morph.module.css";

export interface MegaMenuLink {
  label: string;
  href: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
}

export interface MegaMenuGroup {
  label?: string;
  links: MegaMenuLink[];
}

export interface MegaMenuFeature {
  title: string;
  description?: string;
  href: string;
  cta?: string;
}

export interface MegaMenuItem {
  id: string;
  label: string;
  href?: string;
  groups?: MegaMenuGroup[];
  feature?: MegaMenuFeature;
  footer?: ReactNode;
  content?: ReactNode;
}

export interface MegaMenuMorphProps {
  items: MegaMenuItem[];
  brand?: ReactNode;
  actions?: ReactNode;
  /** Compact actions kept visible next to the menu button on narrow screens. */
  compactActions?: ReactNode;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  current?: string;
  openDelay?: number;
  closeDelay?: number;
  collapseBelow?: number;
  showSafeArea?: boolean;
  onNavigate?: (href: string, link?: MegaMenuLink) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Point {
  x: number;
  y: number;
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const sign = (p1: Point, p2: Point, p3: Point) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

const SPRING = {
  type: "spring" as const,
  visualDuration: 0.22,
  bounce: 0,
};

export function MegaMenuMorph({
  items,
  brand,
  actions,
  compactActions,
  value: controlledValue,
  defaultValue = null,
  onValueChange,
  current,
  openDelay = 100,
  closeDelay = 200,
  collapseBelow,
  showSafeArea = false,
  onNavigate,
  label = "Main",
  className,
  style,
}: MegaMenuMorphProps) {
  const reducedMotion = useReducedMotion();
  const baseId = useId();
  const sheetId = `${baseId}-sheet`;
  const panelId = `${baseId}-panel`;

  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Map<string, HTMLElement>>(new Map());
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [internalValue, setInternalValue] = useState<string | null>(defaultValue);
  const activeId = controlledValue !== undefined ? controlledValue : internalValue;
  const [direction, setDirection] = useState<1 | -1>(1);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedSheetId, setExpandedSheetId] = useState<string | null>(null);

  // Panel geometry & safe triangle
  const [panelPos, setPanelPos] = useState<{ left: number; caretLeft: number }>({
    left: 16,
    caretLeft: 64,
  });
  const [safeTriangle, setSafeTriangle] = useState<[Point, Point, Point] | null>(
    null
  );
  const pointerRef = useRef<Point | null>(null);

  const setActive = useCallback(
    (next: string | null) => {
      if (next !== null && activeId !== null && next !== activeId) {
        const prevIdx = items.findIndex((i) => i.id === activeId);
        const nextIdx = items.findIndex((i) => i.id === next);
        setDirection(nextIdx >= prevIdx ? 1 : -1);
      }
      if (controlledValue === undefined) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [activeId, controlledValue, items, onValueChange]
  );

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Auto-collapse measurement
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const check = () => {
      const width = root.getBoundingClientRect().width;
      if (collapseBelow !== undefined) {
        setCollapsed(width < collapseBelow);
      } else if (measureRef.current) {
        const needed = measureRef.current.scrollWidth + 24;
        setCollapsed(width < needed);
      }
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(root);
    return () => ro.disconnect();
  }, [collapseBelow, items]);

  // Compute panel left & caret position when activeId changes
  useLayoutEffect(() => {
    if (!activeId || collapsed) return;
    const root = rootRef.current;
    const trigger = triggerRefs.current.get(activeId);
    if (!root || !trigger) return;

    const rootRect = root.getBoundingClientRect();
    const trigRect = trigger.getBoundingClientRect();
    const triggerCenter = trigRect.left - rootRect.left + trigRect.width / 2;

    const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 480;
    const maxLeft = Math.max(8, rootRect.width - panelWidth - 8);
    const idealLeft = Math.max(8, Math.min(maxLeft, triggerCenter - panelWidth / 2));
    const caretLeft = Math.max(
      20,
      Math.min(panelWidth - 20, triggerCenter - idealLeft)
    );

    setPanelPos({ left: idealLeft, caretLeft });
  }, [activeId, collapsed]);

  // Close on Escape / outside click
  useEffect(() => {
    if (!activeId && !sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const prev = activeId;
        clearTimers();
        setActive(null);
        setSafeTriangle(null);
        setSheetOpen(false);
        if (prev) {
          triggerRefs.current.get(prev)?.focus();
        }
      }
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        clearTimers();
        setActive(null);
        setSafeTriangle(null);
        setSheetOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [activeId, sheetOpen, clearTimers, setActive]);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeId && !i.href) ?? null,
    [items, activeId]
  );

  const scheduleOpen = useCallback(
    (id: string) => {
      clearTimers();
      if (activeId) {
        // Already open: switch immediately unless inside safe triangle
        setActive(id);
        return;
      }
      openTimerRef.current = setTimeout(() => {
        setActive(id);
      }, openDelay);
    },
    [activeId, clearTimers, openDelay, setActive]
  );

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setActive(null);
      setSafeTriangle(null);
    }, closeDelay);
  }, [clearTimers, closeDelay, setActive]);

  const handleRootMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const pt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pointerRef.current = pt;

    if (activeId && panelRef.current) {
      const pRect = panelRef.current.getBoundingClientRect();
      const topLeft: Point = {
        x: pRect.left - rect.left,
        y: pRect.top - rect.top,
      };
      const topRight: Point = {
        x: pRect.right - rect.left,
        y: pRect.top - rect.top,
      };
      if (pt.y < topLeft.y) {
        setSafeTriangle([pt, topLeft, topRight]);
      } else {
        setSafeTriangle(null);
      }
    }
  };

  const handleTriggerEnter = (item: MegaMenuItem) => {
    if (item.href) {
      scheduleClose();
      return;
    }
    // Check if pointer is currently moving diagonally inside safe triangle toward open panel
    if (activeId && activeId !== item.id && safeTriangle && pointerRef.current) {
      if (
        pointInTriangle(
          pointerRef.current,
          safeTriangle[0],
          safeTriangle[1],
          safeTriangle[2]
        )
      ) {
        clearTimers();
        openTimerRef.current = setTimeout(() => setActive(item.id), 180);
        return;
      }
    }
    scheduleOpen(item.id);
  };

  const handleTriggerKeyDown = (
    e: ReactKeyboardEvent<HTMLElement>,
    index: number,
    item: MegaMenuItem
  ) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (index + 1) % items.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = items.length - 1;
    else if (e.key === "ArrowDown" && !item.href) {
      e.preventDefault();
      if (activeId !== item.id) setActive(item.id);
      requestAnimationFrame(() => {
        const firstLink = panelRef.current?.querySelector<HTMLElement>(
          "a[href], button:not(:disabled)"
        );
        firstLink?.focus();
      });
      return;
    } else if (e.key === "ArrowUp" && activeId === item.id) {
      e.preventDefault();
      setActive(null);
      return;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const target = items[nextIdx];
      triggerRefs.current.get(target.id)?.focus();
      if (activeId && !target.href) {
        setActive(target.id);
      }
    }
  };

  const handleLinkClick = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
    link?: MegaMenuLink
  ) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href, link);
    }
    clearTimers();
    setActive(null);
    setSafeTriangle(null);
    setSheetOpen(false);
  };

  const renderPanelContent = (item: MegaMenuItem) => {
    if (item.content) {
      return <div className={styles.face}>{item.content}</div>;
    }
    return (
      <div className={styles.face}>
        <div className={styles.faceBody}>
          {item.groups?.map((group, gi) => (
            <div key={group.label ?? gi} className={styles.group}>
              {group.label && <p className={styles.groupLabel}>{group.label}</p>}
              <ul className={styles.groupList}>
                {group.links.map((link) => {
                  const isCurrent = current === link.href || current === link.label;
                  return (
                    <li key={link.href + link.label}>
                      <a
                        href={link.href}
                        className={styles.link}
                        data-current={isCurrent ? "" : undefined}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={(e) => handleLinkClick(e, link.href, link)}
                      >
                        {link.icon && (
                          <span className={styles.linkIcon} aria-hidden="true">
                            {link.icon}
                          </span>
                        )}
                        <span className={styles.linkBody}>
                          <span className={styles.linkHead}>
                            <span className={styles.linkTitle}>{link.label}</span>
                            {link.badge && (
                              <span className={styles.badge}>{link.badge}</span>
                            )}
                          </span>
                          {link.description && (
                            <span className={styles.linkDesc}>
                              {link.description}
                            </span>
                          )}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {item.feature && (
            <a
              href={item.feature.href}
              className={styles.feature}
              onClick={(e) =>
                handleLinkClick(e, item.feature!.href, {
                  label: item.feature!.title,
                  href: item.feature!.href,
                  description: item.feature!.description,
                })
              }
            >
              <div>
                <div className={styles.featureTitle}>{item.feature.title}</div>
                {item.feature.description && (
                  <p className={styles.featureDesc}>
                    {item.feature.description}
                  </p>
                )}
              </div>
              {item.feature.cta && (
                <span className={styles.featureCta}>
                  {item.feature.cta}
                  <ArrowRight size={13} aria-hidden="true" />
                </span>
              )}
            </a>
          )}
        </div>
        {item.footer && <div className={styles.footerBand}>{item.footer}</div>}
      </div>
    );
  };

  const transition = reducedMotion ? { duration: 0 } : SPRING;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-collapsed={collapsed ? "true" : undefined}
      style={style}
      onMouseMove={handleRootMouseMove}
      onMouseLeave={scheduleClose}
    >
      <nav className={styles.bar} aria-label={label}>
        {brand}

        {!collapsed && (
          <ul className={styles.items}>
            {items.map((item, idx) => {
              const isMenu = !item.href;
              const isOpen = isMenu && activeId === item.id;
              const isCurrent =
                current === item.id || (item.href && current === item.href);

              return (
                <li key={item.id}>
                  {isMenu ? (
                    <button
                      ref={(el) => {
                        if (el) triggerRefs.current.set(item.id, el);
                        else triggerRefs.current.delete(item.id);
                      }}
                      type="button"
                      className={styles.item}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      data-active={isOpen ? "" : undefined}
                      data-current={isCurrent ? "" : undefined}
                      onMouseEnter={() => handleTriggerEnter(item)}
                      onClick={() => {
                        clearTimers();
                        setActive(isOpen ? null : item.id);
                      }}
                      onKeyDown={(e) => handleTriggerKeyDown(e, idx, item)}
                    >
                      <span>{item.label}</span>
                      <ChevronDown className={styles.chevron} aria-hidden="true" />
                    </button>
                  ) : (
                    <a
                      ref={(el) => {
                        if (el) triggerRefs.current.set(item.id, el);
                        else triggerRefs.current.delete(item.id);
                      }}
                      href={item.href}
                      className={styles.item}
                      data-current={isCurrent ? "" : undefined}
                      aria-current={isCurrent ? "page" : undefined}
                      onMouseEnter={() => handleTriggerEnter(item)}
                      onClick={(e) =>
                        handleLinkClick(e, item.href!, {
                          label: item.label,
                          href: item.href!,
                        })
                      }
                      onKeyDown={(e) => handleTriggerKeyDown(e, idx, item)}
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.actions}>
          {collapsed ? compactActions ?? actions : actions}
          {collapsed && (
            <button
              type="button"
              className={styles.toggle}
              data-mm-toggle=""
              aria-expanded={sheetOpen}
              aria-controls={sheetId}
              aria-label={sheetOpen ? "Close menu" : "Open menu"}
              onClick={() => setSheetOpen((v) => !v)}
            >
              <span className={styles.toggleIcon}>
                {sheetOpen ? <X /> : <Menu />}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Hidden measurement clone for auto-collapse */}
      <div ref={measureRef} className={styles.measure} aria-hidden="true">
        {brand}
        <ul className={styles.items}>
          {items.map((item) => (
            <li key={item.id}>
              <span className={styles.item}>{item.label}</span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>{actions}</div>
      </div>

      {/* Safe-area visualization */}
      {showSafeArea && !collapsed && activeItem && safeTriangle && (
        <svg className={styles.safeAreaSvg} aria-hidden="true">
          <polygon
            className={styles.safeAreaPoly}
            points={safeTriangle.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        </svg>
      )}

      {/* Desktop morphing floating panel */}
      <AnimatePresence>
        {!collapsed && activeItem && (
          <motion.div
            key="mm-panel"
            id={panelId}
            ref={panelRef}
            className={styles.panelWrap}
            initial={
              reducedMotion
                ? { opacity: 1, x: panelPos.left }
                : { opacity: 0, y: -6, scale: 0.98, x: panelPos.left }
            }
            animate={{ opacity: 1, y: 0, scale: 1, x: panelPos.left }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -4, scale: 0.98 }
            }
            transition={transition}
            onMouseEnter={clearTimers}
            onMouseLeave={scheduleClose}
          >
            <motion.span
              className={styles.caret}
              aria-hidden="true"
              animate={{ x: panelPos.caretLeft }}
              transition={transition}
            />
            <motion.div layout className={styles.surface} transition={transition}>
              <div className={styles.viewport}>
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                  <motion.div
                    key={activeItem.id}
                    custom={direction}
                    initial={
                      reducedMotion
                        ? { opacity: 1 }
                        : { opacity: 0, x: direction * 20 }
                    }
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: direction * -20 }
                    }
                    transition={transition}
                  >
                    {renderPanelContent(activeItem)}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Narrow-screen accordion sheet */}
      <AnimatePresence>
        {collapsed && sheetOpen && (
          <motion.div
            id={sheetId}
            className={styles.sheet}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={transition}
          >
            <div className={styles.sheetInner}>
              {items.map((item) => {
                if (item.href) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      className={styles.sheetRow}
                      onClick={(e) =>
                        handleLinkClick(e, item.href!, {
                          label: item.label,
                          href: item.href!,
                        })
                      }
                    >
                      {item.label}
                    </a>
                  );
                }
                const expanded = expandedSheetId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      className={styles.sheetRow}
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedSheetId(expanded ? null : item.id)
                      }
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        size={16}
                        style={{
                          transform: expanded ? "rotate(180deg)" : undefined,
                          transition: reducedMotion
                            ? "none"
                            : "transform 150ms ease",
                        }}
                        aria-hidden="true"
                      />
                    </button>
                    {expanded && (
                      <div className={styles.sheetBody}>
                        {item.groups?.map((group, gi) => (
                          <div key={group.label ?? gi}>
                            {group.label && (
                              <p className={styles.groupLabel}>{group.label}</p>
                            )}
                            <ul className={styles.groupList}>
                              {group.links.map((link) => (
                                <li key={link.href + link.label}>
                                  <a
                                    href={link.href}
                                    className={styles.link}
                                    onClick={(e) =>
                                      handleLinkClick(e, link.href, link)
                                    }
                                  >
                                    {link.icon && (
                                      <span
                                        className={styles.linkIcon}
                                        aria-hidden="true"
                                      >
                                        {link.icon}
                                      </span>
                                    )}
                                    <span className={styles.linkBody}>
                                      <span className={styles.linkHead}>
                                        <span className={styles.linkTitle}>
                                          {link.label}
                                        </span>
                                        {link.badge && (
                                          <span className={styles.badge}>
                                            {link.badge}
                                          </span>
                                        )}
                                      </span>
                                      {link.description && (
                                        <span className={styles.linkDesc}>
                                          {link.description}
                                        </span>
                                      )}
                                    </span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {actions && <div className={styles.sheetFooter}>{actions}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
