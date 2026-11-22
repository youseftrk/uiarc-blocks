"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./sankey-flow.module.css";

export interface SankeyNode {
  id: string;
  label: string;
  column?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyFlowProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  label: string;
  columns?: string[];
  unit?: string;
  totalLabel?: string;
  formatValue?: (value: number) => string;
  height?: number;
  particles?: boolean;
  defaultParticles?: boolean;
  onParticlesChange?: (on: boolean) => void;
  particleToggle?: boolean;
  emptyLabel?: string;
  className?: string;
}

interface LayoutNode {
  id: string;
  label: string;
  column: number;
  order: number;
  value: number;
  inValue: number;
  outValue: number;
  slot?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutLink {
  key: string;
  index: number;
  source: string;
  target: string;
  value: number;
  slot?: number;
  // Horizontal or vertical coordinates
  sx: number;
  sy0: number;
  sy1: number;
  tx: number;
  ty0: number;
  ty1: number;
  // For upright layout
  upright: boolean;
}

type FocusTarget =
  | { kind: "node"; id: string }
  | { kind: "link"; key: string }
  | null;

interface Particle {
  linkIndex: number;
  t: number;
  speed: number;
  offset: number; // -0.4..0.4 across ribbon thickness
  radius: number;
  alpha: number;
}

const DEFAULT_FORMAT = (v: number) => Math.round(v).toLocaleString();
const NODE_THICKNESS = 10;
const NODE_GAP = 14;
const UPRIGHT_BREAKPOINT = 420;

function ribbonPathHorizontal(
  sx: number,
  sy0: number,
  sy1: number,
  tx: number,
  ty0: number,
  ty1: number,
): string {
  const mx = (sx + tx) / 2;
  return [
    `M ${sx} ${sy0}`,
    `C ${mx} ${sy0}, ${mx} ${ty0}, ${tx} ${ty0}`,
    `L ${tx} ${ty1}`,
    `C ${mx} ${ty1}, ${mx} ${sy1}, ${sx} ${sy1}`,
    "Z",
  ].join(" ");
}

function ribbonPathUpright(
  sy: number,
  sx0: number,
  sx1: number,
  ty: number,
  tx0: number,
  tx1: number,
): string {
  const my = (sy + ty) / 2;
  return [
    `M ${sx0} ${sy}`,
    `C ${sx0} ${my}, ${tx0} ${my}, ${tx0} ${ty}`,
    `L ${tx1} ${ty}`,
    `C ${tx1} ${my}, ${sx1} ${my}, ${sx1} ${sy}`,
    "Z",
  ].join(" ");
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

function computeLayout(
  nodesInput: SankeyNode[],
  linksInput: SankeyLink[],
  width: number,
  height: number,
  upright: boolean,
) {
  const positiveLinks = linksInput.filter((l) => l.value > 0);
  if (positiveLinks.length === 0 || nodesInput.length === 0 || width <= 0 || height <= 0) {
    return {
      nodes: [] as LayoutNode[],
      links: [] as LayoutLink[],
      columnCount: 0,
      columnPositions: [] as number[],
      firstColumnTotal: 0,
    };
  }

  const nodeMap = new Map<string, SankeyNode>();
  nodesInput.forEach((n) => nodeMap.set(n.id, n));

  const validLinks = positiveLinks.filter(
    (l) => nodeMap.has(l.source) && nodeMap.has(l.target) && l.source !== l.target,
  );
  if (validLinks.length === 0) {
    return {
      nodes: [] as LayoutNode[],
      links: [] as LayoutLink[],
      columnCount: 0,
      columnPositions: [] as number[],
      firstColumnTotal: 0,
    };
  }

  // Infer columns via longest distance from a source when column is omitted
  const incomingMap = new Map<string, SankeyLink[]>();
  const outgoingMap = new Map<string, SankeyLink[]>();
  nodesInput.forEach((n) => {
    incomingMap.set(n.id, []);
    outgoingMap.set(n.id, []);
  });
  validLinks.forEach((l) => {
    incomingMap.get(l.target)!.push(l);
    outgoingMap.get(l.source)!.push(l);
  });

  const colCache = new Map<string, number>();
  const visiting = new Set<string>();
  const getCol = (id: string): number => {
    if (colCache.has(id)) return colCache.get(id)!;
    const explicit = nodeMap.get(id)?.column;
    if (typeof explicit === "number") {
      colCache.set(id, explicit);
      return explicit;
    }
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const inc = incomingMap.get(id) ?? [];
    const col = inc.length === 0 ? 0 : Math.max(...inc.map((l) => getCol(l.source) + 1));
    visiting.delete(id);
    colCache.set(id, col);
    return col;
  };

  nodesInput.forEach((n) => getCol(n.id));
  const usedCols = Array.from(new Set(nodesInput.map((n) => colCache.get(n.id) ?? 0))).sort(
    (a, b) => a - b,
  );
  const colIndexMap = new Map<number, number>();
  usedCols.forEach((c, idx) => colIndexMap.set(c, idx));
  const columnCount = usedCols.length;

  // Group nodes by column in input order
  const columnsArr: LayoutNode[][] = Array.from({ length: columnCount }, () => []);
  nodesInput.forEach((n) => {
    const c = colIndexMap.get(colCache.get(n.id) ?? 0) ?? 0;
    const inVal = (incomingMap.get(n.id) ?? []).reduce((s, l) => s + l.value, 0);
    const outVal = (outgoingMap.get(n.id) ?? []).reduce((s, l) => s + l.value, 0);
    const value = Math.max(inVal, outVal);
    if (value <= 0) return;
    const order = columnsArr[c].length;
    columnsArr[c].push({
      id: n.id,
      label: n.label,
      column: c,
      order,
      value,
      inValue: inVal,
      outValue: outVal,
      slot: c === 0 ? order % 4 : undefined,
      x: 0,
      y: 0,
      w: NODE_THICKNESS,
      h: NODE_THICKNESS,
    });
  });

  const firstColumnTotal = columnsArr[0]?.reduce((s, n) => s + n.value, 0) ?? 0;

  // Compute global scale (px per unit)
  const padMain = upright ? 16 : 6;
  const padCross = upright ? 8 : 6;
  const usableCross = (upright ? width : height) - padCross * 2;
  const usableMain = (upright ? height : width) - padMain * 2;

  let scale = Infinity;
  columnsArr.forEach((colNodes) => {
    if (colNodes.length === 0) return;
    const totalVal = colNodes.reduce((s, n) => s + n.value, 0);
    const totalGap = Math.max(0, colNodes.length - 1) * NODE_GAP;
    const avail = Math.max(20, usableCross - totalGap);
    scale = Math.min(scale, avail / totalVal);
  });
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  // Leave room on the right for the last column's labels in horizontal mode if desired,
  // or place labels inward/outward cleanly like the preview (in preview, last column labels sit to the right of the node bar,
  // so leave ~96px right margin on desktop).
  const rightLabelPad = upright ? 0 : Math.min(108, Math.max(72, Math.floor(width * 0.16)));
  const spanMain = Math.max(
    40,
    usableMain - (upright ? 0 : rightLabelPad) - NODE_THICKNESS,
  );
  const colPositions: number[] = [];
  for (let c = 0; c < columnCount; c++) {
    const frac = columnCount <= 1 ? 0 : c / (columnCount - 1);
    colPositions.push(padMain + frac * spanMain);
  }

  const layoutNodeMap = new Map<string, LayoutNode>();
  const allNodes: LayoutNode[] = [];

  columnsArr.forEach((colNodes, c) => {
    const totalLen =
      colNodes.reduce((s, n) => s + Math.max(4, n.value * scale), 0) +
      Math.max(0, colNodes.length - 1) * NODE_GAP;
    let cursor = padCross + Math.max(0, (usableCross - totalLen) / 2);
    colNodes.forEach((n) => {
      const len = Math.max(4, n.value * scale);
      if (upright) {
        n.x = cursor;
        n.y = colPositions[c];
        n.w = len;
        n.h = NODE_THICKNESS;
      } else {
        n.x = colPositions[c];
        n.y = cursor;
        n.w = NODE_THICKNESS;
        n.h = len;
      }
      cursor += len + NODE_GAP;
      layoutNodeMap.set(n.id, n);
      allNodes.push(n);
    });
  });

  // Sort links within each source by target order and within each target by source order
  const outOffset = new Map<string, number>();
  const inOffset = new Map<string, number>();
  allNodes.forEach((n) => {
    outOffset.set(n.id, upright ? n.x : n.y);
    inOffset.set(n.id, upright ? n.x : n.y);
  });

  const sortedLinks = [...validLinks].sort((a, b) => {
    const sa = layoutNodeMap.get(a.source);
    const sb = layoutNodeMap.get(b.source);
    const ta = layoutNodeMap.get(a.target);
    const tb = layoutNodeMap.get(b.target);
    if (!sa || !sb || !ta || !tb) return 0;
    if (sa.column !== sb.column) return sa.column - sb.column;
    if (sa.order !== sb.order) return sa.order - sb.order;
    return ta.order - tb.order;
  });

  // Compute source offsets in target-order, target offsets in source-order
  const outByNode = new Map<string, SankeyLink[]>();
  const inByNode = new Map<string, SankeyLink[]>();
  sortedLinks.forEach((l) => {
    if (!outByNode.has(l.source)) outByNode.set(l.source, []);
    outByNode.get(l.source)!.push(l);
    if (!inByNode.has(l.target)) inByNode.set(l.target, []);
    inByNode.get(l.target)!.push(l);
  });

  outByNode.forEach((arr) =>
    arr.sort(
      (a, b) =>
        (layoutNodeMap.get(a.target)?.order ?? 0) -
        (layoutNodeMap.get(b.target)?.order ?? 0),
    ),
  );
  inByNode.forEach((arr) =>
    arr.sort(
      (a, b) =>
        (layoutNodeMap.get(a.source)?.order ?? 0) -
        (layoutNodeMap.get(b.source)?.order ?? 0),
    ),
  );

  const linkSourceStart = new Map<SankeyLink, number>();
  const linkTargetStart = new Map<SankeyLink, number>();

  outByNode.forEach((arr, srcId) => {
    const srcNode = layoutNodeMap.get(srcId);
    if (!srcNode) return;
    const nodeSpan = upright ? srcNode.w : srcNode.h;
    const totalOut = arr.reduce((s, l) => s + l.value, 0);
    const ratio = totalOut > 0 ? Math.min(1, nodeSpan / (totalOut * scale)) : 1;
    let cur = upright ? srcNode.x : srcNode.y;
    arr.forEach((l) => {
      linkSourceStart.set(l, cur);
      cur += Math.max(1.5, l.value * scale * ratio);
    });
  });

  inByNode.forEach((arr, tgtId) => {
    const tgtNode = layoutNodeMap.get(tgtId);
    if (!tgtNode) return;
    const nodeSpan = upright ? tgtNode.w : tgtNode.h;
    const totalIn = arr.reduce((s, l) => s + l.value, 0);
    const ratio = totalIn > 0 ? Math.min(1, nodeSpan / (totalIn * scale)) : 1;
    let cur = upright ? tgtNode.x : tgtNode.y;
    arr.forEach((l) => {
      linkTargetStart.set(l, cur);
      cur += Math.max(1.5, l.value * scale * ratio);
    });
  });

  const layoutLinks: LayoutLink[] = [];
  sortedLinks.forEach((l, index) => {
    const src = layoutNodeMap.get(l.source);
    const tgt = layoutNodeMap.get(l.target);
    if (!src || !tgt) return;

    const s0 = linkSourceStart.get(l) ?? (upright ? src.x : src.y);
    const t0 = linkTargetStart.get(l) ?? (upright ? tgt.x : tgt.y);

    const srcTotalOut = (outByNode.get(l.source) ?? []).reduce((s, x) => s + x.value, 0);
    const tgtTotalIn = (inByNode.get(l.target) ?? []).reduce((s, x) => s + x.value, 0);
    const sSpan = upright ? src.w : src.h;
    const tSpan = upright ? tgt.w : tgt.h;
    const sRatio = srcTotalOut > 0 ? Math.min(1, sSpan / (srcTotalOut * scale)) : 1;
    const tRatio = tgtTotalIn > 0 ? Math.min(1, tSpan / (tgtTotalIn * scale)) : 1;

    const sThickness = Math.max(1.5, l.value * scale * sRatio);
    const tThickness = Math.max(1.5, l.value * scale * tRatio);

    layoutLinks.push({
      key: `${l.source}__${l.target}`,
      index,
      source: l.source,
      target: l.target,
      value: l.value,
      slot: src.slot,
      sx: upright ? src.y + src.h : src.x + src.w,
      sy0: s0,
      sy1: s0 + sThickness,
      tx: upright ? tgt.y : tgt.x,
      ty0: t0,
      ty1: t0 + tThickness,
      upright,
    });
  });

  return {
    nodes: allNodes,
    links: layoutLinks,
    columnCount,
    columnPositions: colPositions,
    firstColumnTotal,
  };
}

/**
 * Propagate traced share across the entire DAG from a focused node or link.
 * Returns maps of traced share fraction (0..1) for each link and each node,
 * plus the dominant source slot (0..3) if traceable to a single source.
 */
function computeTrace(
  focus: FocusTarget,
  nodes: LayoutNode[],
  links: LayoutLink[],
) {
  const linkShare = new Map<string, number>();
  const nodeShare = new Map<string, number>();
  let glowSlot: number | undefined;

  if (!focus) return { linkShare, nodeShare, glowSlot };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outLinks = new Map<string, LayoutLink[]>();
  const inLinks = new Map<string, LayoutLink[]>();
  nodes.forEach((n) => {
    outLinks.set(n.id, []);
    inLinks.set(n.id, []);
  });
  links.forEach((l) => {
    outLinks.get(l.source)?.push(l);
    inLinks.get(l.target)?.push(l);
  });

  const nodeFlow = new Map<string, number>();

  if (focus.kind === "node") {
    const startNode = nodeById.get(focus.id);
    if (!startNode) return { linkShare, nodeShare, glowSlot };
    glowSlot = startNode.slot;
    nodeFlow.set(startNode.id, startNode.value);

    // Propagate forward by column order
    const byCol = [...nodes].sort((a, b) => a.column - b.column);
    for (const n of byCol) {
      if (n.column < startNode.column) continue;
      const flow = nodeFlow.get(n.id) ?? 0;
      if (flow <= 0) continue;
      const outs = outLinks.get(n.id) ?? [];
      const totalOut = outs.reduce((s, l) => s + l.value, 0);
      if (totalOut <= 0) continue;
      const frac = Math.min(1, flow / Math.max(n.value, totalOut));
      for (const l of outs) {
        const amt = l.value * frac;
        linkShare.set(l.key, Math.min(1, (linkShare.get(l.key) ?? 0) + amt / l.value));
        nodeFlow.set(l.target, (nodeFlow.get(l.target) ?? 0) + amt);
      }
    }

    // Propagate backward by reverse column order
    const revCol = [...nodes].sort((a, b) => b.column - a.column);
    for (const n of revCol) {
      if (n.column > startNode.column) continue;
      const flow = nodeFlow.get(n.id) ?? 0;
      if (flow <= 0) continue;
      const ins = inLinks.get(n.id) ?? [];
      const totalIn = ins.reduce((s, l) => s + l.value, 0);
      if (totalIn <= 0) continue;
      const frac = Math.min(1, flow / Math.max(n.value, totalIn));
      for (const l of ins) {
        const amt = l.value * frac;
        linkShare.set(l.key, Math.min(1, (linkShare.get(l.key) ?? 0) + amt / l.value));
        nodeFlow.set(l.source, (nodeFlow.get(l.source) ?? 0) + amt);
      }
    }
  } else {
    const startLink = links.find((l) => l.key === focus.key);
    if (!startLink) return { linkShare, nodeShare, glowSlot };
    glowSlot = startLink.slot;
    linkShare.set(startLink.key, 1);

    // Forward from target
    nodeFlow.set(startLink.target, startLink.value);
    const tgtCol = nodeById.get(startLink.target)?.column ?? 0;
    const byCol = [...nodes].sort((a, b) => a.column - b.column);
    for (const n of byCol) {
      if (n.column < tgtCol) continue;
      const flow = nodeFlow.get(n.id) ?? 0;
      if (flow <= 0) continue;
      const outs = outLinks.get(n.id) ?? [];
      const totalOut = outs.reduce((s, l) => s + l.value, 0);
      if (totalOut <= 0) continue;
      const frac = Math.min(1, flow / Math.max(n.value, totalOut));
      for (const l of outs) {
        const amt = l.value * frac;
        linkShare.set(l.key, Math.min(1, (linkShare.get(l.key) ?? 0) + amt / l.value));
        nodeFlow.set(l.target, (nodeFlow.get(l.target) ?? 0) + amt);
      }
    }

    // Backward from source
    nodeFlow.set(startLink.source, startLink.value);
    const srcCol = nodeById.get(startLink.source)?.column ?? 0;
    const revCol = [...nodes].sort((a, b) => b.column - a.column);
    for (const n of revCol) {
      if (n.column > srcCol) continue;
      const flow = nodeFlow.get(n.id) ?? 0;
      if (flow <= 0) continue;
      const ins = inLinks.get(n.id) ?? [];
      const totalIn = ins.reduce((s, l) => s + l.value, 0);
      if (totalIn <= 0) continue;
      const frac = Math.min(1, flow / Math.max(n.value, totalIn));
      for (const l of ins) {
        const amt = l.value * frac;
        linkShare.set(l.key, Math.min(1, (linkShare.get(l.key) ?? 0) + amt / l.value));
        nodeFlow.set(l.source, (nodeFlow.get(l.source) ?? 0) + amt);
      }
    }
  }

  nodeFlow.forEach((flow, id) => {
    const n = nodeById.get(id);
    if (n && n.value > 0) {
      nodeShare.set(id, Math.min(1, flow / n.value));
    }
  });

  return { linkShare, nodeShare, glowSlot };
}

export function SankeyFlow({
  nodes,
  links,
  label,
  columns,
  unit = "",
  totalLabel = "the total",
  formatValue = DEFAULT_FORMAT,
  height = 340,
  particles,
  defaultParticles = true,
  onParticlesChange,
  particleToggle = true,
  emptyLabel = "No flows yet",
  className,
}: SankeyFlowProps) {
  const reducedMotion = useReducedMotion();
  const chartRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inksRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(chartRef, { amount: 0.1 });

  const [width, setWidth] = useState(680);
  const [internalParticles, setInternalParticles] = useState(defaultParticles);
  const [focus, setFocus] = useState<FocusTarget>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const particlesOn = reducedMotion
    ? false
    : particles !== undefined
      ? particles
      : internalParticles;

  const toggleParticles = () => {
    const next = !particlesOn;
    if (particles === undefined) {
      setInternalParticles(next);
    }
    onParticlesChange?.(next);
  };

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const upright = width < UPRIGHT_BREAKPOINT;
  const plotHeight = upright ? Math.max(height, 480) : height;

  const layout = useMemo(
    () => computeLayout(nodes, links, width, plotHeight, upright),
    [nodes, links, width, plotHeight, upright],
  );

  const trace = useMemo(
    () => computeTrace(focus, layout.nodes, layout.links),
    [focus, layout.nodes, layout.links],
  );

  const nodeById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  // Canvas particle engine — pauses when off-screen, reduced motion, or toggled off
  const traceRef = useRef(trace);
  const focusRef = useRef(focus);
  const layoutRef = useRef(layout);

  useEffect(() => {
    traceRef.current = trace;
    focusRef.current = focus;
    layoutRef.current = layout;
  }, [trace, focus, layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(plotHeight * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${plotHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!particlesOn || !inView || layout.links.length === 0) {
      ctx.clearRect(0, 0, width, plotHeight);
      return;
    }

    // Seed particles proportional to link volume
    const totalVal = layout.links.reduce((s, l) => s + l.value, 0) || 1;
    const particlesArr: Particle[] = [];
    layout.links.forEach((l, idx) => {
      const count = Math.max(3, Math.min(22, Math.round((l.value / totalVal) * 140)));
      for (let i = 0; i < count; i++) {
        particlesArr.push({
          linkIndex: idx,
          t: (i + Math.random() * 0.8) / count,
          speed: 0.0022 + Math.random() * 0.0014,
          offset: (Math.random() - 0.5) * 0.78,
          radius: 1.05 + Math.random() * 0.65,
          alpha: 0.28 + Math.random() * 0.25,
        });
      }
    });

    let rafId = 0;

    const readInkColors = () => {
      const probe = inksRef.current;
      if (!probe) return { fg: "rgba(15, 23, 42, 0.55)", glow: "rgba(59, 130, 246, 0.85)" };
      const cs = getComputedStyle(probe);
      return {
        fg: cs.color || "#18181b",
        glow: cs.backgroundColor || "#2563eb",
      };
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, plotHeight);
      const { links: curLinks } = layoutRef.current;
      const curFocus = focusRef.current;
      const { linkShare } = traceRef.current;
      const { fg, glow } = readInkColors();

      for (let i = 0; i < particlesArr.length; i++) {
        const p = particlesArr[i];
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;

        const l = curLinks[p.linkIndex];
        if (!l) continue;

        const share = linkShare.get(l.key) ?? 0;
        const lit = curFocus !== null && share > 0;
        const dimmed = curFocus !== null && share === 0;

        let x: number;
        let y: number;
        if (l.upright) {
          const sx = (l.sy0 + l.sy1) / 2 + (l.sy1 - l.sy0) * p.offset;
          const tx = (l.ty0 + l.ty1) / 2 + (l.ty1 - l.ty0) * p.offset;
          const my = (l.sx + l.tx) / 2;
          x = cubicBezier(sx, sx, tx, tx, p.t);
          y = cubicBezier(l.sx, my, my, l.tx, p.t);
        } else {
          const sy = (l.sy0 + l.sy1) / 2 + (l.sy1 - l.sy0) * p.offset;
          const ty = (l.ty0 + l.ty1) / 2 + (l.ty1 - l.ty0) * p.offset;
          const mx = (l.sx + l.tx) / 2;
          x = cubicBezier(l.sx, mx, mx, l.tx, p.t);
          y = cubicBezier(sy, sy, ty, ty, p.t);
        }

        // Fade softly at ribbon ends
        const edgeFade = Math.min(1, p.t * 6, (1 - p.t) * 6);
        const alpha = (dimmed ? p.alpha * 0.25 : lit ? Math.min(0.9, p.alpha * 1.9) : p.alpha) * edgeFade;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = lit ? glow : fg;
        ctx.beginPath();
        ctx.arc(x, y, lit ? p.radius * 1.15 : p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [particlesOn, inView, layout.links, width, plotHeight]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (layout.nodes.length === 0) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setFocus(null);
        setTipPos(null);
        return;
      }

      const currentNode =
        focus?.kind === "node"
          ? nodeById.get(focus.id)
          : layout.nodes[0];
      if (!currentNode) return;

      const colNodes = (col: number) =>
        layout.nodes.filter((n) => n.column === col).sort((a, b) => a.order - b.order);

      const moveInColumn = (delta: number) => {
        const list = colNodes(currentNode.column);
        const idx = list.findIndex((n) => n.id === currentNode.id);
        const next = list[(idx + delta + list.length) % list.length];
        if (next) {
          setFocus({ kind: "node", id: next.id });
          setTipPos({ x: next.x + next.w / 2, y: next.y + next.h / 2 });
        }
      };

      const moveBetweenColumns = (delta: number) => {
        const nextCol = Math.max(
          0,
          Math.min(layout.columnCount - 1, currentNode.column + delta),
        );
        const list = colNodes(nextCol);
        if (list.length === 0) return;
        const curMid = upright
          ? currentNode.x + currentNode.w / 2
          : currentNode.y + currentNode.h / 2;
        let nearest = list[0];
        let bestDist = Infinity;
        for (const cand of list) {
          const mid = upright ? cand.x + cand.w / 2 : cand.y + cand.h / 2;
          const d = Math.abs(mid - curMid);
          if (d < bestDist) {
            bestDist = d;
            nearest = cand;
          }
        }
        setFocus({ kind: "node", id: nearest.id });
        setTipPos({ x: nearest.x + nearest.w / 2, y: nearest.y + nearest.h / 2 });
      };

      if (e.key === "Home") {
        e.preventDefault();
        const first = colNodes(0)[0];
        if (first) {
          setFocus({ kind: "node", id: first.id });
          setTipPos({ x: first.x + first.w / 2, y: first.y + first.h / 2 });
        }
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        const last = colNodes(layout.columnCount - 1)[0];
        if (last) {
          setFocus({ kind: "node", id: last.id });
          setTipPos({ x: last.x + last.w / 2, y: last.y + last.h / 2 });
        }
        return;
      }

      if (upright) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveInColumn(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveInColumn(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moveBetweenColumns(-1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          moveBetweenColumns(1);
        }
      } else {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveInColumn(-1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          moveInColumn(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveBetweenColumns(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveBetweenColumns(1);
        }
      }
    },
    [focus, layout.nodes, layout.columnCount, nodeById, upright],
  );

  // Build tooltip & live announcement content
  const tooltipData = useMemo(() => {
    if (!focus) return null;
    const total = layout.firstColumnTotal || 1;
    const unitSuffix = unit ? ` ${unit}` : "";

    if (focus.kind === "node") {
      const node = nodeById.get(focus.id);
      if (!node) return null;
      const pct = Math.round((node.value / total) * 100);
      const outs = layout.links
        .filter((l) => l.source === node.id)
        .sort((a, b) => b.value - a.value);
      const ins = layout.links
        .filter((l) => l.target === node.id)
        .sort((a, b) => b.value - a.value);
      const rows = (outs.length > 0 ? outs : ins).slice(0, 4).map((l) => {
        const other = nodeById.get(outs.length > 0 ? l.target : l.source);
        const sharePct = Math.round((l.value / node.value) * 100);
        return {
          label: `${outs.length > 0 ? "→ " : "← "}${other?.label ?? ""}`,
          share: `${sharePct}%`,
        };
      });

      const announcement = `${node.label}: ${formatValue(node.value)}${unitSuffix}, ${pct}% of ${totalLabel}.${
        outs.length > 0
          ? ` Flows to ${outs
              .map(
                (l) =>
                  `${nodeById.get(l.target)?.label ?? l.target} (${Math.round((l.value / node.value) * 100)}%)`,
              )
              .join(", ")}.`
          : ""
      }`;

      return {
        title: node.label,
        value: `${formatValue(node.value)}${unitSuffix}`,
        note: `${pct}% of ${totalLabel}`,
        rows,
        announcement,
      };
    }

    const link = layout.links.find((l) => l.key === focus.key);
    if (!link) return null;
    const src = nodeById.get(link.source);
    const tgt = nodeById.get(link.target);
    const pctTotal = Math.round((link.value / total) * 100);
    const pctSrc = src && src.value > 0 ? Math.round((link.value / src.value) * 100) : 0;

    return {
      title: `${src?.label ?? link.source} → ${tgt?.label ?? link.target}`,
      value: `${formatValue(link.value)}${unitSuffix}`,
      note: `${pctTotal}% of ${totalLabel}`,
      rows: [
        {
          label: `Share of ${src?.label ?? link.source}`,
          share: `${pctSrc}%`,
        },
      ],
      announcement: `${src?.label ?? link.source} to ${tgt?.label ?? link.target}: ${formatValue(link.value)}${unitSuffix}, ${pctSrc}% of ${src?.label ?? link.source}.`,
    };
  }, [focus, layout.firstColumnTotal, layout.links, nodeById, unit, totalLabel, formatValue]);

  const clampedTipStyle = useMemo(() => {
    if (!tipPos) return undefined;
    const tipW = 200;
    const tipH = 110;
    const left = Math.max(8, Math.min(width - tipW - 8, tipPos.x + 14));
    const top = Math.max(8, Math.min(plotHeight - tipH - 8, tipPos.y - 24));
    return { transform: `translate3d(${left}px, ${top}px, 0)` };
  }, [tipPos, width, plotHeight]);

  const isEmpty = layout.links.length === 0;
  const springTransition = reducedMotion
    ? { duration: 0 }
    : motionTokens.spring.gentle;

  return (
    <figure
      className={className ? `${styles.figure} ${className}` : styles.figure}
    >
      {columns && columns.length > 0 && !upright && !isEmpty && (
        <div className={styles.stages} aria-hidden="true">
          {columns.slice(0, layout.columnCount).map((colName, idx) => {
            const x = layout.columnPositions[idx] ?? 0;
            return (
              <span
                key={colName}
                className={styles.stage}
                style={{ left: `${x}px` }}
              >
                {colName}
              </span>
            );
          })}
        </div>
      )}

      <div
        ref={chartRef}
        className={styles.chart}
        data-focus={focus ? "" : undefined}
        data-glow={trace.glowSlot !== undefined ? String(trace.glowSlot) : undefined}
      >
        <span ref={inksRef} className={styles.inks} aria-hidden="true" />

        <div
          className={styles.plot}
          role="group"
          aria-label={label}
          tabIndex={isEmpty ? -1 : 0}
          onFocus={() => {
            if (!focus && layout.nodes.length > 0) {
              const first = layout.nodes[0];
              setFocus({ kind: "node", id: first.id });
              setTipPos({ x: first.x + first.w / 2, y: first.y + first.h / 2 });
            }
          }}
          onBlur={() => {
            setFocus(null);
            setTipPos(null);
          }}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => {
            setFocus(null);
            setTipPos(null);
          }}
          style={{ height: `${plotHeight}px` }}
        >
          {isEmpty ? (
            <p className={styles.message}>{emptyLabel}</p>
          ) : (
            <>
              <svg
                className={styles.svg}
                width={width}
                height={plotHeight}
                viewBox={`0 0 ${width} ${plotHeight}`}
                aria-hidden="true"
              >
                {/* Base ribbons */}
                <g>
                  {layout.links.map((l) => {
                    const d = l.upright
                      ? ribbonPathUpright(l.sx, l.sy0, l.sy1, l.tx, l.ty0, l.ty1)
                      : ribbonPathHorizontal(l.sx, l.sy0, l.sy1, l.tx, l.ty0, l.ty1);
                    return (
                      <motion.path
                        key={l.key}
                        className={styles.band}
                        data-slot={l.slot !== undefined ? String(l.slot) : undefined}
                        d={d}
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ d, opacity: 1 }}
                        transition={springTransition}
                        onMouseEnter={(e) => {
                          const rect = chartRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTipPos({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top,
                            });
                          }
                          setFocus({ kind: "link", key: l.key });
                        }}
                        onMouseMove={(e) => {
                          const rect = chartRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTipPos({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top,
                            });
                          }
                        }}
                      />
                    );
                  })}
                </g>

                {/* Traced flow glow overlay */}
                <g className={styles.glows}>
                  {layout.links.map((l) => {
                    const share = trace.linkShare.get(l.key) ?? 0;
                    if (share <= 0) return null;
                    const sy1 = l.sy0 + (l.sy1 - l.sy0) * share;
                    const ty1 = l.ty0 + (l.ty1 - l.ty0) * share;
                    const d = l.upright
                      ? ribbonPathUpright(l.sx, l.sy0, sy1, l.tx, l.ty0, ty1)
                      : ribbonPathHorizontal(l.sx, l.sy0, sy1, l.tx, l.ty0, ty1);
                    return (
                      <motion.path
                        key={`glow-${l.key}`}
                        className={styles.glow}
                        d={d}
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ d, opacity: 1 }}
                        transition={
                          reducedMotion ? { duration: 0 } : { duration: 0.18 }
                        }
                      />
                    );
                  })}
                </g>

                {/* Nodes */}
                <g>
                  {layout.nodes.map((n) => (
                    <motion.rect
                      key={n.id}
                      className={styles.node}
                      data-slot={n.slot !== undefined ? String(n.slot) : undefined}
                      rx={3}
                      ry={3}
                      x={n.x}
                      y={n.y}
                      width={n.w}
                      height={n.h}
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ x: n.x, y: n.y, width: n.w, height: n.h, opacity: 1 }}
                      transition={springTransition}
                      onMouseEnter={(e) => {
                        const rect = chartRef.current?.getBoundingClientRect();
                        if (rect) {
                          setTipPos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                        setFocus({ kind: "node", id: n.id });
                      }}
                      onMouseMove={(e) => {
                        const rect = chartRef.current?.getBoundingClientRect();
                        if (rect) {
                          setTipPos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                      }}
                    />
                  ))}
                </g>

                {/* Traced node glow overlay */}
                <g className={styles.glows}>
                  {layout.nodes.map((n) => {
                    const share = trace.nodeShare.get(n.id) ?? 0;
                    if (share <= 0) return null;
                    const gw = upright ? n.w * share : n.w;
                    const gh = upright ? n.h : n.h * share;
                    return (
                      <motion.rect
                        key={`nglow-${n.id}`}
                        className={styles.nodeGlow}
                        rx={3}
                        ry={3}
                        x={n.x}
                        y={n.y}
                        width={gw}
                        height={gh}
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ width: gw, height: gh, opacity: 1 }}
                        transition={
                          reducedMotion ? { duration: 0 } : { duration: 0.18 }
                        }
                      />
                    );
                  })}
                </g>
              </svg>

              {/* Drifting particles canvas */}
              <canvas
                ref={canvasRef}
                className={styles.canvas}
                aria-hidden="true"
              />

              {/* Node labels */}
              <div className={styles.labels} aria-hidden="true">
                {layout.nodes.map((n) => {
                  const span = upright ? n.w : n.h;
                  const sizeAttr =
                    span < 16 ? "none" : span < 36 ? "short" : undefined;
                  const lit = (trace.nodeShare.get(n.id) ?? 0) > 0;
                  const left = upright ? n.x : n.x + n.w + 8;
                  const top = upright
                    ? n.y + n.h + 4
                    : n.y + Math.max(0, (n.h - (sizeAttr === "short" ? 16 : 32)) / 2);

                  return (
                    <div
                      key={`lbl-${n.id}`}
                      className={styles.nodeLabel}
                      data-size={sizeAttr}
                      data-lit={lit ? "" : undefined}
                      style={{
                        transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`,
                      }}
                    >
                      <span className={styles.nodeName}>{n.label}</span>
                      <span className={styles.nodeValue}>
                        {formatValue(n.value)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Floating tooltip */}
              <div
                className={styles.tooltip}
                data-on={tooltipData ? "" : undefined}
                style={clampedTipStyle}
                aria-hidden="true"
              >
                {tooltipData && (
                  <>
                    <p className={styles.tipTitle}>{tooltipData.title}</p>
                    <p className={styles.tipValue}>{tooltipData.value}</p>
                    <p className={styles.tipNote}>{tooltipData.note}</p>
                    {tooltipData.rows.map((r) => (
                      <p key={r.label} className={styles.tipRow}>
                        <span>{r.label}</span>
                        <span className={styles.tipShare}>{r.share}</span>
                      </p>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Flow particle toggle (hidden under reduced motion or particleToggle={false}) */}
      {particleToggle && !reducedMotion && !isEmpty && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.flowToggle}
            aria-pressed={particlesOn}
            onClick={toggleParticles}
          >
            <span className={styles.flowIcon} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>Flow</span>
          </button>
        </div>
      )}

      {/* Polite live announcement for focused node/ribbon */}
      <div className={styles.srOnly} role="status" aria-live="polite">
        {tooltipData?.announcement ?? ""}
      </div>

      {/* Accessible complete data table */}
      {!isEmpty && (
        <table className={styles.srOnly}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col">Value</th>
              <th scope="col">Share of source</th>
            </tr>
          </thead>
          <tbody>
            {layout.links.map((l) => {
              const src = nodeById.get(l.source);
              const tgt = nodeById.get(l.target);
              const share =
                src && src.value > 0
                  ? Math.round((l.value / src.value) * 100)
                  : 0;
              return (
                <tr key={`row-${l.key}`}>
                  <td>{src?.label ?? l.source}</td>
                  <td>{tgt?.label ?? l.target}</td>
                  <td>
                    {formatValue(l.value)}
                    {unit ? ` ${unit}` : ""}
                  </td>
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

export default SankeyFlow;
