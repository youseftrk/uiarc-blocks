"use client";

import { useState } from "react";
import {
  Copy,
  Download,
  FolderInput,
  Heart,
  Link2,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { GlassMenu, type GlassMenuGroup } from "./glass-menu";
import styles from "./glass-menu.module.css";

const POOL_HOUSE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#87bde0"/>
        <stop offset="100%" stop-color="#d8eaf5"/>
      </linearGradient>
      <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f7f4ee"/>
        <stop offset="100%" stop-color="#e3ddd2"/>
      </linearGradient>
      <linearGradient id="pool" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2ea5c9"/>
        <stop offset="55%" stop-color="#1b7ea1"/>
        <stop offset="100%" stop-color="#115c7a"/>
      </linearGradient>
      <linearGradient id="deck" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ddd3c5"/>
        <stop offset="100%" stop-color="#c6baa9"/>
      </linearGradient>
    </defs>
    <rect width="800" height="240" fill="url(#sky)"/>
    <rect y="200" width="800" height="190" fill="url(#deck)"/>
    <rect x="70" y="95" width="460" height="185" fill="url(#wall)"/>
    <rect x="52" y="84" width="496" height="18" fill="#d3cbc0"/>
    <rect x="112" y="138" width="160" height="142" fill="#2c3e48"/>
    <rect x="122" y="146" width="140" height="128" fill="#6f9bb2" opacity="0.55"/>
    <rect x="302" y="138" width="180" height="142" fill="#243540"/>
    <rect x="312" y="146" width="160" height="128" fill="#89b1c6" opacity="0.5"/>
    <polygon points="0,335 800,335 800,560 0,560" fill="url(#pool)"/>
    <path d="M0 368 Q180 358 380 370 T800 364" stroke="#ffffff" stroke-opacity="0.22" stroke-width="4" fill="none"/>
    <path d="M0 422 Q220 412 440 426 T800 418" stroke="#ffffff" stroke-opacity="0.16" stroke-width="3" fill="none"/>
    <path d="M0 482 Q200 472 410 486 T800 478" stroke="#ffffff" stroke-opacity="0.14" stroke-width="3" fill="none"/>
    <ellipse cx="670" cy="230" rx="88" ry="125" fill="#4f7c54"/>
    <ellipse cx="720" cy="255" rx="70" ry="100" fill="#3f6944"/>
  </svg>`,
)}`;

export default function GlassMenuDemo() {
  const reduced = useReducedMotion() ?? false;
  const [favorite, setFavorite] = useState(true);
  const [folder, setFolder] = useState("lisbon");
  const [deleted, setDeleted] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const groups: GlassMenuGroup[] = [
    {
      id: "quick",
      items: [
        {
          id: "favorite",
          label: "Favorite",
          icon: <Heart size={16} strokeWidth={1.75} />,
          shortcut: "F",
          checked: favorite,
          keepOpen: true,
        },
        {
          id: "copy-link",
          label: "Copy link",
          icon: <Link2 size={16} strokeWidth={1.75} />,
          shortcut: "⌘L",
        },
        {
          id: "duplicate",
          label: "Duplicate",
          icon: <Copy size={16} strokeWidth={1.75} />,
          shortcut: "⌘D",
        },
        {
          id: "move",
          label: "Move to",
          icon: <FolderInput size={16} strokeWidth={1.75} />,
          items: [
            { id: "lisbon", label: "Lisbon trip", checked: folder === "lisbon" },
            { id: "favorites", label: "Favorites", checked: folder === "favorites" },
            { id: "archive", label: "Archive", checked: folder === "archive" },
          ],
        },
        {
          id: "download",
          label: "Download",
          icon: <Download size={16} strokeWidth={1.75} />,
          shortcut: "⇧⌘S",
        },
      ],
    },
    {
      id: "danger",
      items: [
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 size={16} strokeWidth={1.75} />,
          shortcut: "⌫",
          danger: true,
        },
      ],
    },
  ];

  const handleSelect = (id: string) => {
    if (id === "favorite") {
      setFavorite((f) => !f);
      return;
    }
    if (id === "lisbon" || id === "favorites" || id === "archive") {
      setFolder(id);
      setStatusNote(
        `Moved to ${id === "lisbon" ? "Lisbon trip" : id === "favorites" ? "Favorites" : "Archive"}`,
      );
      return;
    }
    if (id === "copy-link") {
      setStatusNote("Link copied");
      return;
    }
    if (id === "duplicate") {
      setStatusNote("Duplicated photo");
      return;
    }
    if (id === "download") {
      setStatusNote("Downloading original");
      return;
    }
    if (id === "delete") {
      setDeleted(true);
      setStatusNote("Moved to trash");
    }
  };

  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={POOL_HOUSE_SVG}
          alt="Sunlit pool house overlooking turquoise water"
          className={styles.image}
          data-deleted={deleted ? "" : undefined}
          draggable={false}
        />

        <div className={styles.top}>
          <GlassMenu
            label="Photo actions"
            groups={groups}
            onSelect={handleSelect}
          >
            Pool house
          </GlassMenu>

          <AnimatePresence>
            {favorite && (
              <motion.span
                className={styles.badge}
                aria-label="Favorited"
                initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
              >
                <Heart size={18} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.bottom}>
          <AnimatePresence>
            {statusNote && (
              <motion.div
                key={statusNote}
                className={styles.note}
                role="status"
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <span>{statusNote}</span>
                {deleted && (
                  <button
                    type="button"
                    className={styles.undo}
                    onClick={() => {
                      setDeleted(false);
                      setStatusNote(null);
                    }}
                  >
                    Undo
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
