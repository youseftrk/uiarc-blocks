"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PhotoGrid, type PhotoGridPhoto } from "./photo-grid";
import styles from "./demo.module.css";

type Scene = "street" | "house" | "palms" | "joshua" | "motel";

interface Shot {
  id: string;
  title: string;
  detail: string;
  alt: string;
  width: number;
  height: number;
  scene: Scene;
  sky: [string, string];
  ground: string;
  hills: string;
  ink: string;
  sun?: string;
}

function palm(x: number, base: number, top: number, s: number, ink: string) {
  const fronds = [-150, -115, -80, -45, -10, 25, 60]
    .map((deg) => {
      const r = (deg * Math.PI) / 180;
      const ex = x + Math.cos(r) * s * 1.1;
      const ey = top + Math.sin(r) * s * 0.55 + s * 0.35;
      return `<path d="M${x} ${top} Q${(x + ex) / 2} ${top - s * 0.45} ${ex} ${ey}" stroke="${ink}" stroke-width="${s * 0.16}" fill="none" stroke-linecap="round"/>`;
    })
    .join("");
  return `<path d="M${x} ${base} Q${x + s * 0.12} ${(base + top) / 2} ${x} ${top}" stroke="${ink}" stroke-width="${s * 0.11}" fill="none" stroke-linecap="round"/>${fronds}`;
}

function joshua(x: number, base: number, s: number, ink: string) {
  const arm = (x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${ink}" stroke-width="${s * 0.09}" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="${s * 0.13}" fill="${ink}"/>`;
  const y = base - s;
  return (
    `<path d="M${x} ${base} L${x} ${y + s * 0.45}" stroke="${ink}" stroke-width="${s * 0.12}" stroke-linecap="round"/>` +
    arm(x, y + s * 0.5, x - s * 0.34, y + s * 0.12) +
    arm(x, y + s * 0.5, x + s * 0.3, y + s * 0.2) +
    arm(x, y + s * 0.55, x + s * 0.04, y) +
    arm(x - s * 0.17, y + s * 0.3, x - s * 0.5, y + s * 0.34) +
    arm(x + s * 0.15, y + s * 0.34, x + s * 0.52, y + s * 0.02)
  );
}

function paint(shot: Shot) {
  const { width: w, height: h, sky, ground, hills, ink, sun, scene } = shot;
  const u = Math.min(w, h);
  const horizon = h * 0.7;
  let body = "";
  if (sun) body += `<circle cx="${w * 0.68}" cy="${horizon - u * 0.1}" r="${u * 0.09}" fill="${sun}"/>`;
  body += `<path d="M0 ${horizon} L${w * 0.16} ${horizon - u * 0.2} L${w * 0.3} ${horizon - u * 0.1} L${w * 0.5} ${horizon - u * 0.27} L${w * 0.7} ${horizon - u * 0.12} L${w * 0.86} ${horizon - u * 0.22} L${w} ${horizon - u * 0.08} L${w} ${horizon} Z" fill="${hills}"/>`;
  body += `<rect y="${horizon}" width="${w}" height="${h - horizon}" fill="${ground}"/>`;
  if (scene === "street") {
    body += `<path d="M${w * 0.44} ${horizon} L${w * 0.56} ${horizon} L${w * 0.92} ${h} L${w * 0.08} ${h} Z" fill="${ink}" opacity="0.5"/>`;
    body += palm(w * 0.2, horizon + u * 0.12, horizon - u * 0.42, u * 0.16, ink) + palm(w * 0.82, horizon + u * 0.1, horizon - u * 0.5, u * 0.17, ink);
    body += palm(w * 0.36, horizon + u * 0.02, horizon - u * 0.24, u * 0.09, ink) + palm(w * 0.66, horizon + u * 0.02, horizon - u * 0.28, u * 0.09, ink);
  } else if (scene === "house" || scene === "motel") {
    const hw = w * (scene === "motel" ? 0.78 : 0.62);
    const hx = (w - hw) / 2;
    const hh = u * 0.17;
    body += `<rect x="${hx}" y="${horizon - hh + u * 0.04}" width="${hw}" height="${hh}" fill="#f6f1e8"/>`;
    body += `<rect x="${hx - u * 0.04}" y="${horizon - hh + u * 0.02}" width="${hw + u * 0.08}" height="${u * 0.025}" fill="${ink}"/>`;
    body += `<rect x="${hx + hw * 0.1}" y="${horizon - hh * 0.6 + u * 0.04}" width="${hw * 0.36}" height="${hh * 0.6}" fill="${ink}" opacity="0.72"/>`;
    body += `<rect x="${hx + hw * 0.62}" y="${horizon - hh * 0.5 + u * 0.04}" width="${hw * 0.12}" height="${hh * 0.5}" fill="${sky[0]}"/>`;
    body += palm(w * 0.16, horizon + u * 0.08, horizon - u * 0.46, u * 0.15, ink) + palm(w * 0.88, horizon + u * 0.06, horizon - u * 0.36, u * 0.12, ink);
  } else if (scene === "palms") {
    body += palm(w * 0.3, h * 0.98, h * 0.2, u * 0.2, ink) + palm(w * 0.56, h * 0.98, h * 0.12, u * 0.18, ink) + palm(w * 0.78, h * 0.98, h * 0.3, u * 0.16, ink);
  } else {
    body += joshua(w * 0.46, horizon + u * 0.14, u * 0.56, ink) + joshua(w * 0.82, horizon + u * 0.05, u * 0.2, ink);
    body += `<ellipse cx="${w * 0.2}" cy="${horizon + u * 0.12}" rx="${u * 0.12}" ry="${u * 0.035}" fill="${ink}" opacity="0.45"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/>${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const DAY: [string, string] = ["#3f8fd6", "#bfe0f2"];
const SHOTS: Shot[] = [
  { id: "palm-canyon-drive", title: "Palm Canyon Drive", detail: "Fri, Oct 9 · 8:14 AM", alt: "An empty street lined with palms leading toward dry mountains under a clear sky", width: 1067, height: 1600, scene: "street", sky: DAY, ground: "#d9c7a3", hills: "#b89f84", ink: "#3d4a3a" },
  { id: "mountain-street", title: "Morning on Via Lola", detail: "Fri, Oct 9 · 8:32 AM", alt: "A quiet residential street with low white houses and tall palms beneath the San Jacinto mountains", width: 1600, height: 1067, scene: "house", sky: ["#5aa2e0", "#d4e9f4"], ground: "#cdbf9d", hills: "#a8907c", ink: "#34443a" },
  { id: "boulder-house", title: "The boulder house", detail: "Fri, Oct 9 · 9:05 AM", alt: "A glass and steel modernist house above a garden of granite boulders and agave", width: 1280, height: 1600, scene: "house", sky: ["#4c97da", "#c9e3f3"], ground: "#c2b093", hills: "#9c8a7a", ink: "#2f3b38" },
  { id: "breeze-block", title: "Breeze block wall", detail: "Fri, Oct 9 · 10:20 AM", alt: "A white house with a patterned breeze block wall and two palms against a deep blue sky", width: 1062, height: 1600, scene: "house", sky: ["#1f6fc4", "#8fc3ea"], ground: "#e3d6bb", hills: "#c7b196", ink: "#2c4034" },
  { id: "motel", title: "Courtyard motel", detail: "Fri, Oct 9 · 12:48 PM", alt: "A white mid-century motel with palms and bare mountains behind it", width: 1600, height: 1061, scene: "motel", sky: DAY, ground: "#d8caa9", hills: "#b39a82", ink: "#33453b" },
  { id: "canopy", title: "Butterfly canopy", detail: "Fri, Oct 9 · 2:10 PM", alt: "A flat-roofed mid-century canopy under three tall palms", width: 1600, height: 1299, scene: "motel", sky: ["#3a86d0", "#b4d8f0"], ground: "#cfc0a0", hills: "#a9937f", ink: "#2e3f36" },
  { id: "white-house", title: "Low and white", detail: "Fri, Oct 9 · 3:36 PM", alt: "A low white house behind a lawn with a cluster of tall palms", width: 1600, height: 1067, scene: "house", sky: ["#4a94d8", "#c4e0f2"], ground: "#8fae6b", hills: "#a8927d", ink: "#2d4233" },
  { id: "tall-palms", title: "Tall palms", detail: "Fri, Oct 9 · 4:02 PM", alt: "Skinny fan palms rising high above parked cars and distant mountains", width: 1067, height: 1600, scene: "palms", sky: ["#3c8ad4", "#cfe6f3"], ground: "#c8b999", hills: "#a28c7b", ink: "#31423a" },
  { id: "dusk", title: "Dusk on Belardo Road", detail: "Fri, Oct 9 · 6:41 PM", alt: "A palm silhouetted against a pink evening sky above a lit house", width: 1067, height: 1600, scene: "palms", sky: ["#7c6bb0", "#f4b6b0"], ground: "#4a3b4d", hills: "#6b5374", ink: "#231c2c" },
  { id: "rock-house", title: "House in the rocks", detail: "Sat, Oct 10 · 7:12 AM", alt: "A low desert house among palms and rounded rocks", width: 1600, height: 1067, scene: "house", sky: ["#6fb0e4", "#e6eef0"], ground: "#c4ab8a", hills: "#b08e73", ink: "#3a3f36" },
  { id: "backlit-joshua", title: "First light", detail: "Sat, Oct 10 · 7:48 AM", alt: "A Joshua tree backlit by a low sun, its long shadows falling across the sand", width: 1067, height: 1600, scene: "joshua", sky: ["#8fc0e8", "#fbe3bd"], ground: "#d9b98a", hills: "#c09a76", ink: "#3b3327", sun: "#fff3cf" },
  { id: "lone-joshua", title: "Hidden Valley", detail: "Sat, Oct 10 · 9:30 AM", alt: "A single Joshua tree against a pale blue sky", width: 900, height: 1600, scene: "joshua", sky: ["#7fb9e6", "#dcecf4"], ground: "#d6c19b", hills: "#bda484", ink: "#454a34" },
  { id: "ridge", title: "Ryan Mountain trail", detail: "Sat, Oct 10 · 11:05 AM", alt: "A Joshua tree on a rocky slope under a turquoise sky", width: 1067, height: 1600, scene: "joshua", sky: ["#2fa3b8", "#b6e3e2"], ground: "#c9ae88", hills: "#a98a6c", ink: "#3d4630" },
  { id: "twin-trees", title: "Two trees", detail: "Sat, Oct 10 · 1:22 PM", alt: "Two Joshua trees under streaked clouds and a bright blue sky", width: 1067, height: 1600, scene: "joshua", sky: ["#2f7fd2", "#c2e0f4"], ground: "#d3bd96", hills: "#b59b7c", ink: "#414832" },
  { id: "sunset", title: "Keys View at sunset", detail: "Sat, Oct 10 · 6:28 PM", alt: "Joshua trees silhouetted against an orange and violet sunset", width: 1600, height: 1067, scene: "joshua", sky: ["#5b4a9a", "#f79a4c"], ground: "#2b2030", hills: "#4d3352", ink: "#17121c", sun: "#ffd27a" },
  { id: "blue-hour", title: "Blue hour", detail: "Sat, Oct 10 · 7:04 PM", alt: "The dark silhouette of a Joshua tree against a deep blue evening sky", width: 1600, height: 1600, scene: "joshua", sky: ["#14285c", "#4f79b8"], ground: "#0f1830", hills: "#1c2c54", ink: "#080d1c" },
];

const PHOTOS: PhotoGridPhoto[] = SHOTS.map((shot) => ({
  id: shot.id,
  src: paint(shot),
  alt: shot.alt,
  width: shot.width,
  height: shot.height,
  title: shot.title,
  detail: shot.detail,
}));

const FAVORITES = ["boulder-house", "sunset"];

export default function Demo() {
  const [viewing, setViewing] = useState(false);
  const hint = viewing
    ? "Swipe or scrub the filmstrip between photos. Drag down to put it back."
    : "Pinch, or hold Control and scroll, to zoom. Tap a photo to open it.";

  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <PhotoGrid photos={PHOTOS} title="Desert weekend" defaultFavorites={FAVORITES} onViewerChange={(id) => setViewing(id !== null)} />
      </div>
      <p className={styles.hint}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={hint}
            className={styles.hintText}
            initial={{ opacity: 0, filter: "blur(4px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(4px)", y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {hint}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
