"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./skeleton-morph.module.css";

interface SkeletonMorphContextValue {
  loading: boolean;
  stagger: number;
}

const SkeletonMorphContext = createContext<SkeletonMorphContextValue | null>(null);

export interface SkeletonMorphProps {
  loading: boolean;
  children: ReactNode;
  stagger?: number;
  loadingLabel?: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

export function SkeletonMorph({
  loading,
  children,
  stagger = 0.04,
  loadingLabel = "Loading",
  as: Component = "div",
  className,
  style,
}: SkeletonMorphProps) {
  const ctx = useMemo<SkeletonMorphContextValue>(
    () => ({ loading, stagger }),
    [loading, stagger]
  );

  return (
    <SkeletonMorphContext.Provider value={ctx}>
      <Component
        aria-busy={loading}
        className={`${styles.root} ${className ?? ""}`}
        style={style}
      >
        {loading && (
          <span role="status" aria-live="polite" className={styles.srOnly}>
            {loadingLabel}
          </span>
        )}
        {children}
      </Component>
    </SkeletonMorphContext.Provider>
  );
}

type MorphTag =
  | "div"
  | "span"
  | "p"
  | "li"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "h2"
  | "h3"
  | "h4";

export interface MorphBlockProps {
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
  radius?: number | string | "circle";
  lines?: number;
  lineHeight?: number;
  as?: MorphTag;
  className?: string;
  style?: CSSProperties;
}

export function MorphBlock({
  children,
  width = "100%",
  height,
  radius = 6,
  lines,
  lineHeight = 20,
  as = "div",
  className,
  style,
}: MorphBlockProps) {
  const prefersReduced = useReducedMotion();
  const ctx = useContext(SkeletonMorphContext);
  const loading = ctx?.loading ?? false;
  const stagger = ctx?.stagger ?? 0.04;
  const blockId = useId();
  const orderIndex = useMemo(() => {
    let h = 0;
    for (let i = 0; i < blockId.length; i += 1) {
      h = (h * 31 + blockId.charCodeAt(i)) % 8;
    }
    return h;
  }, [blockId]);

  const delay = prefersReduced ? 0 : orderIndex * stagger;
  const resolvedRadius =
    radius === "circle"
      ? "9999px"
      : typeof radius === "number"
        ? `${radius}px`
        : radius;
  const resolvedHeight =
    height !== undefined
      ? typeof height === "number"
        ? `${height}px`
        : height
      : lines
        ? `${lines * lineHeight}px`
        : "12px";
  const resolvedWidth = typeof width === "number" ? `${width}px` : width;

  const Tag = as;
  const isInline = as === "span";

  return (
    <Tag
      className={`${styles.block} ${isInline ? styles.blockInline : ""} ${className ?? ""}`}
      style={style}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {loading ? (
          <motion.div
            key="skeleton"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0.7 }}
            animate={{ opacity: 1 }}
            exit={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 1.02, filter: "blur(3px)" }
            }
            transition={{ duration: 0.22, delay }}
            style={{ width: resolvedWidth }}
          >
            {lines && lines > 0 ? (
              <div className={styles.linesStack}>
                {Array.from({ length: lines }).map((_, i) => {
                  const isLastOfMany = lines > 1 && i === lines - 1;
                  return (
                    <div
                      key={i}
                      className={styles.lineRow}
                      style={{ height: `${lineHeight}px` }}
                    >
                      <div
                        className={`${styles.skeleton} ${styles.lineBar}`}
                        style={{
                          width: isLastOfMany ? "68%" : "100%",
                          borderRadius: resolvedRadius,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={styles.skeleton}
                style={{
                  width: resolvedWidth,
                  height: resolvedHeight,
                  borderRadius: resolvedRadius,
                }}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className={styles.content}
            initial={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 3, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReduced ? 0.14 : 0.28,
              delay,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </Tag>
  );
}
