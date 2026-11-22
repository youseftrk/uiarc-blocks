"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  CircleCheck,
  CircleDashed,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "../button/button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../motion-tokens";
import styles from "./provider-keys.module.css";

export type ProviderId = "anthropic" | "openai" | "google" | "mistral" | "xai";

export type ProviderKeyStatus = "connected" | "invalid" | "unset";

export interface ProviderKey {
  provider: ProviderId;
  status: ProviderKeyStatus;
  value?: string;
  last4?: string;
  lastUsedAt?: Date | number | string | null;
  checkedAt?: Date | number | string | null;
  error?: string;
}

export interface KeyTestRequest {
  provider: ProviderId;
  key?: string;
  signal: AbortSignal;
}

export interface KeyTestResult {
  ok: boolean;
  detail?: string;
  error?: string;
}

export interface ProviderKeysProps {
  keys?: ProviderKey[];
  defaultKeys?: ProviderKey[];
  onKeysChange?: (keys: ProviderKey[]) => void;
  providers?: ProviderId[];
  testKey?: (request: KeyTestRequest) => Promise<KeyTestResult>;
  onSave?: (provider: ProviderId, key: string, mode: "add" | "rotate") => void;
  onRemove?: (provider: ProviderId) => void;
  onCopy?: (provider: ProviderId) => void;
  revealDuration?: number;
  undoDuration?: number;
  loading?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode | null;
  className?: string;
}

interface ProviderMeta {
  id: ProviderId;
  name: string;
  prefix: string;
  consoleHost: string;
  placeholder: string;
  sampleKey: string;
  minLength: number;
}

const DEFAULT_PROVIDERS: ProviderId[] = ["anthropic", "openai", "google", "mistral", "xai"];

const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    prefix: "sk-ant-",
    consoleHost: "console.anthropic.com",
    placeholder: "sk-ant-api03-...",
    sampleKey: "sk-ant-api03-8kR2mN9vL4xQ7pW1cY6jB3tH5zD0eA4f2a",
    minLength: 20,
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    prefix: "sk-proj-",
    consoleHost: "platform.openai.com",
    placeholder: "sk-proj-...",
    sampleKey: "sk-proj-3pL9wX2nK7vB4mQ8rT1cF6yH0jZ5sN9c1e",
    minLength: 20,
  },
  google: {
    id: "google",
    name: "Google AI",
    prefix: "AIza",
    consoleHost: "aistudio.google.com",
    placeholder: "AIzaSy...",
    sampleKey: "AIzaSyB9xK4mN2pL7vQ3wR8tY1cF6jH0Qk7w",
    minLength: 20,
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    prefix: "",
    consoleHost: "console.mistral.ai",
    placeholder: "Paste Mistral API key",
    sampleKey: "msK9xL2pN7vQ4wR8tY1cF6jH0zD3n8Lp",
    minLength: 16,
  },
  xai: {
    id: "xai",
    name: "xAI",
    prefix: "xai-",
    consoleHost: "console.x.ai",
    placeholder: "xai-...",
    sampleKey: "xai-7pQ2mN8vL5xK3wR9tY1cF6jH0zD4b6Vx",
    minLength: 16,
  },
};

function createSampleKeys(now = Date.now()): ProviderKey[] {
  return [
    {
      provider: "anthropic",
      status: "connected",
      value: "sk-ant-api03-8kR2mN9vL4xQ7pW1cY6jB3tH5zD0eA4f2a",
      last4: "4f2a",
      lastUsedAt: now - 2 * 60_000,
    },
    {
      provider: "openai",
      status: "connected",
      value: "sk-proj-3pL9wX2nK7vB4mQ8rT1cF6yH0jZ5sN9c1e",
      last4: "9c1e",
      lastUsedAt: now - 14 * 60_000,
    },
    {
      provider: "google",
      status: "connected",
      value: "AIzaSyB9xK4mN2pL7vQ3wR8tY1cF6jH0Qk7w",
      last4: "Qk7w",
      lastUsedAt: now - 26 * 3_600_000,
    },
    {
      provider: "mistral",
      status: "invalid",
      value: "msK9xL2pN7vQ4wR8tY1cF6jH0zD3h7Qd",
      last4: "h7Qd",
      checkedAt: now - 3 * 86_400_000,
      error: "401 Unauthorized",
    },
  ];
}

function ProviderMark({ provider, className }: { provider: ProviderId; className?: string }) {
  const gradId = useId();
  switch (provider) {
    case "anthropic":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" className={className}>
          <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
        </svg>
      );
    case "openai":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" className={className}>
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
      );
    case "google": {
      const g0 = `pk-gem-0-${gradId}`;
      const g1 = `pk-gem-1-${gradId}`;
      const g2 = `pk-gem-2-${gradId}`;
      const d =
        "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
      return (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className={className}>
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
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className={className}>
          <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
          <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
          <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
          <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
          <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
        </svg>
      );
    case "xai":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-hidden="true" className={className}>
          <path d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z" />
        </svg>
      );
  }
}

function formatRelative(value: Date | number | string | null | undefined, now: number, verb: string): string | null {
  if (value == null) return null;
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) return value;
  const ts = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(ts)) return null;
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return `${verb} just now`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${verb} ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${verb} ${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return `${verb} yesterday`;
  return `${verb} ${diffDay} days ago`;
}

function validateFormat(provider: ProviderId, raw: string): { valid: boolean; tone: "idle" | "ok" | "bad"; message: string } {
  const value = raw.trim();
  const meta = PROVIDER_META[provider];
  if (!value) {
    return { valid: false, tone: "idle", message: meta.prefix ? `Starts with ${meta.prefix}` : `Paste your ${meta.name} API key` };
  }
  if (/\s/.test(value)) {
    return { valid: false, tone: "bad", message: "Keys cannot contain spaces" };
  }
  if (meta.prefix && !value.startsWith(meta.prefix)) {
    if (provider === "openai" && value.startsWith("sk-")) {
      // Allow legacy sk- keys
    } else {
      return { valid: false, tone: "bad", message: `Expected prefix ${meta.prefix}` };
    }
  }
  if (value.length < meta.minLength) {
    return { valid: false, tone: "bad", message: `Too short (${value.length}/${meta.minLength} characters)` };
  }
  return { valid: true, tone: "ok", message: "Format looks good" };
}

function derivePrefixAndLast4(provider: ProviderId, entry: ProviderKey): { prefix: string; last4: string } {
  const meta = PROVIDER_META[provider];
  const last4 = entry.last4 ?? (entry.value ? entry.value.slice(-4) : "••••");
  if (entry.value) {
    if (meta.prefix && entry.value.startsWith(meta.prefix)) {
      return { prefix: meta.prefix, last4 };
    }
    if (provider === "openai" && entry.value.startsWith("sk-")) {
      return { prefix: "sk-", last4 };
    }
  }
  return { prefix: meta.prefix, last4 };
}

function SwapText({ swapKey, children, reduced }: { swapKey: string; children: ReactNode; reduced: boolean }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={swapKey}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: [...motionTokens.ease.standard] } }}
          transition={{ duration: 0.16, ease: [...motionTokens.ease.enter] }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface PendingRemoval {
  entry: ProviderKey;
  timer: number;
}

interface ActiveForm {
  provider: ProviderId;
  mode: "add" | "rotate";
  value: string;
  phase: "idle" | "testing" | "ok" | "error";
  error?: string;
}

export function ProviderKeys({
  keys: controlledKeys,
  defaultKeys,
  onKeysChange,
  providers = DEFAULT_PROVIDERS,
  testKey,
  onSave,
  onRemove,
  onCopy,
  revealDuration = 5000,
  undoDuration = 5000,
  loading = false,
  title = "Provider keys",
  description,
  footer,
  className,
}: ProviderKeysProps) {
  const headingId = useId();
  const reduced = Boolean(useReducedMotion());
  const isControlled = controlledKeys !== undefined;

  const [internalKeys, setInternalKeys] = useState<ProviderKey[]>(() => defaultKeys ?? createSampleKeys());
  const currentKeys = isControlled ? controlledKeys : internalKeys;

  const [now, setNow] = useState(() => Date.now());
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  const [copiedProvider, setCopiedProvider] = useState<ProviderId | null>(null);
  const [testingRow, setTestingRow] = useState<Record<string, boolean>>({});
  const [pendingRemovals, setPendingRemovals] = useState<Record<string, PendingRemoval>>({});
  const [form, setForm] = useState<ActiveForm | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const revealTimers = useRef<Record<string, number>>({});
  const copyTimer = useRef<number | null>(null);
  const formAbort = useRef<AbortController | null>(null);
  const rowAborts = useRef<Record<string, AbortController>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const undoRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const removeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const announce = useCallback(
    (msg: string) => {
      const suffix = testKey ? "" : " Simulated, nothing was sent.";
      setAnnouncement(`${msg}${suffix}`);
    },
    [testKey],
  );

  const commitKeys = useCallback(
    (updater: (prev: ProviderKey[]) => ProviderKey[]) => {
      const next = updater(currentKeys);
      if (!isControlled) setInternalKeys(next);
      onKeysChange?.(next);
    },
    [currentKeys, isControlled, onKeysChange],
  );

  // Relative time refresh every 30s
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Cleanup timers and in-flight requests on unmount
  useEffect(() => {
    const rTimers = revealTimers.current;
    const rAborts = rowAborts.current;
    return () => {
      Object.values(rTimers).forEach((t) => window.clearTimeout(t));
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      formAbort.current?.abort();
      Object.values(rAborts).forEach((a) => a.abort());
    };
  }, []);

  const keyMap = useMemo(() => {
    const map = new Map<ProviderId, ProviderKey>();
    for (const k of currentKeys) map.set(k.provider, k);
    return map;
  }, [currentKeys]);

  const runTest = useCallback(
    async (provider: ProviderId, candidateKey: string | undefined, signal: AbortSignal): Promise<KeyTestResult> => {
      if (testKey) {
        return testKey({ provider, key: candidateKey, signal });
      }
      await new Promise<void>((resolve, reject) => {
        const delay = 520 + Math.floor(Math.random() * 240);
        const timer = window.setTimeout(resolve, delay);
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
      if (!candidateKey) {
        const existing = keyMap.get(provider);
        if (existing?.status === "invalid") {
          return { ok: false, error: existing.error ?? "401 Unauthorized" };
        }
      }
      return { ok: true, detail: "Connected" };
    },
    [keyMap, testKey],
  );

  const closeForm = useCallback((returnFocus = false) => {
    formAbort.current?.abort();
    formAbort.current = null;
    setForm(null);
    if (returnFocus) {
      window.requestAnimationFrame(() => {
        lastTriggerRef.current?.focus();
      });
    }
  }, []);

  const openForm = useCallback(
    (provider: ProviderId, mode: "add" | "rotate", triggerEl?: HTMLButtonElement | null) => {
      if (form?.provider === provider && form.mode === mode) {
        closeForm(false);
        return;
      }
      formAbort.current?.abort();
      formAbort.current = null;
      lastTriggerRef.current = triggerEl ?? triggerRefs.current[`${provider}:${mode}`] ?? null;
      setForm({ provider, mode, value: "", phase: "idle" });
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [closeForm, form],
  );

  const handleHeaderAdd = () => {
    const firstUnset = providers.find((p) => {
      const entry = keyMap.get(p);
      return !entry || entry.status === "unset";
    });
    const target = firstUnset ?? providers[0];
    if (!target) return;
    const entry = keyMap.get(target);
    const mode: "add" | "rotate" = !entry || entry.status === "unset" ? "add" : "rotate";
    openForm(target, mode);
  };

  const handleRevealToggle = (provider: ProviderId) => {
    const meta = PROVIDER_META[provider];
    if (revealed[provider]) {
      window.clearTimeout(revealTimers.current[provider]);
      delete revealTimers.current[provider];
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
      announce(`${meta.name} key hidden.`);
      return;
    }
    const token = Date.now();
    setRevealed((prev) => ({ ...prev, [provider]: token }));
    announce(`${meta.name} key revealed for ${Math.round(revealDuration / 1000)} seconds.`);
    revealTimers.current[provider] = window.setTimeout(() => {
      setRevealed((prev) => {
        if (prev[provider] !== token) return prev;
        const next = { ...prev };
        delete next[provider];
        return next;
      });
      delete revealTimers.current[provider];
    }, revealDuration);
  };

  const handleCopy = async (provider: ProviderId, value: string) => {
    const meta = PROVIDER_META[provider];
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
    setCopiedProvider(provider);
    onCopy?.(provider);
    announce(`Copied the ${meta.name} key.`);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedProvider(null), 1800);
  };

  const handleRetest = async (provider: ProviderId) => {
    const entry = keyMap.get(provider);
    if (!entry || entry.status === "unset" || testingRow[provider]) return;
    const meta = PROVIDER_META[provider];
    rowAborts.current[provider]?.abort();
    const ctrl = new AbortController();
    rowAborts.current[provider] = ctrl;
    setTestingRow((prev) => ({ ...prev, [provider]: true }));
    announce(`Testing ${meta.name} connection.`);
    try {
      const result = await runTest(provider, undefined, ctrl.signal);
      if (ctrl.signal.aborted) return;
      const ts = Date.now();
      commitKeys((prev) =>
        prev.map((item) =>
          item.provider === provider
            ? {
                ...item,
                status: result.ok ? "connected" : "invalid",
                checkedAt: ts,
                error: result.ok ? undefined : result.error ?? "401 Unauthorized",
              }
            : item,
        ),
      );
      announce(
        result.ok
          ? `${meta.name} key connected.`
          : `${meta.name} key invalid: ${result.error ?? "401 Unauthorized"}.`,
      );
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        announce(`${meta.name} connection test failed.`);
      }
    } finally {
      if (rowAborts.current[provider] === ctrl) {
        delete rowAborts.current[provider];
        setTestingRow((prev) => {
          const next = { ...prev };
          delete next[provider];
          return next;
        });
      }
    }
  };

  const handleRemove = (provider: ProviderId) => {
    const entry = keyMap.get(provider);
    if (!entry || entry.status === "unset") return;
    const meta = PROVIDER_META[provider];

    if (form?.provider === provider) closeForm(false);
    if (revealed[provider]) {
      window.clearTimeout(revealTimers.current[provider]);
      delete revealTimers.current[provider];
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    }

    commitKeys((prev) => prev.filter((k) => k.provider !== provider));

    const timer = window.setTimeout(() => {
      setPendingRemovals((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
      onRemove?.(provider);
    }, undoDuration);

    setPendingRemovals((prev) => ({ ...prev, [provider]: { entry, timer } }));
    announce(`${meta.name} key removed. Undo available for ${Math.round(undoDuration / 1000)} seconds.`);
    window.requestAnimationFrame(() => {
      undoRefs.current[provider]?.focus();
    });
  };

  const handleUndo = (provider: ProviderId) => {
    const pending = pendingRemovals[provider];
    if (!pending) return;
    const meta = PROVIDER_META[provider];
    window.clearTimeout(pending.timer);
    setPendingRemovals((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    commitKeys((prev) => [...prev.filter((k) => k.provider !== provider), pending.entry]);
    announce(`Restored the ${meta.name} key.`);
    window.requestAnimationFrame(() => {
      removeRefs.current[provider]?.focus();
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || form.phase === "testing" || form.phase === "ok") return;
    const trimmed = form.value.trim();
    const check = validateFormat(form.provider, trimmed);
    if (!check.valid) {
      setForm({ ...form, phase: "error", error: check.message });
      return;
    }

    const meta = PROVIDER_META[form.provider];
    formAbort.current?.abort();
    const ctrl = new AbortController();
    formAbort.current = ctrl;
    setForm({ ...form, phase: "testing", error: undefined });
    announce(`Testing ${meta.name} key.`);

    try {
      const result = await runTest(form.provider, trimmed, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!result.ok) {
        const errText = result.error ?? "401 Unauthorized";
        setForm((prev) => (prev ? { ...prev, phase: "error", error: errText } : null));
        announce(`${meta.name} key rejected: ${errText}.`);
        return;
      }

      setForm((prev) => (prev ? { ...prev, phase: "ok", error: undefined } : null));
      announce(`${meta.name} key connected and saved.`);

      const savedProvider = form.provider;
      const savedMode = form.mode;
      const newEntry: ProviderKey = {
        provider: savedProvider,
        status: "connected",
        value: trimmed,
        last4: trimmed.slice(-4),
        lastUsedAt: Date.now(),
        checkedAt: Date.now(),
      };

      window.setTimeout(() => {
        if (ctrl.signal.aborted) return;
        commitKeys((prev) => [...prev.filter((k) => k.provider !== savedProvider), newEntry]);
        onSave?.(savedProvider, trimmed, savedMode);
        setForm(null);
        formAbort.current = null;
      }, 420);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setForm((prev) => (prev ? { ...prev, phase: "error", error: "Connection check failed" } : null));
      }
    }
  };

  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeForm(true);
    }
  };

  const showFooter = footer !== null;
  const resolvedFooter =
    footer !== undefined ? (
      footer
    ) : (
      <>
        <ShieldCheck aria-hidden="true" />
        <span>Keys are encrypted with AES-256 and never written to logs.</span>
      </>
    );

  return (
    <section className={`${styles.root}${className ? ` ${className}` : ""}`} aria-labelledby={headingId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={headingId} className={styles.title}>
            {title}
          </h3>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {!loading ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.headerButton}
            onClick={handleHeaderAdd}
          >
            <Plus aria-hidden="true" />
            Add key
          </Button>
        ) : null}
      </header>

      <ul className={styles.list} aria-label="API keys by provider">
        {loading
          ? providers.map((provider, idx) => (
              <li key={provider} className={`${styles.row} ${styles.skeletonRow}`} aria-hidden="true">
                <span className={`${styles.mark} ${styles.skeletonMark}`} />
                <span className={styles.name}>
                  <span className={styles.bar} style={{ width: `${72 + (idx % 3) * 18}px` }} />
                </span>
                <span className={styles.key}>
                  <span className={styles.bar} style={{ width: `${104 + (idx % 2) * 24}px` }} />
                </span>
                <span className={styles.status}>
                  <span className={styles.bar} style={{ width: "76px" }} />
                </span>
                <span className={styles.meta}>
                  <span className={styles.bar} style={{ width: "84px" }} />
                </span>
                <span className={styles.actions}>
                  <span className={styles.bar} style={{ width: "92px" }} />
                </span>
              </li>
            ))
          : providers.map((provider) => {
              const meta = PROVIDER_META[provider];
              const entry = keyMap.get(provider);
              const pendingRemoval = pendingRemovals[provider];
              const isSet = Boolean(entry && entry.status !== "unset");
              const isRevealed = Boolean(revealed[provider] && entry?.value);
              const isCopied = copiedProvider === provider;
              const isTesting = Boolean(testingRow[provider]);
              const isFormOpen = form?.provider === provider;
              const canRevealOrCopy = Boolean(entry?.value);
              const { prefix, last4 } = entry ? derivePrefixAndLast4(provider, entry) : { prefix: meta.prefix, last4: "" };

              const statusKind = isTesting
                ? "testing"
                : pendingRemoval
                  ? "removed"
                  : !isSet
                    ? "unset"
                    : entry!.status;

              const statusLabel =
                statusKind === "testing"
                  ? "Testing"
                  : statusKind === "removed"
                    ? "Removed"
                    : statusKind === "connected"
                      ? "Connected"
                      : statusKind === "invalid"
                        ? "Invalid"
                        : "Not set";

              const metaLine = pendingRemoval
                ? "Key removed"
                : !isSet
                  ? null
                  : entry!.status === "invalid"
                    ? formatRelative(entry!.checkedAt ?? entry!.lastUsedAt, now, "Rejected") ??
                      (entry!.error ? entry!.error : "Key rejected")
                    : formatRelative(entry!.lastUsedAt ?? entry!.checkedAt, now, "Used") ?? "Never used";

              const validation = isFormOpen ? validateFormat(provider, form.value) : null;
              const inputTone =
                isFormOpen && form.phase === "error"
                  ? "bad"
                  : isFormOpen && form.phase === "ok"
                    ? "ok"
                    : validation?.tone ?? "idle";

              const helpTone =
                isFormOpen && form.phase === "error"
                  ? "bad"
                  : isFormOpen && form.phase === "ok"
                    ? "ok"
                    : validation?.tone ?? "idle";

              const helpMessage =
                isFormOpen && form.phase === "testing"
                  ? "Testing connection..."
                  : isFormOpen && form.phase === "ok"
                    ? "Connected"
                    : isFormOpen && form.phase === "error"
                      ? form.error ?? "Invalid key"
                      : validation?.message ?? "";

              const inputId = `${headingId}-input-${provider}`;
              const helpId = `${headingId}-help-${provider}`;

              return (
                <li
                  key={provider}
                  className={styles.row}
                  data-state={statusKind}
                >
                  <ProviderMark provider={provider} className={styles.mark} />
                  <span className={styles.name}>{meta.name}</span>

                  <span className={styles.key}>
                    <SwapText
                      swapKey={
                        pendingRemoval
                          ? "removed"
                          : !isSet
                            ? "unset"
                            : isRevealed
                              ? `revealed-${revealed[provider]}`
                              : `masked-${last4}`
                      }
                      reduced={reduced}
                    >
                      {pendingRemoval ? (
                        <span className={styles.hint}>Removed — click Undo to restore</span>
                      ) : !isSet ? (
                        <span className={styles.hint}>Get one at {meta.consoleHost}</span>
                      ) : isRevealed ? (
                        <span className={`${styles.mono} ${styles.revealed}`}>{entry!.value}</span>
                      ) : (
                        <span className={styles.mono}>
                          {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
                          <span className={styles.dots}>••••</span>
                          <span>{last4}</span>
                        </span>
                      )}
                    </SwapText>
                  </span>

                  <span className={styles.status}>
                    <SwapText swapKey={statusKind} reduced={reduced}>
                      {isSet && !pendingRemoval ? (
                        <Tooltip
                          content={
                            entry!.status === "invalid" && entry!.error
                              ? `${entry!.error} — Click to retest`
                              : "Click to test connection"
                          }
                        >
                          <button
                            type="button"
                            className={`${styles.statusChip} ${styles.statusButton}`}
                            aria-busy={isTesting}
                            aria-label={
                              entry!.status === "invalid" && entry!.error
                                ? `${meta.name} status: Invalid (${entry!.error}). Retest connection`
                                : `${meta.name} status: ${statusLabel}. Retest connection`
                            }
                            onClick={() => handleRetest(provider)}
                          >
                            <span className={styles.statusInner}>
                              {isTesting ? (
                                <span className={styles.spinner} aria-hidden="true" />
                              ) : entry!.status === "connected" ? (
                                <CircleCheck className={styles.ok} aria-hidden="true" />
                              ) : (
                                <AlertCircle className={styles.bad} aria-hidden="true" />
                              )}
                              <span>{statusLabel}</span>
                            </span>
                          </button>
                        </Tooltip>
                      ) : (
                        <span className={styles.statusChip}>
                          <span className={styles.statusInner}>
                            <CircleDashed className={styles.idle} aria-hidden="true" />
                            <span>{statusLabel}</span>
                          </span>
                        </span>
                      )}
                    </SwapText>
                  </span>

                  <span className={styles.meta}>
                    <SwapText swapKey={metaLine ?? "empty"} reduced={reduced}>
                      {metaLine ? <span className={styles.metaText}>{metaLine}</span> : <span />}
                    </SwapText>
                  </span>

                  <span className={styles.actions}>
                    <span className={`${styles.swap} ${styles.actionSwap}`}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {pendingRemoval ? (
                          <motion.span
                            key="undo"
                            className={styles.swapItem}
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                            transition={{ duration: 0.16, ease: [...motionTokens.ease.enter] }}
                          >
                            <button
                              ref={(el) => {
                                undoRefs.current[provider] = el;
                              }}
                              type="button"
                              className={styles.pill}
                              aria-label={`Undo removing the ${meta.name} key`}
                              onClick={() => handleUndo(provider)}
                            >
                              <Undo2 aria-hidden="true" />
                              Undo
                            </button>
                          </motion.span>
                        ) : !isSet ? (
                          <motion.span
                            key="add"
                            className={styles.swapItem}
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                            transition={{ duration: 0.16, ease: [...motionTokens.ease.enter] }}
                          >
                            <button
                              ref={(el) => {
                                triggerRefs.current[`${provider}:add`] = el;
                              }}
                              type="button"
                              className={styles.pill}
                              aria-expanded={isFormOpen && form.mode === "add"}
                              aria-label={`Add ${meta.name} key`}
                              onClick={(e) => openForm(provider, "add", e.currentTarget)}
                            >
                              <Plus aria-hidden="true" />
                              Add key
                            </button>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="icons"
                            className={styles.swapItem}
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                            transition={{ duration: 0.16, ease: [...motionTokens.ease.enter] }}
                          >
                            <span className={styles.iconRow}>
                              <Tooltip content={canRevealOrCopy ? (isRevealed ? "Hide key" : "Reveal key") : "Key stored on server only"}>
                                <button
                                  type="button"
                                  className={styles.icon}
                                  disabled={!canRevealOrCopy}
                                  aria-pressed={isRevealed}
                                  aria-label={isRevealed ? `Hide the ${meta.name} key` : `Reveal the ${meta.name} key`}
                                  onClick={() => handleRevealToggle(provider)}
                                >
                                  {isRevealed && !reduced ? (
                                    <svg
                                      key={revealed[provider]}
                                      className={styles.countdown}
                                      viewBox="0 0 32 32"
                                      aria-hidden="true"
                                      style={{ "--reveal-ms": `${revealDuration}ms` } as CSSProperties}
                                    >
                                      <circle cx="16" cy="16" r="15" pathLength={100} />
                                    </svg>
                                  ) : null}
                                  <AnimatePresence mode="popLayout" initial={false}>
                                    <motion.span
                                      key={isRevealed ? "hide" : "show"}
                                      className={styles.iconSlot}
                                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                                      transition={{ duration: 0.16, ease: [...motionTokens.ease.standard] }}
                                    >
                                      {isRevealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                                    </motion.span>
                                  </AnimatePresence>
                                </button>
                              </Tooltip>

                              <Tooltip content={canRevealOrCopy ? (isCopied ? "Copied" : "Copy key") : "Key stored on server only"}>
                                <button
                                  type="button"
                                  className={`${styles.icon}${isCopied ? ` ${styles.copied}` : ""}`}
                                  disabled={!canRevealOrCopy}
                                  aria-label={`Copy the ${meta.name} key`}
                                  onClick={() => entry?.value && handleCopy(provider, entry.value)}
                                >
                                  <AnimatePresence mode="popLayout" initial={false}>
                                    <motion.span
                                      key={isCopied ? "check" : "copy"}
                                      className={styles.iconSlot}
                                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                                      transition={{ duration: 0.16, ease: [...motionTokens.ease.standard] }}
                                    >
                                      {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                                    </motion.span>
                                  </AnimatePresence>
                                </button>
                              </Tooltip>

                              <Tooltip content="Rotate key">
                                <button
                                  ref={(el) => {
                                    triggerRefs.current[`${provider}:rotate`] = el;
                                  }}
                                  type="button"
                                  className={styles.icon}
                                  aria-expanded={isFormOpen && form.mode === "rotate"}
                                  aria-label={`Rotate the ${meta.name} key`}
                                  onClick={(e) => openForm(provider, "rotate", e.currentTarget)}
                                >
                                  <span className={styles.iconSlot}>
                                    <RefreshCw aria-hidden="true" />
                                  </span>
                                </button>
                              </Tooltip>

                              <Tooltip content="Remove key">
                                <button
                                  ref={(el) => {
                                    removeRefs.current[provider] = el;
                                  }}
                                  type="button"
                                  className={`${styles.icon} ${styles.danger}`}
                                  aria-label={`Remove the ${meta.name} key`}
                                  onClick={() => handleRemove(provider)}
                                >
                                  <span className={styles.iconSlot}>
                                    <Trash2 aria-hidden="true" />
                                  </span>
                                </button>
                              </Tooltip>
                            </span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </span>

                  <AnimatePresence initial={false}>
                    {isFormOpen ? (
                      <motion.div
                        key="form"
                        className={styles.formWrap}
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
                        <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
                          <label htmlFor={inputId} className={styles.srOnly}>
                            {form.mode === "rotate" ? `New ${meta.name} API key` : `${meta.name} API key`}
                          </label>
                          <input
                            ref={inputRef}
                            id={inputId}
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            className={styles.input}
                            placeholder={meta.placeholder}
                            value={form.value}
                            readOnly={form.phase === "testing" || form.phase === "ok"}
                            data-tone={inputTone}
                            aria-invalid={inputTone === "bad"}
                            aria-describedby={helpId}
                            onChange={(e) => setForm({ ...form, value: e.target.value, phase: "idle", error: undefined })}
                          />
                          <button
                            type="button"
                            className={`${styles.pill} ${styles.cancel}`}
                            onClick={() => closeForm(true)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className={`${styles.pill} ${styles.save}`}
                            aria-disabled={form.phase === "testing" || form.phase === "ok"}
                          >
                            {form.phase === "testing" ? (
                              <>
                                <span className={styles.spinner} aria-hidden="true" />
                                Testing
                              </>
                            ) : form.phase === "ok" ? (
                              <>
                                <Check aria-hidden="true" />
                                Saved
                              </>
                            ) : form.mode === "rotate" ? (
                              "Rotate key"
                            ) : (
                              "Save key"
                            )}
                          </button>

                          <p id={helpId} className={styles.help} data-tone={helpTone}>
                            <SwapText swapKey={`${form.phase}-${helpMessage}`} reduced={reduced}>
                              <span className={styles.helpInner}>
                                {form.phase === "testing" ? (
                                  <span className={styles.spinner} aria-hidden="true" />
                                ) : helpTone === "ok" ? (
                                  <CircleCheck aria-hidden="true" />
                                ) : helpTone === "bad" ? (
                                  <AlertCircle aria-hidden="true" />
                                ) : null}
                                <span className={styles.helpText}>{helpMessage}</span>
                              </span>
                            </SwapText>
                          </p>

                          {!testKey ? (
                            <button
                              type="button"
                              className={styles.sample}
                              disabled={form.phase === "testing" || form.phase === "ok"}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  value: meta.sampleKey,
                                  phase: "idle",
                                  error: undefined,
                                })
                              }
                            >
                              Fill sample key
                            </button>
                          ) : null}
                        </form>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
      </ul>

      {showFooter ? <p className={styles.footer}>{resolvedFooter}</p> : null}

      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}
