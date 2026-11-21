"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, CircleAlert, Lock, Search, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./connector-setup.module.css";

export type ConnectorMarkId = "slack" | "github" | "notion" | "google-drive" | "linear" | "jira" | "salesforce" | "hubspot";

export interface Connector {
  id: string;
  name: string;
  description: string;
  /** A built-in mark id or your own 20px node. */
  mark: ConnectorMarkId | ReactNode;
  /** Host shown while redirecting, such as "slack.com". */
  host?: string;
  /** Workspace or account shown once connected. */
  account?: string;
  /** Plain-language capabilities granted to the assistant. */
  scopes?: string[];
  /** What the first sync counts, such as { count: 1204, noun: "messages" }. */
  sync?: { count: number; noun: string };
  keywords?: string[];
}

export interface ConnectResult { account?: string; scopes?: string[]; synced?: number; }
export type ConnectPhase = "redirecting" | "authorizing" | "syncing";
export interface ConnectReport { phase?: ConnectPhase; synced?: number; }
export interface ConnectContext { signal: AbortSignal; report: (update: ConnectReport) => void; }

export interface ConnectorSetupProps {
  connectors?: Connector[];
  connected?: string[];
  defaultConnected?: string[];
  onConnectedChange?: (ids: string[]) => void;
  connect?: (connector: Connector, context: ConnectContext) => Promise<ConnectResult | void>;
  disconnect?: (connector: Connector, context: { signal: AbortSignal }) => Promise<void>;
  onConnect?: (connector: Connector, result: ConnectResult) => void;
  onDisconnect?: (connector: Connector) => void;
  assistantName?: string;
  title?: ReactNode;
  description?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  autoPlay?: boolean;
  footer?: ReactNode;
  className?: string;
}

const marks: Record<ConnectorMarkId, (size: number) => ReactNode> = {
  "slack": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" /><path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" /><path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" /><path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" /></svg>,
  "github": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>,
  "notion": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" /></svg>,
  "google-drive": size => <svg width={size} height={size} viewBox="0 -4.65 87.3 87.3" aria-hidden="true" focusable="false"><path fill="#0066DA" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" /><path fill="#00AC47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" /><path fill="#EA4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" /><path fill="#00832D" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" /><path fill="#2684FC" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" /><path fill="#FFBA00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" /></svg>,
  "linear": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" /></svg>,
  "jira": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#1868DB" d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" /></svg>,
  "salesforce": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#00A1E0" d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8" /></svg>,
  "hubspot": size => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#FF7A59" d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" /></svg>,
};

export interface ConnectorMarkProps { mark: ConnectorMarkId | ReactNode; size?: number; }

/** The built-in app marks at any size. */
export function ConnectorMark({ mark, size = 20 }: ConnectorMarkProps) {
  const builtIn = typeof mark === "string" && mark in marks;
  return <span className={styles.mark} data-mark={builtIn ? mark as string : undefined} style={size === 20 ? undefined : { width: size, height: size }}>{builtIn ? marks[mark as ConnectorMarkId](size) : mark}</span>;
}

export const connectorSamples: Connector[] = [
  { id: "slack", name: "Slack", description: "Search channels and reply in threads", mark: "slack", host: "slack.com", account: "northwind.slack.com", scopes: ["Read messages in public channels", "Search message history", "Post replies as Claude"], sync: { count: 1204, noun: "messages" }, keywords: ["chat", "messaging", "communication"] },
  { id: "github", name: "GitHub", description: "Read code, issues and pull requests", mark: "github", host: "github.com", account: "northwind-labs", scopes: ["Read code in 12 repositories", "Read and write issues", "Comment on pull requests"], sync: { count: 342, noun: "pull requests" }, keywords: ["code", "git", "dev", "engineering"] },
  { id: "notion", name: "Notion", description: "Search pages, docs and databases", mark: "notion", host: "notion.so", account: "Northwind HQ", scopes: ["Read pages shared with Claude", "Search workspace content", "Create pages in Drafts"], sync: { count: 2318, noun: "pages" }, keywords: ["docs", "wiki", "notes"] },
  { id: "google-drive", name: "Google Drive", description: "Find and read files in Drive", mark: "google-drive", host: "accounts.google.com", account: "maya@northwind.co", scopes: ["View files you open or share", "Search file names and content", "Export files to PDF"], sync: { count: 5612, noun: "files" }, keywords: ["docs", "files", "storage", "google"] },
  { id: "linear", name: "Linear", description: "Create, triage and update issues", mark: "linear", host: "linear.app", account: "Northwind · NOR", scopes: ["Read issues and projects", "Create and update issues", "Comment on issues"], sync: { count: 864, noun: "issues" }, keywords: ["issues", "project", "engineering"] },
  { id: "jira", name: "Jira", description: "Track tickets across Atlassian projects", mark: "jira", host: "id.atlassian.com", account: "northwind.atlassian.net", scopes: ["Read issues in 4 projects", "Transition issue status", "Add comments and worklogs"], sync: { count: 1977, noun: "issues" }, keywords: ["issues", "tickets", "atlassian", "project"] },
  { id: "salesforce", name: "Salesforce", description: "Look up accounts and opportunities", mark: "salesforce", host: "login.salesforce.com", account: "Northwind Traders", scopes: ["Read accounts and contacts", "Read opportunities", "Log activity on records"], sync: { count: 428, noun: "opportunities" }, keywords: ["crm", "sales"] },
  { id: "hubspot", name: "HubSpot", description: "Read contacts, deals and notes", mark: "hubspot", host: "app.hubspot.com", account: "Portal 24019837", scopes: ["Read contacts and companies", "Read deals and pipelines", "Create notes on records"], sync: { count: 3140, noun: "contacts" }, keywords: ["crm", "marketing", "sales"] },
];

type Status = "available" | "connecting" | "connected" | "error" | "disconnecting";
interface RowState { status: Status; phase?: ConnectPhase; synced?: number; error?: string; result?: ConnectResult; fresh?: boolean; }

const number = new Intl.NumberFormat("en-US");
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
  const timer = setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
  const stop = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
  signal.addEventListener("abort", stop, { once: true });
});

/** One crossfade in a shared grid cell: out 100ms, in 160ms with a 2px rise. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={`${styles.swap} ${className ?? ""}`}>
      <AnimatePresence initial={false}>
        <SwapItem key={id} reduced={reduced}>{children}</SwapItem>
      </AnimatePresence>
    </span>
  );
}
function SwapItem({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  return <motion.span className={styles.swapItem} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease: [.16, 1, .3, 1] } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}>{children}</motion.span>;
}

export function ConnectorSetup({
  connectors = connectorSamples, connected, defaultConnected, onConnectedChange, connect, disconnect, onConnect, onDisconnect,
  assistantName = "Claude", title = "Connect your tools", description, searchable = true, searchPlaceholder = "Search apps", autoPlay, footer, className,
}: ConnectorSetupProps) {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const isSamples = connectors === connectorSamples;
  const simulated = !connect;
  const play = autoPlay ?? (isSamples && simulated);
  const initial = useMemo(() => connected ?? defaultConnected ?? (isSamples ? ["github", "google-drive"] : []), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState<Record<string, RowState>>(() => Object.fromEntries(initial.map(id => [id, { status: "connected" as Status }])));
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());
  const failedOnce = useRef(new Set<string>());
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const patch = useCallback((id: string, next: Partial<RowState>) => setRows(current => ({ ...current, [id]: { ...(current[id] ?? { status: "available" }), ...next } })), []);
  const say = useCallback((text: string) => setAnnouncement(simulated ? `${text} Simulated, nothing was sent.` : text), [simulated]);

  const statusOf = (id: string): Status => {
    const row = rows[id];
    if (connected) {
      if (row?.status === "connecting" || row?.status === "error" || row?.status === "disconnecting") return row.status;
      return connected.includes(id) ? "connected" : "available";
    }
    return row?.status ?? "available";
  };
  const connectedIds = connectors.filter(item => { const s = statusOf(item.id); return s === "connected" || s === "disconnecting"; }).map(item => item.id);
  const idsRef = useRef(connectedIds);
  useEffect(() => { idsRef.current = connectedIds; });

  useEffect(() => { const pending = aborts.current; return () => pending.forEach(controller => controller.abort()); }, []);

  const simulate = useCallback(async (item: Connector, { signal, report }: ConnectContext): Promise<ConnectResult> => {
    await wait(560, signal);
    report({ phase: "authorizing" });
    await wait(690, signal);
    if (item.id === "salesforce" && !failedOnce.current.has(item.id)) { failedOnce.current.add(item.id); throw new Error("Needs admin approval"); }
    const total = item.sync?.count ?? 0;
    report({ phase: "syncing", synced: 0 });
    await new Promise<void>((resolve, reject) => {
      const start = performance.now(), length = 1000;
      let frame = 0;
      const stop = () => { cancelAnimationFrame(frame); reject(new DOMException("Aborted", "AbortError")); };
      signal.addEventListener("abort", stop, { once: true });
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / length), eased = 1 - Math.pow(1 - t, 3);
        report({ synced: Math.round(total * eased) });
        if (t < 1) frame = requestAnimationFrame(tick); else { signal.removeEventListener("abort", stop); resolve(); }
      };
      frame = requestAnimationFrame(tick);
    });
    await wait(180, signal);
    return { account: item.account, scopes: item.scopes, synced: total };
  }, []);

  const startConnect = useCallback(async (item: Connector) => {
    aborts.current.get(item.id)?.abort();
    const controller = new AbortController();
    aborts.current.set(item.id, controller);
    patch(item.id, { status: "connecting", phase: "redirecting", synced: 0, error: undefined });
    setConfirming(null);
    say(`Connecting ${item.name}.`);
    const report = (update: ConnectReport) => { if (!controller.signal.aborted) patch(item.id, update); };
    try {
      const result = (await (connect ?? simulate)(item, { signal: controller.signal, report })) ?? {};
      if (controller.signal.aborted) return;
      const full: ConnectResult = { account: result.account ?? item.account, scopes: result.scopes ?? item.scopes, synced: result.synced ?? item.sync?.count };
      patch(item.id, { status: "connected", phase: undefined, result: full, fresh: true });
      setOpen(item.id);
      say(`${item.name} connected.${full.synced != null && item.sync ? ` ${number.format(full.synced)} ${item.sync.noun} synced.` : ""}`);
      onConnect?.(item, full);
      onConnectedChange?.(connectors.filter(c => c.id === item.id || idsRef.current.includes(c.id)).map(c => c.id));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message ? error.message : "Something went wrong";
      patch(item.id, { status: "error", phase: undefined, error: message });
      say(`${item.name} failed to connect: ${message}.`);
    } finally {
      if (aborts.current.get(item.id) === controller) aborts.current.delete(item.id);
    }
  }, [connect, connectors, onConnect, onConnectedChange, patch, say, simulate]);

  const cancel = (item: Connector) => {
    aborts.current.get(item.id)?.abort();
    aborts.current.delete(item.id);
    patch(item.id, { status: "available", phase: undefined, error: undefined });
    setAnnouncement(`${item.name} connection cancelled.`);
  };

  const runDisconnect = async (item: Connector) => {
    const controller = new AbortController();
    aborts.current.set(item.id, controller);
    patch(item.id, { status: "disconnecting" });
    try {
      if (disconnect) await disconnect(item, { signal: controller.signal }); else await wait(420, controller.signal);
      if (controller.signal.aborted) return;
      say(`${item.name} disconnected. ${assistantName} no longer has access.`);
      setOpen(current => current === item.id ? null : current);
      setConfirming(null);
      patch(item.id, { status: "available", result: undefined, fresh: false });
      onDisconnect?.(item);
      onConnectedChange?.(idsRef.current.filter(id => id !== item.id));
    } catch {
      if (!controller.signal.aborted) patch(item.id, { status: "connected" });
    } finally {
      if (aborts.current.get(item.id) === controller) aborts.current.delete(item.id);
    }
  };

  // The scripted run: connect Slack, then Salesforce fails once and is retried. It starts on screen and stops at the first interaction.
  const playing = useRef(false);
  useEffect(() => {
    const node = root.current;
    if (!play || !node) return;
    const controller = new AbortController();
    const { signal } = controller;
    const stop = () => controller.abort();
    const settled = (id: string) => new Promise<void>((resolve, reject) => {
      const check = () => {
        if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
        const status = rowsRef.current[id]?.status;
        if (status === "connected" || status === "error") resolve(); else setTimeout(check, 60);
      };
      setTimeout(check, 120);
    });
    const find = (id: string) => connectors.find(item => item.id === id);
    const run = async () => {
      if (playing.current) return;
      playing.current = true;
      try {
        const first = find("slack"), second = find("salesforce");
        await wait(900, signal);
        if (first && (rowsRef.current[first.id]?.status ?? "available") === "available") {
          void startConnect(first);
          await settled(first.id);
          await wait(2500, signal);
          setOpen(current => current === first.id ? null : current);
          await wait(260, signal);
        }
        if (second && (rowsRef.current[second.id]?.status ?? "available") === "available") {
          void startConnect(second);
          await settled(second.id);
          if (rowsRef.current[second.id]?.status === "error") {
            await wait(1450, signal);
            void startConnect(second);
          }
        }
      } catch { /* stopped by the first interaction */ }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); void run(); } }, { threshold: .4 });
    if (observer) observer.observe(node); else void run();
    node.addEventListener("pointerdown", stop, { once: true });
    node.addEventListener("keydown", stop, { once: true });
    return () => { observer?.disconnect(); controller.abort(); node.removeEventListener("pointerdown", stop); node.removeEventListener("keydown", stop); };
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = query.trim().toLowerCase();
  const visible = needle ? connectors.filter(item => [item.name, item.description, item.account ?? "", ...(item.keywords ?? [])].some(text => text.toLowerCase().includes(needle))) : connectors;
  const clear = () => { setQuery(""); input.current?.focus(); };
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Escape" && query) { event.preventDefault(); setQuery(""); } };

  return (
    <div ref={root} className={`${styles.root} ${className ?? ""}`} role="group" aria-labelledby={`${uid}-title`}>
      <div className={styles.header}>
        <div className={styles.headText}>
          <h3 id={`${uid}-title`} className={styles.title}>{title}</h3>
          <p className={styles.description}>{description ?? `Let ${assistantName} search and act in the apps your team uses.`}</p>
        </div>
        <span className={styles.count}>
          <span className={styles.srOnly}>{connectedIds.length} of {connectors.length} connected</span>
          <span className={styles.countVisual} aria-hidden="true">
            <Swap id={String(connectedIds.length)} className={styles.countNum} reduced={reduced}>{connectedIds.length}</Swap>
            <span>of {connectors.length} connected</span>
          </span>
        </span>
      </div>

      {searchable && (
        <div className={styles.search}>
          <Search size={16} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
          <input ref={input} className={styles.searchInput} type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder} aria-controls={`${uid}-list`} autoComplete="off" spellCheck={false} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onSearchKey} />
          <AnimatePresence initial={false}>
            {query && (
              <motion.button key="clear" className={styles.clear} type="button" aria-label="Clear search" onClick={clear} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .12 }}>
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {visible.length === 0 ? (
        <div id={`${uid}-list`} className={styles.empty}>
          <p className={styles.emptyTitle}>No apps match “{query.trim()}”</p>
          <p className={styles.emptyCopy}>Try a product name or a category like crm or docs.</p>
          <Button variant="secondary" size="sm" className={styles.action} onClick={clear}>Clear search</Button>
        </div>
      ) : (
        <ul id={`${uid}-list`} className={styles.list} aria-label="Apps">
          {visible.map(item => {
            const row = rows[item.id];
            const status = statusOf(item.id);
            const isConnected = status === "connected" || status === "disconnecting";
            const isOpen = isConnected && open === item.id;
            const result = row?.result;
            const account = result?.account ?? item.account;
            const synced = result?.synced ?? item.sync?.count;
            const scopes = result?.scopes ?? item.scopes ?? [];
            const total = item.sync?.count ?? 0;
            const phase = row?.phase ?? "redirecting";
            const progress = phase === "redirecting" ? .16 : phase === "authorizing" ? .4 : .4 + .6 * (total > 0 ? Math.min(1, (row?.synced ?? 0) / total) : 1);
            const detailsId = `${uid}-${item.id}-details`;

            let lineKey: string, line: ReactNode, lineTone = "";
            if (status === "connecting") {
              lineTone = styles.lineLive;
              if (phase === "syncing") {
                lineKey = "syncing";
                line = (
                  <span className={styles.syncLine}>Syncing{" "}
                    {item.sync ? <><span className={styles.num}><span className={styles.numGhost} aria-hidden="true">{number.format(total)}</span><span>{number.format(row?.synced ?? 0)}</span></span>{" "}{item.sync.noun}</> : "…"}
                  </span>
                );
              } else {
                const text = phase === "redirecting" ? `Redirecting to ${item.host ?? item.name}` : `Authorizing ${account ?? item.name}`;
                lineKey = phase;
                line = <TextShimmer active={!reduced}>{text}</TextShimmer>;
              }
            } else if (status === "error") {
              lineKey = "error"; lineTone = styles.lineError;
              line = <span className={styles.errorLine}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.ellipsis}>{row?.error}</span></span>;
            } else if (isConnected) {
              lineKey = "connected";
              line = <span className={styles.ellipsis}>{[account, synced != null && item.sync ? `${number.format(synced)} ${item.sync.noun}` : null].filter(Boolean).join(" · ") || item.description}</span>;
            } else {
              lineKey = "available";
              line = <span className={styles.ellipsis}>{item.description}</span>;
            }

            let actionKey: string, action: ReactNode;
            if (status === "connecting") {
              actionKey = "cancel";
              action = <Button variant="ghost" size="sm" className={styles.action} aria-label={`Cancel connecting ${item.name}`} onClick={() => cancel(item)}>Cancel</Button>;
            } else if (status === "error") {
              actionKey = "retry";
              action = <Button variant="secondary" size="sm" className={`${styles.action} ${styles.connect}`} aria-label={`Retry connecting ${item.name}`} onClick={() => void startConnect(item)}>Retry</Button>;
            } else if (isConnected) {
              actionKey = "connected";
              action = (
                <Button variant="ghost" size="sm" className={`${styles.action} ${styles.connectedBtn}`} aria-expanded={isOpen} aria-controls={detailsId} aria-label={`${item.name} connected. ${isOpen ? "Hide" : "Show"} access details`} onClick={() => { setOpen(isOpen ? null : item.id); setConfirming(null); }}>
                  <Check size={16} strokeWidth={2} className={styles.ok} aria-hidden="true" />
                  <span className={styles.connectedLabel}>Connected</span>
                  <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} data-open={isOpen ? "true" : undefined} aria-hidden="true" />
                </Button>
              );
            } else {
              actionKey = "connect";
              action = <Button variant="secondary" size="sm" className={`${styles.action} ${styles.connect}`} aria-label={`Connect ${item.name}`} onClick={() => void startConnect(item)}>Connect</Button>;
            }

            const confirm = confirming === item.id;
            return (
              <li key={item.id} className={styles.row} data-status={status === "disconnecting" ? "connected" : status} data-active={status === "connecting" || isOpen ? "true" : undefined}>
                <div className={styles.rowMain}>
                  <ConnectorMark mark={item.mark} />
                  <span className={styles.text}>
                    <span className={styles.name}>{item.name}</span>
                    <Swap id={lineKey} className={`${styles.line} ${lineTone}`} reduced={reduced}>{line}</Swap>
                  </span>
                  <span className={styles.actionSlot}>
                    <Swap id={actionKey} className={styles.actionSwap} reduced={reduced}>{action}</Swap>
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {status === "connecting" && (
                    <motion.span key="track" className={styles.track} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .16 }}>
                      <motion.span className={styles.fill} initial={{ scaleX: 0 }} animate={{ scaleX: progress }} transition={phase === "syncing" || reduced ? { duration: 0 } : { duration: .3, ease: [.22, 1, .36, 1] }} />
                    </motion.span>
                  )}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div key="details" id={detailsId} className={styles.detailsClip} role="region" aria-label={`${item.name} access`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: .24, bounce: 0 }}
                      onKeyDown={event => { if (event.key === "Escape" && confirm) { event.stopPropagation(); setConfirming(null); } }}>
                      <div className={styles.details}>
                        <span className={styles.detailsLabel}>{assistantName} can</span>
                        <ul className={styles.scopes}>
                          {scopes.map(scope => <li key={scope} className={styles.scope}><Check size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.scopeText}>{scope}</span></li>)}
                        </ul>
                        <div className={styles.detailsFoot}>
                          <Swap id={confirm ? "confirm" : "idle"} className={styles.footSwap} reduced={reduced}>
                            {confirm ? (
                              <span className={styles.footRow}>
                                <span className={`${styles.footText} ${styles.confirmText} ${styles.ellipsis}`}>Remove access?</span>
                                <span className={styles.footActions}>
                                  <Button variant="ghost" size="sm" className={`${styles.action} ${styles.keep}`} disabled={status === "disconnecting"} onClick={() => setConfirming(null)}>Keep</Button>
                                  <Button variant="danger" size="sm" className={styles.action} aria-label={`Disconnect ${item.name} and remove ${assistantName}'s access`} disabled={status === "disconnecting"} onClick={() => void runDisconnect(item)}>Disconnect</Button>
                                </span>
                              </span>
                            ) : (
                              <span className={styles.footRow}>
                                <span className={`${styles.footText} ${styles.ellipsis}`}>{row?.fresh ? "Synced just now" : "Synced 12 min ago"}</span>
                                <span className={styles.footActions}>
                                  <Button variant="secondary" size="sm" className={styles.action} onClick={() => setConfirming(item.id)}>Disconnect</Button>
                                </span>
                              </span>
                            )}
                          </Swap>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}

      {footer !== null && (
        <div className={styles.footer}>
          {footer ?? <><Lock size={14} strokeWidth={1.75} aria-hidden="true" /><span>{assistantName} only sees what you grant.</span></>}
        </div>
      )}
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

export default ConnectorSetup;
