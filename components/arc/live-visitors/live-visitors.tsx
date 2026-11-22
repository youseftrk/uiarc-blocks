"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import styles from "./live-visitors.module.css";

export interface LivePage {
  path: string;
  visitors: number;
}

export interface LiveVisitorPing {
  id: string;
  lat: number;
  lon: number;
  kind?: "visit" | "event";
}

export interface LiveVisitorEvent {
  id: string;
  label: string;
  city: string;
  country: string;
  at: number;
  lat?: number;
  lon?: number;
  flag?: ReactNode;
}

export type LiveVisitorsConnection = "live" | "connecting" | "reconnecting";

export interface LiveVisitorsProps {
  count?: number;
  pages?: LivePage[];
  visitors?: LiveVisitorPing[];
  events?: LiveVisitorEvent[];
  connection?: LiveVisitorsConnection;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  hidePause?: boolean;
  label?: (count: number) => string;
  maxPages?: number;
  maxEvents?: number;
  title?: string;
  className?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  SE: "Sweden",
  CH: "Switzerland",
  JP: "Japan",
  IN: "India",
  BR: "Brazil",
};

function CountryFlag({ code, custom }: { code: string; custom?: ReactNode }) {
  if (custom) {
    return (
      <span className={styles.flag} aria-hidden="true">
        {custom}
      </span>
    );
  }
  const upper = code.toUpperCase();
  let svg: ReactNode = null;
  if (upper === "US") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="12" fill="#B22234" />
        <path d="M0 1.8h16M0 4.2h16M0 6.6h16M0 9h16M0 11.2h16" stroke="#fff" strokeWidth="1" />
        <rect width="7" height="6.5" fill="#3C3B6E" />
      </svg>
    );
  } else if (upper === "GB") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="12" fill="#012169" />
        <path d="M0 0L16 12M16 0L0 12" stroke="#fff" strokeWidth="2.2" />
        <path d="M0 0L16 12M16 0L0 12" stroke="#C8102E" strokeWidth="1" />
        <path d="M8 0v12M0 6h16" stroke="#fff" strokeWidth="3" />
        <path d="M8 0v12M0 6h16" stroke="#C8102E" strokeWidth="1.8" />
      </svg>
    );
  } else if (upper === "DE") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="4" fill="#111" />
        <rect y="4" width="16" height="4" fill="#DD0000" />
        <rect y="8" width="16" height="4" fill="#FFCE00" />
      </svg>
    );
  } else if (upper === "FR") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="5.33" height="12" fill="#002395" />
        <rect x="5.33" width="5.34" height="12" fill="#fff" />
        <rect x="10.67" width="5.33" height="12" fill="#ED2939" />
      </svg>
    );
  } else if (upper === "NL") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="4" fill="#AE1C28" />
        <rect y="4" width="16" height="4" fill="#fff" />
        <rect y="8" width="16" height="4" fill="#21468B" />
      </svg>
    );
  } else if (upper === "SE") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="12" fill="#006AA7" />
        <path d="M5.5 0v12M0 6h16" stroke="#FECC00" strokeWidth="2.2" />
      </svg>
    );
  } else if (upper === "CH") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="12" fill="#D52B1E" />
        <path d="M8 2.5v7M4.5 6h7" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  } else if (upper === "JP") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="12" fill="#fff" />
        <circle cx="8" cy="6" r="3.2" fill="#BC002D" />
      </svg>
    );
  } else if (upper === "IN") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="4" fill="#FF9933" />
        <rect y="4" width="16" height="4" fill="#fff" />
        <rect y="8" width="16" height="4" fill="#138808" />
        <circle cx="8" cy="6" r="1.4" fill="#000080" />
      </svg>
    );
  } else if (upper === "BR") {
    svg = (
      <svg viewBox="0 0 16 12">
        <rect width="16" height="12" fill="#009C3B" />
        <polygon points="8,1.5 14.5,6 8,10.5 1.5,6" fill="#FFDF00" />
        <circle cx="8" cy="6" r="2.2" fill="#002776" />
      </svg>
    );
  }

  return (
    <span
      className={styles.flag}
      data-flag={svg ? undefined : "none"}
      aria-hidden="true"
    >
      {svg}
    </span>
  );
}

// Equirectangular projection into 600 x 216 (lat clamped -55..72)
function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * 600;
  const clampedLat = Math.max(-55, Math.min(72, lat));
  const y = ((72 - clampedLat) / (72 - -55)) * 204 + 6;
  return { x, y };
}

// Coarse continent polygons (lon, lat) for generating the dotted world map once
const CONTINENT_BOXES: Array<Array<[number, number]>> = [
  // North America
  [
    [-166, 66], [-140, 69], [-115, 68], [-94, 62], [-76, 54],
    [-60, 46], [-72, 40], [-80, 26], [-96, 20], [-84, 10],
    [-104, 19], [-118, 32], [-125, 48], [-148, 60],
  ],
  // Greenland
  [
    [-52, 60], [-36, 66], [-22, 72], [-44, 72], [-58, 68],
  ],
  // South America
  [
    [-78, 10], [-60, 10], [-36, -6], [-39, -22], [-54, -34],
    [-66, -52], [-73, -46], [-71, -18], [-81, -4],
  ],
  // Europe
  [
    [-9, 37], [4, 44], [18, 40], [32, 46], [42, 66],
    [24, 69], [8, 62], [2, 52], [-8, 43],
  ],
  // Africa
  [
    [-16, 15], [-6, 35], [10, 36], [32, 31], [44, 11],
    [40, -10], [32, -26], [20, -34], [12, -16], [8, 4], [-12, 6],
  ],
  // Asia
  [
    [34, 42], [60, 68], [105, 70], [148, 66], [164, 58],
    [140, 44], [122, 30], [108, 12], [96, 16], [78, 8],
    [66, 24], [52, 24], [42, 16], [36, 32],
  ],
  // Japan
  [
    [130, 31], [144, 44], [141, 45], [129, 34],
  ],
  // Indonesia / SE Asia islands
  [
    [98, 4], [126, -6], [124, -9], [96, 1],
  ],
  // Australia
  [
    [114, -22], [132, -12], [152, -24], [148, -38], [134, -34], [116, -34],
  ],
];

function pointInPoly(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const WORLD_DOTS_PATH = (() => {
  const segs: string[] = [];
  const stepX = 8;
  const stepY = 7.5;
  for (let y = 10; y <= 206; y += stepY) {
    for (let x = 8; x <= 592; x += stepX) {
      const lon = (x / 600) * 360 - 180;
      const lat = 72 - ((y - 6) / 204) * 127;
      for (let p = 0; p < CONTINENT_BOXES.length; p++) {
        if (pointInPoly(lon, lat, CONTINENT_BOXES[p])) {
          segs.push(`M${x.toFixed(1)} ${y.toFixed(1)}h0.01`);
          break;
        }
      }
    }
  }
  return segs.join("");
})();

const SIM_CITIES = [
  { city: "San Francisco", country: "US", lat: 37.77, lon: -122.41 },
  { city: "New York", country: "US", lat: 40.71, lon: -74.01 },
  { city: "London", country: "GB", lat: 51.51, lon: -0.13 },
  { city: "Berlin", country: "DE", lat: 52.52, lon: 13.4 },
  { city: "Paris", country: "FR", lat: 48.86, lon: 2.35 },
  { city: "Amsterdam", country: "NL", lat: 52.37, lon: 4.9 },
  { city: "Stockholm", country: "SE", lat: 59.33, lon: 18.07 },
  { city: "Zurich", country: "CH", lat: 47.37, lon: 8.54 },
  { city: "Tokyo", country: "JP", lat: 35.68, lon: 139.69 },
  { city: "Bengaluru", country: "IN", lat: 12.97, lon: 77.59 },
  { city: "São Paulo", country: "BR", lat: -23.55, lon: -46.63 },
];

const SIM_EVENT_LABELS = [
  "Signed up",
  "Upgraded to Pro",
  "Started trial",
  "Invited teammate",
];

const INITIAL_PAGES: LivePage[] = [
  { path: "/pricing", visitors: 42 },
  { path: "/components", visitors: 35 },
  { path: "/docs/getting-started", visitors: 24 },
  { path: "/", visitors: 19 },
  { path: "/changelog", visitors: 8 },
];

const BASE_TIME = 1_760_000_000_000;

export function useLiveVisitorsSimulation(active = true) {
  const seedRef = useRef(17);
  const pingIdRef = useRef(1);
  const eventIdRef = useRef(10);

  const nextRand = useCallback(() => {
    seedRef.current = (seedRef.current * 1664525 + 1013904223) >>> 0;
    return seedRef.current / 4294967296;
  }, []);

  const [state, setState] = useState<{
    count: number;
    pages: LivePage[];
    visitors: LiveVisitorPing[];
    events: LiveVisitorEvent[];
  }>(() => ({
    count: 128,
    pages: INITIAL_PAGES,
    visitors: [
      { id: "init-1", lat: 51.51, lon: -0.13, kind: "visit" },
      { id: "init-2", lat: 37.77, lon: -122.41, kind: "visit" },
      { id: "init-3", lat: 35.68, lon: 139.69, kind: "visit" },
    ],
    events: [
      {
        id: "ev-1",
        label: "Upgraded to Pro",
        city: "Berlin",
        country: "DE",
        at: BASE_TIME - 12_000,
        lat: 52.52,
        lon: 13.4,
      },
      {
        id: "ev-2",
        label: "Signed up",
        city: "San Francisco",
        country: "US",
        at: BASE_TIME - 38_000,
        lat: 37.77,
        lon: -122.41,
      },
      {
        id: "ev-3",
        label: "Started trial",
        city: "London",
        country: "GB",
        at: BASE_TIME - 74_000,
        lat: 51.51,
        lon: -0.13,
      },
      {
        id: "ev-4",
        label: "Signed up",
        city: "Tokyo",
        country: "JP",
        at: BASE_TIME - 125_000,
        lat: 35.68,
        lon: 139.69,
      },
    ],
  }));

  useEffect(() => {
    // Anchor initial event timestamps to real clock once mounted
    const t = window.setTimeout(() => {
      const now = Date.now();
      setState((prev) => ({
        ...prev,
        events: prev.events.map((ev, i) => ({
          ...ev,
          at: now - (i * 28 + 12) * 1000,
        })),
      }));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!active) return;

    const arrivalTimer = window.setInterval(() => {
      const city = SIM_CITIES[Math.floor(nextRand() * SIM_CITIES.length)];
      const jitterLat = (nextRand() - 0.5) * 6;
      const jitterLon = (nextRand() - 0.5) * 8;
      const id = `v-${pingIdRef.current++}`;
      const delta = nextRand() > 0.48 ? 1 : -1;

      setState((prev) => {
        const nextCount = Math.max(96, Math.min(164, prev.count + delta));
        const pageIdx = Math.floor(nextRand() * prev.pages.length);
        const nextPages = prev.pages.map((p, i) =>
          i === pageIdx
            ? { ...p, visitors: Math.max(4, p.visitors + (nextRand() > 0.46 ? 2 : -1)) }
            : p,
        );
        const nextVisitors = [
          ...prev.visitors.slice(-8),
          {
            id,
            lat: city.lat + jitterLat,
            lon: city.lon + jitterLon,
            kind: "visit" as const,
          },
        ];
        return {
          ...prev,
          count: nextCount,
          pages: nextPages,
          visitors: nextVisitors,
        };
      });
    }, 600);

    const eventTimer = window.setInterval(() => {
      const city = SIM_CITIES[Math.floor(nextRand() * SIM_CITIES.length)];
      const label =
        SIM_EVENT_LABELS[Math.floor(nextRand() * SIM_EVENT_LABELS.length)];
      const id = `ev-${eventIdRef.current++}`;
      const now = Date.now();

      setState((prev) => ({
        ...prev,
        visitors: [
          ...prev.visitors.slice(-8),
          { id: `p-${id}`, lat: city.lat, lon: city.lon, kind: "event" },
        ],
        events: [
          {
            id,
            label,
            city: city.city,
            country: city.country,
            at: now,
            lat: city.lat,
            lon: city.lon,
          },
          ...prev.events.slice(0, 7),
        ],
      }));
    }, 2400);

    return () => {
      window.clearInterval(arrivalTimer);
      window.clearInterval(eventTimer);
    };
  }, [active, nextRand]);

  return state;
}

function RollingNumber({
  value,
  reduced,
}: {
  value: number;
  reduced: boolean;
}) {
  const formatted = Math.max(0, Math.round(value)).toLocaleString("en-US");
  const chars = formatted.split("");

  return (
    <span
      className={styles.rolling}
      data-reduced={reduced ? "" : undefined}
      aria-hidden="true"
    >
      {chars.map((ch, idx) => {
        const key = `${chars.length - idx}`;
        const n = Number(ch);
        if (Number.isNaN(n)) {
          return (
            <span key={`sep-${key}`} className={styles.digit}>
              {ch}
            </span>
          );
        }
        return (
          <span key={key} className={styles.digit}>
            <span className={styles.digitSizer}>0</span>
            <span className={styles.digitWindow}>
              <span
                className={styles.digitStrip}
                style={{ transform: `translateY(-${n * 10}%)` }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function formatAgeShort(at: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

function formatAgeWords(at: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  return min === 1 ? "1 minute ago" : `${min} minutes ago`;
}

const DEFAULT_LABEL = (n: number) =>
  n === 1 ? "person on the site now" : "people on the site now";

export function LiveVisitors({
  count,
  pages,
  visitors,
  events,
  connection = "live",
  paused: controlledPaused,
  defaultPaused = false,
  onPausedChange,
  hidePause = false,
  label = DEFAULT_LABEL,
  maxPages = 4,
  maxEvents = 4,
  title = "Live visitors",
  className,
}: LiveVisitorsProps) {
  const headingId = useId();
  const reduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLElement>(null);

  const [inView, setInView] = useState(true);
  const [uncontrolledPaused, setUncontrolledPaused] = useState(defaultPaused);
  const isPaused = controlledPaused ?? uncontrolledPaused;

  const isSimulated = count === undefined;
  const simActive = isSimulated && !isPaused && inView && connection === "live";
  const sim = useLiveVisitorsSimulation(simActive);

  const [now, setNow] = useState(() => BASE_TIME);
  const [announcement, setAnnouncement] = useState("");
  const [activeMapLabel, setActiveMapLabel] = useState<LiveVisitorEvent | null>(
    null,
  );
  const lastLabeledEventRef = useRef<string | null>(null);

  // Track visibility
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Live relative clock tick
  useEffect(() => {
    const syncId = window.setTimeout(() => setNow(Date.now()), 0);
    if (isPaused || !inView) {
      return () => window.clearTimeout(syncId);
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(syncId);
      window.clearInterval(id);
    };
  }, [isPaused, inView]);

  const liveData = useMemo(
    () =>
      isSimulated
        ? sim
        : {
            count: count ?? 0,
            pages: pages ?? [],
            visitors: visitors ?? [],
            events: events ?? [],
          },
    [count, events, isSimulated, pages, sim, visitors],
  );

  // Freeze snapshot while paused
  const [snapshot, setSnapshot] = useState(liveData);
  const displayData = isPaused ? snapshot : liveData;

  const togglePause = useCallback(() => {
    const next = !isPaused;
    if (next) setSnapshot(liveData);
    if (controlledPaused === undefined) setUncontrolledPaused(next);
    onPausedChange?.(next);
    setAnnouncement(
      next
        ? "Live updates paused"
        : isSimulated
          ? "Live updates resumed (simulated stream)"
          : "Live updates resumed",
    );
  }, [controlledPaused, isPaused, isSimulated, liveData, onPausedChange]);

  // Show map label for newest event with coordinates for 2s
  const newestEvent = displayData.events[0];
  useEffect(() => {
    if (
      !newestEvent ||
      newestEvent.lat === undefined ||
      newestEvent.lon === undefined ||
      newestEvent.id === lastLabeledEventRef.current
    ) {
      return;
    }
    lastLabeledEventRef.current = newestEvent.id;
    setActiveMapLabel(newestEvent);
    const t = window.setTimeout(() => {
      setActiveMapLabel((cur) => (cur?.id === newestEvent.id ? null : cur));
    }, 2000);
    return () => window.clearTimeout(t);
  }, [newestEvent]);

  const sortedPages = useMemo(
    () =>
      [...displayData.pages]
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, maxPages),
    [displayData.pages, maxPages],
  );
  const maxPageVisitors = Math.max(1, sortedPages[0]?.visitors ?? 1);
  const visibleEvents = useMemo(
    () => displayData.events.slice(0, maxEvents),
    [displayData.events, maxEvents],
  );

  const effectiveState: "live" | "paused" | "connecting" | "reconnecting" =
    isPaused ? "paused" : connection;
  const isActive = effectiveState === "live" && inView;
  const isConnecting = effectiveState === "connecting";

  const rowHeight = 36;
  const pagesHeight = Math.max(1, maxPages) * rowHeight;
  const eventsHeight = Math.max(1, maxEvents) * rowHeight;

  const labelCoords =
    activeMapLabel &&
    activeMapLabel.lat !== undefined &&
    activeMapLabel.lon !== undefined
      ? project(activeMapLabel.lat, activeMapLabel.lon)
      : null;

  return (
    <section
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      aria-labelledby={headingId}
      data-active={isActive ? "" : undefined}
    >
      <h2 id={headingId} className={styles.srOnly}>
        {title}
      </h2>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <header className={styles.head}>
        <div className={styles.headText}>
          <div className={styles.status} data-state={effectiveState}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.stateStack}>
              <span
                className={styles.stateLabel}
                data-on={effectiveState === "live" ? "" : undefined}
                aria-hidden={effectiveState !== "live"}
              >
                Live
              </span>
              <span
                className={styles.stateLabel}
                data-on={effectiveState === "paused" ? "" : undefined}
                aria-hidden={effectiveState !== "paused"}
              >
                Paused
              </span>
              <span
                className={styles.stateLabel}
                data-on={effectiveState === "connecting" ? "" : undefined}
                aria-hidden={effectiveState !== "connecting"}
              >
                Connecting
              </span>
              <span
                className={styles.stateLabel}
                data-on={effectiveState === "reconnecting" ? "" : undefined}
                aria-hidden={effectiveState !== "reconnecting"}
              >
                Reconnecting
              </span>
            </span>
          </div>

          <p className={styles.countRow}>
            <span
              className={styles.count}
              data-pending={isConnecting ? "" : undefined}
            >
              <span className={styles.srOnly}>
                {isConnecting
                  ? "Connecting"
                  : `${displayData.count} ${label(displayData.count)}`}
              </span>
              <RollingNumber value={displayData.count} reduced={reduced} />
              <span className={styles.countSkeleton} aria-hidden="true" />
            </span>
            <span className={styles.countLabel} aria-hidden="true">
              {label(displayData.count)}
            </span>
          </p>
        </div>

        {!hidePause && (
          <div className={styles.headActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-pressed={isPaused}
              aria-label={isPaused ? "Resume live updates" : "Pause live updates"}
              title={isPaused ? "Resume live updates" : "Pause live updates"}
              onClick={togglePause}
            >
              {isPaused ? (
                <Play size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Pause size={14} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </header>

      <div className={styles.map} aria-hidden="true">
        <svg className={styles.mapSvg} viewBox="0 0 600 216">
          <path className={styles.land} d={WORLD_DOTS_PATH} />
          {!isConnecting &&
            displayData.visitors.map((v) => {
              const { x, y } = project(v.lat, v.lon);
              const strong = v.kind === "event";
              return (
                <g key={v.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={strong ? 4 : 3}
                    className={strong ? styles.ringStrong : styles.ring}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={strong ? 3.2 : 2.2}
                    className={strong ? styles.pingStrong : styles.ping}
                  />
                </g>
              );
            })}
        </svg>

        {!isConnecting && labelCoords && activeMapLabel && (
          <div
            className={styles.mapLabel}
            style={{
              left: `${(labelCoords.x / 600) * 100}%`,
              top: `${(labelCoords.y / 216) * 100}%`,
            }}
          >
            <div
              className={styles.mapLabelInner}
              data-align={
                labelCoords.x < 120
                  ? "start"
                  : labelCoords.x > 480
                    ? "end"
                    : "center"
              }
            >
              <CountryFlag
                code={activeMapLabel.country}
                custom={activeMapLabel.flag}
              />
              <span>
                {activeMapLabel.label} · {activeMapLabel.city}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.lists}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Top pages</h3>
            <span className={styles.meta}>Active</span>
          </div>
          <ul className={styles.rows} style={{ height: pagesHeight }}>
            {isConnecting ? (
              Array.from({ length: maxPages }).map((_, i) => (
                <li
                  key={i}
                  className={styles.skeletonRow}
                  style={{ transform: `translateY(${i * rowHeight}px)` }}
                >
                  <span
                    className={styles.skeletonLine}
                    style={{ width: `${65 - i * 10}%` }}
                  />
                </li>
              ))
            ) : sortedPages.length === 0 ? (
              <li className={styles.empty} style={{ height: pagesHeight }}>
                No active pages
              </li>
            ) : (
              sortedPages.map((page, i) => {
                const pct = (page.visitors / maxPageVisitors) * 100;
                return (
                  <li
                    key={page.path}
                    className={styles.pageRow}
                    style={{ transform: `translateY(${i * rowHeight}px)` }}
                  >
                    <span
                      className={styles.bar}
                      style={{ width: `${pct.toFixed(1)}%` }}
                      aria-hidden="true"
                    />
                    <span className={styles.path}>{page.path}</span>
                    <span className={styles.value}>{page.visitors}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Recent activity</h3>
            <span className={styles.meta}>
              {isSimulated ? "Simulated" : "Live"}
            </span>
          </div>
          <ul className={styles.rows} style={{ height: eventsHeight }}>
            {isConnecting ? (
              Array.from({ length: maxEvents }).map((_, i) => (
                <li
                  key={i}
                  className={styles.skeletonRow}
                  style={{ transform: `translateY(${i * rowHeight}px)` }}
                >
                  <span className={styles.skeletonFlag} />
                  <span
                    className={styles.skeletonLine}
                    style={{ width: `${70 - i * 8}%` }}
                  />
                </li>
              ))
            ) : visibleEvents.length === 0 ? (
              <li className={styles.empty} style={{ height: eventsHeight }}>
                No recent events
              </li>
            ) : (
              visibleEvents.map((ev, i) => {
                const countryName =
                  COUNTRY_NAMES[ev.country.toUpperCase()] ?? ev.country;
                return (
                  <li
                    key={ev.id}
                    className={styles.eventRow}
                    data-enter=""
                    style={{ transform: `translateY(${i * rowHeight}px)` }}
                  >
                    <CountryFlag code={ev.country} custom={ev.flag} />
                    <span className={styles.srOnly}>
                      {`${ev.label}, ${ev.city}, ${countryName}, ${formatAgeWords(ev.at, now)}`}
                    </span>
                    <span className={styles.eventText} aria-hidden="true">
                      <span className={styles.eventLabel}>{ev.label}</span>
                      <span className={styles.eventPlace}>{ev.city}</span>
                    </span>
                    <span className={styles.time} aria-hidden="true">
                      {formatAgeShort(ev.at, now)}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default LiveVisitors;
