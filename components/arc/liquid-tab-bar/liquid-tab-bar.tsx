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
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./liquid-tab-bar.module.css";

export interface LiquidTabItem {
  value: string;
  label: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
  badge?: number;
  badgeLabel?: string;
}

export interface LiquidTabBarProps {
  tabs: LiquidTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  labels?: "active" | "always" | "none";
  label?: string;
  id?: string;
  className?: string;
}

export function liquidTabId(id: string, value: string): string {
  return `${id}-tab-${value}`;
}

export function liquidPanelId(id: string, value: string): string {
  return `${id}-panel-${value}`;
}

const PAD = 4;
const GAP = 2;
const SLOT = 44;

function RollingBadge({
  count,
  inverted,
}: {
  count: number;
  inverted?: boolean;
}) {
  const digits = String(Math.max(0, count)).split("");
  return (
    <span
      className={styles.badge}
      data-inverted={inverted ? "" : undefined}
      aria-hidden="true"
    >
      {digits.map((d, i) => {
        const n = Number(d);
        return (
          <span key={`${digits.length}-${i}`} className={styles.digit}>
            <span
              className={styles.column}
              style={{
                transform: Number.isNaN(n) ? undefined : `translateY(-${n * 16}px)`,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
                <span key={v}>{v}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function LiquidTabBar({
  tabs,
  value,
  onValueChange,
  labels = "active",
  label = "Sections",
  id,
  className,
}: LiquidTabBarProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const reduced = useReducedMotion();

  const barRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const measureRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const [labelWidths, setLabelWidths] = useState<number[]>(() =>
    tabs.map((t) => Math.ceil(t.label.length * 7.4)),
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [held, setHeld] = useState(false);

  const selectedIdx = Math.max(
    0,
    tabs.findIndex((t) => t.value === value),
  );

  // Measure hidden label widths
  useLayoutEffect(() => {
    const measured = tabs.map((t, i) => {
      const el = measureRefs.current[i];
      if (!el) return Math.ceil(t.label.length * 7.4);
      return Math.ceil(el.getBoundingClientRect().width);
    });
    setLabelWidths(measured);
  }, [tabs]);

  // Compute slot widths and left offsets
  const layout = useMemo(() => {
    const widths: number[] = [];
    const lefts: number[] = [];
    let x = PAD;
    tabs.forEach((tab, i) => {
      const showLabel =
        labels === "always" || (labels === "active" && i === selectedIdx);
      const hasBadge = tab.badge !== undefined && tab.badge > 0;
      const w = showLabel
        ? Math.max(SLOT, 40 + (labelWidths[i] ?? 36) + (hasBadge ? 20 : 14))
        : SLOT;
      lefts.push(x);
      widths.push(w);
      x += w + GAP;
    });
    const totalWidth = Math.max(SLOT + PAD * 2, x - GAP + PAD);
    return { widths, lefts, totalWidth };
  }, [tabs, labels, selectedIdx, labelWidths]);

  // Spring animation for lens clip-path
  const animRef = useRef({
    left: PAD,
    width: SLOT,
    vl: 0,
    vw: 0,
    tLeft: PAD,
    tWidth: SLOT,
    totalW: 200,
    raf: 0,
    lastTime: 0,
    initialized: false,
    dragging: false,
    pointerId: -1,
    dragStartX: 0,
    dragOriginL: PAD,
    dragLastX: 0,
    dragLastT: 0,
    dragVel: 0,
    dragMoved: false,
  });

  const applyClip = useCallback((left: number, width: number, totalW: number) => {
    const lens = lensRef.current;
    if (!lens) return;
    const clampedLeft = Math.max(PAD - 4, Math.min(totalW - PAD - width + 4, left));
    const right = Math.max(0, totalW - clampedLeft - width);
    lens.style.clipPath = `inset(${PAD}px ${right.toFixed(2)}px ${PAD}px ${clampedLeft.toFixed(2)}px round 9999px)`;
  }, []);

  const startSpring = useCallback(() => {
    const a = animRef.current;
    if (a.raf) return;
    a.lastTime = performance.now();

    const tick = (now: number) => {
      if (a.dragging) {
        a.raf = 0;
        return;
      }
      const dt = Math.min(0.032, Math.max(0.001, (now - a.lastTime) / 1000));
      a.lastTime = now;

      const k = 380;
      const d = 31;
      const al = -k * (a.left - a.tLeft) - d * a.vl;
      const aw = -k * (a.width - a.tWidth) - d * a.vw;

      a.vl += al * dt;
      a.vw += aw * dt;
      a.left += a.vl * dt;
      a.width += a.vw * dt;

      const done =
        Math.abs(a.left - a.tLeft) < 0.15 &&
        Math.abs(a.width - a.tWidth) < 0.15 &&
        Math.abs(a.vl) < 0.5 &&
        Math.abs(a.vw) < 0.5;

      if (done) {
        a.left = a.tLeft;
        a.width = a.tWidth;
        a.vl = 0;
        a.vw = 0;
        applyClip(a.left, a.width, a.totalW);
        a.raf = 0;
        return;
      }

      applyClip(a.left, a.width, a.totalW);
      a.raf = window.requestAnimationFrame(tick);
    };

    a.raf = window.requestAnimationFrame(tick);
  }, [applyClip]);

  // Update lens target on selection / hover / layout changes
  useLayoutEffect(() => {
    const a = animRef.current;
    a.totalW = layout.totalWidth;
    const baseLeft = layout.lefts[selectedIdx] ?? PAD;
    const baseWidth = layout.widths[selectedIdx] ?? SLOT;

    let lean = 0;
    if (!reduced && hoveredIdx !== null && hoveredIdx !== selectedIdx && !a.dragging) {
      lean = hoveredIdx > selectedIdx ? 4 : -4;
    }

    a.tLeft = baseLeft + lean;
    a.tWidth = baseWidth;

    if (!a.initialized || reduced) {
      a.left = a.tLeft;
      a.width = a.tWidth;
      a.vl = 0;
      a.vw = 0;
      a.initialized = true;
      applyClip(a.left, a.width, a.totalW);
    } else {
      startSpring();
    }
  }, [layout, selectedIdx, hoveredIdx, reduced, applyClip, startSpring]);

  useEffect(() => {
    const a = animRef.current;
    return () => {
      if (a.raf) window.cancelAnimationFrame(a.raf);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      let nextIdx = -1;
      if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = tabs.length - 1;
      else return;

      e.preventDefault();
      onValueChange(tabs[nextIdx].value);
      tabRefs.current[nextIdx]?.focus();
    },
    [tabs, onValueChange],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const target = e.target as HTMLElement;
      const tabBtn = target.closest<HTMLButtonElement>('[role="tab"]');
      if (!tabBtn || !tabBtn.hasAttribute("data-selected")) return;

      const a = animRef.current;
      a.dragging = true;
      a.pointerId = e.pointerId;
      a.dragStartX = e.clientX;
      a.dragOriginL = a.left;
      a.dragLastX = e.clientX;
      a.dragLastT = performance.now();
      a.dragVel = 0;
      a.dragMoved = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      setHeld(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const a = animRef.current;
      if (!a.dragging || a.pointerId !== e.pointerId) return;
      const dx = e.clientX - a.dragStartX;
      if (Math.abs(dx) > 4) a.dragMoved = true;

      const now = performance.now();
      const dt = Math.max(1, now - a.dragLastT);
      a.dragVel = ((e.clientX - a.dragLastX) / dt) * 1000;
      a.dragLastX = e.clientX;
      a.dragLastT = now;

      const minL = PAD;
      const maxL = a.totalW - PAD - a.width;
      let nextL = a.dragOriginL + dx;
      if (nextL < minL) nextL = minL + (nextL - minL) * 0.25;
      else if (nextL > maxL) nextL = maxL + (nextL - maxL) * 0.25;

      a.left = nextL;
      applyClip(a.left, a.width, a.totalW);
    },
    [applyClip],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const a = animRef.current;
      if (!a.dragging || a.pointerId !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      a.dragging = false;
      setHeld(false);

      if (a.dragMoved) {
        const projectedCenter = a.left + a.width / 2 + a.dragVel * 0.08;
        let bestIdx = selectedIdx;
        let bestDist = Infinity;
        tabs.forEach((_, i) => {
          const center = layout.lefts[i] + layout.widths[i] / 2;
          const dist = Math.abs(projectedCenter - center);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        });
        if (bestIdx === selectedIdx && Math.abs(a.dragVel) > 260) {
          bestIdx = Math.max(
            0,
            Math.min(tabs.length - 1, selectedIdx + (a.dragVel > 0 ? 1 : -1)),
          );
        }
        if (bestIdx !== selectedIdx) {
          onValueChange(tabs[bestIdx].value);
        } else {
          startSpring();
        }
      } else {
        startSpring();
      }
    },
    [layout, onValueChange, selectedIdx, startSpring, tabs],
  );

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={`${styles.bar}${className ? ` ${className}` : ""}`}
      data-held={held ? "" : undefined}
      style={{ width: layout.totalWidth } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => setHoveredIdx(null)}
    >
      {/* Hidden measurement row */}
      <div className={styles.measure} aria-hidden="true">
        {tabs.map((tab, i) => (
          <span
            key={tab.value}
            ref={(el) => {
              measureRefs.current[i] = el;
            }}
            className={styles.label}
            data-badged={tab.badge && tab.badge > 0 ? "" : undefined}
          >
            {tab.label}
          </span>
        ))}
      </div>

      {/* Base interactive tabs */}
      <div className={styles.row}>
        {tabs.map((tab, i) => {
          const selected = i === selectedIdx;
          const hasBadge = tab.badge !== undefined && tab.badge > 0;
          const showLabel =
            labels === "always" || (labels === "active" && selected);
          const accessibleLabel = hasBadge
            ? `${tab.label}, ${tab.badgeLabel ?? `${tab.badge} unread`}`
            : tab.label;

          return (
            <button
              key={tab.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={liquidTabId(baseId, tab.value)}
              aria-controls={liquidPanelId(baseId, tab.value)}
              aria-selected={selected}
              aria-label={accessibleLabel}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              data-selected={selected ? "" : undefined}
              data-badged={hasBadge ? "" : undefined}
              style={{ width: layout.widths[i] }}
              onClick={() => onValueChange(tab.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setHoveredIdx(i);
              }}
            >
              <span className={styles.icon} aria-hidden="true">
                {tab.icon}
              </span>
              {hasBadge && (
                <span className={styles.badgeAnchor}>
                  <RollingBadge count={tab.badge!} />
                </span>
              )}
              {labels !== "none" && (
                <span
                  className={styles.label}
                  style={{ opacity: showLabel ? 1 : 0 }}
                  aria-hidden="true"
                >
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Inverted lens layer */}
      <div ref={lensRef} className={styles.lens} aria-hidden="true">
        <div className={styles.row}>
          {tabs.map((tab, i) => {
            const selected = i === selectedIdx;
            const hasBadge = tab.badge !== undefined && tab.badge > 0;
            const showLabel =
              labels === "always" || (labels === "active" && selected);

            return (
              <div
                key={tab.value}
                className={styles.tab}
                data-selected={selected ? "" : undefined}
                data-badged={hasBadge ? "" : undefined}
                style={{ width: layout.widths[i] }}
              >
                <span className={styles.icon}>
                  {tab.activeIcon ? (
                    tab.activeIcon
                  ) : (
                    <span className={styles.filled}>{tab.icon}</span>
                  )}
                </span>
                {hasBadge && (
                  <span className={styles.badgeAnchor}>
                    <RollingBadge count={tab.badge!} inverted />
                  </span>
                )}
                {labels !== "none" && (
                  <span
                    className={styles.label}
                    style={{ opacity: showLabel ? 1 : 0 }}
                  >
                    {tab.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LiquidTabBar;
