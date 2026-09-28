"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  BellOff,
  Bookmark,
  Download,
  FolderPlus,
  Heart,
  Home,
  Inbox,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Presentation,
  Send,
  SkipForward,
  Trash2,
  Type,
  User,
  Volume2,
} from "lucide-react";
import { motionTokens, cx } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./widgets.module.css";

/* --------------------------------- Voice orb -------------------------------- */

type VoiceState = "idle" | "listening" | "thinking" | "speaking";
const voiceCopy: Record<VoiceState, string> = {
  idle: "Voice assistant is idle",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
};

export function VoiceOrb() {
  const [state, setState] = useState<VoiceState>("idle");
  const reduced = useReducedMotion();

  useEffect(() => {
    if (state === "idle") return;
    const next: Record<VoiceState, VoiceState> = {
      idle: "idle",
      listening: "thinking",
      thinking: "speaking",
      speaking: "listening",
    };
    const timer = window.setTimeout(() => setState(next[state]), state === "thinking" ? 1400 : 2600);
    return () => window.clearTimeout(timer);
  }, [state]);

  const active = state !== "idle";
  const pulse = reduced
    ? {}
    : state === "listening"
      ? { scale: [1, 1.08, 0.97, 1.05, 1] }
      : state === "speaking"
        ? { scale: [1, 1.12, 1, 1.1, 1] }
        : state === "thinking"
          ? { rotate: 360 }
          : { scale: [1, 1.02, 1] };

  return (
    <div className={styles.voice}>
      <motion.div
        className={styles.orb}
        data-state={state}
        animate={pulse}
        transition={
          state === "thinking"
            ? { duration: 2.4, repeat: Infinity, ease: "linear" }
            : { duration: state === "idle" ? 4 : 1.6, repeat: Infinity, ease: "easeInOut" }
        }
        aria-hidden
      >
        <span className={styles.orbGlow} />
      </motion.div>
      <p className={styles.voiceState} role="status">
        {voiceCopy[state]}
      </p>
      <button
        type="button"
        className={cx(styles.voiceButton, active && styles.voiceButtonActive)}
        onClick={() => setState(active ? "idle" : "listening")}
      >
        {active ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
        {active ? "End voice chat" : "Start voice chat"}
      </button>
    </div>
  );
}

/* ------------------------------ Liquid tab bar ------------------------------ */

const tabs = [
  { id: "home", label: "Home", Icon: Home },
  { id: "saved", label: "Saved", Icon: Bookmark },
  { id: "inbox", label: "Inbox", Icon: Inbox, unread: 2 },
  { id: "profile", label: "Profile", Icon: User },
];

const tabContent: Record<string, string[]> = {
  home: ["Lisbon · Oct 12–18", "Kyoto · Nov 3–10"],
  saved: ["Alfama walking tour", "Fushimi Inari at dawn", "Tram 28"],
  inbox: ["Ryan shared an itinerary", "Check-in opens tomorrow"],
  profile: ["12 trips", "38 saved places"],
};

export function LiquidTabBar() {
  const [tab, setTab] = useState("home");
  const reduced = useReducedMotion();
  return (
    <div className={styles.phone}>
      <p className={styles.phoneTitle}>Trip planner</p>
      <div className={styles.phoneBody}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.ul
            key={tab}
            className={styles.phoneList}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={motionTokens.spring.smooth}
          >
            {tabContent[tab].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
      <div className={styles.tabBar} role="tablist" aria-label="Trip planner">
        {tabs.map(({ id, label, Icon, unread }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-label={unread ? `${label}, ${unread} unread` : label}
            className={styles.tab}
            onClick={() => setTab(id)}
          >
            {tab === id && (
              <motion.span
                layoutId="liquid-pill"
                className={styles.tabPill}
                transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
              />
            )}
            <span className={styles.tabIcon}>
              <Icon size={18} aria-hidden />
              {unread && <span className={styles.unread}>{unread}</span>}
            </span>
            <span className={styles.tabLabel}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Orbit menu -------------------------------- */

const orbitActions = [
  { label: "Like", Icon: Heart },
  { label: "Add to album", Icon: FolderPlus },
  { label: "Share with Ryan", Icon: Send },
  { label: "Download", Icon: Download },
  { label: "Delete", Icon: Trash2, danger: true },
];

export function OrbitMenu() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(null), 1600);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <div
      className={styles.orbit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className={styles.photo}>
        <span className={styles.photoCaption}>Hut below Śnieżka</span>
        <button
          ref={trigger}
          type="button"
          className={styles.orbitTrigger}
          aria-label="Photo actions"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={motionTokens.spring.snappy}>
            <MoreHorizontal size={18} aria-hidden />
          </motion.span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div className={styles.orbitRing} role="menu" aria-label="Photo actions">
              {orbitActions.map(({ label, Icon, danger }, i) => {
                const angle = (-90 - 180 + (i / (orbitActions.length - 1)) * 180) * (Math.PI / 180);
                const r = 78;
                return (
                  <motion.button
                    key={label}
                    type="button"
                    role="menuitem"
                    aria-label={label}
                    title={label}
                    className={cx(styles.orbitItem, danger && styles.orbitDanger)}
                    initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                    animate={{ x: Math.cos(angle) * r, y: Math.sin(angle) * r, scale: 1, opacity: 1 }}
                    exit={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { ...motionTokens.spring.morph, delay: i * motionTokens.stagger.item }
                    }
                    onClick={() => {
                      setDone(label);
                      setOpen(false);
                      trigger.current?.focus();
                    }}
                  >
                    <Icon size={16} aria-hidden />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className={styles.orbitStatus} role="status">
        {done ? `${done} — done` : "\u00a0"}
      </p>
    </div>
  );
}

/* ------------------------------ Control center ------------------------------ */

function CcTile({
  on,
  toggle,
  label,
  detail,
  Icon,
}: {
  on: boolean;
  toggle: () => void;
  label: string;
  detail: string;
  Icon: typeof Moon;
}) {
  return (
    <button type="button" aria-pressed={on} className={styles.ccTile} onClick={toggle}>
      <span className={styles.ccIcon}>
        <Icon size={16} aria-hidden />
      </span>
      <span className={styles.ccText}>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}

export function ControlCenter() {
  const [focus, setFocus] = useState(true);
  const [notify, setNotify] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [volume, setVolume] = useState(60);
  const [textSize, setTextSize] = useState(2);

  return (
    <div className={styles.cc} role="group" aria-label="Workspace quick settings">
      <CcTile on={focus} toggle={() => setFocus(!focus)} label="Focus" detail={focus ? "Until 3:00 PM" : "Off"} Icon={Moon} />
      <CcTile
        on={notify}
        toggle={() => setNotify(!notify)}
        label="Notifications"
        detail={notify ? "On" : "Muted"}
        Icon={notify ? Bell : BellOff}
      />
      <CcTile
        on={presenting}
        toggle={() => setPresenting(!presenting)}
        label="Presenting"
        detail={presenting ? "Sharing screen" : "Not sharing"}
        Icon={Presentation}
      />
      <label className={styles.ccSlider}>
        <span className={styles.ccSliderHead}>
          <Volume2 size={14} aria-hidden /> Volume
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          style={{ "--fill": `${volume}%` } as CSSProperties}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>
      <div className={styles.ccSize} role="radiogroup" aria-label="Text size">
        <Type size={12} aria-hidden />
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={textSize === n}
            aria-label={`Text size ${n}`}
            onClick={() => setTextSize(n)}
          >
            <span style={{ height: 6 + n * 3 }} />
          </button>
        ))}
        <Type size={18} aria-hidden />
      </div>
    </div>
  );
}

/* ------------------------------ Activity rings ------------------------------ */

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dates = ["September 14", "September 15", "September 16", "September 17", "September 18", "September 19", "September 20"];
const fullDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const goals = [
  { name: "Deep work", unit: "min", goal: 180, color: "var(--accent)" },
  { name: "Writing", unit: "words", goal: 1200, color: "oklch(70% 0.17 150)" },
  { name: "Reading", unit: "pages", goal: 40, color: "oklch(72% 0.16 60)" },
];
const week = [
  [95, 400, 12],
  [160, 1250, 30],
  [120, 700, 18],
  [180, 1100, 41],
  [60, 300, 8],
  [40, 900, 35],
  [130, 940, 22],
];

export function ActivityRings() {
  const [day, setDay] = useState(6);
  const [resetKey, setResetKey] = useState(0);
  const reduced = useReducedMotion();
  const values = week[day];
  const pct = values.map((v, i) => Math.min(1, v / goals[i].goal));

  return (
    <div className={styles.rings}>
      <div className={styles.ringsHead}>
        <p>Goals this week</p>
        <button type="button" onClick={() => { setDay(6); setResetKey((k) => k + 1); }}>
          Reset week
        </button>
      </div>
      <div className={styles.ringsBody}>
        <svg viewBox="0 0 120 120" className={styles.ringSvg} role="img" aria-label={goals.map((g, i) => `${g.name}: ${values[i].toLocaleString("en-US")} of ${g.goal.toLocaleString("en-US")} ${g.unit}, ${Math.round(pct[i] * 100)} percent`).join("; ")}>
          {goals.map((g, i) => {
            const r = 50 - i * 14;
            const c = 2 * Math.PI * r;
            return (
              <g key={g.name} transform="rotate(-90 60 60)">
                <circle cx={60} cy={60} r={r} className={styles.ringTrack} />
                <motion.circle
                  key={resetKey}
                  cx={60}
                  cy={60}
                  r={r}
                  stroke={g.color}
                  className={styles.ringValue}
                  strokeDasharray={c}
                  initial={{ strokeDashoffset: c }}
                  animate={{ strokeDashoffset: c * (1 - pct[i]) }}
                  transition={reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: i * 0.06 }}
                />
              </g>
            );
          })}
        </svg>
        <div className={styles.ringLegend}>
          <p className={styles.ringDate}>
            {fullDays[day]}, {dates[day]}
          </p>
          {goals.map((g, i) => (
            <p key={g.name}>
              <i style={{ background: g.color }} /> {g.name}
              <strong>{Math.round(pct[i] * 100)}%</strong>
            </p>
          ))}
        </div>
      </div>
      <div className={styles.days} role="radiogroup" aria-label="Day">
        {days.map((d, i) => (
          <button key={d} type="button" role="radio" aria-checked={day === i} aria-label={fullDays[i]} onClick={() => setDay(i)}>
            {d.slice(0, 1)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Now playing ------------------------------- */

const DURATION = 214;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function NowPlaying() {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [time, setTime] = useState(48);
  const [track, setTrack] = useState(0);
  const reduced = useReducedMotion();
  const tracks = [
    { title: "Undertow", artist: "Hollis Reed", hue: 250 },
    { title: "Low Tide Lights", artist: "Hollis Reed", hue: 20 },
  ];
  const current = tracks[track];

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setTime((s) => (s + 1) % DURATION), 1000);
    return () => window.clearInterval(t);
  }, [playing]);

  return (
    <motion.div
      layout={!reduced}
      className={cx(styles.player, expanded && styles.playerExpanded)}
      transition={motionTokens.spring.morph}
    >
      <motion.div
        layout={!reduced}
        className={styles.art}
        style={{ background: `linear-gradient(140deg, oklch(70% 0.14 ${current.hue}), oklch(35% 0.12 ${current.hue + 40}))` }}
        animate={{ scale: playing || reduced ? 1 : 0.94 }}
        transition={motionTokens.spring.morph}
      />
      <motion.div layout={!reduced} className={styles.meta}>
        <strong>{current.title}</strong>
        <span>{current.artist}</span>
      </motion.div>
      {expanded && (
        <motion.div
          className={styles.progress}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <span className={styles.bar}>
            <span style={{ width: `${(time / DURATION) * 100}%` }} />
          </span>
          <span className={styles.times}>
            <span>{fmt(time)}</span>
            <span>−{fmt(DURATION - time)}</span>
          </span>
        </motion.div>
      )}
      <motion.div layout={!reduced} className={styles.controls}>
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
        <button
          type="button"
          aria-label="Next track"
          onClick={() => {
            setTrack((t) => (t + 1) % tracks.length);
            setTime(0);
          }}
        >
          <SkipForward size={18} aria-hidden />
        </button>
        <button type="button" aria-label={expanded ? "Collapse player" : "Expand player"} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
        </button>
      </motion.div>
    </motion.div>
  );
}
