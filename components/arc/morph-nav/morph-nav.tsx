"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, CornerDownLeft, Search, X } from "lucide-react";
import styles from "./morph-nav.module.css";

export interface MorphNavLink {
  label: string;
  description?: string;
  icon?: ReactNode;
  href?: string;
}

export interface MorphNavItem {
  value: string;
  label: string;
  href?: string;
  links?: MorphNavLink[];
  columns?: 1 | 2;
  feature?: ReactNode;
  footer?: ReactNode;
}

export interface MorphNavBrand {
  name: string;
  mark: ReactNode;
  href?: string;
}

export interface MorphNavAction {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface MorphNavSearchItem {
  label: string;
  description?: string;
  group?: string;
  icon?: ReactNode;
  href?: string;
  keywords?: string;
}

export interface MorphNavSearch {
  placeholder?: string;
  items: MorphNavSearchItem[];
}

export interface MorphNavProps {
  items: MorphNavItem[];
  brand?: MorphNavBrand;
  action?: MorphNavAction;
  search?: MorphNavSearch;
  current?: string;
  compact?: boolean;
  collapseBelow?: number;
  onNavigate?: (target: { label: string; href?: string; section?: string }) => void;
  label?: string;
  className?: string;
}

const MENU_VALUE = "__menu";
const SEARCH_VALUE = "__search";

export function MorphNav({
  items,
  brand,
  action,
  search,
  current,
  compact = false,
  collapseBelow = 720,
  onNavigate,
  label = "Main",
  className,
}: MorphNavProps) {
  const reduced = Boolean(useReducedMotion());
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<string, HTMLElement | null>>({});

  const [narrow, setNarrow] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardResults, setKeyboardResults] = useState(false);

  // Highlight state for top bar hover
  const [highlight, setHighlight] = useState<{ x: number; width: number; visible: boolean }>({
    x: 0,
    width: 0,
    visible: false,
  });

  // Measured surface dimensions
  const [dims, setDims] = useState<{ width: number; height: number }>({
    width: 420,
    height: compact ? 46 : 56,
  });

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Observe container width for collapseBelow
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      const isNarrow = w > 0 && w < collapseBelow;
      setNarrow(isNarrow);
      setOpenKey((prev) => {
        if (!prev || prev === SEARCH_VALUE) return prev;
        if (isNarrow && prev !== MENU_VALUE) return null;
        if (!isNarrow && prev === MENU_VALUE) return null;
        return prev;
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapseBelow]);

  const isSearchOpen = openKey === SEARCH_VALUE;
  const isOpen = openKey !== null;

  const panelItems = useMemo(() => items.filter((it) => it.links && it.links.length > 0), [items]);
  const activeItem = useMemo(
    () => (openKey && openKey !== MENU_VALUE && openKey !== SEARCH_VALUE ? items.find((it) => it.value === openKey) ?? null : null),
    [items, openKey]
  );

  // Filter search results
  const filteredResults = useMemo(() => {
    if (!search) return [];
    const q = query.trim().toLowerCase();
    if (!q) return search.items.slice(0, 6);
    const terms = q.split(/\s+/).filter(Boolean);
    return search.items
      .filter((item) => {
        const hay = `${item.label} ${item.description ?? ""} ${item.group ?? ""} ${item.keywords ?? ""}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 8);
  }, [search, query]);

  const clampedActiveIndex =
    filteredResults.length === 0 ? -1 : Math.min(activeIndex, filteredResults.length - 1);

  const barHeight = compact ? 46 : 56;

  // Measure active bar and face to drive single continuous surface
  const measureSurface = useCallback(() => {
    const rootW = rootRef.current?.getBoundingClientRect().width ?? 800;
    const maxW = Math.max(220, rootW - 16);

    if (isSearchOpen) {
      const sbW = searchBarRef.current?.offsetWidth ?? Math.min(544, maxW);
      const faceW = faceRef.current?.offsetWidth ?? sbW;
      const faceH = faceRef.current?.offsetHeight ?? 0;
      setDims({
        width: Math.min(maxW, Math.max(sbW, faceW)),
        height: barHeight + faceH,
      });
      return;
    }

    const barW = barRef.current?.offsetWidth ?? 320;
    if (openKey) {
      const faceW = faceRef.current?.offsetWidth ?? barW;
      const faceH = faceRef.current?.offsetHeight ?? 0;
      setDims({
        width: Math.min(maxW, Math.max(barW, faceW)),
        height: barHeight + faceH,
      });
    } else {
      setDims({
        width: Math.min(maxW, barW),
        height: barHeight,
      });
    }
  }, [isSearchOpen, openKey, barHeight]);

  useLayoutEffect(() => {
    measureSurface();
    const raf = requestAnimationFrame(measureSurface);
    return () => cancelAnimationFrame(raf);
  }, [measureSurface, narrow, compact, openKey, query, filteredResults.length]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measureSurface);
    if (barRef.current) ro.observe(barRef.current);
    if (faceRef.current) ro.observe(faceRef.current);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [measureSurface, openKey]);

  // Outside pointer dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        clearTimers();
        setOpenKey(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, clearTimers]);

  // Focus search input when opening search
  useEffect(() => {
    if (isSearchOpen) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isSearchOpen]);

  const openPanel = useCallback(
    (nextKey: string) => {
      clearTimers();
      setOpenKey((prev) => {
        if (prev && prev !== nextKey && prev !== SEARCH_VALUE && nextKey !== SEARCH_VALUE) {
          const prevIdx = items.findIndex((i) => i.value === prev);
          const nextIdx = items.findIndex((i) => i.value === nextKey);
          if (prevIdx !== -1 && nextIdx !== -1) {
            setDirection(nextIdx > prevIdx ? 1 : -1);
          } else {
            setDirection(0);
          }
        } else {
          setDirection(0);
        }
        return nextKey;
      });
    },
    [clearTimers, items]
  );

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setOpenKey((prev) => (prev === SEARCH_VALUE ? prev : null));
    }, 180);
  }, [clearTimers]);

  const closeAll = useCallback(
    (restoreFocusTo?: string) => {
      clearTimers();
      setOpenKey(null);
      setQuery("");
      setActiveIndex(0);
      if (restoreFocusTo === SEARCH_VALUE) {
        requestAnimationFrame(() => searchBtnRef.current?.focus());
      } else if (restoreFocusTo) {
        requestAnimationFrame(() => triggerRefs.current[restoreFocusTo]?.focus());
      }
    },
    [clearTimers]
  );

  const moveHighlight = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    setHighlight({
      x: el.offsetLeft,
      width: el.offsetWidth,
      visible: true,
    });
  }, []);

  const handleItemPointerEnter = (item: MorphNavItem, e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    moveHighlight(e.currentTarget);
    clearTimers();
    if (!item.links || item.links.length === 0) {
      if (openKey && openKey !== SEARCH_VALUE) {
        scheduleClose();
      }
      return;
    }
    if (openKey && openKey !== SEARCH_VALUE) {
      openPanel(item.value);
    } else if (!openKey) {
      openTimerRef.current = setTimeout(() => {
        openPanel(item.value);
      }, 60);
    }
  };

  const handleSurfacePointerEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleSurfacePointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    setHighlight((h) => ({ ...h, visible: false }));
    if (openKey && openKey !== SEARCH_VALUE) {
      scheduleClose();
    }
  };

  const handleNavigate = (target: { label: string; href?: string; section?: string }) => {
    onNavigate?.(target);
    closeAll();
  };

  // Top-level keyboard navigation
  const handleTriggerKeyDown = (
    e: ReactKeyboardEvent<HTMLElement>,
    key: string,
    hasPanel: boolean
  ) => {
    const keys = narrow ? [MENU_VALUE] : items.map((i) => i.value);
    const idx = keys.indexOf(key);

    if (e.key === "ArrowRight" && keys.length > 1) {
      e.preventDefault();
      const next = keys[(idx + 1) % keys.length];
      triggerRefs.current[next]?.focus();
      if (openKey && openKey !== SEARCH_VALUE) {
        const nextItem = items.find((i) => i.value === next);
        if (nextItem?.links?.length) openPanel(next);
        else setOpenKey(null);
      }
    } else if (e.key === "ArrowLeft" && keys.length > 1) {
      e.preventDefault();
      const prev = keys[(idx - 1 + keys.length) % keys.length];
      triggerRefs.current[prev]?.focus();
      if (openKey && openKey !== SEARCH_VALUE) {
        const prevItem = items.find((i) => i.value === prev);
        if (prevItem?.links?.length) openPanel(prev);
        else setOpenKey(null);
      }
    } else if (e.key === "Home" && keys.length > 1) {
      e.preventDefault();
      triggerRefs.current[keys[0]]?.focus();
    } else if (e.key === "End" && keys.length > 1) {
      e.preventDefault();
      triggerRefs.current[keys[keys.length - 1]]?.focus();
    } else if (e.key === "ArrowDown" && hasPanel) {
      e.preventDefault();
      openPanel(key);
      requestAnimationFrame(() => {
        const firstLink = faceRef.current?.querySelector<HTMLElement>("a, button");
        firstLink?.focus();
      });
    } else if (e.key === "Escape" && openKey) {
      e.preventDefault();
      closeAll(key);
    }
  };

  const handleFaceKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAll(openKey ?? undefined);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const focusables = Array.from(
        faceRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? []
      );
      if (focusables.length === 0) return;
      const curIdx = focusables.indexOf(document.activeElement as HTMLElement);
      if (curIdx === -1) return;
      e.preventDefault();
      const nextIdx =
        e.key === "ArrowDown"
          ? (curIdx + 1) % focusables.length
          : (curIdx - 1 + focusables.length) % focusables.length;
      focusables[nextIdx]?.focus();
    }
  };

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAll(SEARCH_VALUE);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardResults(true);
      if (filteredResults.length > 0) {
        setActiveIndex((i) => (i + 1) % filteredResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardResults(true);
      if (filteredResults.length > 0) {
        setActiveIndex((i) => (i - 1 + filteredResults.length) % filteredResults.length);
      }
    } else if (e.key === "Home") {
      setKeyboardResults(true);
      setActiveIndex(0);
    } else if (e.key === "End" && filteredResults.length > 0) {
      setKeyboardResults(true);
      setActiveIndex(filteredResults.length - 1);
    } else if (e.key === "Enter" && clampedActiveIndex >= 0) {
      e.preventDefault();
      const chosen = filteredResults[clampedActiveIndex];
      if (chosen) {
        handleNavigate({
          label: chosen.label,
          href: chosen.href,
          section: chosen.group,
        });
      }
    }
  };

  const surfaceTransition = reduced
    ? { duration: 0.01 }
    : { type: "spring" as const, visualDuration: 0.34, bounce: 0.06 };

  const faceTransition = reduced
    ? { duration: 0.08 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  const radius = isOpen ? 22 : barHeight / 2;
  const listboxId = `${baseId}-listbox`;

  return (
    <nav
      ref={rootRef}
      aria-label={label}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-compact={compact ? "true" : undefined}
      data-narrow={narrow ? "true" : undefined}
      data-open={isOpen ? "true" : undefined}
    >
      <motion.div
        className={styles.surface}
        animate={{
          width: dims.width,
          height: dims.height,
          borderRadius: radius,
        }}
        initial={false}
        transition={surfaceTransition}
        onPointerEnter={handleSurfacePointerEnter}
        onPointerLeave={handleSurfacePointerLeave}
      >
        {/* Main bar */}
        <motion.div
          ref={barRef}
          className={styles.bar}
          animate={{
            opacity: isSearchOpen ? 0 : 1,
            filter: reduced ? "blur(0px)" : isSearchOpen ? "blur(4px)" : "blur(0px)",
            scale: reduced ? 1 : isSearchOpen ? 0.98 : 1,
          }}
          initial={false}
          transition={{ duration: reduced ? 0.05 : 0.18 }}
          // @ts-expect-error inert is supported in React 19
          inert={isSearchOpen ? "" : undefined}
          aria-hidden={isSearchOpen ? true : undefined}
        >
          {brand && (
            brand.href ? (
              <a
                href={brand.href}
                className={styles.brand}
                onClick={(e) => {
                  if (onNavigate) {
                    e.preventDefault();
                    handleNavigate({ label: brand.name, href: brand.href });
                  }
                }}
              >
                <span className={styles.brandMark} aria-hidden="true">
                  {brand.mark}
                </span>
                <span className={styles.brandName}>
                  <span>{brand.name}</span>
                </span>
              </a>
            ) : (
              <button
                type="button"
                className={styles.brand}
                onClick={() => handleNavigate({ label: brand.name })}
              >
                <span className={styles.brandMark} aria-hidden="true">
                  {brand.mark}
                </span>
                <span className={styles.brandName}>
                  <span>{brand.name}</span>
                </span>
              </button>
            )
          )}

          <div
            className={styles.track}
            onPointerLeave={() => setHighlight((h) => ({ ...h, visible: false }))}
          >
            <motion.span
              className={styles.highlight}
              aria-hidden="true"
              animate={{
                x: highlight.x,
                width: highlight.width,
                opacity: highlight.visible ? 1 : 0,
              }}
              initial={false}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", visualDuration: 0.24, bounce: 0 }
              }
            />

            {narrow ? (
              <button
                ref={(el) => {
                  triggerRefs.current[MENU_VALUE] = el;
                }}
                type="button"
                id={`${baseId}-trigger-${MENU_VALUE}`}
                className={styles.item}
                aria-expanded={openKey === MENU_VALUE}
                aria-controls={openKey === MENU_VALUE ? `${baseId}-panel-${MENU_VALUE}` : undefined}
                onClick={() =>
                  setOpenKey((prev) => (prev === MENU_VALUE ? null : MENU_VALUE))
                }
                onKeyDown={(e) => handleTriggerKeyDown(e, MENU_VALUE, true)}
              >
                <span>Menu</span>
                <motion.span
                  className={styles.chevron}
                  aria-hidden="true"
                  animate={{ rotate: openKey === MENU_VALUE ? 180 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                >
                  <ChevronDown size={14} strokeWidth={1.75} />
                </motion.span>
              </button>
            ) : (
              items.map((item) => {
                const hasPanel = Boolean(item.links && item.links.length > 0);
                const isExpanded = openKey === item.value;
                const isCurrent = current === item.value;

                if (!hasPanel && item.href) {
                  return (
                    <a
                      key={item.value}
                      ref={(el) => {
                        triggerRefs.current[item.value] = el;
                      }}
                      href={item.href}
                      className={styles.item}
                      data-current={isCurrent ? "" : undefined}
                      aria-current={isCurrent ? "page" : undefined}
                      onPointerEnter={(e) => handleItemPointerEnter(item, e)}
                      onFocus={(e) => moveHighlight(e.currentTarget)}
                      onClick={(e) => {
                        if (onNavigate) {
                          e.preventDefault();
                          handleNavigate({ label: item.label, href: item.href, section: item.value });
                        }
                      }}
                      onKeyDown={(e) => handleTriggerKeyDown(e, item.value, false)}
                    >
                      <span>{item.label}</span>
                    </a>
                  );
                }

                return (
                  <button
                    key={item.value}
                    ref={(el) => {
                      triggerRefs.current[item.value] = el;
                    }}
                    type="button"
                    id={`${baseId}-trigger-${item.value}`}
                    className={styles.item}
                    data-current={isCurrent ? "" : undefined}
                    aria-current={isCurrent ? "page" : undefined}
                    aria-expanded={hasPanel ? isExpanded : undefined}
                    aria-controls={hasPanel && isExpanded ? `${baseId}-panel-${item.value}` : undefined}
                    onPointerEnter={(e) => handleItemPointerEnter(item, e)}
                    onFocus={(e) => moveHighlight(e.currentTarget)}
                    onClick={() => {
                      if (hasPanel) {
                        if (isExpanded) closeAll();
                        else openPanel(item.value);
                      } else {
                        handleNavigate({ label: item.label, href: item.href, section: item.value });
                      }
                    }}
                    onKeyDown={(e) => handleTriggerKeyDown(e, item.value, hasPanel)}
                  >
                    <span>{item.label}</span>
                    {hasPanel && (
                      <motion.span
                        className={styles.chevron}
                        aria-hidden="true"
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: reduced ? 0 : 0.2 }}
                      >
                        <ChevronDown size={14} strokeWidth={1.75} />
                      </motion.span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {(search || action) && (
            <div className={styles.tools}>
              {search && (
                <button
                  ref={searchBtnRef}
                  type="button"
                  className={styles.tool}
                  aria-label="Search"
                  onClick={() => {
                    clearTimers();
                    setQuery("");
                    setActiveIndex(0);
                    setOpenKey(SEARCH_VALUE);
                  }}
                >
                  <Search size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
              )}
              {action &&
                (action.href ? (
                  <a
                    href={action.href}
                    className={styles.action}
                    onClick={(e) => {
                      if (action.onClick || onNavigate) {
                        e.preventDefault();
                        action.onClick?.();
                        if (!action.onClick) {
                          handleNavigate({ label: action.label, href: action.href });
                        }
                      }
                    }}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => {
                      action.onClick?.();
                      if (!action.onClick) {
                        handleNavigate({ label: action.label });
                      }
                    }}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
            </div>
          )}
        </motion.div>

        {/* Search bar */}
        {search && (
          <motion.div
            ref={searchBarRef}
            className={styles.searchBar}
            animate={{
              opacity: isSearchOpen ? 1 : 0,
              filter: reduced ? "blur(0px)" : isSearchOpen ? "blur(0px)" : "blur(4px)",
            }}
            initial={false}
            transition={{ duration: reduced ? 0.05 : 0.18 }}
            // @ts-expect-error inert is supported in React 19
            inert={!isSearchOpen ? "" : undefined}
            aria-hidden={!isSearchOpen ? true : undefined}
          >
            <Search size={17} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isSearchOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                clampedActiveIndex >= 0 ? `${baseId}-opt-${clampedActiveIndex}` : undefined
              }
              className={styles.input}
              placeholder={search.placeholder ?? "Search"}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            <button
              type="button"
              className={styles.tool}
              aria-label="Close search"
              onClick={() => closeAll(SEARCH_VALUE)}
            >
              <X size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.div>
        )}

        {/* Dropdown / Search / Narrow Menu Face */}
        <AnimatePresence mode="wait" initial={false}>
          {activeItem && (
            <motion.div
              key={activeItem.value}
              ref={faceRef}
              id={`${baseId}-panel-${activeItem.value}`}
              role="region"
              aria-labelledby={`${baseId}-trigger-${activeItem.value}`}
              className={styles.face}
              initial={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, x: direction * 20, filter: "blur(3px)" }
              }
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, x: direction * -16, filter: "blur(3px)" }
              }
              transition={faceTransition}
              onKeyDown={handleFaceKeyDown}
            >
              <div className={styles.panelBody}>
                <ul
                  className={styles.links}
                  data-columns={activeItem.columns ?? (activeItem.links && activeItem.links.length > 4 ? 2 : 1)}
                >
                  {activeItem.links?.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        <a
                          href={link.href}
                          className={styles.link}
                          onClick={(e) => {
                            if (onNavigate) {
                              e.preventDefault();
                              handleNavigate({
                                label: link.label,
                                href: link.href,
                                section: activeItem.label,
                              });
                            }
                          }}
                        >
                          {link.icon && (
                            <span className={styles.linkIcon} aria-hidden="true">
                              {link.icon}
                            </span>
                          )}
                          <span className={styles.linkText}>
                            <span className={styles.linkLabel}>{link.label}</span>
                            {link.description && (
                              <span className={styles.linkDescription}>{link.description}</span>
                            )}
                          </span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() =>
                            handleNavigate({
                              label: link.label,
                              section: activeItem.label,
                            })
                          }
                        >
                          {link.icon && (
                            <span className={styles.linkIcon} aria-hidden="true">
                              {link.icon}
                            </span>
                          )}
                          <span className={styles.linkText}>
                            <span className={styles.linkLabel}>{link.label}</span>
                            {link.description && (
                              <span className={styles.linkDescription}>{link.description}</span>
                            )}
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {activeItem.feature && <div className={styles.feature}>{activeItem.feature}</div>}
              </div>
              {activeItem.footer && <div className={styles.footer}>{activeItem.footer}</div>}
            </motion.div>
          )}

          {openKey === MENU_VALUE && (
            <motion.div
              key={MENU_VALUE}
              ref={faceRef}
              id={`${baseId}-panel-${MENU_VALUE}`}
              role="region"
              aria-labelledby={`${baseId}-trigger-${MENU_VALUE}`}
              className={styles.face}
              initial={{ opacity: 0, filter: reduced ? "blur(0px)" : "blur(3px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={faceTransition}
              onKeyDown={handleFaceKeyDown}
            >
              <div className={styles.menu}>
                {panelItems.map((group) => (
                  <div key={group.value} className={styles.menuGroup}>
                    <p className={styles.menuHeading}>{group.label}</p>
                    <ul className={styles.links} data-columns="1">
                      {group.links?.map((link) => (
                        <li key={link.label}>
                          <button
                            type="button"
                            className={styles.link}
                            data-dense=""
                            onClick={() =>
                              handleNavigate({
                                label: link.label,
                                href: link.href,
                                section: group.label,
                              })
                            }
                          >
                            {link.icon && (
                              <span className={styles.linkIcon} aria-hidden="true">
                                {link.icon}
                              </span>
                            )}
                            <span className={styles.linkText}>
                              <span className={styles.linkLabel}>{link.label}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {items.some((i) => !i.links || i.links.length === 0) && (
                  <div className={styles.menuGroup}>
                    <p className={styles.menuHeading}>More</p>
                    <ul className={styles.links} data-columns="1">
                      {items
                        .filter((i) => !i.links || i.links.length === 0)
                        .map((item) => (
                          <li key={item.value}>
                            <button
                              type="button"
                              className={styles.link}
                              data-dense=""
                              onClick={() =>
                                handleNavigate({
                                  label: item.label,
                                  href: item.href,
                                  section: item.value,
                                })
                              }
                            >
                              <span className={styles.linkText}>
                                <span className={styles.linkLabel}>{item.label}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {isSearchOpen && search && (
            <motion.div
              key={SEARCH_VALUE}
              ref={faceRef}
              className={`${styles.face} ${styles.resultsFace}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={faceTransition}
            >
              <p className={styles.resultsHeading}>
                {query.trim()
                  ? filteredResults.length === 0
                    ? "No matches"
                    : `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"}`
                  : "Suggested"}
              </p>
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Search results"
                className={styles.results}
                data-keyboard={keyboardResults ? "" : undefined}
                onPointerMove={() => {
                  if (keyboardResults) setKeyboardResults(false);
                }}
              >
                {filteredResults.map((res, idx) => {
                  const selected = idx === clampedActiveIndex;
                  return (
                    <li
                      key={`${res.group ?? ""}-${res.label}`}
                      id={`${baseId}-opt-${idx}`}
                      role="option"
                      aria-selected={selected}
                      className={styles.result}
                      onPointerEnter={() => {
                        setKeyboardResults(false);
                        setActiveIndex(idx);
                      }}
                      onClick={() =>
                        handleNavigate({
                          label: res.label,
                          href: res.href,
                          section: res.group,
                        })
                      }
                    >
                      {res.icon && (
                        <span className={styles.linkIcon} aria-hidden="true">
                          {res.icon}
                        </span>
                      )}
                      <span className={styles.linkText}>
                        <span className={styles.linkLabel}>{res.label}</span>
                        {res.description && (
                          <span className={styles.linkDescription}>{res.description}</span>
                        )}
                      </span>
                      {res.group && <span className={styles.resultGroup}>{res.group}</span>}
                      <CornerDownLeft
                        size={14}
                        strokeWidth={1.75}
                        className={styles.resultEnter}
                        aria-hidden="true"
                      />
                    </li>
                  );
                })}
              </ul>
              <span className={styles.srOnly} role="status" aria-live="polite">
                {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"} available
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </nav>
  );
}

export default MorphNav;
