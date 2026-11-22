"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../motion-tokens";
import styles from "./reasoning-tree.module.css";

export interface ReasoningThought {
  id?: string;
  label: string;
  text?: string;
  score?: number;
  children?: ReasoningThought[];
}

export interface ReasoningModel {
  name: string;
  mark?: ReactNode;
}

export interface ResolvedThought {
  id: string;
  label: string;
  text: string;
  score: number;
  depth: number;
  parentId: string;
  siblingIndex: number;
  siblingCount: number;
  children: ResolvedThought[];
}

export interface ReasoningAnswerResult {
  answer: ResolvedThought;
  path: ResolvedThought[];
  beamWidth: number;
}

export interface ReasoningTreeProps {
  question?: string;
  questionDetail?: string;
  thoughts?: ReasoningThought[];
  beamWidth?: number;
  defaultBeamWidth?: number;
  onBeamWidthChange?: (beamWidth: number) => void;
  seed?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  controls?: boolean;
  model?: ReasoningModel | null;
  title?: string;
  accent?: string;
  onAnswer?: (result: ReasoningAnswerResult) => void;
  className?: string;
  style?: CSSProperties;
}

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.95 16.01L12.76 12.9l5.15-.63a.72.72 0 0 0-.09-1.43l-5.15.63 4.02-3.3a.72.72 0 0 0-.91-1.11l-4.02 3.3 1.77-4.88a.72.72 0 1 0-1.35-.49l-1.77 4.88-.63-5.15a.72.72 0 0 0-1.43.09l.63 5.15-3.3-4.02a.72.72 0 1 0-1.11.91l3.3 4.02-4.88-1.77a.72.72 0 1 0-.49 1.35l4.88 1.77-5.15.63a.72.72 0 0 0 .09 1.43l5.15-.63-4.02 3.3a.72.72 0 0 0 .91 1.11l4.02-3.3-1.77 4.88a.72.72 0 1 0 1.35.49l1.77-4.88.63 5.15a.72.72 0 0 0 1.43-.09l-.63-5.15 3.3 4.02a.72.72 0 1 0 1.11-.91l-3.3-4.02 4.88 1.77a.72.72 0 1 0 .49-1.35Z"
        fill="#D97757"
      />
    </svg>
  );
}

const DEFAULT_MODEL: ReasoningModel = {
  name: "Claude Opus 5.5",
  mark: <ClaudeMark />,
};

const DEFAULT_QUESTION = "Which release plan ships by Friday?";

const DEFAULT_THOUGHTS: ReasoningThought[] = [
  {
    id: "cut-scope",
    label: "Cut scope to core",
    text: "Ship only the core checkout flow and move secondary settings to next week.",
    score: 0.82,
    children: [
      {
        id: "freeze-wed",
        label: "Freeze Wednesday",
        text: "Lock main on Wednesday evening and dedicate Thursday to regression fixes.",
        score: 0.86,
        children: [
          {
            id: "ship-core-fri",
            label: "Ship core Friday",
            text: "Deploy the trimmed build Friday morning with a single rollback toggle.",
            score: 0.91,
          },
          {
            id: "delay-mon",
            label: "Hold until Monday",
            text: "Avoid a Friday deploy window and ship first thing Monday morning.",
            score: 0.48,
          },
        ],
      },
      {
        id: "skip-qa",
        label: "Skip manual QA",
        text: "Rely only on automated checks to save a day before Friday.",
        score: 0.31,
      },
    ],
  },
  {
    id: "add-eng",
    label: "Add two engineers",
    text: "Pull two engineers off onboarding work to finish every open ticket.",
    score: 0.38,
    children: [
      {
        id: "pair-checkout",
        label: "Pair on checkout",
        text: "Pair-program the remaining edge cases across Thursday.",
        score: 0.52,
      },
      {
        id: "split-qa",
        label: "Split QA load",
        text: "Divide manual verification across the expanded team.",
        score: 0.44,
      },
    ],
  },
  {
    id: "flag-risky",
    label: "Flag risky features",
    text: "Keep full branch history intact and hide unfinished surfaces behind flags.",
    score: 0.74,
    children: [
      {
        id: "flags-off",
        label: "Flags off in prod",
        text: "Merge everything dark so code ships without exposing unfinished paths.",
        score: 0.66,
        children: [
          {
            id: "dark-launch",
            label: "Dark launch Friday",
            text: "Ship code dark on Friday and enable for staff over the weekend.",
            score: 0.72,
          },
        ],
      },
      {
        id: "stage-rollout",
        label: "Stage the rollout",
        text: "Gate risky features behind a staged percentage rollout with automatic rollback.",
        score: 0.79,
        children: [
          {
            id: "gradual-fri",
            label: "10% Fri, 100% Tue",
            text: "Release to 10% of traffic Friday with telemetry gates, then ramp to 100% Tuesday.",
            score: 0.94,
          },
          {
            id: "wait-telemetry",
            label: "Staff beta only",
            text: "Restrict Friday access to internal accounts until Monday metrics settle.",
            score: 0.71,
          },
        ],
      },
    ],
  },
];

function seededScore(seed: number, key: string): number {
  let h = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const norm = (h % 72) / 100;
  return Number((0.22 + norm).toFixed(2));
}

function clampScore(v: number): number {
  return Math.max(0.01, Math.min(0.99, Number(v.toFixed(2))));
}

function normalizeTree(
  thoughts: ReasoningThought[],
  seed: number,
  depth = 1,
  parentId = "root",
): ResolvedThought[] {
  if (depth > 3) return [];
  return thoughts.map((t, idx) => {
    const id = t.id ?? `${parentId}-d${depth}-${idx}`;
    const score = clampScore(
      typeof t.score === "number" ? t.score : seededScore(seed, `${id}:${t.label}`),
    );
    const children =
      depth < 3 && t.children && t.children.length > 0
        ? normalizeTree(t.children, seed, depth + 1, id)
        : [];
    return {
      id,
      label: t.label,
      text: t.text ?? t.label,
      score,
      depth,
      parentId,
      siblingIndex: idx,
      siblingCount: thoughts.length,
      children,
    };
  });
}

type NodeStatus = "pending" | "scored" | "kept" | "pruned" | "answer";

interface PhaseStep {
  id: string;
  depth: number;
  kind: "propose" | "score" | "prune" | "final";
  label: string;
  durationMs: number;
}

interface SearchPlan {
  allNodes: ResolvedThought[];
  byId: Map<string, ResolvedThought>;
  maxDepth: number;
  proposedByDepth: Map<number, ResolvedThought[]>;
  keptByDepth: Map<number, Set<string>>;
  prunedByDepth: Map<number, Set<string>>;
  answer: ResolvedThought | null;
  answerPathIds: Set<string>;
  answerPath: ResolvedThought[];
  phases: PhaseStep[];
}

function buildSearchPlan(roots: ResolvedThought[], beamWidth: number): SearchPlan {
  const width = Math.max(1, Math.min(3, Math.round(beamWidth)));
  const byId = new Map<string, ResolvedThought>();
  const allNodes: ResolvedThought[] = [];
  const proposedByDepth = new Map<number, ResolvedThought[]>();
  const keptByDepth = new Map<number, Set<string>>();
  const prunedByDepth = new Map<number, Set<string>>();

  let frontier = roots;
  let maxDepth = 0;

  for (let depth = 1; depth <= 3; depth += 1) {
    if (frontier.length === 0) break;
    maxDepth = depth;
    proposedByDepth.set(depth, frontier);
    for (const n of frontier) {
      allNodes.push(n);
      byId.set(n.id, n);
    }

    const sorted = [...frontier].sort((a, b) => b.score - a.score);
    const hasDeeper = depth < 3 && frontier.some((n) => n.children.length > 0);
    const keepCount = hasDeeper ? Math.min(width, sorted.length) : 1;
    const keptSet = new Set(sorted.slice(0, keepCount).map((n) => n.id));
    const prunedSet = new Set(sorted.slice(keepCount).map((n) => n.id));
    keptByDepth.set(depth, keptSet);
    prunedByDepth.set(depth, prunedSet);

    if (!hasDeeper) {
      frontier = [];
    } else {
      const nextFrontier: ResolvedThought[] = [];
      for (const n of frontier) {
        if (keptSet.has(n.id)) {
          nextFrontier.push(...n.children);
        }
      }
      frontier = nextFrontier;
    }
  }

  let answer: ResolvedThought | null = null;
  if (maxDepth > 0) {
    const lastKept = keptByDepth.get(maxDepth);
    const lastProposed = proposedByDepth.get(maxDepth) ?? [];
    answer =
      lastProposed.find((n) => lastKept?.has(n.id)) ??
      [...lastProposed].sort((a, b) => b.score - a.score)[0] ??
      null;
  }

  const answerPath: ResolvedThought[] = [];
  const answerPathIds = new Set<string>();
  if (answer) {
    let cur: ResolvedThought | undefined = answer;
    while (cur) {
      answerPath.unshift(cur);
      answerPathIds.add(cur.id);
      cur = cur.parentId !== "root" ? byId.get(cur.parentId) : undefined;
    }
  }

  const phases: PhaseStep[] = [];
  for (let d = 1; d <= maxDepth; d += 1) {
    const count = (proposedByDepth.get(d) ?? []).length;
    const keptCount = (keptByDepth.get(d) ?? new Set()).size;
    phases.push({
      id: `propose-${d}`,
      depth: d,
      kind: "propose",
      label: d === 1 ? `Proposing ${count} thoughts` : `Expanding depth ${d}`,
      durationMs: 650,
    });
    phases.push({
      id: `score-${d}`,
      depth: d,
      kind: "score",
      label: `Scoring depth ${d}`,
      durationMs: 920,
    });
    if (d < maxDepth) {
      phases.push({
        id: `prune-${d}`,
        depth: d,
        kind: "prune",
        label: keptCount === 1 ? "Keeping the best 1" : `Keeping the best ${keptCount}`,
        durationMs: 760,
      });
    }
  }

  if (answer) {
    phases.push({
      id: "final",
      depth: maxDepth,
      kind: "final",
      label: "Best path found",
      durationMs: 1100,
    });
  }

  return {
    allNodes,
    byId,
    maxDepth,
    proposedByDepth,
    keptByDepth,
    prunedByDepth,
    answer,
    answerPathIds,
    answerPath,
    phases,
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutResult {
  mode: "wide" | "narrow";
  height: number;
  columns: { depth: number; x: number; w: number; label: string }[];
  boxes: Map<string, Box>;
  edges: { id: string; fromId: string; toId: string; d: string; depth: number; idx: number }[];
  winningPathD: string;
}

function computeLayout(
  plan: SearchPlan,
  stageWidth: number,
  phaseIndex: number,
): LayoutResult {
  const narrow = stageWidth < 670;
  const boxes = new Map<string, Box>();
  const edges: LayoutResult["edges"] = [];
  const columns: LayoutResult["columns"] = [];

  const currentPhase = plan.phases[phaseIndex] ?? null;

  const isVisibleAtPhase = (node: ResolvedThought): boolean => {
    if (!currentPhase) return false;
    if (currentPhase.kind === "final") return true;
    return node.depth <= currentPhase.depth;
  };

  if (!narrow) {
    const colCount = Math.max(2, plan.maxDepth + 1);
    const colGap = 28;
    const colW = Math.max(120, (stageWidth - colGap * (colCount - 1)) / colCount);
    const headerOffset = 30;
    const nodeH = 54;
    const rowGap = 10;

    for (let d = 0; d < colCount; d += 1) {
      columns.push({
        depth: d,
        x: d * (colW + colGap),
        w: colW,
        label: d === 0 ? "Question" : `Depth ${d}`,
      });
    }

    let maxRows = 1;
    for (let d = 1; d <= plan.maxDepth; d += 1) {
      const count = (plan.proposedByDepth.get(d) ?? []).length;
      if (count > maxRows) maxRows = count;
    }

    const totalTreeH = maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap;
    const stageH = Math.max(320, headerOffset + totalTreeH + 18);

    // Root box centered vertically
    const rootH = 74;
    boxes.set("root", {
      x: 0,
      y: headerOffset + (totalTreeH - rootH) / 2,
      w: colW,
      h: rootH,
    });

    for (let d = 1; d <= plan.maxDepth; d += 1) {
      const list = plan.proposedByDepth.get(d) ?? [];
      const colTotalH = list.length * nodeH + Math.max(0, list.length - 1) * rowGap;
      const startY = headerOffset + (totalTreeH - colTotalH) / 2;
      const x = d * (colW + colGap);
      list.forEach((node, idx) => {
        boxes.set(node.id, {
          x,
          y: startY + idx * (nodeH + rowGap),
          w: colW,
          h: nodeH,
        });
      });
    }

    for (const node of plan.allNodes) {
      const from = boxes.get(node.parentId);
      const to = boxes.get(node.id);
      if (!from || !to) continue;
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const mx = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      edges.push({
        id: `${node.parentId}->${node.id}`,
        fromId: node.parentId,
        toId: node.id,
        d,
        depth: node.depth,
        idx: node.siblingIndex,
      });
    }

    let winningPathD = "";
    if (plan.answerPath.length > 0) {
      const segs: string[] = [];
      let prevId = "root";
      for (const n of plan.answerPath) {
        const from = boxes.get(prevId);
        const to = boxes.get(n.id);
        if (from && to) {
          const x1 = from.x + from.w;
          const y1 = from.y + from.h / 2;
          const x2 = to.x;
          const y2 = to.y + to.h / 2;
          const mx = (x1 + x2) / 2;
          segs.push(`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
        }
        prevId = n.id;
      }
      winningPathD = segs.join(" ");
    }

    return {
      mode: "wide",
      height: stageH,
      columns,
      boxes,
      edges,
      winningPathD,
    };
  }

  // Narrow outline layout
  const indent = 18;
  const rowH = 44;
  const rowGap = 8;
  const rootH = 60;
  let y = 0;

  boxes.set("root", { x: 0, y, w: stageWidth, h: rootH });
  y += rootH + rowGap;

  // Depth-first order
  const ordered: ResolvedThought[] = [];
  const visit = (list: ResolvedThought[]) => {
    for (const n of list) {
      if (!plan.byId.has(n.id)) continue;
      ordered.push(n);
      if (n.children.length > 0) visit(n.children);
    }
  };
  visit(plan.proposedByDepth.get(1) ?? []);

  let visibleY = y;
  for (const node of ordered) {
    const x = node.depth * indent;
    const w = Math.max(140, stageWidth - x);
    const visible = isVisibleAtPhase(node);
    if (visible) {
      boxes.set(node.id, { x, y: visibleY, w, h: rowH });
      visibleY += rowH + rowGap;
    } else {
      boxes.set(node.id, { x, y: visibleY, w, h: rowH });
    }
  }

  for (const node of ordered) {
    const from = boxes.get(node.parentId);
    const to = boxes.get(node.id);
    if (!from || !to) continue;
    const elbowX = from.x + 8;
    const startY = from.y + from.h;
    const endY = to.y + to.h / 2;
    const r = 6;
    const d = `M ${elbowX} ${startY} L ${elbowX} ${Math.max(startY, endY - r)} Q ${elbowX} ${endY} ${elbowX + r} ${endY} L ${to.x} ${endY}`;
    edges.push({
      id: `${node.parentId}->${node.id}`,
      fromId: node.parentId,
      toId: node.id,
      d,
      depth: node.depth,
      idx: node.siblingIndex,
    });
  }

  let winningPathD = "";
  if (plan.answerPath.length > 0) {
    const segs: string[] = [];
    let prevId = "root";
    for (const n of plan.answerPath) {
      const from = boxes.get(prevId);
      const to = boxes.get(n.id);
      if (from && to) {
        const elbowX = from.x + 8;
        const startY = from.y + from.h;
        const endY = to.y + to.h / 2;
        const r = 6;
        segs.push(
          `M ${elbowX} ${startY} L ${elbowX} ${Math.max(startY, endY - r)} Q ${elbowX} ${endY} ${elbowX + r} ${endY} L ${to.x} ${endY}`,
        );
      }
      prevId = n.id;
    }
    winningPathD = segs.join(" ");
  }

  return {
    mode: "narrow",
    height: Math.max(220, visibleY + 12),
    columns: [],
    boxes,
    edges,
    winningPathD,
  };
}

export function ReasoningTree({
  question = DEFAULT_QUESTION,
  questionDetail,
  thoughts = DEFAULT_THOUGHTS,
  beamWidth: controlledBeamWidth,
  defaultBeamWidth = 2,
  onBeamWidthChange,
  seed = 7,
  autoPlay = true,
  loop = false,
  speed = 1,
  controls = true,
  model = DEFAULT_MODEL,
  title = "Tree of thoughts",
  accent = "var(--series-1)",
  onAnswer,
  className,
  style,
}: ReasoningTreeProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.25 });
  const headingId = useId();

  const [internalBeam, setInternalBeam] = useState(
    Math.max(1, Math.min(3, defaultBeamWidth)),
  );
  const beamWidth =
    controlledBeamWidth !== undefined
      ? Math.max(1, Math.min(3, controlledBeamWidth))
      : internalBeam;

  const resolvedRoots = useMemo(
    () => normalizeTree(thoughts, seed),
    [thoughts, seed],
  );
  const plan = useMemo(
    () => buildSearchPlan(resolvedRoots, beamWidth),
    [resolvedRoots, beamWidth],
  );

  const lastPhaseIndex = Math.max(0, plan.phases.length - 1);
  const [phaseIndex, setPhaseIndex] = useState<number>(() =>
    reduced ? lastPhaseIndex : -1,
  );
  const [playing, setPlaying] = useState(false);
  const [stageWidth, setStageWidth] = useState(720);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rovingId, setRovingId] = useState<string>("root");
  const [announcement, setAnnouncement] = useState("");
  const autoStartedRef = useRef(false);
  const announcedAnswerRef = useRef<string | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const effectivePhaseIndex = reduced && !playing && phaseIndex < 0 ? lastPhaseIndex : phaseIndex;
  const currentPhase = effectivePhaseIndex >= 0 ? plan.phases[effectivePhaseIndex] : null;
  const isFinal = currentPhase?.kind === "final";

  // Measure stage width
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setStageWidth(w);
        setReady(true);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Autoplay when first in view
  useEffect(() => {
    if (!inView || !autoPlay || reduced || autoStartedRef.current || speed <= 0) return;
    autoStartedRef.current = true;
    const t = window.setTimeout(() => {
      setPhaseIndex(0);
      setPlaying(true);
    }, 180);
    return () => window.clearTimeout(t);
  }, [inView, autoPlay, reduced, speed]);

  // Playback timer
  useEffect(() => {
    if (!playing || speed <= 0) return;
    if (effectivePhaseIndex >= lastPhaseIndex) {
      const stopTimer = window.setTimeout(() => {
        setPlaying(false);
      }, 0);
      return () => window.clearTimeout(stopTimer);
    }
    const baseMs = currentPhase ? currentPhase.durationMs : 350;
    const waitMs = Math.max(80, Math.round(baseMs / speed));
    const timer = window.setTimeout(() => {
      setPhaseIndex((idx) => Math.min(lastPhaseIndex, idx + 1));
    }, waitMs);
    return () => window.clearTimeout(timer);
  }, [playing, speed, effectivePhaseIndex, lastPhaseIndex, currentPhase]);

  // Loop restart after completion
  useEffect(() => {
    if (!loop || reduced || playing || !isFinal || !inView || speed <= 0) return;
    const timer = window.setTimeout(() => {
      announcedAnswerRef.current = null;
      setPhaseIndex(0);
      setPlaying(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [loop, reduced, playing, isFinal, inView, speed]);

  // Notify onAnswer once per completion
  useEffect(() => {
    if (!isFinal || !plan.answer) return;
    const key = `${beamWidth}:${plan.answer.id}`;
    if (announcedAnswerRef.current === key) return;
    announcedAnswerRef.current = key;
    onAnswer?.({
      answer: plan.answer,
      path: plan.answerPath,
      beamWidth,
    });
  }, [isFinal, plan.answer, plan.answerPath, beamWidth, onAnswer]);

  const handleBeamChange = useCallback(
    (nextStr: string) => {
      const next = Number(nextStr);
      if (controlledBeamWidth === undefined) setInternalBeam(next);
      onBeamWidthChange?.(next);
      announcedAnswerRef.current = null;
      if (reduced) {
        setPhaseIndex(-1);
        setPlaying(false);
      } else {
        setPhaseIndex(0);
        setPlaying(true);
      }
      setAnnouncement(`Beam width set to ${next}. Restarting search.`);
    },
    [controlledBeamWidth, onBeamWidthChange, reduced],
  );

  const handlePlayPause = useCallback(() => {
    if (playing) {
      setPlaying(false);
      setAnnouncement(currentPhase ? `Paused at ${currentPhase.label}.` : "Paused.");
      return;
    }
    if (effectivePhaseIndex >= lastPhaseIndex) {
      announcedAnswerRef.current = null;
      setPhaseIndex(0);
    } else if (effectivePhaseIndex < 0) {
      setPhaseIndex(0);
    }
    setPlaying(true);
  }, [playing, currentPhase, effectivePhaseIndex, lastPhaseIndex]);

  const handleStep = useCallback(() => {
    setPlaying(false);
    const nextIdx =
      effectivePhaseIndex < lastPhaseIndex ? effectivePhaseIndex + 1 : 0;
    if (nextIdx === 0) announcedAnswerRef.current = null;
    setPhaseIndex(nextIdx);
    const nextPhase = plan.phases[nextIdx];
    if (nextPhase) {
      if (nextPhase.kind === "final" && plan.answer) {
        setAnnouncement(
          `Answer found: ${plan.answer.text} (score ${plan.answer.score.toFixed(2)}).`,
        );
      } else {
        setAnnouncement(nextPhase.label);
      }
    }
  }, [effectivePhaseIndex, lastPhaseIndex, plan.phases, plan.answer]);

  const handleRestart = useCallback(() => {
    announcedAnswerRef.current = null;
    setPhaseIndex(0);
    setPlaying(!reduced && speed > 0);
    setAnnouncement("Search restarted.");
  }, [reduced, speed]);

  const layout = useMemo(
    () => computeLayout(plan, stageWidth, effectivePhaseIndex),
    [plan, stageWidth, effectivePhaseIndex],
  );

  const getNodeState = useCallback(
    (node: ResolvedThought): { shown: boolean; scored: boolean; status: NodeStatus; onPath: boolean } => {
      if (!currentPhase) {
        return { shown: false, scored: false, status: "pending", onPath: false };
      }
      if (currentPhase.kind === "final") {
        const isAnswer = plan.answer?.id === node.id;
        const onPath = plan.answerPathIds.has(node.id);
        const kept = plan.keptByDepth.get(node.depth)?.has(node.id) ?? false;
        return {
          shown: true,
          scored: true,
          status: isAnswer ? "answer" : kept ? "kept" : "pruned",
          onPath,
        };
      }

      if (node.depth > currentPhase.depth) {
        return { shown: false, scored: false, status: "pending", onPath: false };
      }
      if (node.depth < currentPhase.depth) {
        const kept = plan.keptByDepth.get(node.depth)?.has(node.id) ?? false;
        return {
          shown: true,
          scored: true,
          status: kept ? "kept" : "pruned",
          onPath: false,
        };
      }
      // node.depth === currentPhase.depth
      if (currentPhase.kind === "propose") {
        return { shown: true, scored: false, status: "pending", onPath: false };
      }
      if (currentPhase.kind === "score") {
        return { shown: true, scored: true, status: "scored", onPath: false };
      }
      // prune
      const kept = plan.keptByDepth.get(node.depth)?.has(node.id) ?? false;
      return {
        shown: true,
        scored: true,
        status: kept ? "kept" : "pruned",
        onPath: false,
      };
    },
    [currentPhase, plan],
  );

  const focusNode = useCallback((id: string) => {
    setRovingId(id);
    setActiveId(id);
    nodeRefs.current.get(id)?.focus();
  }, []);

  const handleTreeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, nodeId: string) => {
      if (event.key === "Home") {
        event.preventDefault();
        focusNode("root");
        return;
      }
      if (event.key === "End" && isFinal && plan.answer) {
        event.preventDefault();
        focusNode(plan.answer.id);
        return;
      }

      if (nodeId === "root") {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          const first = (plan.proposedByDepth.get(1) ?? []).find(
            (n) => getNodeState(n).shown,
          );
          if (first) {
            event.preventDefault();
            focusNode(first.id);
          }
        }
        return;
      }

      const node = plan.byId.get(nodeId);
      if (!node) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusNode(node.parentId);
        return;
      }

      if (event.key === "ArrowRight") {
        const shownChildren = node.children.filter((c) => getNodeState(c).shown);
        if (shownChildren.length > 0) {
          const best = [...shownChildren].sort((a, b) => b.score - a.score)[0];
          event.preventDefault();
          focusNode(best.id);
        }
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        if (layout.mode === "wide") {
          const list = (plan.proposedByDepth.get(node.depth) ?? []).filter(
            (n) => getNodeState(n).shown,
          );
          const idx = list.findIndex((n) => n.id === nodeId);
          const next = list[idx + delta];
          if (next) focusNode(next.id);
        } else {
          const visibleIds = ["root", ...plan.allNodes.filter((n) => getNodeState(n).shown).map((n) => n.id)];
          const idx = visibleIds.indexOf(nodeId);
          const next = visibleIds[idx + delta];
          if (next) focusNode(next);
        }
      }
    },
    [focusNode, getNodeState, isFinal, layout.mode, plan],
  );

  const statusText = useMemo(() => {
    if (!currentPhase) return "Ready";
    return currentPhase.label;
  }, [currentPhase]);

  const rootStyle = useMemo(
    () =>
      ({
        "--rt-accent": accent,
        "--rt-path-steps": Math.max(1, plan.answerPath.length),
        ...style,
      }) as CSSProperties,
    [accent, plan.answerPath.length, style],
  );

  const rootBox = layout.boxes.get("root");

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-ready={ready ? "" : undefined}
      data-mode={layout.mode}
      data-final={isFinal ? "" : undefined}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.title} id={headingId}>
            {model && (
              <>
                {model.mark && <span className={styles.mark}>{model.mark}</span>}
                <span className={styles.modelName}>{model.name}</span>
              </>
            )}
            <span className={styles.method}>{title}</span>
          </div>

          <div className={styles.status}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={statusText + (playing ? "-play" : "-stop")}
                className={styles.statusItem}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.16, ease: motionTokens.ease.standard }}
              >
                {isFinal ? (
                  <Check size={14} className={styles.statusDone} aria-hidden="true" />
                ) : !playing && effectivePhaseIndex >= 0 ? (
                  <Pause size={13} className={styles.statusIcon} aria-hidden="true" />
                ) : null}
                <span
                  className={styles.statusText}
                  data-active={playing && !isFinal ? "" : undefined}
                >
                  {statusText}
                </span>
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div
          ref={stageRef}
          className={styles.stage}
          style={ready ? { height: layout.height } : undefined}
        >
          {/* Wide column headers */}
          {layout.mode === "wide" &&
            layout.columns.map((col) => {
              const active =
                currentPhase !== null &&
                (currentPhase.kind === "final" || currentPhase.depth === col.depth);
              const keptCount =
                col.depth > 0 ? (plan.keptByDepth.get(col.depth)?.size ?? 0) : 0;
              const prunedOrLater =
                currentPhase !== null &&
                (currentPhase.kind === "final" ||
                  currentPhase.depth > col.depth ||
                  (currentPhase.depth === col.depth && currentPhase.kind === "prune"));
              return (
                <div
                  key={col.depth}
                  className={styles.column}
                  style={{ left: col.x, width: col.w }}
                  data-active={active ? "" : undefined}
                >
                  <span className={styles.columnName}>{col.label}</span>
                  {col.depth > 0 && (
                    <span
                      className={styles.columnCount}
                      data-on={prunedOrLater ? "" : undefined}
                    >
                      {col.depth === plan.maxDepth ? "1 answer" : `${keptCount} kept`}
                    </span>
                  )}
                </div>
              );
            })}

          {/* Edges SVG */}
          <svg
            className={styles.edges}
            width="100%"
            height={layout.height}
            aria-hidden="true"
          >
            {layout.edges.map((edge) => {
              const target = plan.byId.get(edge.toId);
              if (!target) return null;
              const state = getNodeState(target);
              const on = state.shown && state.status !== "pruned";
              return (
                <path
                  key={edge.id}
                  d={edge.d}
                  pathLength={1}
                  className={styles.edge}
                  data-on={on ? "" : undefined}
                  style={{ "--i": edge.idx } as CSSProperties}
                />
              );
            })}

            {layout.winningPathD && (
              <>
                <path
                  key={`path-${beamWidth}-${isFinal}`}
                  d={layout.winningPathD}
                  pathLength={1}
                  className={styles.pathLine}
                />
                <path
                  key={`sheen-${beamWidth}-${isFinal}`}
                  d={layout.winningPathD}
                  pathLength={1}
                  className={styles.sheen}
                />
              </>
            )}
          </svg>

          {/* Interactive tree nodes */}
          <div
            className={styles.tree}
            role="tree"
            aria-labelledby={headingId}
          >
            {/* Root question node */}
            {rootBox && (
              <div
                ref={(el) => {
                  if (el) nodeRefs.current.set("root", el);
                  else nodeRefs.current.delete("root");
                }}
                role="treeitem"
                aria-level={1}
                aria-posinset={1}
                aria-setsize={1}
                aria-selected={activeId === "root"}
                aria-label={`Question: ${questionDetail ?? question}`}
                tabIndex={rovingId === "root" ? 0 : -1}
                className={styles.slot}
                data-depth="0"
                data-shown="true"
                data-active={activeId === "root" ? "" : undefined}
                data-path={isFinal ? "" : undefined}
                style={{
                  transform: `translate(${rootBox.x}px, ${rootBox.y}px)`,
                  width: rootBox.w,
                  height: rootBox.h,
                  "--p": 0,
                } as CSSProperties}
                onMouseEnter={() => setActiveId("root")}
                onMouseLeave={() => setActiveId((cur) => (cur === "root" ? null : cur))}
                onFocus={() => {
                  setRovingId("root");
                  setActiveId("root");
                }}
                onBlur={() => setActiveId((cur) => (cur === "root" ? null : cur))}
                onKeyDown={(e) => handleTreeKeyDown(e, "root")}
              >
                <div className={styles.node}>
                  <span className={styles.question}>{question}</span>
                </div>
                {activeId === "root" && (
                  <div className={styles.tag} data-side="bottom" data-align="start">
                    <span className={styles.tagText}>{questionDetail ?? question}</span>
                    <span className={styles.tagMeta}>Root question</span>
                  </div>
                )}
              </div>
            )}

            {/* Thought nodes */}
            {plan.allNodes.map((node) => {
              const box = layout.boxes.get(node.id);
              if (!box) return null;
              const state = getNodeState(node);
              const scoreInt = Math.round(node.score * 100);
              const fateLabel =
                state.status === "answer"
                  ? "answer"
                  : state.onPath
                    ? "on the best path"
                    : state.status === "kept"
                      ? "kept"
                      : state.status === "pruned"
                        ? "pruned"
                        : state.scored
                          ? "scored"
                          : "not scored yet";
              const pathStep = plan.answerPath.findIndex((p) => p.id === node.id) + 1;
              const align =
                layout.mode === "wide" && node.depth >= plan.maxDepth
                  ? "end"
                  : "start";
              const side = box.y > 90 ? "top" : "bottom";

              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  role="treeitem"
                  aria-level={node.depth + 1}
                  aria-posinset={node.siblingIndex + 1}
                  aria-setsize={node.siblingCount}
                  aria-selected={activeId === node.id}
                  aria-label={`${node.text}, score ${node.score.toFixed(2)}, ${fateLabel}`}
                  tabIndex={rovingId === node.id ? 0 : -1}
                  className={styles.slot}
                  data-depth={node.depth}
                  data-shown={state.shown ? "true" : "false"}
                  data-scored={state.scored ? "" : undefined}
                  data-status={state.status}
                  data-path={state.onPath ? "" : undefined}
                  data-active={activeId === node.id ? "" : undefined}
                  style={{
                    transform: `translate(${box.x}px, ${box.y}px)`,
                    width: box.w,
                    height: box.h,
                    "--i": node.siblingIndex,
                    "--s": node.score,
                    "--n": scoreInt,
                    "--p": pathStep > 0 ? pathStep : 0,
                  } as CSSProperties}
                  onMouseEnter={() => setActiveId(node.id)}
                  onMouseLeave={() => setActiveId((cur) => (cur === node.id ? null : cur))}
                  onFocus={() => {
                    setRovingId(node.id);
                    setActiveId(node.id);
                  }}
                  onBlur={() => setActiveId((cur) => (cur === node.id ? null : cur))}
                  onKeyDown={(e) => handleTreeKeyDown(e, node.id)}
                >
                  <div className={styles.node}>
                    <div className={styles.labelRow}>
                      <span className={styles.label}>{node.label}</span>
                      <Check
                        size={13}
                        strokeWidth={2.4}
                        className={styles.check}
                        aria-hidden="true"
                      />
                    </div>
                    <div className={styles.score}>
                      <div className={styles.track}>
                        <div className={styles.fill} />
                      </div>
                      <span className={styles.num} aria-hidden="true" />
                    </div>
                  </div>

                  {activeId === node.id && state.shown && (
                    <div className={styles.tag} data-side={side} data-align={align}>
                      <span className={styles.tagText}>{node.text}</span>
                      <span className={styles.tagMeta}>
                        {state.scored
                          ? `Score ${node.score.toFixed(2)} · ${fateLabel}`
                          : "Evaluating"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {controls && (
          <div className={styles.footer}>
            <div className={styles.transport}>
              <Tooltip content={playing ? "Pause" : isFinal ? "Replay" : "Play"}>
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.iconButton}
                  onClick={handlePlayPause}
                  aria-label={playing ? "Pause" : isFinal ? "Replay" : "Play"}
                >
                  <span
                    className={styles.playIcon}
                    data-playing={playing ? "" : undefined}
                  >
                    <Play size={14} aria-hidden="true" />
                    <Pause size={14} aria-hidden="true" />
                  </span>
                </Button>
              </Tooltip>

              <Tooltip content="Step forward">
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.iconButton}
                  onClick={handleStep}
                  aria-label="Step forward"
                >
                  <SkipForward size={14} aria-hidden="true" />
                </Button>
              </Tooltip>

              <Tooltip content="Restart">
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.iconButton}
                  onClick={handleRestart}
                  aria-label="Restart"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>

            <div className={styles.beam}>
              <span className={styles.beamLabel}>
                <span className={styles.beamLong}>Beam width</span>
                <span className={styles.beamShort}>Beam</span>
              </span>
              <SegmentedControl
                label="Beam width"
                value={String(beamWidth)}
                onValueChange={handleBeamChange}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
