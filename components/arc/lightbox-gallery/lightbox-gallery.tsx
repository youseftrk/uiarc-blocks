"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./lightbox-gallery.module.css";

export interface LightboxImage {
  src: string;
  width: number;
  height: number;
  alt: string;
  title?: string;
  caption?: string;
}

export interface LightboxGalleryProps {
  images: LightboxImage[];
  minColumnWidth?: number;
  gap?: number;
  label?: string;
  className?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FLIGHT_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 34,
  mass: 0.9,
};

function computeFitRect(
  imgW: number,
  imgH: number,
  vpW: number,
  vpH: number,
): Rect {
  const padX = vpW < 640 ? 16 : 72;
  const padTop = 64;
  const padBottom = 128;
  const availW = Math.max(120, vpW - padX * 2);
  const availH = Math.max(120, vpH - padTop - padBottom);
  const ratio = imgW / Math.max(1, imgH);
  let width = availW;
  let height = width / ratio;
  if (height > availH) {
    height = availH;
    width = height * ratio;
  }
  return {
    left: (vpW - width) / 2,
    top: padTop + (availH - height) / 2,
    width,
    height,
  };
}

export function LightboxGallery({
  images,
  minColumnWidth = 150,
  gap = 8,
  label = "Photo gallery",
  className,
}: LightboxGalleryProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const stripThumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const [colCount, setColCount] = useState(3);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [originRect, setOriginRect] = useState<Rect | null>(null);
  const [exitRect, setExitRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 1024, h: 768 });

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    mode: "none" | "swipe" | "dismiss" | "pan";
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    mode: "none",
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0,
    vy: 0,
  });

  // Responsive column count
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const next = Math.max(2, Math.floor((w + gap) / (minColumnWidth + gap)));
      setColCount(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gap, minColumnWidth]);

  // Viewport size tracking
  useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Distribute photos into shortest column
  const columns = useMemo(() => {
    const cols: Array<{ item: LightboxImage; index: number }[]> = Array.from(
      { length: colCount },
      () => [],
    );
    const heights = new Array<number>(colCount).fill(0);
    images.forEach((item, index) => {
      let shortest = 0;
      for (let i = 1; i < colCount; i++) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      cols[shortest].push({ item, index });
      heights[shortest] += item.height / Math.max(1, item.width);
    });
    return cols;
  }, [images, colCount]);

  const readThumbRect = useCallback((index: number): Rect | null => {
    const el = thumbRefs.current.get(index);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, []);

  const openAt = useCallback(
    (index: number) => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      setOriginRect(readThumbRect(index));
      setExitRect(null);
      setClosing(false);
      setScale(1);
      setPan({ x: 0, y: 0 });
      setDragOffset({ x: 0, y: 0 });
      setActiveIndex(index);
    },
    [readThumbRect],
  );

  const finishClose = useCallback((returnIndex: number) => {
    setActiveIndex(null);
    setClosing(false);
    setExitRect(null);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setDragOffset({ x: 0, y: 0 });
    window.requestAnimationFrame(() => {
      thumbRefs.current.get(returnIndex)?.focus();
    });
  }, []);

  const closeViewer = useCallback(() => {
    if (activeIndex === null || closing) return;
    const idx = activeIndex;
    const targetRect = readThumbRect(idx);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setDragOffset({ x: 0, y: 0 });
    if (reduced || !targetRect) {
      finishClose(idx);
      return;
    }
    setExitRect(targetRect);
    setClosing(true);
    window.setTimeout(() => {
      finishClose(idx);
    }, 260);
  }, [activeIndex, closing, finishClose, readThumbRect, reduced]);

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(images.length - 1, nextIndex));
      setScale(1);
      setPan({ x: 0, y: 0 });
      setDragOffset({ x: 0, y: 0 });
      setActiveIndex(clamped);
    },
    [images.length],
  );

  const toggleZoom = useCallback(() => {
    setScale((prev) => {
      if (prev > 1.05) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return 2.2;
    });
  }, []);

  // Scroll active strip thumbnail into view
  useEffect(() => {
    if (activeIndex === null) return;
    const el = stripThumbRefs.current.get(activeIndex);
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [activeIndex, reduced]);

  // Body scroll lock & initial focus
  useEffect(() => {
    if (activeIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts & focus trap
  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeViewer();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (activeIndex > 0) goTo(activeIndex - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (activeIndex < images.length - 1) goTo(activeIndex + 1);
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((s) => Math.min(3, +(s + 0.5).toFixed(2)));
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        setScale((s) => {
          const next = Math.max(1, +(s - 0.5).toFixed(2));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        setScale(1);
        setPan({ x: 0, y: 0 });
        return;
      }
      if (e.key === "Tab" && overlayRef.current) {
        const focusables = Array.from(
          overlayRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, closeViewer, goTo, images.length]);

  const handleStagePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const now = performance.now();
      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        mode: scale > 1.05 ? "pan" : "none",
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: now,
        vx: 0,
        vy: 0,
      };
      if (scale > 1.05) setIsPanning(true);
    },
    [pan.x, pan.y, scale],
  );

  const handleStagePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d.active || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      d.vx = ((e.clientX - d.lastX) / dt) * 1000;
      d.vy = ((e.clientY - d.lastY) / dt) * 1000;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastT = now;

      if (d.mode === "pan") {
        const maxPan = 280 * (scale - 1);
        setPan({
          x: Math.max(-maxPan, Math.min(maxPan, d.startPanX + dx)),
          y: Math.max(-maxPan, Math.min(maxPan, d.startPanY + dy)),
        });
        return;
      }

      if (d.mode === "none" && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        d.mode = Math.abs(dy) > Math.abs(dx) * 1.15 ? "dismiss" : "swipe";
      }

      if (d.mode === "swipe") {
        setDragOffset({ x: dx, y: 0 });
      } else if (d.mode === "dismiss") {
        setDragOffset({ x: dx * 0.35, y: dy });
      }
    },
    [scale],
  );

  const handleStagePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d.active || d.pointerId !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      d.active = false;
      setIsPanning(false);

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === "dismiss") {
        if (Math.abs(dy) > 110 || Math.abs(d.vy) > 650) {
          closeViewer();
          return;
        }
      } else if (d.mode === "swipe" && activeIndex !== null) {
        if ((dx < -60 || d.vx < -450) && activeIndex < images.length - 1) {
          goTo(activeIndex + 1);
          return;
        }
        if ((dx > 60 || d.vx > 450) && activeIndex > 0) {
          goTo(activeIndex - 1);
          return;
        }
      }
      setDragOffset({ x: 0, y: 0 });
    },
    [activeIndex, closeViewer, goTo, images.length],
  );

  const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setScale((prev) => {
      const next = Math.max(1, Math.min(3, +(prev - e.deltaY * 0.005).toFixed(2)));
      if (next <= 1.02) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  }, []);

  const currentImage = activeIndex !== null ? images[activeIndex] : null;
  const fitRect = currentImage
    ? computeFitRect(currentImage.width, currentImage.height, viewport.w, viewport.h)
    : null;

  const dismissProgress = Math.min(1, Math.abs(dragOffset.y) / 360);
  const veilOpacity = closing ? 0 : Math.max(0.15, 1 - dismissProgress * 0.85);
  const dismissScale = 1 - dismissProgress * 0.16;

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      role="region"
      aria-label={label}
    >
      <div className={styles.grid} style={{ gap }}>
        {columns.map((col, ci) => (
          <div key={ci} className={styles.column} style={{ gap }}>
            {col.map(({ item, index }) => {
              const name = item.title || item.alt || `Photo ${index + 1}`;
              return (
                <button
                  key={`${item.src}-${index}`}
                  ref={(node) => {
                    if (node) thumbRefs.current.set(index, node);
                    else thumbRefs.current.delete(index);
                  }}
                  type="button"
                  className={styles.thumb}
                  style={{ aspectRatio: `${item.width} / ${item.height}` }}
                  aria-label={`Open ${name}, photo ${index + 1} of ${images.length}`}
                  data-hidden={activeIndex === index ? "" : undefined}
                  onClick={() => openAt(index)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt=""
                    width={item.width}
                    height={item.height}
                    loading="lazy"
                    draggable={false}
                    className={styles.thumbImage}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {typeof document !== "undefined" &&
        activeIndex !== null &&
        currentImage &&
        fitRect &&
        createPortal(
          <div
            ref={overlayRef}
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            data-closing={closing ? "" : undefined}
            data-zoomed={scale > 1.05 ? "" : undefined}
            data-panning={isPanning ? "" : undefined}
            onWheel={handleWheel}
          >
            <motion.div
              className={styles.veil}
              initial={{ opacity: 0 }}
              animate={{ opacity: veilOpacity }}
              transition={reduced ? { duration: 0.14 } : { duration: 0.22 }}
            />

            <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
              {activeIndex + 1} of {images.length}
            </div>

            <div
              className={styles.stage}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerCancel={handleStagePointerUp}
            >
              <motion.div
                key={activeIndex}
                className={styles.frame}
                initial={
                  !reduced && originRect && !closing
                    ? {
                        x: originRect.left,
                        y: originRect.top,
                        width: originRect.width,
                        height: originRect.height,
                        opacity: 1,
                      }
                    : {
                        x: fitRect.left,
                        y: fitRect.top,
                        width: fitRect.width,
                        height: fitRect.height,
                        opacity: reduced ? 0 : 1,
                      }
                }
                animate={
                  closing && exitRect && !reduced
                    ? {
                        x: exitRect.left,
                        y: exitRect.top,
                        width: exitRect.width,
                        height: exitRect.height,
                        scale: 1,
                        opacity: 1,
                      }
                    : {
                        x: fitRect.left + dragOffset.x,
                        y: fitRect.top + dragOffset.y,
                        width: fitRect.width,
                        height: fitRect.height,
                        scale: dismissScale,
                        opacity: closing ? 0 : 1,
                      }
                }
                transition={
                  dragOffset.x !== 0 || dragOffset.y !== 0
                    ? { duration: 0 }
                    : reduced
                      ? { duration: 0.14 }
                      : FLIGHT_SPRING
                }
              >
                <motion.div
                  className={styles.zoom}
                  animate={{ scale, x: pan.x, y: pan.y }}
                  transition={
                    isPanning || reduced
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 360, damping: 34 }
                  }
                  onDoubleClick={toggleZoom}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImage.src}
                    alt={currentImage.alt}
                    width={currentImage.width}
                    height={currentImage.height}
                    draggable={false}
                    className={styles.layer}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Top bar */}
            <motion.div
              className={styles.topBar}
              initial={{ opacity: 0 }}
              animate={{ opacity: closing ? 0 : 1 }}
              transition={{ duration: 0.18 }}
            >
              <p className={styles.counter}>
                <span className={styles.num}>{activeIndex + 1}</span> /{" "}
                <span className={styles.num}>{images.length}</span>
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={scale > 1.05 ? "Reset zoom" : "Zoom in"}
                  aria-pressed={scale > 1.05}
                  onClick={toggleZoom}
                >
                  {scale > 1.05 ? (
                    <ZoomOut size={18} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
                <button
                  ref={closeBtnRef}
                  type="button"
                  className={styles.iconButton}
                  aria-label="Close viewer"
                  onClick={closeViewer}
                >
                  <X size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </motion.div>

            {/* Side navigation arrows */}
            <motion.div
              className={styles.sideNav}
              initial={{ opacity: 0 }}
              animate={{ opacity: closing ? 0 : 1 }}
              transition={{ duration: 0.18 }}
            >
              <button
                type="button"
                className={styles.navButton}
                aria-label="Previous photo"
                disabled={activeIndex === 0}
                onClick={() => goTo(activeIndex - 1)}
              >
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.navButton}
                aria-label="Next photo"
                disabled={activeIndex === images.length - 1}
                onClick={() => goTo(activeIndex + 1)}
              >
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </motion.div>

            {/* Bottom captions + thumbnail strip */}
            <motion.div
              className={styles.bottom}
              initial={{ opacity: 0 }}
              animate={{ opacity: closing ? 0 : 1 }}
              transition={{ duration: 0.18 }}
            >
              <div className={styles.captions}>
                <AnimatePresence mode="wait">
                  {(currentImage.title || currentImage.caption) && (
                    <motion.div
                      key={activeIndex}
                      className={styles.caption}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                    >
                      {currentImage.title && (
                        <p className={styles.captionTitle}>{currentImage.title}</p>
                      )}
                      {currentImage.caption && (
                        <p className={styles.captionText}>{currentImage.caption}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className={styles.thumbStrip} aria-label="Thumbnails">
                {images.map((img, i) => {
                  const isActive = i === activeIndex;
                  const thumbW = isActive
                    ? Math.round(48 * Math.min(1.6, Math.max(0.75, img.width / img.height)))
                    : 36;
                  return (
                    <button
                      key={`strip-${i}`}
                      ref={(node) => {
                        if (node) stripThumbRefs.current.set(i, node);
                        else stripThumbRefs.current.delete(i);
                      }}
                      type="button"
                      className={styles.stripThumb}
                      style={{ width: thumbW }}
                      data-active={isActive ? "" : undefined}
                      aria-current={isActive ? "true" : undefined}
                      aria-label={img.title || img.alt || `Photo ${i + 1}`}
                      onClick={() => goTo(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt="" loading="lazy" draggable={false} />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default LightboxGallery;
