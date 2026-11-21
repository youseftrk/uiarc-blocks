"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { CoverFlow, type CoverFlowItem } from "./cover-flow";
import styles from "./demo.module.css";

interface Scene { sky: [string, string, string]; sun?: [number, number, number, string]; ridges: [string, number, number][]; ground: string; water?: string; }

/** A small deterministic generator, so every cover is the same on the server and the client. */
function random(seed: number) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}
/** Draws a layered landscape as an inline SVG: no image requests, crisp at any size. */
function landscape(seed: number, scene: Scene): string {
  const next = random(seed), w = 456, h = 570;
  const ridge = (color: string, base: number, rough: number) => {
    let d = `M0 ${h} L0 ${base}`, y = base;
    for (let x = 0; x <= w; x += 19) { y = Math.max(40, Math.min(h, y + (next() - .5) * rough)); d += ` L${x} ${Math.round(y - Math.sin(x / w * Math.PI) * rough * 1.6)}`; }
    return `<path d="${d} L${w} ${h} Z" fill="${color}"/>`;
  };
  const sun = scene.sun ? `<circle cx="${scene.sun[0]}" cy="${scene.sun[1]}" r="${scene.sun[2]}" fill="${scene.sun[3]}" opacity=".9"/><circle cx="${scene.sun[0]}" cy="${scene.sun[1]}" r="${scene.sun[2] * 2.4}" fill="${scene.sun[3]}" opacity=".18"/>` : "";
  const water = scene.water ? `<rect y="${h - 150}" width="${w}" height="150" fill="${scene.water}"/><rect y="${h - 150}" width="${w}" height="150" fill="url(#m)"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[0]}"/><stop offset=".55" stop-color="${scene.sky[1]}"/><stop offset="1" stop-color="${scene.sky[2]}"/></linearGradient><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/>${sun}${scene.ridges.map(([color, base, rough]) => ridge(color, base, rough)).join("")}${water}<path d="M0 ${h} L0 ${h - 46} Q${w * .3} ${h - 80} ${w * .55} ${h - 52} T${w} ${h - 60} L${w} ${h} Z" fill="${scene.ground}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface Hike extends CoverFlowItem { miles: number; gain: number; light: string; }

const hikes: Hike[] = [
  { id: "yosemite", title: "Yosemite Valley loop", subtitle: "Yosemite, California", alt: "Half Dome above a meadow where a deer grazes", imagePosition: "50% 40%", miles: 7.2, gain: 400, light: "Late afternoon",
    image: landscape(11, { sky: ["#7fa6c9", "#c6d6de", "#efe3c8"], ridges: [["#8d99a3", 250, 60], ["#5d6f6a", 340, 44], ["#3f5a3c", 420, 26]], ground: "#7c8f45" }) },
  { id: "lake-louise", title: "Lake Agnes Tea House", subtitle: "Banff, Alberta", alt: "Lake Louise reflecting the mountains and a glacier", miles: 4.5, gain: 1300, light: "Sunrise",
    image: landscape(23, { sky: ["#b9c6cc", "#d9dedd", "#eef0ec"], ridges: [["#c9d2d6", 210, 70], ["#7f8f93", 300, 60], ["#3d5554", 380, 40]], ground: "#27413f", water: "#3f7f84" }) },
  { id: "lago-limides", title: "Lago Limides", subtitle: "Cortina d'Ampezzo, Italy", alt: "A small alpine lake below a peak lit by sunset, framed by weathered wood", miles: 2.6, gain: 750, light: "Sunset",
    image: landscape(37, { sky: ["#35507c", "#8fa3c2", "#f0c9a2"], sun: [330, 250, 26, "#ffd9a8"], ridges: [["#c8744f", 270, 80], ["#6f5a4a", 360, 46], ["#3f4a35", 420, 30]], ground: "#8a7a68", water: "#4f8792" }) },
  { id: "seceda", title: "Seceda ridgeline", subtitle: "Val Gardena, Italy", alt: "A green ridge and yellow wildflowers below the Seceda peaks", imagePosition: "50% 20%", miles: 6.1, gain: 1150, light: "Morning",
    image: landscape(41, { sky: ["#c9d2d8", "#dfe4e4", "#eef0ea"], ridges: [["#9aa3a8", 200, 110], ["#6f8a4d", 330, 70], ["#55793a", 420, 36]], ground: "#c9b63f" }) },
  { id: "iceland-canyon", title: "Fjaðrárgljúfur rim", subtitle: "South Iceland", alt: "A river winding through a deep mossy canyon", miles: 1.8, gain: 330, light: "Any weather",
    image: landscape(53, { sky: ["#aeb9bd", "#cfd6d4", "#e4e7df"], ridges: [["#6e7f5b", 230, 60], ["#4f6a3f", 320, 70], ["#39532f", 410, 50]], ground: "#2f4527", water: "#7f9aa0" }) },
  { id: "cape-nelson", title: "Cape Nelson lighthouse", subtitle: "Victoria, Australia", alt: "A white lighthouse under a clear evening sky", imagePosition: "50% 60%", miles: 3.1, gain: 260, light: "Blue hour",
    image: landscape(67, { sky: ["#27406e", "#6f8fc2", "#f2c7b4"], sun: [120, 330, 18, "#fff1dc"], ridges: [["#51618a", 400, 16], ["#3b4a5f", 440, 20]], ground: "#6b6a4c", water: "#3c5d8a" }) },
  { id: "ocean-beach", title: "Ocean Beach to Lands End", subtitle: "San Francisco, California", alt: "Cliffs above the Pacific at dusk", imagePosition: "30% 50%", miles: 3.4, gain: 550, light: "Sunset",
    image: landscape(79, { sky: ["#4a4f7c", "#c98a8f", "#f6c58f"], sun: [300, 360, 30, "#ffe0b0"], ridges: [["#6a5670", 330, 50], ["#4a3f4f", 400, 60]], ground: "#3a3340", water: "#7f6f93" }) },
];

export default function Demo() {
  const [index, setIndex] = useState(2);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const hike = hikes[index];
  const isSaved = saved.has(hike.id);
  const toggle = () => setSaved(current => { const next = new Set(current); if (next.has(hike.id)) next.delete(hike.id); else next.add(hike.id); return next; });
  return (
    <div className={styles.demo}>
      <CoverFlow label="Hikes for this fall" items={hikes} defaultIndex={2} onIndexChange={setIndex} />
      <div className={styles.details}>
        <dl className={styles.stats}>
          <div className={styles.stat}><dt>Round trip</dt><dd><AnimatedCounter value={hike.miles} decimals={1} suffix={"\u00a0mi"} /></dd></div>
          <div className={styles.stat}><dt>Elevation gain</dt><dd><AnimatedCounter value={hike.gain} suffix={"\u00a0ft"} /></dd></div>
          <div className={styles.stat}><dt>Best light</dt><dd className={styles.light}>{hike.light}</dd></div>
        </dl>
        <button className={styles.save} type="button" aria-pressed={isSaved} onClick={toggle}>
          {isSaved ? <BookmarkCheck size={16} strokeWidth={1.75} aria-hidden="true" /> : <Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />}
          <span>{isSaved ? "Saved" : "Save hike"}</span>
        </button>
      </div>
    </div>
  );
}
