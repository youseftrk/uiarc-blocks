"use client";

import { LightboxGallery, type LightboxImage } from "./lightbox-gallery";
import styles from "./lightbox-gallery.module.css";

function makePhotoSvg(
  w: number,
  h: number,
  bgTop: string,
  bgMid: string,
  bgBot: string,
  accent: string,
  sunX: number,
  sunY: number,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bgTop}"/>
        <stop offset="56%" stop-color="${bgMid}"/>
        <stop offset="100%" stop-color="${bgBot}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${Math.round(w * sunX)}" cy="${Math.round(h * sunY)}" r="${Math.round(Math.min(w, h) * 0.14)}" fill="${accent}" opacity="0.65"/>
    <path d="M0 ${Math.round(h * 0.68)} Q ${Math.round(w * 0.3)} ${Math.round(h * 0.56)} ${Math.round(w * 0.62)} ${Math.round(h * 0.66)} T ${w} ${Math.round(h * 0.62)} L ${w} ${h} L 0 ${h} Z" fill="rgba(18,16,24,0.38)"/>
    <path d="M0 ${Math.round(h * 0.78)} Q ${Math.round(w * 0.45)} ${Math.round(h * 0.72)} ${w} ${Math.round(h * 0.8)} L ${w} ${h} L 0 ${h} Z" fill="rgba(12,11,18,0.52)"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const LISBON_PHOTOS: LightboxImage[] = [
  {
    src: makePhotoSvg(1600, 1064, "#243b55", "#d98245", "#4a2518", "#ffe4a8", 0.74, 0.28),
    width: 1600,
    height: 1064,
    alt: "Yellow tram climbing a narrow street in Baixa",
    title: "Tram 28 through Baixa",
    caption: "Rua da Conceição, Lisbon",
  },
  {
    src: makePhotoSvg(1067, 1600, "#3b5978", "#c87d58", "#2c1d1e", "#ffd9a0", 0.32, 0.24),
    width: 1067,
    height: 1600,
    alt: "Warm terracotta rooftop curves over Alfama",
    title: "Terracotta curves",
    caption: "Miradouro de Santa Luzia",
  },
  {
    src: makePhotoSvg(1600, 1200, "#1c334a", "#5f85a8", "#1d2733", "#e6f2ff", 0.65, 0.3),
    width: 1600,
    height: 1200,
    alt: "Red suspension bridge across the Tagus at dusk",
    title: "25 de Abril Bridge",
    caption: "Across the Tagus",
  },
  {
    src: makePhotoSvg(1200, 1600, "#1d3d4f", "#3e788a", "#172b36", "#fff1d0", 0.5, 0.22),
    width: 1200,
    height: 1600,
    alt: "Sea stacks off the Sintra coast",
    title: "Praia da Ursa",
    caption: "Sintra coast, 40 min west",
  },
  {
    src: makePhotoSvg(1600, 1067, "#4d3647", "#c96f5b", "#2a1a22", "#ffcf96", 0.28, 0.32),
    width: 1600,
    height: 1067,
    alt: "Pastel facades along a sunlit hill",
    title: "Alfama at sunset",
    caption: "Largo das Portas do Sol",
  },
  {
    src: makePhotoSvg(1067, 1600, "#23394d", "#6d8ea6", "#222933", "#f7e8cc", 0.72, 0.2),
    width: 1067,
    height: 1600,
    alt: "Blue and white azulejo facade in Chiado",
    title: "Azulejo tiles",
    caption: "Chiado, morning light",
  },
  {
    src: makePhotoSvg(1600, 1067, "#2c4959", "#7fa19f", "#1e3038", "#fff0c2", 0.6, 0.26),
    width: 1600,
    height: 1067,
    alt: "Fishing boats moored in calm harbor water",
    title: "Cais das Colunas",
    caption: "Early tide on the Tagus",
  },
  {
    src: makePhotoSvg(1200, 1500, "#3d2f45", "#a86b72", "#261c29", "#ffe2c6", 0.38, 0.28),
    width: 1200,
    height: 1500,
    alt: "Stone arches glowing in late afternoon sun",
    title: "Carmo arches",
    caption: "Largo do Carmo",
  },
];

export default function LightboxGalleryDemo() {
  return (
    <div className={styles.demo}>
      <LightboxGallery
        images={LISBON_PHOTOS}
        label="Lisbon photos"
        minColumnWidth={150}
      />
    </div>
  );
}
