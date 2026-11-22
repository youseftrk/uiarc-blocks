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
} from "react";
import { useReducedMotion } from "motion/react";
import { GitBranch, GitCommitHorizontal, GitMerge } from "lucide-react";
import styles from "./branch-graph.module.css";

export type BranchGraphStrategy = "open" | "merge" | "rebase" | "squash";

export interface BranchGraphAuthor {
  name: string;
  avatar?: string;
}

export interface BranchGraphCommit {
  id: string;
  hash: string;
  message: string;
  body?: string;
  branch: string;
  /** Parent ids. A second parent makes a merge commit. */
  parents?: string[];
  author: BranchGraphAuthor;
  /** Display text such as "2 hours ago". */
  date: string;
  additions?: number;
  deletions?: number;
  files?: number;
}

export interface BranchGraphBranch {
  name: string;
  color?: string;
}

export interface BranchGraphPullRequest {
  number: number;
  title: string;
  branch: string;
}

export interface BranchGraphProps {
  /** Commits, newest first. */
  commits?: BranchGraphCommit[];
  /** Branches in lane order. The first is the base branch. */
  branches?: BranchGraphBranch[];
  pullRequest?: BranchGraphPullRequest;
  /** Controlled strategy. Pair with onStrategyChange. */
  strategy?: BranchGraphStrategy;
  defaultStrategy?: BranchGraphStrategy;
  onStrategyChange?: (strategy: BranchGraphStrategy) => void;
  /** Strategies offered in the control, in order. Pass one to hide the control. */
  strategies?: BranchGraphStrategy[];
  /** Visible title. Pass an empty string to hide it. */
  title?: string;
  /** Cycles before, rebase, merge, and squash while nobody interacts. Only when uncontrolled. */
  autoplay?: boolean;
  /** Multiplies the pace of every animation. 0 jumps straight to each state. */
  speed?: number;
  paused?: boolean;
  /** Any CSS color for the base lane and hash rewrites. */
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const chloe = { name: "Chloe Nguyen", avatar: "/media/people/chloe-nguyen.jpg" };
const sofia = { name: "Sofia Ramirez", avatar: "/media/people/sofia-ramirez.jpg" };
const daniel = { name: "Daniel Kim", avatar: "/media/people/daniel-kim.jpg" };
const marcus = { name: "Marcus Johnson", avatar: "/media/people/marcus-johnson.jpg" };

const DEFAULT_COMMITS: BranchGraphCommit[] = [
  { id: "f3", hash: "9f2c1ab", message: "Save cards for returning customers", body: "Stores a customer id on the first purchase and offers saved cards on the next visit.", branch: "feat/checkout", parents: ["f2"], author: chloe, date: "2 hours ago", additions: 184, deletions: 32, files: 6 },
  { id: "m4", hash: "4e81d07", message: "Bump stripe-js to 4.2", body: "Picks up the new payment element and drops a deprecated option.", branch: "main", parents: ["m3"], author: daniel, date: "5 hours ago", additions: 12, deletions: 12, files: 2 },
  { id: "f2", hash: "c7a3e52", message: "Add Apple Pay button", body: "Shows the Apple Pay sheet when the browser supports it and falls back to the card form.", branch: "feat/checkout", parents: ["f1"], author: chloe, date: "Yesterday", additions: 96, deletions: 8, files: 4 },
  { id: "m3", hash: "2d9b6f4", message: "Merge branch fix/rounding", branch: "main", parents: ["m2", "x1"], author: sofia, date: "Yesterday", additions: 18, deletions: 6, files: 3 },
  { id: "x1", hash: "a15e3c9", message: "Round tax per line item", body: "Totals now match the invoice when a cart mixes tax rates.", branch: "fix/rounding", parents: ["m2"], author: sofia, date: "2 days ago", additions: 18, deletions: 6, files: 3 },
  { id: "f1", hash: "6b04d8e", message: "Move payment into its own step", body: "Splits the single checkout page into address, payment, and review steps.", branch: "feat/checkout", parents: ["m2"], author: chloe, date: "2 days ago", additions: 241, deletions: 117, files: 9 },
  { id: "m2", hash: "e3c72a0", message: "Add order summary", branch: "main", parents: ["m1"], author: marcus, date: "3 days ago", additions: 132, deletions: 14, files: 5 },
  { id: "m1", hash: "0f5d9b3", message: "Ship checkout v1", branch: "main", parents: [], author: marcus, date: "4 days ago", additions: 410, deletions: 0, files: 12 },
];
const DEFAULT_BRANCHES: BranchGraphBranch[] = [{ name: "main" }, { name: "feat/checkout" }, { name: "fix/rounding" }];
const DEFAULT_PR: BranchGraphPullRequest = { number: 482, title: "Checkout redesign", branch: "feat/checkout" };
const ALL: BranchGraphStrategy[] = ["open", "merge", "rebase", "squash"];
const CYCLE: BranchGraphStrategy[] = ["open", "rebase", "merge", "squash"];
const LABELS: Record<BranchGraphStrategy, string> = { open: "Before", merge: "Merge", rebase: "Rebase", squash: "Squash" };
const KNOWN_HASHES: Record<string, string> = { "r:9f2c1ab": "2068772", "r:c7a3e52": "4e2a008", "r:6b04d8e": "94c2bdf", "m:9f2c1ab": "0e46550", "s:9f2c1ab": "86cedd8" };

const ROW = 44;
const TOP = 28;
const LANE0 = 22;
const LANE = 18;
const MERGE = "__merge";
const SQUASH = "__squash";
const LANE_COLORS = ["var(--bg-base)", "var(--series-2)", "var(--series-4)", "var(--series-3)"];

function rehash(seed: string) {
  if (KNOWN_HASHES[seed]) return KNOWN_HASHES[seed];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const linear = (t: number) => t;

interface Edge {
  key: string;
  from: string;
  to: string;
  kind: "out" | "in";
  color: string;
}
interface Layout {
  order: string[];
  rowY: Record<string, number>;
  node: Record<string, { x: number; y: number }>;
  edges: Set<string>;
  height: number;
}
interface Tween {
  from: number;
  to: number;
  start: number;
  dur: number;
  ease: (t: number) => number;
}

function edgePath(x1: number, y1: number, x2: number, y2: number, kind: "out" | "in") {
  const dy = y1 - y2;
  if (Math.abs(dy) < 0.5 && Math.abs(x1 - x2) < 0.5) return `M${x1} ${y1}`;
  const r = (n: number) => Math.round(n * 100) / 100;
  const sign = dy >= 0 ? 1 : -1;
  const c = Math.min(Math.abs(dy), Math.max(24.64, Math.abs(x2 - x1) * 1.0022)) * sign;
  const a = r(c * 0.56);
  const b = r(c * 0.44);
  if (kind === "out") return `M${r(x1)} ${r(y1)}C${r(x1)} ${r(y1 - a)} ${r(x2)} ${r(y1 - b)} ${r(x2)} ${r(y1 - c)}L${r(x2)} ${r(y2)}`;
  const s = y2 + c;
  return `M${r(x1)} ${r(y1)}L${r(x1)} ${r(s)}C${r(x1)} ${r(s - a)} ${r(x2)} ${r(s - b)} ${r(x2)} ${r(y2)}`;
}

/** An interactive commit graph that previews how a pull request lands as a merge, a rebase, or a squash. */
export function BranchGraph({
  commits = DEFAULT_COMMITS,
  branches = DEFAULT_BRANCHES,
  pullRequest = DEFAULT_PR,
  strategy: controlled,
  defaultStrategy = "open",
  onStrategyChange,
  strategies = ALL,
  title,
  autoplay = true,
  speed = 1,
  paused = false,
  accent,
  label,
  className,
  style,
}: BranchGraphProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const instant = reduced || speed <= 0;
  const [inner, setInner] = useState<BranchGraphStrategy>(defaultStrategy);
  const strategy = controlled ?? inner;
  const [active, setActive] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [rewritten, setRewritten] = useState<Record<string, boolean>>({});
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [card, setCard] = useState<{ y: number; above: boolean } | null>(null);

  const model = useMemo(() => {
    const byId = new Map(commits.map((c) => [c.id, c]));
    const base = branches[0]?.name ?? "main";
    const lane = (name: string) => Math.max(0, branches.findIndex((b) => b.name === name));
    const color = (name: string) => branches[lane(name)]?.color ?? LANE_COLORS[lane(name) % LANE_COLORS.length];
    const pr = commits.filter((c) => c.branch === pullRequest.branch);
    const prIds = new Set(pr.map((c) => c.id));
    const prTip = pr[0];
    const prOldest = pr[pr.length - 1];
    const baseTip = commits.find((c) => c.branch === base);
    const reach = (from?: string) => {
      const seen = new Set<string>();
      const walk = (id?: string) => {
        if (!id || seen.has(id) || !byId.has(id)) return;
        seen.add(id);
        byId.get(id)!.parents?.forEach(walk);
      };
      walk(from);
      return seen;
    };
    const fromPr = reach(prTip?.id);
    const fromBase = reach(baseTip?.id);
    const ahead = [...fromPr].filter((id) => !fromBase.has(id)).length;
    const behind = [...fromBase].filter((id) => !fromPr.has(id)).length;
    const sum = (key: "additions" | "deletions" | "files") => pr.reduce((n, c) => n + (c[key] ?? 0), 0);
    const ghostAuthor = prTip?.author ?? { name: "" };
    const mergeCommit: BranchGraphCommit = {
      id: MERGE,
      hash: rehash(`m:${prTip?.hash}`),
      message: `Merge pull request #${pullRequest.number} from ${pullRequest.branch}`,
      body: `Brings ${plural(pr.length, "commit")} from ${pullRequest.branch} into ${base} and keeps them as they are.`,
      branch: base,
      parents: [baseTip?.id ?? "", prTip?.id ?? ""],
      author: ghostAuthor,
      date: "Just now",
      additions: sum("additions"),
      deletions: sum("deletions"),
      files: sum("files"),
    };
    const squashCommit: BranchGraphCommit = {
      ...mergeCommit,
      id: SQUASH,
      hash: rehash(`s:${prTip?.hash}`),
      message: `${pullRequest.title} (#${pullRequest.number})`,
      body: `Folds ${plural(pr.length, "commit")} from ${pullRequest.branch} into one commit on ${base}.`,
      branch: pullRequest.branch,
      parents: [baseTip?.id ?? ""],
    };
    const all = [...commits, mergeCommit, squashCommit];
    const entity = new Map(all.map((c) => [c.id, c]));

    const edges: Edge[] = [];
    for (const c of commits) {
      (c.parents ?? []).forEach((p, i) => {
        const parent = byId.get(p);
        if (!parent) return;
        edges.push({ key: `${p}>${c.id}`, from: p, to: c.id, kind: i > 0 ? "in" : "out", color: color(i > 0 ? parent.branch : c.branch) });
      });
    }
    const extra = { mergeBase: "", mergePr: "", rebase: "", squash: "", branchPoint: "" };
    if (baseTip && prTip && prOldest) {
      extra.mergeBase = `${baseTip.id}>${MERGE}`;
      extra.mergePr = `${prTip.id}>${MERGE}`;
      extra.rebase = `${baseTip.id}>${prOldest.id}:rebase`;
      extra.squash = `${baseTip.id}>${SQUASH}`;
      extra.branchPoint = prOldest.parents?.[0] ? `${prOldest.parents[0]}>${prOldest.id}` : "";
      edges.push({ key: extra.mergeBase, from: baseTip.id, to: MERGE, kind: "out", color: color(base) });
      edges.push({ key: extra.mergePr, from: prTip.id, to: MERGE, kind: "in", color: color(pullRequest.branch) });
      edges.push({ key: extra.rebase, from: baseTip.id, to: prOldest.id, kind: "out", color: color(pullRequest.branch) });
      edges.push({ key: extra.squash, from: baseTip.id, to: SQUASH, kind: "out", color: color(pullRequest.branch) });
    }
    const original = edges.filter((e) => byId.has(e.to) && !e.key.endsWith(":rebase")).map((e) => e.key);

    const layout = (s: BranchGraphStrategy): Layout => {
      let order = commits.map((c) => c.id);
      let visible = new Set(original);
      if (s === "merge" && prTip) {
        order = [MERGE, ...order];
        visible.add(extra.mergeBase).add(extra.mergePr);
      } else if (s === "rebase" && prTip) {
        order = [...pr.map((c) => c.id), ...order.filter((id) => !prIds.has(id))];
        visible.delete(extra.branchPoint);
        visible.add(extra.rebase);
      } else if (s === "squash" && prTip) {
        order = [SQUASH, ...order.filter((id) => !prIds.has(id))];
        visible = new Set(edges.filter((e) => original.includes(e.key) && !prIds.has(e.to) && !prIds.has(e.from)).map((e) => e.key));
        visible.add(extra.squash);
      }
      const rowY: Record<string, number> = {};
      const node: Record<string, { x: number; y: number }> = {};
      order.forEach((id, i) => {
        const c = entity.get(id)!;
        const flat = id === SQUASH || id === MERGE || (s === "rebase" && prIds.has(id));
        rowY[id] = i * ROW;
        node[id] = { x: LANE0 + LANE * (flat ? 0 : lane(c.branch)), y: TOP + i * ROW };
      });
      return { order, rowY, node, edges: visible, height: order.length * ROW + 12 };
    };
    const layouts: Record<BranchGraphStrategy, Layout> = { open: layout("open"), merge: layout("merge"), rebase: layout("rebase"), squash: layout("squash") };

    const tags = (s: BranchGraphStrategy) => {
      const out: Record<string, string[]> = {};
      const add = (id: string | undefined, name: string) => {
        if (id) (out[id] ??= []).push(name);
      };
      if (s === "open") {
        add(prTip?.id, pullRequest.branch);
        add(baseTip?.id, base);
      } else if (s === "merge") {
        add(MERGE, base);
        add(prTip?.id, pullRequest.branch);
      } else if (s === "rebase") {
        add(prTip?.id, base);
        add(prTip?.id, pullRequest.branch);
      } else add(SQUASH, base);
      return out;
    };
    const n = pr.length;
    const summary: Record<BranchGraphStrategy, string> = {
      open: `${pullRequest.branch} is ${plural(ahead, "commit")} ahead of ${base} and ${behind} behind.`,
      merge: `A merge commit brings ${plural(n, "commit")} into ${base} and keeps both lines of history.`,
      rebase: `${plural(n, "commit")} replayed on top of ${base} with new hashes. History stays in one line.`,
      squash: `${plural(n, "commit")} squashed into one commit on ${base}.`,
    };
    return { all, entity, edges, layouts, tags, summary, base, color, pr, prIds, gutter: LANE0 * 2 + LANE * Math.max(0, branches.length - 1) };
  }, [commits, branches, pullRequest]);

  const layout = model.layouts[strategy];
  const shownTitle = title ?? pullRequest.title;

  /* ---- animation engine: one rAF loop that writes straight to the DOM ---- */
  const vals = useRef(new Map<string, number>());
  const tweens = useRef(new Map<string, Tween>());
  const events = useRef<{ at: number; run: () => void }[]>([]);
  const cache = useRef(new Map<string, string>());
  const raf = useRef(0);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const nodes = useRef(new Map<string, SVGGElement>());
  const rings = useRef(new Map<string, SVGCircleElement>());
  const paths = useRef(new Map<string, SVGPathElement>());
  const stageRef = useRef<HTMLDivElement>(null);
  const prev = useRef<{ strategy: BranchGraphStrategy; model: typeof model } | null>(null);

  const paint = useCallback(() => {
    const v = vals.current;
    const get = (key: string, fallback = 0) => v.get(key) ?? fallback;
    const write = (key: string, value: string, apply: () => void) => {
      if (cache.current.get(key) === value) return;
      cache.current.set(key, value);
      apply();
    };
    for (const [id, el] of rows.current) {
      const o = get(`r:${id}:o`);
      const lift = get(`r:${id}:l`);
      const value = `${get(`r:${id}:y`).toFixed(2)}|${o.toFixed(3)}|${lift.toFixed(3)}`;
      write(`r:${id}`, value, () => {
        el.style.transform = `translate3d(0px, ${get(`r:${id}:y`).toFixed(2)}px, 0px) scale(${(1 + lift * 0.008).toFixed(4)})`;
        el.style.opacity = o.toFixed(3);
        el.style.setProperty("--lift", lift.toFixed(3));
        el.style.visibility = o <= 0.001 ? "hidden" : "visible";
        el.style.zIndex = lift > 0.001 ? "3" : "1";
      });
    }
    for (const [id, el] of nodes.current) {
      const value = `translate(${get(`n:${id}:x`).toFixed(2)} ${get(`n:${id}:y`).toFixed(2)}) scale(${(get(`n:${id}:s`, 1) * (1 + 0.28 * get(`n:${id}:a`))).toFixed(3)})`;
      const o = get(`n:${id}:o`).toFixed(3);
      write(`n:${id}`, value + o, () => {
        el.setAttribute("transform", value);
        el.setAttribute("opacity", o);
      });
      const ring = rings.current.get(id);
      if (ring) {
        const t = get(`n:${id}:ring`, 1);
        const rv = `${get(`n:${id}:x`).toFixed(1)}|${get(`n:${id}:y`).toFixed(1)}|${t.toFixed(3)}`;
        write(`g:${id}`, rv, () => {
          ring.setAttribute("cx", get(`n:${id}:x`).toFixed(2));
          ring.setAttribute("cy", get(`n:${id}:y`).toFixed(2));
          ring.setAttribute("r", (5 + 9 * t).toFixed(2));
          ring.setAttribute("opacity", t >= 1 || t <= 0 ? "0" : ((1 - t) * 0.6).toFixed(3));
        });
      }
    }
    for (const edge of model.edges) {
      const el = paths.current.get(edge.key);
      if (!el) continue;
      const p = get(`e:${edge.key}`);
      const d = p <= 0.001 ? "" : edgePath(get(`n:${edge.from}:x`), get(`n:${edge.from}:y`), get(`n:${edge.to}:x`), get(`n:${edge.to}:y`), edge.kind);
      write(`e:${edge.key}`, `${p.toFixed(3)}|${d}`, () => {
        if (d) el.setAttribute("d", d);
        el.setAttribute("opacity", p <= 0.001 ? "0" : "1");
        el.setAttribute("stroke-dasharray", p >= 0.999 ? "none" : `${p.toFixed(3)} 1`);
      });
    }
    const h = get("h");
    if (stageRef.current) write("h", h.toFixed(2), () => (stageRef.current!.style.height = `${Math.round(h * 100) / 100}px`));
  }, [model]);

  const tickRef = useRef<() => void>(() => {});
  const tick = useCallback(() => {
    const now = performance.now();
    for (const [key, pending] of tweens.current) {
      if (now < pending.start) continue;
      /* A tween starts from wherever the value is when it begins, so a new pick mid-flight never jumps. */
      const t = Number.isNaN(pending.from) ? { ...pending, from: vals.current.get(key) ?? pending.to } : pending;
      if (t !== pending) tweens.current.set(key, t);
      const k = t.dur <= 0 ? 1 : Math.min(1, (now - t.start) / t.dur);
      vals.current.set(key, t.from + (t.to - t.from) * t.ease(k));
      if (k >= 1) tweens.current.delete(key);
    }
    const due = events.current.filter((e) => e.at <= now);
    if (due.length) {
      events.current = events.current.filter((e) => e.at > now);
      due.forEach((e) => e.run());
    }
    paint();
    raf.current = tweens.current.size || events.current.length ? requestAnimationFrame(() => tickRef.current()) : 0;
  }, [paint]);
  useLayoutEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useLayoutEffect(() => {
    const v = vals.current;
    const k = instant ? 0 : 1 / speed;
    const now = performance.now();
    const target = model.layouts[strategy];
    const before = prev.current;
    const fresh = !before || before.model !== model;
    const from = fresh ? null : model.layouts[before!.strategy];
    prev.current = { strategy, model };
    const to = (key: string, value: number, delay = 0, dur = 0, ease: (t: number) => number = easeInOut) => {
      const current = v.get(key) ?? value;
      if (k === 0 || (delay <= 0 && dur <= 0)) {
        tweens.current.delete(key);
        v.set(key, value);
        return;
      }
      if (!v.has(key)) v.set(key, current);
      tweens.current.set(key, { from: NaN, to: value, start: now + delay * k, dur: dur * k, ease });
    };
    const at = (delay: number, run: () => void) => {
      if (k === 0) run();
      else events.current.push({ at: now + delay * k, run });
    };
    const ids = model.all.map((c) => c.id);
    const hashes = (s: BranchGraphStrategy) => Object.fromEntries(s === "rebase" ? [...model.prIds].map((id) => [id, true]) : []);

    if (fresh || k === 0) {
      tweens.current.clear();
      events.current = [];
      cache.current.clear();
      for (const id of ids) {
        const shown = id in target.rowY;
        const pos = target.node[id] ?? { x: LANE0, y: TOP };
        v.set(`r:${id}:y`, target.rowY[id] ?? 0);
        v.set(`r:${id}:o`, shown ? 1 : 0);
        v.set(`r:${id}:l`, 0);
        v.set(`n:${id}:x`, pos.x);
        v.set(`n:${id}:y`, pos.y);
        v.set(`n:${id}:s`, shown ? 1 : 0.6);
        v.set(`n:${id}:o`, shown ? 1 : 0);
        v.set(`n:${id}:ring`, 1);
      }
      for (const e of model.edges) v.set(`e:${e.key}`, target.edges.has(e.key) ? 1 : 0);
      v.set("h", target.height);
      at(0, () => setRewritten(hashes(strategy)));
      if (k !== 0) {
        /* Entrance: lines draw up from the oldest commit at a constant pace and commits land as they are reached. */
        const pace = 0.5;
        const floor = Math.max(...target.order.map((id) => target.node[id].y));
        for (const id of target.order) {
          const delay = 120 + (floor - target.node[id].y) / pace;
          v.set(`r:${id}:o`, 0);
          v.set(`n:${id}:o`, 0);
          v.set(`n:${id}:s`, 0.6);
          to(`r:${id}:o`, 1, delay, 300, easeOut);
          to(`n:${id}:o`, 1, delay, 160, easeOut);
          to(`n:${id}:s`, 1, delay, 260, easeOut);
        }
        for (const e of model.edges) {
          if (!target.edges.has(e.key)) continue;
          const y1 = target.node[e.from].y;
          v.set(`e:${e.key}`, 0);
          to(`e:${e.key}`, 1, 120 + (floor - y1) / pace, Math.max(120, (y1 - target.node[e.to].y) / pace), linear);
        }
      }
    } else if (from) {
      events.current = [];
      const rebasing = strategy === "rebase" || before!.strategy === "rebase";
      const pr = [...model.pr].reverse();
      const flights = rebasing && strategy !== "squash" && before!.strategy !== "squash";
      const T1 = 200;
      const moveEnd = flights ? 250 + (pr.length - 1) * 150 + 700 : T1 + 650;
      const T2 = moveEnd + 60;
      let T3 = T2;

      for (const e of model.edges) if (!target.edges.has(e.key)) to(`e:${e.key}`, 0, 0, 250, easeOut);

      for (const id of ids) {
        const shown = id in target.rowY;
        const was = (v.get(`r:${id}:o`) ?? 0) > 0.01;
        const j = pr.findIndex((c) => c.id === id);
        if (!shown) {
          if (!was) continue;
          if (model.prIds.has(id)) {
            /* Squash: the commits fly into one point. */
            to(`r:${id}:y`, 0, 0, 450);
            to(`r:${id}:o`, 0, 0, 220, easeOut);
            to(`n:${id}:x`, LANE0, 0, 450);
            to(`n:${id}:y`, TOP, 0, 450);
            to(`n:${id}:s`, 0.55, 0, 450);
            to(`n:${id}:o`, 0, 250, 200);
            to(`r:${id}:l`, 0, 0, 120);
          } else {
            to(`r:${id}:o`, 0, 0, 180, easeOut);
            to(`n:${id}:o`, 0, 100, 180, easeOut);
            to(`n:${id}:s`, 0.6, 100, 180, easeOut);
          }
          continue;
        }
        const pos = target.node[id];
        if (!was) {
          const ghost = !model.prIds.has(id);
          if (ghost) {
            v.set(`r:${id}:y`, target.rowY[id]);
            v.set(`n:${id}:x`, pos.x);
            v.set(`n:${id}:y`, pos.y);
            v.set(`n:${id}:s`, 0.6);
            const appear = strategy === "squash" ? T2 + 200 : T2 - 150;
            to(`r:${id}:o`, 1, appear, 300, easeOut);
            to(`n:${id}:o`, 1, appear, 160, easeOut);
            to(`n:${id}:s`, 1, appear, 260, easeOut);
            at(appear + 120, () => {
              v.set(`n:${id}:ring`, 0);
              to(`n:${id}:ring`, 1, 1, 520, easeOut);
            });
            T3 = Math.max(T3, appear + 250);
          } else {
            /* Undoing a squash replays the commits back out. */
            to(`r:${id}:y`, target.rowY[id], T1, 600);
            to(`r:${id}:o`, 1, T1 + 150, 300, easeOut);
            to(`n:${id}:x`, pos.x, T1, 600);
            to(`n:${id}:y`, pos.y, T1, 600);
            to(`n:${id}:s`, 1, T1, 400);
            to(`n:${id}:o`, 1, T1, 200);
          }
          continue;
        }
        if (flights && j >= 0) {
          const lift = 100 + j * 130;
          const start = 250 + j * 150;
          const land = start + 700;
          to(`r:${id}:l`, 1, lift, 150, easeOut);
          to(`r:${id}:y`, target.rowY[id], start, 700);
          to(`n:${id}:x`, pos.x, start, 700);
          to(`n:${id}:y`, pos.y, start, 700);
          at(land - 60, () => {
            setRewritten((r) => ({ ...r, [id]: strategy === "rebase" }));
            v.set(`n:${id}:ring`, 0);
            to(`n:${id}:ring`, 1, 1, 520, easeOut);
          });
          at(land + 60, () => to(`r:${id}:l`, 0, 1, 150, easeInOut));
          T3 = Math.max(T3, land + 60);
        } else {
          const delay = flights ? 250 : T1;
          const dur = flights ? 600 : 650;
          to(`r:${id}:y`, target.rowY[id], delay, dur);
          to(`n:${id}:x`, pos.x, delay, dur);
          to(`n:${id}:y`, pos.y, delay, dur);
          to(`n:${id}:s`, 1, delay, 300);
          to(`n:${id}:o`, 1, delay, 200);
          to(`r:${id}:l`, 0, 0, 150);
        }
      }
      if (!flights) at(T1, () => setRewritten(hashes(strategy)));
      const current = v.get("h") ?? target.height;
      if (target.height >= current) to("h", target.height, T1 - 100, 500);
      else to("h", target.height, strategy === "squash" ? T2 : T1, 500);
      for (const e of model.edges) if (target.edges.has(e.key) && (v.get(`e:${e.key}`) ?? 0) < 1) to(`e:${e.key}`, 1, T3, 300, easeOut);
    }
    paint();
    if (!raf.current && (tweens.current.size || events.current.length)) raf.current = requestAnimationFrame(tick);
  }, [strategy, model, instant, speed, paint, tick]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  /* ---- strategy control ---- */
  const segRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const read = () => {
      const el = seg.querySelector<HTMLElement>('[aria-checked="true"]');
      if (el) setThumb((t) => (t && t.x === el.offsetLeft && t.w === el.offsetWidth ? t : { x: el.offsetLeft, w: el.offsetWidth }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(seg);
    return () => ro.disconnect();
  }, [strategy, strategies]);

  const touched = useRef(false);
  const hovered = useRef(false);
  const pick = useCallback(
    (next: BranchGraphStrategy, byUser: boolean) => {
      if (byUser) {
        touched.current = true;
        setAnnouncement(model.summary[next]);
      }
      setActive(null);
      if (controlled === undefined) setInner(next);
      onStrategyChange?.(next);
    },
    [controlled, model, onStrategyChange],
  );

  useEffect(() => {
    if (!autoplay || controlled !== undefined || instant || paused) return;
    const cycle = CYCLE.filter((s) => strategies.includes(s));
    if (cycle.length < 2) return;
    const timer = setInterval(
      () => {
        if (touched.current || hovered.current || document.hidden) return;
        setInner((s) => cycle[(cycle.indexOf(s) + 1) % cycle.length]);
        setActive(null);
      },
      Math.max(900, 4200 / speed),
    );
    return () => clearInterval(timer);
  }, [autoplay, controlled, instant, paused, strategies, speed]);

  const onSegKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = strategies.indexOf(strategy);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (i + 1) % strategies.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (i - 1 + strategies.length) % strategies.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = strategies.length - 1;
    if (next < 0) return;
    event.preventDefault();
    pick(strategies[next], true);
    requestAnimationFrame(() => segRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  /* ---- commits ---- */
  const order = layout.order;
  const rowId = (id: string) => `${uid}-c-${id}`;
  const onListKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = active ? order.indexOf(active) : -1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = Math.min(order.length - 1, i + 1);
    else if (event.key === "ArrowUp") next = i < 0 ? order.length - 1 : Math.max(0, i - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = order.length - 1;
    else if (event.key === "Escape") {
      if (active) event.preventDefault();
      setActive(null);
      return;
    } else return;
    event.preventDefault();
    touched.current = true;
    setActive(order[next]);
  };

  const tags = model.tags(strategy);
  const activeCommit = active && order.includes(active) ? model.entity.get(active) : undefined;
  const hashOf = (c: BranchGraphCommit) => (rewritten[c.id] ? rehash(`r:${c.hash}`) : c.hash);
  const cardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!activeCommit) return;
    const y = layout.rowY[activeCommit.id] ?? 0;
    const h = cardRef.current?.offsetHeight ?? 150;
    const above = y + 54 + h > layout.height + 40 && y + 2 - h > -40;
    const next = { y: above ? y + 2 - h : y + 54, above };
    setCard((c) => (c && c.y === next.y && c.above === next.above ? c : next));
  }, [activeCommit, layout]);

  /* The inspected commit grows a little and every other branch steps back. */
  const lineOf = (id: string) => (id === MERGE || id === SQUASH ? model.base : model.entity.get(id)!.branch);
  const line = activeCommit ? lineOf(activeCommit.id) : null;
  const dim = (id: string) => (line !== null && lineOf(id) !== line ? "" : undefined);
  const focusId = activeCommit?.id ?? null;
  useEffect(() => {
    const now = performance.now();
    for (const c of model.all) {
      const key = `n:${c.id}:a`;
      const target = c.id === focusId ? 1 : 0;
      const current = vals.current.get(key) ?? 0;
      if (current === target && !tweens.current.has(key)) continue;
      if (instant) vals.current.set(key, target);
      else tweens.current.set(key, { from: current, to: target, start: now, dur: 160, ease: easeOut });
    }
    if (!raf.current) raf.current = requestAnimationFrame(() => tickRef.current());
  }, [focusId, model, instant]);

  const rendered = [...order, ...model.all.map((c) => c.id).filter((id) => !order.includes(id))];
  const rootStyle = { "--bg-gutter": `${model.gutter}px`, ...(accent ? { "--bg-base": accent } : null), ...style } as CSSProperties;
  const blocks = (c: BranchGraphCommit) => {
    const total = (c.additions ?? 0) + (c.deletions ?? 0);
    const adds = total ? Math.round((5 * (c.additions ?? 0)) / total) : 0;
    return Array.from({ length: 5 }, (_, i) => (total ? (i < adds ? "add" : "del") : undefined));
  };

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      aria-label={label ?? `${shownTitle || pullRequest.title}, commit graph of ${pullRequest.branch} and ${model.base}`}
      onPointerEnter={() => (hovered.current = true)}
      onPointerLeave={() => (hovered.current = false)}
      onPointerDown={() => (touched.current = true)}
    >
      {(shownTitle || strategies.length > 1) && (
        <div className={styles.header}>
          {shownTitle ? (
            <div className={styles.heading}>
              <GitBranch className={styles.headIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.title}>{shownTitle}</span>
              <span className={styles.number}>#{pullRequest.number}</span>
            </div>
          ) : (
            <span />
          )}
          {strategies.length > 1 && (
            <div className={styles.seg} role="radiogroup" aria-label="Merge strategy preview" ref={segRef} onKeyDown={onSegKey}>
              <span className={styles.thumb} aria-hidden="true" data-ready={thumb ? "" : undefined} style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : undefined} />
              {strategies.map((s) => (
                <button key={s} type="button" role="radio" className={styles.segButton} data-value={s} aria-checked={s === strategy} tabIndex={s === strategy ? 0 : -1} onClick={() => pick(s, true)}>
                  {LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={styles.stage} ref={stageRef}>
        <div
          className={styles.list}
          role="listbox"
          tabIndex={0}
          aria-label={`Commits, newest first. ${model.summary[strategy]}`}
          aria-activedescendant={activeCommit ? rowId(activeCommit.id) : undefined}
          onKeyDown={onListKey}
          onBlur={() => setActive(null)}
          onPointerLeave={(event) => event.pointerType === "mouse" && setActive(null)}
        >
          {rendered.map((id) => {
            const c = model.entity.get(id)!;
            const shown = order.includes(id);
            const merge = (c.parents?.length ?? 0) > 1;
            const hash = hashOf(c);
            const pointing = tags[id] ?? [];
            const name = `${c.message}. ${hash} by ${c.author.name}, ${c.date}. ${plural(c.additions ?? 0, "addition")}, ${plural(c.deletions ?? 0, "deletion")}, ${plural(c.files ?? 0, "file")}.${pointing.length ? ` ${pointing.join(" and ")} ${pointing.length > 1 ? "point" : "points"} here.` : ""}`;
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) rows.current.set(id, el);
                  else rows.current.delete(id);
                }}
                className={styles.row}
                id={shown ? rowId(id) : undefined}
                role={shown ? "option" : undefined}
                aria-selected={shown ? id === active : undefined}
                aria-label={shown ? name : undefined}
                aria-hidden={shown ? undefined : true}
                data-active={shown && id === active ? "" : undefined}
                data-dim={shown ? dim(id) : undefined}
                onPointerEnter={(event) => shown && event.pointerType === "mouse" && setActive(id)}
                onClick={() => shown && setActive((a) => (a === id && !window.matchMedia("(hover: hover)").matches ? null : id))}
              >
                <span className={styles.message}>
                  {merge && <GitMerge className={styles.kindIcon} size={14} strokeWidth={1.75} aria-hidden="true" />}
                  <span className={styles.messageText}>{c.message}</span>
                  {pointing.length > 0 && (
                    <span className={styles.tags} key={pointing.join("|")}>
                      {pointing.map((branch) => (
                        <span key={branch} className={styles.tag} style={{ "--tag": model.color(branch) } as CSSProperties}>
                          <span className={styles.tagName}>{branch}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={styles.author}>
                  {c.author.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.author.avatar} alt="" width={20} height={20} decoding="async" draggable={false} />
                  ) : (
                    <span className={styles.initials}>{initials(c.author.name)}</span>
                  )}
                </span>
                <span className={styles.hash} key={hash} data-flash={rewritten[id] && !instant ? "" : undefined}>
                  {hash}
                </span>
                <span className={styles.date}>{c.date}</span>
              </div>
            );
          })}
        </div>
        <svg className={styles.svg} width={model.gutter} aria-hidden="true">
          <g>
            {model.edges.map((e) => (
              <path
                key={e.key}
                ref={(el) => {
                  if (el) paths.current.set(e.key, el);
                  else paths.current.delete(e.key);
                }}
                className={styles.edge}
                data-dim={line !== null && lineOf(e.from) !== line && lineOf(e.to) !== line ? "" : undefined}
                style={{ stroke: e.color }}
                pathLength={1}
                opacity={0}
              />
            ))}
          </g>
          <g>
            {model.all.map((c) => (
              <circle
                key={c.id}
                ref={(el) => {
                  if (el) rings.current.set(c.id, el);
                  else rings.current.delete(c.id);
                }}
                className={styles.ring}
                style={{ stroke: model.color(c.branch) }}
                r={5}
                opacity={0}
              />
            ))}
          </g>
          <g>
            {model.all.map((c) => {
              const merge = (c.parents?.length ?? 0) > 1;
              const color = model.color(c.branch);
              return (
                <g key={c.id} className={styles.nodeWrap} data-dim={dim(c.id)}>
                  <g
                    opacity={0}
                    ref={(el) => {
                      if (el) nodes.current.set(c.id, el);
                      else nodes.current.delete(c.id);
                    }}
                  >
                    <circle className={styles.moat} r={8} />
                    <circle r={merge ? 4.25 : 5} strokeWidth={merge ? 2 : 0} style={{ fill: merge ? "var(--surface)" : color, stroke: color }} />
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
        <div className={styles.cardWrap} aria-hidden="true" data-open={activeCommit ? "" : undefined} data-above={card?.above ? "" : undefined} style={{ transform: `translate3d(0px, ${card?.y ?? 0}px, 0px)` }}>
          {activeCommit && (
            <div className={styles.card} key={activeCommit.id} ref={cardRef}>
              <div className={styles.cardTitle}>{activeCommit.message}</div>
              {activeCommit.body && <p className={styles.cardBody}>{activeCommit.body}</p>}
              <div className={styles.cardMeta}>
                {activeCommit.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.cardAvatar} src={activeCommit.author.avatar} alt="" width={20} height={20} decoding="async" draggable={false} />
                ) : (
                  <span className={styles.initials}>{initials(activeCommit.author.name)}</span>
                )}
                <span className={styles.cardAuthor}>{activeCommit.author.name}</span>
                <span className={styles.cardDate}>{activeCommit.date}</span>
              </div>
              <div className={styles.cardFoot}>
                <span className={styles.cardHash}>
                  <GitCommitHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
                  {hashOf(activeCommit)}
                </span>
                <span className={styles.stats}>
                  <span className={styles.add}>+{activeCommit.additions ?? 0}</span>
                  <span className={styles.del}>−{activeCommit.deletions ?? 0}</span>
                  <span className={styles.blocks} aria-hidden="true">
                    {blocks(activeCommit).map((kind, i) => (
                      <span key={i} data-kind={kind} />
                    ))}
                  </span>
                </span>
                <span className={styles.files}>{plural(activeCommit.files ?? 0, "file")}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.summary}>{model.summary[strategy]}</span>
      </div>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}

export default BranchGraph;
