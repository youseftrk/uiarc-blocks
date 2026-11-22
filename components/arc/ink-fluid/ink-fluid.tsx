"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ink-fluid.module.css";

export interface InkFluidProps {
  children?: ReactNode;
  intensity?: number;
  tint?: number;
  force?: number;
  ambient?: boolean;
  interactive?: boolean;
  quality?: "low" | "medium" | "high";
  className?: string;
  style?: CSSProperties;
}

const GRID = { low: 96, medium: 128, high: 192 }, INK = { low: 384, medium: 512, high: 768 };
const VERTEX = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const head = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;`;
const SHADERS = {
  // Semi Lagrangian advection with a per-second fade. Ink also hands its tinted share to the neutral share.
  advect: `${head} uniform sampler2D v, q; uniform vec2 texel; uniform float dt, fade, shift;
    void main(){ vec2 c = uv - dt * texture(v, uv).xy * texel; vec4 s = texture(q, c) * fade; float move = s.g * shift; o = vec4(s.r + move, s.g - move, s.b, 1.); }`,
  splat: `${head} uniform sampler2D q; uniform vec2 at, ratio; uniform vec3 value; uniform float radius;
    void main(){ vec2 d = (uv - at) * ratio; o = vec4(texture(q, uv).xyz + value * exp(-dot(d, d) / radius), 1.); }`,
  curl: `${head} uniform sampler2D v; uniform vec2 texel;
    void main(){ float l = texture(v, uv - vec2(texel.x, 0.)).y, r = texture(v, uv + vec2(texel.x, 0.)).y, b = texture(v, uv - vec2(0., texel.y)).x, t = texture(v, uv + vec2(0., texel.y)).x; o = vec4(.5 * (r - l - t + b), 0., 0., 1.); }`,
  vorticity: `${head} uniform sampler2D v, c; uniform vec2 texel; uniform float dt, amount;
    void main(){ float l = texture(c, uv - vec2(texel.x, 0.)).x, r = texture(c, uv + vec2(texel.x, 0.)).x, b = texture(c, uv - vec2(0., texel.y)).x, t = texture(c, uv + vec2(0., texel.y)).x, m = texture(c, uv).x;
      vec2 f = .5 * vec2(abs(t) - abs(b), abs(r) - abs(l)); f = f / (length(f) + 1e-4) * amount * m * vec2(1., -1.); o = vec4(texture(v, uv).xy + f * dt, 0., 1.); }`,
  divergence: `${head} uniform sampler2D v; uniform vec2 texel;
    void main(){ vec2 c = texture(v, uv).xy; vec2 lu = uv - vec2(texel.x, 0.), ru = uv + vec2(texel.x, 0.), bu = uv - vec2(0., texel.y), tu = uv + vec2(0., texel.y);
      float l = lu.x < 0. ? -c.x : texture(v, lu).x, r = ru.x > 1. ? -c.x : texture(v, ru).x, b = bu.y < 0. ? -c.y : texture(v, bu).y, t = tu.y > 1. ? -c.y : texture(v, tu).y; o = vec4(.5 * (r - l + t - b), 0., 0., 1.); }`,
  pressure: `${head} uniform sampler2D p, d; uniform vec2 texel;
    void main(){ float l = texture(p, uv - vec2(texel.x, 0.)).x, r = texture(p, uv + vec2(texel.x, 0.)).x, b = texture(p, uv - vec2(0., texel.y)).x, t = texture(p, uv + vec2(0., texel.y)).x; o = vec4((l + r + b + t - texture(d, uv).x) * .25, 0., 0., 1.); }`,
  project: `${head} uniform sampler2D p, v; uniform vec2 texel;
    void main(){ float l = texture(p, uv - vec2(texel.x, 0.)).x, r = texture(p, uv + vec2(texel.x, 0.)).x, b = texture(p, uv - vec2(0., texel.y)).x, t = texture(p, uv + vec2(0., texel.y)).x; o = vec4(texture(v, uv).xy - .5 * vec2(r - l, t - b), 0., 1.); }`,
  // Ink over transparent pixels, with a soft light term from the ink gradient so wisps read silky.
  display: `${head} uniform sampler2D q; uniform vec2 texel; uniform vec3 ink, accent; uniform float strength, dark;
    void main(){ vec2 s = texture(q, uv).rg; float total = s.r + s.g; float l = dot(texture(q, uv - vec2(texel.x, 0.)).rg, vec2(1.)), r = dot(texture(q, uv + vec2(texel.x, 0.)).rg, vec2(1.)), b = dot(texture(q, uv - vec2(0., texel.y)).rg, vec2(1.)), t = dot(texture(q, uv + vec2(0., texel.y)).rg, vec2(1.));
      float light = clamp(((r - l) + (t - b)) * 1.6, -1., 1.); float a = 1. - exp(-total * 1.35); a = clamp(a * strength * (1. + .3 * light * (dark > .5 ? 1. : -1.)), 0., .3);
      vec3 colour = mix(ink, accent, total > 1e-4 ? clamp(s.g / total, 0., 1.) : 0.); o = vec4(colour * a, a); }`,
};

type Target = { texture: WebGLTexture; buffer: WebGLFramebuffer; width: number; height: number };
type Pair = { read: Target; write: Target; swap(): void };

function parseColour(value: string, context: CanvasRenderingContext2D | null): [number, number, number] {
  if (!context) return [0.1, 0.1, 0.1];
  context.clearRect(0, 0, 1, 1); context.fillStyle = "#000"; context.fillStyle = value; context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

export function InkFluid({ children, intensity = 0.5, tint = 0.8, force = 0.5, ambient = true, interactive = true, quality = "medium", className, style }: InkFluidProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current, probe = probeRef.current;
    if (!root || !canvas || !probe) return;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    // Without WebGL2 or float targets the root keeps its plain background.
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;
    const linear = !!gl.getExtension("OES_texture_float_linear");
    const half = !linear;
    const scratch = document.createElement("canvas"); scratch.width = scratch.height = 1;
    const scratchContext = scratch.getContext("2d", { willReadFrequently: true });

    const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const programs = {} as Record<keyof typeof SHADERS, { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }>;
    for (const name of Object.keys(SHADERS) as (keyof typeof SHADERS)[]) {
      const program = gl.createProgram()!;
      gl.attachShader(program, vertex); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SHADERS[name])); gl.bindAttribLocation(program, 0, "p"); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      for (let i = 0, count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number; i < count; i++) { const info = gl.getActiveUniform(program, i); if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name); }
      programs[name] = { program, uniforms };
    }
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const owned: Target[] = [];
    const target = (width: number, height: number): Target => {
      const texture = gl.createTexture()!, buffer = gl.createFramebuffer()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA32F, width, height, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      const made = { texture, buffer, width, height };
      owned.push(made);
      return made;
    };
    const pair = (width: number, height: number): Pair => { const made = { read: target(width, height), write: target(width, height), swap() { const keep = made.read; made.read = made.write; made.write = keep; } }; return made; };
    const release = () => { owned.forEach(item => { gl.deleteTexture(item.texture); gl.deleteFramebuffer(item.buffer); }); owned.length = 0; };

    let velocity: Pair, ink: Pair, pressure: Pair, curl: Target, divergence: Target, width = 0, height = 0, ready = false;
    const build = () => {
      const box = root.getBoundingClientRect();
      width = Math.max(1, Math.round(box.width)); height = Math.max(1, Math.round(box.height));
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      const short = Math.min(width, height), sized = (cells: number): [number, number] => [Math.max(2, Math.round((cells * width) / short)), Math.max(2, Math.round((cells * height) / short))];
      release();
      const [gw, gh] = sized(GRID[quality]), [iw, ih] = sized(INK[quality]);
      velocity = pair(gw, gh); pressure = pair(gw, gh); curl = target(gw, gh); divergence = target(gw, gh); ink = pair(iw, ih);
      ready = true;
    };

    const pick = (name: keyof typeof SHADERS) => { const entry = programs[name]; gl.useProgram(entry.program); return entry.uniforms; };
    const bind = (location: WebGLUniformLocation | null, unit: number, source: Target) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, source.texture); gl.uniform1i(location, unit); };
    const blit = (to: Target | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.buffer : null);
      gl.viewport(0, 0, to ? to.width : canvas.width, to ? to.height : canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const splat = (field: Pair, x: number, y: number, value: [number, number, number], radius: number) => {
      const u = pick("splat");
      bind(u.q, 0, field.read); gl.uniform2f(u.at, x, y); gl.uniform2f(u.ratio, Math.max(1, width / height), Math.max(1, height / width)); gl.uniform3f(u.value, value[0], value[1], value[2]); gl.uniform1f(u.radius, radius);
      blit(field.write); field.swap();
    };
    /** Pointer travel in px per second becomes force and ink: slow moves leave faint trails, quick flicks bloom. */
    const stir = (x: number, y: number, dx: number, dy: number, scale = 1) => {
      const speed = Math.hypot(dx, dy), push = (0.35 + force * 1.3) * scale, cellsPerPixel = velocity.read.width / width;
      splat(velocity, x, y, [dx * cellsPerPixel * push, dy * cellsPerPixel * push, 0], 0.0022);
      const amount = Math.min(1.1, speed / 1500) * (0.5 + intensity) * scale * 0.3;
      splat(ink, x, y, [amount * (1 - tint), amount * tint, 0], 0.0016);
    };

    const step = (dt: number) => {
      const texel: [number, number] = [1 / velocity.read.width, 1 / velocity.read.height];
      let u = pick("curl"); bind(u.v, 0, velocity.read); gl.uniform2f(u.texel, ...texel); blit(curl);
      u = pick("vorticity"); bind(u.v, 0, velocity.read); bind(u.c, 1, curl); gl.uniform2f(u.texel, ...texel); gl.uniform1f(u.dt, dt); gl.uniform1f(u.amount, 18); blit(velocity.write); velocity.swap();
      u = pick("divergence"); bind(u.v, 0, velocity.read); gl.uniform2f(u.texel, ...texel); blit(divergence);
      u = pick("pressure"); gl.uniform2f(u.texel, ...texel);
      for (let i = 0; i < 20; i++) { bind(u.p, 0, pressure.read); bind(u.d, 1, divergence); blit(pressure.write); pressure.swap(); }
      u = pick("project"); bind(u.p, 0, pressure.read); bind(u.v, 1, velocity.read); gl.uniform2f(u.texel, ...texel); blit(velocity.write); velocity.swap();
      u = pick("advect"); bind(u.v, 0, velocity.read); bind(u.q, 1, velocity.read); gl.uniform2f(u.texel, ...texel); gl.uniform1f(u.dt, dt); gl.uniform1f(u.fade, Math.exp(-dt * 0.35)); gl.uniform1f(u.shift, 0); blit(velocity.write); velocity.swap();
      // Ink fades over a couple of seconds, and tinted ink turns neutral as it spreads.
      bind(u.v, 0, velocity.read); bind(u.q, 1, ink.read); gl.uniform1f(u.fade, Math.exp(-dt * 0.55)); gl.uniform1f(u.shift, 1 - Math.exp(-dt * 0.9)); blit(ink.write); ink.swap();
    };
    let inkColour: [number, number, number] = [0.1, 0.1, 0.1], accentColour: [number, number, number] = [0.3, 0.4, 0.9], dark = 0;
    const readColours = () => {
      const computed = getComputedStyle(probe);
      inkColour = parseColour(computed.color, scratchContext); accentColour = parseColour(computed.backgroundColor, scratchContext);
      dark = Number(getComputedStyle(root).getPropertyValue("--ink-dark")) > 0.5 ? 1 : 0;
    };
    const render = () => {
      const u = pick("display");
      bind(u.q, 0, ink.read); gl.uniform2f(u.texel, 1 / ink.read.width, 1 / ink.read.height); gl.uniform3f(u.ink, ...inkColour); gl.uniform3f(u.accent, ...accentColour);
      gl.uniform1f(u.strength, 0.1 + intensity * 0.5); gl.uniform1f(u.dark, dark);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      blit(null);
    };

    let raf = 0, visible = true, alive = true, previous = 0, clock = 0, movedAt = -Infinity;
    /** The slow stir that keeps the ink alive when nobody interacts. */
    const drift = (dt: number) => {
      clock += dt;
      const x = 0.5 + 0.3 * Math.sin(clock * 0.37) + 0.08 * Math.sin(clock * 1.13), y = 0.5 + 0.24 * Math.cos(clock * 0.29) + 0.06 * Math.sin(clock * 0.83);
      const dx = (0.3 * 0.37 * Math.cos(clock * 0.37) + 0.08 * 1.13 * Math.cos(clock * 1.13)) * width, dy = (-0.24 * 0.29 * Math.sin(clock * 0.29) + 0.06 * 0.83 * Math.cos(clock * 0.83)) * height;
      stir(x, y, dx * 9, dy * 9, dt * 14);
    };
    const frame = (now: number) => {
      raf = 0;
      if (!alive || !visible || document.hidden || !ready) return;
      const dt = Math.min(0.033, previous ? (now - previous) / 1000 : 0.016);
      previous = now;
      if (ambient && now - movedAt > 1200) drift(dt);
      step(dt); render();
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && alive && !reduced) { previous = 0; raf = requestAnimationFrame(frame); } };
    /** Reduced motion: one composed still frame, then stop. */
    const still = () => {
      if (!ready) return;
      const strokes: [number, number, number, number][] = [[0.24, 0.66, 900, 260], [0.42, 0.42, 700, -420], [0.66, 0.6, 820, 300], [0.8, 0.34, -500, 380]];
      for (const [x, y, dx, dy] of strokes) stir(x, y, dx, dy, 1.4);
      for (let i = 0; i < 70; i++) step(0.016);
      render();
    };

    build(); readColours();
    if (reduced) still(); else kick();

    let last: { x: number; y: number; t: number } | null = null, down = false;
    const onMove = (event: PointerEvent) => {
      if (!interactive || reduced || !ready) return;
      if (event.pointerType === "touch" && !down) return;
      const box = root.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top, time = event.timeStamp;
      if (last && time > last.t) {
        const dt = Math.max(0.008, (time - last.t) / 1000);
        stir(x / box.width, 1 - y / box.height, (x - last.x) / dt, -(y - last.y) / dt, Math.min(1, dt * 60));
      }
      last = { x, y, t: time }; movedAt = performance.now();
    };
    const onDown = (event: PointerEvent) => { if (event.pointerType === "touch") { down = true; last = null; } };
    const onUp = () => { down = false; last = null; };
    const onLeave = () => { last = null; };
    root.addEventListener("pointermove", onMove); root.addEventListener("pointerdown", onDown); root.addEventListener("pointerup", onUp); root.addEventListener("pointercancel", onUp); root.addEventListener("pointerleave", onLeave);

    let timer = 0;
    const sizes = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(() => { const box = root.getBoundingClientRect(); if (Math.round(box.width) === width && Math.round(box.height) === height) return; build(); if (reduced) still(); else kick(); }, 120); });
    sizes.observe(root);
    const seen = new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; if (visible) kick(); });
    seen.observe(root);
    const theme = new MutationObserver(() => { readColours(); if (reduced && ready) render(); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class", "style"] });
    const onVisibility = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false; cancelAnimationFrame(raf); clearTimeout(timer); sizes.disconnect(); seen.disconnect(); theme.disconnect(); document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerdown", onDown); root.removeEventListener("pointerup", onUp); root.removeEventListener("pointercancel", onUp); root.removeEventListener("pointerleave", onLeave);
      release(); gl.deleteBuffer(quad); Object.values(programs).forEach(entry => gl.deleteProgram(entry.program));
    };
  }, [ambient, force, intensity, interactive, quality, reduced, tint]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <span ref={probeRef} aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, visibility: "hidden", color: "var(--ink-color)", backgroundColor: "var(--ink-accent)" }} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export default InkFluid;
