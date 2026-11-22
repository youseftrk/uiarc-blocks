"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./sand-text.module.css";

export interface SandTextProps {
  /** The text to form. Keep it to one short line. */
  text: string;
  /** Grain size in CSS px. */
  grain?: number;
  /** Radius the pointer digs through, in CSS px. */
  radius?: number;
  /** Grain colors. Each grain picks one and varies it slightly. Defaults to the text color. */
  palette?: string[];
  /** Element for the visually hidden text. */
  as?: "h1" | "h2" | "h3" | "p";
  /** Extra class on the root. Set font-size here to size the letters. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface BallisticGrain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  a: number;
  life: number;
}

const CELL_EMPTY = 0;
const CELL_STUCK = 1;
const CELL_FALLING = 2;

function parseColorToRGBA(color: string, ctx: CanvasRenderingContext2D): RGBA {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#111111";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] || 255 };
}

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
}

function varyColor(base: RGBA, seed: number): RGBA {
  // Deterministic subtle luminance variation for tactile sand grain look
  const h = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = h - Math.floor(h);
  const delta = (frac - 0.5) * 46;
  return {
    r: clampByte(base.r + delta),
    g: clampByte(base.g + delta),
    b: clampByte(base.b + delta),
    a: base.a,
  };
}

export function SandText({
  text,
  grain = 2,
  radius = 14,
  palette,
  as: Tag = "h2",
  className,
  style,
}: SandTextProps) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const propsRef = useRef({ text, grain, radius, palette, reducedMotion });
  useEffect(() => {
    propsRef.current = { text, grain, radius, palette, reducedMotion };
  }, [text, grain, radius, palette, reducedMotion]);

  const simRef = useRef<{
    cols: number;
    rows: number;
    grain: number;
    target: Uint8Array;
    state: Uint8Array;
    colorR: Uint8Array;
    colorG: Uint8Array;
    colorB: Uint8Array;
    colorA: Uint8Array;
    looseAge: Uint16Array;
    ballistic: BallisticGrain[];
    colors: RGBA[];
    rafId: number | null;
    running: boolean;
    frame: number;
    pointerActive: boolean;
    lastPointerTime: number;
    pointerX: number;
    pointerY: number;
    prevPointerX: number;
    prevPointerY: number;
    wake: () => void;
    rebuildMask: (collapseExisting: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colorProbe = document.createElement("canvas");
    colorProbe.width = 1;
    colorProbe.height = 1;
    const probeCtx = colorProbe.getContext("2d", { willReadFrequently: true });

    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

    const resolvePalette = (): RGBA[] => {
      if (!probeCtx) return [{ r: 24, g: 24, b: 27, a: 255 }];
      const p = propsRef.current.palette;
      if (p && p.length > 0) {
        return p.map((c) => parseColorToRGBA(c, probeCtx));
      }
      const computedColor = getComputedStyle(root).color || "#18181b";
      return [parseColorToRGBA(computedColor, probeCtx)];
    };

    const pickGrainColor = (colors: RGBA[], idx: number): RGBA => {
      const base = colors[idx % colors.length];
      return varyColor(base, idx + 1);
    };

    let imageData: ImageData | null = null;

    const sim = {
      cols: 0,
      rows: 0,
      grain: Math.max(1, Math.round(propsRef.current.grain)),
      target: new Uint8Array(0) as Uint8Array,
      state: new Uint8Array(0),
      colorR: new Uint8Array(0),
      colorG: new Uint8Array(0),
      colorB: new Uint8Array(0),
      colorA: new Uint8Array(0),
      looseAge: new Uint16Array(0),
      ballistic: [] as BallisticGrain[],
      colors: resolvePalette(),
      rafId: null as number | null,
      running: false,
      frame: 0,
      pointerActive: false,
      lastPointerTime: 0,
      pointerX: -1,
      pointerY: -1,
      prevPointerX: -1,
      prevPointerY: -1,
      wake: () => {},
      rebuildMask: (_collapseExisting: boolean) => {
        void _collapseExisting;
      },
    };

    const renderFrame = () => {
      const { cols, rows, state, colorR, colorG, colorB, colorA, ballistic } = sim;
      if (cols === 0 || rows === 0) return;
      if (!imageData || imageData.width !== cols || imageData.height !== rows) {
        imageData = ctx.createImageData(cols, rows);
      }
      const buf = imageData.data;
      buf.fill(0);

      const len = cols * rows;
      for (let i = 0; i < len; i++) {
        if (state[i] !== CELL_EMPTY) {
          const o = i * 4;
          buf[o] = colorR[i];
          buf[o + 1] = colorG[i];
          buf[o + 2] = colorB[i];
          buf[o + 3] = colorA[i];
        }
      }

      for (let i = 0; i < ballistic.length; i++) {
        const b = ballistic[i];
        const bx = Math.round(b.x);
        const by = Math.round(b.y);
        if (bx >= 0 && bx < cols && by >= 0 && by < rows) {
          const o = (by * cols + bx) * 4;
          buf[o] = b.r;
          buf[o + 1] = b.g;
          buf[o + 2] = b.b;
          buf[o + 3] = b.a;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const rasterizeText = (cols: number, rows: number, label: string): Uint8Array => {
      const target = new Uint8Array(cols * rows);
      if (!maskCtx || cols === 0 || rows === 0 || !label.trim()) return target;

      maskCanvas.width = cols;
      maskCanvas.height = rows;
      maskCtx.clearRect(0, 0, cols, rows);

      const cs = getComputedStyle(root);
      const fontFamily = cs.fontFamily || "system-ui, sans-serif";
      const fontWeight = cs.fontWeight || "500";
      const baseFontSize = parseFloat(cs.fontSize) || 64;
      const g = sim.grain;

      let fontSize = Math.min(rows * 0.72, baseFontSize / g);
      maskCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = maskCtx.measureText(label);
      const maxWidth = cols * 0.94;
      if (metrics.width > maxWidth && metrics.width > 0) {
        fontSize = fontSize * (maxWidth / metrics.width);
      }
      fontSize = Math.max(8, fontSize);

      maskCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      maskCtx.textAlign = "center";
      maskCtx.textBaseline = "alphabetic";
      maskCtx.fillStyle = "#ffffff";

      const fitted = maskCtx.measureText(label);
      const ascent = fitted.actualBoundingBoxAscent || fontSize * 0.74;
      const descent = fitted.actualBoundingBoxDescent || fontSize * 0.16;
      const textHeight = ascent + descent;
      // Place baseline slightly below center to leave headroom for pouring and bottom room for piles
      const baselineY = Math.min(
        rows - Math.max(2, Math.round(rows * 0.12)),
        Math.round((rows - textHeight) * 0.55 + ascent),
      );
      maskCtx.fillText(label, cols / 2, baselineY);

      const data = maskCtx.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < cols * rows; i++) {
        if (data[i * 4 + 3] > 110) {
          target[i] = 1;
        }
      }
      return target;
    };

    const fillTargetImmediately = () => {
      const { cols, rows, target, state, colorR, colorG, colorB, colorA, looseAge, colors } = sim;
      state.fill(CELL_EMPTY);
      looseAge.fill(0);
      sim.ballistic = [];
      for (let i = 0; i < cols * rows; i++) {
        if (target[i] === 1) {
          const c = pickGrainColor(colors, i);
          state[i] = CELL_STUCK;
          colorR[i] = c.r;
          colorG[i] = c.g;
          colorB[i] = c.b;
          colorA[i] = c.a;
        }
      }
      renderFrame();
    };

    const initGrid = (collapseExisting: boolean) => {
      const rect = root.getBoundingClientRect();
      const g = Math.max(1, Math.round(propsRef.current.grain));
      const cssW = Math.max(60, Math.floor(rect.width));
      const cssH = Math.max(40, Math.floor(rect.height));
      const cols = Math.max(16, Math.floor(cssW / g));
      const rows = Math.max(12, Math.floor(cssH / g));

      const sameSize = cols === sim.cols && rows === sim.rows && g === sim.grain;
      sim.colors = resolvePalette();

      if (!sameSize) {
        sim.cols = cols;
        sim.rows = rows;
        sim.grain = g;
        canvas.width = cols;
        canvas.height = rows;
        canvas.style.width = `${cols * g}px`;
        canvas.style.height = `${rows * g}px`;
        sim.state = new Uint8Array(cols * rows);
        sim.colorR = new Uint8Array(cols * rows);
        sim.colorG = new Uint8Array(cols * rows);
        sim.colorB = new Uint8Array(cols * rows);
        sim.colorA = new Uint8Array(cols * rows);
        sim.looseAge = new Uint16Array(cols * rows);
        sim.ballistic = [];
      }

      const nextTarget = rasterizeText(cols, rows, propsRef.current.text);
      sim.target = nextTarget;

      if (propsRef.current.reducedMotion) {
        fillTargetImmediately();
        return;
      }

      if (collapseExisting && sameSize) {
        // Release all previously stuck grains so the old word collapses into sand
        const len = cols * rows;
        for (let i = 0; i < len; i++) {
          if (sim.state[i] === CELL_STUCK) {
            sim.state[i] = CELL_FALLING;
            sim.looseAge[i] = 0;
          }
        }
      } else if (!sameSize) {
        // Start empty so letters pour in from above
        sim.state.fill(CELL_EMPTY);
        sim.looseAge.fill(0);
      }

      sim.wake();
    };

    const digAt = (x0: number, y0: number, x1: number, y1: number) => {
      if (propsRef.current.reducedMotion) return;
      const { cols, rows, grain: g, state, colorR, colorG, colorB, colorA, ballistic } = sim;
      const rCells = Math.max(2, propsRef.current.radius / g);
      const rSq = rCells * rCells;

      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(dist / Math.max(1, rCells * 0.45)));
      const vxBase = Math.max(-5.5, Math.min(5.5, dx * 0.24));
      const vyBase = Math.max(-5.5, Math.min(4.0, dy * 0.24 - 1.1));

      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 1 : s / steps;
        const cx = x0 + dx * t;
        const cy = y0 + dy * t;

        const minX = Math.max(0, Math.floor(cx - rCells));
        const maxX = Math.min(cols - 1, Math.ceil(cx + rCells));
        const minY = Math.max(0, Math.floor(cy - rCells));
        const maxY = Math.min(rows - 1, Math.ceil(cy + rCells));

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const ox = x - cx;
            const oy = y - cy;
            if (ox * ox + oy * oy > rSq) continue;
            const idx = y * cols + x;
            if (state[idx] !== CELL_EMPTY) {
              const angle = Math.atan2(oy, ox) + (Math.random() - 0.5) * 0.9;
              const push = 0.6 + Math.random() * 1.4;
              if (ballistic.length < 2400) {
                ballistic.push({
                  x,
                  y,
                  vx: vxBase + Math.cos(angle) * push,
                  vy: vyBase + Math.sin(angle) * push - 0.6,
                  r: colorR[idx],
                  g: colorG[idx],
                  b: colorB[idx],
                  a: colorA[idx],
                  life: 0,
                });
              }
              state[idx] = CELL_EMPTY;
              sim.looseAge[idx] = 0;
            }
          }
        }
      }
      sim.wake();
    };

    const stepSimulation = (): boolean => {
      const { cols, rows, target, state, colorR, colorG, colorB, colorA, looseAge, colors, ballistic } = sim;
      if (cols === 0 || rows === 0) return false;

      sim.frame += 1;
      const now = performance.now();
      const resting = !sim.pointerActive && now - sim.lastPointerTime > 520;
      let active = false;

      // 1. Update ballistic dug grains
      for (let i = ballistic.length - 1; i >= 0; i--) {
        const b = ballistic[i];
        b.vy += 0.28;
        b.vx *= 0.97;
        b.x += b.vx;
        b.y += b.vy;
        b.life += 1;

        const bx = Math.round(b.x);
        const by = Math.round(b.y);
        if (bx < 0 || bx >= cols || by >= rows) {
          ballistic.splice(i, 1);
          continue;
        }
        if (by >= 0) {
          const idx = by * cols + bx;
          if ((b.vy > 0 && (by === rows - 1 || state[idx] !== CELL_EMPTY)) || b.life > 18) {
            // Deposit into nearest empty cell
            let placed = false;
            for (let dy = 0; dy >= -2 && !placed; dy--) {
              const py = by + dy;
              if (py < 0 || py >= rows) continue;
              const pIdx = py * cols + bx;
              if (state[pIdx] === CELL_EMPTY) {
                state[pIdx] = CELL_FALLING;
                colorR[pIdx] = b.r;
                colorG[pIdx] = b.g;
                colorB[pIdx] = b.b;
                colorA[pIdx] = b.a;
                looseAge[pIdx] = 0;
                placed = true;
              }
            }
            ballistic.splice(i, 1);
            active = true;
            continue;
          }
        }
        active = true;
      }

      // 2. Pour missing target grains bottom-first (like filling jars) when resting
      if (resting) {
        // Spawn grains into empty target cells from bottom-up per column
        let spawnedThisFrame = 0;
        const maxSpawnPerFrame = Math.max(90, Math.floor((cols * rows) / 45));
        for (let x = 0; x < cols && spawnedThisFrame < maxSpawnPerFrame; x++) {
          // Find lowest unfilled target cell in column x
          for (let y = rows - 1; y >= 0; y--) {
            const idx = y * cols + x;
            if (target[idx] === 1 && state[idx] === CELL_EMPTY) {
              // Spawn either near top of column or a few cells above so it pours in smoothly
              const spawnY = Math.max(0, y - Math.min(18, Math.max(4, Math.floor(rows * 0.16))));
              const spawnIdx = spawnY * cols + x;
              if (state[spawnIdx] === CELL_EMPTY) {
                const c = pickGrainColor(colors, idx + sim.frame);
                state[spawnIdx] = CELL_FALLING;
                colorR[spawnIdx] = c.r;
                colorG[spawnIdx] = c.g;
                colorB[spawnIdx] = c.b;
                colorA[spawnIdx] = c.a;
                looseAge[spawnIdx] = 0;
                spawnedThisFrame += 1;
                active = true;
              } else {
                // If spawn position is busy, fill directly if blocked above
                const c = pickGrainColor(colors, idx);
                state[idx] = CELL_STUCK;
                colorR[idx] = c.r;
                colorG[idx] = c.g;
                colorB[idx] = c.b;
                colorA[idx] = c.a;
                spawnedThisFrame += 1;
                active = true;
              }
              break;
            }
          }
        }
      }

      // 3. Cellular automaton step for falling sand (bottom-to-top)
      const leftToRight = (sim.frame & 1) === 0;
      for (let y = rows - 1; y >= 0; y--) {
        for (let step = 0; step < cols; step++) {
          const x = leftToRight ? step : cols - 1 - step;
          const idx = y * cols + x;
          if (state[idx] !== CELL_FALLING) continue;

          // Check if grain should stick inside a target letter
          if (target[idx] === 1) {
            const belowIdx = (y + 1) * cols + x;
            const atBottom = y === rows - 1;
            const belowTargetOccupied =
              !atBottom && target[belowIdx] === 1 && state[belowIdx] !== CELL_EMPTY;
            const belowIsOutside = !atBottom && target[belowIdx] === 0;
            if (atBottom || belowTargetOccupied || belowIsOutside) {
              state[idx] = CELL_STUCK;
              looseAge[idx] = 0;
              active = true;
              continue;
            }
          }

          // Try falling straight down
          if (y < rows - 1) {
            const below = (y + 1) * cols + x;
            if (state[below] === CELL_EMPTY) {
              state[below] = CELL_FALLING;
              colorR[below] = colorR[idx];
              colorG[below] = colorG[idx];
              colorB[below] = colorB[idx];
              colorA[below] = colorA[idx];
              looseAge[below] = 0;
              state[idx] = CELL_EMPTY;
              active = true;
              continue;
            }

            // Try diagonal down-left / down-right
            const firstDir = ((x + y + sim.frame) & 1) === 0 ? -1 : 1;
            const d1x = x + firstDir;
            const d2x = x - firstDir;
            let moved = false;

            if (d1x >= 0 && d1x < cols) {
              const diag1 = (y + 1) * cols + d1x;
              if (state[diag1] === CELL_EMPTY) {
                state[diag1] = CELL_FALLING;
                colorR[diag1] = colorR[idx];
                colorG[diag1] = colorG[idx];
                colorB[diag1] = colorB[idx];
                colorA[diag1] = colorA[idx];
                looseAge[diag1] = 0;
                state[idx] = CELL_EMPTY;
                moved = true;
                active = true;
              }
            }
            if (!moved && d2x >= 0 && d2x < cols) {
              const diag2 = (y + 1) * cols + d2x;
              if (state[diag2] === CELL_EMPTY) {
                state[diag2] = CELL_FALLING;
                colorR[diag2] = colorR[idx];
                colorG[diag2] = colorG[idx];
                colorB[diag2] = colorB[idx];
                colorA[diag2] = colorA[idx];
                looseAge[diag2] = 0;
                state[idx] = CELL_EMPTY;
                moved = true;
                active = true;
              }
            }
            if (moved) continue;
          }

          // Grain could not fall further; if outside target and resting, drift away
          if (target[idx] === 0) {
            if (resting) {
              looseAge[idx] += 1;
              if (colorA[idx] > 10) {
                colorA[idx] = Math.max(0, colorA[idx] - 9);
                active = true;
              } else {
                state[idx] = CELL_EMPTY;
                looseAge[idx] = 0;
                active = true;
              }
            } else {
              active = true;
            }
          } else {
            state[idx] = CELL_STUCK;
            looseAge[idx] = 0;
          }
        }
      }

      // If pointer recently moved, keep ticking until heal timeout kicks in
      if (sim.pointerActive || now - sim.lastPointerTime <= 560) {
        active = true;
      }

      return active;
    };

    const tick = () => {
      const stillActive = stepSimulation();
      renderFrame();
      if (stillActive) {
        sim.rafId = window.requestAnimationFrame(tick);
      } else {
        sim.running = false;
        sim.rafId = null;
      }
    };

    sim.wake = () => {
      if (sim.running) return;
      sim.running = true;
      sim.rafId = window.requestAnimationFrame(tick);
    };

    sim.rebuildMask = (collapseExisting: boolean) => {
      initGrid(collapseExisting);
    };

    simRef.current = sim;

    initGrid(false);

    // Re-rasterize once web fonts finish loading
    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) {
          initGrid(false);
        }
      });
    }

    const ro = new ResizeObserver(() => {
      initGrid(false);
    });
    ro.observe(root);

    // Watch theme attribute changes on <html> so default text color stays synced
    const mo = new MutationObserver(() => {
      sim.colors = resolvePalette();
      const len = sim.cols * sim.rows;
      for (let i = 0; i < len; i++) {
        if (sim.state[i] !== CELL_EMPTY) {
          const c = pickGrainColor(sim.colors, i);
          sim.colorR[i] = c.r;
          sim.colorG[i] = c.g;
          sim.colorB[i] = c.b;
          sim.colorA[i] = c.a;
        }
      }
      renderFrame();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    const toGridCoords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / sim.grain;
      const y = (e.clientY - rect.top) / sim.grain;
      return { x, y };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (propsRef.current.reducedMotion) return;
      const { x, y } = toGridCoords(e);
      sim.pointerActive = true;
      sim.lastPointerTime = performance.now();
      sim.prevPointerX = x;
      sim.prevPointerY = y;
      sim.pointerX = x;
      sim.pointerY = y;
      digAt(x, y, x, y);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (propsRef.current.reducedMotion) return;
      if (e.pointerType === "touch" && !sim.pointerActive) return;
      const { x, y } = toGridCoords(e);
      const px = sim.pointerX < 0 ? x : sim.pointerX;
      const py = sim.pointerY < 0 ? y : sim.pointerY;
      sim.pointerActive = true;
      sim.lastPointerTime = performance.now();
      sim.prevPointerX = px;
      sim.prevPointerY = py;
      sim.pointerX = x;
      sim.pointerY = y;
      digAt(px, py, x, y);
    };

    const onPointerLeave = () => {
      sim.pointerActive = false;
      sim.pointerX = -1;
      sim.pointerY = -1;
      sim.lastPointerTime = performance.now();
      sim.wake();
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", onPointerLeave);
    root.addEventListener("pointercancel", onPointerLeave);
    root.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerLeave);
      root.removeEventListener("pointercancel", onPointerLeave);
      root.removeEventListener("pointerleave", onPointerLeave);
      if (sim.rafId !== null) {
        window.cancelAnimationFrame(sim.rafId);
      }
      simRef.current = null;
    };
  }, []);

  // React to text / grain / palette / reducedMotion changes
  const prevTextRef = useRef(text);
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const textChanged = prevTextRef.current !== text;
    prevTextRef.current = text;
    sim.rebuildMask(textChanged);
  }, [text, grain, palette, reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={style}
    >
      <Tag className={styles.srOnly}>{text}</Tag>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}

export default SandText;
