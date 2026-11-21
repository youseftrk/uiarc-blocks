"use client";

import { ImageTrail, type ImageTrailImage } from "./image-trail";
import styles from "./image-trail.module.css";

const frame = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const sky = (top: string, bottom: string) => `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="320" height="400" fill="url(#s)"/>`;

// Twelve drawn frames, in the order the trail shows them. Nothing loads from the network.
const images: ImageTrailImage[] = [
  { alt: "A yellow tram on a steep Lisbon street", src: frame(`${sky("#8fb7dc", "#e9dcc6")}<path d="M0 150h110v250H0zM210 120h110v280H210z" fill="#d9c7a8"/><path d="M0 300l320-40v140H0z" fill="#8a8377"/><rect x="92" y="190" width="136" height="130" rx="14" fill="#f2c230"/><rect x="104" y="204" width="112" height="46" rx="6" fill="#2f3b46"/><rect x="92" y="262" width="136" height="12" fill="#f7f0dc"/><circle cx="118" cy="296" r="7" fill="#fff6cf"/><circle cx="202" cy="296" r="7" fill="#fff6cf"/><path d="M160 190v-50M110 140h100" stroke="#3b3b3b" stroke-width="3"/>`) },
  { alt: "Wavy terracotta walls under a blue sky", src: frame(`${sky("#3f7fc4", "#9cc4ea")}<path d="M0 400V170c30-50 60-50 90 0s50 60 80 0 50-70 80-10 40 50 70 10v230z" fill="#c8693f"/><path d="M0 400V260c30-40 60-40 90 0s50 50 80 0 50-60 80-10 40 40 70 10v140z" fill="#a9512f"/><path d="M0 400v-60c30-30 60-30 90 0s50 40 80 0 50-50 80-10 40 30 70 10v60z" fill="#8a3f26"/>`) },
  { alt: "The sea at dusk", src: frame(`${sky("#3d4f7c", "#f7cf9a")}<path d="M0 250h320v150H0z" fill="#3a4468"/><circle cx="200" cy="236" r="26" fill="#ffd9a0"/><path d="M0 250h320v14H0z" fill="#c9806f" opacity=".7"/><path d="M150 276h100M130 300h140M110 330h170" stroke="#f3b58c" stroke-width="3" opacity=".5"/>`) },
  { alt: "A ceramic lamp on a side table", src: frame(`${sky("#e7ddcc", "#cdbfa8")}<path d="M0 300h320v100H0z" fill="#a98c68"/><path d="M110 150l22-80h56l22 80z" fill="#f6e7bd"/><path d="M132 150h56c20 30 26 90-28 150-54-60-48-120-28-150z" fill="#7d8f86"/><ellipse cx="160" cy="302" rx="44" ry="9" fill="#5e6f67"/>`) },
  { alt: "Terracotta rooftops in Lisbon", src: frame(`${sky("#86b4dd", "#dfeaf0")}<path d="M0 190h320v40H0z" fill="#4f93b8"/><g fill="#f4efe4"><path d="M0 250h120v150H0zM110 220h100v180H110zM200 260h120v140H200z"/></g><g fill="#d4683c"><path d="M-10 250l70-40 70 40zM100 220l60-36 60 36zM190 260l70-40 70 40z"/></g><g fill="#5d6b78"><path d="M24 280h18v26H24zM70 280h18v26H70zM136 250h18v26h-18zM176 250h18v26h-18zM232 290h18v26h-18zM276 290h18v26h-18z"/></g>`) },
  { alt: "An alpine lake below a glowing peak", src: frame(`${sky("#5d86b4", "#e9d3bd")}<path d="M90 240l70-130 80 130z" fill="#c7673f"/><path d="M0 250l70-50 60 30 60-24 130 44v40H0z" fill="#7a5a48"/><path d="M0 268h320v30H0z" fill="#3f5a3c"/><path d="M0 296h320v104H0z" fill="#3f8791"/><path d="M130 300l60 0-14 50-30 10z" fill="#c7673f" opacity=".4"/>`) },
  { alt: "A woven lounge chair in a sunlit corner", src: frame(`${sky("#efe6d6", "#d8cab2")}<path d="M0 310h320v90H0z" fill="#b9a688"/><path d="M30 40h100v190H30z" fill="#fbf5e8" opacity=".8"/><path d="M100 190h120l14 90H86z" fill="#c9a877"/><path d="M86 280h148v18H86z" fill="#a8824f"/><path d="M94 298l-10 60M226 298l10 60" stroke="#8a673c" stroke-width="8" stroke-linecap="round"/><path d="M116 200c30 18 60 18 88 0l8 56h-104z" fill="#f3ebdb"/>`) },
  { alt: "Hazy mountain ridges at evening", src: frame(`${sky("#8fb1cf", "#f3a56f")}<circle cx="220" cy="150" r="24" fill="#fff1d6"/><path d="M0 220l60-34 50 22 70-40 60 34 80-20v218H0z" fill="#d99a8a" opacity=".8"/><path d="M0 270l80-30 60 26 60-34 120 30v138H0z" fill="#b87a7c"/><path d="M0 320l50-22 80 30 70-32 120 26v78H0z" fill="#8c5e73"/><path d="M0 366l120-18 200 16v36H0z" fill="#4a3856"/>`) },
  { alt: "Speckled stoneware cups on a pale table", src: frame(`${sky("#ece5db", "#d6cbbb")}<path d="M0 250h320v150H0z" fill="#f1ebe1"/><path d="M40 220h130c0 50-22 72-65 72s-65-22-65-72z" fill="#d9cdb9"/><ellipse cx="105" cy="220" rx="65" ry="13" fill="#b9ab94"/><path d="M196 210h84v84c0 14-18 20-42 20s-42-6-42-20z" fill="#c9bca6"/><ellipse cx="238" cy="210" rx="42" ry="10" fill="#a8997f"/><g fill="#7c6f5c" opacity=".55"><circle cx="80" cy="254" r="2"/><circle cx="126" cy="268" r="1.6"/><circle cx="220" cy="252" r="1.8"/><circle cx="258" cy="284" r="1.6"/></g>`) },
  { alt: "A coastline with waves below green cliffs", src: frame(`${sky("#7fa9cf", "#f0dcc0")}<path d="M0 150h320v250H0z" fill="#2f7892"/><path d="M320 110c-60 6-100 40-124 90-22 46-32 100-36 200h160z" fill="#4f7a45"/><path d="M196 200c-30 50-46 110-52 200H96c12-100 44-160 100-200z" fill="#e7d3ae"/><path d="M96 400c12-96 44-156 100-198" fill="none" stroke="#fff" stroke-width="6" opacity=".85"/><path d="M60 400c16-90 48-146 104-186" fill="none" stroke="#e6f3f4" stroke-width="4" opacity=".6"/>`) },
  { alt: "A blue tiled doorway", src: frame(`${sky("#f3ead8", "#e6d8bd")}<g fill="#3f6fb0"><path d="M0 0h320v70H0zM0 330h320v70H0z"/></g><g fill="#f7f1e3" opacity=".7"><circle cx="40" cy="35" r="12"/><circle cx="120" cy="35" r="12"/><circle cx="200" cy="35" r="12"/><circle cx="280" cy="35" r="12"/><circle cx="40" cy="365" r="12"/><circle cx="120" cy="365" r="12"/><circle cx="200" cy="365" r="12"/><circle cx="280" cy="365" r="12"/></g><path d="M100 330V170c0-40 26-66 60-66s60 26 60 66v160z" fill="#2f5f56"/><circle cx="200" cy="236" r="5" fill="#e8c46a"/>`) },
  { alt: "Linen throws folded on a bench", src: frame(`${sky("#e9e2d6", "#d2c6b2")}<path d="M0 290h320v110H0z" fill="#a98c68"/><path d="M40 270h240v22H40z" fill="#8a673c"/><path d="M60 230h200v40H60z" fill="#efe6d4"/><path d="M70 196h180v34H70z" fill="#c9b79a"/><path d="M80 166h160v30H80z" fill="#a9b3a4"/><path d="M60 250h200M70 212h180M80 180h160" stroke="#00000018" stroke-width="2"/>`) },
];

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ImageTrail images={images} intro className={styles.area}>
        <div className={styles.copy}>
          <h3 className={styles.title}>Lisbon, in passing</h3>
          <p className={styles.meta}>Twelve frames, spring 2026</p>
        </div>
      </ImageTrail>
    </div>
  );
}
