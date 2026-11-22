"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, CircleCheck, FilePlus2, Info, Send, Shrink, TriangleAlert } from "lucide-react";
import { Button } from "../button/button";
import styles from "./context-window.module.css";

export type ContextCategory = "system" | "tools" | "files" | "summary" | "messages";
export type ContextModelMark = "claude" | "moonshot" | "openai";

export interface ContextModel {
  id: string;
  name: string;
  /** Context window in tokens. */
  window: number;
  /** Tokens held back for the reply. */
  reserve: number;
  /** A built-in mark id or your own 16px node. */
  mark: ContextModelMark | ReactNode;
  /** Color for a built-in mark. */
  color?: string;
}
export interface ContextItem { id: string; category: ContextCategory; label: string; tokens: number; }
export interface ContextTurn { label: string; tokens: number; }
export interface ContextCompaction { folded: number; summary: number; before: number; after: number; automatic: boolean; }

export interface ContextWindowProps {
  models?: ContextModel[];
  defaultModelId?: string;
  onModelChange?: (model: ContextModel) => void;
  items?: ContextItem[];
  threshold?: number;
  turns?: ContextTurn[];
  files?: ContextTurn[];
  summarize?: (folded: ContextItem[]) => number;
  onCompact?: (compaction: ContextCompaction) => void;
  onItemsChange?: (items: ContextItem[]) => void;
  className?: string;
}

const markPaths: Record<ContextModelMark, { label: string; node: ReactNode; evenodd?: boolean }> = {
  claude: { label: "Claude", node: <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" /> },
  moonshot: { label: "Moonshot AI", evenodd: true, node: <path d="M1.052 16.916l9.539 2.552a21.007 21.007 0 00.06 2.033l5.956 1.593a11.997 11.997 0 01-5.586.865l-.18-.016-.044-.004-.084-.009-.094-.01a11.605 11.605 0 01-.157-.02l-.107-.014-.11-.016a11.962 11.962 0 01-.32-.051l-.042-.008-.075-.013-.107-.02-.07-.015-.093-.019-.075-.016-.095-.02-.097-.023-.094-.022-.068-.017-.088-.022-.09-.024-.095-.025-.082-.023-.109-.03-.062-.02-.084-.025-.093-.028-.105-.034-.058-.019-.08-.026-.09-.031-.066-.024a6.293 6.293 0 01-.044-.015l-.068-.025-.101-.037-.057-.022-.08-.03-.087-.035-.088-.035-.079-.032-.095-.04-.063-.028-.063-.027a5.655 5.655 0 01-.041-.018l-.066-.03-.103-.047-.052-.024-.096-.046-.062-.03-.084-.04-.086-.044-.093-.047-.052-.027-.103-.055-.057-.03-.058-.032a6.49 6.49 0 01-.046-.026l-.094-.053-.06-.034-.051-.03-.072-.041-.082-.05-.093-.056-.052-.032-.084-.053-.061-.039-.079-.05-.07-.047-.053-.035a7.785 7.785 0 01-.054-.036l-.044-.03-.044-.03a6.066 6.066 0 01-.04-.028l-.057-.04-.076-.054-.069-.05-.074-.054-.056-.042-.076-.057-.076-.059-.086-.067-.045-.035-.064-.052-.074-.06-.089-.073-.046-.039-.046-.039a7.516 7.516 0 01-.043-.037l-.045-.04-.061-.053-.07-.062-.068-.06-.062-.058-.067-.062-.053-.05-.088-.084a13.28 13.28 0 01-.099-.097l-.029-.028-.041-.042-.069-.07-.05-.051-.05-.053a6.457 6.457 0 01-.168-.179l-.08-.088-.062-.07-.071-.08-.042-.049-.053-.062-.058-.068-.046-.056a7.175 7.175 0 01-.027-.033l-.045-.055-.066-.082-.041-.052-.05-.064-.02-.025a11.99 11.99 0 01-1.44-2.402zm-1.02-5.794l11.353 3.037a20.468 20.468 0 00-.469 2.011l10.817 2.894a12.076 12.076 0 01-1.845 2.005L.657 15.923l-.016-.046-.035-.104a11.965 11.965 0 01-.05-.153l-.007-.023a11.896 11.896 0 01-.207-.741l-.03-.126-.018-.08-.021-.097-.018-.081-.018-.09-.017-.084-.018-.094c-.026-.141-.05-.283-.071-.426l-.017-.118-.011-.083-.013-.102a12.01 12.01 0 01-.019-.161l-.005-.047a12.12 12.12 0 01-.034-2.145zm1.593-5.15l11.948 3.196c-.368.605-.705 1.231-1.01 1.875l11.295 3.022c-.142.82-.368 1.612-.668 2.365l-11.55-3.09L.124 10.26l.015-.1.008-.049.01-.067.015-.087.018-.098c.026-.148.056-.295.088-.442l.028-.124.02-.085.024-.097c.022-.09.045-.18.07-.268l.028-.102.023-.083.03-.1.025-.082.03-.096.026-.082.031-.095a11.896 11.896 0 011.01-2.232zm4.442-4.4L17.352 4.59a20.77 20.77 0 00-1.688 1.721l7.823 2.093c.267.852.442 1.744.513 2.665L2.106 5.213l.045-.065.027-.04.04-.055.046-.065.055-.076.054-.072.064-.086.05-.065.057-.073.055-.07.06-.074.055-.069.065-.077.054-.066.066-.077.053-.06.072-.082.053-.06.067-.074.054-.058.073-.078.058-.06.063-.067.168-.17.1-.098.059-.056.076-.071a12.084 12.084 0 012.272-1.677zM12.017 0h.097l.082.001.069.001.054.002.068.002.046.001.076.003.047.002.06.003.054.002.087.005.105.007.144.011.088.007.044.004.077.008.082.008.047.005.102.012.05.006.108.014.081.01.042.006.065.01.207.032.07.012.065.011.14.026.092.018.11.022.046.01.075.016.041.01L14.7.3l.042.01.065.015.049.012.071.017.096.024.112.03.113.03.113.032.05.015.07.02.078.024.073.023.05.016.05.016.076.025.099.033.102.036.048.017.064.023.093.034.11.041.116.045.1.04.047.02.06.024.041.018.063.026.04.018.057.025.11.048.1.046.074.035.075.036.06.028.092.046.091.045.102.052.053.028.049.026.046.024.06.033.041.022.052.029.088.05.106.06.087.051.057.034.053.032.096.059.088.055.098.062.036.024.064.041.084.056.04.027.062.042.062.043.023.017c.054.037.108.075.161.114l.083.06.065.048.056.043.086.065.082.064.04.03.05.041.086.069.079.065.085.071c.712.6 1.353 1.283 1.909 2.031L7.222.994l.062-.027.065-.028.081-.034.086-.035c.113-.045.227-.09.341-.131l.096-.035.093-.033.084-.03.096-.031c.087-.03.176-.058.264-.085l.091-.027.086-.025.102-.03.085-.023.1-.026L9.04.37l.09-.023.091-.022.095-.022.09-.02.098-.021.091-.02.095-.018.092-.018.1-.018.091-.016.098-.017.092-.014.097-.015.092-.013.102-.013.091-.012.105-.012.09-.01.105-.01c.093-.01.186-.018.28-.024l.106-.008.09-.005.11-.006.093-.004.1-.004.097-.002.099-.002.197-.002z" /> },
  openai: { label: "OpenAI", node: <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" /> },
};

function ModelMark({ model }: { model: ContextModel }) {
  if (typeof model.mark !== "string" || !(model.mark in markPaths)) return <>{model.mark}</>;
  const mark = markPaths[model.mark as ContextModelMark];
  return <svg viewBox="0 0 24 24" fill="currentColor" fillRule={mark.evenodd ? "evenodd" : undefined} role="img" aria-label={mark.label} className={styles.modelMark} aria-hidden="true" focusable="false" style={model.color ? { color: model.color } : undefined}>{mark.node}</svg>;
}

export const sampleModels: ContextModel[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", window: 1_000_000, reserve: 64_000, mark: "claude", color: "rgb(217, 119, 87)" },
  { id: "kimi-k3", name: "Kimi K3", window: 512_000, reserve: 32_000, mark: "moonshot" },
  { id: "gpt-6-luna", name: "GPT-6 Luna", window: 400_000, reserve: 32_000, mark: "openai" },
];

const sampleMessageSizes = [9_800, 14_200, 11_600, 8_400, 16_900, 12_300, 10_700, 13_500, 9_100, 15_800, 12_900, 11_200, 14_600, 8_900, 13_100, 10_400, 12_700, 15_200, 9_600, 11_900, 13_800, 9_900, 12_200, 12_300];
export const sampleItems: ContextItem[] = [
  { id: "system", category: "system", label: "System prompt", tokens: 4_100 },
  { id: "tools-github", category: "tools", label: "GitHub MCP", tokens: 14_000 },
  { id: "tools-linear", category: "tools", label: "Linear MCP", tokens: 9_500 },
  { id: "tools-sentry", category: "tools", label: "Sentry MCP", tokens: 8_500 },
  { id: "file-billing", category: "files", label: "src/billing/invoices.ts", tokens: 46_000 },
  { id: "file-schema", category: "files", label: "db/schema.sql", tokens: 38_000 },
  { id: "memory", category: "files", label: "Project memory", tokens: 16_000 },
  ...sampleMessageSizes.map((tokens, index): ContextItem => ({ id: `message-${index + 1}`, category: "messages", label: `Message ${index + 1}`, tokens })),
];
export const sampleTurns: ContextTurn[] = [
  { label: "Retry failed invoices with backoff", tokens: 31_400 },
  { label: "Add tests for the retry schedule", tokens: 27_900 },
  { label: "Explain the failing Sentry event", tokens: 36_100 },
  { label: "Update the migration for retry_count", tokens: 24_700 },
  { label: "Summarize the changes for the PR", tokens: 19_200 },
];
export const sampleFiles: ContextTurn[] = [
  { label: "api/openapi.yaml", tokens: 64_000 },
  { label: "docs/billing-runbook.md", tokens: 22_000 },
  { label: "src/billing/retry.ts", tokens: 18_500 },
];

const CELLS = 200, COLUMNS = 20, KEEP = 2;
type Kind = ContextCategory | "free" | "reserve";
const categories: { kind: ContextCategory; name: string }[] = [
  { kind: "system", name: "System prompt" }, { kind: "tools", name: "Tools" }, { kind: "files", name: "Files and memory" }, { kind: "summary", name: "Summary" }, { kind: "messages", name: "Messages" },
];

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${+(tokens / 1_000_000).toFixed(1)}M`;
  const k = tokens / 1000;
  return Math.round(k) >= 10 ? `${Math.round(k)}K` : `${+k.toFixed(1)}K`;
}
function formatPercent(value: number): string { return Math.round(value) >= 10 ? `${Math.round(value)}%` : `${+value.toFixed(1)}%`; }

/** Rolls a number to its new value; the text is formatted on every frame. */
function Roll({ value, format, reduced }: { value: number; format: (value: number) => string; reduced: boolean }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - began) / 420), eased = 1 - Math.pow(1 - t, 4);
      const next = t >= 1 ? value : start + (value - start) * eased;
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <>{format(shown)}</>;
}

type Tone = "info" | "warning" | "working" | "success";
interface Status { tone: Tone; text: string; }
const toneIcon = { info: Info, warning: TriangleAlert, working: Shrink, success: CircleCheck } as const;

function layout(totals: Record<ContextCategory, number>, model: ContextModel): Kind[] {
  const cell = model.window / CELLS;
  const reserveCells = Math.min(CELLS, Math.ceil(model.reserve / cell));
  const limit = CELLS - reserveCells;
  const kinds: Kind[] = [];
  let sum = 0;
  for (const { kind } of categories) {
    sum += totals[kind];
    let end = Math.min(limit, Math.round(sum / cell));
    if (totals[kind] > 0 && end <= kinds.length && kinds.length < limit) end = kinds.length + 1;
    while (kinds.length < end) kinds.push(kind);
  }
  while (kinds.length < limit) kinds.push("free");
  while (kinds.length < CELLS) kinds.push("reserve");
  return kinds;
}

function wave(previous: Kind[] | null, next: Kind[]): number[] {
  let first = 0, last = CELLS - 1;
  if (previous) {
    first = next.findIndex((kind, index) => kind !== previous[index]);
    if (first < 0) return next.map(() => 0);
    for (last = CELLS - 1; last > first && next[last] === previous[last]; last--);
  }
  const step = Math.min(9, Math.max(4, 360 / (last - first + 1)));
  return next.map((_, index) => Math.round(Math.min(360, Math.max(0, (index - first) * step))));
}

export function ContextWindow({ models = sampleModels, defaultModelId, onModelChange, items: initialItems = sampleItems, threshold = .8, turns = sampleTurns, files = sampleFiles, summarize, onCompact, onItemsChange, className }: ContextWindowProps) {
  const reduced = !!useReducedMotion();
  const [modelId, setModelId] = useState(defaultModelId ?? models[0]?.id);
  const model = models.find(item => item.id === modelId) ?? models[0];
  const [items, setItems] = useState(initialItems);
  const [phase, setPhase] = useState<"idle" | "pending" | "summarizing">("idle");
  const thresholdLabel = `${Math.round(threshold * 100)}%`;
  const [status, setStatus] = useState<Status>({ tone: "info", text: `Compacts on its own at ${thresholdLabel}` });
  const [hover, setHover] = useState<Kind | null>(null);
  const turnIndex = useRef(0), fileIndex = useRef(0), serial = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { const pending = timers.current; return () => pending.forEach(clearTimeout); }, []);
  const later = (run: () => void, ms: number) => { timers.current.push(setTimeout(run, reduced ? Math.min(ms, 120) : ms)); };

  const totals = useMemo(() => {
    const sums: Record<ContextCategory, number> = { system: 0, tools: 0, files: 0, summary: 0, messages: 0 };
    for (const item of items) sums[item.category] += item.tokens;
    return sums;
  }, [items]);
  const used = totals.system + totals.tools + totals.files + totals.summary + totals.messages;
  const free = Math.max(0, model.window - used - model.reserve);
  const kinds = useMemo(() => layout(totals, model), [totals, model]);
  // The wave starts at the first cell that changed. Derived while rendering so the delays land with the new colors.
  const [grid, setGrid] = useState(() => ({ kinds, delays: wave(null, kinds) }));
  if (grid.kinds !== kinds) setGrid({ kinds, delays: wave(grid.kinds, kinds) });
  const delays = grid.kinds === kinds ? grid.delays : wave(grid.kinds, kinds);

  const messageCount = items.filter(item => item.category === "messages").length;
  const canCompact = messageCount > KEEP;
  const thresholdCell = Math.round(threshold * CELLS);
  const firstMessageCell = kinds.indexOf("messages");
  const messageCells = kinds.filter(kind => kind === "messages").length;

  const commit = useCallback((next: ContextItem[]) => { setItems(next); onItemsChange?.(next); }, [onItemsChange]);
  const sumOf = (list: ContextItem[]) => list.reduce((sum, item) => sum + item.tokens, 0);

  const compact = (current: ContextItem[], automatic: boolean, prefix: string) => {
    const messages = current.filter(item => item.category === "messages");
    const folded = messages.slice(0, Math.max(0, messages.length - KEEP));
    if (!folded.length) { setPhase("idle"); return; }
    setPhase("summarizing");
    setStatus({ tone: "working", text: `${prefix}Summarizing ${folded.length} older messages` });
    later(() => {
      const foldedTokens = sumOf(folded);
      const summary = summarize ? summarize(folded) : Math.ceil(Math.min(24_000, Math.max(4_000, foldedTokens * .06)) / 1000) * 1000;
      const gone = new Set(folded.map(item => item.id));
      const existing = current.find(item => item.category === "summary");
      const rest = current.filter(item => !gone.has(item.id) && item.category !== "summary");
      const summaryItem: ContextItem = { id: existing?.id ?? "summary", category: "summary", label: "Summary of earlier messages", tokens: (existing?.tokens ?? 0) + summary };
      const at = rest.findIndex(item => item.category === "messages");
      const next = at < 0 ? [...rest, summaryItem] : [...rest.slice(0, at), summaryItem, ...rest.slice(at)];
      const before = sumOf(current);
      commit(next);
      setPhase("idle");
      setStatus({ tone: "success", text: `Compacted ${formatTokens(foldedTokens)} of messages into a ${formatTokens(summary)} summary` });
      onCompact?.({ folded: foldedTokens, summary, before, after: sumOf(next), automatic });
    }, 740);
  };

  const add = (category: "messages" | "files", entry: ContextTurn, text: string) => {
    const item: ContextItem = { id: `${category}-added-${++serial.current}`, category, label: entry.label, tokens: entry.tokens };
    const at = category === "files" ? items.findLastIndex(existing => existing.category === "files") + 1 : items.length;
    const next = category === "files" && at > 0 ? [...items.slice(0, at), item, ...items.slice(at)] : [...items, item];
    commit(next);
    const total = sumOf(next);
    const line = `${text} · +${formatTokens(entry.tokens)}`;
    if (total > threshold * model.window && next.filter(existing => existing.category === "messages").length > KEEP) {
      setPhase("pending");
      setStatus({ tone: "warning", text: `${line}. Crossed ${thresholdLabel}` });
      later(() => compact(next, true, `Crossed ${thresholdLabel}. `), 560);
    } else if (total >= (threshold - .15) * model.window) {
      setStatus({ tone: "warning", text: `${line}. Compaction runs at ${thresholdLabel}` });
    } else {
      setStatus({ tone: "info", text: line });
    }
  };
  const send = () => { if (!turns.length) return; const turn = turns[turnIndex.current++ % turns.length]; add("messages", turn, `Sent "${turn.label}"`); };
  const attach = () => { if (!files.length) return; const file = files[fileIndex.current++ % files.length]; add("files", file, `Attached ${file.label}`); };

  const changeModel = (id: string) => {
    const next = models.find(item => item.id === id);
    if (!next || next.id === model.id) return;
    setModelId(id);
    onModelChange?.(next);
    if (used > threshold * next.window && canCompact) {
      setPhase("pending");
      setStatus({ tone: "warning", text: `${formatTokens(used)} is over ${thresholdLabel} of ${next.name}'s window` });
      later(() => compact(items, true, `Too full for ${next.name}. `), 600);
    } else {
      setStatus({ tone: "info", text: `Switched to ${next.name} · ${formatTokens(next.window)} window` });
    }
  };

  const busy = phase !== "idle";
  const percent = (tokens: number) => tokens / model.window * 100;
  const rows: { kind: Kind; name: string; tokens: number }[] = [
    ...categories.map(category => ({ kind: category.kind as Kind, name: category.name, tokens: totals[category.kind] })),
    { kind: "free", name: "Free", tokens: free },
    { kind: "reserve", name: "Reserved for output", tokens: model.reserve },
  ];
  const description = `${model.name} context window, ${formatTokens(used)} of ${formatTokens(model.window)} tokens used. ${rows.map(row => `${row.name} ${row.kind === "summary" && !row.tokens ? "none yet" : formatTokens(row.tokens)}`).join(", ")}. Compaction starts at ${thresholdLabel}.`;
  const StatusIcon = toneIcon[status.tone];

  const cells: ReactNode[] = [];
  kinds.forEach((kind, index) => {
    if (index === thresholdCell) cells.push(<div key="threshold" className={styles.threshold} aria-hidden="true" />);
    const style = { "--delay": `${reduced ? 0 : delays[index]}ms`, ...(phase === "summarizing" && kind === "messages" ? { "--sweep": `${Math.round((index - firstMessageCell) * Math.min(6, 240 / Math.max(1, messageCells)))}ms` } : null) } as CSSProperties;
    cells.push(<span key={index} className={styles.cell} data-kind={kind} data-after={kind === "free" && index >= thresholdCell ? "" : undefined} style={style} />);
  });

  return (
    <section className={`${styles.root} ${className ?? ""}`} data-phase={phase === "summarizing" ? "summarizing" : "idle"} data-hover={hover ?? undefined} aria-label="Context window">
      <header className={styles.header}>
        <div className={styles.readout}>
          <p className={styles.used}>
            <span className={styles.usedValue}><Roll value={used} format={formatTokens} reduced={reduced} /></span>
            <span className={styles.usedOf}>of {formatTokens(model.window)} tokens</span>
          </p>
          <p className={styles.usedMeta}>
            <span className={styles.tabular}><Roll value={percent(used)} format={value => `${Math.round(value)}%`} reduced={reduced} /> used</span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.tabular}><Roll value={free} format={formatTokens} reduced={reduced} /> free</span>
          </p>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild disabled={busy}>
            <button className={styles.modelTrigger} type="button" aria-label={`Model: ${model.name}, ${formatTokens(model.window)} context. Change model`}>
              <ModelMark model={model} />
              <span className={styles.modelName}>{model.name}</span>
              <span className={styles.modelWindow}>{formatTokens(model.window)}</span>
              <ChevronDown className={styles.modelChevron} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
              <DropdownMenu.RadioGroup value={model.id} onValueChange={changeModel}>
                {models.map(item => (
                  <DropdownMenu.RadioItem key={item.id} className={styles.menuItem} value={item.id}>
                    <ModelMark model={item} />
                    <span className={styles.menuName}>{item.name}</span>
                    <span className={styles.menuWindow}>{formatTokens(item.window)}</span>
                    <span className={styles.menuCheck}><DropdownMenu.ItemIndicator><Check aria-hidden="true" /></DropdownMenu.ItemIndicator></span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <div className={styles.body}>
        <div className={styles.gridWrap}>
          <div className={styles.grid} role="img" aria-label={description} style={{ "--columns": COLUMNS } as CSSProperties}>{cells}</div>
          <p className={styles.gridNote}>
            <span>Each cell is {formatTokens(model.window / CELLS)} tokens</span>
            <span className={styles.thresholdKey}><span className={styles.thresholdSwatch} aria-hidden="true" />Compacts at {Math.round(threshold * 100)}%</span>
          </p>
        </div>
        <ul className={styles.legend} aria-label="What fills the window">
          {rows.map(row => {
            const empty = row.kind === "summary" && row.tokens === 0;
            return (
              <li key={row.kind} className={styles.legendRow} data-kind={row.kind} data-empty={empty ? "true" : undefined} onPointerEnter={() => setHover(row.kind)} onPointerLeave={() => setHover(current => current === row.kind ? null : current)}>
                <span className={styles.swatch} data-kind={row.kind} aria-hidden="true" />
                <span className={styles.legendName}>{row.name}</span>
                <span className={styles.legendTokens}>{empty ? "None yet" : <Roll value={row.tokens} format={formatTokens} reduced={reduced} />}</span>
                <span className={styles.legendPercent}>{empty ? null : <Roll value={percent(row.tokens)} format={formatPercent} reduced={reduced} />}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className={styles.footer}>
        <div className={styles.actions}>
          <Button variant="primary" size="sm" disabled={busy} onClick={send}><Send aria-hidden="true" />Send message</Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={attach}><FilePlus2 aria-hidden="true" />Attach file</Button>
          <Button variant="ghost" size="sm" className={styles.compact} disabled={busy || !canCompact} onClick={() => compact(items, false, "")}><Shrink aria-hidden="true" />Compact now</Button>
        </div>
        <div className={styles.statusSlot} role="status" aria-live="polite">
          <AnimatePresence initial={false}>
            <motion.p key={status.text} className={styles.status} data-tone={status.tone} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease: [.16, 1, .3, 1] } }} exit={{ opacity: 0, y: reduced ? 0 : -4, transition: { duration: reduced ? 0 : .1 } }}>
              <StatusIcon className={styles.statusIcon} aria-hidden="true" />
              <span>{status.text}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </footer>
    </section>
  );
}

export default ContextWindow;
