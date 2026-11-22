"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./product-gallery.module.css";

export interface ProductPhoto {
  src: string;
  alt: string;
  zoomSrc?: string;
}

export interface ProductColor {
  id: string;
  name: string;
  swatch: string;
  photos: ProductPhoto[];
  soldOut?: string[];
}

export interface ProductSize {
  id: string;
  label: string;
}

export interface ProductGalleryProps {
  colors: ProductColor[];
  sizes?: ProductSize[];
  color?: string;
  defaultColor?: string;
  onColorChange?: (id: string) => void;
  size?: string | null;
  defaultSize?: string | null;
  onSizeChange?: (id: string | null) => void;
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  zoom?: number;
  magnifier?: boolean;
  aspectRatio?: number;
  label?: string;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
  ready: boolean;
}

const EMPTY_BOX: RectBox = { x: 0, y: 0, w: 0, h: 0, ready: false };

function useIndicatorRect(
  containerRef: React.RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: unknown[]
): RectBox {
  const [box, setBox] = useState<RectBox>(EMPTY_BOX);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(activeSelector);
    if (!el) {
      setBox((prev) => (prev.ready ? EMPTY_BOX : prev));
      return;
    }
    const next: RectBox = {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
      ready: true,
    };
    setBox((prev) =>
      prev.x === next.x &&
      prev.y === next.y &&
      prev.w === next.w &&
      prev.h === next.h &&
      prev.ready === next.ready
        ? prev
        : next
    );
  }, [containerRef, activeSelector]);

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, measure]);

  return box;
}

export function ProductGallery({
  colors,
  sizes,
  color: controlledColor,
  defaultColor,
  onColorChange,
  size: controlledSize,
  defaultSize = null,
  onSizeChange,
  index: controlledIndex,
  defaultIndex = 0,
  onIndexChange,
  zoom = 2.5,
  magnifier = true,
  aspectRatio = 4 / 5,
  label = "Product gallery",
  header,
  footer,
  className,
}: ProductGalleryProps) {
  const uid = useId();
  const prefersReduced = Boolean(useReducedMotion());

  const [uncontrolledColor, setUncontrolledColor] = useState(
    () => defaultColor ?? colors[0]?.id ?? ""
  );
  const [uncontrolledSize, setUncontrolledSize] = useState<string | null>(
    defaultSize
  );
  const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);

  const activeColorId =
    controlledColor !== undefined ? controlledColor : uncontrolledColor;
  const activeColor = useMemo(
    () => colors.find((c) => c.id === activeColorId) ?? colors[0],
    [colors, activeColorId]
  );

  const activeSizeId =
    controlledSize !== undefined ? controlledSize : uncontrolledSize;

  const photos = useMemo(() => activeColor?.photos ?? [], [activeColor]);
  const rawIndex =
    controlledIndex !== undefined ? controlledIndex : uncontrolledIndex;
  const activeIndex = Math.max(0, Math.min(photos.length - 1, rawIndex));

  const setColor = useCallback(
    (nextId: string) => {
      const nextColor = colors.find((c) => c.id === nextId);
      if (controlledColor === undefined) setUncontrolledColor(nextId);
      onColorChange?.(nextId);

      // Clear selected size if sold out in the newly chosen color
      if (
        activeSizeId &&
        nextColor?.soldOut?.includes(activeSizeId)
      ) {
        if (controlledSize === undefined) setUncontrolledSize(null);
        onSizeChange?.(null);
      }

      // Clamp photo index
      if (nextColor && activeIndex >= nextColor.photos.length) {
        const clamped = Math.max(0, nextColor.photos.length - 1);
        if (controlledIndex === undefined) setUncontrolledIndex(clamped);
        onIndexChange?.(clamped);
      }
    },
    [
      colors,
      controlledColor,
      onColorChange,
      activeSizeId,
      controlledSize,
      onSizeChange,
      activeIndex,
      controlledIndex,
      onIndexChange,
    ]
  );

  const setSize = useCallback(
    (nextId: string | null) => {
      if (controlledSize === undefined) setUncontrolledSize(nextId);
      onSizeChange?.(nextId);
    },
    [controlledSize, onSizeChange]
  );

  const setIndex = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(photos.length - 1, nextIdx));
      if (controlledIndex === undefined) setUncontrolledIndex(clamped);
      onIndexChange?.(clamped);
    },
    [photos.length, controlledIndex, onIndexChange]
  );

  // Refs for sliding indicators & stage
  const stageRef = useRef<HTMLButtonElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const swatchesRef = useRef<HTMLDivElement | null>(null);
  const sizesRef = useRef<HTMLDivElement | null>(null);

  const railBox = useIndicatorRect(railRef, '[data-active="true"]', [
    activeIndex,
    activeColor?.id,
    photos.length,
  ]);
  const swatchBox = useIndicatorRect(swatchesRef, '[data-active="true"]', [
    activeColor?.id,
    colors.length,
  ]);
  const sizeBox = useIndicatorRect(sizesRef, '[data-active="true"]', [
    activeSizeId,
    activeColor?.id,
    sizes?.length,
  ]);

  // Magnifier lens state
  const [lens, setLens] = useState<{
    active: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
  }>({ active: false, x: 0, y: 0, w: 1, h: 1 });

  const handleStagePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!magnifier || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setLens({ active: true, x, y, w: rect.width, h: rect.height });
  };

  const handleStagePointerLeave = () => {
    setLens((prev) => (prev.active ? { ...prev, active: false } : prev));
  };

  // Fullscreen viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerZoomed, setViewerZoomed] = useState(false);
  const [viewerPan, setViewerPan] = useState({ x: 0, y: 0 });
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const openViewer = () => {
    setLens((prev) => (prev.active ? { ...prev, active: false } : prev));
    setViewerZoomed(false);
    setViewerPan({ x: 0, y: 0 });
    setViewerOpen(true);
  };

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setViewerZoomed(false);
    setViewerPan({ x: 0, y: 0 });
    window.requestAnimationFrame(() => {
      stageRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!viewerOpen) return;
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeViewer();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewerZoomed(false);
        setViewerPan({ x: 0, y: 0 });
        setIndex(activeIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewerZoomed(false);
        setViewerPan({ x: 0, y: 0 });
        setIndex(activeIndex + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex(photos.length - 1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [viewerOpen, closeViewer, activeIndex, photos.length, setIndex]);

  // Keyboard nav on stage
  const handleStageKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setIndex(activeIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setIndex(activeIndex + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIndex(photos.length - 1);
    }
  };

  // Keyboard nav on thumbnail rail
  const handleThumbKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      next = (idx + 1) % photos.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      next = (idx - 1 + photos.length) % photos.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = photos.length - 1;
    }
    if (next !== null) {
      e.preventDefault();
      setIndex(next);
      const btns = railRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      btns?.[next]?.focus();
    }
  };

  // Keyboard nav on color swatches
  const handleSwatchKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (idx + 1) % colors.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (idx - 1 + colors.length) % colors.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = colors.length - 1;
    }
    if (next !== null) {
      e.preventDefault();
      setColor(colors[next].id);
      const btns = swatchesRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      btns?.[next]?.focus();
    }
  };

  // Keyboard nav on sizes (skips sold-out sizes)
  const handleSizeKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (!sizes) return;
    const soldOutSet = new Set(activeColor?.soldOut ?? []);
    const availableIndices = sizes
      .map((s, i) => (soldOutSet.has(s.id) ? -1 : i))
      .filter((i) => i !== -1);
    if (availableIndices.length === 0) return;

    const pos = availableIndices.indexOf(idx);
    let targetIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      targetIdx = availableIndices[(pos + 1) % availableIndices.length];
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      targetIdx =
        availableIndices[
          (pos - 1 + availableIndices.length) % availableIndices.length
        ];
    } else if (e.key === "Home") {
      targetIdx = availableIndices[0];
    } else if (e.key === "End") {
      targetIdx = availableIndices[availableIndices.length - 1];
    }
    if (targetIdx !== null) {
      e.preventDefault();
      setSize(sizes[targetIdx].id);
      const btns = sizesRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      btns?.[targetIdx]?.focus();
    }
  };

  const activePhoto = photos[activeIndex];
  const soldOutSet = useMemo(
    () => new Set(activeColor?.soldOut ?? []),
    [activeColor]
  );
  const activeSizeLabel =
    sizes?.find((s) => s.id === activeSizeId)?.label ?? "Select a size";

  const springTransition = prefersReduced
    ? { duration: 0 }
    : motionTokens.spring.snappy;

  const lensSize = 176;
  const lensHalf = lensSize / 2;

  return (
    <div
      className={className ? `${styles.root} ${className}` : styles.root}
      style={{ "--ratio": aspectRatio } as CSSProperties}
    >
      <div className={styles.layout}>
        <div
          className={styles.media}
          role="group"
          aria-label={label}
          aria-roledescription="gallery"
        >
          <button
            ref={stageRef}
            type="button"
            className={styles.stage}
            data-lens={lens.active ? "true" : undefined}
            aria-label={
              activePhoto
                ? `${activePhoto.alt}. Photo ${activeIndex + 1} of ${photos.length}. Open fullscreen`
                : "Open fullscreen"
            }
            onClick={openViewer}
            onKeyDown={handleStageKeyDown}
            onPointerMove={handleStagePointerMove}
            onPointerLeave={handleStagePointerLeave}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={activeColor?.id ?? "default"}
                className={styles.track}
                initial={
                  prefersReduced
                    ? { opacity: 1 }
                    : { opacity: 0, filter: "blur(4px)" }
                }
                animate={{
                  opacity: 1,
                  filter: "blur(0px)",
                  x: `-${activeIndex * 100}%`,
                }}
                exit={
                  prefersReduced
                    ? { opacity: 1 }
                    : { opacity: 0, filter: "blur(4px)" }
                }
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : {
                        opacity: { duration: 0.22 },
                        filter: { duration: 0.22 },
                        x: { type: "spring", visualDuration: 0.32, bounce: 0 },
                      }
                }
              >
                {photos.map((photo, i) => (
                  <span key={`${photo.src}-${i}`} className={styles.slide}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.photo}
                      src={photo.src}
                      alt={photo.alt}
                      loading={i === 0 ? "eager" : "lazy"}
                      draggable={false}
                    />
                  </span>
                ))}
              </motion.span>
            </AnimatePresence>

            {/* Hover magnifier lens */}
            <AnimatePresence>
              {magnifier && lens.active && activePhoto && (
                <motion.span
                  className={styles.lens}
                  aria-hidden="true"
                  initial={
                    prefersReduced
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.72 }
                  }
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: lens.x - lensHalf,
                    y: lens.y - lensHalf,
                  }}
                  exit={
                    prefersReduced
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.8 }
                  }
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : {
                          opacity: { duration: 0.14 },
                          scale: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
                          x: { duration: 0 },
                          y: { duration: 0 },
                        }
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.lensPhoto}
                    src={activePhoto.zoomSrc ?? activePhoto.src}
                    alt=""
                    style={{
                      width: lens.w * zoom,
                      height: lens.h * zoom,
                      transform: `translate(${lensHalf - lens.x * zoom}px, ${
                        lensHalf - lens.y * zoom
                      }px)`,
                    }}
                    draggable={false}
                  />
                </motion.span>
              )}
            </AnimatePresence>

            <span className={styles.expand} aria-hidden="true">
              <Maximize2 size={15} strokeWidth={1.75} />
            </span>

            <span className={styles.dots} aria-hidden="true">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={styles.dot}
                  data-active={i === activeIndex ? "true" : undefined}
                />
              ))}
            </span>
          </button>

          <div
            ref={railRef}
            className={styles.rail}
            role="tablist"
            aria-label="Photos"
          >
            {railBox.ready && (
              <motion.span
                className={styles.railIndicator}
                aria-hidden="true"
                initial={false}
                animate={{
                  x: railBox.x,
                  y: railBox.y,
                  width: railBox.w,
                  height: railBox.h,
                  opacity: 1,
                }}
                transition={springTransition}
              />
            )}
            {photos.map((photo, i) => {
              const isSelected = i === activeIndex;
              return (
                <button
                  key={`${photo.src}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`Photo ${i + 1} of ${photos.length}: ${photo.alt}`}
                  tabIndex={isSelected ? 0 : -1}
                  className={styles.thumb}
                  data-active={isSelected ? "true" : undefined}
                  onClick={() => setIndex(i)}
                  onKeyDown={(e) => handleThumbKeyDown(e, i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.thumbPhoto}
                    src={photo.src}
                    alt=""
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.details}>
          {header}

          {colors.length > 0 && (
            <div className={styles.picker}>
              <p className={styles.pickerLabel} id={`${uid}-color`}>
                <span>Color</span>
                <span className={styles.pickerValue}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={activeColor?.id}
                      initial={
                        prefersReduced
                          ? { opacity: 1 }
                          : { opacity: 0, filter: "blur(3px)" }
                      }
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={
                        prefersReduced
                          ? { opacity: 1 }
                          : { opacity: 0, filter: "blur(3px)" }
                      }
                      transition={{ duration: prefersReduced ? 0 : 0.16 }}
                    >
                      {activeColor?.name}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </p>
              <div
                ref={swatchesRef}
                className={styles.swatches}
                role="radiogroup"
                aria-labelledby={`${uid}-color`}
              >
                {swatchBox.ready && (
                  <motion.span
                    className={styles.swatchRing}
                    aria-hidden="true"
                    initial={false}
                    animate={{
                      x: swatchBox.x,
                      y: swatchBox.y,
                      width: swatchBox.w,
                      height: swatchBox.h,
                      opacity: 1,
                    }}
                    transition={springTransition}
                  />
                )}
                {colors.map((c, i) => {
                  const isActive = c.id === activeColor?.id;
                  const allSoldOut =
                    sizes && sizes.length > 0
                      ? sizes.every((s) => c.soldOut?.includes(s.id))
                      : false;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={c.name}
                      tabIndex={isActive ? 0 : -1}
                      className={styles.swatch}
                      data-active={isActive ? "true" : undefined}
                      data-sold-out={allSoldOut ? "true" : undefined}
                      onClick={() => setColor(c.id)}
                      onKeyDown={(e) => handleSwatchKeyDown(e, i)}
                    >
                      <span
                        className={styles.swatchFill}
                        style={{ background: c.swatch }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sizes && sizes.length > 0 && (
            <div className={styles.picker}>
              <p className={styles.pickerLabel} id={`${uid}-size`}>
                <span>Size</span>
                <span className={styles.pickerValue}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={activeSizeLabel}
                      initial={
                        prefersReduced
                          ? { opacity: 1 }
                          : { opacity: 0, filter: "blur(3px)" }
                      }
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={
                        prefersReduced
                          ? { opacity: 1 }
                          : { opacity: 0, filter: "blur(3px)" }
                      }
                      transition={{ duration: prefersReduced ? 0 : 0.16 }}
                    >
                      {activeSizeLabel}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </p>
              <div
                ref={sizesRef}
                className={styles.sizes}
                role="radiogroup"
                aria-labelledby={`${uid}-size`}
              >
                <motion.span
                  className={styles.sizeFill}
                  aria-hidden="true"
                  initial={false}
                  animate={
                    sizeBox.ready
                      ? {
                          x: sizeBox.x,
                          y: sizeBox.y,
                          width: sizeBox.w,
                          height: sizeBox.h,
                          opacity: 1,
                        }
                      : { opacity: 0 }
                  }
                  transition={springTransition}
                />
                {sizes.map((s, i) => {
                  const isSoldOut = soldOutSet.has(s.id);
                  const isActive = !isSoldOut && activeSizeId === s.id;
                  const firstEnabledIdx = sizes.findIndex(
                    (x) => !soldOutSet.has(x.id)
                  );
                  const isTabStop =
                    isActive ||
                    (!activeSizeId && i === firstEnabledIdx);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-disabled={isSoldOut || undefined}
                      aria-label={isSoldOut ? `${s.label}, sold out` : undefined}
                      tabIndex={isTabStop ? 0 : -1}
                      className={styles.size}
                      data-active={isActive ? "true" : undefined}
                      data-sold-out={isSoldOut ? "true" : undefined}
                      onClick={() => {
                        if (!isSoldOut) setSize(s.id);
                      }}
                      onKeyDown={(e) => handleSizeKeyDown(e, i)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {footer}
        </div>
      </div>

      {/* Fullscreen viewer modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {viewerOpen && activePhoto && (
              <motion.div
                className={styles.viewer}
                role="dialog"
                aria-modal="true"
                aria-label={`${label} fullscreen viewer`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.2 }}
              >
                <div
                  className={styles.backdrop}
                  onClick={closeViewer}
                  aria-hidden="true"
                />

                <div className={styles.viewerTop}>
                  <span className={styles.counter}>
                    {activeIndex + 1} / {photos.length}
                  </span>
                  <span className={styles.hint}>
                    {viewerZoomed
                      ? "Click to zoom out"
                      : "Click photo to zoom · Arrow keys to browse · Esc to close"}
                  </span>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    className={styles.viewerButton}
                    aria-label="Close fullscreen"
                    onClick={closeViewer}
                  >
                    <X size={18} strokeWidth={1.75} />
                  </button>
                </div>

                <div className={styles.frameWrap}>
                  <motion.div
                    className={styles.frame}
                    style={{ "--ratio": aspectRatio } as CSSProperties}
                    data-zoomed={viewerZoomed ? "true" : undefined}
                    initial={prefersReduced ? { scale: 1 } : { scale: 0.94 }}
                    animate={{ scale: 1 }}
                    exit={prefersReduced ? { scale: 1 } : { scale: 0.95 }}
                    transition={
                      prefersReduced
                        ? { duration: 0 }
                        : { type: "spring", visualDuration: 0.26, bounce: 0 }
                    }
                    onClick={() => {
                      setViewerZoomed((z) => {
                        if (z) setViewerPan({ x: 0, y: 0 });
                        return !z;
                      });
                    }}
                    onPointerMove={(e) => {
                      if (!viewerZoomed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const nx = (e.clientX - rect.left) / rect.width - 0.5;
                      const ny = (e.clientY - rect.top) / rect.height - 0.5;
                      setViewerPan({
                        x: -nx * rect.width * 0.65,
                        y: -ny * rect.height * 0.65,
                      });
                    }}
                  >
                    <motion.div
                      className={styles.zoomLayer}
                      animate={{
                        scale: viewerZoomed ? 2.1 : 1,
                        x: viewerZoomed ? viewerPan.x : 0,
                        y: viewerZoomed ? viewerPan.y : 0,
                      }}
                      transition={
                        prefersReduced
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 360, damping: 34 }
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.photo}
                        src={activePhoto.zoomSrc ?? activePhoto.src}
                        alt={activePhoto.alt}
                        draggable={false}
                      />
                    </motion.div>
                  </motion.div>
                </div>

                <div className={styles.viewerNav}>
                  <button
                    type="button"
                    className={styles.viewerButton}
                    aria-label="Previous photo"
                    disabled={activeIndex <= 0}
                    onClick={() => {
                      setViewerZoomed(false);
                      setViewerPan({ x: 0, y: 0 });
                      setIndex(activeIndex - 1);
                    }}
                  >
                    <ChevronLeft size={18} strokeWidth={1.75} />
                  </button>
                  <div className={styles.viewerDots} aria-hidden="true">
                    {photos.map((_, i) => (
                      <span
                        key={i}
                        className={styles.dot}
                        data-active={i === activeIndex ? "true" : undefined}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.viewerButton}
                    aria-label="Next photo"
                    disabled={activeIndex >= photos.length - 1}
                    onClick={() => {
                      setViewerZoomed(false);
                      setViewerPan({ x: 0, y: 0 });
                      setIndex(activeIndex + 1);
                    }}
                  >
                    <ChevronRight size={18} strokeWidth={1.75} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

export default ProductGallery;
