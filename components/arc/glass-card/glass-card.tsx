"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./glass-card.module.css";

export interface GlassCardProps {
  image: string;
  imageAlt: string;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}

const TILT_SPRING = { stiffness: 260, damping: 24, mass: 0.6 };
const GLARE_SPRING = { stiffness: 320, damping: 32 };

export function GlassCard({
  image,
  imageAlt,
  title,
  subtitle,
  aside,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  tilt = 6,
  className,
  style,
}: GlassCardProps) {
  const reduced = useReducedMotion() ?? false;
  const detailId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? openProp : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const toggle = useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  const rxTarget = useMotionValue(0);
  const ryTarget = useMotionValue(0);
  const gxTarget = useMotionValue(-400);
  const gyTarget = useMotionValue(-400);
  const glareTarget = useMotionValue(0);

  const rx = useSpring(rxTarget, TILT_SPRING);
  const ry = useSpring(ryTarget, TILT_SPRING);
  const gx = useSpring(gxTarget, GLARE_SPRING);
  const gy = useSpring(gyTarget, GLARE_SPRING);
  const glare = useSpring(glareTarget, GLARE_SPRING);

  const transform = useMotionTemplate`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const unsubX = gx.on("change", (v) => {
      el.style.setProperty("--gx", String(v));
    });
    const unsubY = gy.on("change", (v) => {
      el.style.setProperty("--gy", String(v));
    });
    const unsubG = glare.on("change", (v) => {
      el.style.setProperty("--glare", String(v));
    });
    return () => {
      unsubX();
      unsubY();
      unsubG();
    };
  }, [gx, gy, glare]);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (reduced || e.pointerType === "touch") return;
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      if (tilt > 0) {
        rxTarget.set(-ny * tilt * 2);
        ryTarget.set(nx * tilt * 2);
      }

      const panelRect = panel.getBoundingClientRect();
      gxTarget.set(e.clientX - panelRect.left);
      gyTarget.set(e.clientY - panelRect.top);
      glareTarget.set(1);
    },
    [reduced, tilt, rxTarget, ryTarget, gxTarget, gyTarget, glareTarget],
  );

  const handlePointerLeave = useCallback(() => {
    rxTarget.set(0);
    ryTarget.set(0);
    glareTarget.set(0);
  }, [rxTarget, ryTarget, glareTarget]);

  const handleRootClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-glass-card-panel]")) return;
      toggle();
    },
    [toggle],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        headerRef.current?.focus();
      }
    },
    [isOpen, setOpen],
  );

  return (
    <motion.div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-open={isOpen ? "true" : undefined}
      style={{
        ...style,
        transform: reduced ? undefined : transform,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleRootClick}
      onKeyDown={handleKeyDown}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={imageAlt}
        className={styles.image}
        draggable={false}
      />
      <div className={styles.scrim} aria-hidden="true" />
      <motion.div
        ref={panelRef}
        layout={!reduced}
        transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
        className={styles.panel}
        data-glass-card-panel="true"
        style={
          {
            "--gx": -400,
            "--gy": -400,
            "--glare": 0,
            borderRadius: 22,
          } as CSSProperties
        }
      >
        <span className={styles.edge} aria-hidden="true" />
        <motion.button
          ref={headerRef}
          type="button"
          layout={reduced ? false : "position"}
          transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
          className={styles.header}
          data-glass-card-toggle="true"
          aria-expanded={isOpen}
          aria-controls={children ? detailId : undefined}
          onClick={toggle}
        >
          <span className={styles.titles}>
            <span className={styles.title}>{title}</span>
            {subtitle != null && (
              <span className={styles.subtitle}>{subtitle}</span>
            )}
          </span>
          {aside != null && <span className={styles.aside}>{aside}</span>}
        </motion.button>

        <AnimatePresence initial={false}>
          {isOpen && children != null && (
            <motion.div
              key="detail"
              id={detailId}
              className={styles.detail}
              data-glass-card-detail="true"
              initial={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` }
              }
              animate={
                reduced
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.subtle}px)` }
              }
              transition={
                reduced
                  ? { duration: 0.1 }
                  : {
                      duration: motionTokens.duration.standard,
                      ease: motionTokens.ease.enter,
                    }
              }
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default GlassCard;
