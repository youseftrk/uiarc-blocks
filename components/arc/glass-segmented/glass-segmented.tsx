"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./glass-segmented.module.css";

export interface GlassSegmentedOption {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface GlassSegmentedProps {
  options: GlassSegmentedOption[];
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Box {
  left: number;
  right: number;
  top: number;
  height: number;
}

export function GlassSegmented({
  options,
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  size = "md",
  fullWidth = false,
  className,
  style,
}: GlassSegmentedProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const fillRectRef = useRef<SVGRectElement>(null);
  const edgeRectRef = useRef<SVGRectElement>(null);

  const firstEnabled = useMemo(
    () => options.find((o) => !o.disabled)?.value ?? options[0]?.value ?? "",
    [options],
  );

  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? firstEnabled);
  const isControlled = valueProp !== undefined;
  const activeValue = isControlled ? valueProp : uncontrolled;

  const [dragging, setDragging] = useState(false);

  const setValue = useCallback(
    (next: string) => {
      if (next === activeValue) return;
      const opt = options.find((o) => o.value === next);
      if (!opt || opt.disabled) return;
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [activeValue, isControlled, onValueChange, options],
  );

  // Spring physics for leading & trailing edges (liquid stretch + thin)
  const animRef = useRef({
    l: 4,
    vl: 0,
    r: 80,
    vr: 0,
    tl: 4,
    tr: 80,
    top: 4,
    baseH: 34,
    dir: 1 as 1 | -1,
    initialized: false,
    raf: 0,
    lastTime: 0,
    isDragging: false,
    dragStartX: 0,
    dragOriginL: 4,
    dragWidth: 80,
    dragLastX: 0,
    dragLastT: 0,
    dragVelX: 0,
    dragMoved: false,
  });

  const applyRect = useCallback(
    (l: number, r: number, top: number, baseH: number, stretchRatio: number) => {
      const w = Math.max(12, r - l);
      const thin = Math.min(4.5, stretchRatio * 5.5);
      const h = Math.max(18, baseH - thin);
      const y = top + (baseH - h) / 2;
      const rx = h / 2;

      for (const rect of [fillRectRef.current, edgeRectRef.current]) {
        if (!rect) continue;
        rect.setAttribute("x", l.toFixed(2));
        rect.setAttribute("y", y.toFixed(2));
        rect.setAttribute("width", `${w.toFixed(2)}px`);
        rect.setAttribute("height", `${h.toFixed(2)}px`);
        rect.setAttribute("rx", rx.toFixed(2));
      }
    },
    [],
  );

  const measureOption = useCallback((val: string): Box | null => {
    const root = rootRef.current;
    const btn = btnRefs.current.get(val);
    if (!root || !btn) return null;
    const rr = root.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return {
      left: br.left - rr.left - 1,
      right: br.right - rr.left - 1,
      top: br.top - rr.top - 1,
      height: br.height,
    };
  }, []);

  const startSpring = useCallback(() => {
    const a = animRef.current;
    if (a.raf) return;
    a.lastTime = performance.now();

    const tick = (now: number) => {
      if (a.isDragging) {
        a.raf = 0;
        return;
      }
      const dt = Math.min(0.032, Math.max(0.001, (now - a.lastTime) / 1000));
      a.lastTime = now;

      // Leading edge moves faster than trailing edge for liquid stretch
      const kLead = 540;
      const dLead = 34;
      const kTrail = 280;
      const dTrail = 27;

      const kL = a.dir < 0 ? kLead : kTrail;
      const dL = a.dir < 0 ? dLead : dTrail;
      const kR = a.dir > 0 ? kLead : kTrail;
      const dR = a.dir > 0 ? dLead : dTrail;

      const al = -kL * (a.l - a.tl) - dL * a.vl;
      const ar = -kR * (a.r - a.tr) - dR * a.vr;

      a.vl += al * dt;
      a.vr += ar * dt;
      a.l += a.vl * dt;
      a.r += a.vr * dt;

      const targetW = Math.max(1, a.tr - a.tl);
      const currW = Math.max(1, a.r - a.l);
      const stretch = Math.max(0, (currW - targetW) / targetW);

      const settled =
        Math.abs(a.l - a.tl) < 0.15 &&
        Math.abs(a.r - a.tr) < 0.15 &&
        Math.abs(a.vl) < 0.5 &&
        Math.abs(a.vr) < 0.5;

      if (settled) {
        a.l = a.tl;
        a.r = a.tr;
        a.vl = 0;
        a.vr = 0;
        applyRect(a.l, a.r, a.top, a.baseH, 0);
        a.raf = 0;
        return;
      }

      applyRect(a.l, a.r, a.top, a.baseH, stretch);
      a.raf = window.requestAnimationFrame(tick);
    };

    a.raf = window.requestAnimationFrame(tick);
  }, [applyRect]);

  const syncToActive = useCallback(
    (immediate: boolean) => {
      const box = measureOption(activeValue);
      if (!box) return;
      const a = animRef.current;
      a.top = box.top;
      a.baseH = box.height;

      if (!a.initialized || immediate || reduced) {
        a.l = box.left;
        a.r = box.right;
        a.tl = box.left;
        a.tr = box.right;
        a.vl = 0;
        a.vr = 0;
        a.initialized = true;
        applyRect(a.l, a.r, a.top, a.baseH, 0);
        return;
      }

      a.dir = box.left >= a.tl ? 1 : -1;
      a.tl = box.left;
      a.tr = box.right;
      startSpring();
    },
    [activeValue, applyRect, measureOption, reduced, startSpring],
  );

  useLayoutEffect(() => {
    syncToActive(false);
  }, [syncToActive, size, fullWidth, options]);

  useEffect(() => {
    const root = rootRef.current;
    const anim = animRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => {
      syncToActive(true);
    });
    ro.observe(root);
    return () => {
      ro.disconnect();
      if (anim.raf) {
        window.cancelAnimationFrame(anim.raf);
      }
    };
  }, [syncToActive]);

  const handlePointerDown = useCallback(
    (opt: GlassSegmentedOption, e: PointerEvent<HTMLButtonElement>) => {
      if (opt.disabled || opt.value !== activeValue) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const box = measureOption(opt.value);
      if (!box) return;

      const a = animRef.current;
      if (a.raf) {
        window.cancelAnimationFrame(a.raf);
        a.raf = 0;
      }
      a.isDragging = true;
      a.dragStartX = e.clientX;
      a.dragOriginL = box.left;
      a.dragWidth = box.right - box.left;
      a.dragLastX = e.clientX;
      a.dragLastT = performance.now();
      a.dragVelX = 0;
      a.dragMoved = false;

      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [activeValue, measureOption],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const a = animRef.current;
      if (!a.isDragging) return;
      const root = rootRef.current;
      if (!root) return;
      const rr = root.getBoundingClientRect();
      const dx = e.clientX - a.dragStartX;
      if (Math.abs(dx) > 3) a.dragMoved = true;

      const now = performance.now();
      const dt = Math.max(1, now - a.dragLastT);
      const instV = ((e.clientX - a.dragLastX) / dt) * 1000;
      a.dragVelX = a.dragVelX * 0.6 + instV * 0.4;
      a.dragLastX = e.clientX;
      a.dragLastT = now;

      const minL = 3;
      const maxL = Math.max(minL, rr.width - a.dragWidth - 5);
      const nextL = Math.min(maxL, Math.max(minL, a.dragOriginL + dx));
      a.l = nextL;
      a.r = nextL + a.dragWidth;
      const stretch = reduced ? 0 : Math.min(0.4, Math.abs(a.dragVelX) / 2800);
      applyRect(a.l, a.r, a.top, a.baseH, stretch);
    },
    [applyRect, reduced],
  );

  const finishDrag = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const a = animRef.current;
      if (!a.isDragging) return;
      a.isDragging = false;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (!a.dragMoved) {
        syncToActive(false);
        return;
      }

      // Project velocity to pick closest enabled segment
      const projectedCenter =
        (a.l + a.r) / 2 + (reduced ? 0 : Math.max(-140, Math.min(140, a.dragVelX * 0.12)));

      let bestVal = activeValue;
      let bestDist = Infinity;
      for (const opt of options) {
        if (opt.disabled) continue;
        const box = measureOption(opt.value);
        if (!box) continue;
        const center = (box.left + box.right) / 2;
        const dist = Math.abs(center - projectedCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestVal = opt.value;
        }
      }

      if (bestVal !== activeValue) {
        setValue(bestVal);
      } else {
        syncToActive(false);
      }
    },
    [activeValue, measureOption, options, reduced, setValue, syncToActive],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const enabled = options.filter((o) => !o.disabled);
      if (enabled.length === 0) return;
      const idx = enabled.findIndex((o) => o.value === activeValue);
      let nextIdx = -1;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIdx = (idx + 1) % enabled.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIdx = (idx - 1 + enabled.length) % enabled.length;
      } else if (e.key === "Home") {
        nextIdx = 0;
      } else if (e.key === "End") {
        nextIdx = enabled.length - 1;
      } else {
        return;
      }

      e.preventDefault();
      const target = enabled[nextIdx];
      if (!target) return;
      setValue(target.value);
      btnRefs.current.get(target.value)?.focus();
    },
    [activeValue, options, setValue],
  );

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={label}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-size={size}
      data-full={fullWidth ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      style={style}
      onKeyDown={handleKeyDown}
    >
      <svg className={styles.drop} aria-hidden="true">
        <rect ref={fillRectRef} className={styles.dropFill} x="4" y="4" width="0" height="34" rx="17" />
        <rect ref={edgeRectRef} className={styles.dropEdge} x="4" y="4" width="0" height="34" rx="17" />
      </svg>

      {options.map((opt) => {
        const selected = opt.value === activeValue;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) btnRefs.current.set(opt.value, el);
              else btnRefs.current.delete(opt.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            tabIndex={selected ? 0 : -1}
            className={styles.segment}
            data-value={opt.value}
            data-on={selected ? "" : undefined}
            onClick={() => setValue(opt.value)}
            onPointerDown={(e) => handlePointerDown(opt, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {opt.icon != null && (
              <span className={styles.icon} aria-hidden="true">
                {opt.icon}
              </span>
            )}
            <span className={styles.label}>{opt.label}</span>
            {opt.badge != null && (
              <span className={styles.badge}>{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default GlassSegmented;
