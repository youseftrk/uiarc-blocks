"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "../button/button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../motion-tokens";
import styles from "./provider-status.module.css";

export type ProviderHealth = "operational" | "degraded" | "outage";

export type IncidentStage = "investigating" | "identified" | "monitoring" | "resolved";

export type ProviderMarkName = "anthropic" | "openai" | "gemini" | "mistral" | "xai" | "aws";

export interface UptimeDay {
  date: string;
  status: ProviderHealth;
  uptime: number;
  note?: string;
}

export interface IncidentUpdate {
  stage: IncidentStage;
  at: string;
  text: string;
}

export interface ProviderIncident {
  id: string;
  title: string;
  startedAt: string;
  url?: string;
  updates: IncidentUpdate[];
}

export interface ProviderStatusItem {
  id: string;
  name: string;
  mark?: ProviderMarkName | ReactNode;
  detail?: string;
  status: ProviderHealth;
  latencyMs: number | null;
  days: UptimeDay[];
  incident?: ProviderIncident;
}

export interface ProviderStatusProps {
  providers?: ProviderStatusItem[];
  title?: string;
  refreshInterval?: number;
  onRefresh?: (signal: AbortSignal) => Promise<ProviderStatusItem[] | void> | ProviderStatusItem[] | void;
  onOpenIncident?: (provider: ProviderStatusItem, incident: ProviderIncident) => void;
  defaultOpenId?: string | null;
  loading?: boolean;
  error?: string | null;
  footnote?: string | null;
  className?: string;
}

function ProviderBrandMark({ name }: { name: ProviderMarkName }) {
  const gradId = useId();
  switch (name) {
    case "anthropic":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Anthropic">
          <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
        </svg>
      );
    case "openai":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="OpenAI">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
      );
    case "gemini": {
      const g0 = `ps-gem-0-${gradId}`;
      const g1 = `ps-gem-1-${gradId}`;
      const g2 = `ps-gem-2-${gradId}`;
      const d =
        "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
      return (
        <svg viewBox="0 0 24 24" role="img" aria-label="Google Gemini">
          <path d={d} fill="#3186FF" />
          <path d={d} fill={`url(#${g0})`} />
          <path d={d} fill={`url(#${g1})`} />
          <path d={d} fill={`url(#${g2})`} />
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" id={g0} x1="7" x2="11" y1="15.5" y2="12">
              <stop stopColor="#08B962" />
              <stop offset="1" stopColor="#08B962" stopOpacity="0" />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" id={g1} x1="8" x2="11.5" y1="5.5" y2="11">
              <stop stopColor="#F94543" />
              <stop offset="1" stopColor="#F94543" stopOpacity="0" />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" id={g2} x1="3.5" x2="17.5" y1="13.5" y2="12">
              <stop stopColor="#FABC12" />
              <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      );
    }
    case "mistral":
      return (
        <svg viewBox="0 0 24 24" role="img" aria-label="Mistral AI">
          <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
          <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
          <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
          <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
          <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
        </svg>
      );
    case "xai":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label="xAI">
          <path d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z" />
        </svg>
      );
    case "aws":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Amazon Web Services">
          <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z" />
        </svg>
      );
  }
}

function buildDays(overrides: Record<number, Partial<UptimeDay>> = {}): UptimeDay[] {
  const days: UptimeDay[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const idx = 29 - i;
    const ov = overrides[idx];
    days.push({
      date: iso,
      status: ov?.status ?? "operational",
      uptime: ov?.uptime ?? 100,
      note: ov?.note,
    });
  }
  return days;
}

function createSampleProviders(): ProviderStatusItem[] {
  return [
    {
      id: "anthropic",
      name: "Anthropic",
      mark: "anthropic",
      detail: "Claude API",
      status: "operational",
      latencyMs: 412,
      days: buildDays({
        11: { status: "degraded", uptime: 98.8, note: "Brief spike in message stream latency." },
      }),
    },
    {
      id: "openai",
      name: "OpenAI",
      mark: "openai",
      detail: "GPT-6.1 & Realtime",
      status: "outage",
      latencyMs: 2140,
      days: buildDays({
        17: { status: "degraded", uptime: 98.4, note: "Elevated latency on batch completions." },
        29: { status: "outage", uptime: 86.2, note: "Elevated error rates on GPT-6.1 Sol." },
      }),
      incident: {
        id: "inc-openai-1",
        title: "Elevated error rates on GPT-6.1 Sol",
        startedAt: "24 min ago",
        url: "https://status.openai.com",
        updates: [
          {
            stage: "investigating",
            at: "6 min ago",
            text: "Mitigation is rolling out across us-east routing nodes. Error rates are beginning to decline.",
          },
          {
            stage: "investigating",
            at: "24 min ago",
            text: "We are investigating elevated 5xx responses and timeouts affecting GPT-6.1 Sol requests.",
          },
        ],
      },
    },
    {
      id: "gemini",
      name: "Google Gemini",
      mark: "gemini",
      detail: "Gemini API",
      status: "degraded",
      latencyMs: 1380,
      days: buildDays({
        29: { status: "degraded", uptime: 96.4, note: "Higher p50 latency on streaming requests." },
      }),
      incident: {
        id: "inc-gemini-1",
        title: "Elevated latency on Gemini 3.5 Pro",
        startedAt: "42 min ago",
        url: "https://status.cloud.google.com",
        updates: [
          {
            stage: "monitoring",
            at: "11 min ago",
            text: "Traffic has been shifted to healthy inference pools and we are monitoring recovery.",
          },
          {
            stage: "identified",
            at: "35 min ago",
            text: "Root cause isolated to a regional cache warm-up regression.",
          },
        ],
      },
    },
    {
      id: "mistral",
      name: "Mistral AI",
      mark: "mistral",
      detail: "La Plateforme",
      status: "operational",
      latencyMs: 367,
      days: buildDays(),
    },
    {
      id: "xai",
      name: "xAI",
      mark: "xai",
      detail: "Grok API",
      status: "operational",
      latencyMs: 448,
      days: buildDays({
        6: { status: "degraded", uptime: 99.4, note: "Short elevation in tool-call latency." },
      }),
    },
    {
      id: "aws",
      name: "Amazon Bedrock",
      mark: "aws",
      detail: "us-east-1",
      status: "operational",
      latencyMs: 543,
      days: buildDays(),
    },
  ];
}

const HEALTH_LABEL: Record<ProviderHealth, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
};

const STAGE_LABEL: Record<IncidentStage, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

function HealthIcon({ health, className }: { health: ProviderHealth | "error"; className?: string }) {
  if (health === "operational") return <CircleCheck className={className} aria-hidden="true" />;
  if (health === "degraded") return <AlertTriangle className={className} aria-hidden="true" />;
  return <CircleAlert className={className} aria-hidden="true" />;
}

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

function formatUptime(days: UptimeDay[]): string {
  if (!days.length) return "—";
  const avg = days.reduce((acc, d) => acc + d.uptime, 0) / days.length;
  if (avg >= 99.995) return "100%";
  return `${avg.toFixed(2)}%`;
}

function formatDayDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isBrandName(mark: ProviderMarkName | ReactNode): mark is ProviderMarkName {
  return (
    typeof mark === "string" &&
    (mark === "anthropic" ||
      mark === "openai" ||
      mark === "gemini" ||
      mark === "mistral" ||
      mark === "xai" ||
      mark === "aws")
  );
}

interface TipState {
  providerId: string;
  dayIndex: number;
  day: UptimeDay;
  x: number;
  y: number;
}

export function ProviderStatus({
  providers: controlledProviders,
  title = "Provider status",
  refreshInterval = 60_000,
  onRefresh,
  onOpenIncident,
  defaultOpenId,
  loading = false,
  error: controlledError = null,
  footnote,
  className,
}: ProviderStatusProps) {
  const headingId = useId();
  const reduced = Boolean(useReducedMotion());
  const isControlled = controlledProviders !== undefined;

  const [internalProviders, setInternalProviders] = useState<ProviderStatusItem[]>(() => createSampleProviders());
  const providers = isControlled ? controlledProviders : internalProviders;

  const [openId, setOpenId] = useState<string | null>(() => {
    if (defaultOpenId !== undefined) return defaultOpenId;
    const firstWithIncident = (controlledProviders ?? internalProviders).find((p) => p.incident);
    return firstWithIncident?.id ?? null;
  });

  const [checking, setChecking] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(1, Math.round(refreshInterval / 1000)));
  const [tip, setTip] = useState<TipState | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const checkCountRef = useRef(0);

  const activeError = controlledError ?? internalError;

  const triggerRefresh = useCallback(async () => {
    if (checking) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChecking(true);
    setAnnouncement("Checking provider status.");

    try {
      if (onRefresh) {
        const res = await onRefresh(ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (Array.isArray(res) && !isControlled) {
          setInternalProviders(res);
        }
        setInternalError(null);
      } else {
        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(resolve, 680);
          ctrl.signal.addEventListener(
            "abort",
            () => {
              window.clearTimeout(t);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
        if (ctrl.signal.aborted) return;
        checkCountRef.current += 1;
        const step = checkCountRef.current;
        if (!isControlled) {
          setInternalProviders((prev) =>
            prev.map((item) => {
              const jitter = Math.round((Math.sin(step * 2.1 + item.name.length) * 0.08) * (item.latencyMs ?? 400));
              const nextLatency = item.latencyMs != null ? Math.max(120, item.latencyMs + jitter) : null;
              if (item.id === "openai" && step === 2) {
                return {
                  ...item,
                  status: "degraded",
                  latencyMs: 1120,
                  incident: item.incident
                    ? {
                        ...item.incident,
                        updates: [
                          {
                            stage: "monitoring",
                            at: "just now",
                            text: "Mitigation complete. Error rates have returned near baseline; monitoring stability.",
                          },
                          ...item.incident.updates,
                        ],
                      }
                    : undefined,
                };
              }
              return { ...item, latencyMs: nextLatency };
            }),
          );
        }
        setInternalError(null);
      }
      setAnnouncement("Provider status updated.");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        const msg = err instanceof Error && err.message ? err.message : "Couldn’t reach the status feeds. Showing the last results.";
        setInternalError(msg);
        setAnnouncement(msg);
      }
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setChecking(false);
        setCycle((c) => c + 1);
        setSecondsLeft(Math.max(1, Math.round(refreshInterval / 1000)));
      }
    }
  }, [checking, isControlled, onRefresh, refreshInterval]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Countdown tick
  useEffect(() => {
    if (refreshInterval <= 0 || loading || checking) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          void triggerRefresh();
          return Math.max(1, Math.round(refreshInterval / 1000));
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [checking, loading, refreshInterval, triggerRefresh]);

  const summary = useMemo(() => {
    if (activeError) {
      return { tone: "error" as const, text: activeError };
    }
    const outages = providers.filter((p) => p.status === "outage").length;
    const degraded = providers.filter((p) => p.status === "degraded").length;
    if (outages > 0 && degraded > 0) {
      return {
        tone: "outage" as const,
        text: `${outages} ${outages === 1 ? "outage" : "outages"}, ${degraded} degraded`,
      };
    }
    if (outages > 0) {
      return {
        tone: "outage" as const,
        text: `${outages} ${outages === 1 ? "provider experiencing an outage" : "providers experiencing outages"}`,
      };
    }
    if (degraded > 0) {
      return {
        tone: "degraded" as const,
        text: `${degraded} ${degraded === 1 ? "provider degraded" : "providers degraded"}`,
      };
    }
    return { tone: "operational" as const, text: "All systems operational" };
  }, [activeError, providers]);

  const positionTooltip = useCallback((barEl: HTMLElement, provider: ProviderStatusItem, index: number) => {
    const root = rootRef.current;
    const day = provider.days[index];
    if (!root || !day) return;
    const rootRect = root.getBoundingClientRect();
    const barRect = barEl.getBoundingClientRect();
    const count = provider.days.length;
    const frac = count > 1 ? (index + 0.5) / count : 0.5;
    const rawX = barRect.left - rootRect.left + barRect.width * frac;
    const tipWidth = tipRef.current?.offsetWidth ?? 216;
    const clampedX = Math.max(8, Math.min(rootRect.width - tipWidth - 8, rawX - tipWidth / 2));
    const y = barRect.top - rootRect.top - 8;
    setTip({ providerId: provider.id, dayIndex: index, day, x: clampedX, y });
  }, []);

  const handleBarPointer = (e: PointerEvent<HTMLDivElement>, provider: ProviderStatusItem) => {
    if (!provider.days.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = Math.max(0, Math.min(0.9999, (e.clientX - rect.left) / rect.width));
    const idx = Math.floor(rel * provider.days.length);
    positionTooltip(e.currentTarget, provider, idx);
  };

  const handleBarKeyDown = (e: KeyboardEvent<HTMLDivElement>, provider: ProviderStatusItem) => {
    const count = provider.days.length;
    if (!count) return;
    const currentIdx = tip?.providerId === provider.id ? tip.dayIndex : count - 1;
    let nextIdx: number | null = null;
    if (e.key === "ArrowLeft") nextIdx = Math.max(0, currentIdx - 1);
    else if (e.key === "ArrowRight") nextIdx = Math.min(count - 1, currentIdx + 1);
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = count - 1;
    else if (e.key === "Escape") {
      setTip(null);
      return;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      positionTooltip(e.currentTarget, provider, nextIdx);
    }
  };

  const defaultFootnote =
    "Sample data · Latency is p50 over the last 5 minutes · Days under 99.5% uptime show as degraded.";
  const resolvedFootnote = footnote === null ? null : footnote ?? defaultFootnote;

  return (
    <section
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      aria-labelledby={headingId}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={headingId} className={styles.title}>
            {title}
          </h3>
          <div className={styles.summary}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`${summary.tone}-${summary.text}`}
                className={styles.summaryItem}
                data-tone={summary.tone}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16, ease: [...motionTokens.ease.enter] }}
              >
                <HealthIcon health={summary.tone} className={styles.summaryIcon} />
                <span className={styles.summaryText}>{summary.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className={styles.refresh}>
          {refreshInterval > 0 ? (
            <span className={styles.countdown} aria-live="off">
              <span className={styles.countdownText}>
                <span className={styles.countdownLabel}>
                  {checking ? "Checking…" : `Next check in ${secondsLeft}s`}
                </span>
              </span>
              <svg
                className={styles.ring}
                viewBox="0 0 16 16"
                aria-hidden="true"
                data-phase={activeError ? "error" : checking ? "checking" : "idle"}
              >
                <circle className={styles.ringTrack} cx="8" cy="8" r="6" />
                {checking ? (
                  <circle className={styles.ringSpin} cx="8" cy="8" r="6" pathLength={100} />
                ) : !reduced ? (
                  <circle
                    key={cycle}
                    className={styles.ringFill}
                    cx="8"
                    cy="8"
                    r="6"
                    pathLength={100}
                    style={{ animationDuration: `${refreshInterval}ms` }}
                  />
                ) : (
                  <circle className={styles.ringFill} cx="8" cy="8" r="6" pathLength={100} style={{ animation: "none" }} />
                )}
              </svg>
            </span>
          ) : null}

          <Tooltip content="Check now">
            <button
              type="button"
              className={styles.refreshButton}
              disabled={loading || checking}
              aria-label="Refresh provider status"
              onClick={() => void triggerRefresh()}
            >
              <RefreshCw aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className={styles.columns} aria-hidden="true">
        <span className={styles.colName}>Provider</span>
        <span className={styles.colStatus}>Status</span>
        <span className={styles.colLatency}>p50</span>
        <span className={styles.colBar}>30-day uptime</span>
      </div>

      {loading ? (
        <ul className={styles.list} aria-label="Loading provider status">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className={styles.item} data-skeleton="" aria-hidden="true">
              <div className={styles.line}>
                <span className={`${styles.mark} ${styles.bone}`} />
                <span className={styles.name}>
                  <span className={styles.bone} style={{ width: `${76 + (i % 3) * 18}px` }} />
                  <span className={styles.bone} style={{ width: `${56 + (i % 2) * 20}px`, height: "8px" }} />
                </span>
                <span className={styles.status}>
                  <span className={styles.bone} style={{ width: "74px" }} />
                </span>
                <span className={styles.latency}>
                  <span className={styles.bone} style={{ width: "42px" }} />
                </span>
                <div className={`${styles.bar} ${styles.barBone}`}>
                  {Array.from({ length: 30 }).map((__, t) => (
                    <span key={t} className={styles.tick} />
                  ))}
                </div>
                <span className={styles.pct}>
                  <span className={styles.bone} style={{ width: "40px" }} />
                </span>
                <span className={styles.chev} />
              </div>
            </li>
          ))}
        </ul>
      ) : providers.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No providers configured</span>
          <span className={styles.emptyText}>Add AI providers to monitor their API health and 30-day uptime.</span>
        </div>
      ) : (
        <ul className={styles.list} aria-label="AI providers">
          {providers.map((provider) => {
            const hasIncident = Boolean(provider.incident);
            const isOpen = hasIncident && openId === provider.id;
            const panelId = `${headingId}-panel-${provider.id}`;
            const uptimeStr = formatUptime(provider.days);
            const isScrubbing = tip?.providerId === provider.id;
            const activeTickIdx = isScrubbing ? tip.dayIndex : -1;

            return (
              <li
                key={provider.id}
                className={styles.item}
                data-interactive={hasIncident ? "" : undefined}
                data-open={isOpen ? "" : undefined}
              >
                <div className={styles.line}>
                  {hasIncident ? (
                    <button
                      type="button"
                      className={styles.hit}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={`${provider.name}, ${HEALTH_LABEL[provider.status]}, ${isOpen ? "hide" : "show"} incident details`}
                      onClick={() => setOpenId((cur) => (cur === provider.id ? null : provider.id))}
                    />
                  ) : null}

                  <span className={styles.mark}>
                    {isBrandName(provider.mark) ? (
                      <ProviderBrandMark name={provider.mark} />
                    ) : (
                      provider.mark ?? null
                    )}
                  </span>

                  <span className={styles.name}>
                    <span className={styles.nameText}>{provider.name}</span>
                    {provider.detail ? (
                      <span className={styles.meta}>
                        <span className={styles.detail}>{provider.detail}</span>
                      </span>
                    ) : null}
                  </span>

                  <span className={styles.status}>
                    <span className={styles.swap}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={provider.status}
                          className={styles.health}
                          data-health={provider.status}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={{ duration: 0.16, ease: [...motionTokens.ease.enter] }}
                        >
                          <HealthIcon health={provider.status} className={styles.healthIcon} />
                          <span>{HEALTH_LABEL[provider.status]}</span>
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </span>

                  <span className={styles.latency}>
                    <span className={styles.num}>
                      <span className={styles.numGhost} aria-hidden="true">
                        9.99 s
                      </span>
                      <span>{formatLatency(provider.latencyMs)}</span>
                    </span>
                  </span>

                  <div
                    className={styles.bar}
                    role="group"
                    tabIndex={0}
                    data-scrub={isScrubbing ? "" : undefined}
                    aria-label={`${provider.name} 30-day uptime: ${uptimeStr}. Use Left and Right arrow keys to inspect individual days.`}
                    onPointerMove={(e) => handleBarPointer(e, provider)}
                    onPointerEnter={(e) => handleBarPointer(e, provider)}
                    onPointerLeave={() =>
                      setTip((cur) => (cur?.providerId === provider.id ? null : cur))
                    }
                    onFocus={(e) => {
                      if (provider.days.length) {
                        positionTooltip(e.currentTarget, provider, provider.days.length - 1);
                      }
                    }}
                    onBlur={() =>
                      setTip((cur) => (cur?.providerId === provider.id ? null : cur))
                    }
                    onKeyDown={(e) => handleBarKeyDown(e, provider)}
                  >
                    {provider.days.map((day, idx) => (
                      <span
                        key={day.date}
                        className={styles.tick}
                        data-health={day.status}
                        data-active={idx === activeTickIdx ? "" : undefined}
                      />
                    ))}
                  </div>

                  <span className={styles.pct}>{uptimeStr}</span>

                  <span className={styles.chev} aria-hidden="true">
                    {hasIncident ? <ChevronDown /> : null}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && provider.incident ? (
                    <motion.div
                      id={panelId}
                      key="panel"
                      className={styles.panel}
                      initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={
                        reduced
                          ? { duration: 0.12 }
                          : {
                              height: { type: "spring", visualDuration: 0.24, bounce: 0 },
                              opacity: { duration: 0.16, ease: [...motionTokens.ease.standard] },
                            }
                      }
                    >
                      <div className={styles.panelInner}>
                        <div className={styles.panelHead}>
                          <div className={styles.panelTitleWrap}>
                            <span className={styles.panelTitle}>{provider.incident.title}</span>
                            <span className={styles.panelMeta}>Started {provider.incident.startedAt}</span>
                          </div>
                        </div>

                        {provider.incident.url || onOpenIncident ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={styles.panelLink}
                            onClick={() => {
                              if (onOpenIncident && provider.incident) {
                                onOpenIncident(provider, provider.incident);
                              } else if (provider.incident?.url) {
                                window.open(provider.incident.url, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            Status page
                            <ExternalLink aria-hidden="true" />
                          </Button>
                        ) : null}

                        <ol className={styles.updates}>
                          {provider.incident.updates.map((upd, idx) => (
                            <li
                              key={`${upd.stage}-${upd.at}-${idx}`}
                              className={styles.update}
                              data-latest={idx === 0 ? "" : undefined}
                              data-stage={upd.stage}
                            >
                              <span className={styles.updateDot} aria-hidden="true" />
                              <div className={styles.updateHead}>
                                <span className={styles.updateStage}>{STAGE_LABEL[upd.stage]}</span>
                                <span className={styles.updateTime}>{upd.at}</span>
                              </div>
                              <p className={styles.updateText} style={{ margin: 0 }}>
                                {upd.text}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}

      {resolvedFootnote ? <p className={styles.footnote}>{resolvedFootnote}</p> : null}

      <div
        ref={tipRef}
        role="tooltip"
        className={styles.tip}
        data-open={tip ? "" : undefined}
        style={
          tip
            ? {
                transform: `translate3d(${Math.round(tip.x)}px, ${Math.round(tip.y)}px, 0) translateY(-100%)`,
              }
            : undefined
        }
      >
        {tip ? (
          <>
            <div className={styles.tipHead}>
              <span className={styles.tipDate}>{formatDayDate(tip.day.date)}</span>
              <span className={styles.tipPct}>
                {tip.day.uptime >= 99.995 ? "100%" : `${tip.day.uptime.toFixed(2)}%`}
              </span>
            </div>
            <div className={styles.tipBody}>
              <span className={styles.health} data-health={tip.day.status}>
                <HealthIcon health={tip.day.status} className={styles.healthIcon} />
                <span>{HEALTH_LABEL[tip.day.status]}</span>
              </span>
              {tip.day.note ? <span className={styles.tipNote}>{tip.day.note}</span> : null}
            </div>
          </>
        ) : null}
      </div>

      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}
