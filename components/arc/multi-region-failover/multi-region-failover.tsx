"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import styles from "./multi-region-failover.module.css";

export type FailoverNodeKey = "users" | "balancer" | "primary" | "secondary";

export interface FailoverNodeConfig {
  label?: string;
  meta?: string;
  detail?: string;
  icon?: string | ReactNode;
  color?: string;
}

export interface MultiRegionFailoverProps {
  hostname?: string;
  requestsPerSecond?: number;
  latencyMs?: number;
  nodes?: Partial<Record<FailoverNodeKey, FailoverNodeConfig>>;
  speed?: number;
  paused?: boolean;
  accent?: string;
  controls?: boolean;
  caption?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const CYCLE_S = 21;
const PACKET_POOL = 15;

interface StageDef {
  id: string;
  title: string;
  start: number;
  end: number;
  settled: number;
  caption: (primary: string, secondary: string) => string;
}

const STAGES: StageDef[] = [
  {
    id: "balanced",
    title: "Balanced",
    start: 0,
    end: 3.0,
    settled: 1.5,
    caption: (p, s) =>
      `Traffic splits evenly between ${p} and ${s}. Both regions are healthy and serving low-latency responses.`,
  },
  {
    id: "degrades",
    title: "Region degrades",
    start: 3.0,
    end: 7.0,
    settled: 5.4,
    caption: (p) =>
      `Instances in ${p} start failing. Requests there return errors while three consecutive health checks fail.`,
  },
  {
    id: "shifts",
    title: "Traffic shifts",
    start: 7.0,
    end: 10.5,
    settled: 8.8,
    caption: (p, s) =>
      `After three failed checks, ${p} is taken out of rotation and the balancer shifts all traffic to ${s}.`,
  },
  {
    id: "backup",
    title: "Running on backup",
    start: 10.5,
    end: 13.8,
    settled: 12.1,
    caption: (p, s) =>
      `${s} carries 100% of requests with zero errors while instances in ${p} recover.`,
  },
  {
    id: "recovery",
    title: "Health checks pass",
    start: 13.8,
    end: 17.5,
    settled: 15.8,
    caption: (p) =>
      `${p} is back online and must pass three consecutive health checks before receiving live traffic again.`,
  },
  {
    id: "rebalance",
    title: "Rebalancing",
    start: 17.5,
    end: 21.0,
    settled: 19.3,
    caption: (p, s) =>
      `Traffic ramps smoothly back into ${p} until ${p} and ${s} return to an even 50/50 split.`,
  },
];

interface Vec2 {
  x: number;
  y: number;
}

interface LayoutGeom {
  vbW: number;
  vbH: number;
  users: Vec2;
  balancer: Vec2;
  primary: Vec2;
  secondary: Vec2;
  uToB: [Vec2, Vec2, Vec2];
  bToP: [Vec2, Vec2, Vec2];
  bToS: [Vec2, Vec2, Vec2];
  primaryCubes: Vec2[];
  secondaryCubes: Vec2[];
  labelPos: Record<FailoverNodeKey, { left: number; top: number; above?: boolean }>;
  tagPos: Record<FailoverNodeKey, { left: number; top: number; below?: boolean; align?: "start" | "end" }>;
}

function makeCubeOffsets(cx: number, cy: number, scale: number): Vec2[] {
  // 2x3 isometric grid of 6 instances on a region platform
  const cols = [-1, 0, 1];
  const rows = [-0.55, 0.55];
  const out: Vec2[] = [];
  for (const r of rows) {
    for (const c of cols) {
      const ix = (c - r) * 24 * scale;
      const iy = (c + r) * 12 * scale - 10 * scale;
      out.push({ x: cx + ix, y: cy + iy });
    }
  }
  return out;
}

const LANDSCAPE: LayoutGeom = {
  vbW: 1000,
  vbH: 600,
  users: { x: 145, y: 285 },
  balancer: { x: 455, y: 285 },
  primary: { x: 800, y: 170 },
  secondary: { x: 800, y: 415 },
  uToB: [
    { x: 145, y: 270 },
    { x: 300, y: 205 },
    { x: 455, y: 270 },
  ],
  bToP: [
    { x: 455, y: 270 },
    { x: 615, y: 120 },
    { x: 800, y: 158 },
  ],
  bToS: [
    { x: 455, y: 270 },
    { x: 615, y: 465 },
    { x: 800, y: 403 },
  ],
  primaryCubes: makeCubeOffsets(800, 170, 1.0),
  secondaryCubes: makeCubeOffsets(800, 415, 1.0),
  labelPos: {
    users: { left: 14.5, top: 58 },
    balancer: { left: 45.5, top: 61 },
    primary: { left: 80, top: 38.5 },
    secondary: { left: 80, top: 79.5 },
  },
  tagPos: {
    users: { left: 14.5, top: 39, align: "start" },
    balancer: { left: 45.5, top: 37 },
    primary: { left: 80, top: 15, align: "end" },
    secondary: { left: 80, top: 56, align: "end" },
  },
};

const PORTRAIT: LayoutGeom = {
  vbW: 390,
  vbH: 750,
  users: { x: 195, y: 150 },
  balancer: { x: 195, y: 330 },
  primary: { x: 100, y: 580 },
  secondary: { x: 290, y: 580 },
  uToB: [
    { x: 195, y: 150 },
    { x: 103, y: 234 },
    { x: 195, y: 318 },
  ],
  bToP: [
    { x: 195, y: 318 },
    { x: 24, y: 439 },
    { x: 100, y: 568 },
  ],
  bToS: [
    { x: 195, y: 318 },
    { x: 366, y: 439 },
    { x: 290, y: 568 },
  ],
  primaryCubes: makeCubeOffsets(100, 580, 0.78),
  secondaryCubes: makeCubeOffsets(290, 580, 0.78),
  labelPos: {
    users: { left: 50, top: 14, above: true },
    balancer: { left: 50, top: 52 },
    primary: { left: 25.6, top: 86 },
    secondary: { left: 74.4, top: 86 },
  },
  tagPos: {
    users: { left: 50, top: 15 },
    balancer: { left: 50, top: 38 },
    primary: { left: 25.6, top: 70, align: "start" },
    secondary: { left: 74.4, top: 70, align: "end" },
  },
};

function isoPlatform(cx: number, cy: number, rx: number, ry: number, h: number) {
  const top = `${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`;
  const left = `${cx - rx},${cy} ${cx},${cy + ry} ${cx},${cy + ry + h} ${cx - rx},${cy + h}`;
  const right = `${cx},${cy + ry} ${cx + rx},${cy} ${cx + rx},${cy + h} ${cx},${cy + ry + h}`;
  const hit = `${cx},${cy - ry} ${cx + rx},${cy} ${cx + rx},${cy + h} ${cx},${cy + ry + h} ${cx - rx},${cy + h} ${cx - rx},${cy}`;
  return { top, left, right, hit };
}

function quadAt(pts: [Vec2, Vec2, Vec2], t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: mt * mt * pts[0].x + 2 * mt * t * pts[1].x + t * t * pts[2].x,
    y: mt * mt * pts[0].y + 2 * mt * t * pts[1].y + t * t * pts[2].y,
  };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function formatRps(rps: number): string {
  if (rps >= 1000) return `${(rps / 1000).toFixed(1)}k req/s`;
  return `${Math.round(rps)} req/s`;
}

function renderMark(icon?: string | ReactNode) {
  if (!icon) return null;
  if (typeof icon === "string") {
    if (icon.startsWith("http") || icon.startsWith("/")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.mark} src={icon} alt="" aria-hidden="true" />
      );
    }
    return (
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d={icon} />
        </svg>
      </span>
    );
  }
  return (
    <span className={styles.mark} aria-hidden="true">
      {icon}
    </span>
  );
}

interface SimSnapshot {
  stageIdx: number;
  weightA: number;
  weightB: number;
  primaryDownCount: number;
  errorRate: number;
  primaryErrorRate: number;
  primaryStatus: { text: string; state: "done" | "warn" | "error" | "busy" };
  secondaryStatus: { text: string; state: "done" | "warn" | "error" | "busy" };
  balancerStatus: { text: string; state: "done" | "warn" | "error" | "busy" };
  probeVisible: boolean;
  probeT: number;
  probeResult: "pending" | "pass" | "fail";
  probeText: string;
}

function evaluateCycle(time: number): SimSnapshot {
  const t = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  let stageIdx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (t >= STAGES[i].start && t < STAGES[i].end) {
      stageIdx = i;
      break;
    }
  }

  // Primary failing cubes count (0..6)
  let primaryDownCount = 0;
  if (t >= 3.0 && t < 11.2) {
    primaryDownCount = Math.min(6, Math.floor(((t - 3.0) / 2.4) * 6) + 1);
    if (t >= 5.6) primaryDownCount = 5;
  } else if (t >= 11.2 && t < 13.8) {
    const recovered = Math.floor(((t - 11.2) / 2.4) * 5) + 1;
    primaryDownCount = Math.max(0, 5 - recovered);
  }

  // Traffic weight to primary (0..0.5)
  let weightA = 0.5;
  if (t >= 7.0 && t < 10.2) {
    weightA = 0.5 * (1 - smoothstep(7.0, 10.0, t));
  } else if (t >= 10.2 && t < 17.5) {
    weightA = 0;
  } else if (t >= 17.5) {
    weightA = 0.5 * smoothstep(17.5, 20.6, t);
  }
  const weightB = 1 - weightA;

  const primaryErrorRate = primaryDownCount / 6;
  const errorRate = weightA * primaryErrorRate;

  // Health check probes during degrade (3.4..6.9) and recovery (14.0..17.4)
  let probeVisible = false;
  let probeT = 0;
  let probeResult: "pending" | "pass" | "fail" = "pending";
  let probeText = "GET /healthz";
  let failedChecks = 0;
  let passedChecks = 0;

  if (t >= 3.4 && t < 7.0) {
    const local = t - 3.4;
    const slot = Math.floor(local / 1.15);
    const phase = (local % 1.15) / 1.15;
    failedChecks = Math.min(3, slot + (phase > 0.65 ? 1 : 0));
    probeVisible = slot < 3;
    probeT = phase < 0.55 ? phase / 0.55 : 1 - (phase - 0.55) / 0.45;
    probeResult = phase > 0.55 ? "fail" : "pending";
    probeText = phase > 0.55 ? "503 fail" : "GET /healthz";
  } else if (t >= 14.0 && t < 17.5) {
    const local = t - 14.0;
    const slot = Math.floor(local / 1.12);
    const phase = (local % 1.12) / 1.12;
    passedChecks = Math.min(3, slot + (phase > 0.65 ? 1 : 0));
    probeVisible = slot < 3;
    probeT = phase < 0.55 ? phase / 0.55 : 1 - (phase - 0.55) / 0.45;
    probeResult = phase > 0.55 ? "pass" : "pending";
    probeText = phase > 0.55 ? "200 OK" : "GET /healthz";
  }

  let primaryStatus: SimSnapshot["primaryStatus"] = {
    text: "Healthy",
    state: "done",
  };
  if (t >= 3.0 && t < 7.0) {
    primaryStatus =
      failedChecks > 0
        ? { text: `Failed checks ${failedChecks}/3`, state: "error" }
        : { text: "Degraded", state: "error" };
  } else if (t >= 7.0 && t < 11.4) {
    primaryStatus = { text: "Out of rotation", state: "error" };
  } else if (t >= 11.4 && t < 14.0) {
    primaryStatus = { text: "Recovering", state: "warn" };
  } else if (t >= 14.0 && t < 17.5) {
    primaryStatus = {
      text: `Passed checks ${Math.max(1, passedChecks)}/3`,
      state: "busy",
    };
  } else if (t >= 17.5 && t < 20.5) {
    primaryStatus = {
      text: `Warming up ${Math.round((weightA / 0.5) * 100)}%`,
      state: "busy",
    };
  }

  const secondaryStatus: SimSnapshot["secondaryStatus"] =
    weightB > 0.85
      ? { text: "Taking all traffic", state: "done" }
      : { text: "Healthy", state: "done" };

  let balancerStatus: SimSnapshot["balancerStatus"] = {
    text: "All healthy",
    state: "done",
  };
  if (errorRate > 0.01) {
    balancerStatus = {
      text: `Errors ${(errorRate * 100).toFixed(1)}%`,
      state: "error",
    };
  } else if (t >= 7.0 && t < 10.5) {
    balancerStatus = { text: "Draining primary", state: "warn" };
  } else if (t >= 17.5 && t < 20.5) {
    balancerStatus = { text: "Ramping back", state: "busy" };
  }

  return {
    stageIdx,
    weightA,
    weightB,
    primaryDownCount,
    errorRate,
    primaryErrorRate,
    primaryStatus,
    secondaryStatus,
    balancerStatus,
    probeVisible,
    probeT,
    probeResult,
    probeText,
  };
}

export function MultiRegionFailover({
  hostname = "api.acme.dev",
  requestsPerSecond = 12000,
  latencyMs = 38,
  nodes,
  speed = 1,
  paused = false,
  accent,
  controls = true,
  caption = true,
  label,
  className,
  style,
}: MultiRegionFailoverProps) {
  const prefersReduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [isStack, setIsStack] = useState(false);
  const [ready, setReady] = useState(false);
  const [localPaused, setLocalPaused] = useState<boolean | null>(null);
  const userPaused = localPaused ?? paused;
  const [hoveredNode, setHoveredNode] = useState<FailoverNodeKey | null>(null);
  const [activeStage, setActiveStage] = useState(0);

  const nodeInfo = useMemo(() => {
    const u = nodes?.users ?? {};
    const b = nodes?.balancer ?? {};
    const p = nodes?.primary ?? {};
    const s = nodes?.secondary ?? {};
    return {
      users: {
        label: u.label ?? "Users",
        meta: u.meta ?? "Worldwide",
        detail: u.detail ?? "Every request goes to one hostname",
        icon: u.icon,
      },
      balancer: {
        label: b.label ?? "Load balancer",
        meta: b.meta ?? hostname,
        detail:
          b.detail ?? "Checks each region and sets its share of traffic",
        icon: b.icon,
      },
      primary: {
        label: p.label ?? "US East",
        meta: p.meta ?? "us-east-1",
        detail: p.detail ?? "Six instances in Virginia",
        icon: p.icon,
      },
      secondary: {
        label: s.label ?? "EU West",
        meta: s.meta ?? "eu-west-1",
        detail: s.detail ?? "Six instances in Ireland, ready to take it all",
        icon: s.icon,
      },
    };
  }, [nodes, hostname]);

  const ariaLabel =
    label ??
    `Multi-region failover for ${hostname}. A load balancer splits traffic between ${nodeInfo.primary.label} and ${nodeInfo.secondary.label}. When ${nodeInfo.primary.label} starts failing, its health checks fail 3 times in a row, it is marked unhealthy and traffic shifts smoothly to ${nodeInfo.secondary.label}, so errors fall back to zero. Once ${nodeInfo.primary.label} recovers and passes 3 checks, traffic ramps back until the split is even again.`;

  // Refs for direct DOM writes inside RAF
  const clockRef = useRef(paused || prefersReduced ? STAGES[2].settled : 0);
  const rateRef = useRef(paused || prefersReduced ? 0 : speed);
  const inViewRef = useRef(true);
  const hoverRef = useRef<FailoverNodeKey | null>(null);
  const stageIdxRef = useRef(0);

  const dialARef = useRef<SVGPathElement>(null);
  const dialBRef = useRef<SVGPathElement>(null);
  const edgePRef = useRef<SVGPathElement>(null);
  const edgeSRef = useRef<SVGPathElement>(null);
  const probeDotRef = useRef<SVGCircleElement>(null);
  const probeChipRef = useRef<HTMLDivElement>(null);

  const primaryCubeRefs = useRef<Array<SVGGElement | null>>([]);
  const secondaryCubeRefs = useRef<Array<SVGGElement | null>>([]);
  const packetRefs = useRef<Array<SVGCircleElement | null>>([]);
  const shadowRefs = useRef<Array<SVGEllipseElement | null>>([]);
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const barARef = useRef<HTMLSpanElement>(null);
  const barBRef = useRef<HTMLSpanElement>(null);
  const pctARef = useRef<HTMLSpanElement>(null);
  const pctBRef = useRef<HTMLSpanElement>(null);
  const balStatusRef = useRef<HTMLSpanElement>(null);
  const balStatusTextRef = useRef<HTMLSpanElement>(null);
  const priStatusRef = useRef<HTMLSpanElement>(null);
  const priStatusTextRef = useRef<HTMLSpanElement>(null);
  const priMetricRef = useRef<HTMLSpanElement>(null);
  const secStatusRef = useRef<HTMLSpanElement>(null);
  const secStatusTextRef = useRef<HTMLSpanElement>(null);
  const secMetricRef = useRef<HTMLSpanElement>(null);

  const segBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    hoverRef.current = hoveredNode;
  }, [hoveredNode]);

  // Measure container width for landscape vs portrait layout
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      setIsStack(el.getBoundingClientRect().width < 640);
      setReady(true);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // IntersectionObserver pause
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const geom = isStack ? PORTRAIT : LANDSCAPE;

  // Main RAF loop
  useEffect(() => {
    let rafId = 0;
    let last = 0;

    const applyFrame = (t: number) => {
      const snap = evaluateCycle(t);

      if (snap.stageIdx !== stageIdxRef.current) {
        stageIdxRef.current = snap.stageIdx;
        setActiveStage(snap.stageIdx);
      }

      // Update dial & weight bars
      const aDash = (snap.weightA * 1000).toFixed(1);
      const bDash = (snap.weightB * 1000).toFixed(1);
      if (dialARef.current) {
        dialARef.current.setAttribute("stroke-dasharray", `${aDash} 1000`);
        dialARef.current.setAttribute("opacity", snap.weightA > 0.01 ? "1" : "0");
      }
      if (dialBRef.current) {
        dialBRef.current.setAttribute("stroke-dasharray", `${bDash} 1000`);
        dialBRef.current.setAttribute("stroke-dashoffset", `-${aDash}`);
      }
      if (barARef.current) {
        barARef.current.style.transform = `scaleX(${snap.weightA.toFixed(4)})`;
      }
      if (barBRef.current) {
        barBRef.current.style.transform = `scaleX(${snap.weightB.toFixed(4)})`;
      }
      if (pctARef.current) {
        pctARef.current.textContent = `${Math.round(snap.weightA * 100)}%`;
      }
      if (pctBRef.current) {
        pctBRef.current.textContent = `${Math.round(snap.weightB * 100)}%`;
      }

      // Routes styling
      if (edgePRef.current) {
        edgePRef.current.style.setProperty("--lit", snap.weightA > 0.02 ? "1" : "0");
        edgePRef.current.style.setProperty(
          "--err",
          (snap.primaryErrorRate * (snap.weightA > 0.02 ? 1 : 0.4)).toFixed(3)
        );
      }
      if (edgeSRef.current) {
        edgeSRef.current.style.setProperty("--lit", "1");
      }

      // Status chips & metrics
      if (balStatusRef.current && balStatusTextRef.current) {
        balStatusRef.current.dataset.state = snap.balancerStatus.state;
        balStatusTextRef.current.textContent = snap.balancerStatus.text;
      }
      if (priStatusRef.current && priStatusTextRef.current) {
        priStatusRef.current.dataset.state = snap.primaryStatus.state;
        priStatusTextRef.current.textContent = snap.primaryStatus.text;
      }
      if (secStatusRef.current && secStatusTextRef.current) {
        secStatusRef.current.dataset.state = snap.secondaryStatus.state;
        secStatusTextRef.current.textContent = snap.secondaryStatus.text;
      }

      const priRps = requestsPerSecond * snap.weightA;
      const secRps = requestsPerSecond * snap.weightB;
      const priErrPct = Math.round(snap.primaryErrorRate * 100);
      const secLat = Math.round(latencyMs + 4 + (snap.weightB - 0.5) * 24);

      if (priMetricRef.current) {
        priMetricRef.current.textContent =
          snap.weightA < 0.01
            ? "0 req/s · standby"
            : priErrPct > 0
            ? `${formatRps(priRps)} · ${priErrPct}% errors`
            : `${formatRps(priRps)} · p50 ${latencyMs} ms`;
      }
      if (secMetricRef.current) {
        secMetricRef.current.textContent = `${formatRps(secRps)} · p50 ${secLat} ms`;
      }

      // Region cubes
      for (let i = 0; i < 6; i++) {
        const pCube = primaryCubeRefs.current[i];
        if (pCube) {
          const isDown = i < snap.primaryDownCount;
          pCube.dataset.state = isDown ? "down" : "up";
          pCube.style.setProperty("--load", isDown ? "0" : snap.weightA.toFixed(2));
          pCube.style.setProperty(
            "--hit",
            !isDown && snap.weightA > 0.05
              ? (Math.max(0, Math.sin(t * 7 + i * 1.4)) * 0.55).toFixed(2)
              : "0"
          );
        }
        const sCube = secondaryCubeRefs.current[i];
        if (sCube) {
          sCube.dataset.state = "up";
          sCube.style.setProperty("--load", snap.weightB.toFixed(2));
          sCube.style.setProperty(
            "--hit",
            (Math.max(0, Math.sin(t * 7.5 + i * 1.7 + 1)) * (0.4 + snap.weightB * 0.4)).toFixed(2)
          );
        }
      }

      // Packets along paths
      for (let i = 0; i < PACKET_POOL; i++) {
        const pkt = packetRefs.current[i];
        const shd = shadowRefs.current[i];
        if (!pkt || !shd) continue;

        if (prefersReduced) {
          pkt.setAttribute("opacity", "0");
          shd.setAttribute("opacity", "0");
          continue;
        }

        // Deterministic staggered phase in [0, 1)
        const period = 1.6;
        const pPhase = ((t / period + i / PACKET_POOL) % 1 + 1) % 1;
        const isFirstLeg = i < 6;

        let pos: Vec2;
        let isError = false;
        let opacity = 1;

        if (isFirstLeg) {
          pos = quadAt(geom.uToB, pPhase);
        } else {
          // Route to primary or secondary based on current weightA
          const routeSlot = (i - 6) / (PACKET_POOL - 6);
          const toPrimary = routeSlot < snap.weightA;
          if (toPrimary) {
            pos = quadAt(geom.bToP, pPhase);
            if (snap.primaryDownCount > 0 && (i % 6) < snap.primaryDownCount) {
              isError = pPhase > 0.55;
              if (pPhase > 0.8) opacity = Math.max(0, 1 - (pPhase - 0.8) / 0.2);
            }
          } else {
            pos = quadAt(geom.bToS, pPhase);
          }
        }

        const arcLift = Math.sin(pPhase * Math.PI);
        pkt.setAttribute("cx", pos.x.toFixed(2));
        pkt.setAttribute("cy", pos.y.toFixed(2));
        pkt.setAttribute("opacity", opacity.toFixed(2));
        pkt.dataset.kind = isError ? "error" : "ok";

        const shScale = (0.55 + (1 - arcLift) * 0.35).toFixed(3);
        shd.setAttribute(
          "transform",
          `translate(${pos.x.toFixed(2)} ${(pos.y + 12 + arcLift * 14).toFixed(2)}) scale(${shScale})`
        );
        shd.setAttribute("opacity", (opacity * 0.38).toFixed(2));
      }

      // Health check probe dot + chip
      if (probeDotRef.current && probeChipRef.current) {
        if (snap.probeVisible && !prefersReduced) {
          const p = quadAt(geom.bToP, snap.probeT);
          probeDotRef.current.setAttribute("cx", p.x.toFixed(2));
          probeDotRef.current.setAttribute("cy", p.y.toFixed(2));
          probeDotRef.current.setAttribute("opacity", "1");
          probeDotRef.current.dataset.result = snap.probeResult;

          const xPct = (p.x / geom.vbW) * 100;
          const yPct = (p.y / geom.vbH) * 100;
          probeChipRef.current.style.opacity = "1";
          probeChipRef.current.style.left = `${xPct.toFixed(2)}%`;
          probeChipRef.current.style.top = `${yPct.toFixed(2)}%`;
          probeChipRef.current.style.transform = "translate(-50%, -140%)";
          probeChipRef.current.dataset.kind = snap.probeResult;
          probeChipRef.current.textContent = snap.probeText;
        } else {
          probeDotRef.current.setAttribute("opacity", "0");
          probeChipRef.current.style.opacity = "0";
        }
      }

      // Step scrubber fill bars
      for (let i = 0; i < STAGES.length; i++) {
        const fill = fillRefs.current[i];
        if (!fill) continue;
        const st = STAGES[i];
        let frac = 0;
        if (t >= st.end) frac = 1;
        else if (t > st.start) frac = (t - st.start) / (st.end - st.start);
        fill.style.transform = `scaleX(${frac.toFixed(4)})`;
      }
    };

    const tick = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const targetRate =
        prefersReduced || userPaused || !inViewRef.current || document.hidden
          ? 0
          : hoverRef.current
          ? speed * 0.35
          : speed;

      // Smoothly ease playback rate
      rateRef.current += (targetRate - rateRef.current) * Math.min(1, dt * 8);
      if (Math.abs(targetRate - rateRef.current) < 0.002) {
        rateRef.current = targetRate;
      }

      if (rateRef.current > 0) {
        clockRef.current = (clockRef.current + dt * rateRef.current) % CYCLE_S;
      }

      applyFrame(clockRef.current);
      rafId = window.requestAnimationFrame(tick);
    };

    applyFrame(clockRef.current);
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [geom, latencyMs, prefersReduced, requestsPerSecond, speed, userPaused]);

  const jumpToStage = (idx: number) => {
    const clamped = ((idx % STAGES.length) + STAGES.length) % STAGES.length;
    clockRef.current = prefersReduced
      ? STAGES[clamped].settled
      : STAGES[clamped].start + 0.05;
    stageIdxRef.current = clamped;
    setActiveStage(clamped);
  };

  const handleSegKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % STAGES.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + STAGES.length) % STAGES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STAGES.length - 1;
    else return;

    e.preventDefault();
    jumpToStage(next);
    segBtnRefs.current[next]?.focus();
  };

  const usersPlat = isoPlatform(geom.users.x, geom.users.y, 50, 25, 12);
  const balBase = isoPlatform(geom.balancer.x, geom.balancer.y, 60, 30, 14);
  const balTop = isoPlatform(geom.balancer.x, geom.balancer.y - 12, 36, 18, 12);
  const priPlat = isoPlatform(
    geom.primary.x,
    geom.primary.y,
    isStack ? 80 : 102,
    isStack ? 40 : 51,
    10
  );
  const secPlat = isoPlatform(
    geom.secondary.x,
    geom.secondary.y,
    isStack ? 80 : 102,
    isStack ? 40 : 51,
    10
  );

  const dialPath = `M${geom.balancer.x} ${geom.balancer.y - 23} A22.32 11.16 0 0 1 ${geom.balancer.x} ${geom.balancer.y - 0.68} A22.32 11.16 0 0 1 ${geom.balancer.x} ${geom.balancer.y - 23}`;

  const currentStage = STAGES[activeStage] ?? STAGES[0];

  return (
    <figure
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={
        accent
          ? ({ "--mrf-accent": accent, ...style } as CSSProperties)
          : style
      }
      data-ready={ready ? "true" : undefined}
      data-layout={isStack ? "stack" : "wide"}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="img"
        aria-label={ariaLabel}
        style={{ aspectRatio: `${geom.vbW} / ${geom.vbH}` }}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${geom.vbW} ${geom.vbH}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {/* Floor guides & packet shadows */}
          <g>
            <path
              className={styles.floor}
              d={`M${geom.users.x} ${geom.users.y + 18} L${geom.balancer.x} ${geom.balancer.y + 20}`}
            />
            <path
              className={styles.floor}
              d={`M${geom.balancer.x} ${geom.balancer.y + 20} L${geom.primary.x} ${geom.primary.y + 18}`}
            />
            <path
              className={styles.floor}
              d={`M${geom.balancer.x} ${geom.balancer.y + 20} L${geom.secondary.x} ${geom.secondary.y + 18}`}
            />
            {Array.from({ length: PACKET_POOL }).map((_, i) => (
              <ellipse
                key={i}
                ref={(el) => {
                  shadowRefs.current[i] = el;
                }}
                className={styles.shadow}
                cx={0}
                cy={0}
                rx={4.5}
                ry={2.25}
                opacity={0}
              />
            ))}
          </g>

          {/* Curved traffic routes */}
          <g className={styles.route} data-on="true">
            <path
              className={styles.edge}
              d={`M${geom.uToB[0].x} ${geom.uToB[0].y} Q${geom.uToB[1].x} ${geom.uToB[1].y} ${geom.uToB[2].x} ${geom.uToB[2].y}`}
              style={{ "--lit": 1 } as CSSProperties}
            />
          </g>
          <g className={styles.route}>
            <path
              ref={edgePRef}
              className={styles.edge}
              d={`M${geom.bToP[0].x} ${geom.bToP[0].y} Q${geom.bToP[1].x} ${geom.bToP[1].y} ${geom.bToP[2].x} ${geom.bToP[2].y}`}
            />
          </g>
          <g className={styles.route}>
            <path
              ref={edgeSRef}
              className={styles.edge}
              d={`M${geom.bToS[0].x} ${geom.bToS[0].y} Q${geom.bToS[1].x} ${geom.bToS[1].y} ${geom.bToS[2].x} ${geom.bToS[2].y}`}
            />
          </g>

          {/* Users node */}
          <g
            className={styles.node}
            onMouseEnter={() => setHoveredNode("users")}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <polygon className={styles.faceLeft} points={usersPlat.left} />
            <polygon className={styles.faceRight} points={usersPlat.right} />
            <polygon className={styles.faceTop} points={usersPlat.top} />
            {[
              { dx: 0, dy: -10 },
              { dx: 20, dy: 0 },
              { dx: -20, dy: 0 },
              { dx: 0, dy: 10 },
            ].map((d, idx) => (
              <g key={idx}>
                <ellipse
                  className={styles.deviceBase}
                  cx={geom.users.x + d.dx}
                  cy={geom.users.y + d.dy}
                  rx={5}
                  ry={2.5}
                />
                <circle
                  className={styles.device}
                  cx={geom.users.x + d.dx}
                  cy={geom.users.y + d.dy}
                  r={2.5}
                  fillOpacity={idx === 0 ? 0.85 : 0.45}
                />
              </g>
            ))}
            <polygon className={styles.hit} points={usersPlat.hit} />
          </g>

          {/* Global Load Balancer node */}
          <g
            className={styles.node}
            onMouseEnter={() => setHoveredNode("balancer")}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <polygon className={styles.faceLeft} points={balBase.left} />
            <polygon className={styles.faceRight} points={balBase.right} />
            <polygon className={styles.faceTop} points={balBase.top} />
            <polygon className={styles.faceLeft} points={balTop.left} />
            <polygon className={styles.faceRight} points={balTop.right} />
            <polygon className={styles.faceTop} points={balTop.top} />
            <path className={styles.dialTrack} d={dialPath} />
            <path
              ref={dialBRef}
              className={styles.dialB}
              d={dialPath}
              pathLength={1000}
              strokeDasharray="500 1000"
              strokeDashoffset="-500"
            />
            <path
              ref={dialARef}
              className={styles.dialA}
              d={dialPath}
              pathLength={1000}
              strokeDasharray="500 1000"
            />
            <polygon className={styles.hit} points={balBase.hit} />
          </g>

          {/* Primary Region */}
          <g
            className={styles.node}
            onMouseEnter={() => setHoveredNode("primary")}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <polygon className={styles.faceLeft} points={priPlat.left} />
            <polygon className={styles.faceRight} points={priPlat.right} />
            <polygon className={styles.faceTop} points={priPlat.top} />
            {geom.primaryCubes.map((c, i) => {
              const cube = isoPlatform(
                c.x,
                c.y,
                isStack ? 10.5 : 13,
                isStack ? 5.25 : 6.5,
                isStack ? 10 : 12
              );
              return (
                <g
                  key={i}
                  ref={(el) => {
                    primaryCubeRefs.current[i] = el;
                  }}
                  className={styles.cube}
                  data-state="up"
                >
                  <polygon className={styles.faceLeft} points={cube.left} />
                  <polygon className={styles.faceRight} points={cube.right} />
                  <polygon className={styles.faceTop} points={cube.top} />
                </g>
              );
            })}
            <polygon className={styles.hit} points={priPlat.hit} />
          </g>

          {/* Secondary Region */}
          <g
            className={styles.node}
            onMouseEnter={() => setHoveredNode("secondary")}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <polygon className={styles.faceLeft} points={secPlat.left} />
            <polygon className={styles.faceRight} points={secPlat.right} />
            <polygon className={styles.faceTop} points={secPlat.top} />
            {geom.secondaryCubes.map((c, i) => {
              const cube = isoPlatform(
                c.x,
                c.y,
                isStack ? 10.5 : 13,
                isStack ? 5.25 : 6.5,
                isStack ? 10 : 12
              );
              return (
                <g
                  key={i}
                  ref={(el) => {
                    secondaryCubeRefs.current[i] = el;
                  }}
                  className={styles.cube}
                  data-state="up"
                >
                  <polygon className={styles.faceLeft} points={cube.left} />
                  <polygon className={styles.faceRight} points={cube.right} />
                  <polygon className={styles.faceTop} points={cube.top} />
                </g>
              );
            })}
            <polygon className={styles.hit} points={secPlat.hit} />
          </g>

          {/* Traffic packets + health check probe */}
          <g className={styles.traffic}>
            {Array.from({ length: PACKET_POOL }).map((_, i) => (
              <circle
                key={i}
                ref={(el) => {
                  packetRefs.current[i] = el;
                }}
                className={styles.packet}
                r={3.5}
                cx={0}
                cy={0}
                opacity={0}
              />
            ))}
            <circle
              ref={probeDotRef}
              className={styles.probe}
              r={4}
              cx={0}
              cy={0}
              opacity={0}
            />
          </g>
        </svg>

        {/* Moving health check chip */}
        <div
          ref={probeChipRef}
          className={styles.msg}
          style={{ opacity: 0 }}
          aria-hidden="true"
        >
          GET /healthz
        </div>

        {/* HTML Labels */}
        <div
          className={styles.label}
          data-kind="users"
          data-above={geom.labelPos.users.above ? "" : undefined}
          style={{
            left: `${geom.labelPos.users.left}%`,
            top: `${geom.labelPos.users.top}%`,
          }}
          aria-hidden="true"
          onMouseEnter={() => setHoveredNode("users")}
          onMouseLeave={() => setHoveredNode(null)}
        >
          <span className={styles.name}>
            {renderMark(nodeInfo.users.icon)}
            {nodeInfo.users.label}
          </span>
          <span className={styles.meta}>{nodeInfo.users.meta}</span>
          <span className={styles.metric}>{formatRps(requestsPerSecond)}</span>
        </div>

        <div
          className={styles.label}
          data-kind="balancer"
          style={{
            left: `${geom.labelPos.balancer.left}%`,
            top: `${geom.labelPos.balancer.top}%`,
          }}
          aria-hidden="true"
          onMouseEnter={() => setHoveredNode("balancer")}
          onMouseLeave={() => setHoveredNode(null)}
        >
          <span className={styles.name}>
            {renderMark(nodeInfo.balancer.icon)}
            {nodeInfo.balancer.label}
          </span>
          <span className={styles.meta}>{nodeInfo.balancer.meta}</span>
          <span ref={balStatusRef} className={styles.status} data-state="done">
            <span className={styles.dot} />
            <span ref={balStatusTextRef}>All healthy</span>
          </span>
          <div className={styles.weights}>
            <span className={styles.bar}>
              <span ref={barARef} className={styles.barA} />
              <span ref={barBRef} className={styles.barB} />
            </span>
            <div className={styles.split}>
              <span className={styles.splitSide}>
                <span className={styles.splitName}>{nodeInfo.primary.label}</span>
                <span ref={pctARef} className={styles.splitPct}>
                  50%
                </span>
              </span>
              <span className={styles.splitSide} data-end="">
                <span className={styles.splitName}>{nodeInfo.secondary.label}</span>
                <span ref={pctBRef} className={styles.splitPct}>
                  50%
                </span>
              </span>
            </div>
          </div>
        </div>

        <div
          className={styles.label}
          data-kind="primary"
          style={{
            left: `${geom.labelPos.primary.left}%`,
            top: `${geom.labelPos.primary.top}%`,
          }}
          aria-hidden="true"
          onMouseEnter={() => setHoveredNode("primary")}
          onMouseLeave={() => setHoveredNode(null)}
        >
          <span className={styles.name}>
            {renderMark(nodeInfo.primary.icon)}
            {nodeInfo.primary.label}
          </span>
          <span className={styles.meta}>{nodeInfo.primary.meta}</span>
          <span ref={priStatusRef} className={styles.status} data-state="done">
            <span className={styles.dot} />
            <span ref={priStatusTextRef}>Healthy</span>
          </span>
          <span ref={priMetricRef} className={styles.metric}>
            {formatRps(requestsPerSecond / 2)} · p50 {latencyMs} ms
          </span>
        </div>

        <div
          className={styles.label}
          data-kind="secondary"
          style={{
            left: `${geom.labelPos.secondary.left}%`,
            top: `${geom.labelPos.secondary.top}%`,
          }}
          aria-hidden="true"
          onMouseEnter={() => setHoveredNode("secondary")}
          onMouseLeave={() => setHoveredNode(null)}
        >
          <span className={styles.name}>
            {renderMark(nodeInfo.secondary.icon)}
            {nodeInfo.secondary.label}
          </span>
          <span className={styles.meta}>{nodeInfo.secondary.meta}</span>
          <span ref={secStatusRef} className={styles.status} data-state="done">
            <span className={styles.dot} />
            <span ref={secStatusTextRef}>Healthy</span>
          </span>
          <span ref={secMetricRef} className={styles.metric}>
            {formatRps(requestsPerSecond / 2)} · p50 {latencyMs + 4} ms
          </span>
        </div>

        {/* Hover detail tags */}
        {(["users", "balancer", "primary", "secondary"] as FailoverNodeKey[]).map(
          (key) => {
            const pos = geom.tagPos[key];
            return (
              <div
                key={key}
                className={styles.tag}
                data-show={hoveredNode === key ? "" : undefined}
                data-below={pos.below ? "" : undefined}
                data-align={pos.align}
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                aria-hidden="true"
              >
                {nodeInfo[key].detail}
              </div>
            );
          }
        )}
      </div>

      {controls && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.toggle}
            aria-label={userPaused ? "Play" : "Pause"}
            aria-pressed={userPaused}
            disabled={prefersReduced}
            onClick={() => setLocalPaused(!userPaused)}
          >
            {userPaused ? (
              <Play size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>

          <div className={styles.segments} role="group" aria-label="Failover steps">
            {STAGES.map((st, idx) => {
              const isCurrent = idx === activeStage;
              return (
                <button
                  key={st.id}
                  ref={(el) => {
                    segBtnRefs.current[idx] = el;
                  }}
                  type="button"
                  className={styles.seg}
                  aria-label={`Step ${idx + 1} of ${STAGES.length}: ${st.title}`}
                  data-current={isCurrent ? "true" : "false"}
                  aria-current={isCurrent ? "step" : "false"}
                  onClick={() => jumpToStage(idx)}
                  onKeyDown={(e) => handleSegKeyDown(e, idx)}
                >
                  <span className={styles.track}>
                    <span
                      ref={(el) => {
                        fillRefs.current[idx] = el;
                      }}
                      className={styles.fill}
                    />
                  </span>
                  <span className={styles.segLabel}>{st.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {caption && (
        <figcaption className={styles.caption} aria-hidden="true">
          <span className={styles.capTitle}>{currentStage.title}</span>
          <span className={styles.capText}>
            {currentStage.caption(
              nodeInfo.primary.label,
              nodeInfo.secondary.label
            )}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export default MultiRegionFailover;
