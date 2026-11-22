"use client";

import { NowPlaying, type NowPlayingTrack } from "./now-playing";
import styles from "./demo.module.css";

// Painted stand-ins for the cover photos, inlined so the demo ships no image files.
const art = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'>${body}</svg>`)}`;

const TRACKS: NowPlayingTrack[] = [
  {
    id: "undertow",
    title: "Undertow",
    artist: "Hollis Reed",
    duration: 214,
    artworkAlt: "A wave breaking in amber light, seen from above",
    artwork: art("<defs><filter id='b'><feGaussianBlur stdDeviation='9'/></filter><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.035 .12' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .9 0 0 -.25 0'/></filter><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#d98a45'/><stop offset='.5' stop-color='#b7733f' stop-opacity='.7'/><stop offset='.62' stop-color='#2f3d44' stop-opacity='0'/></linearGradient></defs><rect width='300' height='300' fill='#2f3d44'/><rect width='300' height='300' fill='url(#g)'/><ellipse cx='205' cy='150' rx='70' ry='120' fill='#dfe9f1' filter='url(#b)' opacity='.9'/><rect width='300' height='300' filter='url(#n)' opacity='.45'/>"),
  },
  {
    id: "dune",
    title: "Dune light",
    artist: "The Meridian Line",
    duration: 247,
    artworkAlt: "Sand dunes under a pale sky",
    artwork: art("<defs><filter id='b'><feGaussianBlur stdDeviation='9'/></filter><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.035 .12' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .9 0 0 -.25 0'/></filter><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e9e4dc'/><stop offset='1' stop-color='#e2c49c'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/><path d='M0 190 Q90 130 170 185 T300 160 V300 H0Z' fill='#c9955e'/><path d='M0 240 Q120 180 220 235 T300 220 V300 H0Z' fill='#a8703f'/><rect width='300' height='300' filter='url(#n)' opacity='.3'/>"),
  },
  {
    id: "halo",
    title: "Halo, slowly",
    artist: "Avery Cole",
    duration: 196,
    artworkAlt: "A circle of light painted in the dark",
    artwork: art("<defs><filter id='b'><feGaussianBlur stdDeviation='9'/></filter><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.035 .12' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .9 0 0 -.25 0'/></filter></defs><rect width='300' height='300' fill='#0b0b10'/><circle cx='150' cy='150' r='74' fill='none' stroke='#ffd9a0' stroke-width='10' filter='url(#b)'/><circle cx='150' cy='150' r='74' fill='none' stroke='#fff4e0' stroke-width='3'/><rect width='300' height='300' filter='url(#n)' opacity='.25'/>"),
  },
  {
    id: "concrete",
    title: "Concrete garden",
    artist: "Sloane & Wilder",
    duration: 231,
    artworkAlt: "Angular concrete facade in hard sunlight",
    artwork: art("<defs><filter id='b'><feGaussianBlur stdDeviation='9'/></filter><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.035 .12' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .9 0 0 -.25 0'/></filter></defs><rect width='300' height='300' fill='#8fa9c4'/><path d='M0 300 L0 120 L120 40 L300 150 L300 300Z' fill='#cfc9bf'/><path d='M120 40 L300 150 L300 300 L170 300Z' fill='#8d877e'/><path d='M0 120 L120 40 L170 300 L0 300Z' fill='#e4dfd6'/><rect width='300' height='300' filter='url(#n)' opacity='.3'/>"),
  },
  {
    id: "tide",
    title: "Tidepool",
    artist: "Hollis Reed",
    duration: 188,
    artworkAlt: "Teal swirls of ink in water",
    artwork: art("<defs><filter id='b'><feGaussianBlur stdDeviation='9'/></filter><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.035 .12' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .9 0 0 -.25 0'/></filter><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#14a39a'/><stop offset='1' stop-color='#0b4f5c'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/><path d='M-20 120 C60 40 140 220 200 120 S320 60 330 200' fill='none' stroke='#bff0e6' stroke-width='26' opacity='.55' filter='url(#b)'/><path d='M-20 220 C80 150 150 300 240 200 S320 180 340 260' fill='none' stroke='#0a3d45' stroke-width='34' opacity='.6' filter='url(#b)'/><rect width='300' height='300' filter='url(#n)' opacity='.3'/>"),
  },
];

export default function Demo() {
  return (
    <div className={styles.demo}>
      <NowPlaying tracks={TRACKS} />
    </div>
  );
}
