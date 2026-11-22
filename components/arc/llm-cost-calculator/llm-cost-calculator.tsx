"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import styles from "./llm-cost-calculator.module.css";

export interface LlmModelPrice {
  id: string;
  name: string;
  provider: string;
  mark?: ReactNode;
  input: number;
  cachedInput?: number;
  output: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  requestsPerDay: number;
  cached: boolean;
}

export interface LlmUsagePreset {
  id: string;
  label: string;
  usage: LlmUsage;
}

export interface LlmCostBreakdown {
  input: number;
  cachedInput: number;
  output: number;
  total: number;
  perRequest: number;
}

export interface LlmCostCalculatorProps {
  models?: LlmModelPrice[];
  usage?: LlmUsage;
  defaultUsage?: LlmUsage;
  onUsageChange?: (usage: LlmUsage) => void;
  selected?: string;
  defaultSelected?: string;
  onSelectedChange?: (id: string, model: LlmModelPrice) => void;
  presets?: LlmUsagePreset[] | false;
  cacheHitRate?: number;
  daysPerMonth?: number;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  title?: string;
  description?: string;
  note?: string;
  className?: string;
}

const INPUT_STOPS = [250, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 200_000];
const OUTPUT_STOPS = [100, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000];
const REQUEST_STOPS = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

const ROW_SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" style={{ color: "#D97757" }}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenaiMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="OpenAI">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Gemini">
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C7EFF" />
          <stop offset="50%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#${id}-g)`}
      />
    </svg>
  );
}

function DeepseekMark() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="DeepSeek" fill="#4D6BFE">
      <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308z" />
    </svg>
  );
}

export const llmCostSampleModels: LlmModelPrice[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    mark: <ClaudeMark />,
    input: 5,
    cachedInput: 0.5,
    output: 25,
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    mark: <ClaudeMark />,
    input: 3,
    cachedInput: 0.3,
    output: 15,
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "Anthropic",
    mark: <ClaudeMark />,
    input: 1,
    cachedInput: 0.1,
    output: 5,
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    mark: <OpenaiMark />,
    input: 2.5,
    cachedInput: 0.25,
    output: 20,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "OpenAI",
    mark: <OpenaiMark />,
    input: 0.25,
    cachedInput: 0.025,
    output: 3,
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "Google",
    mark: <GeminiMark />,
    input: 2,
    cachedInput: 0.5,
    output: 12,
  },
  {
    id: "gemini-3-8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
    mark: <GeminiMark />,
    input: 0.3,
    cachedInput: 0.075,
    output: 2.5,
  },
  {
    id: "deepseek-v4-1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    mark: <DeepseekMark />,
    input: 0.2,
    cachedInput: 0.02,
    output: 0.8,
  },
];

export const llmCostPresets: LlmUsagePreset[] = [
  {
    id: "chat",
    label: "Chat",
    usage: { inputTokens: 2_000, outputTokens: 500, requestsPerDay: 10_000, cached: false },
  },
  {
    id: "rag",
    label: "RAG",
    usage: { inputTokens: 16_000, outputTokens: 500, requestsPerDay: 5_000, cached: true },
  },
  {
    id: "agent",
    label: "Agent",
    usage: { inputTokens: 64_000, outputTokens: 2_000, requestsPerDay: 2_500, cached: true },
  },
  {
    id: "batch",
    label: "Batch",
    usage: { inputTokens: 8_000, outputTokens: 250, requestsPerDay: 50_000, cached: false },
  },
];

const DEFAULT_USAGE: LlmUsage = llmCostPresets[1].usage;

export function computeLlmCost(
  model: Pick<LlmModelPrice, "input" | "cachedInput" | "output">,
  usage: LlmUsage,
  options?: { cacheHitRate?: number; daysPerMonth?: number }
): LlmCostBreakdown {
  const days = options?.daysPerMonth ?? 30;
  const hitRate = Math.min(1, Math.max(0, options?.cacheHitRate ?? 0.6));
  const monthlyRequests = Math.max(0, usage.requestsPerDay) * days;
  const totalInputM = (Math.max(0, usage.inputTokens) * monthlyRequests) / 1_000_000;
  const totalOutputM = (Math.max(0, usage.outputTokens) * monthlyRequests) / 1_000_000;

  const cachedShare = usage.cached ? hitRate : 0;
  const uncachedInputM = totalInputM * (1 - cachedShare);
  const cachedInputM = totalInputM * cachedShare;
  const cachedRate = model.cachedInput ?? model.input;

  const input = uncachedInputM * model.input;
  const cachedInput = cachedInputM * cachedRate;
  const output = totalOutputM * model.output;
  const total = input + cachedInput + output;
  const perRequest = monthlyRequests > 0 ? total / monthlyRequests : 0;

  return { input, cachedInput, output, total, perRequest };
}

function nearestStopIndex(stops: number[], value: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const dist = Math.abs(Math.log(Math.max(1, stops[i])) - Math.log(Math.max(1, value)));
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function formatMoney(value: number, compact = false): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (compact && value >= 100_000) {
    if (value >= 1_000_000) {
      const m = value / 1_000_000;
      return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
    }
    const k = value / 1_000;
    return `$${Math.round(k)}K`;
  }
  if (value >= 100) {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(3)}`;
  }
  return `$${value.toFixed(4)}`;
}

function formatPerRequest(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.000";
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.001) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

function formatRate(rate: number): string {
  if (rate >= 1 || rate === 0) return `$${rate.toFixed(2)}`;
  const two = rate.toFixed(2);
  if (Number(two) === rate) return `$${two}`;
  return `$${rate.toFixed(3)}`;
}

function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(value);
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      mv.set(value);
      node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.24,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) {
          ref.current.textContent = formatRef.current(latest);
        }
      },
    });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

const SKELETON_NAME_WIDTHS = ["58%", "66%", "52%", "62%", "48%", "60%", "56%", "54%"];
const SKELETON_BAR_WIDTHS = ["24%", "34%", "42%", "54%", "66%", "78%", "88%", "100%"];

export function LlmCostCalculator({
  models = llmCostSampleModels,
  usage: controlledUsage,
  defaultUsage = DEFAULT_USAGE,
  onUsageChange,
  selected: controlledSelected,
  defaultSelected,
  onSelectedChange,
  presets = llmCostPresets,
  cacheHitRate = 0.6,
  daysPerMonth = 30,
  loading = false,
  error,
  onRetry,
  title = "Estimated monthly cost",
  description = "Sample list prices per 1M tokens, October 2026",
  note = "Sample prices for illustration, not a quote. Calculated in your browser, nothing was sent.",
  className,
}: LlmCostCalculatorProps) {
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const reduced = useReducedMotion();

  const [uncontrolledUsage, setUncontrolledUsage] = useState<LlmUsage>(defaultUsage);
  const usage = controlledUsage ?? uncontrolledUsage;

  const setUsage = (next: LlmUsage) => {
    if (!controlledUsage) {
      setUncontrolledUsage(next);
    }
    onUsageChange?.(next);
  };

  const ranked = useMemo(() => {
    const items = models.map((model) => ({
      model,
      cost: computeLlmCost(model, usage, { cacheHitRate, daysPerMonth }),
    }));
    items.sort((a, b) => a.cost.total - b.cost.total || a.model.name.localeCompare(b.model.name));
    return items;
  }, [models, usage, cacheHitRate, daysPerMonth]);

  const maxCost = useMemo(() => {
    if (ranked.length === 0) return 1;
    return Math.max(0.0001, ranked[ranked.length - 1].cost.total);
  }, [ranked]);

  const defaultSelectedId = defaultSelected ?? models[1]?.id ?? models[0]?.id ?? "";
  const [uncontrolledSelected, setUncontrolledSelected] = useState<string>(defaultSelectedId);
  const rawSelectedId = controlledSelected ?? uncontrolledSelected;

  const activeEntry = useMemo(() => {
    if (ranked.length === 0) return undefined;
    return ranked.find((r) => r.model.id === rawSelectedId) ?? ranked[0];
  }, [ranked, rawSelectedId]);

  const activeRank = activeEntry
    ? ranked.findIndex((r) => r.model.id === activeEntry.model.id) + 1
    : 0;

  const selectModel = (model: LlmModelPrice) => {
    if (controlledSelected === undefined) {
      setUncontrolledSelected(model.id);
    }
    onSelectedChange?.(model.id, model);
  };

  const activePresetId = useMemo(() => {
    if (presets === false) return "";
    const match = presets.find(
      (p) =>
        p.usage.inputTokens === usage.inputTokens &&
        p.usage.outputTokens === usage.outputTokens &&
        p.usage.requestsPerDay === usage.requestsPerDay &&
        p.usage.cached === usage.cached
    );
    return match ? match.id : "custom";
  }, [presets, usage]);

  const presetOptions = useMemo(() => {
    if (presets === false) return [];
    return [...presets.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom" }];
  }, [presets]);

  // Debounced polite announcement
  const [announcement, setAnnouncement] = useState("");
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (loading || error || !activeEntry) return;
    const t = setTimeout(() => {
      setAnnouncement(
        `${activeEntry.model.name}, rank ${activeRank} of ${ranked.length}, ${formatMoney(activeEntry.cost.total)} per month. Sample prices calculated in your browser.`
      );
    }, 450);
    return () => clearTimeout(t);
  }, [activeEntry, activeRank, ranked.length, loading, error]);

  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleRowKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (ranked.length === 0) return;
    let nextIndex: number | null = null;
    if (e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % ranked.length;
    } else if (e.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + ranked.length) % ranked.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = ranked.length - 1;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      const target = ranked[nextIndex].model;
      selectModel(target);
      requestAnimationFrame(() => {
        rowRefs.current.get(target.id)?.focus();
      });
    }
  };

  const viewState = loading ? "loading" : error ? "error" : ranked.length === 0 ? "empty" : "list";
  const slotCount = Math.max(4, models.length || 8);

  const inputIndex = nearestStopIndex(INPUT_STOPS, usage.inputTokens);
  const outputIndex = nearestStopIndex(OUTPUT_STOPS, usage.outputTokens);
  const requestIndex = nearestStopIndex(REQUEST_STOPS, usage.requestsPerDay);

  const cachePct = Math.round(Math.min(1, Math.max(0, cacheHitRate)) * 100);

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          <p className={styles.meta}>{description}</p>
        </div>

        <div className={styles.hero} aria-hidden="true">
          {viewState === "loading" ? (
            <>
              <span className={`${styles.skeleton} ${styles.skeletonTotal}`} />
              <span className={styles.heroMeta}>Loading prices…</span>
            </>
          ) : viewState === "list" && activeEntry ? (
            <>
              <AnimatedNumber
                value={activeEntry.cost.total}
                format={(v) => formatMoney(v, false)}
                className={`${styles.num} ${styles.total}`}
              />
              <span className={styles.heroMeta}>
                <span className={styles.swap}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={activeEntry.model.id}
                      className={styles.swapItem}
                      initial={reduced ? false : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -3 }}
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {activeEntry.model.name} per month
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </>
          ) : (
            <>
              <span className={`${styles.num} ${styles.total} ${styles.totalIdle}`}>—</span>
              <span className={styles.heroMeta}>
                {viewState === "error" ? "Unavailable" : "No models"}
              </span>
            </>
          )}
        </div>
      </header>

      {presets !== false && (
        <SegmentedControl
          className={styles.presets}
          label="Workload"
          options={presetOptions}
          value={activePresetId}
          onValueChange={(nextId) => {
            if (loading) return;
            const found = presets.find((p) => p.id === nextId);
            if (found) setUsage({ ...found.usage });
          }}
        />
      )}

      <div className={styles.controls}>
        <div className={styles.sliders}>
          <Slider
            label="Input tokens"
            min={0}
            max={INPUT_STOPS.length - 1}
            step={1}
            largeStep={2}
            value={inputIndex}
            disabled={loading}
            format={(idx) => (INPUT_STOPS[Math.round(idx)] ?? usage.inputTokens).toLocaleString("en-US")}
            onValueChange={(idx) => {
              const nextTokens = INPUT_STOPS[Math.round(idx)];
              if (nextTokens !== undefined) {
                setUsage({ ...usage, inputTokens: nextTokens });
              }
            }}
          />
          <Slider
            label="Output tokens"
            min={0}
            max={OUTPUT_STOPS.length - 1}
            step={1}
            largeStep={2}
            value={outputIndex}
            disabled={loading}
            format={(idx) => (OUTPUT_STOPS[Math.round(idx)] ?? usage.outputTokens).toLocaleString("en-US")}
            onValueChange={(idx) => {
              const nextTokens = OUTPUT_STOPS[Math.round(idx)];
              if (nextTokens !== undefined) {
                setUsage({ ...usage, outputTokens: nextTokens });
              }
            }}
          />
          <Slider
            label="Requests / day"
            min={0}
            max={REQUEST_STOPS.length - 1}
            step={1}
            largeStep={2}
            value={requestIndex}
            disabled={loading}
            format={(idx) => (REQUEST_STOPS[Math.round(idx)] ?? usage.requestsPerDay).toLocaleString("en-US")}
            onValueChange={(idx) => {
              const nextReqs = REQUEST_STOPS[Math.round(idx)];
              if (nextReqs !== undefined) {
                setUsage({ ...usage, requestsPerDay: nextReqs });
              }
            }}
          />
        </div>

        <div className={styles.cache}>
          <Switch
            label={`Cached input (${cachePct}% hit rate)`}
            checked={usage.cached}
            disabled={loading}
            onCheckedChange={(checked: boolean) => setUsage({ ...usage, cached: checked })}
          />
        </div>
      </div>

      <div className={styles.ranking}>
        <div className={styles.listHead}>
          <span>Model (cheapest first)</span>
          <span>Monthly</span>
        </div>

        <div className={styles.stage} style={{ "--slots": slotCount } as CSSProperties}>
          <AnimatePresence mode="wait" initial={false}>
            {viewState === "loading" && (
              <motion.div
                key="loading"
                className={styles.list}
                aria-hidden="true"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {Array.from({ length: slotCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`${styles.row} ${styles.ghost}`}
                    style={{ transform: `translateY(calc(var(--row) * ${idx}))` }}
                  >
                    <span className={styles.rank}>{idx + 1}</span>
                    <span className={`${styles.skeleton} ${styles.skeletonMark}`} />
                    <span
                      className={`${styles.skeleton} ${styles.skeletonName}`}
                      style={{ width: SKELETON_NAME_WIDTHS[idx % SKELETON_NAME_WIDTHS.length] }}
                    />
                    <span className={styles.track}>
                      <span
                        className={`${styles.bar} ${styles.skeleton}`}
                        style={{ width: SKELETON_BAR_WIDTHS[idx % SKELETON_BAR_WIDTHS.length] }}
                      />
                    </span>
                    <span className={`${styles.skeleton} ${styles.skeletonCost}`} />
                  </div>
                ))}
              </motion.div>
            )}

            {viewState === "error" && (
              <motion.div
                key="error"
                className={styles.message}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <span className={styles.messageTitle}>
                  <AlertCircle size={16} className={styles.messageIcon} aria-hidden="true" />
                  Prices did not load
                </span>
                <p className={styles.meta}>{error}</p>
                {onRetry && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.retry}
                    onClick={onRetry}
                  >
                    Try again
                  </Button>
                )}
              </motion.div>
            )}

            {viewState === "empty" && (
              <motion.div
                key="empty"
                className={styles.message}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <span className={styles.messageTitle}>No models to compare</span>
                <p className={styles.meta}>Add at least one model price to estimate monthly cost.</p>
              </motion.div>
            )}

            {viewState === "list" && (
              <motion.div
                key="list"
                className={styles.list}
                role="radiogroup"
                aria-label="Models ranked by monthly cost, lowest first"
                style={{ "--rows": ranked.length } as CSSProperties}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {ranked.map((_, idx) => (
                  <span
                    key={`rank-${idx}`}
                    className={styles.rankSlot}
                    style={{ transform: `translateY(calc(var(--row) * ${idx}))` }}
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                ))}

                {ranked.map(({ model, cost }, idx) => {
                  const isSelected = activeEntry?.model.id === model.id;
                  const ratio = Math.max(0.02, Math.min(1, cost.total / maxCost));
                  return (
                    <motion.button
                      key={model.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(model.id, el);
                        else rowRefs.current.delete(model.id);
                      }}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${model.name} by ${model.provider}, rank ${idx + 1}, ${formatMoney(cost.total, false)} per month`}
                      tabIndex={isSelected ? 0 : -1}
                      data-model={model.id}
                      data-on={isSelected ? "" : undefined}
                      className={styles.row}
                      animate={{ y: `calc(var(--row) * ${idx})` }}
                      transition={reduced ? { duration: 0 } : ROW_SPRING}
                      onClick={() => selectModel(model)}
                      onKeyDown={(e) => handleRowKeyDown(e, idx)}
                    >
                      <span className={styles.rank} />
                      <span className={styles.mark} aria-hidden="true">
                        {model.mark}
                      </span>
                      <span className={styles.name}>{model.name}</span>
                      <span className={styles.track} aria-hidden="true">
                        <motion.span
                          className={styles.bar}
                          animate={{ width: `${ratio * 100}%` }}
                          transition={reduced ? { duration: 0 } : ROW_SPRING}
                        />
                      </span>
                      <span className={`${styles.cost} ${styles.num}`} aria-hidden="true">
                        <AnimatedNumber
                          value={cost.total}
                          format={(v) => formatMoney(v, true)}
                        />
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className={styles.footer}>
        {viewState === "list" && activeEntry && (
          <dl className={styles.breakdown} aria-label={`${activeEntry.model.name} breakdown`}>
            <div className={styles.stat}>
              <dt className={styles.meta}>Input</dt>
              <dd>
                <AnimatedNumber
                  value={activeEntry.cost.input}
                  format={(v) => formatMoney(v, false)}
                  className={styles.num}
                />
              </dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.meta}>Cached</dt>
              <dd>
                <AnimatedNumber
                  value={activeEntry.cost.cachedInput}
                  format={(v) => formatMoney(v, false)}
                  className={styles.num}
                />
              </dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.meta}>Output</dt>
              <dd>
                <AnimatedNumber
                  value={activeEntry.cost.output}
                  format={(v) => formatMoney(v, false)}
                  className={styles.num}
                />
              </dd>
            </div>
            <div className={`${styles.stat} ${styles.statEnd}`}>
              <dt className={styles.meta}>Per request</dt>
              <dd>
                <AnimatedNumber
                  value={activeEntry.cost.perRequest}
                  format={formatPerRequest}
                  className={styles.num}
                />
              </dd>
            </div>
          </dl>
        )}

        <p className={styles.note}>
          {viewState === "list" && activeEntry && (
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={activeEntry.model.id}
                  className={styles.swapItem}
                  initial={reduced ? false : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -2 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  {activeEntry.model.name}: {formatRate(activeEntry.model.input)} in
                  {activeEntry.model.cachedInput !== undefined
                    ? `, ${formatRate(activeEntry.model.cachedInput)} cached`
                    : ""}
                  , {formatRate(activeEntry.model.output)} out per 1M tokens.
                </motion.span>
              </AnimatePresence>
            </span>
          )}
          <span className={styles.fine}>{note}</span>
        </p>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}

export default LlmCostCalculator;
