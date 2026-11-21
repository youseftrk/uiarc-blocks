"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, CircleAlert, CircleCheck, CreditCard, Phone, ScanSearch, ShieldCheck, Square, UserRound } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { useReducedMotion } from "../use-reduced-motion";
import { ClaudeMark } from "./marks";
import styles from "./pii-redaction.module.css";

export type PiiType = "name" | "email" | "phone" | "card";

export interface PiiMatch {
  type: PiiType;
  start: number;
  end: number;
}

export interface PiiEntity extends PiiMatch {
  value: string;
  token: string;
}

export type PiiRedactionPhase = "idle" | "scanning" | "redacted" | "sending" | "thinking" | "streaming" | "restoring" | "done" | "error";

export interface PiiRedactionProps {
  defaultMessage?: string;
  editable?: boolean;
  names?: string[];
  detect?: (text: string, signal: AbortSignal) => PiiMatch[] | Promise<PiiMatch[]>;
  send?: (prompt: string, signal: AbortSignal) => Promise<string>;
  model?: { name: string; mark?: ReactNode };
  autoPlay?: boolean;
  showOriginal?: boolean;
  defaultShowOriginal?: boolean;
  onShowOriginalChange?: (show: boolean) => void;
  onRedact?: (result: { prompt: string; entities: PiiEntity[] }) => void;
  onReply?: (reply: { raw: string; restored: string }) => void;
  onPhaseChange?: (phase: PiiRedactionPhase) => void;
  className?: string;
}

export const piiSampleMessage =
  "Hi, this is Sofia Ramirez. I was charged twice for my October 24 order on the card 4539 1488 0343 6467. Could you refund the duplicate $48.00? You can reach me at sofia.ramirez@fastmail.com or +1 415 555 0132.";

const DEFAULT_NAMES = ["Sofia Ramirez"];
const DEFAULT_MODEL = { name: "Claude Sonnet 5.5" };
const TYPES: { type: PiiType; label: string; icon: typeof UserRound }[] = [
  { type: "name", label: "Name", icon: UserRound },
  { type: "email", label: "Email", icon: AtSign },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "card", label: "Card", icon: CreditCard },
];
const TYPE_LABEL: Record<PiiType, string> = { name: "Name", email: "Email", phone: "Phone", card: "Card" };
const EASE = [0.22, 1, 0.36, 1] as const;

function luhn(digits: string) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds emails, Luhn-valid card numbers, phone numbers and names. Pure and safe on the server. */
export function detectPii(text: string, options: { names?: string[] } = {}): PiiMatch[] {
  const found: PiiMatch[] = [];
  const free = (start: number, end: number) => found.every((m) => end <= m.start || start >= m.end);
  const add = (type: PiiType, start: number, end: number) => {
    if (end > start && free(start, end)) found.push({ type, start, end });
  };
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) add("email", m.index, m.index + m[0].length);
  for (const m of text.matchAll(/(?<![\d+])\d(?:[ -]?\d){12,18}(?!\d)/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) add("card", m.index, m.index + m[0].length);
  }
  for (const m of text.matchAll(/(?<![\w@.])(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?)?\d{2,4}(?:[ .-]?\d{2,4}){1,4}(?![\w@])/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) add("phone", m.index, m.index + m[0].length);
  }
  for (const name of options.names ?? []) {
    if (!name.trim()) continue;
    for (const m of text.matchAll(new RegExp(`(?<![A-Za-z])${escape(name.trim())}(?![A-Za-z])`, "gi"))) add("name", m.index, m.index + m[0].length);
  }
  for (const m of text.matchAll(/(?:\bI'm|\bI am|\b[Tt]his is|\b[Mm]y name is)\s+([A-Z][a-z'-]+(?:\s[A-Z][a-z'-]+){0,2})/g)) {
    const start = m.index + m[0].length - m[1].length;
    add("name", start, start + m[1].length);
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Swaps each span for a numbered placeholder. A repeated value keeps the same token. */
export function redactPii(text: string, matches: PiiMatch[]): { prompt: string; entities: PiiEntity[] } {
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const counts: Record<string, number> = {};
  const tokens = new Map<string, string>();
  const entities: PiiEntity[] = [];
  let prompt = "";
  let at = 0;
  for (const match of sorted) {
    if (match.start < at || match.end <= match.start || match.end > text.length) continue;
    const value = text.slice(match.start, match.end);
    const key = `${match.type}:${value.toLowerCase()}`;
    let token = tokens.get(key);
    if (!token) {
      counts[match.type] = (counts[match.type] ?? 0) + 1;
      token = `[${match.type.toUpperCase()}_${counts[match.type]}]`;
      tokens.set(key, token);
    }
    entities.push({ type: match.type, start: match.start, end: match.end, value, token });
    prompt += text.slice(at, match.start) + token;
    at = match.end;
  }
  return { prompt: prompt + text.slice(at), entities };
}

/** Puts the original values back. Unknown tokens stay as they are. */
export function restorePii(reply: string, entities: PiiEntity[]): string {
  const byToken = new Map(entities.map((e) => [e.token, e.value]));
  return reply.replace(/\[[A-Z]+_\d+\]/g, (token) => byToken.get(token) ?? token);
}

type Piece = { text: string; type?: PiiType; token?: string; value?: string };

function tokenPieces(text: string, entities: PiiEntity[]): Piece[] {
  const byToken = new Map(entities.map((e) => [e.token, e]));
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(/\[[A-Z]+_\d+\]/g)) {
    const entity = byToken.get(m[0]);
    if (!entity) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ text: m[0], type: entity.type, token: entity.token, value: entity.value });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

function chunk(pieces: Piece[]): Piece[][] {
  const words: Piece[] = [];
  for (const piece of pieces) {
    if (piece.type) words.push(piece);
    else for (const part of piece.text.match(/\s*\S+\s*|\s+/g) ?? []) words.push({ text: part });
  }
  const sizes = [3, 4, 5, 6, 4, 3, 5];
  const out: Piece[][] = [];
  let i = 0;
  let n = 0;
  while (i < words.length) {
    const size = sizes[n++ % sizes.length];
    out.push(words.slice(i, i + size));
    i += size;
  }
  return out;
}

function simulate(entities: PiiEntity[]) {
  const token = (type: PiiType) => entities.find((e) => e.type === type)?.token;
  const name = token("name");
  const card = token("card");
  const email = token("email");
  const phone = token("phone");
  return (
    `Thanks${name ? `, ${name}` : ""}. I can see two charges of $48.00${card ? ` on ${card}` : ""} from October 24, and the second one is a duplicate. ` +
    `I have started a refund, which usually lands in 3 to 5 business days. A confirmation is on its way${email ? ` to ${email}` : ""}` +
    (phone ? `, and we will text ${phone} if we need anything else.` : ".")
  );
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) return abort();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      abort();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function Swap({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <span className={`${styles.swap} ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Leg({ dir, reduced }: { dir: 0 | 1 | -1; reduced: boolean }) {
  return (
    <span className={styles.leg} aria-hidden="true" data-active={dir !== 0 || undefined}>
      <span className={styles.legLine} />
      {dir !== 0 && !reduced ? (
        <motion.span
          key={dir}
          className={styles.legTrack}
          initial={{ x: dir === 1 ? "0%" : "100%" }}
          animate={{ x: dir === 1 ? "100%" : "0%" }}
          transition={{ duration: 0.46, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.span
            className={styles.dot}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.46, times: [0, 0.15, 0.85, 1], ease: "linear" }}
          />
        </motion.span>
      ) : null}
    </span>
  );
}

const BUSY: PiiRedactionPhase[] = ["scanning", "sending", "thinking", "streaming", "restoring"];

export function PiiRedaction({
  defaultMessage = piiSampleMessage,
  editable = true,
  names = DEFAULT_NAMES,
  detect,
  send,
  model = DEFAULT_MODEL,
  autoPlay = true,
  showOriginal,
  defaultShowOriginal = false,
  onShowOriginalChange,
  onRedact,
  onReply,
  onPhaseChange,
  className,
}: PiiRedactionProps) {
  const reduced = useReducedMotion();
  const uid = useId();
  const [message, setMessage] = useState(defaultMessage);
  const [phase, setPhaseState] = useState<PiiRedactionPhase>("idle");
  const [result, setResult] = useState<{ prompt: string; entities: PiiEntity[] } | null>(null);
  const [hits, setHits] = useState(0);
  const [raw, setRaw] = useState("");
  const [shown, setShown] = useState(0);
  const [error, setError] = useState("");
  const [failedAt, setFailedAt] = useState<"scan" | "send">("scan");
  const [localOriginal, setLocalOriginal] = useState(defaultShowOriginal);
  const original = showOriginal ?? localOriginal;

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const touched = useRef(false);
  const flows = useRef<{ scan: (signal: AbortSignal) => Promise<{ prompt: string; entities: PiiEntity[] }>; send: (r: { prompt: string; entities: PiiEntity[] }, signal: AbortSignal) => Promise<void>; reset: () => void } | null>(null);

  const go = (next: PiiRedactionPhase) => {
    setPhaseState(next);
    onPhaseChange?.(next);
  };

  const preview = result ?? redactPii(message, detect ? [] : detectPii(message, { names }));
  const entities = preview.entities;
  const simulated = !send;

  const scanFlow = async (signal: AbortSignal) => {
    setError("");
    setResult(null);
    setHits(0);
    setRaw("");
    setShown(0);
    go("scanning");
    try {
      const matches = detect ? await detect(message, signal) : detectPii(message, { names });
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const next = redactPii(message, matches);
      setResult(next);
      if (!reduced) {
        await wait(380, signal);
        for (let i = 0; i < next.entities.length; i++) {
          setHits(i + 1);
          await wait(120, signal);
        }
        await wait(190, signal);
      }
      setHits(next.entities.length);
      go("redacted");
      onRedact?.(next);
      return next;
    } catch (cause) {
      if (!signal.aborted) {
        setFailedAt("scan");
        setError(cause instanceof Error ? cause.message : "The scan failed");
        go("error");
      }
      throw cause;
    }
  };

  const sendFlow = async (target: { prompt: string; entities: PiiEntity[] }, signal: AbortSignal) => {
    setError("");
    setRaw("");
    setShown(0);
    try {
      go("sending");
      if (!reduced) await wait(460, signal);
      go("thinking");
      let reply: string;
      if (send) reply = await send(target.prompt, signal);
      else {
        await wait(reduced ? 200 : 700, signal);
        reply = simulate(target.entities);
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      setRaw(reply);
      go("streaming");
      const total = chunk(tokenPieces(reply, target.entities)).length;
      if (reduced) setShown(total);
      else {
        for (let i = 0; i < total; i++) {
          setShown(i + 1);
          await wait(34, signal);
        }
        await wait(240, signal);
      }
      go("restoring");
      await wait(reduced ? 0 : 465, signal);
      go("done");
      onReply?.({ raw: reply, restored: restorePii(reply, target.entities) });
    } catch (cause) {
      if (!signal.aborted) {
        setFailedAt("send");
        setError(cause instanceof Error ? cause.message : "The request failed");
        go("error");
      }
      throw cause;
    }
  };

  const resetState = () => {
    setResult(null);
    setHits(0);
    setRaw("");
    setShown(0);
    setError("");
    go("idle");
  };

  useLayoutEffect(() => {
    flows.current = { scan: scanFlow, send: sendFlow, reset: resetState };
  });

  const begin = () => {
    touched.current = true;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    return next.signal;
  };

  const scan = () => {
    const signal = begin();
    scanFlow(signal).catch(() => {});
  };

  const sendNow = () => {
    if (!result) return;
    const signal = begin();
    sendFlow(result, signal).catch(() => {});
  };

  const runAgain = () => {
    const signal = begin();
    scanFlow(signal)
      .then(async (next) => {
        await wait(reduced ? 0 : 640, signal);
        await sendFlow(next, signal);
      })
      .catch(() => {});
  };

  const stop = () => {
    begin();
    if (phase === "scanning") resetState();
    else {
      setRaw("");
      setShown(0);
      go("redacted");
    }
  };

  const reset = () => {
    begin();
    resetState();
    requestAnimationFrame(() => fieldRef.current?.focus());
  };

  const primary = () => {
    if (phase === "idle") scan();
    else if (BUSY.includes(phase)) stop();
    else if (phase === "redacted") sendNow();
    else if (phase === "done") runAgain();
    else if (failedAt === "send" && result) sendNow();
    else scan();
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!autoPlay || reduced || !el) return;
    let alive = true;
    let visible = false;
    let running = false;
    const loop = async () => {
      if (running) return;
      running = true;
      try {
        while (alive && visible && !touched.current) {
          const own = new AbortController();
          controller.current = own;
          await wait(935, own.signal);
          const f = flows.current;
          if (!f || touched.current) break;
          const next = await f.scan(own.signal);
          await wait(640, own.signal);
          if (touched.current) break;
          await (flows.current ?? f).send(next, own.signal);
          await wait(2800, own.signal);
          if (touched.current || !alive) break;
          (flows.current ?? f).reset();
        }
      } catch {
        /* aborted */
      }
      running = false;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.intersectionRatio >= 0.25;
        if (visible) loop();
      },
      { threshold: [0, 0.25, 0.5] },
    );
    observer.observe(el);
    return () => {
      alive = false;
      observer.disconnect();
      controller.current?.abort();
    };
  }, [autoPlay, reduced]);

  const onFieldKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      scan();
      primaryRef.current?.focus();
    }
  };

  const toggleOriginal = (next: boolean) => {
    touched.current = true;
    if (showOriginal === undefined) setLocalOriginal(next);
    onShowOriginalChange?.(next);
  };

  const idle = phase === "idle";
  const scanning = phase === "scanning";
  const hasPrompt = !idle && !scanning && !(phase === "error" && failedAt === "scan");
  const showSafe = hasPrompt && !original;
  const count = entities.length;

  const originalPieces: ReactNode[] = [];
  {
    let at = 0;
    entities.forEach((entity, i) => {
      if (entity.start > at) originalPieces.push(message.slice(at, entity.start));
      originalPieces.push(
        <mark
          key={i}
          className={styles.mark}
          data-type={entity.type}
          data-hit={(scanning ? i < hits : !idle) || undefined}
          aria-label={`${TYPE_LABEL[entity.type]}, redacted as ${entity.token.slice(1, -1)}`}
        >
          {entity.value}
        </mark>,
      );
      at = entity.end;
    });
    originalPieces.push(message.slice(at) + "\u200b");
  }

  const token = (piece: Piece, key: number) =>
    piece.type ? (
      <span key={key} className={styles.token} data-type={piece.type}>
        {piece.text}
      </span>
    ) : (
      piece.text
    );

  const replyPieces = tokenPieces(raw, entities);
  const chunks = chunk(replyPieces);
  const replyStage = phase === "streaming" ? "raw" : phase === "restoring" || phase === "done" ? "restored" : "empty";

  const cell = (type: PiiType): { state: "idle" | "checking" | "found" | "none"; token?: string } => {
    if (idle || (phase === "error" && failedAt === "scan")) return { state: "idle" };
    const index = entities.findIndex((e) => e.type === type);
    if (scanning) return index >= 0 && index < hits ? { state: "found", token: entities[index].token } : { state: "checking" };
    return index >= 0 ? { state: "found", token: entities[index].token } : { state: "none" };
  };

  const STATUS: Record<PiiRedactionPhase, string> = {
    idle: "Ready to scan",
    scanning: "Scanning for personal data",
    redacted: count === 0 ? "Nothing to redact" : `${count} item${count === 1 ? "" : "s"} redacted`,
    sending: "Sending the safe prompt",
    thinking: `Waiting for ${model.name.split(" ")[0]}`,
    streaming: "Receiving the reply",
    restoring: "Restoring your details",
    done: "Reply restored",
    error: error || "Something went wrong",
  };
  const busy = BUSY.includes(phase);
  const success = phase === "redacted" || phase === "done";
  const showSimulated = simulated && (phase === "streaming" || phase === "restoring" || phase === "done");
  const primaryLabel = idle ? "Scan" : busy ? "Stop" : phase === "redacted" ? "Send" : phase === "done" ? "Run again" : "Retry";
  const showReset = phase === "redacted" || phase === "done" || phase === "error";
  const mark = model.mark ?? <ClaudeMark className={styles.claude} />;
  const sectionLabel = !hasPrompt ? "Message" : original ? "Original message" : "Safe prompt";

  return (
    <div ref={rootRef} className={`${styles.root} ${className ?? ""}`} data-phase={phase}>
      <section className={styles.section} aria-label={sectionLabel}>
        <div className={styles.head}>
          <Swap id={sectionLabel} className={styles.label}>
            <span aria-hidden="true">{sectionLabel}</span>
          </Swap>
          <span className={styles.toggle}>
            <label htmlFor={`${uid}-original`} className={styles.toggleLabel} data-disabled={!hasPrompt || undefined}>
              Show original
            </label>
            <Switch className={styles.switch} id={`${uid}-original`} checked={hasPrompt && original} onCheckedChange={toggleOriginal} disabled={!hasPrompt} />
          </span>
        </div>
        <div className={styles.well} data-editing={(idle && editable) || undefined}>
          <div className={styles.stack}>
            <p className={styles.layer} aria-hidden={showSafe || (idle && editable) ? true : undefined} data-on={!showSafe || undefined} data-editing={(idle && editable) || undefined}>
              {originalPieces}
            </p>
            <p className={styles.layer} aria-hidden={showSafe ? undefined : true} data-on={showSafe || undefined}>
              {tokenPieces(preview.prompt, entities).map(token)}
            </p>
            {idle && editable ? (
              <textarea
                ref={fieldRef}
                className={styles.field}
                spellCheck={false}
                rows={1}
                aria-label="Message to check for personal data"
                placeholder="Paste a message with a name, email, phone number or card"
                value={message}
                onChange={(event) => {
                  touched.current = true;
                  controller.current?.abort();
                  setMessage(event.target.value);
                }}
                onKeyDown={onFieldKeyDown}
              />
            ) : null}
          </div>
        </div>
        <ul className={styles.types} aria-label="Detected entities">
          {TYPES.map(({ type, label, icon: Icon }) => {
            const c = cell(type);
            return (
              <li key={type} className={styles.type} data-type={type} data-state={c.state}>
                <Icon className={styles.typeIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.typeLabel}>{label}</span>
                <Swap id={c.state + (c.token ?? "")} className={styles.typeDetail}>
                  {c.state === "found" ? (
                    <span className={styles.typeToken}>{c.token}</span>
                  ) : c.state === "checking" ? (
                    <TextShimmer active={!reduced}>Checking</TextShimmer>
                  ) : (
                    <span>{c.state === "none" ? "None found" : "Not scanned"}</span>
                  )}
                </Swap>
              </li>
            );
          })}
        </ul>
      </section>

      <div className={styles.flow} aria-hidden="true">
        <span className={styles.node} data-active={phase === "done" || undefined}>
          <Avatar name={names[0] ?? "You"} size="sm" className={styles.avatar} />
          <span className={styles.nodeLabel}>You</span>
        </span>
        <Leg dir={scanning ? 1 : phase === "restoring" ? -1 : 0} reduced={reduced} />
        <span className={styles.node} data-active={scanning || phase === "restoring" || undefined}>
          <ShieldCheck size={16} strokeWidth={1.75} />
          <TextShimmer className={styles.nodeLabel} active={(scanning || phase === "restoring") && !reduced}>
            PII guard
          </TextShimmer>
        </span>
        <Leg dir={phase === "sending" ? 1 : phase === "streaming" ? -1 : 0} reduced={reduced} />
        <span className={styles.node} data-active={phase === "thinking" || phase === "streaming" || undefined}>
          <span className={styles.nodeMark}>{mark}</span>
          <TextShimmer className={`${styles.nodeLabel} ${styles.modelName}`} active={(phase === "thinking" || phase === "streaming") && !reduced}>
            {model.name}
          </TextShimmer>
        </span>
      </div>

      <section className={styles.section} aria-labelledby={`${uid}-reply`}>
        <div className={styles.head}>
          <span className={styles.label}>
            <span className={styles.replyMark} aria-hidden="true">
              {mark}
            </span>
            <span id={`${uid}-reply`}>Reply from {model.name}</span>
          </span>
          <Swap id={replyStage} className={styles.replyMeta}>
            {replyStage === "raw" ? (
              <span>With placeholders</span>
            ) : replyStage === "restored" ? (
              <span className={styles.replyRestored}>
                <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
                Restored
              </span>
            ) : (
              <span />
            )}
          </Swap>
        </div>
        <div className={styles.wellClip}>
          <div className={`${styles.well} ${styles.replyWell}`}>
            <div className={styles.stack}>
              <p className={`${styles.layer} ${styles.placeholder}`} aria-hidden={replyStage === "empty" ? undefined : true} data-on={replyStage === "empty" || undefined}>
                <Swap id={phase === "error" && failedAt === "send" ? "error" : "hint"}>
                  <span>{phase === "error" && failedAt === "send" ? STATUS.error : "The reply shows here, with your details put back."}</span>
                </Swap>
              </p>
              <p className={styles.layer} aria-hidden={replyStage === "raw" ? undefined : true} data-on={replyStage === "raw" || undefined}>
                {chunks.slice(0, shown).map((group, i) => (
                  <motion.span key={i} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, ease: EASE }}>
                    {group.map(token)}
                  </motion.span>
                ))}
              </p>
              <p className={styles.layer} aria-hidden={replyStage === "restored" ? undefined : true} data-on={replyStage === "restored" || undefined}>
                {replyPieces.map((piece, i) =>
                  piece.type ? (
                    <mark key={i} className={styles.mark} data-type={piece.type} data-hit="">
                      {piece.value}
                    </mark>
                  ) : (
                    piece.text
                  ),
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.footer}>
        <span className={styles.status} data-tone={success ? "success" : phase === "error" ? "danger" : undefined}>
          <Swap id={phase + STATUS[phase]} className={styles.statusSwap}>
            <span className={styles.statusIcon} aria-hidden="true">
              {busy ? (
                <svg className={styles.spinner} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" strokeOpacity=".2" strokeWidth="1.75" />
                  <path d="M8 2a6 6 0 0 1 6 6" strokeWidth="1.75" />
                </svg>
              ) : success ? (
                <CircleCheck size={16} strokeWidth={1.75} />
              ) : phase === "error" ? (
                <CircleAlert size={16} strokeWidth={1.75} />
              ) : (
                <ScanSearch size={16} strokeWidth={1.75} />
              )}
            </span>
            <TextShimmer className={styles.statusLabel} active={busy && !reduced}>
              {STATUS[phase]}
            </TextShimmer>
            {showSimulated && !busy ? <span className={styles.simulated}>Simulated</span> : null}
          </Swap>
        </span>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {STATUS[phase]}.{showSimulated ? " Simulated, nothing was sent." : ""}
        </span>
        <span className={styles.actions}>
          <AnimatePresence initial={false}>
            {showReset ? (
              <motion.span key="reset" className={styles.resetSlot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: EASE }}>
                <Button variant="ghost" size="sm" className={styles.action} onClick={reset}>
                  Reset
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button
            ref={primaryRef}
            variant={idle || phase === "redacted" ? "primary" : "secondary"}
            size="sm"
            className={`${styles.action} ${idle || phase === "redacted" ? styles.accent : ""}`}
            onClick={primary}
          >
            {busy ? <Square size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" /> : null}
            {primaryLabel}
          </Button>
        </span>
      </div>
    </div>
  );
}

export default PiiRedaction;
