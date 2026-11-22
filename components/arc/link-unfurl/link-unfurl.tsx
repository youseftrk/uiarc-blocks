"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUp, Check, ChevronUp, Globe, Play, X } from "lucide-react";
import styles from "./link-unfurl.module.css";

export interface LinkUnfurlPreview {
  url: string;
  site: string;
  title: string;
  description?: string;
  image?: string;
  favicon?: string;
  duration?: string;
}

export interface LinkUnfurlMessage {
  text: string;
  previews: LinkUnfurlPreview[];
}

export interface LinkUnfurlProps {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  samples?: LinkUnfurlPreview[];
  resolve?: (
    url: string,
    signal: AbortSignal,
  ) => Promise<LinkUnfurlPreview | null>;
  autoExpand?: boolean;
  autoPlay?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  sendLabel?: string;
  onSend?: (message: LinkUnfurlMessage) => void | Promise<unknown>;
  className?: string;
  style?: CSSProperties;
}

interface LinkEntry {
  id: string;
  url: string;
  status: "loading" | "ready" | "failed";
  expanded: boolean;
  preview: LinkUnfurlPreview | null;
}

function makeSvgUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DEFAULT_SAMPLES: LinkUnfurlPreview[] = [
  {
    url: "https://www.airbnb.com/rooms/48213907",
    site: "Airbnb",
    title: "Rooftop loft in Alfama with river views",
    description:
      "Sunlit 3-bedroom loft with a south-facing terrace overlooking the Tagus and space for six.",
    favicon: makeSvgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#FF385C"/><path d="M12 5.5c-1.8 3.2-4.8 7.4-4.8 9.9a4.8 4.8 0 0 0 9.6 0c0-2.5-3-6.7-4.8-9.9zm0 11.4a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="#fff"/></svg>`,
    ),
    image: makeSvgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 764 400"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#385a7c"/><stop offset="55%" stop-color="#d9895b"/><stop offset="100%" stop-color="#4d2b22"/></linearGradient></defs><rect width="764" height="400" fill="url(#a)"/><circle cx="560" cy="115" r="46" fill="#ffe4a8" opacity="0.8"/><path d="M0 280 L190 220 L380 265 L590 210 L764 250 L764 400 L0 400 Z" fill="#2a1d1f" opacity="0.55"/><rect x="84" y="255" width="160" height="90" rx="6" fill="#f7e7d4" opacity="0.22"/></svg>`,
    ),
  },
  {
    url: "https://linear.app/arc/issue/ARC-412",
    site: "Linear",
    title: "ARC-412: Spring physics for card morphs",
    description:
      "Unify width-first clip unroll and mid-flight shadow lift across composer previews.",
    favicon: makeSvgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#5E6AD2"/><path d="M6 14l4 4 8-8" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    ),
    image: makeSvgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 764 400"><rect width="764" height="400" fill="#141624"/><rect x="48" y="48" width="668" height="304" rx="16" fill="#1d2033" stroke="#2f3554"/><rect x="80" y="96" width="220" height="18" rx="9" fill="#5E6AD2"/><rect x="80" y="138" width="440" height="14" rx="7" fill="#3a4063"/><rect x="80" y="168" width="360" height="14" rx="7" fill="#2c314d"/><circle cx="640" cy="112" r="24" fill="#5E6AD2" opacity="0.3"/></svg>`,
    ),
  },
  {
    url: "https://youtu.be/lisbon-walk-4k",
    site: "YouTube",
    title: "Golden hour walk through Alfama & Baixa",
    description:
      "Evening tram lines, tiled alleys, and viewpoints across Lisbon in 4K.",
    duration: "14:28",
    favicon: makeSvgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#FF0000"/><polygon points="10,8 17,12 10,16" fill="#fff"/></svg>`,
    ),
    image: makeSvgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 764 400"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e2a3a"/><stop offset="60%" stop-color="#8b4d5a"/><stop offset="100%" stop-color="#e39a5c"/></linearGradient></defs><rect width="764" height="400" fill="url(#b)"/><circle cx="240" cy="140" r="52" fill="#fff1cc" opacity="0.65"/><path d="M0 290 Q 260 220 500 280 T 764 250 L 764 400 L 0 400 Z" fill="#14131c" opacity="0.6"/></svg>`,
    ),
  },
];

const URL_REGEX = /https?:\/\/[^\s]+/i;

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildFallbackPreview(url: string): LinkUnfurlPreview {
  const host = domainFromUrl(url);
  const site = host.split(".")[0];
  const capitalized = site ? site.charAt(0).toUpperCase() + site.slice(1) : host;
  let path = "";
  try {
    path = new URL(url).pathname.replace(/^\/|\/$/g, "");
  } catch {
    path = "";
  }
  return {
    url,
    site: capitalized,
    title: path ? `${capitalized} — ${path}` : host,
    description: url,
  };
}

function PreviewCard({
  entry,
  instant,
  onCollapse,
  onRemove,
  onDragChange,
}: {
  entry: LinkEntry;
  instant: boolean;
  onCollapse: (id: string) => void;
  onRemove: (id: string) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const animRef = useRef({
    p: entry.expanded ? 1 : 0,
    v: 0,
    target: entry.expanded ? 1 : 0,
    raf: 0,
    lastT: 0,
    dragging: false,
    pointerId: -1,
    startY: 0,
    lastY: 0,
    lastDragT: 0,
    vy: 0,
    cardH: 260,
  });

  const applyFrame = useCallback((p: number) => {
    const wrap = wrapRef.current;
    const plate = plateRef.current;
    const card = cardRef.current;
    const body = bodyRef.current;
    const img = imgRef.current;
    if (!wrap || !plate || !card) return;

    const clamped = Math.max(0, Math.min(1, p));
    const cardW = card.offsetWidth || 440;
    const cardH = card.offsetHeight || animRef.current.cardH;
    if (cardH > 40) animRef.current.cardH = cardH;

    // Width unrolls first, height deepens after
    const wProg = Math.min(1, clamped * 1.45);
    const hProg = Math.max(0, Math.min(1, (clamped - 0.12) / 0.88));
    const curW = 140 + (cardW - 140) * wProg;
    const curH = 28 + (cardH - 28) * hProg;
    const lift = Math.sin(clamped * Math.PI);

    wrap.style.height = clamped <= 0.004 ? "0px" : `${(cardH * clamped).toFixed(1)}px`;
    plate.style.width = `${curW.toFixed(1)}px`;
    plate.style.height = `${curH.toFixed(1)}px`;
    plate.style.opacity = clamped <= 0.01 ? "0" : String(Math.min(1, clamped * 3));
    plate.style.setProperty("--lift", lift.toFixed(3));
    plate.style.transform = `translate3d(0, ${((1 - clamped) * -10).toFixed(1)}px, 0)`;

    const rightClip = Math.max(0, cardW - curW);
    const bottomClip = Math.max(0, cardH - curH);
    card.style.visibility = clamped <= 0.01 ? "hidden" : "visible";
    card.style.opacity = clamped <= 0.01 ? "0" : String(Math.min(1, clamped * 2.5));
    card.style.clipPath =
      clamped >= 0.995
        ? "none"
        : `inset(0px ${rightClip.toFixed(1)}px ${bottomClip.toFixed(1)}px 0px round 12px)`;
    card.style.transform = `translate3d(0, ${((1 - clamped) * -10).toFixed(1)}px, 0)`;

    if (body) {
      const bodyOp = Math.max(0, Math.min(1, (clamped - 0.25) / 0.75));
      body.style.opacity = bodyOp.toFixed(3);
    }
    if (img) {
      const scale = 1 + (1 - clamped) * 0.06;
      img.style.transform = `scale(${scale.toFixed(4)})`;
    }
  }, []);

  const startLoop = useCallback(() => {
    const a = animRef.current;
    if (a.raf) return;
    a.lastT = performance.now();

    const tick = (now: number) => {
      if (a.dragging) {
        a.raf = 0;
        return;
      }
      const dt = Math.min(0.032, Math.max(0.001, (now - a.lastT) / 1000));
      a.lastT = now;

      const opening = a.target > a.p;
      const k = opening ? 240 : 340;
      const d = 2 * Math.sqrt(k); // critically damped
      const acc = -k * (a.p - a.target) - d * a.v;
      a.v += acc * dt;
      a.p += a.v * dt;

      if (Math.abs(a.p - a.target) < 0.002 && Math.abs(a.v) < 0.01) {
        a.p = a.target;
        a.v = 0;
        applyFrame(a.p);
        a.raf = 0;
        return;
      }

      applyFrame(a.p);
      a.raf = window.requestAnimationFrame(tick);
    };

    a.raf = window.requestAnimationFrame(tick);
  }, [applyFrame]);

  useEffect(() => {
    const a = animRef.current;
    a.target = entry.expanded ? 1 : 0;
    if (instant) {
      a.p = a.target;
      a.v = 0;
      applyFrame(a.p);
    } else {
      startLoop();
    }
  }, [entry.expanded, instant, applyFrame, startLoop]);

  useEffect(() => {
    const a = animRef.current;
    applyFrame(a.p);
    return () => {
      if (a.raf) window.cancelAnimationFrame(a.raf);
    };
  }, [applyFrame]);

  const handleHeadPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if ((e.target as HTMLElement).closest("button")) return;
      const a = animRef.current;
      a.dragging = true;
      a.pointerId = e.pointerId;
      a.startY = e.clientY;
      a.lastY = e.clientY;
      a.lastDragT = performance.now();
      a.vy = 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      onDragChange(true);
    },
    [onDragChange],
  );

  const handleHeadPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const a = animRef.current;
      if (!a.dragging || a.pointerId !== e.pointerId) return;
      const dy = e.clientY - a.startY;
      const now = performance.now();
      const dt = Math.max(1, now - a.lastDragT);
      a.vy = ((e.clientY - a.lastY) / dt) * 1000;
      a.lastY = e.clientY;
      a.lastDragT = now;

      const dist = Math.max(120, a.cardH * 0.7);
      const nextP = dy < 0 ? Math.max(0.08, 1 + dy / dist) : 1;
      a.p = nextP;
      applyFrame(nextP);
    },
    [applyFrame],
  );

  const handleHeadPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const a = animRef.current;
      if (!a.dragging || a.pointerId !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      a.dragging = false;
      onDragChange(false);

      if (a.p < 0.6 || a.vy < -420) {
        onCollapse(entry.id);
      } else {
        a.target = 1;
        startLoop();
      }
    },
    [entry.id, onCollapse, onDragChange, startLoop],
  );

  const preview = entry.preview;
  if (!preview) return null;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div ref={plateRef} className={styles.plate} aria-hidden="true" />
      <div
        ref={cardRef}
        className={styles.card}
        aria-hidden={!entry.expanded}
        inert={!entry.expanded ? true : undefined}
      >
        <div
          className={styles.head}
          onPointerDown={handleHeadPointerDown}
          onPointerMove={handleHeadPointerMove}
          onPointerUp={handleHeadPointerUp}
          onPointerCancel={handleHeadPointerUp}
        >
          <span
            className={styles.fav}
            data-mono={!preview.favicon ? "true" : undefined}
            aria-hidden="true"
          >
            {preview.favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.favicon} alt="" width={16} height={16} />
            ) : (
              preview.site.charAt(0).toUpperCase()
            )}
          </span>
          <span className={styles.site}>{preview.site}</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Collapse ${preview.title} preview`}
            onClick={() => onCollapse(entry.id)}
          >
            <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Remove ${preview.title} link`}
            onClick={() => onRemove(entry.id)}
          >
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div ref={bodyRef} className={styles.body}>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.title}
          >
            {preview.title}
          </a>
          {preview.description && (
            <p className={styles.description}>{preview.description}</p>
          )}
          {preview.image && (
            <div className={styles.media}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={preview.image} alt="" />
              {preview.duration && (
                <span className={styles.play} aria-hidden="true">
                  <Play size={12} fill="currentColor" strokeWidth={0} />
                  {preview.duration}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LinkUnfurl({
  label = "Message #lisbon-offsite",
  placeholder = "Message #lisbon-offsite",
  defaultValue = "Found a place for the offsite, take a look",
  samples = DEFAULT_SAMPLES,
  resolve,
  autoExpand = true,
  autoPlay = true,
  speed = 1,
  paused = false,
  accent,
  sendLabel = "Send message",
  onSend,
  className,
  style,
}: LinkUnfurlProps) {
  const reduced = useReducedMotion();
  const hintId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const nextIdRef = useRef(1);
  const interactedRef = useRef(false);
  const autoPlayedRef = useRef(false);

  const [text, setText] = useState(defaultValue);
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const instant = Boolean(reduced || paused);

  const resolveLink = useCallback(
    (entryId: string, url: string) => {
      const prev = controllersRef.current.get(entryId);
      prev?.abort();
      const ctrl = new AbortController();
      controllersRef.current.set(entryId, ctrl);

      const sampleMatch = samples.find((s) => s.url === url);
      const delayMs = Math.max(120, Math.round(1150 / Math.max(0.2, speed)));

      const finish = (preview: LinkUnfurlPreview | null) => {
        if (ctrl.signal.aborted) return;
        controllersRef.current.delete(entryId);
        if (!preview) {
          setLinks((cur) =>
            cur.map((l) =>
              l.id === entryId ? { ...l, status: "failed", expanded: false } : l,
            ),
          );
          setAnnouncement(`Could not load preview for ${domainFromUrl(url)}`);
          return;
        }
        setLinks((cur) =>
          cur.map((l) =>
            l.id === entryId
              ? {
                  ...l,
                  status: "ready",
                  preview,
                  expanded: autoExpand,
                }
              : l,
          ),
        );
        setAnnouncement(
          autoExpand
            ? `Preview opened: ${preview.site}, ${preview.title}`
            : `Preview ready: ${preview.site}, ${preview.title}`,
        );
      };

      if (resolve) {
        resolve(url, ctrl.signal)
          .then(finish)
          .catch(() => finish(null));
      } else {
        const timer = window.setTimeout(() => {
          finish(sampleMatch ?? buildFallbackPreview(url));
        }, instant ? 180 : delayMs);
        ctrl.signal.addEventListener("abort", () => window.clearTimeout(timer), {
          once: true,
        });
      }
    },
    [autoExpand, instant, resolve, samples, speed],
  );

  const addUrl = useCallback(
    (url: string) => {
      setErrorMsg(null);
      const existing = links.find((l) => l.url === url);
      if (existing) {
        if (existing.status === "ready") {
          const nextExp = !existing.expanded;
          setLinks((cur) =>
            cur.map((l) => (l.id === existing.id ? { ...l, expanded: nextExp } : l)),
          );
          setAnnouncement(
            nextExp
              ? `Preview opened: ${existing.preview?.title ?? url}`
              : `Preview collapsed`,
          );
        } else if (existing.status === "failed") {
          setLinks((cur) =>
            cur.map((l) => (l.id === existing.id ? { ...l, status: "loading" } : l)),
          );
          resolveLink(existing.id, url);
        }
        return;
      }

      const id = `lu${nextIdRef.current++}`;
      setLinks((cur) => [
        ...cur,
        { id, url, status: "loading", expanded: false, preview: null },
      ]);
      setAnnouncement(`Added link ${domainFromUrl(url)}, loading preview`);
      resolveLink(id, url);
    },
    [links, resolveLink],
  );

  // AutoPlay first sample when visible
  useEffect(() => {
    if (!autoPlay || paused || samples.length === 0 || autoPlayedRef.current) return;
    const el = rootRef.current;
    if (!el) return;

    const trigger = () => {
      if (autoPlayedRef.current || interactedRef.current) return;
      autoPlayedRef.current = true;
      addUrl(samples[0].url);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          window.setTimeout(trigger, 350);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [addUrl, autoPlay, paused, samples]);

  // Cleanup controllers on unmount
  useEffect(() => {
    const map = controllersRef.current;
    return () => {
      map.forEach((c) => c.abort());
      map.clear();
    };
  }, []);

  const collapseLink = useCallback((id: string) => {
    interactedRef.current = true;
    setLinks((cur) => cur.map((l) => (l.id === id ? { ...l, expanded: false } : l)));
    setAnnouncement("Preview collapsed");
  }, []);

  const removeLink = useCallback((id: string) => {
    interactedRef.current = true;
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    setLinks((cur) => cur.filter((l) => l.id !== id));
    setAnnouncement("Link removed");
  }, []);

  const toggleChip = useCallback(
    (entry: LinkEntry) => {
      interactedRef.current = true;
      if (entry.status === "failed") {
        setLinks((cur) =>
          cur.map((l) => (l.id === entry.id ? { ...l, status: "loading" } : l)),
        );
        resolveLink(entry.id, entry.url);
        return;
      }
      if (entry.status === "ready") {
        const nextExp = !entry.expanded;
        setLinks((cur) =>
          cur.map((l) => (l.id === entry.id ? { ...l, expanded: nextExp } : l)),
        );
        setAnnouncement(nextExp ? "Preview opened" : "Preview collapsed");
      }
    },
    [resolveLink],
  );

  const handleSend = useCallback(async () => {
    const hasContent = text.trim().length > 0 || links.length > 0;
    if (!hasContent || sendState === "sending") return;
    interactedRef.current = true;
    setErrorMsg(null);

    const fullText = [text.trim(), ...links.map((l) => l.url)]
      .filter(Boolean)
      .join(" ");
    const previews = links
      .map((l) => l.preview)
      .filter((p): p is LinkUnfurlPreview => p !== null);

    try {
      setSendState("sending");
      await onSend?.({ text: fullText, previews });
      controllersRef.current.forEach((c) => c.abort());
      controllersRef.current.clear();
      setText("");
      if (editorRef.current) editorRef.current.textContent = "";
      setLinks([]);
      setSendState("sent");
      setAnnouncement("Message sent");
      window.setTimeout(() => setSendState("idle"), 1400);
    } catch (err) {
      setSendState("idle");
      setErrorMsg(err instanceof Error ? err.message : "Could not send message");
    }
  }, [links, onSend, sendState, text]);

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      interactedRef.current = true;
      const pasted = e.clipboardData.getData("text/plain");
      const match = pasted.match(URL_REGEX);
      if (match) {
        e.preventDefault();
        addUrl(match[0]);
      }
    },
    [addUrl],
  );

  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      interactedRef.current = true;
      if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        const last = links[links.length - 1];
        if (last) toggleChip(last);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
        return;
      }
      if (e.key === "Backspace") {
        const curText = editorRef.current?.textContent ?? "";
        if (curText.length === 0 && links.length > 0) {
          e.preventDefault();
          removeLink(links[links.length - 1].id);
        }
      }
    },
    [handleSend, links, removeLink, toggleChip],
  );

  const handleEditorInput = useCallback(() => {
    interactedRef.current = true;
    const raw = editorRef.current?.textContent ?? "";
    const match = raw.match(/(https?:\/\/[^\s]+)\s$/i);
    if (match) {
      const stripped = raw.replace(match[0], "").trimEnd();
      if (editorRef.current) editorRef.current.textContent = stripped;
      setText(stripped);
      addUrl(match[1]);
      return;
    }
    setText(raw);
  }, [addUrl]);

  const isEmpty = text.trim().length === 0 && links.length === 0;
  const rootStyle: CSSProperties = {
    ...style,
    ...(accent ? ({ "--lu-accent": accent } as CSSProperties) : {}),
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      style={rootStyle}
      data-running={paused ? "false" : "true"}
      data-reduced={reduced ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
    >
      <span id={hintId} className={styles.srOnly}>
        Enter sends, Shift+Enter adds a new line, Alt+Enter toggles the link preview.
      </span>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className={styles.composer}>
        <div className={styles.content}>
          <div className={styles.editor} data-empty={isEmpty ? "true" : "false"} data-placeholder={placeholder}>
            <span
              ref={editorRef}
              role="textbox"
              aria-multiline="true"
              aria-label={label}
              aria-describedby={hintId}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              onInput={handleEditorInput}
              onPaste={handlePaste}
              onKeyDown={handleEditorKeyDown}
            >
              {defaultValue}
            </span>
            {links.map((entry) => {
              const title = entry.preview?.title ?? domainFromUrl(entry.url);
              const site = entry.preview?.site ?? domainFromUrl(entry.url);
              return (
                <span
                  key={entry.id}
                  className={styles.chipWrap}
                  contentEditable={false}
                  data-link-id={entry.id}
                  data-url={entry.url}
                  data-status={entry.status}
                  data-expanded={entry.expanded ? "true" : "false"}
                >
                  <button
                    type="button"
                    className={styles.chip}
                    aria-label={`${title}, ${site} link`}
                    aria-expanded={entry.status === "ready" ? entry.expanded : undefined}
                    onClick={() => toggleChip(entry)}
                  >
                    <span
                      className={styles.chipFav}
                      data-mono={
                        entry.status === "ready" && !entry.preview?.favicon
                          ? "true"
                          : undefined
                      }
                      aria-hidden="true"
                    >
                      {entry.status === "loading" ? (
                        <Globe size={13} strokeWidth={1.75} />
                      ) : entry.preview?.favicon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.preview.favicon}
                          alt=""
                          width={16}
                          height={16}
                        />
                      ) : (
                        site.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className={styles.chipLabel}>{title}</span>
                  </button>
                </span>
              );
            })}
          </div>

          {links.some((l) => l.preview) && (
            <div className={styles.lane}>
              {links.map((entry) => (
                <PreviewCard
                  key={entry.id}
                  entry={entry}
                  instant={instant}
                  onCollapse={collapseLink}
                  onRemove={removeLink}
                  onDragChange={setDragging}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.samples}>
            {samples.length > 0 && (
              <>
                <span className={styles.tryLabel}>Try</span>
                {samples.map((s) => {
                  const active = links.some((l) => l.url === s.url && l.expanded);
                  return (
                    <button
                      key={s.url}
                      type="button"
                      className={styles.sample}
                      data-active={active ? "true" : undefined}
                      onClick={() => {
                        interactedRef.current = true;
                        addUrl(s.url);
                      }}
                    >
                      {s.favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.favicon} alt="" width={14} height={14} />
                      )}
                      <span>{s.site}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <button
            type="button"
            className={styles.send}
            aria-label={sendLabel}
            aria-disabled={isEmpty || sendState === "sending"}
            data-state={sendState}
            onClick={() => void handleSend()}
          >
            <span
              className={styles.sendIcon}
              data-show={sendState !== "sent" ? "true" : "false"}
              aria-hidden="true"
            >
              <ArrowUp size={17} strokeWidth={2} />
            </span>
            <span
              className={styles.sendIcon}
              data-show={sendState === "sent" ? "true" : "false"}
              aria-hidden="true"
            >
              <Check size={17} strokeWidth={2.2} />
            </span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <p role="alert" className={styles.error}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}

export default LinkUnfurl;
