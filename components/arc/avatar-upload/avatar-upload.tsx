"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { AlertCircle, Camera, Check, Minus, Plus } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./avatar-upload.module.css";

export interface AvatarUploadContext {
  /** Report upload progress from 0 to 1. */
  report: (progress: number) => void;
  /** Aborted when the upload is cancelled or the component unmounts. */
  signal: AbortSignal;
  /** The file the person chose, before cropping. */
  original: File;
}

export interface AvatarUploadHandle {
  /** Open the file picker. */
  open: () => void;
  /** Send a file through the same checks as a drop. */
  selectFile: (file: File) => void;
}

export interface AvatarUploadProps {
  /** The person's name, used for initials and labels. */
  name: string;
  /** Upload the cropped image. Resolve with the stored URL to show it. */
  onUpload: (image: Blob, context: AvatarUploadContext) => Promise<string | void>;
  /** The current photo. */
  src?: string | null;
  /** Called when the photo is removed. Remove is hidden without it. */
  onRemove?: () => void | Promise<void>;
  /** Called with every message shown as an error. */
  onError?: (message: string) => void;
  /** Accepted MIME types. */
  accept?: string[];
  /** Largest accepted file in bytes. */
  maxSize?: number;
  /** Diameter of the resting avatar in px. */
  size?: number;
  /** Side of the square image handed to onUpload, in px. */
  outputSize?: number;
  label?: string;
  /** Replaces the hint generated from accept and maxSize. */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

type Phase = "idle" | "crop" | "uploading" | "failed";
type Tone = "hint" | "error" | "success";
interface Message { id: number; tone: Tone; text: ReactNode }
interface Source { url: string; width: number; height: number; file: File }

const DEFAULT_ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const CROP = 184;
const MAX_ZOOM = 4;
const SMOOTH = { type: "spring", visualDuration: 0.36, bounce: 0 } as const;
const SNAPPY = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;
const INSTANT = { duration: 0 } as const;
const TYPE_NAMES: Record<string, string> = { "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WebP", "image/gif": "GIF", "image/avif": "AVIF", "image/svg+xml": "SVG" };

function megabytes(bytes: number) {
  const value = bytes / 1048576;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
}

function typeName(type: string) {
  return TYPE_NAMES[type] ?? (type.split("/")[1] ?? "").replace(/^x-/, "").toUpperCase();
}

function listTypes(accept: string[]) {
  const names = accept.map(typeName);
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** Past an edge the photo follows at a falling rate, never more than a quarter of the circle. */
function band(value: number, limit: number) {
  const over = Math.abs(value) - limit;
  if (over <= 0) return value;
  const max = CROP / 4;
  return Math.sign(value) * (limit + max * (1 - 1 / (over / max + 1)));
}

function clamp(value: number, limit: number) {
  return Math.min(limit, Math.max(-limit, value));
}

export const AvatarUpload = forwardRef<AvatarUploadHandle, AvatarUploadProps>(function AvatarUpload(
  {
    name,
    onUpload,
    src,
    onRemove,
    onError,
    accept = DEFAULT_ACCEPT,
    maxSize = 5242880,
    size = 88,
    outputSize = 512,
    label = "Profile photo",
    hint,
    disabled = false,
    className,
    style,
  },
  ref,
) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [photo, setPhoto] = useState<string | null>(src ?? null);
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setPhoto(src ?? null);
  }
  const [source, setSource] = useState<Source | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [zoom, setZoom] = useState(1);
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [settle, setSettle] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);
  const messageId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const ownedUrls = useRef(new Set<string>());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const movingTimer = useRef<number | null>(null);
  const dragDepth = useRef(0);
  const focusAfter = useRef<"circle" | "hit" | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const z = useMotionValue(1);
  const blockHeight = useMotionValue<number | string>("auto");
  const ring = useSpring(0, reduced ? { duration: 0 } : { visualDuration: 0.36, bounce: 0 });
  const dash = useTransform(ring, value => `${Math.max(0, Math.min(1, value))} 1`);

  const aspect = source ? source.width / source.height : 1;
  const baseW = aspect >= 1 ? CROP * aspect : CROP;
  const baseH = aspect >= 1 ? CROP : CROP / aspect;
  const transform = useTransform([x, y, z], ([px, py, pz]: number[]) =>
    `translate(-50%, -50%) translate(${(px / baseW) * 100}%, ${(py / baseH) * 100}%) scale(${pz})`);
  const imageStyle = { width: `${(baseW / CROP) * 100}%`, height: `${(baseH / CROP) * 100}%`, transform };

  const say = useCallback((tone: Tone, text: ReactNode) => {
    messageId.current += 1;
    setMessage({ id: messageId.current, tone, text });
    if (tone === "error" && typeof text === "string") onError?.(text);
  }, [onError]);

  const release = useCallback((url: string | null) => {
    if (url && ownedUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      ownedUrls.current.delete(url);
    }
  }, []);

  useEffect(() => {
    const urls = ownedUrls.current;
    return () => {
      abortRef.current?.abort();
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      if (first || reduced) { blockHeight.stop(); blockHeight.set(next); }
      else animate(blockHeight, next, SMOOTH);
      first = false;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [blockHeight, reduced]);

  useEffect(() => {
    if (focusAfter.current === "circle" && phase === "crop") circleRef.current?.focus({ preventScroll: true });
    else if (focusAfter.current === "hit" && phase === "idle") hitRef.current?.focus({ preventScroll: true });
    focusAfter.current = null;
  }, [phase]);

  const limits = useCallback((scale: number) => ({
    x: Math.max(0, (baseW * scale - CROP) / 2),
    y: Math.max(0, (baseH * scale - CROP) / 2),
  }), [baseW, baseH]);

  const touch = useCallback(() => {
    setMoving(true);
    if (movingTimer.current) window.clearTimeout(movingTimer.current);
    movingTimer.current = window.setTimeout(() => setMoving(false), 420);
  }, []);
  useEffect(() => () => { if (movingTimer.current) window.clearTimeout(movingTimer.current); }, []);

  const place = useCallback((nx: number, ny: number, scale: number, spring = false) => {
    const limit = limits(scale);
    const tx = clamp(nx, limit.x);
    const ty = clamp(ny, limit.y);
    z.set(scale);
    setZoom(scale);
    if (spring && !reduced) {
      animate(x, tx, SMOOTH);
      animate(y, ty, SMOOTH);
    } else {
      x.stop(); y.stop();
      x.set(tx); y.set(ty);
    }
  }, [limits, reduced, x, y, z]);

  const zoomTo = useCallback((next: number, px = 0, py = 0) => {
    const from = z.get();
    const scale = Math.min(MAX_ZOOM, Math.max(1, next));
    if (scale === from) return;
    const ratio = scale / from;
    place(px - (px - x.get()) * ratio, py - (py - y.get()) * ratio, scale);
    touch();
  }, [place, touch, x, y, z]);

  const selectFile = useCallback((file: File) => {
    if (disabled) return;
    if (!accept.includes(file.type)) {
      const kind = typeName(file.type) || (file.name.split(".").pop() ?? "").toUpperCase() || "Those";
      say("error", `${kind} files aren’t supported. Choose a ${listTypes(accept)}.`);
      return;
    }
    if (file.size > maxSize) {
      say("error", `That photo is ${megabytes(file.size)}. Choose one up to ${megabytes(maxSize)}.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(url);
        say("error", "That image couldn’t be opened. Try another file.");
        return;
      }
      abortRef.current?.abort();
      ownedUrls.current.add(url);
      setSource(previous => { release(previous?.url ?? null); return { url, width: image.naturalWidth, height: image.naturalHeight, file }; });
      setPending(previous => { release(previous); return null; });
      x.stop(); y.stop();
      x.set(0); y.set(0); z.set(1);
      setZoom(1);
      setProgress(null);
      setMessage(null);
      focusAfter.current = "circle";
      setPhase("crop");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      say("error", "That image couldn’t be opened. Try another file.");
    };
    image.src = url;
  }, [accept, disabled, maxSize, release, say, x, y, z]);

  const open = useCallback(() => { if (!disabled) fileRef.current?.click(); }, [disabled]);
  useImperativeHandle(ref, () => ({ open, selectFile }), [open, selectFile]);

  const upload = useCallback(async (blob: Blob, original: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    let announced = 0;
    setProgress(null);
    ring.jump(0);
    setAnnouncement("Uploading");
    setPhase("uploading");
    say("hint", "Uploading");
    try {
      const stored = await onUpload(blob, {
        signal: controller.signal,
        original,
        report: value => {
          if (controller.signal.aborted) return;
          const amount = Math.max(0, Math.min(1, value));
          setProgress(amount);
          ring.set(amount);
          const step = Math.floor(amount * 4) * 25;
          if (step > announced) { announced = step; setAnnouncement(`Uploading ${step}%`); }
        },
      });
      if (controller.signal.aborted) return;
      const local = stored ? null : URL.createObjectURL(blob);
      if (local) ownedUrls.current.add(local);
      setPhoto(previous => { release(previous); return stored || local; });
      setPending(previous => { release(previous); return null; });
      setSource(previous => { release(previous?.url ?? null); return null; });
      blobRef.current = null;
      setSettle(count => count + 1);
      setAnnouncement("");
      setPhase("idle");
      say("success", "Photo updated");
    } catch (error) {
      if (controller.signal.aborted) return;
      setAnnouncement("");
      setPhase("failed");
      say("error", error instanceof Error && error.message ? error.message : "Upload failed. Your previous photo is unchanged.");
    }
  }, [onUpload, release, ring, say]);

  const save = useCallback(() => {
    if (!source) return;
    const scale = z.get();
    const limit = limits(scale);
    const ox = clamp(x.get(), limit.x);
    const oy = clamp(y.get(), limit.y);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) { say("error", "That image couldn’t be opened. Try another file."); return; }
      const unit = outputSize / CROP;
      const w = baseW * scale * unit;
      const h = baseH * scale * unit;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, outputSize / 2 + ox * unit - w / 2, outputSize / 2 + oy * unit - h / 2, w, h);
      const type = source.file.type === "image/png" ? "image/png" : source.file.type === "image/webp" ? "image/webp" : "image/jpeg";
      canvas.toBlob(blob => {
        if (!blob) { say("error", "That image couldn’t be opened. Try another file."); return; }
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        ownedUrls.current.add(url);
        setPending(previous => { release(previous); return url; });
        void upload(blob, source.file);
      }, type, 0.92);
    };
    image.src = source.url;
  }, [baseH, baseW, limits, outputSize, release, say, source, upload, x, y, z]);

  const discard = useCallback((text: string | null) => {
    abortRef.current?.abort();
    abortRef.current = null;
    blobRef.current = null;
    setPending(previous => { release(previous); return null; });
    setSource(previous => { release(previous?.url ?? null); return null; });
    setProgress(null);
    setAnnouncement("");
    focusAfter.current = "hit";
    setPhase("idle");
    if (text) say("hint", text); else setMessage(null);
  }, [release, say]);

  const retry = useCallback(() => {
    if (blobRef.current && source) void upload(blobRef.current, source.file);
  }, [source, upload]);

  const remove = useCallback(() => {
    void onRemove?.();
    setPhoto(previous => { release(previous); return null; });
    say("hint", "Photo removed");
    hitRef.current?.focus({ preventScroll: true });
  }, [onRemove, release, say]);

  /* Crop gestures */
  const centre = () => {
    const rect = circleRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
  };
  const raw = useRef({ x: 0, y: 0 });
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "crop" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    x.stop(); y.stop();
    raw.current = { x: x.get(), y: y.get() };
    setMoving(true);
    if (movingTimer.current) window.clearTimeout(movingTimer.current);
    circleRef.current?.focus({ preventScroll: true });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    if (pointers.current.size >= 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y) || 1;
        const after = Math.hypot(next.x - other.x, next.y - other.y) || 1;
        const mid = centre();
        zoomTo(z.get() * (after / before), (next.x + other.x) / 2 - mid.x, (next.y + other.y) / 2 - mid.y);
        raw.current = { x: x.get(), y: y.get() };
      }
    } else {
      raw.current = { x: raw.current.x + next.x - previous.x, y: raw.current.y + next.y - previous.y };
      const limit = limits(z.get());
      x.set(reduced ? clamp(raw.current.x, limit.x) : band(raw.current.x, limit.x));
      y.set(reduced ? clamp(raw.current.y, limit.y) : band(raw.current.y, limit.y));
    }
    pointers.current.set(event.pointerId, next);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    raw.current = { x: x.get(), y: y.get() };
    if (pointers.current.size === 0) {
      place(x.get(), y.get(), z.get(), true);
      setMoving(false);
    }
  };

  useEffect(() => {
    const node = stageRef.current;
    if (!node || phase !== "crop") return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const mid = centre();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
      zoomTo(z.get() * factor, event.clientX - mid.x, event.clientY - mid.y);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [phase, zoomTo, z]);

  const onCropKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== "crop") return;
    const step = event.shiftKey ? 32 : 8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      place(x.get() + move[0], y.get() + move[1], z.get());
      touch();
    } else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomTo(z.get() + 0.1); }
    else if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomTo(z.get() - 0.1); }
    else if (event.key === "0") { event.preventDefault(); place(0, 0, 1, true); touch(); }
    else if (event.key === "Enter") { event.preventDefault(); save(); }
  };
  const onRootKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && phase === "crop") { event.preventDefault(); discard(null); }
  };

  /* Drop */
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const onDragEnter = (event: DragEvent) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) selectFile(file);
  };

  const cropping = phase === "crop";
  const busy = phase === "uploading" || phase === "failed";
  const shown = busy ? pending : photo;
  const move = reduced ? INSTANT : SMOOTH;
  const percent = `${Math.round(zoom * 100)}%`;
  const defaultHint = hint ?? `${listTypes(accept)}, up to ${megabytes(maxSize)}`;
  const current: Message = phase === "uploading"
    ? { id: -2, tone: "hint", text: progress === null ? "Uploading" : <>Uploading <span className={styles.number}>{Math.round(progress * 100)}%</span></> }
    : message ?? { id: -1, tone: "hint", text: defaultHint };
  const ringState = phase === "failed" ? "failed" : progress === null ? "waiting" : "progress";

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      role="group"
      aria-labelledby={titleId}
      data-phase={phase}
      data-dragging={dragging || undefined}
      data-moving={moving || undefined}
      onKeyDown={onRootKey}
      onDragEnter={onDragEnter}
      onDragOver={event => { if (!disabled && hasFiles(event)) event.preventDefault(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        className={styles.file}
        type="file"
        accept={accept.join(",")}
        tabIndex={-1}
        aria-hidden="true"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) selectFile(file);
        }}
      />
      <motion.div className={styles.autoHeight} style={{ height: blockHeight }}>
        <div ref={innerRef}>
          <div className={styles.layout} data-mode={cropping ? "crop" : "idle"}>
            <div
              ref={stageRef}
              className={styles.stage}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <motion.div className={styles.stageBackdrop} aria-hidden="true" layout style={{ borderRadius: 26 }} initial={false} animate={{ opacity: cropping ? 1 : 0 }} transition={move} />
              <motion.div
                ref={circleRef}
                className={styles.circle}
                tabIndex={cropping ? 0 : -1}
                layout
                transition={move}
                style={{ width: cropping ? CROP : size, height: cropping ? CROP : size }}
                data-busy={busy ? "" : undefined}
                {...(cropping ? {
                  role: "group",
                  "aria-roledescription": "crop area",
                  "aria-label": `Crop area, zoom ${percent}. Drag or use the arrow keys to move the photo, plus and minus to zoom, Enter to save, Escape to cancel.`,
                  onKeyDown: onCropKey,
                } : {})}
              >
                {cropping && source ? (
                   
                  <motion.img className={styles.ghost} alt="" draggable={false} src={source.url} style={imageStyle} initial={{ opacity: 0 }} animate={{ opacity: 0.24 }} transition={reduced ? INSTANT : { duration: 0.2 }} />
                ) : null}
                <motion.div className={styles.clip} initial={false} animate={{ scale: busy ? 0.9 : 1 }} transition={reduced ? INSTANT : busy ? SMOOTH : SNAPPY}>
                  {cropping && source ? (
                     
                    <motion.img className={styles.cropImage} alt="" draggable={false} src={source.url} style={imageStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reduced ? INSTANT : { duration: 0.2 }} />
                  ) : shown ? (
                     
                    <motion.img key={shown} className={styles.photo} alt="" draggable={false} src={shown} initial={reduced ? false : { opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.2 }} />
                  ) : (
                    <motion.span className={styles.initials} aria-hidden="true" style={{ fontSize: Math.round(size * 0.295) }} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}>{initialsOf(name)}</motion.span>
                  )}
                </motion.div>
                {!cropping && !busy ? (
                  <button ref={hitRef} type="button" className={styles.hit} aria-label={`${photo ? "Change" : "Upload"} ${label.toLowerCase()}`} disabled={disabled} onClick={open}>
                    <span className={styles.hitIcon} aria-hidden="true"><Camera size={20} strokeWidth={1.75} /></span>
                  </button>
                ) : null}
                <AnimatePresence>
                  {busy ? (
                    <motion.svg key="ring" className={styles.ring} data-state={ringState} viewBox="0 0 100 100" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: INSTANT }} transition={reduced ? INSTANT : { duration: 0.2 }}>
                      <circle className={styles.ringTrack} cx="50" cy="50" r="48" pathLength={1} />
                      {ringState === "waiting"
                        ? <circle className={styles.ringValue} cx="50" cy="50" r="48" pathLength={1} strokeDashoffset={0} strokeDasharray="0.25 1" />
                        : <motion.circle className={styles.ringValue} cx="50" cy="50" r="48" pathLength={1} strokeDashoffset={0} style={{ strokeDasharray: dash }} />}
                    </motion.svg>
                  ) : null}
                </AnimatePresence>
                {!busy && settle > 0 && !reduced ? (
                  <motion.svg key={`settle-${settle}`} className={styles.ring} data-state="settle" viewBox="0 0 100 100" aria-hidden="true" initial={{ opacity: 1, scale: 1 }} animate={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}>
                    <circle className={styles.ringValue} cx="50" cy="50" r="48" />
                  </motion.svg>
                ) : null}
              </motion.div>
            </div>
            <motion.div className={styles.side} layout="position" transition={move}>
              <motion.div key={cropping ? "crop" : "rest"} className={styles.sideContent} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <p id={titleId} className={styles.title}>{cropping ? "Adjust photo" : label}</p>
                {cropping ? (
                  <>
                    <p className={styles.hint}>Drag to reposition. Scroll or pinch to zoom.</p>
                    <div className={styles.zoom}>
                      <button type="button" className={styles.zoomButton} aria-label="Zoom out" disabled={zoom <= 1} onClick={() => zoomTo(z.get() - 0.25)}><Minus size={16} strokeWidth={1.75} aria-hidden="true" /></button>
                      <input
                        className={styles.range}
                        type="range"
                        min={1}
                        max={MAX_ZOOM}
                        step={0.01}
                        aria-label="Zoom"
                        aria-valuetext={percent}
                        value={zoom}
                        style={{ "--fill": `${((zoom - 1) / (MAX_ZOOM - 1)) * 100}%` } as CSSProperties}
                        onChange={event => zoomTo(Number(event.target.value))}
                      />
                      <button type="button" className={styles.zoomButton} aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => zoomTo(z.get() + 0.25)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /></button>
                    </div>
                    <div className={styles.actions}>
                      <button type="button" className={styles.solid} onClick={save}>Save photo</button>
                      <button type="button" className={styles.ghostButton} onClick={() => discard(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.message} aria-live="polite">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.p
                          key={current.id}
                          className={styles.messageText}
                          data-tone={current.tone}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)", y: 3 }}
                          animate={reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0 }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)", y: -3 }}
                          transition={{ duration: reduced ? 0 : 0.16 }}
                        >
                          {current.tone === "error" ? <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                          {current.tone === "success" ? <Check size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                          <span>{current.text}</span>
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    <div className={styles.actions}>
                      {phase === "uploading" ? (
                        <button type="button" className={styles.outline} onClick={() => discard("Upload canceled")}>Cancel upload</button>
                      ) : phase === "failed" ? (
                        <>
                          <button type="button" className={styles.solid} onClick={retry}>Try again</button>
                          <button type="button" className={styles.ghostButton} onClick={() => discard("Upload canceled")}>Discard</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className={styles.outline} disabled={disabled} onClick={open}>
                            <span className={styles.stack}>
                              <span aria-hidden="true" className={styles.sizer}>Upload photo</span>
                              <span aria-hidden="true" className={styles.sizer}>Replace photo</span>
                              <span>{photo ? "Replace photo" : "Upload photo"}</span>
                            </span>
                          </button>
                          {photo && onRemove ? (
                            <motion.button type="button" className={styles.ghostButton} disabled={disabled} initial={reduced ? false : { opacity: 0, filter: "blur(2px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} onClick={remove}>Remove</motion.button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>
      <span className={styles.srOnly} aria-live="polite">{announcement}</span>
    </div>
  );
});
