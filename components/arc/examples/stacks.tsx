"use client";

import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Hand,
  MessageCircle,
  MousePointer2,
  Square,
  StickyNote,
  Type,
} from "lucide-react";
import { motionTokens, cx } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./stacks.module.css";

/* ------------------------------- Wallet stack ------------------------------- */

const wallets = [
  { name: "Fieldnote", kind: "Everyday debit", last4: "4821", tone: "linear-gradient(135deg,#1f3b73,#3d6fd6)" },
  { name: "Meridian", kind: "Reserve credit", last4: "0917", tone: "linear-gradient(135deg,#1b1b1f,#4a4a55)" },
  { name: "Tidewater", kind: "Transit pass", last4: "3306", tone: "linear-gradient(135deg,#0f6b5c,#3fb39a)" },
  { name: "Common Ground", kind: "Coffee club", last4: "7730", tone: "linear-gradient(135deg,#8a4b1f,#d9924d)" },
];

export function WalletStack() {
  const [order, setOrder] = useState(wallets.map((_, i) => i));
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();

  const bringToFront = (index: number) => {
    setOrder((o) => [index, ...o.filter((i) => i !== index)]);
    setExpanded(false);
  };

  return (
    <div className={styles.walletWrap}>
      <div
        className={styles.wallet}
        data-expanded={expanded || undefined}
        role="list"
        aria-label="Cards"
      >
        {order.map((cardIndex, depth) => {
          const card = wallets[cardIndex];
          const offset = expanded ? depth * 76 : depth * 18;
          return (
            <motion.button
              key={card.last4}
              role="listitem"
              type="button"
              className={styles.walletCard}
              style={{ background: card.tone, zIndex: wallets.length - depth }}
              aria-label={`${card.name} ${card.kind} ending in ${card.last4}${depth === 0 ? ", selected" : ""}`}
              aria-current={depth === 0 || undefined}
              animate={{
                y: offset,
                scale: expanded ? 1 : 1 - depth * 0.04,
                opacity: expanded || depth < 3 ? 1 : 0,
              }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
              whileHover={reduced || depth === 0 ? undefined : { y: offset - 6 }}
              onClick={() => (depth === 0 ? setExpanded((e) => !e) : bringToFront(cardIndex))}
            >
              <span className={styles.cardTop}>
                <strong>{card.name}</strong>
                <span>{card.kind}</span>
              </span>
              <span className={styles.cardBottom}>
                <span className={styles.chip} aria-hidden />
                <span>•••• {card.last4}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className={styles.hint}>{expanded ? "Pick a card" : "Tap the top card to fan out"}</p>
    </div>
  );
}

/* -------------------------------- Cover flow -------------------------------- */

const hikes = [
  { name: "Yosemite Valley loop", where: "California", hue: 32 },
  { name: "Lake Agnes Tea House", where: "Alberta", hue: 190 },
  { name: "Lago Limides", where: "Dolomites", hue: 160 },
  { name: "Seceda ridgeline", where: "South Tyrol", hue: 110 },
  { name: "Fjaðrárgljúfur rim", where: "Iceland", hue: 140 },
  { name: "Cape Nelson lighthouse", where: "Victoria", hue: 210 },
  { name: "Ocean Beach to Lands End", where: "San Francisco", hue: 20 },
];

export function CoverFlow() {
  const [index, setIndex] = useState(3);
  const reduced = useReducedMotion();
  const go = (n: number) => setIndex(Math.min(hikes.length - 1, Math.max(0, n)));

  const onKeyDown = (event: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: hikes.length - 1 };
    if (!(event.key in map)) return;
    event.preventDefault();
    go(map[event.key]);
  };

  return (
    <div className={styles.flow}>
      <p className={styles.flowTitle}>Hikes for this fall</p>
      <div
        className={styles.flowStage}
        role="group"
        aria-roledescription="carousel"
        aria-label="Hikes for this fall"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {hikes.map((hike, i) => {
          const d = i - index;
          const abs = Math.abs(d);
          return (
            <motion.button
              key={hike.name}
              type="button"
              tabIndex={-1}
              className={styles.flowCard}
              aria-hidden={d !== 0}
              style={{
                zIndex: 10 - abs,
                background: `linear-gradient(160deg, oklch(78% 0.1 ${hike.hue}), oklch(42% 0.09 ${hike.hue + 30}))`,
              }}
              animate={{
                x: d === 0 ? 0 : Math.sign(d) * (90 + abs * 46),
                rotateY: reduced ? 0 : d === 0 ? 0 : -Math.sign(d) * 48,
                scale: d === 0 ? 1 : 0.84,
                opacity: abs > 3 ? 0 : 1,
              }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
              drag={d === 0 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={(_, info) => {
                if (info.offset.x < -40) go(index + 1);
                if (info.offset.x > 40) go(index - 1);
              }}
              onClick={() => go(i)}
            >
              <span className={styles.flowCaption}>
                <strong>{hike.name}</strong>
                <span>{hike.where}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
      <div className={styles.flowControls}>
        <button type="button" aria-label="Previous hike" disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span aria-live="polite">
          {index + 1} of {hikes.length}
        </span>
        <button type="button" aria-label="Next hike" disabled={index === hikes.length - 1} onClick={() => go(index + 1)}>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------- Dock ----------------------------------- */

const tools = [
  { id: "move", label: "Move", key: "V", Icon: MousePointer2 },
  { id: "hand", label: "Hand", key: "H", Icon: Hand },
  { id: "rect", label: "Rectangle", key: "R", Icon: Square },
  { id: "text", label: "Text", key: "T", Icon: Type },
  { id: "note", label: "Sticky note", key: "N", Icon: StickyNote },
  { id: "comment", label: "Comment", key: "C", Icon: MessageCircle, badge: 3 },
];

const boardCards = [
  { x: 8, y: 12, r: -4, hue: 30, label: "Moodboard" },
  { x: 38, y: 6, r: 3, hue: 200, label: "Palette" },
  { x: 64, y: 18, r: -2, hue: 140, label: "References" },
];

export function Dock() {
  const [tool, setTool] = useState("move");
  const [hover, setHover] = useState<number | null>(null);
  const reduced = useReducedMotion();

  const onKeyDown = (event: KeyboardEvent) => {
    const match = tools.find((t) => t.key.toLowerCase() === event.key.toLowerCase());
    if (match) setTool(match.id);
  };

  return (
    <div className={styles.board} onKeyDown={onKeyDown} data-tool={tool}>
      {boardCards.map((card) => (
        <motion.div
          key={card.label}
          className={styles.boardCard}
          style={{
            left: `${card.x}%`,
            top: `${card.y}%`,
            rotate: card.r,
            background: `linear-gradient(150deg, oklch(82% 0.08 ${card.hue}), oklch(55% 0.1 ${card.hue + 40}))`,
          }}
          drag={tool === "move"}
          dragMomentum={false}
          whileDrag={{ scale: 1.04, rotate: 0 }}
        >
          <span>{card.label}</span>
        </motion.div>
      ))}
      <div className={styles.comment} style={{ left: "58%", top: "56%" }}>
        <span className={styles.avatar}>R</span>
        <p>Can we try the warmer palette here?</p>
      </div>
      <div
        className={styles.dock}
        role="toolbar"
        aria-label="Tools"
        onPointerLeave={() => setHover(null)}
      >
        {tools.map(({ id, label, key, Icon, badge }, i) => {
          const dist = hover === null ? 3 : Math.abs(hover - i);
          const scale = reduced ? 1 : [1.35, 1.15, 1.04][dist] ?? 1;
          return (
            <motion.button
              key={id}
              type="button"
              className={cx(styles.tool, tool === id && styles.toolActive)}
              aria-label={badge ? `${label}, ${key}, ${badge} unread` : `${label}, ${key}`}
              aria-pressed={tool === id}
              title={`${label} (${key})`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setTool(id)}
              animate={{ scale, y: scale > 1 ? -(scale - 1) * 20 : 0 }}
              transition={motionTokens.spring.responsive}
            >
              <Icon size={18} aria-hidden />
              {badge && <span className={styles.badge}>{badge}</span>}
              <AnimatePresence>
                {hover === i && (
                  <motion.span
                    className={styles.tip}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: motionTokens.duration.fast }}
                  >
                    {label} <kbd>{key}</kbd>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
