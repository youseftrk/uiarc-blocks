"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from "react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./black-hole.module.css";

export interface BlackHoleOptions {
  /** Where the hole opens, in viewport coordinates. Defaults to the centre of the targets. */
  origin?: { x: number; y: number };
  /** Length of the effect in seconds. The reverse runs a little faster. */
  duration?: number;
}

export interface BlackHoleHandle {
  swallow: (targets: Element[], options?: BlackHoleOptions) => Promise<void>;
  release: (targets: Element[], options?: BlackHoleOptions) => Promise<void>;
}

export interface BlackHoleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const LENS_VERT = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const LENS_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uO; uniform float uLens;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = p - uO; float r = length(d);
  vec2 q = p;
  if (uLens > 0.0) { float beta = r - uLens * uLens / max(r, 0.5); q = uO + d / max(r, 0.001) * beta; }
  vec2 uv = q / uRes;
  color = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(uTex, uv);
}`;
const MESH_VERT = `#version 300 es
in vec2 aPos;
uniform vec2 uRes; uniform vec2 uO; uniform float uT; uniform float uMaxR; uniform float uSpin;
out vec2 vUv; out float vFade;
void main() {
  vec2 v = aPos - uO; float r0 = length(v); float a0 = atan(v.y, v.x);
  float dn = clamp(r0 / uMaxR, 0.0, 1.0);
  float start = 0.08 + 0.36 * dn;
  float u = clamp((uT - start) / 0.46, 0.0, 1.0);
  float f = u * u * (1.5 - 0.5 * u);
  float r = r0 * (1.0 - f);
  float a = a0 + uSpin * -log(max(1.0 - f, 0.015)) * 0.55;
  vec2 p = uO + vec2(cos(a), sin(a)) * r;
  vUv = aPos / uRes;
  vFade = 1.0 - smoothstep(0.72, 0.98, f);
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const MESH_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex; in vec2 vUv; in float vFade; out vec4 color;
void main() { color = texture(uTex, vUv) * vFade; }`;
const CORE_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec2 uO; uniform float uCore; uniform float uWave; uniform float uWaveAlpha; uniform float uDark; uniform float uPx; uniform vec3 uAccent;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float r = length(p - uO);
  float halo = uCore > 0.0 ? exp(-max(r - uCore, 0.0) / (uCore * 1.6)) * 0.22 * (1.0 - uDark * 0.4) : 0.0;
  float ring = uCore > 0.0 ? exp(-pow((r - uCore * 1.18) / (0.8 * uPx), 2.0)) * mix(0.5, 0.65, uDark) : 0.0;
  float core = uCore > 0.0 ? 1.0 - smoothstep(uCore - 1.2 * uPx, uCore + 0.4 * uPx, r) : 0.0;
  float wave = uWaveAlpha * exp(-pow((r - uWave) / (2.5 * uPx), 2.0));
  vec4 c = vec4(0.0);
  c = vec4(0.0, 0.0, 0.0, halo);
  // The photon ring and the closing shockwave wear the accent; the core and its halo stay ink.
  c = vec4(uAccent * ring, ring) + c * (1.0 - ring);
  c = vec4(uAccent * wave * 0.6, wave * 0.6) + c * (1.0 - wave * 0.6);
  c = vec4(vec3(0.0), core) + c * (1.0 - core);
  color = c;
}`;

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ramp = (value: number, from: number, to: number) => clamp((value - from) / (to - from));
const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

function isPaint(color: string | null | undefined) {
  return !!color && color !== "transparent" && !/rgba?\(.*,\s*0\)$/.test(color) && !/\/\s*0\)$/.test(color);
}

async function rasterizeSvgs(root: Element) {
  const images = new Map<Element, HTMLImageElement>();
  await Promise.all(
    [...root.querySelectorAll("svg")].map(async svg => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const copy = svg.cloneNode(true) as SVGSVGElement;
      copy.setAttribute("width", String(rect.width));
      copy.setAttribute("height", String(rect.height));
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const markup = new XMLSerializer().serializeToString(copy).replace(/currentColor/g, getComputedStyle(svg).color);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      try {
        await image.decode();
        images.set(svg, image);
      } catch { /* An icon that will not decode is left out of the snapshot. */ }
    }),
  );
  return images;
}

interface Program { p: WebGLProgram; u: (name: string) => WebGLUniformLocation | null }

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type) as WebGLShader;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) ?? "link failed");
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return {
    p: program,
    u: name => {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name) ?? null;
    },
  };
}

function createTexture(gl: WebGL2RenderingContext, source: TexImageSource) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

interface PaintOptions { skip?: Set<Element>; only?: Set<Element> }

function paintNode(
  ctx: CanvasRenderingContext2D,
  node: Element,
  origin: DOMRect,
  dpr: number,
  options: PaintOptions,
  svgs: Map<Element, HTMLImageElement>,
  painting: boolean,
  forced: boolean,
) {
  if (options.skip?.has(node)) return;
  if (options.only?.has(node)) {
    painting = true;
    forced = true;
  }
  const css = getComputedStyle(node);
  if (css.display === "none") return;
  const opacity = parseFloat(css.opacity);
  if (!forced && opacity === 0) return;
  const visible = forced || css.visibility !== "hidden";
  const rect = node.getBoundingClientRect();
  const x = (rect.left - origin.left) * dpr;
  const y = (rect.top - origin.top) * dpr;
  const w = rect.width * dpr;
  const h = rect.height * dpr;
  ctx.save();
  if (painting && !forced) ctx.globalAlpha *= opacity;
  if (painting && visible && w > 0 && h > 0) {
    const radii = [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map(value => (parseFloat(value) || 0) * dpr);
    if (isPaint(css.backgroundColor)) {
      ctx.fillStyle = css.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radii);
      ctx.fill();
    }
    const widths = [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth].map(value => (parseFloat(value) || 0) * dpr);
    const colors = [css.borderTopColor, css.borderRightColor, css.borderBottomColor, css.borderLeftColor];
    if (widths.every(value => value > 0 && value === widths[0]) && colors.every(value => value === colors[0]) && isPaint(colors[0])) {
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = widths[0];
      ctx.beginPath();
      ctx.roundRect(x + widths[0] / 2, y + widths[0] / 2, w - widths[0], h - widths[0], radii.map(value => Math.max(0, value - widths[0] / 2)));
      ctx.stroke();
    } else {
      widths.forEach((width, side) => {
        if (!width || !isPaint(colors[side])) return;
        ctx.fillStyle = colors[side];
        if (side === 0) ctx.fillRect(x, y, w, width);
        if (side === 1) ctx.fillRect(x + w - width, y, width, h);
        if (side === 2) ctx.fillRect(x, y + h - width, w, width);
        if (side === 3) ctx.fillRect(x, y, width, h);
      });
    }
    if (node instanceof HTMLImageElement && node.complete && node.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radii);
      ctx.clip();
      const natural = node.naturalWidth / node.naturalHeight;
      const box = w / h;
      const cover = css.objectFit === "cover";
      let drawW = w;
      let drawH = h;
      if (cover) {
        if (natural > box) drawW = h * natural;
        else drawH = w / natural;
      }
      try {
        ctx.drawImage(node, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      } catch { /* A tainted or broken image is left blank. */ }
      ctx.restore();
    }
    const svg = svgs.get(node);
    if (svg) ctx.drawImage(svg, x, y, w, h);
    if (css.overflow !== "visible" && css.overflowX !== "visible") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radii);
      ctx.clip();
    }
  }
  if (node instanceof SVGElement || node instanceof HTMLImageElement || node instanceof HTMLCanvasElement) {
    ctx.restore();
    return;
  }
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!painting || !visible) continue;
      const text = child.textContent ?? "";
      if (!text.trim()) continue;
      ctx.font = `${css.fontStyle} ${css.fontWeight} ${parseFloat(css.fontSize) * dpr}px ${css.fontFamily}`;
      ctx.fillStyle = css.color;
      if ("letterSpacing" in ctx) ctx.letterSpacing = css.letterSpacing === "normal" ? "0px" : `${parseFloat(css.letterSpacing) * dpr}px`;
      ctx.textBaseline = "alphabetic";
      const metrics = ctx.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(css.fontSize) * dpr * 0.8;
      const descent = metrics.fontBoundingBoxDescent ?? parseFloat(css.fontSize) * dpr * 0.2;
      const range = document.createRange();
      for (const word of text.matchAll(/\S+/g)) {
        range.setStart(child, word.index ?? 0);
        range.setEnd(child, (word.index ?? 0) + word[0].length);
        const box = range.getBoundingClientRect();
        if (!box.width) continue;
        const left = (box.left - origin.left) * dpr;
        const top = (box.top - origin.top) * dpr;
        const height = box.height * dpr;
        ctx.fillText(word[0], left, top + (height - ascent - descent) / 2 + ascent);
      }
    } else if (child instanceof Element) paintNode(ctx, child, origin, dpr, options, svgs, painting, forced);
  }
  ctx.restore();
}

function resolveColor(value: string, fallback: [number, number, number]): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx || !value) return fallback;
  ctx.fillStyle = "#000";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function createGrid(gl: WebGL2RenderingContext, width: number, height: number, cell: number) {
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const data = new Float32Array(cols * rows * 12);
  let at = 0;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x0 = (col * width) / cols;
      const x1 = ((col + 1) * width) / cols;
      const y0 = (row * height) / rows;
      const y1 = ((row + 1) * height) / rows;
      data.set([x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1], at);
      at += 12;
    }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { buffer, count: cols * rows * 6 };
}

interface Gl { gl: WebGL2RenderingContext; lens: Program; mesh: Program; core: Program; quad: WebGLBuffer | null }
type RunOptions = BlackHoleOptions;

/* Body of the live `C` callback: (elements, direction, options) with root/content/canvas elements, reducedRef and getGl. */
async function runHole(
  root: HTMLElement,
  content: HTMLElement,
  canvas: HTMLCanvasElement,
  reducedRef: { current: boolean },
  getGl: () => Gl | null,
  elements: HTMLElement[],
  direction: number,
  options: RunOptions = {},
) {
  const targets = elements.filter(element => element.isConnected);
  if (!targets.length) return;
  if (direction < 0) {
    targets.forEach(element => {
      element.style.visibility = "hidden";
    });
    let previous = "";
    let stable = 0;
    const began = performance.now();
    const deadline = began + 1200;
    while ((stable < 6 || performance.now() - began < 160) && performance.now() < deadline) {
      await nextFrame();
      const key = [root, ...targets]
        .map(element => {
          const rect = element.getBoundingClientRect();
          return `${rect.left.toFixed(1)},${rect.top.toFixed(1)},${rect.width.toFixed(1)},${rect.height.toFixed(1)}`;
        })
        .join("|");
      stable = key === previous ? stable + 1 : 0;
      previous = key;
    }
  }
  const fade = (element: HTMLElement, from: number, to: number) => {
    const ease = from > to ? motionTokens.ease.exit : motionTokens.ease.enter;
    const duration = reducedRef.current ? 0 : (from > to ? motionTokens.duration.exit : motionTokens.duration.standard) * 1000;
    return element.animate([{ opacity: from }, { opacity: to }], { duration, easing: `cubic-bezier(${ease.join(",")})` }).finished;
  };
  const shared = reducedRef.current ? null : getGl();
  const gl = shared?.gl ?? null;
  if (!shared || !gl) {
    if (direction > 0) {
      await Promise.all(targets.map(element => fade(element, 1, 0)));
      targets.forEach(element => {
        element.style.visibility = "hidden";
      });
    } else {
      targets.forEach(element => {
        element.style.visibility = "";
      });
      await Promise.all(targets.map(element => fade(element, 0, 1)));
    }
    return;
  }
  const bounds = root.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  canvas.width = width;
  canvas.height = height;
  const chosen = new Set<Element>(targets);
  const svgs = await rasterizeSvgs(content);
  const snapshot = (paint: PaintOptions, painting: boolean) => {
    const layer = document.createElement("canvas");
    layer.width = width;
    layer.height = height;
    paintNode(layer.getContext("2d") as CanvasRenderingContext2D, content, bounds, dpr, paint, svgs, painting, false);
    return layer;
  };
  const restLayer = snapshot({ skip: chosen }, true);
  const chosenLayer = snapshot({ only: chosen }, false);
  const rects = targets.map(element => element.getBoundingClientRect());
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.right));
  const top = Math.min(...rects.map(rect => rect.top));
  const bottom = Math.max(...rects.map(rect => rect.bottom));
  const ox = ((options.origin?.x ?? (left + right) / 2) - bounds.left) * dpr;
  const oy = ((options.origin?.y ?? (top + bottom) / 2) - bounds.top) * dpr;
  const reach =
    Math.max(
      ...rects.flatMap(rect =>
        [[rect.left, rect.top], [rect.right, rect.top], [rect.left, rect.bottom], [rect.right, rect.bottom]].map(([px, py]) => Math.hypot((px - bounds.left) * dpr - ox, (py - bounds.top) * dpr - oy)),
      ),
    ) || 1;
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const accent = resolveColor(getComputedStyle(root).getPropertyValue("--accent").trim(), dark ? [1, 1, 1] : [0, 0, 0]);
  const grid = createGrid(gl, width, height, 5 * dpr);
  const scene = { ...shared, grid: grid.buffer, gridCount: grid.count, rest: createTexture(gl, restLayer), sel: createTexture(gl, chosenLayer) };
  const draw = (time: number) => {
    const g = scene.gl;
    g.viewport(0, 0, width, height);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    const open = ramp(time, 0, 0.16);
    const swell = 1 + 2.6 * Math.pow(open - 1, 3) + 1.6 * Math.pow(open - 1, 2);
    const shut = ramp(time, 0.84, 0.92);
    const close = shut * shut * shut;
    const core = 6.5 * dpr * (swell + 0.35 * ramp(time, 0.2, 0.8)) * (1 - close);
    const shock = ramp(time, 0.88, 1);
    g.useProgram(scene.lens.p);
    g.bindBuffer(g.ARRAY_BUFFER, scene.quad);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, scene.rest);
    g.uniform1i(scene.lens.u("uTex"), 0);
    g.uniform2f(scene.lens.u("uRes"), width, height);
    g.uniform2f(scene.lens.u("uO"), ox, oy);
    g.uniform1f(scene.lens.u("uLens"), 3.4 * core);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.useProgram(scene.mesh.p);
    g.bindBuffer(g.ARRAY_BUFFER, scene.grid);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.bindTexture(g.TEXTURE_2D, scene.sel);
    g.uniform1i(scene.mesh.u("uTex"), 0);
    g.uniform2f(scene.mesh.u("uRes"), width, height);
    g.uniform2f(scene.mesh.u("uO"), ox, oy);
    g.uniform1f(scene.mesh.u("uT"), time);
    g.uniform1f(scene.mesh.u("uMaxR"), reach);
    g.uniform1f(scene.mesh.u("uSpin"), 1.6);
    g.drawArrays(g.TRIANGLES, 0, scene.gridCount);
    g.useProgram(scene.core.p);
    g.bindBuffer(g.ARRAY_BUFFER, scene.quad);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.uniform2f(scene.core.u("uRes"), width, height);
    g.uniform2f(scene.core.u("uO"), ox, oy);
    g.uniform1f(scene.core.u("uCore"), core);
    g.uniform1f(scene.core.u("uWave"), 90 * (1 - Math.pow(1 - shock, 3)) * dpr);
    g.uniform1f(scene.core.u("uWaveAlpha"), shock > 0 ? (1 - shock) * (1 - shock) : 0);
    g.uniform1f(scene.core.u("uDark"), +!!dark);
    g.uniform1f(scene.core.u("uPx"), dpr);
    g.uniform3f(scene.core.u("uAccent"), ...accent);
    g.drawArrays(g.TRIANGLES, 0, 3);
  };
  const total = (options.duration ?? 1.3) * (direction < 0 ? 0.92 : 1) * 1000;
  let time = direction > 0 ? 0 : 1;
  draw(time);
  canvas.style.visibility = "visible";
  content.style.visibility = "hidden";
  const start = await nextFrame();
  while (direction > 0 ? time < 1 : time > 0) {
    const progress = clamp(((await nextFrame()) - start) / total);
    time = direction > 0 ? progress : 1 - progress;
    draw(time);
  }
  targets.forEach(element => {
    element.style.visibility = direction > 0 ? "hidden" : "";
  });
  content.style.visibility = "";
  canvas.style.visibility = "hidden";
  const g = scene.gl;
  g.deleteTexture(scene.rest);
  g.deleteTexture(scene.sel);
  g.deleteBuffer(scene.grid);
  g.clearColor(0, 0, 0, 0);
  g.clear(g.COLOR_BUFFER_BIT);
}

export const BlackHole = forwardRef<BlackHoleHandle, BlackHoleProps>(function BlackHole({ children, className, style }, ref) {
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  });
  const glRef = useRef<Gl | null | undefined>(undefined);
  const getGl = useCallback(() => {
    if (glRef.current !== undefined) return glRef.current;
    const canvas = canvasRef.current;
    try {
      const gl = canvas?.getContext("webgl2", { premultipliedAlpha: true, antialias: true }) ?? null;
      if (!gl) {
        glRef.current = null;
        return null;
      }
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      glRef.current = { gl, lens: createProgram(gl, LENS_VERT, LENS_FRAG), mesh: createProgram(gl, MESH_VERT, MESH_FRAG), core: createProgram(gl, LENS_VERT, CORE_FRAG), quad };
    } catch {
      glRef.current = null;
    }
    return glRef.current;
  }, []);

  useEffect(() => {
    if (reduced) return;
    const request = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = request(() => getGl());
    return () => cancel(id);
  }, [getGl, reduced]);

  const run = useCallback(
    async (elements: HTMLElement[], direction: number, options: BlackHoleOptions = {}) => {
      const root = rootRef.current;
      const content = contentRef.current;
      const canvas = canvasRef.current;
      if (!root || !content || !canvas) return;
      await runHole(root, content, canvas, reducedRef, getGl, elements, direction, options);
    },
    [getGl],
  );

  const enqueue = useCallback(
    (targets: Element[], direction: number, options?: BlackHoleOptions) => {
      const elements = targets as HTMLElement[];
      if (direction < 0)
        elements.forEach(element => {
          element.style.visibility = "hidden";
        });
      const next = queue.current
        .then(() => run(elements, direction, options))
        .catch(() => {
          elements.forEach(element => {
            element.style.visibility = direction > 0 ? "hidden" : "";
          });
          if (contentRef.current) contentRef.current.style.visibility = "";
        });
      queue.current = next;
      return next;
    },
    [run],
  );

  useImperativeHandle(ref, () => ({ swallow: (targets, options) => enqueue(targets, 1, options), release: (targets, options) => enqueue(targets, -1, options) }), [enqueue]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <div ref={contentRef} className={styles.content}>{children}</div>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    </div>
  );
});

export default BlackHole;
