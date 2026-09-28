"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CodeXml,
  FileText,
  Globe,
  Image as ImageIcon,
  LoaderCircle,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  Pencil,
  RotateCcw,
  Search,
  SquarePen,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { TextScramble } from "../text-scramble";
import { TextShimmer } from "../text-shimmer";
import { motionTokens as T, cx } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import {
  DEFAULT_CONVERSATIONS,
  MODELS,
  SUGGESTIONS,
  scriptedRespond,
  type Answer,
  type AssistantMessage,
  type Attachment,
  type Conversation,
  type Message,
  type Model,
  type Responder,
  type Source,
  type StreamEvent,
  type Suggestion,
  type ToolCall,
  type UserMessage,
} from "./ai-chat-data";
import { CopyButton, Markdown, PlainText } from "./ai-chat-markdown";
import styles from "./ai-chat.module.css";

const { spring, duration, blur } = T;
const enter = T.ease.enter;
const standard = T.ease.standard;
const springFor = (period: number, bounce: number) => {
  const w = (2 * Math.PI) / (1.2 * period);
  return { type: "spring" as const, stiffness: w * w, damping: 2 * (1 - bounce) * w, mass: 1 };
};
const OPEN_SPRING = springFor(0.44, 0.12);
const CLOSE_SPRING = springFor(0.34, 0);
const QUICK_SPRING = springFor(0.3, 0.08);
const noop = () => () => {};

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function useControllable<V>(value: V | undefined, fallback: V, onChange?: (v: V) => void): [V, (v: V) => void] {
  const [inner, setInner] = useState(fallback);
  const controlled = value !== undefined;
  const set = useCallback(
    (v: V) => {
      if (!controlled) setInner(v);
      onChange?.(v);
    },
    [controlled, onChange],
  );
  return [controlled ? value : inner, set];
}

function AutoHeight({ children, className, reduced }: { children: ReactNode; className?: string; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={styles.autoHeight} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : spring.smooth}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </motion.div>
  );
}

function SwapIcon({ id, reduced, children }: { id: string; reduced: boolean; children: ReactNode }) {
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 };
  return (
    <span className={styles.swapCell} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={hidden}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ ...hidden, transition: { duration: reduced ? 0.08 : duration.instant } }}
          transition={reduced ? { duration: 0.12 } : { ...spring.smooth, opacity: { duration: duration.fast } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type Card = { source: Source; n: number; key: string; width: number; x: number; below: boolean; origin: number; top?: number; bottom?: number };
type CiteApi = {
  cardId: string;
  openKey: string | null;
  show: (source: Source, n: number, anchor: HTMLElement, key: string) => void;
  hide: (delay?: number) => void;
  keep: () => void;
  toggle: (source: Source, n: number, anchor: HTMLElement, key: string, mouse: boolean) => void;
};
const CiteContext = createContext<CiteApi | null>(null);

function Cite({ source, n, id }: { source: Source | undefined; n: number; id: string }) {
  const api = useContext(CiteContext);
  const pointer = useRef("");
  if (!source || !api) return <span className={styles.citeMissing}>[{n}]</span>;
  const open = api.openKey === id;
  return (
    <button
      type="button"
      className={styles.cite}
      data-open={open || undefined}
      aria-label={`Source ${n}: ${source.title}, ${hostname(source.url)}`}
      aria-expanded={open}
      aria-controls={open ? api.cardId : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") api.show(source, n, e.currentTarget, id);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") api.hide(140);
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) api.show(source, n, e.currentTarget, id);
      }}
      onBlur={(e) => {
        if (!document.getElementById(api.cardId)?.contains(e.relatedTarget as Node)) api.hide(120);
      }}
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
      }}
      onClick={(e) => {
        api.toggle(source, n, e.currentTarget, id, pointer.current === "mouse");
        pointer.current = "";
      }}
    >
      {n}
    </button>
  );
}

function SourceCard({ card, id, reduced, onEnter, onLeave }: { card: Card; id: string; reduced: boolean; onEnter: () => void; onLeave: (delay: number) => void }) {
  const dy = card.below ? -6 : 6;
  return (
    <motion.div
      id={id}
      role="dialog"
      aria-label={`Source ${card.n}`}
      className={styles.sourceCard}
      style={{ left: card.x, top: card.top, bottom: card.bottom, width: card.width, transformOrigin: `${card.origin}px ${card.below ? "0%" : "100%"}` }}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onLeave(0);
      }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: dy }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.98, y: dy / 2, transition: { duration: duration.instant, ease: standard } }}
      transition={reduced ? { duration: 0.12 } : { ...spring.smooth, opacity: { duration: duration.fast, ease: enter } }}
      onPointerEnter={onEnter}
      onPointerLeave={(e: PointerEvent) => {
        if (e.pointerType === "mouse") onLeave(140);
      }}
    >
      <p className={styles.sourceDomain}>
        <Globe size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>{hostname(card.source.url)}</span>
        <span className={styles.sourceIndex}>{card.n}</span>
      </p>
      <p className={styles.sourceTitle}>{card.source.title}</p>
      {card.source.snippet && <p className={styles.sourceSnippet}>{card.source.snippet}</p>}
      <a className={styles.sourceLink} href={card.source.url} target="_blank" rel="noreferrer">
        Open source
        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </a>
    </motion.div>
  );
}

function Thinking({ answer, reduced, id }: { answer: Answer; reduced: boolean; id: string }) {
  const active = answer.status === "thinking";
  const [forced, setForced] = useState<boolean | null>(null);
  const has = !!answer.thinking;
  const open = has && (forced ?? active);
  const label = active ? "Thinking" : answer.thoughtFor ? `Thought for ${answer.thoughtFor}s` : answer.status === "stopped" ? "Stopped while thinking" : "Thought briefly";
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && active) el.scrollTop = el.scrollHeight;
  }, [answer.thinking, active]);
  return (
    <div className={styles.thinking}>
      <button type="button" className={styles.thinkingHead} aria-expanded={open} aria-controls={open ? `${id}-thoughts` : undefined} disabled={!has} onClick={() => setForced(!open)}>
        <TextShimmer active={active}>{label}</TextShimmer>
        {has && (
          <motion.span className={styles.thinkingChevron} initial={false} animate={{ rotate: open ? 0 : -90 }} transition={reduced ? { duration: 0 } : QUICK_SPRING} aria-hidden="true">
            <ChevronDown size={15} strokeWidth={1.75} />
          </motion.span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="thoughts"
            id={`${id}-thoughts`}
            className={styles.thoughtsClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { height: active ? spring.smooth : CLOSE_SPRING, opacity: { duration: duration.standard, ease: standard } }}
          >
            <div ref={ref} className={styles.thoughts} data-clamped={forced !== true || undefined}>
              <PlainText text={answer.thinking ?? ""} streaming={active} reduced={reduced} className={styles.thoughtsText} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TOOL_ICONS = { search: Search, read: FileText, image: ImageIcon, code: CodeXml };

function Tools({ tools, reduced, id }: { tools: ToolCall[]; reduced: boolean; id: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tools.find((t) => t.id === openId);
  return (
    <div className={styles.tools}>
      <div className={styles.toolRow}>
        <AnimatePresence initial={false}>
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.kind];
            const running = tool.status === "running";
            return (
              <motion.button
                key={tool.id}
                type="button"
                layout="position"
                className={styles.toolChip}
                data-status={tool.status}
                aria-expanded={openId === tool.id}
                aria-controls={openId === tool.id ? `${id}-tool` : undefined}
                disabled={!tool.detail}
                onClick={() => setOpenId(openId === tool.id ? null : tool.id)}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduced ? { duration: 0.12 } : { ...spring.smooth, opacity: { duration: duration.standard, ease: standard } }}
              >
                <SwapIcon id={running ? "run" : tool.status} reduced={reduced}>
                  {running ? <LoaderCircle className={styles.spin} size={14} strokeWidth={1.75} /> : tool.status === "error" ? <X size={14} strokeWidth={1.75} /> : <Icon size={14} strokeWidth={1.75} />}
                </SwapIcon>
                <span className={styles.toolLabel}>
                  <span data-on={running || undefined} aria-hidden={!running || undefined}>
                    {tool.running}
                  </span>
                  <span data-on={!running || undefined} aria-hidden={running || undefined}>
                    {tool.done}
                  </span>
                </span>
                {!running && tool.status === "done" && <Check className={styles.toolCheck} size={13} strokeWidth={2} aria-label="Done" />}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {open?.detail && (
          <motion.div
            key="detail"
            id={`${id}-tool`}
            className={styles.toolDetailClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast } }}
          >
            <p className={styles.toolDetail}>
              <code>{open.detail}</code>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sources({ sources, reduced, id }: { sources: Source[]; reduced: boolean; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.sourcesButton} aria-expanded={open} aria-controls={open ? `${id}-sources` : undefined} onClick={() => setOpen(!open)}>
        <Globe size={15} strokeWidth={1.75} aria-hidden="true" />
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="list"
            id={`${id}-sources`}
            className={styles.sourceListClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast } }}
          >
            <ol className={styles.sourceList}>
              {sources.map((source, i) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer" className={styles.sourceRow}>
                    <span className={styles.sourceRowIndex}>{i + 1}</span>
                    <span className={styles.sourceRowText}>
                      <span className={styles.sourceRowTitle}>{source.title}</span>
                      <span className={styles.sourceRowDomain}>{hostname(source.url)}</span>
                    </span>
                    <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Thumbs({ items, size = "message" }: { items: Attachment[]; size?: "message" | "composer" }) {
  return (
    <>
      {items.map((item) => (
        <span key={item.id} className={size === "message" ? styles.messageThumb : styles.thumbImage}>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: URLs from local uploads */}
          <img src={item.url} alt={item.name} />
        </span>
      ))}
    </>
  );
}

function UserBubble({ message, locked, reduced, onSave }: { message: UserMessage; locked: boolean; reduced: boolean; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (editing && el) {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draft, editing]);
  useEffect(() => {
    if (editing) {
      const el = fieldRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);
  const cancel = () => {
    setEditing(false);
    setDraft(message.text);
    requestAnimationFrame(() => editRef.current?.focus());
  };
  const save = () => {
    const text = draft.trim();
    if (!text) return;
    setEditing(false);
    if (text !== message.text) onSave(text);
  };
  return (
    <div className={styles.user}>
      {!!message.attachments?.length && (
        <div className={styles.messageThumbs}>
          <Thumbs items={message.attachments} />
        </div>
      )}
      <motion.div layout={!reduced} transition={OPEN_SPRING} className={styles.bubble} data-editing={editing || undefined} style={{ borderRadius: 20 }}>
        <AnimatePresence initial={false} mode="popLayout">
          {editing ? (
            <motion.div
              key="edit"
              className={styles.editor}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: duration.standard, delay: 0.05 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              <textarea
                ref={fieldRef}
                className={styles.editField}
                value={draft}
                rows={1}
                aria-label="Edit message"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    save();
                  }
                }}
              />
              <div className={styles.editActions}>
                <button type="button" className={styles.ghostButton} onClick={cancel}>
                  Cancel
                </button>
                <button type="button" className={styles.solidButton} disabled={!draft.trim() || locked} onClick={save}>
                  Send
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="text"
              className={styles.bubbleText}
              layout={!reduced && "position"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: duration.standard, delay: 0.04 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
      {!editing && (
        <div className={styles.userActions}>
          <CopyButton value={message.text} reduced={reduced} iconOnly label="Copy message" className={styles.iconButton} />
          <button
            ref={editRef}
            type="button"
            className={styles.iconButton}
            aria-label="Edit message"
            disabled={locked}
            onClick={() => {
              setDraft(message.text);
              setEditing(true);
            }}
          >
            <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function AssistantBubble({
  message,
  models,
  locked,
  reduced,
  onRegenerate,
  onVersion,
}: {
  message: AssistantMessage;
  models: Model[];
  locked: boolean;
  reduced: boolean;
  onRegenerate: () => void;
  onVersion: (index: number) => void;
}) {
  const answer = message.versions[message.current];
  const id = useId().replace(/:/g, "");
  const [direction, setDirection] = useState(0);
  const busy = answer.status === "thinking" || answer.status === "streaming";
  const settled = !busy;
  const sources = answer.sources ?? [];
  const modelName = models.find((m) => m.id === answer.model)?.name ?? answer.model;
  const count = message.versions.length;
  const go = (delta: number) => {
    setDirection(delta);
    onVersion(Math.min(count - 1, Math.max(0, message.current + delta)));
  };
  const showThinking = !!answer.thinking || (answer.status === "thinking" && !answer.tools?.length);
  const key = `${id}-${message.current}`;
  return (
    <div className={styles.assistant} aria-busy={busy || undefined}>
      <AutoHeight reduced={reduced}>
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={message.current}
            className={styles.answer}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 12 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, x: -8 * direction, transition: { duration: duration.instant, ease: standard } }}
            transition={reduced ? { duration: 0.12 } : { x: spring.smooth, opacity: { duration: duration.standard, ease: standard } }}
          >
            <AnimatePresence initial={false}>
              {showThinking && (
                <motion.div
                  key="thinking"
                  className={styles.clip}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast } }}
                >
                  <Thinking answer={answer} reduced={reduced} id={key} />
                </motion.div>
              )}
            </AnimatePresence>
            {!!answer.tools?.length && <Tools tools={answer.tools} reduced={reduced} id={key} />}
            {answer.text && (
              <Markdown text={answer.text} streaming={busy} reduced={reduced} cite={(n, citeKey) => <Cite key={citeKey} n={n} source={sources[n - 1]} id={`${key}-${citeKey}`} />} />
            )}
            {answer.status === "error" && <p className={styles.errorNote}>The answer could not be generated.</p>}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
      <motion.div
        className={styles.answerFoot}
        inert={!settled || undefined}
        aria-hidden={!settled || undefined}
        initial={false}
        animate={{ opacity: settled ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : settled ? duration.standard : duration.instant, ease: standard, delay: settled && !reduced ? 0.08 : 0 }}
      >
        <div className={styles.answerActions}>
          {count > 1 && (
            <div className={styles.pager} role="group" aria-label="Answer versions">
              <button type="button" className={styles.iconButton} aria-label="Previous version" disabled={message.current === 0 || locked} onClick={() => go(-1)}>
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <span className={styles.pagerCount} aria-live="polite">
                {message.current + 1} / {count}
              </span>
              <button type="button" className={styles.iconButton} aria-label="Next version" disabled={message.current === count - 1 || locked} onClick={() => go(1)}>
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
          <CopyButton
            value={answer.text
              .replace(/```[\w+-]*\n?/g, "")
              .replace(/\*\*([^*]+)\*\*/g, "$1")
              .replace(/`([^`]+)`/g, "$1")
              .replace(/\s?\[(\d{1,2})\](?!\()/g, "")
              .replace(/^#{1,3}\s+/gm, "")}
            reduced={reduced}
            iconOnly
            label="Copy answer"
            className={styles.iconButton}
          />
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Regenerate answer"
            disabled={locked}
            onClick={() => {
              setDirection(1);
              onRegenerate();
            }}
          >
            <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {!!sources.length && <Sources sources={sources} reduced={reduced} id={key} />}
          <span className={styles.answerMeta}>{answer.status === "stopped" ? `Stopped · ${modelName}` : modelName}</span>
        </div>
      </motion.div>
    </div>
  );
}

function ModelSwitcher({ models, value, onChange, reduced }: { models: Model[]; value: string; onChange: (id: string) => void; reduced: boolean }) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, models.findIndex((m) => m.id === value));
  const [cursor, setCursor] = useState(selected);
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const height = useMotionValue<number | "auto">("auto");
  const radius = useMotionValue(18);
  const outerWidth = useMotionValue<number | "auto">("auto");
  const hlY = useMotionValue(0);
  const hlH = useMotionValue(0);
  const measured = useRef(false);
  const latest = useRef({ open, reduced });
  const measure = useCallback(() => {
    const pill = pillRef.current;
    const menu = menuRef.current;
    if (!pill || !menu) return;
    const p = { w: pill.offsetWidth, h: pill.offsetHeight };
    const m = { w: menu.offsetWidth, h: menu.offsetHeight };
    const { open: isOpen, reduced: isReduced } = latest.current;
    const target = isOpen ? { w: Math.max(m.w, p.w), h: m.h, r: 18 } : { w: p.w, h: p.h, r: p.h / 2 };
    if (!measured.current || isReduced) {
      width.jump(target.w);
      height.jump(target.h);
      radius.jump(target.r);
      outerWidth.jump(p.w);
      measured.current = p.w > 0;
      return;
    }
    const s = isOpen ? OPEN_SPRING : CLOSE_SPRING;
    animate(width, target.w, s);
    animate(height, target.h, s);
    animate(radius, target.r, s);
    animate(outerWidth, p.w, QUICK_SPRING);
  }, [height, outerWidth, radius, width]);
  useLayoutEffect(() => {
    latest.current = { open, reduced };
    measure();
  }, [open, reduced, measure]);
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const menu = menuRef.current;
    if (!pill || !menu || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(pill);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [measure]);
  useLayoutEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    if (!el) return;
    if (!open || reduced) {
      hlY.jump(el.offsetTop);
      hlH.jump(el.offsetHeight);
      return;
    }
    animate(hlY, el.offsetTop, QUICK_SPRING);
    animate(hlH, el.offsetHeight, QUICK_SPRING);
  }, [cursor, open, reduced, hlH, hlY]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) requestAnimationFrame(() => pillRef.current?.focus({ preventScroll: true }));
  };
  const choose = (i: number) => {
    const model = models[i];
    if (model) onChange(model.id);
    close();
  };
  const current = models[selected];
  return (
    <motion.div ref={rootRef} className={styles.switcher} style={{ width: outerWidth }} data-open={open || undefined}>
      <span className={styles.switcherSizer} aria-hidden="true">
        {current?.name}
        <ChevronDown size={15} strokeWidth={1.75} />
      </span>
      <motion.div className={styles.switcherSurface} style={{ width, height, borderRadius: radius }}>
        <motion.button
          ref={pillRef}
          type="button"
          className={styles.switcherPill}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-models`}
          inert={open || undefined}
          initial={false}
          animate={open ? (reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${blur.subtle}px)` }) : { opacity: 1, filter: "blur(0px)" }}
          transition={open ? { duration: 0.1, ease: standard } : { duration: duration.standard, ease: enter, delay: reduced ? 0 : 0.08 }}
          onClick={() => {
            setCursor(selected);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor(selected);
              setOpen(true);
            }
          }}
        >
          <span>{current?.name}</span>
          <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
        </motion.button>
        <motion.div
          ref={menuRef}
          className={styles.switcherMenu}
          inert={!open || undefined}
          initial={false}
          animate={open ? { opacity: 1, y: 0, filter: "blur(0px)" } : reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: `blur(${blur.subtle}px)` }}
          transition={open ? { duration: duration.standard, ease: enter, delay: reduced ? 0 : 0.05 } : { duration: 0.1, ease: standard }}
        >
          <p className={styles.switcherHeading} id={`${id}-label`}>
            Model
          </p>
          <div className={styles.switcherListWrap}>
            <motion.span className={styles.switcherHighlight} style={{ y: hlY, height: hlH }} aria-hidden="true" />
            <ul
              ref={listRef}
              id={`${id}-models`}
              className={styles.switcherList}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={`${id}-label`}
              aria-activedescendant={open ? `${id}-model-${cursor}` : undefined}
              onKeyDown={(e) => {
                const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
                if (e.key in step) {
                  e.preventDefault();
                  setCursor((cursor + step[e.key] + models.length) % models.length);
                } else if (e.key === "Home" || e.key === "End") {
                  e.preventDefault();
                  setCursor(e.key === "Home" ? 0 : models.length - 1);
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose(cursor);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                } else if (e.key === "Tab") close(false);
              }}
            >
              {models.map((model, i) => (
                <li
                  key={model.id}
                  id={`${id}-model-${i}`}
                  role="option"
                  aria-selected={i === selected}
                  className={styles.switcherOption}
                  onPointerMove={() => {
                    if (cursor !== i) setCursor(i);
                  }}
                  onClick={() => choose(i)}
                >
                  <span className={styles.switcherText}>
                    <span className={styles.switcherName}>{model.name}</span>
                    <span className={styles.switcherDescription}>{model.description}</span>
                  </span>
                  <Check className={styles.switcherCheck} data-on={i === selected || undefined} size={16} strokeWidth={1.75} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Composer({ busy, reduced, onSend, onStop, focusKey }: { busy: boolean; reduced: boolean; onSend: (text: string, files: Attachment[]) => void; onStop: () => void; focusKey: string }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = !!text.trim() || files.length > 0;
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${Math.min(168, el.scrollHeight)}px`;
    }
  }, [text]);
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current) fieldRef.current?.focus({ preventScroll: true });
    seen.current = true;
  }, [focusKey]);
  const addFiles = (list: FileList) => {
    const images = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4);
    if (!images.length) return;
    setFiles((prev) => [...prev, ...images.map((f) => ({ id: uid("file"), name: f.name || "Pasted image", url: URL.createObjectURL(f) }))].slice(0, 4));
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return onStop();
    if (!ready) return;
    onSend(text.trim() || "What do you see in this image?", files);
    setText("");
    setFiles([]);
  };
  return (
    <form
      className={styles.composer}
      data-dragging={dragging || undefined}
      onSubmit={submit}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div
            key="thumbs"
            className={styles.clip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast } }}
          >
            <ul className={styles.thumbs} aria-label="Attachments">
              <AnimatePresence initial={false} mode="popLayout">
                {files.map((file) => (
                  <motion.li
                    key={file.id}
                    layout={!reduced}
                    className={styles.thumb}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: duration.instant } }}
                    transition={reduced ? { duration: 0.1 } : spring.snappy}
                  >
                    <Thumbs items={[file]} size="composer" />
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setFiles((prev) => {
                          const target = prev.find((f) => f.id === file.id);
                          if (target?.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
                          return prev.filter((f) => f.id !== file.id);
                        })
                      }
                    >
                      <X size={12} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      <textarea
        ref={fieldRef}
        className={styles.field}
        rows={1}
        value={text}
        placeholder="Ask anything"
        aria-label="Message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!busy) submit();
          }
          if (e.key === "Escape" && busy) {
            e.preventDefault();
            onStop();
          }
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            addFiles(e.clipboardData.files);
          }
        }}
      />
      <div className={styles.composerBar}>
        <button type="button" className={styles.iconButton} aria-label="Attach images" onClick={() => inputRef.current?.click()} disabled={files.length >= 4}>
          <Paperclip size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className={styles.composerHint}>Enter to send, Shift Enter for a new line</span>
        <button type="submit" className={styles.send} data-busy={busy || undefined} aria-label={busy ? "Stop generating" : "Send message"} disabled={!busy && !ready}>
          <SwapIcon id={busy ? "stop" : "send"} reduced={reduced}>
            {busy ? <span className={styles.stopGlyph} /> : <ArrowUp size={18} strokeWidth={2} />}
          </SwapIcon>
        </button>
      </div>
    </form>
  );
}

export type AiChatProps = {
  defaultConversations?: Conversation[];
  onConversationsChange?: (conversations: Conversation[]) => void;
  activeId?: string | null;
  defaultActiveId?: string | null;
  onActiveChange?: (id: string | null) => void;
  models?: Model[];
  model?: string;
  defaultModel?: string;
  onModelChange?: (id: string) => void;
  sidebarOpen?: boolean;
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  suggestions?: Suggestion[];
  respond?: Responder;
  greeting?: string;
  notice?: string;
  user?: { name: string; avatar?: string; detail?: string };
  className?: string;
};

const DEFAULT_USER = { name: "Emma Collins", avatar: "/media/people/emma-collins.jpg", detail: "Team plan" };

function applyEvent(answer: Answer, event: StreamEvent, thoughtFor: () => number | undefined): Answer {
  switch (event.type) {
    case "thinking":
      return { ...answer, thinking: (answer.thinking ?? "") + event.text, status: "thinking" };
    case "tool": {
      const tools = answer.tools ?? [];
      const exists = tools.some((t) => t.id === event.tool.id);
      return { ...answer, tools: exists ? tools.map((t) => (t.id === event.tool.id ? event.tool : t)) : [...tools, event.tool], status: "streaming", thoughtFor: answer.thoughtFor ?? thoughtFor() };
    }
    case "sources":
      return { ...answer, sources: event.sources };
    case "text":
      return { ...answer, text: answer.text + event.text, status: "streaming", thoughtFor: answer.thoughtFor ?? thoughtFor() };
  }
}

export function AiChat({
  defaultConversations = DEFAULT_CONVERSATIONS,
  onConversationsChange,
  activeId,
  defaultActiveId = null,
  onActiveChange,
  models = MODELS,
  model,
  defaultModel = "atlas",
  onModelChange,
  sidebarOpen,
  defaultSidebarOpen = true,
  onSidebarOpenChange,
  suggestions = SUGGESTIONS,
  respond = scriptedRespond,
  greeting = "What are we working on?",
  notice = "Sample responses",
  user = DEFAULT_USER,
  className,
}: AiChatProps) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const reduced = useReducedMotion() && mounted;
  const id = useId().replace(/:/g, "");
  const [conversations, setConversations] = useState(defaultConversations);
  const [active, setActive] = useControllable(activeId, defaultActiveId, onActiveChange);
  const [modelId, setModelId] = useControllable(model, defaultModel, onModelChange);
  const [wideOpen, setWideOpen] = useControllable(sidebarOpen, defaultSidebarOpen, onSidebarOpenChange);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [generating, setGenerating] = useState<{ conversation: string; message: string } | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const follow = useRef(true);
  const cardTimer = useRef(0);
  const firstRender = useRef(true);
  const conversation = conversations.find((c) => c.id === active) ?? null;
  const open = narrow ? drawerOpen : wideOpen;
  const busy = !!generating && generating.conversation === active;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onConversationsChange?.(conversations);
  }, [conversations, onConversationsChange]);
  useEffect(() => () => controller.current?.abort(), []);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setNarrow(el.offsetWidth < 720));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const thread = threadRef.current;
    const content = contentRef.current;
    if (!thread || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (follow.current) thread.scrollTop = thread.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const scrollToEnd = (smooth = true) => {
    const thread = threadRef.current;
    follow.current = true;
    setAtBottom(true);
    thread?.scrollTo({ top: thread.scrollHeight, behavior: smooth && !reduced ? "smooth" : "auto" });
  };

  const patchAnswer = useCallback((conversationId: string, messageId: string, version: number, fn: (a: Answer) => Answer) => {
    setConversations((list) =>
      list.map((c) =>
        c.id !== conversationId
          ? c
          : { ...c, messages: c.messages.map((m) => (m.id !== messageId || m.role !== "assistant" ? m : { ...m, versions: m.versions.map((v, i) => (i === version ? fn(v) : v)) })) },
      ),
    );
  }, []);

  const generate = useCallback(
    async (conversationId: string, messageId: string, version: number, history: Message[], modelForRun: string) => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setGenerating({ conversation: conversationId, message: messageId });
      setLive("Generating an answer");
      const lastUser = [...history].reverse().find((m): m is UserMessage => m.role === "user");
      const startedAt = performance.now();
      let thinkingAt: number | null = null;
      const thoughtFor = () => (thinkingAt === null ? undefined : Math.max(1, Math.round((performance.now() - thinkingAt) / 1000)));
      try {
        for await (const event of respond(
          { conversationId, messages: history, prompt: lastUser?.text ?? "", attachments: lastUser?.attachments ?? [], model: modelForRun },
          ctrl.signal,
        )) {
          if (ctrl.signal.aborted) break;
          if (event.type === "thinking" && thinkingAt === null) thinkingAt = performance.now();
          patchAnswer(conversationId, messageId, version, (a) => applyEvent(a, event, thoughtFor));
        }
        if (ctrl.signal.aborted) throw ctrl.signal.reason;
        patchAnswer(conversationId, messageId, version, (a) => ({ ...a, status: "done", thoughtFor: a.thoughtFor ?? thoughtFor() }));
        setLive(`Answer ready in ${Math.max(1, Math.round((performance.now() - startedAt) / 1000))} seconds`);
      } catch {
        const stopped = ctrl.signal.aborted;
        patchAnswer(conversationId, messageId, version, (a) => ({ ...a, status: stopped ? "stopped" : "error", thoughtFor: a.thoughtFor ?? thoughtFor() }));
        setLive(stopped ? "Stopped" : "The answer could not be generated");
      } finally {
        if (controller.current === ctrl) {
          controller.current = null;
          setGenerating(null);
        }
      }
    },
    [patchAnswer, respond],
  );

  const send = (text: string, attachments: Attachment[], title?: string) => {
    const userMessage: UserMessage = { id: uid("user"), role: "user", text, attachments: attachments.length ? attachments : undefined };
    const assistant: AssistantMessage = { id: uid("answer"), role: "assistant", current: 0, versions: [{ text: "", status: "thinking", model: modelId }] };
    let history: Message[];
    let targetId = active;
    if (conversation) {
      history = [...conversation.messages, userMessage];
      setConversations((list) => list.map((c) => (c.id === conversation.id ? { ...c, messages: [...c.messages, userMessage, assistant] } : c)));
    } else {
      targetId = uid("chat");
      history = [userMessage];
      const short = text.replace(/[?.!]+$/, "").split(/\s+/).slice(0, 6).join(" ");
      const fresh: Conversation = { id: targetId, title: title ?? (short.length > 42 ? `${short.slice(0, 40)}…` : short), group: "Today", messages: [userMessage, assistant] };
      setConversations((list) => [fresh, ...list]);
      setFreshId(targetId);
      setActive(targetId);
    }
    requestAnimationFrame(() => scrollToEnd());
    void generate(targetId!, assistant.id, 0, history, modelId);
  };

  const editMessage = (messageId: string, text: string) => {
    if (!conversation || generating) return;
    const index = conversation.messages.findIndex((m) => m.id === messageId);
    const original = conversation.messages[index];
    if (!original || original.role !== "user") return;
    const edited: UserMessage = { ...original, text };
    const assistant: AssistantMessage = { id: uid("answer"), role: "assistant", current: 0, versions: [{ text: "", status: "thinking", model: modelId }] };
    const history = [...conversation.messages.slice(0, index), edited];
    setConversations((list) => list.map((c) => (c.id === conversation.id ? { ...c, messages: [...history, assistant] } : c)));
    follow.current = true;
    void generate(conversation.id, assistant.id, 0, history, modelId);
  };

  const regenerate = (messageId: string) => {
    if (!conversation || generating) return;
    const index = conversation.messages.findIndex((m) => m.id === messageId);
    const target = conversation.messages[index];
    if (!target || target.role !== "assistant") return;
    const version = target.versions.length;
    setConversations((list) =>
      list.map((c) =>
        c.id !== conversation.id
          ? c
          : {
              ...c,
              messages: c.messages.map((m) => (m.id === messageId && m.role === "assistant" ? { ...m, current: version, versions: [...m.versions, { text: "", status: "thinking", model: modelId }] } : m)),
            },
      ),
    );
    void generate(conversation.id, messageId, version, conversation.messages.slice(0, index), modelId);
  };

  const setVersion = (messageId: string, version: number) => {
    if (!conversation) return;
    setConversations((list) =>
      list.map((c) => (c.id !== conversation.id ? c : { ...c, messages: c.messages.map((m) => (m.id === messageId && m.role === "assistant" ? { ...m, current: version } : m)) })),
    );
  };

  const selectConversation = (nextId: string | null) => {
    setCard(null);
    setActive(nextId);
    follow.current = true;
    setAtBottom(true);
    if (narrow) setDrawerOpen(false);
    requestAnimationFrame(() => {
      const thread = threadRef.current;
      if (thread) thread.scrollTop = nextId ? thread.scrollHeight : 0;
    });
  };

  const toggleSidebar = () => {
    const next = !open;
    if (narrow) setDrawerOpen(next);
    else setWideOpen(next);
    requestAnimationFrame(() => (next ? closeButtonRef.current : openButtonRef.current)?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (!narrow || !drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        openButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, narrow]);

  const cardId = `${id}-source`;
  const placeCard = useCallback((source: Source, n: number, anchor: HTMLElement, key: string): Card | null => {
    const root = rootRef.current;
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(300, rootRect.width - 24);
    const center = rect.left + rect.width / 2 - rootRect.left;
    const x = Math.min(rootRect.width - width - 12, Math.max(12, center - width / 2));
    const below = rect.top - rootRect.top < 200;
    const base = { source, n, key, width, x, below, origin: center - x };
    return below ? { ...base, top: rect.bottom - rootRect.top + 8 } : { ...base, bottom: rootRect.bottom - rect.top + 8 };
  }, []);
  const citeApi = useMemo<CiteApi>(
    () => ({
      cardId,
      openKey: card?.key ?? null,
      show: (source, n, anchor, key) => {
        window.clearTimeout(cardTimer.current);
        cardTimer.current = window.setTimeout(() => setCard(placeCard(source, n, anchor, key)), card ? 0 : 90);
      },
      hide: (delay = 0) => {
        window.clearTimeout(cardTimer.current);
        cardTimer.current = window.setTimeout(() => setCard(null), delay);
      },
      keep: () => window.clearTimeout(cardTimer.current),
      toggle: (source, n, anchor, key, mouse) => {
        window.clearTimeout(cardTimer.current);
        setCard((prev) => (prev?.key === key ? (mouse ? prev : null) : placeCard(source, n, anchor, key)));
      },
    }),
    [card, cardId, placeCard],
  );
  useEffect(() => {
    if (!card) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.sourceCard}, .${styles.cite}`)) setCard(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCard(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [card]);
  useEffect(() => () => window.clearTimeout(cardTimer.current), []);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Conversation[]>();
    for (const c of conversations) {
      if (!map.has(c.group)) {
        map.set(c.group, []);
        order.push(c.group);
      }
      map.get(c.group)!.push(c);
    }
    return order.map((group) => ({ group, items: map.get(group)! }));
  }, [conversations]);

  const sidebar = (
    <div className={styles.sidebarInner}>
      <div className={styles.sidebarTop}>
        <button ref={closeButtonRef} type="button" className={styles.iconButton} aria-label="Close sidebar" onClick={toggleSidebar}>
          <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button type="button" className={styles.newChat} onClick={() => selectConversation(null)} aria-current={active === null || undefined}>
          <SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />
          New chat
        </button>
      </div>
      <nav className={styles.history} aria-label="Conversations">
        <LayoutGroup id={`${id}-history`}>
          {groups.map(({ group, items }) => (
            <div key={group} className={styles.historyGroup}>
              <p className={styles.historyHeading}>{group}</p>
              <ul className={styles.historyList}>
                <AnimatePresence initial={false}>
                  {items.map((c) => {
                    const current = c.id === active;
                    const working = generating?.conversation === c.id;
                    return (
                      <motion.li
                        key={c.id}
                        className={styles.historyItem}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={reduced ? { duration: 0.1 } : { height: spring.smooth, opacity: { duration: duration.standard, delay: 0.06 } }}
                      >
                        <button type="button" className={styles.historyButton} aria-current={current ? "page" : undefined} onClick={() => selectConversation(c.id)}>
                          {current && <motion.span layoutId="active" className={styles.historyHighlight} transition={reduced ? { duration: 0 } : QUICK_SPRING} aria-hidden="true" />}
                          <span className={styles.historyTitle}>
                            {c.id === freshId ? (
                              <TextScramble trigger="mount" glyphs="abcdefghijklmnopqrstuvwxyz" duration={0.8}>
                                {c.title}
                              </TextScramble>
                            ) : (
                              c.title
                            )}
                          </span>
                          {working && <LoaderCircle className={`${styles.spin} ${styles.historyBusy}`} size={14} strokeWidth={1.75} aria-label="Generating" />}
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </LayoutGroup>
      </nav>
      <div className={styles.account}>
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar may be any URL
          <img className={styles.avatar} src={user.avatar} alt="" width={28} height={28} />
        ) : (
          <span className={styles.avatar} aria-hidden="true" />
        )}
        <span className={styles.accountText}>
          <span className={styles.accountName}>{user.name}</span>
          {user.detail && <span className={styles.accountDetail}>{user.detail}</span>}
        </span>
      </div>
    </div>
  );

  return (
    <CiteContext.Provider value={citeApi}>
      <div ref={rootRef} className={cx(styles.root, className)} data-narrow={narrow || undefined}>
        {!narrow && (
          <motion.aside
            className={styles.sidebar}
            aria-label="Chat history"
            initial={false}
            animate={{ width: open ? 264 : 0 }}
            transition={reduced ? { duration: 0 } : open ? OPEN_SPRING : CLOSE_SPRING}
            inert={!open || undefined}
          >
            <motion.div className={styles.sidebarSlide} initial={false} animate={{ opacity: open ? 1 : 0, x: open || reduced ? 0 : -16 }} transition={{ duration: duration.standard, ease: enter }}>
              {sidebar}
            </motion.div>
          </motion.aside>
        )}
        <AnimatePresence>
          {narrow && drawerOpen && (
            <>
              <motion.div key="scrim" className={styles.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.standard }} onClick={() => setDrawerOpen(false)} />
              <motion.aside
                key="drawer"
                className={styles.drawer}
                aria-label="Chat history"
                initial={reduced ? { opacity: 0 } : { x: "-104%" }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={reduced ? { opacity: 0 } : { x: "-104%" }}
                transition={reduced ? { duration: 0.12 } : spring.smooth}
              >
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        <section className={styles.main} aria-label={conversation?.title ?? "New chat"}>
          <header className={styles.header}>
            <AnimatePresence initial={false}>
              {!open && (
                <motion.div
                  key="tools"
                  className={styles.headerTools}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  transition={reduced ? { duration: 0.1 } : { width: open ? CLOSE_SPRING : OPEN_SPRING, opacity: { duration: duration.fast } }}
                >
                  <button ref={openButtonRef} type="button" className={styles.iconButton} aria-label="Open sidebar" aria-expanded={false} onClick={toggleSidebar}>
                    <PanelLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.iconButton} aria-label="New chat" onClick={() => selectConversation(null)}>
                    <SquarePen size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <ModelSwitcher models={models} value={modelId} onChange={setModelId} reduced={reduced} />
            {notice && <span className={styles.notice}>{notice}</span>}
          </header>
          <div
            ref={threadRef}
            className={styles.thread}
            onScroll={() => {
              const thread = threadRef.current;
              if (!thread) return;
              follow.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 56;
              if (follow.current !== atBottom) setAtBottom(follow.current);
              if (card) setCard(null);
            }}
          >
            <div ref={contentRef} className={styles.threadContent}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={active ?? "new"}
                  className={styles.page}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={reduced ? { duration: 0.12 } : { duration: duration.standard, ease: enter }}
                >
                  {conversation ? (
                    <ol className={styles.messages}>
                      <AnimatePresence initial={false}>
                        {conversation.messages.map((message) => (
                          <motion.li
                            key={message.id}
                            className={styles.messageItem}
                            data-role={message.role}
                            initial={reduced ? { opacity: 0 } : message.role === "user" ? { opacity: 0, y: 14, scale: 0.98 } : { opacity: 0 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.12 } }}
                            transition={reduced ? { duration: 0.12 } : { ...spring.smooth, opacity: { duration: duration.standard, ease: enter } }}
                            style={{ transformOrigin: "100% 100%" }}
                          >
                            {message.role === "user" ? (
                              <UserBubble message={message} locked={!!generating} reduced={reduced} onSave={(text) => editMessage(message.id, text)} />
                            ) : (
                              <AssistantBubble
                                message={message}
                                models={models}
                                locked={!!generating}
                                reduced={reduced}
                                onRegenerate={() => regenerate(message.id)}
                                onVersion={(v) => setVersion(message.id, v)}
                              />
                            )}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  ) : (
                    <div className={styles.empty}>
                      <h3 className={styles.greeting}>{greeting}</h3>
                      <ul className={styles.suggestions}>
                        {suggestions.map((s, i) => (
                          <motion.li
                            key={s.label}
                            initial={reduced ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: duration.considered, ease: enter, delay: reduced ? 0 : 0.04 + i * T.stagger.item * 1.5 }}
                          >
                            <button type="button" className={styles.suggestion} onClick={() => send(s.prompt, s.attachments ?? [], s.label)}>
                              <span className={styles.suggestionLabel}>{s.label}</span>
                              {s.attachments?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element -- decorative thumbnail
                                <img className={styles.suggestionThumb} src={s.attachments[0].url} alt="" />
                              ) : (
                                <ArrowUpRight className={styles.suggestionArrow} size={16} strokeWidth={1.75} aria-hidden="true" />
                              )}
                            </button>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className={styles.dock}>
            <AnimatePresence>
              {!atBottom && conversation && (
                <motion.button
                  key="jump"
                  type="button"
                  className={styles.jump}
                  aria-label="Jump to latest"
                  onClick={() => scrollToEnd()}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
                  transition={reduced ? { duration: 0.1 } : spring.snappy}
                >
                  <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>
            <Composer busy={busy} reduced={reduced} onSend={send} onStop={() => controller.current?.abort()} focusKey={active ?? "new"} />
          </div>
        </section>
        <AnimatePresence>{card && <SourceCard key={card.key} card={card} id={cardId} reduced={reduced} onEnter={citeApi.keep} onLeave={citeApi.hide} />}</AnimatePresence>
        <p className={styles.srOnly} aria-live="polite">
          {live}
        </p>
      </div>
    </CiteContext.Provider>
  );
}
