"use client";

import type { ReactNode } from "react";

import { PageCurl } from "./page-curl";
import styles from "./demo.module.css";

function Scene({ label, children, viewBox = "0 0 190 240" }: { label: string; children: ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

function Terracotta() {
  return (
    <Scene label="Wavy terracotta walls rising toward a blue sky" viewBox="0 0 230 319">
      <defs>
        <linearGradient id="pc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fb5" />
          <stop offset="1" stopColor="#7fb2e0" />
        </linearGradient>
        <linearGradient id="pc-clay-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9825a" />
          <stop offset="1" stopColor="#a8502f" />
        </linearGradient>
        <linearGradient id="pc-clay-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9a27a" />
          <stop offset="1" stopColor="#c46a43" />
        </linearGradient>
        <linearGradient id="pc-clay-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b85a36" />
          <stop offset="1" stopColor="#6f2d18" />
        </linearGradient>
      </defs>
      <rect width="230" height="319" fill="url(#pc-sky)" />
      <path d="M0 78C34 52 58 96 92 70s52-58 88-30 34 30 50 18v261H0Z" fill="url(#pc-clay-b)" />
      <path d="M0 132c30-30 52 14 84-10s48-52 82-22 44 22 64 6v213H0Z" fill="url(#pc-clay-a)" />
      <path d="M0 196c36-26 60 20 96-6s50-40 80-14 38 18 54 8v135H0Z" fill="url(#pc-clay-c)" />
      <path d="M0 250c40-20 70 18 108-2s56-26 122-8v79H0Z" fill="#5b2412" opacity="0.72" />
      <path d="M0 78C34 52 58 96 92 70s52-58 88-30 34 30 50 18" fill="none" stroke="#f6c4a2" strokeWidth="1.5" opacity="0.7" />
      <rect width="230" height="319" fill="url(#pc-clay-c)" opacity="0.08" />
      <rect y="200" width="230" height="119" fill="#000" opacity="0.18" />
    </Scene>
  );
}

function Sunroom() {
  return (
    <Scene label="A sunroom with a round dining table, plants, and windows on three sides">
      <rect width="190" height="240" fill="#e9e3d8" />
      <rect width="190" height="46" fill="#f3efe7" />
      <g fill="#fbfaf6" stroke="#d8d0c2" strokeWidth="2">
        <rect x="28" y="52" width="38" height="92" />
        <rect x="74" y="52" width="44" height="92" />
        <rect x="126" y="52" width="38" height="92" />
      </g>
      <g stroke="#d8d0c2" strokeWidth="1.5">
        <path d="M47 52v92M96 52v92M145 52v92M28 98h136" />
      </g>
      <path d="M0 150h190v90H0Z" fill="#c58b55" />
      <path d="M0 150h190v10H0Z" fill="#a8703f" opacity="0.5" />
      <path d="M20 240 70 160h40l60 80Z" fill="#e2ac74" opacity="0.6" />
      <path d="M96 0v38" stroke="#6b5a48" strokeWidth="1" />
      <path d="M80 62 86 38h20l6 24Z" fill="#d9c3a3" />
      <ellipse cx="96" cy="150" rx="26" ry="6" fill="#8a5630" />
      <rect x="93" y="150" width="6" height="40" fill="#7a4a28" />
      <path d="M82 196h28" stroke="#7a4a28" strokeWidth="4" strokeLinecap="round" />
      <g fill="none" stroke="#6f4022" strokeWidth="3" strokeLinecap="round">
        <path d="M52 128v70M70 128v70M52 128h18M52 160h20M52 144h18" />
        <path d="M122 128v70M140 128v70M122 128h18M120 160h20M122 144h18" />
      </g>
      <g fill="#3f6b3a">
        <ellipse cx="62" cy="92" rx="12" ry="7" transform="rotate(-30 62 92)" />
        <ellipse cx="46" cy="104" rx="11" ry="6" transform="rotate(24 46 104)" />
        <ellipse cx="66" cy="112" rx="10" ry="6" transform="rotate(-50 66 112)" />
        <ellipse cx="160" cy="118" rx="10" ry="6" transform="rotate(30 160 118)" />
        <ellipse cx="172" cy="130" rx="9" ry="5" transform="rotate(-20 172 130)" />
        <ellipse cx="18" cy="170" rx="14" ry="6" transform="rotate(-24 18 170)" />
        <ellipse cx="178" cy="196" rx="12" ry="7" />
      </g>
      <path d="M56 100v62M166 124v40" stroke="#4d5a36" strokeWidth="2" />
      <rect x="46" y="160" width="20" height="20" rx="2" fill="#2f3030" />
      <rect x="160" y="162" width="14" height="14" rx="2" fill="#b9b3a8" />
    </Scene>
  );
}

function LoungeChair() {
  return (
    <Scene label="A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor">
      <rect width="190" height="240" fill="#b5ada1" />
      <rect x="176" width="14" height="168" fill="#3c4038" />
      <rect x="174" width="3" height="168" fill="#22241f" />
      <path d="M0 168h190v72H0Z" fill="#5d594f" />
      <path d="M0 168h190v8H0Z" fill="#45423a" opacity="0.6" />
      <ellipse cx="96" cy="214" rx="74" ry="8" fill="#000" opacity="0.2" />
      <g fill="none" stroke="#a9713f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 110 60 196M22 110l28 8M44 162l92-14M136 148l22 62M60 196l44-14M70 212l10-34" />
      </g>
      <path d="M28 114 52 166l82-14-10-10-58 6-22-44Z" fill="#c08a55" />
      <g stroke="#8e5d30" strokeWidth="1" opacity="0.7">
        <path d="M36 122l20 42M46 122l18 40M70 160l56-10M72 154l50-8" />
      </g>
      <path d="M18 96c10-10 30-8 42 0l8 22c-14 8-30 8-42 2Z" fill="#e8dfd0" />
      <path d="M46 116l34-6 22 38-36 10Z" fill="#d9d3c7" />
      <g stroke="#b9b1a3" strokeWidth="1.5">
        <path d="M54 118l22 38M62 116l22 38M70 114l22 38" />
      </g>
      <rect x="140" y="160" width="24" height="5" rx="2" fill="#8a5a33" />
      <path d="M146 165l-3 30M158 165l4 30" stroke="#7a4d2a" strokeWidth="4" strokeLinecap="round" />
      <rect x="146" y="150" width="12" height="10" rx="3" fill="#48515a" />
      <circle cx="152" cy="146" r="6" fill="#9a4b52" />
      <circle cx="148" cy="143" r="3" fill="#5f7a4a" />
    </Scene>
  );
}

function CeramicLamp() {
  return (
    <Scene label="A sculptural ceramic lamp with a linen shade on a walnut sideboard">
      <rect width="190" height="240" fill="#cfcbc4" />
      <rect x="120" y="56" width="70" height="140" fill="#e1ded8" />
      <rect x="120" y="56" width="70" height="140" fill="none" stroke="#bdb8af" strokeWidth="1" />
      <rect y="196" width="190" height="10" fill="#e6e2da" />
      <rect y="206" width="190" height="34" fill="#6e4528" />
      <g stroke="#55331c" strokeWidth="1" opacity="0.7">
        <path d="M0 214h190M0 224h190M0 232h190M104 206v34" />
      </g>
      <rect y="188" width="190" height="8" fill="#000" opacity="0.06" />
      <path d="M16 118h50l-3 40H19Z" fill="#eadfc9" />
      <path d="M26 196c-12-22 4-40 20-38s22 20 12 38h-10c8-14 4-26-4-26s-12 12-6 26Z" fill="#e2d6c1" />
      <rect x="110" y="170" width="20" height="24" rx="3" fill="#8f6a5c" opacity="0.85" />
      <circle cx="120" cy="184" r="4" fill="#f2c27a" />
      <g fill="#d9d2c4" stroke="#a8a091" strokeWidth="0.75">
        <rect x="100" y="186" width="56" height="5" />
        <rect x="98" y="191" width="60" height="5" fill="#3c3a37" />
        <rect x="102" y="181" width="52" height="5" fill="#ece7dc" />
      </g>
      <path d="M174 196c-8-4-8-16 0-20 8 4 8 16 0 20Z" fill="#6d6a5f" />
      <path d="M174 176c-2-10 2-18 0-26M174 164l-5-8M174 158l5-7" stroke="#4a4338" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </Scene>
  );
}

function Bedroom() {
  return (
    <Scene label="A made bed with striped linen pillows against an oak headboard">
      <rect width="190" height="240" fill="#d6d1c9" />
      <rect width="52" height="140" fill="#c9c3b9" />
      <rect x="52" width="56" height="130" fill="#c9a77e" />
      <g stroke="#b08f66" strokeWidth="1" opacity="0.8">
        <path d="M66 0v130M80 0v130M94 0v130" />
      </g>
      <rect x="52" y="68" width="14" height="8" rx="1" fill="#2b2a28" />
      <rect x="60" y="88" width="130" height="30" rx="6" fill="#e9e5de" />
      <g fill="#f4f1ec">
        <rect x="70" y="96" width="50" height="26" rx="6" />
        <rect x="126" y="96" width="64" height="26" rx="6" />
      </g>
      <path d="M48 110l34-6 10 40-36 8Z" fill="#8f8a7f" />
      <g stroke="#e6e1d6" strokeWidth="2">
        <path d="M58 109l9 40M66 107l9 40M74 106l9 39" />
      </g>
      <path d="M100 118l76-12 14 62-74 14Z" fill="#b5ad9d" />
      <g stroke="#6f6a5f" strokeWidth="2">
        <path d="M130 113l13 60M138 112l13 60M146 111l13 60" />
      </g>
      <path d="M52 132l40-8 12 30-38 12Z" fill="#4d4c49" />
      <path d="M0 150l70-10 120 40v60H0Z" fill="#f6f4f0" />
      <path d="M0 168l90-12 80 84H0Z" fill="#8e877a" />
      <g stroke="#7b7468" strokeWidth="1" opacity="0.8">
        <path d="M0 184l100-12M0 200l116-12M0 216l132-12M0 232l148-12" />
      </g>
      <path d="M90 156l100 66" stroke="#2c2b29" strokeWidth="1" fill="none" />
      <g stroke="#b9a37f" strokeWidth="1.5" strokeLinecap="round">
        <path d="M30 140l-6-26M30 140l2-30M30 140l8-24" />
      </g>
    </Scene>
  );
}

function Plate({ photo, caption, folio }: { photo: ReactNode; caption: string; folio: number }) {
  return (
    <div className={styles.plate}>
      <div className={`${styles.photo} ${styles.tall}`}>{photo}</div>
      <p className={styles.caption}>{caption}</p>
      <p className={styles.folio}>{folio}</p>
    </div>
  );
}

const pages: ReactNode[] = [
  <div key="cover" className={styles.cover}>
    <div className={`${styles.photo} ${styles.full}`}>
      <Terracotta />
    </div>
    <div className={styles.coverText}>
      <p className={styles.issue}>Issue 04</p>
      <p className={styles.coverTitle}>Slow rooms</p>
    </div>
  </div>,
  <div key="intro" className={styles.text}>
    <p className={styles.heading}>Rooms that take their time</p>
    <p className={styles.copy}>
      Six homes where light, texture, and a few good objects do the work. No trends, just places people love to spend a
      quiet afternoon.
    </p>
    <p className={styles.folio}>2</p>
  </div>,
  <Plate key="sunroom" photo={<Sunroom />} caption="A sunroom in Sintra, glass on three sides." folio={3} />,
  <Plate key="chair" photo={<LoungeChair />} caption="Woven oak and sheepskin, built to last decades." folio={4} />,
  <div key="quote" className={styles.text}>
    <p className={styles.quote}>The best rooms are edited, not decorated.</p>
    <p className={styles.copy}>Sofia Ramirez, interior designer</p>
    <p className={styles.folio}>5</p>
  </div>,
  <Plate key="lamp" photo={<CeramicLamp />} caption="A ceramic lamp on walnut, lit at dusk." folio={6} />,
  <Plate key="bed" photo={<Bedroom />} caption="Striped linen and an oak headboard." folio={7} />,
  <div key="back" className={styles.back}>
    <p className={styles.backTitle}>Slow rooms</p>
    <p className={styles.copy}>Next issue in spring</p>
  </div>,
];

export default function Demo() {
  return (
    <div className={styles.demo}>
      <PageCurl pages={pages} label="Slow rooms magazine" />
    </div>
  );
}
