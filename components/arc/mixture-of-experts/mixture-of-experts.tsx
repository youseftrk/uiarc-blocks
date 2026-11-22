"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CodeXml,
  Hash,
  Pause,
  Play,
  Quote,
  RotateCcw,
  Sigma,
  UserRound,
  WholeWord,
  Zap,
} from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./mixture-of-experts.module.css";

export interface MoeExpert {
  id: string;
  name: string;
  icon?: ReactNode;
}

export interface MoeToken {
  text: string;
  /** Raw affinity scores per expert id (normalized via softmax/sum). */
  scores: Record<string, number>;
}

export interface MoeRouteDecision {
  tokenIndex: number;
  token: string;
  selected: { expertId: string; weight: number; dropped: boolean }[];
}

export interface MixtureOfExpertsProps {
  experts?: MoeExpert[];
  tokens?: MoeToken[];
  topK?: 1 | 2;
  defaultTopK?: 1 | 2;
  onTopKChange?: (k: 1 | 2) => void;
  capacityFactor?: number;
  totalParamsB?: number;
  activeParamsByK?: Record<1 | 2, number>;
  speed?: number;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  loop?: boolean;
  onRoute?: (decision: MoeRouteDecision) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export const DEFAULT_MOE_EXPERTS: MoeExpert[] = [
  { id: "code", name: "Code", icon: <CodeXml /> },
  { id: "numbers", name: "Numbers", icon: <Hash /> },
  { id: "punctuation", name: "Punctuation", icon: <Quote /> },
  { id: "names", name: "Names", icon: <UserRound /> },
  { id: "grammar", name: "Grammar", icon: <WholeWord /> },
  { id: "verbs", name: "Verbs", icon: <Zap /> },
  { id: "dates", name: "Dates", icon: <CalendarDays /> },
  { id: "symbols", name: "Symbols", icon: <Sigma /> },
];

export const DEFAULT_MOE_TOKENS: MoeToken[] = [
  { text: "Maya", scores: { names: 0.44, verbs: 0.2, grammar: 0.08, punctuation: 0.06, dates: 0.07, code: 0.05, numbers: 0.05, symbols: 0.05 } },
  { text: "paid", scores: { verbs: 0.42, symbols: 0.2, dates: 0.09, names: 0.08, grammar: 0.07, numbers: 0.06, punctuation: 0.05, code: 0.03 } },
  { text: "$", scores: { symbols: 0.46, numbers: 0.22, punctuation: 0.08, code: 0.07, grammar: 0.05, verbs: 0.04, names: 0.04, dates: 0.04 } },
  { text: "1", scores: { numbers: 0.49, symbols: 0.19, dates: 0.09, punctuation: 0.06, code: 0.05, grammar: 0.04, verbs: 0.04, names: 0.04 } },
  { text: ",", scores: { punctuation: 0.45, numbers: 0.22, grammar: 0.08, symbols: 0.07, code: 0.06, verbs: 0.04, names: 0.04, dates: 0.04 } },
  { text: "240", scores: { numbers: 0.51, punctuation: 0.16, symbols: 0.09, dates: 0.08, code: 0.05, grammar: 0.04, verbs: 0.04, names: 0.03 } },
  { text: "on", scores: { grammar: 0.41, dates: 0.24, verbs: 0.09, names: 0.07, punctuation: 0.06, code: 0.05, numbers: 0.04, symbols: 0.04 } },
  { text: "Oct", scores: { dates: 0.47, names: 0.2, grammar: 0.08, numbers: 0.07, verbs: 0.05, punctuation: 0.05, code: 0.04, symbols: 0.04 } },
  { text: "21", scores: { dates: 0.4, numbers: 0.28, symbols: 0.08, punctuation: 0.07, grammar: 0.05, code: 0.04, verbs: 0.04, names: 0.04 } },
  { text: ",", scores: { punctuation: 0.48, grammar: 0.17, verbs: 0.08, symbols: 0.07, code: 0.06, numbers: 0.05, names: 0.04, dates: 0.05 } },
  { text: "then", scores: { grammar: 0.44, verbs: 0.22, punctuation: 0.08, dates: 0.07, names: 0.06, code: 0.05, numbers: 0.04, symbols: 0.04 } },
  { text: "ran", scores: { verbs: 0.41, code: 0.25, grammar: 0.09, names: 0.07, symbols: 0.06, dates: 0.04, numbers: 0.04, punctuation: 0.04 } },
  { text: "npm", scores: { code: 0.5, names: 0.17, symbols: 0.08, verbs: 0.07, grammar: 0.05, punctuation: 0.05, numbers: 0.04, dates: 0.04 } },
  { text: "test", scores: { code: 0.43, verbs: 0.25, grammar: 0.08, names: 0.07, symbols: 0.05, punctuation: 0.04, dates: 0.04, numbers: 0.04 } },
  { text: ".", scores: { punctuation: 0.47, grammar: 0.19, symbols: 0.08, code: 0.07, verbs: 0.06, dates: 0.05, names: 0.04, numbers: 0.04 } },
];

export function MixtureOfExperts({
  experts = DEFAULT_MOE_EXPERTS,
  tokens = DEFAULT_MOE_TOKENS,
  topK: controlledTopK,
  defaultTopK = 2,
  onTopKChange,
  capacityFactor = 1.0,
  totalParamsB = 671,
  activeParamsByK = { 1: 21, 2: 37 },
  speed = 1,
  paused: controlledPaused,
  defaultPaused = false,
  onPausedChange,
  loop = true,
  onRoute,
  label = "Mixture of experts routing",
  className,
  style,
}: MixtureOfExpertsProps) {
  const reducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(640);

  const [internalTopK, setInternalTopK] = useState<1 | 2>(defaultTopK);
  const topK = controlledTopK ?? internalTopK;

  const [internalPaused, setInternalPaused] = useState(defaultPaused);
  const paused = controlledPaused ?? internalPaused;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  // Inspection / pinning
  const [pinnedToken, setPinnedToken] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);
  const [pinnedExpert, setPinnedExpert] = useState<string | null>(null);
  const [hoveredExpert, setHoveredExpert] = useState<string | null>(null);

  const tokenRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const expertRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setTopK = (k: 1 | 2) => {
    if (controlledTopK === undefined) setInternalTopK(k);
    onTopKChange?.(k);
    setCurrentIndex(0);
    setFinished(false);
  };

  const setPaused = (next: boolean) => {
    if (controlledPaused === undefined) setInternalPaused(next);
    onPausedChange?.(next);
  };

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setStageWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Capacity per expert
  const capacityPerExpert = useMemo(() => {
    const avg = (tokens.length * topK) / Math.max(1, experts.length);
    return Math.max(2, Math.floor(avg * capacityFactor));
  }, [tokens.length, topK, experts.length, capacityFactor]);

  // Precompute all routing decisions sequentially so capacity overflow is deterministic
  const decisions = useMemo<MoeRouteDecision[]>(() => {
    const counts: Record<string, number> = {};
    for (const e of experts) counts[e.id] = 0;

    return tokens.map((tok, ti) => {
      const sorted = [...experts]
        .map((e) => ({ id: e.id, score: tok.scores[e.id] ?? 0.03 }))
        .sort((a, b) => b.score - a.score);

      const chosen = sorted.slice(0, topK);
      const sumScore = chosen.reduce((acc, c) => acc + c.score, 0) || 1;

      const selected = chosen.map((c) => {
        const atCap = (counts[c.id] ?? 0) >= capacityPerExpert;
        if (!atCap) {
          counts[c.id] = (counts[c.id] ?? 0) + 1;
        }
        return {
          expertId: c.id,
          weight: Math.round((c.score / sumScore) * 100),
          dropped: atCap,
        };
      });

      return { tokenIndex: ti, token: tok.text, selected };
    });
  }, [experts, tokens, topK, capacityPerExpert]);

  // Playback loop
  const isInspecting =
    pinnedToken !== null ||
    hoveredToken !== null ||
    pinnedExpert !== null ||
    hoveredExpert !== null;

  useEffect(() => {
    if (paused || isInspecting || finished || tokens.length === 0) return;
    const stepMs = Math.max(450, Math.round(1300 / Math.max(0.25, speed)));
    const t = setTimeout(() => {
      if (currentIndex + 1 >= tokens.length) {
        if (loop) {
          setCurrentIndex(0);
        } else {
          setFinished(true);
        }
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, stepMs);
    return () => clearTimeout(t);
  }, [paused, isInspecting, finished, currentIndex, tokens.length, loop, speed]);

  // Notify onRoute when currentIndex advances
  useEffect(() => {
    const dec = decisions[currentIndex];
    if (dec) onRoute?.(dec);
  }, [currentIndex, decisions, onRoute]);

  // Escape unpins
  useEffect(() => {
    if (pinnedToken === null && pinnedExpert === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedToken(null);
        setPinnedExpert(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinnedToken, pinnedExpert]);

  const activeTokenIdx = pinnedToken ?? hoveredToken ?? currentIndex;
  const activeDecision = decisions[activeTokenIdx] ?? decisions[0];
  const activeTokenObj = tokens[activeTokenIdx] ?? tokens[0];
  const inspectedExpertId = pinnedExpert ?? hoveredExpert;

  // Cumulative expert counts up to currentIndex (or full sequence if finished/inspecting)
  const expertCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of experts) map[e.id] = 0;
    const limit = finished ? decisions.length - 1 : Math.max(currentIndex, activeTokenIdx);
    for (let i = 0; i <= limit && i < decisions.length; i++) {
      for (const s of decisions[i].selected) {
        if (!s.dropped) {
          map[s.expertId] = (map[s.expertId] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [experts, decisions, currentIndex, activeTokenIdx, finished]);

  const totalRouted = Object.values(expertCounts).reduce((a, b) => a + b, 0);
  const activeExpertsCount = Object.values(expertCounts).filter((c) => c > 0).length;

  // Layout geometry: wide (>= 568px) vs narrow (< 568px)
  const isWide = stageWidth >= 568;
  const n = experts.length;
  const stageHeight = isWide ? Math.max(294, n * 36 + 10) : 286;

  // Compute coordinates for wide (left->right) or narrow (top->bottom)
  const geom = useMemo(() => {
    if (isWide) {
      const inX = 0;
      const inW = 72;
      const routerX = 112;
      const routerW = 148;
      const expertX = Math.round(stageWidth * 0.48);
      const expertW = Math.min(180, Math.round(stageWidth * 0.28));
      const outX = stageWidth - 78;
      const outW = 78;
      const rowGap = 6;
      const rowH = Math.floor((stageHeight - 24 - (n - 1) * rowGap) / n);
      const topPad = 14;

      const rows = experts.map((e, i) => {
        const y = topPad + i * (rowH + rowGap);
        const cy = y + rowH / 2;
        return {
          expert: e,
          y,
          cy,
          rowH,
          trackX: routerX + 12,
          trackY: cy - 2,
          trackW: routerW - 56,
          scoreX: routerX + routerW - 40,
          scoreY: cy - 8,
          tileX: expertX,
          tileY: y,
          tileW: expertW,
          tileH: rowH,
        };
      });

      const midY = stageHeight / 2;
      return {
        inSlot: { x: inX, y: midY - 14, w: inW, h: 28 },
        outSlot: { x: outX, y: midY - 14, w: outW, h: 28 },
        router: { x: routerX, y: topPad - 4, w: routerW, h: stageHeight - 20 },
        rows,
        midY,
      };
    }

    // Narrow layout: top -> bottom
    const gap = 4;
    const colW = (stageWidth - (n - 1) * gap) / n;
    const rows = experts.map((e, i) => {
      const x = i * (colW + gap);
      const cx = x + colW / 2;
      return {
        expert: e,
        x,
        cx,
        colW,
        trackX: cx - 2,
        trackY: 80,
        trackH: 50,
        scoreX: x,
        scoreY: 58,
        tileX: x,
        tileY: 164,
        tileW: colW,
        tileH: 52,
      };
    });

    return {
      inSlot: { x: stageWidth / 2 - 90, y: 0, w: 180, h: 28 },
      outSlot: { x: stageWidth / 2 - 90, y: 258, w: 180, h: 28 },
      router: { x: 0, y: 50, w: stageWidth, h: 92 },
      rows,
      midX: stageWidth / 2,
    };
  }, [isWide, stageWidth, stageHeight, experts, n]);

  const handleTokenKeyDown = (
    e: ReactKeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % tokens.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tokens.length) % tokens.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tokens.length - 1;
    if (next !== null) {
      e.preventDefault();
      tokenRefs.current[next]?.focus();
    }
  };

  const handleExpertKeyDown = (
    e: ReactKeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight")
      next = (idx + 1) % experts.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (idx - 1 + experts.length) % experts.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = experts.length - 1;
    if (next !== null) {
      e.preventDefault();
      expertRefs.current[next]?.focus();
    }
  };

  const getRankForExpert = useCallback(
    (expertId: string): { rank: number | null; dropped: boolean } => {
      if (!activeDecision) return { rank: null, dropped: false };
      const idx = activeDecision.selected.findIndex((s) => s.expertId === expertId);
      if (idx === -1) return { rank: null, dropped: false };
      return { rank: idx, dropped: activeDecision.selected[idx].dropped };
    },
    [activeDecision]
  );

  const activeParams = activeParamsByK[topK];

  // Inspector note text
  const noteText = useMemo(() => {
    if (inspectedExpertId) {
      const exp = experts.find((e) => e.id === inspectedExpertId);
      const count = expertCounts[inspectedExpertId] ?? 0;
      return `${exp?.name ?? inspectedExpertId} handled ${count} of ${capacityPerExpert} capacity slots so far.`;
    }
    if (!activeDecision) return "";
    const kept = activeDecision.selected.filter((s) => !s.dropped);
    const dropped = activeDecision.selected.filter((s) => s.dropped);
    const nameOf = (id: string) =>
      experts.find((e) => e.id === id)?.name ?? id;

    if (dropped.length > 0 && kept.length > 0) {
      return `${nameOf(kept[0].expertId)} processes "${activeDecision.token}". ${nameOf(dropped[0].expertId)} was at capacity and skipped.`;
    }
    if (kept.length === 2) {
      return `${nameOf(kept[0].expertId)} and ${nameOf(kept[1].expertId)} process "${activeDecision.token}". Their outputs blend ${kept[0].weight} to ${kept[1].weight}.`;
    }
    if (kept.length === 1) {
      return `${nameOf(kept[0].expertId)} processes "${activeDecision.token}" with full weight.`;
    }
    return `All chosen experts for "${activeDecision.token}" are at capacity; token passes through unchanged.`;
  }, [inspectedExpertId, experts, expertCounts, capacityPerExpert, activeDecision]);

  const handlePlayToggle = () => {
    if (finished) {
      setCurrentIndex(0);
      setFinished(false);
      setPaused(false);
    } else {
      setPaused(!paused);
    }
  };

  const prevTokenText =
    activeTokenIdx > 0 ? tokens[activeTokenIdx - 1]?.text : activeTokenObj?.text;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <div
        className={styles.card}
        role="group"
        aria-label={label}
        data-inspect={isInspecting ? "" : undefined}
      >
        <div className={styles.header}>
          <SegmentedControl
            label="Experts per token"
            options={[
              { value: "1", label: "Top 1" },
              { value: "2", label: "Top 2" },
            ]}
            value={String(topK)}
            onValueChange={(v: string) => setTopK(v === "1" ? 1 : 2)}
          />

          <p className={styles.params}>
            <span className={styles.paramsLabel}>Active parameters</span>
            <span className={styles.paramsValue}>{activeParams}B</span>
            <span className={styles.paramsLabel}>of {totalParamsB}B</span>
            <span className={styles.srOnly}>
              {activeParams}B of {totalParamsB}B parameters active per token
            </span>
          </p>

          <button
            type="button"
            className={styles.play}
            aria-label={finished ? "Replay" : paused ? "Play" : "Pause"}
            onClick={handlePlayToggle}
          >
            <span className={styles.playIcon}>
              {finished ? (
                <RotateCcw size={14} />
              ) : paused ? (
                <Play size={14} />
              ) : (
                <Pause size={14} />
              )}
            </span>
          </button>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className={styles.stage}
          data-ready=""
          data-layout={isWide ? "wide" : "narrow"}
          style={{ height: stageHeight }}
        >
          <svg
            className={styles.lines}
            viewBox={`0 0 ${stageWidth} ${stageHeight}`}
            aria-hidden="true"
          >
            {isWide ? (
              <>
                {/* Input -> Router */}
                <line
                  className={styles.flow}
                  data-on=""
                  x1={geom.inSlot.x + geom.inSlot.w + 4}
                  y1={geom.midY!}
                  x2={geom.router.x}
                  y2={geom.midY!}
                />
                {/* Router -> Experts -> Output */}
                {geom.rows.map((r) => {
                  const row = r as {
                    expert: MoeExpert;
                    cy: number;
                    tileX: number;
                    tileW: number;
                  };
                  const { rank, dropped } = getRankForExpert(row.expert.id);
                  const rx = geom.router.x + geom.router.w;
                  const ex1 = row.tileX;
                  const ex2 = row.tileX + row.tileW;
                  const ox = geom.outSlot.x - 4;
                  const mid1 = (rx + ex1) / 2;
                  const mid2 = (ex2 + ox) / 2;
                  return (
                    <g key={row.expert.id}>
                      <path
                        className={styles.gate}
                        data-rank={rank !== null && !dropped ? rank : undefined}
                        data-dropped={dropped ? "" : undefined}
                        d={`M ${rx} ${row.cy} C ${mid1} ${row.cy}, ${mid1} ${row.cy}, ${ex1} ${row.cy}`}
                      />
                      <path
                        className={styles.curve}
                        data-rank={rank !== null && !dropped ? rank : undefined}
                        d={`M ${ex2} ${row.cy} C ${mid2} ${row.cy}, ${mid2} ${geom.midY!}, ${ox} ${geom.midY!}`}
                      />
                    </g>
                  );
                })}
                <circle
                  className={styles.joint}
                  cx={geom.outSlot.x - 4}
                  cy={geom.midY!}
                  r={3}
                />
              </>
            ) : (
              <>
                {/* Input -> Router */}
                <line
                  className={styles.flow}
                  data-on=""
                  x1={geom.midX!}
                  y1={28}
                  x2={geom.midX!}
                  y2={50}
                />
                {/* Router -> Experts -> Output */}
                {geom.rows.map((r) => {
                  const row = r as {
                    expert: MoeExpert;
                    cx: number;
                    tileY: number;
                    tileH: number;
                  };
                  const { rank, dropped } = getRankForExpert(row.expert.id);
                  return (
                    <g key={row.expert.id}>
                      <line
                        className={styles.gate}
                        data-rank={rank !== null && !dropped ? rank : undefined}
                        data-dropped={dropped ? "" : undefined}
                        x1={row.cx}
                        y1={142}
                        x2={row.cx}
                        y2={row.tileY}
                      />
                      <path
                        className={styles.curve}
                        data-rank={rank !== null && !dropped ? rank : undefined}
                        d={`M ${row.cx} ${row.tileY + row.tileH} C ${row.cx} 238, ${geom.midX!} 236, ${geom.midX!} 254`}
                      />
                    </g>
                  );
                })}
                <circle
                  className={styles.joint}
                  cx={geom.midX!}
                  cy={254}
                  r={3}
                />
              </>
            )}
          </svg>

          {/* Animated packets (skipped under reduced motion) */}
          {!reducedMotion && activeDecision && (
            <svg
              className={styles.packets}
              viewBox={`0 0 ${stageWidth} ${stageHeight}`}
              aria-hidden="true"
            >
              {activeDecision.selected.map((sel, rankIdx) => {
                if (sel.dropped) return null;
                const rowIdx = experts.findIndex((e) => e.id === sel.expertId);
                if (rowIdx === -1) return null;
                const r = geom.rows[rowIdx] as {
                  cy?: number;
                  cx?: number;
                  tileX: number;
                  tileW: number;
                  tileY: number;
                  tileH: number;
                };
                const color =
                  rankIdx === 0 ? "var(--moe-first)" : "var(--moe-second)";
                return isWide ? (
                  <motion.circle
                    key={`${activeTokenIdx}-${sel.expertId}`}
                    className={styles.dot}
                    r={3.5}
                    fill={color}
                    initial={{ cx: geom.router.x + geom.router.w, cy: r.cy!, opacity: 0 }}
                    animate={{
                      cx: [geom.router.x + geom.router.w, r.tileX + r.tileW, geom.outSlot.x - 4],
                      cy: [r.cy!, r.cy!, geom.midY!],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{ duration: 0.85, ease: "easeInOut" }}
                  />
                ) : (
                  <motion.circle
                    key={`${activeTokenIdx}-${sel.expertId}`}
                    className={styles.dot}
                    r={3.5}
                    fill={color}
                    initial={{ cx: r.cx!, cy: 142, opacity: 0 }}
                    animate={{
                      cx: [r.cx!, r.cx!, geom.midX!],
                      cy: [142, r.tileY + r.tileH, 254],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{ duration: 0.85, ease: "easeInOut" }}
                  />
                );
              })}
            </svg>
          )}

          {/* Stage labels */}
          <span
            className={styles.stageLabel}
            data-align="start"
            style={
              isWide
                ? { left: 0, top: geom.midY! - 26 }
                : { left: 0, top: 14 }
            }
          >
            Input
          </span>
          <span
            className={styles.stageLabel}
            data-align={isWide ? "end" : "start"}
            style={
              isWide
                ? { left: stageWidth, top: geom.midY! - 26 }
                : { left: 0, top: 272 }
            }
          >
            Output
          </span>

          {/* Router box */}
          <div
            className={styles.router}
            aria-hidden="true"
            data-live=""
            style={{
              left: geom.router.x,
              top: geom.router.y,
              width: geom.router.w,
              height: geom.router.h,
            }}
          />

          {/* Router score bars & percentages */}
          {geom.rows.map((r) => {
            const rawScore = activeTokenObj?.scores[r.expert.id] ?? 0.04;
            const pct = Math.round(rawScore * 100);
            const { rank, dropped } = getRankForExpert(r.expert.id);
            const rankAttr = rank !== null && !dropped ? rank : undefined;

            if (isWide) {
              const row = r as {
                expert: MoeExpert;
                trackX: number;
                trackY: number;
                trackW: number;
                scoreX: number;
                scoreY: number;
              };
              return (
                <div key={`score-${row.expert.id}`} style={{ display: "contents" }}>
                  <span
                    className={styles.track}
                    aria-hidden="true"
                    data-live=""
                    data-rank={rankAttr}
                    style={{
                      left: row.trackX,
                      top: row.trackY,
                      width: row.trackW,
                      height: 4,
                    }}
                  >
                    <span
                      className={styles.fill}
                      style={{ "--s": Math.min(1, rawScore * 1.6) } as CSSProperties}
                    />
                  </span>
                  <span
                    className={styles.score}
                    aria-hidden="true"
                    data-live=""
                    data-rank={rankAttr}
                    style={{
                      left: row.scoreX,
                      top: row.scoreY,
                      width: 32,
                      height: 16,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            }

            const row = r as {
              expert: MoeExpert;
              trackX: number;
              trackY: number;
              trackH: number;
              scoreX: number;
              scoreY: number;
              colW: number;
            };
            return (
              <div key={`score-${row.expert.id}`} style={{ display: "contents" }}>
                <span
                  className={styles.track}
                  aria-hidden="true"
                  data-live=""
                  data-rank={rankAttr}
                  style={{
                    left: row.trackX,
                    top: row.trackY,
                    width: 4,
                    height: row.trackH,
                  }}
                >
                  <span
                    className={styles.fill}
                    style={{ "--s": Math.min(1, rawScore * 1.6) } as CSSProperties}
                  />
                </span>
                <span
                  className={styles.score}
                  aria-hidden="true"
                  data-live=""
                  data-rank={rankAttr}
                  style={{
                    left: row.scoreX,
                    top: row.scoreY,
                    width: row.colW,
                    height: 16,
                  }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}

          {/* Expert tiles */}
          <div className={styles.tiles} role="group" aria-label="Experts">
            {geom.rows.map((r, idx) => {
              const row = r as {
                expert: MoeExpert;
                tileX: number;
                tileY: number;
                tileW: number;
                tileH: number;
              };
              const count = expertCounts[row.expert.id] ?? 0;
              const fillRatio = Math.min(1, count / capacityPerExpert);
              const { rank, dropped } = getRankForExpert(row.expert.id);
              const isPinned = pinnedExpert === row.expert.id;
              const isHovered = hoveredExpert === row.expert.id;
              const rankText =
                rank === 0
                  ? `, first choice for ${activeTokenObj?.text}`
                  : rank === 1
                    ? `, second choice for ${activeTokenObj?.text}`
                    : "";

              return (
                <button
                  key={row.expert.id}
                  ref={(el) => {
                    expertRefs.current[idx] = el;
                  }}
                  type="button"
                  className={styles.tile}
                  tabIndex={idx === 0 ? 0 : -1}
                  aria-pressed={isPinned}
                  aria-label={`${row.expert.name} expert, ${count} ${count === 1 ? "token" : "tokens"}${rankText}`}
                  data-rank={rank !== null && !dropped ? rank : undefined}
                  data-dropped={dropped ? "" : undefined}
                  data-full={count >= capacityPerExpert ? "" : undefined}
                  data-pinned={isPinned ? "" : undefined}
                  data-inspect={isHovered ? "" : undefined}
                  style={
                    {
                      left: row.tileX,
                      top: row.tileY,
                      width: row.tileW,
                      height: row.tileH,
                      "--g": fillRatio,
                    } as CSSProperties
                  }
                  onMouseEnter={() => setHoveredExpert(row.expert.id)}
                  onMouseLeave={() => setHoveredExpert(null)}
                  onClick={() => {
                    setPinnedToken(null);
                    setPinnedExpert((prev) =>
                      prev === row.expert.id ? null : row.expert.id
                    );
                  }}
                  onKeyDown={(e) => handleExpertKeyDown(e, idx)}
                >
                  <span className={styles.gauge} aria-hidden="true" />
                  <span className={styles.tileIcon} aria-hidden="true">
                    {row.expert.icon ?? row.expert.name[0]}
                  </span>
                  <span className={styles.tileName}>{row.expert.name}</span>
                  <span className={styles.tileCount}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Input & Output chips */}
          <div
            className={styles.slot}
            data-side="in"
            style={{
              left: geom.inSlot.x,
              top: geom.inSlot.y,
              width: geom.inSlot.w,
              height: geom.inSlot.h,
            }}
          >
            <span className={styles.chip}>{activeTokenObj?.text ?? ""}</span>
          </div>

          <div
            className={styles.slot}
            data-side="out"
            style={{
              left: geom.outSlot.x,
              top: geom.outSlot.y,
              width: geom.outSlot.w,
              height: geom.outSlot.h,
            }}
          >
            <span className={styles.chip}>
              <span className={styles.chipDots} aria-hidden="true">
                {activeDecision?.selected.map((s, i) =>
                  s.dropped ? null : <i key={s.expertId} data-rank={i} />
                )}
              </span>
              {prevTokenText ?? ""}
            </span>
          </div>
        </div>

        {/* Token sequence */}
        <div
          className={styles.sequence}
          role="group"
          aria-label="Tokens. Hover, focus or select one to see its route."
        >
          {decisions.map((dec, idx) => {
            const state =
              idx < currentIndex
                ? "done"
                : idx === currentIndex
                  ? "current"
                  : "next";
            const isPinned = pinnedToken === idx;
            const isHovered = hoveredToken === idx;

            let expertMatchRank: number | undefined;
            let expertMatchDropped = false;
            let faded = false;

            if (inspectedExpertId) {
              const foundIdx = dec.selected.findIndex(
                (s) => s.expertId === inspectedExpertId
              );
              if (foundIdx !== -1) {
                expertMatchRank = foundIdx;
                expertMatchDropped = dec.selected[foundIdx].dropped;
              } else {
                faded = true;
              }
            }

            const routeSummary = dec.selected
              .map((s) => {
                const expName =
                  experts.find((e) => e.id === s.expertId)?.name ?? s.expertId;
                return s.dropped
                  ? `${expName} skipped, at capacity`
                  : `${expName} ${s.weight}%`;
              })
              .join(", ");

            return (
              <button
                key={`${dec.token}-${idx}`}
                ref={(el) => {
                  tokenRefs.current[idx] = el;
                }}
                type="button"
                className={styles.token}
                tabIndex={idx === 0 ? 0 : -1}
                data-state={state}
                data-inspect={isHovered ? "" : undefined}
                data-rank={
                  expertMatchRank !== undefined && !expertMatchDropped
                    ? expertMatchRank
                    : undefined
                }
                data-dropped={expertMatchDropped ? "" : undefined}
                data-fade={faded ? "" : undefined}
                aria-pressed={isPinned}
                aria-label={`${dec.token}: ${routeSummary}`}
                onMouseEnter={() => setHoveredToken(idx)}
                onMouseLeave={() => setHoveredToken(null)}
                onClick={() => {
                  setPinnedExpert(null);
                  setPinnedToken((prev) => (prev === idx ? null : idx));
                }}
                onKeyDown={(e) => handleTokenKeyDown(e, idx)}
              >
                {dec.token}
              </button>
            );
          })}
        </div>

        {/* Footer: inspector + load meter */}
        <div className={styles.footer}>
          <div className={styles.inspector}>
            {activeDecision && (
              <div className={styles.line}>
                <span className={styles.lineChip}>{activeDecision.token}</span>
                <ArrowRight
                  size={14}
                  className={styles.lineArrow}
                  aria-hidden="true"
                />
                {activeDecision.selected.map((s, idx) => {
                  const expName =
                    experts.find((e) => e.id === s.expertId)?.name ??
                    s.expertId;
                  return (
                    <span
                      key={s.expertId}
                      className={styles.pick}
                      data-rank={!s.dropped ? idx : undefined}
                      data-dropped={s.dropped ? "" : undefined}
                    >
                      {s.dropped ? (
                        <AlertTriangle
                          size={13}
                          className={styles.warnIcon}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className={styles.swatch} aria-hidden="true" />
                      )}
                      <span className={styles.pickName}>{expName}</span>
                      <span className={styles.pickValue}>
                        {s.dropped ? "full" : `${s.weight}%`}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
            <p className={styles.note}>{noteText}</p>
          </div>

          <div className={styles.load}>
            <div className={styles.loadHead}>
              <span>Expert load</span>
              <span className={styles.loadValue}>
                {activeExpertsCount}/{experts.length}
              </span>
            </div>
            <div
              className={styles.loadBar}
              role="img"
              aria-label={`Expert load: ${activeExpertsCount} of ${experts.length} experts active, ${totalRouted} routes assigned`}
            >
              {experts.map((e) => {
                const c = expertCounts[e.id] ?? 0;
                const { rank, dropped } = getRankForExpert(e.id);
                return (
                  <span
                    key={e.id}
                    className={styles.seg}
                    data-zero={c === 0 ? "" : undefined}
                    data-rank={rank !== null && !dropped ? rank : undefined}
                    data-inspect={inspectedExpertId === e.id ? "" : undefined}
                    style={{ flexGrow: c }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <p className={styles.srOnly} aria-live="polite">
          {noteText}
        </p>
      </div>
    </div>
  );
}
