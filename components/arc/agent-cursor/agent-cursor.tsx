"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue } from "motion/react";
import { Check, CircleAlert, FileText, Pencil, RotateCcw, Sparkles, Square, Undo2 } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { ClaudeMark } from "../agent-loop/marks";
import styles from "./agent-cursor.module.css";

export interface DocBlock {
  id: string;
  type: "title" | "heading" | "paragraph";
  text: string;
}

export type AgentEdit =
  | { type: "rewrite"; blockId: string; text: string; label?: string }
  | { type: "insert"; afterId: string; block: DocBlock; label?: string }
  | { type: "fix"; blockId: string; find: string; replace: string; label?: string };

export type AgentCursorPhase = "idle" | "thinking" | "editing" | "review" | "accepted" | "reverted" | "stopped" | "empty" | "error";

export interface AgentCursorProps {
  blocks?: DocBlock[];
  meta?: string;
  edits?: AgentEdit[];
  run?: (signal: AbortSignal) => Promise<AgentEdit[]>;
  agent?: { name: string; mark?: ReactNode; color?: string };
  collaborator?: { name: string; avatar?: string; color?: string } | null;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  onAccept?: (blocks: DocBlock[]) => void;
  onUndo?: (blocks: DocBlock[]) => void;
  onPhaseChange?: (phase: AgentCursorPhase) => void;
  simulated?: boolean;
  className?: string;
}

const EMMA_AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c8f5"/><stop offset="1" stop-color="#7d8fe0"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="26" r="11" fill="#fff" fill-opacity=".92"/><path d="M10 64c2-15 11-22 22-22s20 7 22 22z" fill="#fff" fill-opacity=".92"/></svg>',
)}`;

const SAMPLE_BLOCKS: DocBlock[] = [
  { id: "title", type: "title", text: "Usage-based billing launch" },
  { id: "intro", type: "paragraph", text: "On November 18 every Team workspace moves to usage-based billing: seats plus metered agent runs, invoiced monthly through Stripe." },
  { id: "goals", type: "heading", text: "Goals" },
  { id: "goals-body", type: "paragraph", text: "So basically the main thing we are trying to do here is make it so customers can actually see what they are going to pay before the invoice shows up, because a lot of people were surprised by their bills last quarter and that turned into a lot of support tickets." },
  { id: "rollout-body", type: "paragraph", text: "Week one goes to 5% of workpsaces behind the usage_billing flag. We widen to 50% once refund requests stay under 0.4% for seven days, then ship to everyone on December 2." },
];
const SAMPLE_EDITS: AgentEdit[] = [
  { type: "rewrite", blockId: "goals-body", label: "Tightening the goals", text: "Customers should see what they will pay before the invoice arrives. Surprise bills drove 31% of billing tickets in Q3, so a live usage meter and spend alerts ship on day one." },
  { type: "insert", afterId: "goals-body", label: "Adding a heading", block: { id: "rollout", type: "heading", text: "Rollout" } },
  { type: "fix", blockId: "rollout-body", label: "Fixing a typo", find: "workpsaces", replace: "workspaces" },
];
const SAMPLE_META = "Emma Collins · Target Nov 18, 2026";
const DEFAULT_AGENT = { name: "Claude", color: "#D97757" };
const DEFAULT_HUMAN = { name: "Emma Collins", avatar: EMMA_AVATAR };

const ARROW = "M4.4 2.9 16.6 9.1c.8.4.7 1.5-.2 1.7l-5 1.2a1.1 1.1 0 0 0-.8.6l-2.2 4.7c-.4.8-1.6.7-1.8-.2L2.8 4.2c-.2-.9.8-1.7 1.6-1.3Z";
const SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

function chunkText(text: string) {
  const words = text.split(" ");
  const sizes = [4, 5, 3, 6, 4, 5, 4];
  const chunks: string[] = [];
  for (let i = 0, n = 0; i < words.length; n++) {
    const size = sizes[n % sizes.length];
    chunks.push((i === 0 ? "" : " ") + words.slice(i, i + size).join(" "));
    i += size;
  }
  return chunks;
}

interface ViewBlock extends DocBlock {
  pending?: boolean;
  fading?: boolean;
  chunks?: string[];
  shown?: number;
  fix?: { before: string; find: string; replace: string; after: string; swapped: boolean; typo: boolean };
  inserted?: boolean;
  visible?: boolean;
  fromHeight?: number;
}
interface Rect { left: number; top: number; width: number; height: number }
interface Status { key: string; label: string; busy?: boolean; icon?: ReactNode; say: string }

const plain = (blocks: DocBlock[]): ViewBlock[] => blocks.map(({ id, type, text }) => ({ id, type, text }));
const finalDoc = (view: ViewBlock[]): DocBlock[] =>
  view.map(block => ({ id: block.id, type: block.type, text: block.fix ? block.fix.before + (block.fix.swapped ? block.fix.replace : block.fix.find) + block.fix.after : block.text }));

class Aborted extends Error {}

function Cursor({ x, y, color, ready, agent, flip, children }: { x: MotionValue<number>; y: MotionValue<number>; color: string; ready: boolean; agent: boolean; flip: boolean; children: ReactNode }) {
  return (
    <motion.div className={styles.cursor} data-ready={ready} data-agent={agent} style={{ x, y, ...({ "--c": color } as object) }}>
      <svg className={styles.arrow} viewBox="0 0 20 20"><path d={ARROW} /></svg>
      <span className={styles.tag} data-flip={flip}>{children}</span>
    </motion.div>
  );
}

export function AgentCursor({
  blocks, meta, edits, run, agent = DEFAULT_AGENT, collaborator = DEFAULT_HUMAN, autoPlay = true, loop, speed = 1,
  onAccept, onUndo, onPhaseChange, simulated, className,
}: AgentCursorProps) {
  const sample = !blocks && !edits && !run;
  const reduced = !!useReducedMotion();
  const source = useMemo(() => blocks ?? SAMPLE_BLOCKS, [blocks]);
  const sourceKey = JSON.stringify(source);
  const plan = edits ?? (blocks ? [] : SAMPLE_EDITS);
  const looping = (loop ?? sample) && !reduced;
  const isSimulated = simulated ?? sample;
  const metaLine = meta ?? (sample ? SAMPLE_META : undefined);
  const mark = agent.mark ?? <ClaudeMark style={{ color: "currentColor" }} />;

  const [view, setView] = useState<ViewBlock[]>(() => plain(source));
  const [seenKey, setSeenKey] = useState(sourceKey);
  if (seenKey !== sourceKey) { setSeenKey(sourceKey); setView(plain(source)); }
  const [phase, setPhaseState] = useState<AgentCursorPhase>("idle");
  const [status, setStatus] = useState<Status | null>(null);
  const [count, setCount] = useState(0);
  const [docFading, setDocFading] = useState(false);
  const [selection, setSelection] = useState<{ id: number; rects: Rect[]; filled: number } | null>(null);
  const [agentReady, setAgentReady] = useState(false);
  const [humanReady, setHumanReady] = useState(false);
  const [flip, setFlip] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const textRefs = useRef(new Map<string, HTMLElement>());
  const fitRefs = useRef(new Map<string, HTMLElement>());
  const ax = useMotionValue(31);
  const ay = useMotionValue(28.5);
  const hx = useMotionValue(85);
  const hy = useMotionValue(204);
  const runRef = useRef<{ abort: AbortController } | null>(null);
  const held = useRef(false);
  const onScreen = useRef(true);
  const live = useRef({ source, plan, run, speed, reduced, looping, onAccept, onUndo, onPhaseChange, view, agentName: agent.name });
  useEffect(() => { live.current = { source, plan, run, speed, reduced, looping, onAccept, onUndo, onPhaseChange, view, agentName: agent.name }; });

  const setPhase = useCallback((next: AgentCursorPhase) => { setPhaseState(next); live.current.onPhaseChange?.(next); }, []);

  const settle = useCallback((kind: "accepted" | "reverted" | "stopped") => {
    const current = live.current;
    const total = current.view.filter(block => block.pending || block.fix).length;
    const noun = `${total} ${total === 1 ? "edit" : "edits"}`;
    if (kind === "accepted") {
      const next = finalDoc(current.view);
      setView(view => view.map(block => ({ ...block, pending: false })));
      setStatus({ key: "accepted", label: `Accepted ${noun}`, icon: <Check className={styles.success} aria-hidden />, say: `Accepted ${noun}.` });
      current.onAccept?.(next);
    } else {
      setView(plain(current.source));
      setSelection(null);
      setAgentReady(false);
      if (kind === "reverted") {
        setStatus({ key: "reverted", label: `Undid ${noun}`, icon: <Undo2 aria-hidden />, say: `Undid ${noun}.` });
        current.onUndo?.(plain(current.source));
      } else setStatus({ key: "stopped", label: "Stopped", icon: <Square aria-hidden />, say: "Stopped." });
    }
    setPhase(kind);
  }, [setPhase]);

  const start = useCallback(() => {
    runRef.current?.abort.abort();
    const abort = new AbortController();
    runRef.current = { abort };
    const signal = abort.signal;
    const cfg = () => live.current;
    const sleep = (ms: number) => new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Aborted());
      const tick = () => {
        if (signal.aborted) return reject(new Aborted());
        if (!onScreen.current) { window.setTimeout(tick, 200); return; }
        resolve();
      };
      window.setTimeout(tick, cfg().reduced ? Math.min(ms, 60) : ms / cfg().speed);
    });
    const origin = () => rootRef.current!.getBoundingClientRect();
    const home = () => {
      const root = origin();
      const box = avatarRef.current?.getBoundingClientRect();
      return box ? { x: box.left - root.left + box.width / 2, y: box.top - root.top + box.height / 2 } : { x: 31, y: 28.5 };
    };
    const glide = (tx: number, ty: number, fixed?: number) => new Promise<void>(resolve => {
      const sx = ax.get(), sy = ay.get();
      const distance = Math.hypot(tx - sx, ty - sy);
      setFlip(tx > origin().width - 110);
      if (cfg().reduced || distance < 1) { ax.set(tx); ay.set(ty); resolve(); return; }
      const duration = (fixed ?? Math.min(600, Math.max(280, 180 + distance * 1.3))) / 1000 / cfg().speed;
      const bend = Math.min(40, distance * 0.18);
      const cx = (sx + tx) / 2 + ((ty - sy) / distance) * bend;
      const cy = (sy + ty) / 2 - ((tx - sx) / distance) * bend;
      animate(0, 1, {
        duration, ease: fixed ? "linear" : "easeInOut",
        onUpdate: t => { const u = 1 - t; ax.set(u * u * sx + 2 * u * t * cx + t * t * tx); ay.set(u * u * sy + 2 * u * t * cy + t * t * ty); },
        onComplete: () => resolve(),
      });
    });
    const lineRects = (range: Range): Rect[] => {
      const root = origin();
      const lines: Rect[] = [];
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width < 1) continue;
        const top = rect.top - root.top;
        const same = lines.find(line => Math.abs(line.top + line.height / 2 - (top + rect.height / 2)) < rect.height / 2);
        if (same) {
          const right = Math.max(same.left + same.width, rect.right - root.left);
          same.left = Math.min(same.left, rect.left - root.left);
          same.width = right - same.left;
        } else lines.push({ left: rect.left - root.left, top, width: rect.width, height: rect.height });
      }
      const lineHeight = 24;
      return lines.map(line => ({ left: line.left, top: line.top + line.height / 2 - lineHeight / 2, width: line.width, height: lineHeight }));
    };
    const patch = (id: string, change: Partial<ViewBlock> | ((block: ViewBlock) => Partial<ViewBlock>)) =>
      setView(current => current.map(block => (block.id === id ? { ...block, ...(typeof change === "function" ? change(block) : change) } : block)));
    const say = (key: string, label: string, extra: Partial<Status> = {}) => setStatus({ key, label, say: `${label}.`, ...extra });
    const drag = async (rects: Rect[], total: number) => {
      const id = Date.now();
      setSelection({ id, rects, filled: 0 });
      const width = rects.reduce((sum, rect) => sum + rect.width, 0) || 1;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const ms = Math.max(60, (total * rect.width) / width);
        ax.set(rect.left); ay.set(rect.top + rect.height / 2 + 2);
        setSelection({ id, rects, filled: i + 1 });
        await Promise.all([glide(rect.left + rect.width, rect.top + rect.height / 2 + 2, ms), sleep(ms)]);
      }
    };

    const cycle = async (): Promise<boolean> => {
      const original = plain(cfg().source);
      setView(original); setSelection(null); setDocFading(false); setCount(0);
      setPhase("thinking");
      say("reading", "Reading the doc", { busy: true });
      const from = home();
      ax.set(from.x); ay.set(from.y);
      await sleep(230);
      setAgentReady(true);
      const firstParagraph = original.find(block => block.type === "paragraph") ?? original[0];
      const firstNode = firstParagraph && textRefs.current.get(firstParagraph.id);
      if (firstNode) {
        const root = origin();
        const box = firstNode.getBoundingClientRect();
        void glide(box.left - root.left + Math.min(box.width * 0.29, 160), box.top - root.top + 15, 520);
      }
      const fetched = cfg().run ? await Promise.all([cfg().run!(signal), sleep(670)]).then(result => result[0]) : (await sleep(670), cfg().plan);
      if (signal.aborted) throw new Aborted();
      if (!fetched.length) {
        await glide(home().x, home().y);
        setAgentReady(false); setPhase("empty");
        say("empty", "No edits suggested", { icon: <FileText aria-hidden /> });
        return false;
      }
      setPhase("editing");
      let done = 0;
      for (const edit of fetched) {
        if (edit.type === "rewrite") {
          const node = textRefs.current.get(edit.blockId);
          if (!node) continue;
          say(`edit-${done}`, edit.label ?? "Rewriting a paragraph", { busy: true });
          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = lineRects(range);
          if (rects[0]) await Promise.all([glide(rects[0].left, rects[0].top + rects[0].height / 2 + 2), sleep(430)]);
          await drag(rects, 560);
          await sleep(60);
          patch(edit.blockId, { fading: true });
          await sleep(110);
          const chunks = chunkText(edit.text);
          const fromHeight = fitRefs.current.get(edit.blockId)?.offsetHeight;
          patch(edit.blockId, { fading: false, text: edit.text, chunks, shown: cfg().reduced ? chunks.length : 0, pending: true, fromHeight });
          setSelection(null);
          for (let i = 1; i <= chunks.length && !cfg().reduced; i++) {
            await sleep(34);
            patch(edit.blockId, { shown: i });
            const caret = node.querySelector(`.${styles.caretSlot}`)?.getBoundingClientRect();
            if (caret) { const root = origin(); ax.set(caret.left - root.left + 4); ay.set(caret.top - root.top + 14); setFlip(false); }
          }
          await sleep(440);
        } else if (edit.type === "insert") {
          const anchor = fitRefs.current.get(edit.afterId);
          say(`edit-${done}`, edit.label ?? (edit.block.type === "paragraph" ? "Adding a paragraph" : "Adding a heading"), { busy: true });
          if (anchor) {
            const root = origin();
            const box = anchor.getBoundingClientRect();
            const inner = textRefs.current.get(edit.afterId)?.getBoundingClientRect();
            await Promise.all([glide((inner?.left ?? box.left) - root.left, box.bottom - root.top + 28), sleep(530)]);
          }
          setView(current => {
            const index = current.findIndex(block => block.id === edit.afterId);
            const next = current.slice();
            next.splice(index + 1, 0, { ...edit.block, pending: true, inserted: true, visible: cfg().reduced });
            return next;
          });
          await sleep(260);
          patch(edit.block.id, { visible: true });
          await sleep(740);
        } else {
          const node = textRefs.current.get(edit.blockId);
          const text = node?.textContent ?? "";
          const index = text.indexOf(edit.find);
          if (!node || index < 0) continue;
          say(`edit-${done}`, edit.label ?? "Fixing a typo", { busy: true });
          patch(edit.blockId, { fix: { before: text.slice(0, index), find: edit.find, replace: edit.replace, after: text.slice(index + edit.find.length), swapped: false, typo: true } });
          await sleep(30);
          const word = node.querySelector(`.${styles.typo}`);
          if (word) {
            const range = document.createRange();
            range.selectNodeContents(word);
            const rects = lineRects(range);
            if (rects[0]) await Promise.all([glide(rects[0].left, rects[0].top + rects[0].height / 2 + 2), sleep(390)]);
            await drag(rects, 220);
          }
          await sleep(40);
          patch(edit.blockId, block => ({ fix: { ...block.fix!, swapped: true } }));
          await sleep(110);
          patch(edit.blockId, block => ({ fix: { ...block.fix!, typo: false } }));
          setSelection(null);
          await sleep(410);
        }
        done += 1;
        setCount(done);
      }
      setPhase("review");
      const label = `${done} ${done === 1 ? "edit" : "edits"} ready for review`;
      setStatus({ key: "review", label, icon: <Pencil aria-hidden />, say: `${label}.` });
      void glide(home().x, home().y).then(() => { if (!signal.aborted) setAgentReady(false); });
      if (!cfg().looping) return false;
      await sleep(2150);
      while (held.current) await sleep(300);
      settle("accepted");
      await sleep(1900);
      while (held.current) await sleep(300);
      setDocFading(true);
      await sleep(130);
      return true;
    };
    (async () => {
      for (;;) {
        try {
          if (!(await cycle())) return;
        } catch (error) {
          if (error instanceof Aborted || signal.aborted) return;
          setPhase("error");
          const message = error instanceof Error && error.message ? error.message : "Something went wrong";
          setStatus({ key: "error", label: message, icon: <CircleAlert className={styles.danger} aria-hidden />, say: `${message}.` });
          setSelection(null);
          void glide(home().x, home().y).then(() => setAgentReady(false));
          if (!cfg().looping) return;
          await sleep(2500);
          while (held.current) await sleep(300);
        }
      }
    })().catch(() => {});
  }, [ax, ay, setPhase, settle]);

  const finish = (kind: "accepted" | "reverted" | "stopped") => { runRef.current?.abort.abort(); settle(kind); };

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let started = false;
    const begin = () => { if (!started && autoPlay) { started = true; start(); } };
    if (typeof IntersectionObserver === "undefined") { const timer = window.setTimeout(begin, 0); return () => window.clearTimeout(timer); }
    const io = new IntersectionObserver(entries => { onScreen.current = !!entries[0]?.isIntersecting; if (onScreen.current) begin(); });
    io.observe(node);
    return () => { io.disconnect(); runRef.current?.abort.abort(); };
  }, [autoPlay, start]);

  useEffect(() => {
    if (!collaborator) return;
    const root = rootRef.current;
    if (!root) return;
    let anchor = { x: 85, y: 204 };
    const place = () => {
      const target = view.find(block => block.type === "heading") ?? view[0];
      const node = target && textRefs.current.get(target.id);
      if (!node) return;
      const box = node.getBoundingClientRect(), base = root.getBoundingClientRect();
      anchor = { x: Math.min(box.left - base.left + 52, base.width - 90), y: box.top - base.top + box.height * 0.65 };
      hx.set(anchor.x); hy.set(anchor.y);
    };
    place();
    const ready = window.setTimeout(() => setHumanReady(true), 0);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    ro?.observe(root);
    const drift = reduced ? 0 : window.setInterval(() => {
      if (!onScreen.current) return;
      const options = { duration: 0.7, ease: "easeInOut" } as const;
      animate(hx, anchor.x + (Math.random() - 0.5) * 32, options);
      animate(hy, anchor.y + (Math.random() - 0.5) * 10, options);
    }, 3500);
    return () => { window.clearTimeout(ready); ro?.disconnect(); if (drift) window.clearInterval(drift); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaborator, reduced, hx, hy, sourceKey]);

  const working = phase === "thinking" || phase === "editing";
  const title = view.find(block => block.type === "title")?.text ?? "Document";
  const action = working ? { key: "stop", icon: <Square aria-hidden />, label: "Stop", run: () => finish("stopped") }
    : phase === "idle" ? { key: "ask", icon: <Sparkles aria-hidden />, label: `Ask ${agent.name}`, run: start }
    : phase === "error" ? { key: "retry", icon: <RotateCcw aria-hidden />, label: "Retry", run: start }
    : phase === "review" ? null : { key: "again", icon: <RotateCcw aria-hidden />, label: "Run again", run: start };
  const fade = { duration: reduced ? 0 : 0.16 };
  const out = { opacity: 0, transition: { duration: reduced ? 0 : 0.1 } };
  const firstName = collaborator?.name.split(" ")[0];

  return (
    <div
      ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ "--agent": agent.color ?? "#D97757", "--human": collaborator?.color ?? "var(--series-2)" } as CSSProperties}
      onPointerEnter={() => { held.current = true; }} onPointerLeave={() => { held.current = false; }}
      onFocus={() => { held.current = true; }} onBlur={() => { held.current = false; }}
    >
      <div className={styles.header}>
        <div className={styles.stack}>
          <span ref={avatarRef} className={styles.agentAvatar} data-working={working} role="img" aria-label={agent.name}>{mark}</span>
          {collaborator && <Avatar name={collaborator.name} src={collaborator.avatar} size="sm" className={styles.stackAvatar} />}
        </div>
        <div className={styles.status} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {status && (
              <motion.span key={status.key} className={styles.statusInner} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }} exit={out} transition={fade}>
                {status.icon && <span className={styles.statusIcon}>{status.icon}</span>}
                <span className={styles.statusLabel}>{status.busy ? <TextShimmer>{status.label}</TextShimmer> : status.label}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {status ? `${status.say}${isSimulated && !status.busy ? " Simulated, nothing was saved." : ""}` : ""}
        </span>
        <div className={styles.action}>
          <AnimatePresence initial={false} mode="popLayout">
            {action && (
              <motion.span key={action.key === "stop" || action.key === "again" ? "toggle" : action.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={out} transition={fade}>
                <Button variant="ghost" size="sm" onClick={action.run}><span className={styles.buttonInner}>{action.icon}{action.label}</span></Button>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className={styles.selectionLayer} aria-hidden="true">
        {selection && (
          <div key={selection.id}>
            {selection.rects.map((rect, index) => (
              <motion.span
                key={index} className={styles.selection} style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                initial={{ scaleX: reduced ? 1 : 0 }} animate={{ scaleX: index < selection.filled ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : Math.max(0.06, (0.56 * rect.width) / (selection.rects.reduce((sum, item) => sum + item.width, 0) || 1)) / speed, ease: "linear" }}
              />
            ))}
          </div>
        )}
      </div>
      <article className={styles.doc} data-fading={docFading} aria-label={title} aria-busy={working}>
        <AnimatePresence initial={false}>
          {view.map(block => {
            const Tag = block.type === "title" ? "h3" : block.type === "heading" ? "h4" : "p";
            const textClass = block.type === "title" ? styles.title : block.type === "heading" ? styles.heading : styles.paragraph;
            const shown = block.shown ?? 0;
            return (
              <div key={block.id} className={styles.block} data-type={block.type}>
                <motion.div
                  key={block.fromHeight ? "rewritten" : "base"} className={styles.fit}
                  ref={node => { if (node) fitRefs.current.set(block.id, node); else fitRefs.current.delete(block.id); }}
                  initial={block.inserted ? { height: 0 } : block.fromHeight ? { height: block.fromHeight } : false}
                  animate={{ height: "auto" }} transition={reduced ? { duration: 0 } : SPRING}
                >
                  <div>
                    <div className={styles.pad}>
                      <Tag
                        className={textClass} data-fading={!!block.fading}
                        ref={(node: HTMLElement | null) => { if (node) textRefs.current.set(block.id, node); else textRefs.current.delete(block.id); }}
                      >
                        {block.chunks ? (
                          <>
                            {block.chunks.map((chunk, index) => [
                              index === shown && shown > 0 ? <span key="caret" className={styles.caretSlot}><span className={styles.caret} /></span> : null,
                              <span key={index} className={styles.chunk} data-shown={index < shown} data-pending={!!block.pending}>{chunk}</span>,
                            ])}
                          </>
                        ) : block.fix ? (
                          <>
                            {block.fix.before}
                            <span className={styles.swap}>
                              {block.fix.typo && <span className={styles.typo} data-pending="false" style={{ opacity: block.fix.swapped ? 0 : 1, transition: "opacity 110ms ease-out" }}>{block.fix.find}</span>}
                              {block.fix.swapped && <motion.span className={styles.tint} data-pending={!!block.pending || phase === "editing" || phase === "review"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.14 }}>{block.fix.replace}</motion.span>}
                            </span>
                            {block.fix.after}
                          </>
                        ) : (
                          <span className={styles.tint} data-pending={!!block.pending} style={{ opacity: block.inserted && !block.visible ? 0 : 1 }}>{block.text}</span>
                        )}
                      </Tag>
                    </div>
                    {block.type === "title" && metaLine && <div className={styles.meta}>{metaLine}</div>}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>
      </article>
      <div className={styles.barWrap}>
        <AnimatePresence>
          {phase === "review" && (
            <motion.div
              className={styles.bar} role="group" aria-label="Review edits" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 8 }} transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.barLabel}>
                <span className={styles.barMark}>{mark}</span>
                <span className={styles.barCount}>{count} {count === 1 ? "edit" : "edits"}<span className={styles.barBy}> by {agent.name}</span></span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => finish("reverted")}><span className={styles.buttonInner}><Undo2 aria-hidden />Undo</span></Button>
              <Button variant="primary" size="sm" onClick={() => finish("accepted")}><span className={styles.buttonInner}><Check aria-hidden />Accept changes</span></Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={styles.cursorLayer} aria-hidden="true">
        {collaborator && (
          <Cursor x={hx} y={hy} color="var(--human)" ready={humanReady} agent={false} flip={false}>
            {collaborator.avatar && <span className={styles.tagAvatar} style={{ backgroundImage: `url("${collaborator.avatar}")`, backgroundSize: "cover" }} />}
            {firstName}
          </Cursor>
        )}
        <Cursor x={ax} y={ay} color="var(--agent)" ready={agentReady} agent flip={flip}>
          <span className={styles.tagMark}>{mark}</span>
          {agent.name}
        </Cursor>
      </div>
    </div>
  );
}

export default AgentCursor;
