"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import styles from "./dns-resolution.module.css";

export type DnsNodeId =
  | "browser"
  | "resolver"
  | "root"
  | "tld"
  | "authoritative";

export interface DnsNodeOverride {
  label?: string;
  meta?: string;
  detail?: string;
  icon?: string | ReactNode;
  color?: string;
}

export interface DnsResolutionProps {
  domain?: string;
  address?: string;
  ttl?: number;
  lookupMs?: number;
  cachedMs?: number;
  nodes?: Partial<Record<DnsNodeId, DnsNodeOverride>>;
  speed?: number;
  paused?: boolean;
  accent?: string;
  controls?: boolean;
  caption?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Pt {
  x: number;
  y: number;
}

interface IsoBox {
  top: string;
  left: string;
  right: string;
  hit: string;
  center: Pt;
  floor: Pt;
  cx: number;
  cy: number;
}

function makeIsoBox(cx: number, cy: number, rx: number, ry: number, h: number): IsoBox {
  const n = { x: cx, y: cy - ry };
  const e = { x: cx + rx, y: cy };
  const s = { x: cx, y: cy + ry };
  const w = { x: cx - rx, y: cy };

  const top = `${n.x},${n.y} ${e.x},${e.y} ${s.x},${s.y} ${w.x},${w.y}`;
  const left = `${w.x},${w.y} ${s.x},${s.y} ${s.x},${s.y + h} ${w.x},${w.y + h}`;
  const right = `${s.x},${s.y} ${e.x},${e.y} ${e.x},${e.y + h} ${s.x},${s.y + h}`;
  const hit = `${n.x},${n.y} ${e.x},${e.y} ${e.x},${e.y + h} ${s.x},${s.y + h} ${w.x},${w.y + h} ${w.x},${w.y}`;

  return {
    top,
    left,
    right,
    hit,
    center: { x: cx, y: cy },
    floor: { x: cx, y: cy + ry + h * 0.5 },
    cx,
    cy,
  };
}

function quadPt(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
  };
}

function sineEase(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function parseDomain(domain: string): { tld: string; registrable: string; ns: string } {
  const parts = domain.trim().toLowerCase().split(".").filter(Boolean);
  const tld = parts.length >= 1 ? `.${parts[parts.length - 1]}` : ".dev";
  const registrable =
    parts.length >= 2 ? parts.slice(-2).join(".") : domain || "acme.dev";
  return {
    tld,
    registrable,
    ns: `ns1.${registrable}`,
  };
}

function renderMark(icon?: string | ReactNode, color?: string): ReactNode {
  if (!icon) return null;
  if (typeof icon === "string") {
    if (icon.startsWith("http") || icon.startsWith("/") || icon.startsWith("data:")) {
      return <img src={icon} alt="" className={styles.mark} aria-hidden="true" />;
    }
    return (
      <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
        <path d={icon} fill={color ?? "currentColor"} />
      </svg>
    );
  }
  return <span className={styles.mark} aria-hidden="true">{icon}</span>;
}

const CLOUDFLARE_PATH =
  "M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727";

interface StepDef {
  id: string;
  label: string;
  title: string;
  text: string;
  start: number;
  end: number;
  settled: number;
}

const CYCLE_SEC = 16;
const RING_R = 14;
const RING_C = 2 * Math.PI * RING_R;

export function DnsResolution({
  domain = "app.acme.dev",
  address = "203.0.113.24",
  ttl = 300,
  lookupMs = 84,
  cachedMs = 1,
  nodes,
  speed = 1,
  paused = false,
  accent,
  controls = true,
  caption = true,
  label,
  className,
  style,
}: DnsResolutionProps) {
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced);

  const parsed = useMemo(() => parseDomain(domain), [domain]);

  const resolvedNodes = useMemo(() => {
    const nsMeta = nodes?.authoritative?.meta ?? parsed.ns;
    return {
      browser: {
        label: nodes?.browser?.label ?? "Browser",
        meta: nodes?.browser?.meta ?? domain,
        detail: nodes?.browser?.detail ?? "Needs an address before it can connect",
        icon: nodes?.browser?.icon,
        color: nodes?.browser?.color,
      },
      resolver: {
        label: nodes?.resolver?.label ?? "Resolver",
        meta: nodes?.resolver?.meta ?? "1.1.1.1",
        detail:
          nodes?.resolver?.detail ?? "Walks the chain for you and caches the answer",
        icon:
          nodes?.resolver?.icon !== undefined
            ? nodes.resolver.icon
            : CLOUDFLARE_PATH,
        color: nodes?.resolver?.color ?? "#F38020",
      },
      root: {
        label: nodes?.root?.label ?? "Root server",
        meta: nodes?.root?.meta ?? "a.root-servers.net",
        detail:
          nodes?.root?.detail ?? "Knows where every top level domain lives",
        icon: nodes?.root?.icon,
        color: nodes?.root?.color,
      },
      tld: {
        label: nodes?.tld?.label ?? "TLD server",
        meta: nodes?.tld?.meta ?? `${parsed.tld} registry`,
        detail:
          nodes?.tld?.detail ??
          `Knows the nameservers for every ${parsed.tld} name`,
        icon: nodes?.tld?.icon,
        color: nodes?.tld?.color,
      },
      authoritative: {
        label: nodes?.authoritative?.label ?? "Nameserver",
        meta: nsMeta,
        detail:
          nodes?.authoritative?.detail ??
          `Holds the records for ${parsed.registrable}`,
        icon: nodes?.authoritative?.icon,
        color: nodes?.authoritative?.color,
      },
    };
  }, [domain, nodes, parsed]);

  const steps: StepDef[] = useMemo(
    () => [
      {
        id: "ask",
        label: "Ask",
        title: "Ask the resolver",
        text: `The browser asks ${resolvedNodes.resolver.meta} for the IP address of ${domain}.`,
        start: 0.0,
        end: 0.14,
        settled: 0.07,
      },
      {
        id: "root",
        label: "Root",
        title: "Root server",
        text: `The root server does not know the address, but points to the ${parsed.tld} servers.`,
        start: 0.14,
        end: 0.32,
        settled: 0.23,
      },
      {
        id: "tld",
        label: parsed.tld,
        title: `${parsed.tld} TLD server`,
        text: `The ${parsed.tld} registry refers the resolver to ${resolvedNodes.authoritative.meta}.`,
        start: 0.32,
        end: 0.5,
        settled: 0.41,
      },
      {
        id: "ns",
        label: "Nameserver",
        title: "Authoritative nameserver",
        text: `${resolvedNodes.authoritative.meta} returns the A record ${address} with a ${ttl}s TTL.`,
        start: 0.5,
        end: 0.68,
        settled: 0.59,
      },
      {
        id: "answer",
        label: "Answer",
        title: "Connect & cache",
        text: `The resolver caches ${address} and returns it so the browser connects in ${lookupMs} ms.`,
        start: 0.68,
        end: 0.82,
        settled: 0.78,
      },
      {
        id: "cache",
        label: "Cache",
        title: "Cache hit",
        text: `While the TTL ring holds, the next lookup is answered from cache in ${cachedMs} ms.`,
        start: 0.82,
        end: 1.0,
        settled: 0.91,
      },
    ],
    [address, cachedMs, domain, lookupMs, parsed.tld, resolvedNodes, ttl],
  );

  const ariaStory =
    label ??
    `DNS resolution for ${domain}. The browser asks a resolver, which asks a root server, the ${parsed.tld} TLD server and the nameserver ${resolvedNodes.authoritative.meta} in turn. Each points to the next until ${resolvedNodes.authoritative.meta} answers ${address} and the browser connects in ${lookupMs} ms. The resolver caches the answer for ${ttl} seconds, so the next lookup is answered from the cache in one short hop.`;

  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  const [ready, setReady] = useState(false);
  const [userPaused, setUserPaused] = useState(paused);
  const [hovered, setHovered] = useState<DnsNodeId | null>(null);
  const [currentStep, setCurrentStep] = useState(paused || reduced ? 5 : 0);

  // Sync external paused prop
  const effectivePaused = paused || userPaused;

  // Measure container for landscape vs portrait layout
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setCompact(w > 0 && w < 640);
      setReady(true);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Geometry for wide vs portrait
  const geom = useMemo(() => {
    const W = compact ? 390 : 1000;
    const H = compact ? 700 : 612;

    const boxes: Record<DnsNodeId, IsoBox> = compact
      ? {
          browser: makeIsoBox(105, 165, 52, 26, 22),
          resolver: makeIsoBox(105, 430, 54, 27, 36),
          root: makeIsoBox(295, 130, 48, 24, 24),
          tld: makeIsoBox(295, 340, 48, 24, 24),
          authoritative: makeIsoBox(295, 550, 48, 24, 24),
        }
      : {
          browser: makeIsoBox(160, 275, 62, 31, 24),
          resolver: makeIsoBox(480, 282, 64, 32, 42),
          root: makeIsoBox(850, 80, 58, 29, 26),
          tld: makeIsoBox(850, 272, 58, 29, 26),
          authoritative: makeIsoBox(850, 464, 58, 29, 26),
        };

    const routeDefs: Array<{
      id: string;
      from: DnsNodeId;
      to: DnsNodeId;
      lift: number;
    }> = [
      { id: "br-res", from: "browser", to: "resolver", lift: compact ? 44 : 52 },
      { id: "res-root", from: "resolver", to: "root", lift: compact ? 48 : 66 },
      { id: "res-tld", from: "resolver", to: "tld", lift: compact ? 40 : 54 },
      { id: "res-ns", from: "resolver", to: "authoritative", lift: compact ? 44 : 58 },
    ];

    const routes = routeDefs.map((r) => {
      const a = boxes[r.from].center;
      const b = boxes[r.to].center;
      const c = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2 - r.lift,
      };
      const fa = boxes[r.from].floor;
      const fb = boxes[r.to].floor;
      return {
        ...r,
        a,
        b,
        c,
        d: `M${a.x.toFixed(2)} ${a.y.toFixed(2)} Q${c.x.toFixed(2)} ${c.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        floorD: `M${fa.x.toFixed(2)} ${fa.y.toFixed(2)} L${fb.x.toFixed(2)} ${fb.y.toFixed(2)}`,
        fa,
        fb,
      };
    });

    const labelPos: Record<DnsNodeId, { left: string; top: string }> = {
      browser: {
        left: `${((boxes.browser.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.browser.cy + 68) / H) * 100).toFixed(2)}%`,
      },
      resolver: {
        left: `${((boxes.resolver.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.resolver.cy + 82) / H) * 100).toFixed(2)}%`,
      },
      root: {
        left: `${((boxes.root.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.root.cy + 66) / H) * 100).toFixed(2)}%`,
      },
      tld: {
        left: `${((boxes.tld.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.tld.cy + 66) / H) * 100).toFixed(2)}%`,
      },
      authoritative: {
        left: `${((boxes.authoritative.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.authoritative.cy + 66) / H) * 100).toFixed(2)}%`,
      },
    };

    const tagPos: Record<DnsNodeId, { left: string; top: string; align: "start" | "center" | "end" }> = {
      browser: {
        left: `${((boxes.browser.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.browser.cy - 44) / H) * 100).toFixed(2)}%`,
        align: "start",
      },
      resolver: {
        left: `${((boxes.resolver.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.resolver.cy - 48) / H) * 100).toFixed(2)}%`,
        align: "center",
      },
      root: {
        left: `${((boxes.root.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.root.cy - 42) / H) * 100).toFixed(2)}%`,
        align: "end",
      },
      tld: {
        left: `${((boxes.tld.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.tld.cy - 42) / H) * 100).toFixed(2)}%`,
        align: "end",
      },
      authoritative: {
        left: `${((boxes.authoritative.cx / W) * 100).toFixed(2)}%`,
        top: `${(((boxes.authoritative.cy - 42) / H) * 100).toFixed(2)}%`,
        align: "end",
      },
    };

    return { W, H, boxes, routes, labelPos, tagPos };
  }, [compact]);

  // Direct DOM refs for 60fps zero-rerender animation
  const clockRef = useRef(paused || reduced ? 0.91 : 0);
  const speedEaseRef = useRef(effectivePaused || reduced ? 0 : speed);
  const inViewRef = useRef(true);
  const hoveredRef = useRef<DnsNodeId | null>(null);
  const stepRef = useRef(currentStep);

  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  const nodeGroupRefs = useRef<Record<DnsNodeId, SVGGElement | null>>({
    browser: null,
    resolver: null,
    root: null,
    tld: null,
    authoritative: null,
  });
  const edgeRefs = useRef<Array<SVGPathElement | null>>([]);
  const trailRef = useRef<SVGPathElement | null>(null);
  const packetRef = useRef<SVGCircleElement | null>(null);
  const shadowRef = useRef<SVGEllipseElement | null>(null);
  const msgRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const lockRef = useRef<SVGCircleElement | null>(null);
  const pageLinesRef = useRef<SVGGElement | null>(null);

  const statusRefs = useRef<Record<DnsNodeId, HTMLSpanElement | null>>({
    browser: null,
    resolver: null,
    root: null,
    tld: null,
    authoritative: null,
  });
  const statusTextRefs = useRef<Record<DnsNodeId, HTMLSpanElement | null>>({
    browser: null,
    resolver: null,
    root: null,
    tld: null,
    authoritative: null,
  });
  const recordRef = useRef<HTMLDivElement | null>(null);
  const recordTtlRef = useRef<HTMLSpanElement | null>(null);
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const segBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Pure frame renderer from clock t in [0, 1]
  const paintFrame = useCallback(
    (t: number) => {
      const stepIdx = steps.findIndex((s, i) =>
        i === steps.length - 1 ? t >= s.start : t >= s.start && t < s.end,
      );
      const activeIdx = stepIdx === -1 ? 0 : stepIdx;
      if (activeIdx !== stepRef.current) {
        stepRef.current = activeIdx;
        setCurrentStep(activeIdx);
      }

      // Update scrubber segment fills
      for (let i = 0; i < steps.length; i++) {
        const fillEl = fillRefs.current[i];
        if (!fillEl) continue;
        const s = steps[i];
        const frac =
          t >= s.end ? 1 : t <= s.start ? 0 : clamp((t - s.start) / (s.end - s.start), 0, 1);
        fillEl.style.transform = `scaleX(${frac.toFixed(4)})`;
      }

      // Active packet definition
      let routeIdx = -1;
      let u = 0;
      let reverse = false;
      let kind: "query" | "referral" | "answer" = "query";
      let msgText = "";

      if (t < 0.14) {
        routeIdx = 0;
        u = sineEase(clamp(t / 0.12, 0, 1));
        kind = "query";
        msgText = `A? ${domain}`;
      } else if (t < 0.32) {
        routeIdx = 1;
        const local = (t - 0.14) / 0.18;
        if (local < 0.5) {
          u = sineEase(local * 2);
          kind = "query";
          msgText = `A? ${domain}`;
        } else {
          u = sineEase((local - 0.5) * 2);
          reverse = true;
          kind = "referral";
          msgText = `NS ${parsed.tld}`;
        }
      } else if (t < 0.5) {
        routeIdx = 2;
        const local = (t - 0.32) / 0.18;
        if (local < 0.5) {
          u = sineEase(local * 2);
          kind = "query";
          msgText = `A? ${domain}`;
        } else {
          u = sineEase((local - 0.5) * 2);
          reverse = true;
          kind = "referral";
          msgText = `NS ${resolvedNodes.authoritative.meta}`;
        }
      } else if (t < 0.68) {
        routeIdx = 3;
        const local = (t - 0.5) / 0.18;
        if (local < 0.5) {
          u = sineEase(local * 2);
          kind = "query";
          msgText = `A? ${domain}`;
        } else {
          u = sineEase((local - 0.5) * 2);
          reverse = true;
          kind = "answer";
          msgText = `A ${address}`;
        }
      } else if (t < 0.82) {
        routeIdx = 0;
        const local = clamp((t - 0.68) / 0.1, 0, 1);
        u = sineEase(local);
        reverse = true;
        kind = "answer";
        msgText = `A ${address}`;
      } else if (t < 0.94) {
        routeIdx = 0;
        const local = (t - 0.82) / 0.12;
        if (local < 0.5) {
          u = sineEase(local * 2);
          kind = "query";
          msgText = `A? ${domain}`;
        } else {
          u = sineEase((local - 0.5) * 2);
          reverse = true;
          kind = "answer";
          msgText = `Cache: ${address}`;
        }
      }

      // Highlight edges
      for (let i = 0; i < geom.routes.length; i++) {
        const edgeEl = edgeRefs.current[i];
        if (!edgeEl) continue;
        const lit = i === routeIdx ? 1 : 0;
        edgeEl.style.setProperty("--lit", String(lit));
      }

      // Highlight nodes
      const nodeHits: Record<DnsNodeId, number> = {
        browser: t < 0.08 || (t >= 0.74 && t < 0.96) ? 1 : 0,
        resolver: t >= 0.08 && t < 0.96 ? 1 : 0,
        root: t >= 0.18 && t < 0.32 ? 1 : 0,
        tld: t >= 0.36 && t < 0.5 ? 1 : 0,
        authoritative: t >= 0.54 && t < 0.68 ? 1 : 0,
      };

      (Object.keys(nodeHits) as DnsNodeId[]).forEach((id) => {
        const g = nodeGroupRefs.current[id];
        if (g) g.style.setProperty("--hit", String(nodeHits[id]));
      });

      // Position moving packet, trail, shadow, and floating msg chip
      const pkt = packetRef.current;
      const trl = trailRef.current;
      const shd = shadowRef.current;
      const msg = msgRef.current;

      if (routeIdx >= 0 && !reduced) {
        const r = geom.routes[routeIdx];
        const s = reverse ? 1 - u : u;
        const pt = quadPt(r.a, r.c, r.b, s);
        const tailS = reverse ? Math.min(1, s + 0.18) : Math.max(0, s - 0.18);
        const midS = (s + tailS) / 2;
        const pTail = quadPt(r.a, r.c, r.b, tailS);
        const pMid = quadPt(r.a, r.c, r.b, midS);

        if (pkt) {
          pkt.setAttribute("cx", pt.x.toFixed(2));
          pkt.setAttribute("cy", pt.y.toFixed(2));
          pkt.setAttribute("opacity", "1");
          pkt.setAttribute("data-kind", kind);
        }
        if (trl) {
          trl.setAttribute(
            "d",
            `M${pTail.x.toFixed(2)} ${pTail.y.toFixed(2)} Q${pMid.x.toFixed(2)} ${pMid.y.toFixed(2)} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`,
          );
          trl.setAttribute("opacity", "1");
        }
        if (shd) {
          const fx = r.fa.x + (r.fb.x - r.fa.x) * s;
          const fy = r.fa.y + (r.fb.y - r.fa.y) * s;
          const elev = Math.sin(Math.PI * s);
          const sc = 1 - elev * 0.35;
          shd.setAttribute(
            "transform",
            `translate(${fx.toFixed(2)} ${fy.toFixed(2)}) scale(${sc.toFixed(3)})`,
          );
          shd.setAttribute("opacity", "1");
        }
        if (msg && stageRef.current) {
          const rect = stageRef.current.getBoundingClientRect();
          const px = (pt.x / geom.W) * rect.width;
          const py = (pt.y / geom.H) * rect.height - 20;
          msg.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
          msg.style.opacity = "1";
          msg.dataset.kind = kind;
          if (msg.textContent !== msgText) msg.textContent = msgText;
        }
      } else {
        if (pkt) pkt.setAttribute("opacity", "0");
        if (trl) trl.setAttribute("opacity", "0");
        if (shd) shd.setAttribute("opacity", "0");
        if (msg) msg.style.opacity = "0";
      }

      // Browser lock & page lines
      const connected = t >= 0.76 && t < 0.98;
      if (lockRef.current) {
        lockRef.current.setAttribute("opacity", connected ? "1" : "0");
      }
      if (pageLinesRef.current) {
        pageLinesRef.current.setAttribute("opacity", connected ? "1" : "0");
      }

      // TTL ring & cached record
      const cached = t >= 0.68 && t < 0.99;
      const cacheProgress = cached ? clamp((t - 0.68) / 0.28, 0, 1) : 0;
      const ttlRemaining = Math.max(0, Math.round(ttl * (1 - cacheProgress)));
      const expired = t >= 0.96;

      if (ringRef.current) {
        const dashOffset = cached ? RING_C * cacheProgress : RING_C;
        ringRef.current.setAttribute("stroke-dashoffset", dashOffset.toFixed(2));
        ringRef.current.setAttribute("opacity", cached && !expired ? "1" : "0");
      }

      if (recordRef.current && recordTtlRef.current) {
        recordRef.current.style.opacity = cached ? "1" : "0";
        recordRef.current.dataset.state = expired
          ? "expired"
          : t >= 0.85 && t < 0.95
            ? "hit"
            : "cached";
        const ttlLabel = expired ? "Expired" : `TTL ${ttlRemaining}s`;
        if (recordTtlRef.current.textContent !== ttlLabel) {
          recordTtlRef.current.textContent = ttlLabel;
        }
      }

      // Per-node status chips
      const setStatus = (id: DnsNodeId, state: string, text: string) => {
        const el = statusRefs.current[id];
        const txt = statusTextRefs.current[id];
        if (el && el.dataset.state !== state) el.dataset.state = state;
        if (txt && txt.textContent !== text) txt.textContent = text;
      };

      // Browser status
      if (t < 0.76) {
        const ms = Math.round(clamp(t / 0.76, 0, 1) * lookupMs);
        setStatus("browser", "busy", `Resolving ${ms} ms`);
      } else if (t < 0.84) {
        setStatus("browser", "done", `Connected in ${lookupMs} ms`);
      } else if (t < 0.96) {
        setStatus("browser", "done", `Connected in ${cachedMs} ms`);
      } else {
        setStatus("browser", "idle", "Idle");
      }

      // Resolver status
      if (t < 0.08 || t >= 0.97) {
        setStatus("resolver", "idle", "Waiting");
      } else if (t < 0.68) {
        setStatus("resolver", "busy", "Resolving");
      } else if (t < 0.84) {
        setStatus("resolver", "done", "Cached");
      } else {
        setStatus("resolver", "done", "Cache hit");
      }

      // Root status
      if (t >= 0.18 && t < 0.34) {
        setStatus("root", "refer", `Try ${parsed.tld}`);
      } else if (t >= 0.34 && t < 0.97) {
        setStatus("root", "idle", `Referred ${parsed.tld}`);
      } else {
        setStatus("root", "idle", "Idle");
      }

      // TLD status
      if (t >= 0.36 && t < 0.52) {
        setStatus("tld", "refer", `Try ${resolvedNodes.authoritative.meta}`);
      } else if (t >= 0.52 && t < 0.97) {
        setStatus("tld", "idle", "Referred NS");
      } else {
        setStatus("tld", "idle", "Idle");
      }

      // Nameserver status
      if (t >= 0.54 && t < 0.7) {
        setStatus("authoritative", "done", `A ${address}`);
      } else if (t >= 0.7 && t < 0.97) {
        setStatus("authoritative", "idle", `Answered ${address}`);
      } else {
        setStatus("authoritative", "idle", "Idle");
      }
    },
    [address, cachedMs, domain, geom, lookupMs, parsed.tld, reduced, resolvedNodes, steps, ttl],
  );

  // IntersectionObserver to pause offscreen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Main requestAnimationFrame loop
  useEffect(() => {
    paintFrame(clockRef.current);
    if (reduced) return;

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (inViewRef.current && !document.hidden) {
        const hoverScale = hoveredRef.current ? 0.35 : 1;
        const targetSpeed = effectivePaused ? 0 : Math.max(0, speed) * hoverScale;
        speedEaseRef.current += (targetSpeed - speedEaseRef.current) * Math.min(1, dt * 10);

        if (Math.abs(speedEaseRef.current) > 0.0005) {
          clockRef.current = (clockRef.current + (dt * speedEaseRef.current) / CYCLE_SEC) % 1;
          paintFrame(clockRef.current);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [effectivePaused, paintFrame, reduced, speed]);

  const jumpToStep = useCallback(
    (idx: number) => {
      const s = steps[idx];
      if (!s) return;
      clockRef.current = reduced || effectivePaused ? s.settled : s.start + 0.005;
      stepRef.current = idx;
      setCurrentStep(idx);
      paintFrame(clockRef.current);
    },
    [effectivePaused, paintFrame, reduced, steps],
  );

  const onStepKeyDown = useCallback(
    (idx: number, ev: KeyboardEvent<HTMLButtonElement>) => {
      let next = idx;
      if (ev.key === "ArrowRight") next = (idx + 1) % steps.length;
      else if (ev.key === "ArrowLeft") next = (idx - 1 + steps.length) % steps.length;
      else if (ev.key === "Home") next = 0;
      else if (ev.key === "End") next = steps.length - 1;
      else return;
      ev.preventDefault();
      jumpToStep(next);
      segBtnRefs.current[next]?.focus();
    },
    [jumpToStep, steps.length],
  );

  const rootStyle: CSSProperties = {
    ...style,
    ...(accent ? ({ "--dns-accent": accent } as CSSProperties) : {}),
  };

  const activeStep = steps[currentStep] ?? steps[0];

  const isRouteDim = (from: DnsNodeId, to: DnsNodeId) =>
    hovered !== null && hovered !== from && hovered !== to;

  return (
    <figure
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-ready={ready ? "true" : undefined}
      data-layout={compact ? "compact" : "wide"}
      style={rootStyle}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="img"
        aria-label={ariaStory}
        style={{ aspectRatio: `${geom.W} / ${geom.H}` }}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${geom.W} ${geom.H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {/* Floor guide lines & packet shadow */}
          <g>
            {geom.routes.map((r) => (
              <path
                key={`floor-${r.id}`}
                className={styles.floor}
                data-dim={isRouteDim(r.from, r.to) ? "" : undefined}
                d={r.floorD}
              />
            ))}
            <ellipse
              ref={shadowRef}
              className={styles.shadow}
              cx={0}
              cy={0}
              rx={5}
              ry={2.5}
              opacity={0}
            />
          </g>

          {/* Isometric Nodes */}
          {(["root", "tld", "authoritative", "resolver", "browser"] as DnsNodeId[]).map(
            (id) => {
              const box = geom.boxes[id];
              const isDim = hovered !== null && hovered !== id;
              const isOn = hovered === id;
              return (
                <g
                  key={id}
                  ref={(el) => {
                    nodeGroupRefs.current[id] = el;
                  }}
                  className={styles.node}
                  data-dim={isDim ? "" : undefined}
                  data-on={isOn ? "" : undefined}
                >
                  <polygon className={styles.faceLeft} points={box.left} />
                  <polygon className={styles.faceRight} points={box.right} />
                  <polygon className={styles.faceTop} points={box.top} />

                  {/* Node-specific surface details */}
                  {id === "browser" ? (
                    <g>
                      <line
                        className={styles.bar}
                        x1={box.cx - 24}
                        y1={box.cy - 6}
                        x2={box.cx + 22}
                        y2={box.cy - 6}
                      />
                      <circle className={styles.lockBase} cx={box.cx - 28} cy={box.cy - 6} r={3} />
                      <circle
                        ref={lockRef}
                        className={styles.lock}
                        cx={box.cx - 28}
                        cy={box.cy - 6}
                        r={3}
                        opacity={0}
                      />
                      <line
                        className={styles.ghost}
                        x1={box.cx - 20}
                        y1={box.cy + 5}
                        x2={box.cx + 16}
                        y2={box.cy + 5}
                      />
                      <line
                        className={styles.ghost}
                        x1={box.cx - 12}
                        y1={box.cy + 13}
                        x2={box.cx + 10}
                        y2={box.cy + 13}
                      />
                      <g ref={pageLinesRef} opacity={0}>
                        <line
                          className={styles.pageLine}
                          x1={box.cx - 20}
                          y1={box.cy + 5}
                          x2={box.cx + 16}
                          y2={box.cy + 5}
                        />
                        <line
                          className={styles.pageLine}
                          x1={box.cx - 12}
                          y1={box.cy + 13}
                          x2={box.cx + 10}
                          y2={box.cy + 13}
                        />
                      </g>
                    </g>
                  ) : id === "resolver" ? (
                    <g>
                      {/* Cache tier TTL ring */}
                      <circle
                        className={styles.ringTrack}
                        cx={box.cx}
                        cy={box.cy}
                        r={RING_R}
                      />
                      <circle
                        ref={ringRef}
                        className={styles.ring}
                        cx={box.cx}
                        cy={box.cy}
                        r={RING_R}
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C}
                        transform={`rotate(-90 ${box.cx} ${box.cy})`}
                        opacity={0}
                      />
                      <circle className={styles.portBase} cx={box.cx - 18} cy={box.cy + 24} r={2.5} />
                      <circle className={styles.port} cx={box.cx - 10} cy={box.cy + 28} r={2.5} />
                    </g>
                  ) : (
                    <g>
                      {/* Server rack lines & LEDs */}
                      <line
                        className={styles.rack}
                        x1={box.cx - 22}
                        y1={box.cy - 2}
                        x2={box.cx + 12}
                        y2={box.cy + 12}
                      />
                      <line
                        className={styles.rack}
                        x1={box.cx - 12}
                        y1={box.cy - 10}
                        x2={box.cx + 22}
                        y2={box.cy + 4}
                      />
                      <circle className={styles.ledBase} cx={box.cx - 24} cy={box.cy + 18} r={2.5} />
                      <circle className={styles.led} cx={box.cx - 16} cy={box.cy + 22} r={2.5} />
                    </g>
                  )}

                  <polygon
                    className={styles.hit}
                    points={box.hit}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered((cur) => (cur === id ? null : cur))}
                  />
                </g>
              );
            },
          )}

          {/* Curved Routes */}
          {geom.routes.map((r, i) => (
            <g
              key={r.id}
              className={styles.route}
              data-dim={isRouteDim(r.from, r.to) ? "" : undefined}
              data-on={hovered === r.from || hovered === r.to ? "" : undefined}
            >
              <path
                ref={(el) => {
                  edgeRefs.current[i] = el;
                }}
                className={styles.edge}
                d={r.d}
              />
            </g>
          ))}

          {/* Moving packet & trail */}
          <path ref={trailRef} className={styles.trail} d="" opacity={0} />
          <circle ref={packetRef} className={styles.packet} cx={0} cy={0} r={4.5} opacity={0} />
        </svg>

        {/* Floating packet record chip */}
        <div ref={msgRef} className={styles.msg} style={{ opacity: 0 }} aria-hidden="true" />

        {/* Node labels & status chips */}
        {(["browser", "resolver", "root", "tld", "authoritative"] as DnsNodeId[]).map((id) => {
          const info = resolvedNodes[id];
          const pos = geom.labelPos[id];
          return (
            <div
              key={id}
              className={styles.label}
              style={{ left: pos.left, top: pos.top }}
              aria-hidden="true"
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered((cur) => (cur === id ? null : cur))}
            >
              <span className={styles.name}>
                {renderMark(info.icon, info.color)}
                {info.label}
              </span>
              <span className={styles.meta}>{info.meta}</span>
              <span
                ref={(el) => {
                  statusRefs.current[id] = el;
                }}
                className={styles.status}
                data-state="idle"
              >
                <span className={styles.dot} />
                <span
                  ref={(el) => {
                    statusTextRefs.current[id] = el;
                  }}
                >
                  Idle
                </span>
              </span>

              {id === "resolver" ? (
                <div
                  ref={recordRef}
                  className={styles.record}
                  data-state="cached"
                  style={{ opacity: 0 }}
                >
                  <span className={styles.recordName}>{domain}</span>
                  <div className={styles.recordRow}>
                    <span className={styles.recordValue}>A {address}</span>
                    <span ref={recordTtlRef} className={styles.recordTtl}>
                      TTL {ttl}s
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Hover detail tags */}
        {(["browser", "resolver", "root", "tld", "authoritative"] as DnsNodeId[]).map((id) => {
          const info = resolvedNodes[id];
          const tpos = geom.tagPos[id];
          return (
            <div
              key={`tag-${id}`}
              className={styles.tag}
              data-align={tpos.align}
              data-show={hovered === id ? "" : undefined}
              style={{ left: tpos.left, top: tpos.top }}
              aria-hidden="true"
            >
              {info.detail}
            </div>
          );
        })}
      </div>

      {controls ? (
        <div className={styles.controls} role="group" aria-label="DNS resolution steps">
          <button
            type="button"
            className={styles.toggle}
            aria-label={effectivePaused ? "Play animation" : "Pause animation"}
            aria-pressed={effectivePaused}
            disabled={reduced}
            onClick={() => setUserPaused((p) => !p)}
          >
            {effectivePaused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
          </button>

          <div className={styles.segments}>
            {steps.map((s, idx) => (
              <button
                key={s.id}
                ref={(el) => {
                  segBtnRefs.current[idx] = el;
                }}
                type="button"
                className={styles.seg}
                aria-label={`Step ${idx + 1} of ${steps.length}: ${s.title}`}
                aria-current={currentStep === idx ? "step" : undefined}
                data-current={currentStep === idx ? "true" : undefined}
                onClick={() => jumpToStep(idx)}
                onKeyDown={(ev) => onStepKeyDown(idx, ev)}
              >
                <span className={styles.track}>
                  <span
                    ref={(el) => {
                      fillRefs.current[idx] = el;
                    }}
                    className={styles.fill}
                  />
                </span>
                <span className={styles.segLabel}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {caption ? (
        <figcaption className={styles.caption} aria-hidden="true">
          <span className={styles.capTitle}>{activeStep.title}</span>
          <span className={styles.capText}>{activeStep.text}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
