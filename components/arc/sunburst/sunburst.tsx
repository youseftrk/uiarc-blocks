"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./sunburst.module.css";

export interface SunburstNode {
  id: string;
  label: string;
  value?: number;
  children?: SunburstNode[];
}

export interface SunburstProps {
  data: SunburstNode;
  label: string;
  formatValue?: (value: number) => string;
  depth?: number;
  size?: number;
  focus?: string;
  defaultFocus?: string;
  onFocusChange?: (id: string) => void;
  legend?: boolean;
  emptyLabel?: string;
  className?: string;
}

interface PartitionNode {
  id: string;
  label: string;
  value: number;
  depth: number;
  x0: number; // 0..1 normalized angle start
  x1: number; // 0..1 normalized angle end
  parentId: string | null;
  branchIndex: number;
  pathIds: string[];
  pathLabels: string[];
  childIds: string[];
  maxSubtreeDepth: number;
}

interface ArcGeom {
  a0: number; // radians
  a1: number;
  r0: number;
  r1: number;
}

const DEFAULT_FORMAT = (v: number) => Math.round(v).toLocaleString();
const SERIES_HUES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
];

function getHueForBranch(branchIndex: number): string {
  if (branchIndex >= 0 && branchIndex < SERIES_HUES.length) {
    return SERIES_HUES[branchIndex];
  }
  return "color-mix(in oklab, var(--foreground) 45%, var(--surface))";
}

function getFillForRing(hue: string, ringLevel: number): string {
  if (ringLevel <= 0) return hue;
  if (ringLevel === 1) return `color-mix(in oklab, ${hue} 68%, var(--surface))`;
  if (ringLevel === 2) return `color-mix(in oklab, ${hue} 44%, var(--surface))`;
  return `color-mix(in oklab, ${hue} 30%, var(--surface))`;
}

function partitionTree(root: SunburstNode): {
  nodes: PartitionNode[];
  byId: Map<string, PartitionNode>;
} {
  const nodes: PartitionNode[] = [];
  const byId = new Map<string, PartitionNode>();

  const computeValue = (n: SunburstNode): number => {
    if (n.children && n.children.length > 0) {
      return n.children.reduce((s, c) => s + computeValue(c), 0);
    }
    return Math.max(0, n.value ?? 0);
  };

  const computeMaxDepth = (n: SunburstNode): number => {
    if (!n.children || n.children.length === 0) return 0;
    return 1 + Math.max(...n.children.map(computeMaxDepth));
  };

  const total = computeValue(root);

  const walk = (
    n: SunburstNode,
    depth: number,
    x0: number,
    x1: number,
    parentId: string | null,
    branchIndex: number,
    pathIds: string[],
    pathLabels: string[],
  ) => {
    const val = computeValue(n);
    const nextPathIds = [...pathIds, n.id];
    const nextPathLabels = [...pathLabels, n.label];
    const pNode: PartitionNode = {
      id: n.id,
      label: n.label,
      value: val,
      depth,
      x0,
      x1,
      parentId,
      branchIndex,
      pathIds: nextPathIds,
      pathLabels: nextPathLabels,
      childIds: (n.children ?? []).map((c) => c.id),
      maxSubtreeDepth: computeMaxDepth(n),
    };
    nodes.push(pNode);
    byId.set(n.id, pNode);

    if (n.children && n.children.length > 0 && val > 0) {
      let cur = x0;
      n.children.forEach((child, idx) => {
        const cVal = computeValue(child);
        const span = (x1 - x0) * (cVal / val);
        const childBranch = depth === 0 ? idx : branchIndex;
        walk(
          child,
          depth + 1,
          cur,
          cur + span,
          n.id,
          childBranch,
          nextPathIds,
          nextPathLabels,
        );
        cur += span;
      });
    }
  };

  walk(root, 0, 0, total > 0 ? 1 : 0, null, -1, [], []);
  return { nodes, byId };
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  // Angle 0 at 12 o'clock (-PI/2)
  const rad = angle - Math.PI / 2;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const sweep = Math.max(0, a1 - a0);
  if (sweep <= 0.0005 || r1 <= r0 + 0.5) return "";
  // Clamp full circle slightly below 2*PI so SVG arc doesn't collapse
  const endAngle = sweep >= Math.PI * 2 - 0.0005 ? a0 + Math.PI * 2 - 0.001 : a1;
  const largeArc = endAngle - a0 > Math.PI ? 1 : 0;

  const p0 = polarToCartesian(cx, cy, r1, a0);
  const p1 = polarToCartesian(cx, cy, r1, endAngle);
  const p2 = polarToCartesian(cx, cy, r0, endAngle);
  const p3 = polarToCartesian(cx, cy, r0, a0);

  return [
    `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`,
    `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${largeArc} 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function describeLabelArc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  const mid = (a0 + a1) / 2;
  const bottomHalf = mid > Math.PI * 0.5 && mid < Math.PI * 1.5;
  const pad = 0.02;
  const start = a0 + pad;
  const end = a1 - pad;
  if (end <= start) return "";
  const largeArc = end - start > Math.PI ? 1 : 0;

  if (bottomHalf) {
    const pStart = polarToCartesian(cx, cy, r, end);
    const pEnd = polarToCartesian(cx, cy, r, start);
    return `M ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} 0 ${pEnd.x.toFixed(2)} ${pEnd.y.toFixed(2)}`;
  }
  const pStart = polarToCartesian(cx, cy, r, start);
  const pEnd = polarToCartesian(cx, cy, r, end);
  return `M ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} 1 ${pEnd.x.toFixed(2)} ${pEnd.y.toFixed(2)}`;
}

function RollingValue({
  text,
  reducedMotion,
}: {
  text: string;
  reducedMotion: boolean;
}) {
  const chars = Array.from(text);
  return (
    <span className={styles.roll} aria-label={text}>
      <span className={styles.digits} aria-hidden="true">
        {chars.map((ch, idx) => (
          <span key={`${idx}-${chars.length}`} className={styles.digit}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${idx}-${ch}`}
                style={{ display: "inline-block" }}
                initial={
                  reducedMotion
                    ? false
                    : { y: 10, opacity: 0, filter: "blur(2px)" }
                }
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { y: -10, opacity: 0, filter: "blur(2px)" }
                }
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: motionTokens.duration.standard }
                }
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </span>
  );
}

export function Sunburst({
  data,
  label,
  formatValue = DEFAULT_FORMAT,
  depth = 3,
  size = 340,
  focus: controlledFocus,
  defaultFocus,
  onFocusChange,
  legend = true,
  emptyLabel = "No data yet",
  className,
}: SunburstProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const uid = useId().replace(/:/g, "");

  const { nodes, byId } = useMemo(() => partitionTree(data), [data]);
  const rootNode = byId.get(data.id);
  const totalValue = rootNode?.value ?? 0;

  const [internalFocus, setInternalFocus] = useState<string>(
    defaultFocus ?? data.id,
  );
  const focusId = controlledFocus ?? internalFocus;
  const focusNode = byId.get(focusId) ?? rootNode;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const ringRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const labelArcRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const labelTextRefs = useRef<Map<string, SVGTextElement>>(new Map());
  const geomMapRef = useRef<Map<string, ArcGeom>>(new Map());
  const rafRef = useRef<number>(0);

  const setFocus = useCallback(
    (nextId: string) => {
      if (!byId.has(nextId)) return;
      if (controlledFocus === undefined) {
        setInternalFocus(nextId);
      }
      onFocusChange?.(nextId);
    },
    [byId, controlledFocus, onFocusChange],
  );

  // Compute target geometry for every node relative to focusNode
  const vb = 340;
  const cx = vb / 2;
  const cy = vb / 2;
  const innerHoleR = vb * 0.19;
  const outerMaxR = vb * 0.485;

  const visibleRings = Math.max(
    1,
    Math.min(depth, focusNode?.maxSubtreeDepth || 1),
  );
  const ringStep = (outerMaxR - innerHoleR) / visibleRings;

  const targetGeoms = useMemo(() => {
    const map = new Map<string, ArcGeom>();
    if (!focusNode || totalValue <= 0) return map;

    const fx0 = focusNode.x0;
    const fx1 = focusNode.x1;
    const fSpan = Math.max(1e-6, fx1 - fx0);

    for (const n of nodes) {
      if (n.depth === 0) continue;
      const relDepth = n.depth - focusNode.depth;
      const a0 =
        Math.max(0, Math.min(1, (n.x0 - fx0) / fSpan)) * Math.PI * 2;
      const a1 =
        Math.max(0, Math.min(1, (n.x1 - fx0) / fSpan)) * Math.PI * 2;

      let r0 = innerHoleR;
      let r1 = innerHoleR;
      if (relDepth >= 1 && relDepth <= visibleRings) {
        r0 = innerHoleR + (relDepth - 1) * ringStep;
        r1 = innerHoleR + relDepth * ringStep;
      } else if (relDepth > visibleRings) {
        r0 = outerMaxR;
        r1 = outerMaxR;
      }

      map.set(n.id, { a0, a1, r0, r1 });
    }
    return map;
  }, [nodes, focusNode, totalValue, visibleRings, ringStep, innerHoleR, outerMaxR]);

  // Animate arc path attributes directly via rAF spring without re-rendering React each frame
  useEffect(() => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);

    const applyGeom = (id: string, g: ArcGeom, nodeLabel: string) => {
      const pathEl = pathRefs.current.get(id);
      if (pathEl) {
        const d = describeArc(cx, cy, g.r0, g.r1, g.a0, g.a1);
        pathEl.setAttribute("d", d);
        pathEl.style.pointerEvents = d ? "auto" : "none";
      }

      const labelArcEl = labelArcRefs.current.get(id);
      const labelTextEl = labelTextRefs.current.get(id);
      if (labelArcEl && labelTextEl) {
        const midR = (g.r0 + g.r1) / 2;
        const arcLen = Math.max(0, g.a1 - g.a0) * midR;
        const ringThick = g.r1 - g.r0;
        const estimatedTextW = nodeLabel.length * 6.4 + 10;
        const fits =
          ringThick >= 18 && arcLen >= estimatedTextW && g.a1 - g.a0 > 0.16;

        if (fits) {
          labelArcEl.setAttribute(
            "d",
            describeLabelArc(cx, cy, midR, g.a0, g.a1),
          );
          labelTextEl.style.opacity = "1";
        } else {
          labelTextEl.style.opacity = "0";
        }
      }
    };

    const currentMap = geomMapRef.current;
    // Initialize any new nodes at target
    for (const [id, tgt] of targetGeoms.entries()) {
      if (!currentMap.has(id)) {
        currentMap.set(id, { ...tgt });
      }
    }

    if (reducedMotion) {
      for (const n of nodes) {
        const tgt = targetGeoms.get(n.id);
        if (!tgt) continue;
        currentMap.set(n.id, { ...tgt });
        applyGeom(n.id, tgt, n.label);
      }
      return;
    }

    const velMap = new Map<string, ArcGeom>();
    const stiffness = 210;
    const damping = 26;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      let settled = true;
      for (const n of nodes) {
        const tgt = targetGeoms.get(n.id);
        if (!tgt) continue;
        const cur = currentMap.get(n.id) ?? { ...tgt };
        const vel = velMap.get(n.id) ?? { a0: 0, a1: 0, r0: 0, r1: 0 };

        const keys: (keyof ArcGeom)[] = ["a0", "a1", "r0", "r1"];
        for (const k of keys) {
          const disp = tgt[k] - cur[k];
          const force = disp * stiffness - vel[k] * damping;
          vel[k] += force * dt;
          cur[k] += vel[k] * dt;
          if (Math.abs(disp) > 0.001 || Math.abs(vel[k]) > 0.005) {
            settled = false;
          } else {
            cur[k] = tgt[k];
            vel[k] = 0;
          }
        }

        currentMap.set(n.id, cur);
        velMap.set(n.id, vel);
        applyGeom(n.id, cur, n.label);
      }

      if (!settled) {
        rafRef.current = window.requestAnimationFrame(step);
      }
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [nodes, targetGeoms, reducedMotion, cx, cy]);

  // Breadcrumb ancestors
  const breadcrumbs = useMemo(() => {
    if (!focusNode) return [];
    return focusNode.pathIds
      .map((id) => byId.get(id))
      .filter((n): n is PartitionNode => Boolean(n));
  }, [focusNode, byId]);

  // Legend rows: direct children of focusNode
  const legendChildren = useMemo(() => {
    if (!focusNode) return [];
    return focusNode.childIds
      .map((id) => byId.get(id))
      .filter((n): n is PartitionNode => Boolean(n && n.value > 0));
  }, [focusNode, byId]);

  const activeNode = activeId ? byId.get(activeId) ?? null : null;

  // Center display: hovered/active node if hovering, otherwise focusNode
  const centerNode = focusNode;
  const centerMeta = useMemo(() => {
    if (!centerNode) return "";
    if (centerNode.id === data.id) {
      const count = centerNode.childIds.length;
      return `${count} ${count === 1 ? "group" : "groups"}`;
    }
    const parent = centerNode.parentId ? byId.get(centerNode.parentId) : null;
    if (parent && parent.value > 0) {
      return `${Math.round((centerNode.value / parent.value) * 100)}% of ${parent.label}`;
    }
    return "";
  }, [centerNode, data.id, byId]);

  // Check if node `n` is active or an ancestor/descendant of activeNode
  const isHighlighted = useCallback(
    (n: PartitionNode) => {
      if (!activeNode) return false;
      return (
        n.id === activeNode.id ||
        activeNode.pathIds.includes(n.id) ||
        n.pathIds.includes(activeNode.id)
      );
    },
    [activeNode],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!focusNode) return;

      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        if (focusNode.parentId) {
          setFocus(focusNode.parentId);
          setActiveId(null);
        } else {
          setActiveId(null);
        }
        return;
      }

      const cur =
        activeNode &&
        activeNode.depth > focusNode.depth &&
        activeNode.pathIds.includes(focusNode.id)
          ? activeNode
          : legendChildren[0] ?? null;
      if (!cur) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (cur.childIds.length > 0) {
          setFocus(cur.id);
          const nextFirst = byId.get(cur.childIds[0]);
          setActiveId(nextFirst?.id ?? null);
        }
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const parent = cur.parentId ? byId.get(cur.parentId) : null;
        if (!parent) return;
        const siblings = parent.childIds
          .map((id) => byId.get(id))
          .filter((n): n is PartitionNode => Boolean(n && n.value > 0));
        const idx = siblings.findIndex((s) => s.id === cur.id);
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const next = siblings[(idx + delta + siblings.length) % siblings.length];
        if (next) setActiveId(next.id);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const firstChild = cur.childIds
          .map((id) => byId.get(id))
          .find((n) => n && n.value > 0);
        if (firstChild && firstChild.depth - focusNode.depth <= visibleRings) {
          setActiveId(firstChild.id);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cur.parentId && cur.parentId !== focusNode.id) {
          setActiveId(cur.parentId);
        }
      }
    },
    [focusNode, activeNode, legendChildren, byId, visibleRings, setFocus],
  );

  // Tooltip details + live announcement
  const activeDetails = useMemo(() => {
    if (!activeNode) return null;
    const parent = activeNode.parentId ? byId.get(activeNode.parentId) : null;
    const pctParent =
      parent && parent.value > 0
        ? Math.round((activeNode.value / parent.value) * 100)
        : 100;
    const pctTotal =
      totalValue > 0 ? Math.round((activeNode.value / totalValue) * 100) : 0;
    const pathStr = activeNode.pathLabels.slice(1).join(" / ");
    return {
      path: pathStr || activeNode.label,
      name: activeNode.label,
      formatted: formatValue(activeNode.value),
      note:
        parent && parent.id !== data.id
          ? `${pctParent}% of ${parent.label} · ${pctTotal}% of total`
          : `${pctTotal}% of ${data.label}`,
      announcement: `${pathStr || activeNode.label}: ${formatValue(activeNode.value)}, ${pctParent}% of ${parent?.label ?? data.label}`,
    };
  }, [activeNode, byId, totalValue, formatValue, data.id, data.label]);

  const clampedTipStyle = useMemo(() => {
    if (!tipPos) return undefined;
    const left = Math.max(8, Math.min(size - 170, tipPos.x + 12));
    const top = Math.max(8, Math.min(size - 90, tipPos.y - 24));
    return { transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)` };
  }, [tipPos, size]);

  const isEmpty = totalValue <= 0;
  const isAtRoot = !focusNode || focusNode.id === data.id;

  return (
    <figure
      className={className ? `${styles.figure} ${className}` : styles.figure}
    >
      {/* Breadcrumb navigation */}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <ol className={styles.crumbList}>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <li key={crumb.id} className={styles.crumb}>
                {idx > 0 && (
                  <span className={styles.crumbSep} aria-hidden="true">
                    /
                  </span>
                )}
                {isLast ? (
                  <span className={styles.crumbCurrent} aria-current="location">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.crumbButton}
                    onClick={() => {
                      setFocus(crumb.id);
                      setActiveId(null);
                    }}
                  >
                    {crumb.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={styles.body}>
        {/* Sunburst ring */}
        <div
          ref={ringRef}
          className={styles.ring}
          style={{ width: `min(100%, ${size}px)` }}
          data-active={activeNode ? "" : undefined}
          role="group"
          aria-label={label}
          tabIndex={isEmpty ? -1 : 0}
          onFocus={() => {
            if (!activeId && legendChildren.length > 0) {
              setActiveId(legendChildren[0].id);
            }
          }}
          onBlur={() => {
            setActiveId(null);
            setTipPos(null);
          }}
          onMouseLeave={() => {
            setActiveId(null);
            setTipPos(null);
          }}
          onKeyDown={handleKeyDown}
        >
          <svg
            className={styles.svg}
            viewBox={`0 0 ${vb} ${vb}`}
            aria-hidden="true"
          >
            <defs>
              {nodes
                .filter((n) => n.depth > 0)
                .map((n) => (
                  <path
                    key={`def-${n.id}`}
                    id={`sb-arc-${uid}-${n.id}`}
                    ref={(el) => {
                      if (el) labelArcRefs.current.set(n.id, el);
                      else labelArcRefs.current.delete(n.id);
                    }}
                  />
                ))}
            </defs>

            <circle
              className={styles.track}
              cx={cx}
              cy={cy}
              r={(innerHoleR + outerMaxR) / 2}
              strokeWidth={outerMaxR - innerHoleR}
            />

            {/* Arcs */}
            <g>
              {nodes
                .filter((n) => n.depth > 0)
                .map((n) => {
                  const hue = getHueForBranch(n.branchIndex);
                  const relDepth = focusNode ? n.depth - focusNode.depth - 1 : n.depth - 1;
                  const fill = getFillForRing(hue, Math.max(0, relDepth));
                  const active = activeNode?.id === n.id;
                  const dim = activeNode !== null && !isHighlighted(n);

                  return (
                    <path
                      key={n.id}
                      ref={(el) => {
                        if (el) pathRefs.current.set(n.id, el);
                        else pathRefs.current.delete(n.id);
                      }}
                      className={styles.arc}
                      data-active={active ? "" : undefined}
                      data-dim={dim ? "" : undefined}
                      style={
                        {
                          "--hue": hue,
                          "--fill": fill,
                        } as CSSProperties
                      }
                      onMouseEnter={(e) => {
                        const rect = ringRef.current?.getBoundingClientRect();
                        if (rect) {
                          setTipPos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                        setActiveId(n.id);
                      }}
                      onMouseMove={(e) => {
                        const rect = ringRef.current?.getBoundingClientRect();
                        if (rect) {
                          setTipPos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                      }}
                      onClick={() => {
                        if (n.childIds.length > 0) {
                          setFocus(n.id);
                          setActiveId(null);
                          setTipPos(null);
                        }
                      }}
                    />
                  );
                })}
            </g>

            {/* Curved arc labels */}
            <g>
              {nodes
                .filter((n) => n.depth > 0)
                .map((n) => {
                  const dim = activeNode !== null && !isHighlighted(n);
                  return (
                    <text
                      key={`lbl-${n.id}`}
                      ref={(el) => {
                        if (el) labelTextRefs.current.set(n.id, el);
                        else labelTextRefs.current.delete(n.id);
                      }}
                      className={styles.arcLabel}
                      data-dim={dim ? "" : undefined}
                      style={{ opacity: 0 }}
                      dy="0.35em"
                    >
                      <textPath
                        href={`#sb-arc-${uid}-${n.id}`}
                        startOffset="50%"
                        textAnchor="middle"
                      >
                        {n.label}
                      </textPath>
                    </text>
                  );
                })}
            </g>
          </svg>

          {/* Center button (zooms out one level when zoomed in) */}
          <button
            type="button"
            className={styles.center}
            style={{ width: `${Math.round((innerHoleR * 2 * 0.94) / vb * 100)}%` }}
            disabled={isAtRoot}
            aria-label={
              isAtRoot
                ? `${centerNode?.label ?? label}: ${formatValue(centerNode?.value ?? 0)}`
                : `Zoom out from ${centerNode?.label ?? ""}`
            }
            onClick={() => {
              if (focusNode?.parentId) {
                setFocus(focusNode.parentId);
                setActiveId(null);
              }
            }}
          >
            {isEmpty ? (
              <span className={styles.centerMeta}>{emptyLabel}</span>
            ) : (
              <>
                <span className={styles.centerLabel}>
                  <span className={styles.swap}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={centerNode?.label ?? ""}
                        className={styles.swapText}
                        initial={
                          reducedMotion
                            ? false
                            : { opacity: 0, y: 4, filter: "blur(2px)" }
                        }
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={
                          reducedMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: -4, filter: "blur(2px)" }
                        }
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { duration: motionTokens.duration.fast }
                        }
                      >
                        {centerNode?.label}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </span>
                <span className={styles.centerValue}>
                  <RollingValue
                    text={formatValue(centerNode?.value ?? 0)}
                    reducedMotion={reducedMotion}
                  />
                </span>
                {centerMeta && (
                  <span className={styles.centerMeta}>
                    <span className={styles.swap}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={centerMeta}
                          className={styles.swapText}
                          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                          transition={
                            reducedMotion
                              ? { duration: 0 }
                              : { duration: motionTokens.duration.fast }
                          }
                        >
                          {centerMeta}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </span>
                )}
              </>
            )}
          </button>

          {/* Floating tooltip */}
          <div
            className={styles.tooltip}
            style={clampedTipStyle}
            aria-hidden="true"
          >
            {activeDetails && (
              <>
                <p className={styles.tipTitle}>{activeDetails.path}</p>
                <p className={styles.tipValue}>
                  <span className={styles.tipName}>{activeDetails.name}</span>
                  <span className={styles.tipAmount}>
                    {activeDetails.formatted}
                  </span>
                </p>
                <p className={styles.tipNote}>{activeDetails.note}</p>
              </>
            )}
          </div>
        </div>

        {/* Interactive Legend */}
        {legend && !isEmpty && legendChildren.length > 0 && (
          <div className={styles.legendBox}>
            <ul className={styles.legend}>
              {legendChildren.map((child) => {
                const hue = getHueForBranch(child.branchIndex);
                const share =
                  focusNode && focusNode.value > 0
                    ? Math.round((child.value / focusNode.value) * 100)
                    : 0;
                const active = activeNode?.id === child.id;
                const dim = activeNode !== null && !isHighlighted(child);
                const canZoom = child.childIds.length > 0;

                return (
                  <li key={child.id}>
                    <button
                      type="button"
                      className={styles.row}
                      data-active={active ? "" : undefined}
                      data-dim={dim ? "" : undefined}
                      style={
                        {
                          "--hue": hue,
                          "--fill": hue,
                        } as CSSProperties
                      }
                      aria-label={`${child.label}, ${formatValue(child.value)}, ${share}%${
                        canZoom ? ", zoom in" : ""
                      }`}
                      onMouseEnter={() => {
                        setActiveId(child.id);
                        setTipPos(null);
                      }}
                      onMouseLeave={() => setActiveId(null)}
                      onFocus={() => setActiveId(child.id)}
                      onBlur={() => setActiveId(null)}
                      onClick={() => {
                        if (canZoom) {
                          setFocus(child.id);
                          setActiveId(null);
                        }
                      }}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <span className={styles.rowLabel}>{child.label}</span>
                      <span className={styles.rowValue}>
                        {formatValue(child.value)}
                      </span>
                      <span className={styles.rowShare}>{share}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Live announcement */}
      <div className={styles.srOnly} role="status" aria-live="polite">
        {activeDetails?.announcement ?? ""}
      </div>

      {/* Complete accessible data table */}
      {!isEmpty && (
        <table className={styles.srOnly}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Path</th>
              <th scope="col">Value</th>
              <th scope="col">Share of parent</th>
            </tr>
          </thead>
          <tbody>
            {nodes
              .filter((n) => n.depth > 0)
              .map((n) => {
                const parent = n.parentId ? byId.get(n.parentId) : null;
                const share =
                  parent && parent.value > 0
                    ? Math.round((n.value / parent.value) * 100)
                    : 100;
                return (
                  <tr key={`row-${n.id}`}>
                    <td>{n.pathLabels.slice(1).join(" / ")}</td>
                    <td>{formatValue(n.value)}</td>
                    <td>{share}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </figure>
  );
}

export default Sunburst;
