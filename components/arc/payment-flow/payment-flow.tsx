"use client";

import {
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Landmark, Nfc, Store } from "lucide-react";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./payment-flow.module.css";

export interface PaymentFlowNode {
  label: string;
  meta?: string;
  detail?: string;
  icon?: ReactNode;
  color?: string;
}

export interface PaymentFlowNodes {
  terminal?: PaymentFlowNode;
  processor?: PaymentFlowNode;
  network?: PaymentFlowNode;
  issuer?: PaymentFlowNode;
  merchant?: PaymentFlowNode;
}

export interface PaymentFlowLabels {
  authorization?: string;
  settlement?: string;
  settlementTime?: string;
  approved?: string;
}

export interface PaymentFlowProps {
  nodes?: PaymentFlowNodes;
  amount?: number;
  fee?: number;
  balance?: number;
  currency?: string;
  locale?: string;
  authorizationMs?: number;
  labels?: PaymentFlowLabels;
  hideSteps?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  caption?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const STRIPE =
  "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z";

const MASTERCARD = (
  <svg viewBox="2 2 20 20" aria-hidden="true">
    <circle cx="9" cy="12" r="6.5" fill="#EB001B" />
    <circle cx="15" cy="12" r="6.5" fill="#F79E1B" />
    <path d="M12 6.234A6.5 6.5 0 0 1 12 17.766A6.5 6.5 0 0 1 12 6.234Z" fill="#FF5F00" />
  </svg>
);

const KEYS = ["terminal", "processor", "network", "issuer", "merchant"] as const;
type Key = (typeof KEYS)[number];

const DEFAULT_NODES: Record<Key, PaymentFlowNode> = {
  terminal: {
    label: "Checkout",
    meta: "Tap to pay",
    detail: "A card or phone is tapped on the reader",
    icon: <Nfc />,
  },
  processor: {
    label: "Stripe",
    meta: "Processor",
    detail: "Checks risk and forwards the request",
    icon: STRIPE,
    color: "#635BFF",
  },
  network: {
    label: "Mastercard",
    meta: "Card network",
    detail: "Routes it to the bank that issued the card",
    icon: MASTERCARD,
  },
  issuer: {
    label: "Bank",
    meta: "Card issuer",
    detail: "Checks the balance and holds the funds",
    icon: <Landmark />,
  },
  merchant: {
    label: "Your balance",
    detail: "Receives the payout, minus fees",
    icon: <Store />,
  },
};

const DEFAULT_LABELS: Required<PaymentFlowLabels> = {
  authorization: "Authorization",
  settlement: "Settlement",
  settlementTime: "Next business day",
  approved: "Approved",
};

/* One payment, in milliseconds. Everything below is a pure function of this clock. */
const PERIOD = 15283;
const HOP_START = 590;
const HOP_GAP = 1216;
const HOP_MS = 750;
const BACK_START = 4666;
const BACK_GAP = 800;
const BACK_MS = 667;
const BADGE_AT = 6890;
const TOP_FADE = 7990;
const SETTLE_AT = 8449;
const CLEAR_AT = 9600;
const FEE_LEAVE = 10090;
const FEE_AT = 10850;
const SWAP_AT = 10900;
const SWAP_END = 11250;
const NET_LEAVE = 11560;
const NET_AT = 12400;
const PAID_AT = 12420;
const UNLIT_AT = 13530;
const RESET_AT = 14325;
const STILL_AT = 11980;
const EDGE = 0.8;

type ChipState = "idle" | "active" | "done" | "ok";
type Beat = [at: number, state: ChipState, text: number];

/* Status line per node: index 0 is the resting meta, the rest are the scripted lines. */
const BEATS: Beat[][] = [
  [[0, "active", 1], [840, "active", 2], [6790, "ok", 3], [RESET_AT, "idle", 0]],
  [[1190, "active", 1], [1806, "done", 2], [10720, "active", 3], [11530, "done", 3], [RESET_AT, "idle", 0]],
  [[2406, "active", 1], [3040, "done", 2], [9505, "active", 3], [10056, "done", 4], [RESET_AT, "idle", 0]],
  [[3640, "active", 1], [4660, "ok", 2], [5550, "done", 3], [8390, "active", 4], [8890, "ok", 5], [RESET_AT, "idle", 0]],
  [[11210, "active", 0], [12350, "ok", 0], [RESET_AT, "idle", 0]],
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const sine = (p: number) => (1 - Math.cos(Math.PI * clamp(p))) / 2;
const smooth = (p: number) => {
  const c = clamp(p);
  return c * c * (3 - 2 * c);
};
const outCubic = (p: number) => 1 - Math.pow(1 - clamp(p), 3);
const outBack = (p: number) => {
  const c = clamp(p) - 1;
  return 1 + 2.15 * c * c * c + 1.15 * c * c;
};
const f2 = (v: number) => v.toFixed(2);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Geometry {
  wide: boolean;
  width: number;
  height: number;
  chips: Box[];
  wires: string[];
  stubs: string[];
  top: string;
  rail: string;
  ports: [number, number][];
  waypoints: [number, number][];
  /** Distance between chain centers, and a chip's half extent along the chain. */
  step: number;
  half: number;
  /** Half extents along the rail where it leaves the bank and enters the merchant. */
  railOut: number;
  railIn: number;
}

function layout(width: number): Geometry {
  const p = (x: number, y: number) => `${f2(x)} ${f2(y)}`;
  if (width >= 700) {
    const gap = (width - 152) / 3;
    const xs = [0, 1, 2, 3].map((i) => Math.round(1 + i * gap));
    const cx = xs.map((x) => x + 75);
    const chips: Box[] = [
      ...xs.map((x) => ({ x, y: 10, w: 150, h: 60 })),
      { x: 1, y: 126, w: 150, h: 60 },
    ];
    const rail = `M${p(cx[3], 40)} L${p(cx[3], 138)} Q${p(cx[3], 156)} ${p(cx[3] - 18, 156)} L${p(cx[2], 156)}`;
    return {
      wide: true,
      width,
      height: 187,
      chips,
      wires: [
        `M${p(cx[0], 40)} L${p(cx[1], 40)}`,
        `M${p(cx[1], 40)} L${p(cx[2], 40)}`,
        `M${p(cx[2], 40)} L${p(cx[3], 40)}`,
        rail,
        `M${p(cx[2], 156)} L${p(cx[1], 156)}`,
        `M${p(cx[1], 156)} L${p(cx[0], 156)}`,
      ],
      stubs: [`M${p(cx[2], 70)} L${p(cx[2], 152)}`, `M${p(cx[1], 70)} L${p(cx[1], 152)}`],
      top: `M${p(cx[0], 40)} L${p(cx[1], 40)} L${p(cx[2], 40)} L${p(cx[3], 40)}`,
      rail: `${rail} L${p(cx[1], 156)} L${p(cx[0], 156)}`,
      ports: [
        [xs[0] + 150, 40],
        [xs[1], 40],
        [xs[1] + 150, 40],
        [xs[2], 40],
        [xs[2] + 150, 40],
        [xs[3], 40],
        [cx[3], 70],
        [151, 156],
        [cx[2], 70],
        [cx[1], 70],
      ],
      waypoints: [
        [cx[2], 156],
        [cx[1], 156],
      ],
      step: cx[1] - cx[0],
      half: 75,
      railOut: 30,
      railIn: 75,
    };
  }
  const col = Math.round(Math.min(240, width / 2));
  const x = 1 + col / 2;
  const tops = [10, 118, 226, 334];
  const cy = tops.map((t) => t + 28);
  const mw = width - col - 16;
  const rx = col + 15 + mw / 2;
  const rail = `M${p(x, cy[3])} L${p(rx - 18, cy[3])} Q${p(rx, cy[3])} ${p(rx, cy[3] - 18)} L${p(rx, cy[2])}`;
  return {
    wide: false,
    width,
    height: 391,
    chips: [...tops.map((y) => ({ x: 1, y, w: col, h: 56 })), { x: col + 15, y: 10, w: mw, h: 56 }],
    wires: [
      `M${p(x, cy[0])} L${p(x, cy[1])}`,
      `M${p(x, cy[1])} L${p(x, cy[2])}`,
      `M${p(x, cy[2])} L${p(x, cy[3])}`,
      rail,
      `M${p(rx, cy[2])} L${p(rx, cy[1])}`,
      `M${p(rx, cy[1])} L${p(rx, cy[0])}`,
    ],
    stubs: [`M${p(col + 1, cy[2])} L${p(rx - 4, cy[2])}`, `M${p(col + 1, cy[1])} L${p(rx - 4, cy[1])}`],
    top: `M${p(x, cy[0])} L${p(x, cy[1])} L${p(x, cy[2])} L${p(x, cy[3])}`,
    rail: `${rail} L${p(rx, cy[1])} L${p(rx, cy[0])}`,
    ports: [
      [x, 66],
      [x, 118],
      [x, 174],
      [x, 226],
      [x, 282],
      [x, 334],
      [col + 1, cy[3]],
      [rx, 66],
      [col + 1, cy[2]],
      [col + 1, cy[1]],
    ],
    waypoints: [
      [rx, cy[2]],
      [rx, cy[1]],
    ],
    step: 108,
    half: 28,
    railOut: col / 2,
    railIn: 28,
  };
}

function Mark({ node }: { node: PaymentFlowNode }) {
  const { icon, color } = node;
  if (typeof icon === "string") {
    if (/^(https?:|data:|\/|\.)/.test(icon)) {
      return (
        <span className={styles.mark} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" />
        </span>
      );
    }
    return (
      <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
        <path d={icon} fill={color ?? "currentColor"} />
      </svg>
    );
  }
  if (!isValidElement(icon) && !icon) return null;
  return (
    <span className={styles.mark} style={color ? { color } : undefined} aria-hidden="true">
      {icon}
    </span>
  );
}

interface Live {
  geo: Geometry | null;
  texts: string[][];
  money: (v: number) => string;
  amount: number;
  net: number;
  balance: number;
  authMs: number;
  target: number;
  reduced: boolean;
}

export function PaymentFlow({
  nodes,
  amount = 42.5,
  fee = 1.53,
  balance = 1284.1,
  currency = "USD",
  locale = "en-US",
  authorizationMs = 1340,
  labels,
  hideSteps = false,
  speed = 1,
  paused = false,
  accent,
  label,
  caption,
  className,
  style,
}: PaymentFlowProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState(false);

  const text = { ...DEFAULT_LABELS, ...labels };
  const list = KEYS.map((key) => ({ ...DEFAULT_NODES[key], ...nodes?.[key] }));
  const money = useMemo(() => {
    const format = new Intl.NumberFormat(locale, { style: "currency", currency });
    return (value: number) => format.format(value);
  }, [locale, currency]);
  const net = Math.round((amount - fee) * 100) / 100;
  const geo = useMemo(() => (width > 0 ? layout(width) : null), [width]);

  const texts = [
    [list[0].meta ?? "", "Card tapped", "Authorizing", text.approved],
    [list[1].meta ?? "", "Checking risk", "Risk checked", `Fee ${money(fee)}`],
    [list[2].meta ?? "", "Routing", "Routed to bank", "Clearing", "Cleared"],
    [list[3].meta ?? "", "Checking funds", text.approved, "Funds held", "Settling", "Settled"],
    [""],
  ];
  const textKey = texts.map((row) => row.join("\u0001")).join("\u0002");

  const description =
    label ??
    `Card payment flow. A ${money(amount)} card tap at ${list[0].label} goes to ${list[1].label}, then the ${list[2].label} network, then the issuing bank, which approves it and holds the funds. The approval travels back to ${list[0].label} in about ${(authorizationMs / 1000).toFixed(1)} seconds. At settlement the funds clear through ${list[2].label} and ${list[1].label}, which keeps a ${money(fee)} fee, and ${money(net)} reaches ${list[4].label.charAt(0).toLowerCase()}${list[4].label.slice(1)}.`;

  const live = useRef<Live>({
    geo: null,
    texts,
    money,
    amount,
    net,
    balance,
    authMs: authorizationMs,
    target: 1,
    reduced: false,
  });
  const engine = useRef<{ wake: () => void; paint: (fresh?: boolean) => void } | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.round(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const state = live.current;
    state.geo = geo;
    state.texts = textKey.split("\u0002").map((row) => row.split("\u0001"));
    state.money = money;
    state.amount = amount;
    state.net = net;
    state.balance = balance;
    state.authMs = authorizationMs;
    state.reduced = reduced;
    state.target = paused || reduced ? 0 : Math.max(0, speed) * (hovered ? 0.6 : 1);
    engine.current?.paint(true);
    engine.current?.wake();
  }, [geo, textKey, money, amount, net, balance, authorizationMs, reduced, paused, speed, hovered]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const state = live.current;
    let clock = 0;
    let rate = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    const cache = new Map<string, string>();

    const one = <T extends Element>(name: string) => root.querySelector<T>(`[data-pf="${name}"]`);
    const all = <T extends Element>(name: string) =>
      Array.from(root.querySelectorAll<T>(`[data-pf="${name}"]`));

    const put = (key: string, value: string, write: (value: string) => void) => {
      if (cache.get(key) === value) return;
      cache.set(key, value);
      write(value);
    };
    const attr = (el: Element | null | undefined, key: string, name: string, value: string) => {
      if (el) put(`${key}.${name}`, value, (v) => el.setAttribute(name, v));
    };
    const css = (
      el: HTMLElement | null | undefined,
      key: string,
      name: "opacity" | "transform",
      value: string,
    ) => {
      if (el) put(`${key}.${name}`, value, (v) => (el.style[name] = v));
    };
    const txt = (el: Element | null | undefined, key: string, value: string) => {
      if (el) put(`${key}.text`, value, (v) => (el.textContent = v));
    };

    const paint = (fresh?: boolean) => {
      if (fresh) cache.clear();
      const g = state.geo;
      if (!g) return;
      const loops = Math.floor(clock / PERIOD);
      const t = state.reduced ? STILL_AT : clock - loops * PERIOD;

      const topPath = one<SVGPathElement>("top");
      const okPath = one<SVGPathElement>("ok");
      const railPath = one<SVGPathElement>("rail");
      const pills = all<HTMLElement>("pill");
      if (!topPath || !railPath || pills.length < 4) return;
      const topLen = topPath.getTotalLength() || 1;
      const railLen = railPath.getTotalLength() || 1;
      const along = (index: number) =>
        g.wide ? pills[index].offsetWidth / 2 + EDGE : pills[index].offsetHeight / 2 + EDGE;
      const place = (index: number, path: SVGPathElement, s: number, opacity: number, scale = 1) => {
        const point = path.getPointAtLength(s);
        css(pills[index], `pill${index}`, "opacity", String(Math.round(opacity * 1000) / 1000));
        css(
          pills[index],
          `pill${index}`,
          "transform",
          `translate(${f2(point.x)}px, ${f2(point.y)}px) translate(-50%, -50%) scale(${Math.round(scale * 1000) / 1000})`,
        );
      };

      /* Authorization: the amount walks the chain, slipping under each node. */
      const a = along(0);
      let sAuth = g.half - a;
      let litTop = 0;
      if (t >= HOP_START) {
        const hop = Math.min(2, Math.floor((t - HOP_START) / HOP_GAP));
        const from = hop * g.step + g.half - a;
        const to = (hop + 1) * g.step - g.half + a;
        sAuth = from + (to - from) * sine((t - HOP_START - hop * HOP_GAP) / HOP_MS);
        litTop = t >= HOP_START + 2 * HOP_GAP + HOP_MS ? 1000 : (sAuth / topLen) * 1000;
      }
      const authOn = t >= HOP_START && t < HOP_START + 2 * HOP_GAP + HOP_MS;
      place(0, topPath, sAuth, authOn ? 1 : 0);

      /* Approval: travels back and repaints the path in success. */
      const b = along(1);
      let sBack = g.half - b;
      let okGap = 1000;
      if (t >= BACK_START) {
        const hop = Math.min(2, Math.floor((t - BACK_START) / BACK_GAP));
        const from = (3 - hop) * g.step - g.half + b;
        const to = (2 - hop) * g.step + g.half - b;
        sBack = from + (to - from) * sine((t - BACK_START - hop * BACK_GAP) / BACK_MS);
        okGap = t >= BACK_START + 2 * BACK_GAP + BACK_MS ? 0 : (sBack / topLen) * 1000;
      }
      const backOn = t >= BACK_START && t < BACK_START + 2 * BACK_GAP + BACK_MS - 20;
      place(1, topPath, sBack, backOn ? 1 : 0);

      const topFade = 1 - clamp((t - TOP_FADE) / 610);
      attr(topPath, "top", "opacity", t >= HOP_START ? topFade.toFixed(3) : "0");
      attr(topPath, "top", "stroke-dasharray", `${f2(litTop)} 2000`);
      attr(okPath, "ok", "opacity", t >= BACK_START ? topFade.toFixed(3) : "0");
      attr(okPath, "ok", "stroke-dasharray", `0 ${f2(okGap)} 1000 2000`);

      /* Settlement: gross to the processor waypoint, then the net amount to the balance. */
      const outAt = (g.wide ? g.railOut - pills[2].offsetHeight / 2 : g.railOut - pills[2].offsetWidth / 2) - EDGE;
      const wp0 = railLen - 2 * g.step;
      const wp1 = railLen - g.step;
      const inAt = railLen - g.railIn + (g.wide ? pills[3].offsetWidth / 2 : pills[3].offsetHeight / 2) + EDGE;
      let sGross = wp1;
      if (t >= SETTLE_AT && t < FEE_LEAVE) sGross = outAt + (wp0 - outAt) * sine((t - SETTLE_AT) / (CLEAR_AT - SETTLE_AT));
      else if (t >= FEE_LEAVE) sGross = wp0 + (wp1 - wp0) * sine((t - FEE_LEAVE) / (FEE_AT - FEE_LEAVE));
      const swap = smooth((t - SWAP_AT) / (SWAP_END - SWAP_AT));
      const grossOn = t >= SETTLE_AT && t < SWAP_END;
      place(2, railPath, sGross, grossOn ? 1 - swap : 0, grossOn ? 1 - 0.12 * swap : 0.88);
      let sNet = inAt;
      if (t >= SWAP_AT && t < PAID_AT) sNet = wp1 + (inAt - wp1) * sine((t - NET_LEAVE) / (NET_AT - NET_LEAVE));
      const netOn = t >= SWAP_AT && t < PAID_AT;
      place(3, railPath, sNet, netOn ? swap : 0, netOn ? 0.88 + 0.12 * swap : 1);

      let litRail = 0;
      if (t >= PAID_AT) litRail = 1000;
      else if (t >= SWAP_AT) litRail = (sNet / railLen) * 1000;
      else if (t >= SETTLE_AT) litRail = (sGross / railLen) * 1000;
      attr(railPath, "rail", "opacity", t >= SETTLE_AT ? (1 - clamp((t - UNLIT_AT) / 620)).toFixed(3) : "0");
      attr(railPath, "rail", "stroke-dasharray", `${f2(litRail)} 2000`);

      const lit = all<SVGElement>("lit");
      const cleared = t >= 9515 && t < UNLIT_AT;
      const taken = t >= 10735 && t < UNLIT_AT;
      lit.forEach((el, index) => attr(el, `lit${index}`, "data-lit", String(index % 2 === 0 ? cleared : taken)));

      /* Tap ripples around the checkout. */
      const first = g.chips[0];
      all<SVGRectElement>("tap").forEach((el, index) => {
        const p = clamp((t - index * 200) / 900);
        const grow = 16 * outCubic(p);
        const on = t >= index * 200 && p < 1 && !state.reduced;
        const key = `tap${index}`;
        attr(el, key, "opacity", on ? (0.45 * Math.min(1, p / 0.08) * Math.pow(1 - p, 1.6)).toFixed(3) : "0");
        attr(el, key, "x", f2(first.x - grow));
        attr(el, key, "y", f2(first.y - grow));
        attr(el, key, "width", f2(first.w + 2 * grow));
        attr(el, key, "height", f2(first.h + 2 * grow));
        attr(el, key, "rx", f2(16 + grow));
      });

      /* Approval badge on the checkout. */
      const badge = one<SVGGElement>("badge");
      const u = t - BADGE_AT;
      const shown = u >= 0 && t < 8400;
      const drop = shown ? 4 * Math.exp(-u / 430) * clamp(1 - u / 1500) : 0;
      attr(badge, "badge", "opacity", shown ? (clamp(u / 120) * (1 - clamp((t - 7940) / 460))).toFixed(3) : "0");
      attr(
        badge,
        "badge",
        "transform",
        `translate(${f2(first.x + first.w - 8)} ${f2(first.y - 3 + drop)}) scale(${(shown ? 0.5 + 0.5 * outBack(u / 470) : 1).toFixed(3)})`,
      );

      /* Node status lines. */
      const chips = all<HTMLElement>("chip");
      const lines = all<HTMLElement>("line");
      const paidBy = clamp((t - 12440) / 960);
      chips.forEach((chip, index) => {
        const beats = BEATS[index];
        let chipState: ChipState = "idle";
        let textIndex = 0;
        let near = Infinity;
        for (const [at, next, line] of beats) {
          if (t >= at) {
            chipState = next;
            textIndex = line;
          }
          const delta = t - at;
          const wrapped = delta > PERIOD / 2 ? delta - PERIOD : delta < -PERIOD / 2 ? delta + PERIOD : delta;
          if (Math.abs(wrapped) < Math.abs(near)) near = wrapped;
        }
        attr(chip, `chip${index}`, "data-state", chipState);
        if (index === 4) {
          const total = state.balance + state.net * (loops + (state.reduced ? 0 : sine(paidBy)));
          txt(lines[index], `line${index}`, state.money(Math.round(total * 100) / 100));
          return;
        }
        txt(lines[index], `line${index}`, state.texts[index][textIndex] ?? "");
        const fade = state.reduced ? 1 : near < 0 ? clamp(-near / 130) : clamp(near / 170);
        css(lines[index], `line${index}`, "opacity", String(Math.round(fade * 100) / 100));
      });

      /* Step row. */
      const steps = all<HTMLElement>("step");
      const fills = all<HTMLElement>("fill");
      const back = 1 - clamp((t - RESET_AT) / 400);
      const auth = t >= RESET_AT ? back : clamp((t - 594) / 6301);
      const settle = t >= RESET_AT ? back : clamp((t - 8445) / 4005);
      attr(steps[0], "step0", "data-state", t >= RESET_AT || t < 594 ? "idle" : t >= 6895 ? "done" : "active");
      attr(steps[1], "step1", "data-state", t >= RESET_AT || t < 8445 ? "idle" : t >= PAID_AT ? "done" : "active");
      css(fills[0], "fill0", "transform", `scaleX(${Math.round(auth * 10000) / 10000})`);
      css(fills[1], "fill1", "transform", `scaleX(${Math.round(settle * 10000) / 10000})`);
      const seconds = t >= RESET_AT ? 0 : (clamp((t - 594) / 6301) * state.authMs) / 1000;
      txt(one("authMeta"), "authMeta", `${seconds.toFixed(2)} s`);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(64, now - last);
      last = now;
      rate += (state.target - rate) * (1 - Math.exp(-dt / 140));
      if (Math.abs(state.target - rate) < 0.002) rate = state.target;
      clock += dt * rate;
      paint();
      if (visible && !document.hidden && (rate !== 0 || state.target !== 0)) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (frame || !visible || document.hidden) return;
      if (state.target === 0 && rate === 0) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    engine.current = { wake, paint };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", wake);
    paint();
    wake();
    return () => {
      engine.current = null;
      observer.disconnect();
      document.removeEventListener("visibilitychange", wake);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const rootStyle = { ...style, ...(accent ? { "--pf-accent": accent } : null) } as CSSProperties;

  return (
    <figure
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-layout={geo ? (geo.wide ? "wide" : "narrow") : undefined}
      data-ready={geo ? "true" : undefined}
    >
      <div className={styles.diagram} role="img" aria-label={description}>
        <div
          className={styles.stage}
          style={{ height: geo?.height ?? 187 }}
          onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          {geo ? (
            <>
              <svg
                className={styles.layer}
                viewBox={`0 0 ${geo.width} ${geo.height}`}
                width={geo.width}
                height={geo.height}
                aria-hidden="true"
              >
                {geo.wires.map((d, index) => (
                  <path key={index} className={styles.wire} d={d} />
                ))}
                {geo.stubs.map((d, index) => (
                  <path key={index} className={styles.stub} data-pf="lit" data-lit="false" d={d} />
                ))}
                <path className={styles.lit} data-pf="top" d={geo.top} pathLength={1000} opacity={0} strokeDasharray="0 2000" />
                <path className={styles.okLit} data-pf="ok" d={geo.top} pathLength={1000} opacity={0} strokeDasharray="0 1000 1000 2000" />
                <path className={styles.lit} data-pf="rail" d={geo.rail} pathLength={1000} opacity={0} strokeDasharray="0 2000" />
                {geo.ports.map(([cx, cy], index) => (
                  <circle key={index} className={styles.port} cx={cx} cy={cy} r={2.75} />
                ))}
                {geo.waypoints.map(([cx, cy], index) => (
                  <circle key={index} className={styles.waypoint} data-pf="lit" data-lit="false" cx={cx} cy={cy} r={4} />
                ))}
                <rect className={styles.tap} data-pf="tap" opacity={0} />
                <rect className={styles.tap} data-pf="tap" opacity={0} />
              </svg>
              <span className={styles.pill} data-pf="pill" style={{ opacity: 0 }}>
                {money(amount)}
              </span>
              <span className={styles.pill} data-pf="pill" data-tone="ok" style={{ opacity: 0 }}>
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.6 6.3 L5 8.6 L9.4 3.6" />
                </svg>
                {text.approved}
              </span>
              <span className={styles.pill} data-pf="pill" style={{ opacity: 0 }}>
                {money(amount)}
              </span>
              <span className={styles.pill} data-pf="pill" style={{ opacity: 0 }}>
                {money(net)}
              </span>
              {list.map((node, index) => {
                const box = geo.chips[index];
                const end = geo.wide ? index === 3 : index === 4;
                const start = geo.wide ? index === 0 || index === 4 : index < 4;
                const above = geo.wide ? index === 4 : index === 3;
                return (
                  <div
                    key={KEYS[index]}
                    className={styles.chip}
                    data-pf="chip"
                    data-state="idle"
                    data-edge={end ? "end" : start ? "start" : undefined}
                    style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                  >
                    <Mark node={node} />
                    <span className={styles.text}>
                      <span className={styles.label}>{node.label}</span>
                      <span className={styles.meta}>
                        <span className={styles.health} />
                        <span data-pf="line" />
                      </span>
                    </span>
                    {node.detail ? (
                      <span className={styles.tag} data-place={above ? "above" : "below"} aria-hidden="true">
                        {node.detail}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              <svg
                className={styles.layer}
                viewBox={`0 0 ${geo.width} ${geo.height}`}
                width={geo.width}
                height={geo.height}
                aria-hidden="true"
              >
                <g data-pf="badge" opacity={0}>
                  <circle className={styles.checkDisc} r={8} />
                  <path className={styles.checkGlyph} d="M-3.3 0.2 L-1 2.5 L3.4 -2" />
                </g>
              </svg>
            </>
          ) : null}
        </div>
        {hideSteps ? null : (
          <div className={styles.steps} aria-hidden="true">
            <div className={styles.step} data-pf="step" data-state="idle">
              <span className={styles.stepHead}>
                <span className={styles.stepLabel}>{text.authorization}</span>
                <span className={styles.stepMeta} data-pf="authMeta" />
              </span>
              <span className={styles.track}>
                <span className={styles.fill} data-pf="fill" style={{ transform: "scaleX(0)" }} />
              </span>
            </div>
            <div className={styles.step} data-pf="step" data-state="idle">
              <span className={styles.stepHead}>
                <span className={styles.stepLabel}>{text.settlement}</span>
                <span className={styles.stepMeta}>{text.settlementTime}</span>
              </span>
              <span className={styles.track}>
                <span className={styles.fill} data-pf="fill" style={{ transform: "scaleX(0)" }} />
              </span>
            </div>
          </div>
        )}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

export default PaymentFlow;
