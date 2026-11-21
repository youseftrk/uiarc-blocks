"use client";

import { GravityWell } from "./gravity-well";
import styles from "./gravity-well.module.css";

// The live moodboard uses photographs; these tiles keep its order and alt text with drawn stand-ins so nothing loads from the network.
const TILES: [person: boolean, alt: string][] = [
  [false, "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor"],
  [false, "Wavy terracotta walls rising toward a blue sky"],
  [true, "Chloe Nguyen"],
  [false, "A home office with a wooden desk and deep green walls"],
  [false, "A chef spooning sauce onto a plated dish in a dark kitchen"],
  [false, "A white mushroom table lamp glowing beside books and a small vase"],
  [false, "Layered mountain ridges under a warm evening sky"],
  [true, "Ava Mitchell"],
  [false, "A grey armchair and ottoman with a knit throw in a dark green room"],
  [true, "Emma Collins"],
  [false, "Folded natural linen throws with fringed edges in soft window light"],
  [false, "A calm alpine lake reflecting a rocky peak at golden hour"],
  [true, "Daniel Kim"],
  [false, "A made bed with striped linen pillows against an oak headboard"],
  [true, "Marcus Johnson"],
  [false, "A hand pouring water from a ribbed glass carafe into tumblers"],
  [false, "A long coastline with waves rolling onto a beach below green cliffs"],
  [true, "Jordan Reyes"],
  [false, "A warm restaurant dining room with woven pendant lights and a tree"],
  [true, "Jasmine Brooks"],
  [false, "Two speckled stoneware cups with a lid on a pale table"],
  [false, "A calm sea at dusk with a low island on the horizon"],
  [true, "Mateo Alvarez"],
  [false, "A glass carafe of red wine on a bar table in low evening light"],
  [true, "Olivia Bennett"],
  [false, "Two stacked speckled ceramic bowls against a dark wall"],
  [false, "A yellow tram on a street lined with historic buildings in Lisbon"],
  [true, "Tyler Hayes"],
  [false, "Curved stainless steel panels of the Walt Disney Concert Hall against a blue sky"],
  [true, "Sofia Ramirez"],
  [false, "A sculptural ceramic lamp with a linen shade on a walnut sideboard"],
  [false, "The 25 de Abril Bridge crossing the Tagus in Lisbon"],
  [true, "Andre Williams"],
  [false, "A white tiled building facade with curved balconies"],
  [true, "Ryan Sullivan"],
  [false, "A bright living room with timber beams, arched windows, and cream sofas"],
  [false, "Terracotta rooftops of Lisbon running down to the river"],
  [true, "Nathan Cole"],
  [false, "A modern glass house beside a long pool under a clear sky"],
  [true, "Hannah Walsh"],
  [false, "A sunroom with a round dining table, plants, and windows on three sides"],
  [false, "Seared salmon with a bright herb salsa and a glass of red wine"],
];

function art(index: number, person: boolean) {
  const hue = (index * 47 + 18) % 360, tilt = (index * 61) % 180;
  const body = person
    ? `<defs><radialGradient id="a" cx="${20 + ((index * 29) % 60)}%" cy="${20 + ((index * 13) % 50)}%" r="75%"><stop offset="0" stop-color="hsl(${hue} 90% 62%)"/><stop offset="1" stop-color="hsl(${hue} 90% 62% / 0)"/></radialGradient><radialGradient id="b" cx="${80 - ((index * 19) % 50)}%" cy="${85 - ((index * 11) % 40)}%" r="80%"><stop offset="0" stop-color="hsl(${(hue + 110) % 360} 88% 60%)"/><stop offset="1" stop-color="hsl(${(hue + 110) % 360} 88% 60% / 0)"/></radialGradient></defs><rect width="96" height="96" fill="hsl(${(hue + 220) % 360} 84% 64%)"/><rect width="96" height="96" fill="url(#a)"/><rect width="96" height="96" fill="url(#b)"/>`
    : `<defs><linearGradient id="g" gradientTransform="rotate(${tilt} .5 .5)"><stop offset="0" stop-color="hsl(${hue} 42% 72%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 38% 38%)"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><circle cx="${20 + ((index * 23) % 56)}" cy="${24 + ((index * 17) % 30)}" r="${10 + (index % 4) * 3}" fill="hsl(${(hue + 20) % 360} 60% 88% / .55)"/><path d="M0 ${62 + (index % 5) * 4}C24 ${48 + (index % 3) * 6} 40 ${78 - (index % 4) * 5} 96 ${56 + (index % 6) * 3}V96H0z" fill="hsl(${(hue + 60) % 360} 34% 26% / .6)"/>`;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${body}</svg>`)}`;
}

export default function Demo() {
  return (
    <div className={styles.demo}>
      <GravityWell className={styles.well} label="Studio moodboard">
        {TILES.map(([person, alt], i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className={styles.image} src={art(i, person)} alt={alt} loading="lazy" decoding="async" draggable={false} />
        ))}
      </GravityWell>
    </div>
  );
}
