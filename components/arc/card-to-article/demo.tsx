"use client";

import { CardToArticle, type ArticleItem } from "./card-to-article";
import styles from "./card-to-article.module.css";

/* Calm inline scenes stand in for the photos, so the demo has no external image requests. */
const scene = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${svg}</svg>`)}`;

const scenes = {
  pool: scene(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa8d8"/><stop offset="1" stop-color="#d7e8f2"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8fa8"/><stop offset="1" stop-color="#1f5f78"/></linearGradient></defs><rect width="800" height="600" fill="url(#s)"/><path d="M0 330 Q200 290 420 320 T800 300 V420 H0Z" fill="#5d7f62"/><rect x="170" y="230" width="470" height="14" fill="#f4f1ea"/><rect x="190" y="244" width="430" height="126" fill="#27343c"/><g fill="#9cc4d6" opacity=".85"><rect x="198" y="252" width="98" height="110"/><rect x="302" y="252" width="98" height="110"/><rect x="406" y="252" width="98" height="110"/><rect x="510" y="252" width="102" height="110"/></g><rect x="0" y="370" width="800" height="40" fill="#e6dfd2"/><path d="M60 410 H800 V600 H0Z" fill="url(#w)"/><path d="M120 450 h180 M360 480 h220 M200 520 h160 M520 540 h200" stroke="#bfe3ee" stroke-width="3" opacity=".5"/>`,
  ),
  tram: scene(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#f7e6c8"/></linearGradient></defs><rect width="800" height="600" fill="url(#s)"/><path d="M0 120 H250 V600 H0Z" fill="#d9825b"/><path d="M560 80 H800 V600 H560Z" fill="#e9d3a8"/><g fill="#7a4a3a" opacity=".55"><rect x="40" y="180" width="50" height="80"/><rect x="140" y="180" width="50" height="80"/><rect x="40" y="320" width="50" height="80"/><rect x="140" y="320" width="50" height="80"/><rect x="620" y="150" width="50" height="80"/><rect x="720" y="150" width="50" height="80"/><rect x="620" y="290" width="50" height="80"/><rect x="720" y="290" width="50" height="80"/></g><path d="M250 600 L360 300 H450 L560 600Z" fill="#8a8580"/><path d="M330 600 L392 300 M480 600 L418 300" stroke="#5a5651" stroke-width="5"/><rect x="330" y="270" width="150" height="190" rx="16" fill="#f2c230"/><rect x="330" y="400" width="150" height="60" fill="#f6f1e4"/><g fill="#33474f"><rect x="344" y="292" width="36" height="70" rx="4"/><rect x="387" y="292" width="36" height="70" rx="4"/><rect x="430" y="292" width="36" height="70" rx="4"/></g><path d="M405 270 V200 M300 200 H520" stroke="#3a3a3a" stroke-width="3"/>`,
  ),
  chef: scene(
    `<defs><radialGradient id="l" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#6b5648"/><stop offset="1" stop-color="#1e1814"/></radialGradient></defs><rect width="800" height="600" fill="url(#l)"/><rect y="400" width="800" height="200" fill="#3b3f43"/><ellipse cx="400" cy="440" rx="220" ry="70" fill="#f5f2ec"/><ellipse cx="400" cy="436" rx="150" ry="44" fill="#e9e4da"/><ellipse cx="390" cy="428" rx="60" ry="20" fill="#d8743c"/><circle cx="440" cy="420" r="14" fill="#6f9a4b"/><circle cx="362" cy="440" r="9" fill="#c23b3b"/><path d="M520 120 Q560 260 450 400" stroke="#f1ede6" stroke-width="54" stroke-linecap="round" fill="none"/><path d="M455 380 l-22 40" stroke="#c9ccd0" stroke-width="6" stroke-linecap="round"/>`,
  ),
  ridges: scene(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1c9a5"/><stop offset=".6" stop-color="#d9d7e6"/><stop offset="1" stop-color="#b9c3da"/></linearGradient></defs><rect width="800" height="600" fill="url(#s)"/><circle cx="560" cy="170" r="46" fill="#fff3df" opacity=".9"/><path d="M0 330 L120 270 L230 320 L360 240 L480 310 L600 250 L800 330 V600 H0Z" fill="#a9b3cf"/><path d="M0 390 L140 330 L280 390 L400 320 L540 400 L680 340 L800 380 V600 H0Z" fill="#8391b5"/><path d="M0 450 L160 400 L300 460 L450 390 L600 460 L800 420 V600 H0Z" fill="#5f6f97"/><path d="M0 520 L200 470 L380 530 L560 470 L800 520 V600 H0Z" fill="#3d4a70"/>`,
  ),
};

const items: ArticleItem[] = [
  {
    id: "glass-house",
    tag: "Case study",
    title: "A glass house that stays cool in August",
    meta: "5 min read",
    image: scenes.pool,
    imageAlt: "A modern glass house beside a long pool under a clear sky",
    body: (
      <article className={styles.article}>
        <div className={styles.byline}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className={styles.avatar}
            src="/media/people/jasmine-brooks.jpg"
          />
          <span className={styles.author}>Jasmine Brooks</span>
          <span className={styles.date}>Sep 18, 2026</span>
        </div>
        <p>
          The brief was simple and a little unreasonable: all glass on the south
          side, no air conditioning, and a pool that feels like part of the
          living room.
        </p>
        <p>
          We started with the roof. A deep overhang shades the glass from the
          high summer sun but lets the low winter light reach the back wall,
          which is poured concrete and holds the warmth into the evening.
        </p>
        <blockquote className={styles.quote}>
          The pool does half the work. Air crossing the water drops a few
          degrees before it reaches the house.
        </blockquote>
        <p>
          Every pane opens. On a still day the house breathes through the long
          side; when the wind turns, the clerestory at the back pulls warm air
          up and out.
        </p>
        <p>
          After two summers the owners have not once wished for a thermostat.
          The electricity bill is lower than the apartment they left.
        </p>
      </article>
    ),
  },
  {
    id: "lisbon",
    tag: "Travel",
    title: "Three slow days in Lisbon",
    meta: "4 min read",
    image: scenes.tram,
    imageAlt: "A yellow tram climbing a narrow Lisbon street",
    body: (
      <article className={styles.article}>
        <div className={styles.byline}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className={styles.avatar}
            src="/media/people/sofia-ramirez.jpg"
          />
          <span className={styles.author}>Sofia Ramirez</span>
          <span className={styles.date}>Sep 11, 2026</span>
        </div>
        <p>
          Skip the famous tram line at noon. Take the 28 at seven in the
          morning, when it is full of people going to work and the light is
          still low on the tiles.
        </p>
        <p>
          Spend the second day on foot in Alfama. Get lost on purpose, stop for
          a bica whenever you see a counter with a queue of locals, and end at
          the viewpoint above the river.
        </p>
        <blockquote className={styles.quote}>
          Lisbon rewards the people who walk uphill twice.
        </blockquote>
        <p>
          On the last day, cross the river by ferry and eat grilled fish in
          Cacilhas with the whole city spread out on the other bank.
        </p>
      </article>
    ),
  },
  {
    id: "live-menus",
    tag: "Changelog",
    title: "Menus now update in real time",
    meta: "2 min read",
    image: scenes.chef,
    imageAlt: "A chef plating a dish at the pass",
    body: (
      <article className={styles.article}>
        <div className={styles.byline}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className={styles.avatar}
            src="/media/people/daniel-kim.jpg"
          />
          <span className={styles.author}>Daniel Kim</span>
          <span className={styles.date}>Sep 4, 2026</span>
        </div>
        <p>
          When the kitchen runs out of a dish, it now disappears from every
          table tablet and the online menu within a second.
        </p>
        <p>
          Prices, allergens, and photos sync the same way. Changes made on the
          pass show up for guests before the next order goes in.
        </p>
        <blockquote className={styles.quote}>
          Fewer awkward conversations about the last portion of salmon.
        </blockquote>
        <p>
          The update is live for every venue on the Kitchen plan. Nothing to
          install.
        </p>
      </article>
    ),
  },
  {
    id: "seasons",
    tag: "Essay",
    title: "Why we plan in seasons, not sprints",
    meta: "6 min read",
    image: scenes.ridges,
    imageAlt: "Layered mountain ridges fading into haze",
    body: (
      <article className={styles.article}>
        <div className={styles.byline}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className={styles.avatar}
            src="/media/people/nathan-cole.jpg"
          />
          <span className={styles.author}>Nathan Cole</span>
          <span className={styles.date}>Aug 28, 2026</span>
        </div>
        <p>
          Two week sprints taught us to ship small things quickly. They also
          taught us to avoid anything that needed a quarter of quiet thinking.
        </p>
        <p>
          So we moved to seasons: twelve weeks with one ambitious goal, a
          cooldown, and nothing on the roadmap that we cannot explain in one
          sentence.
        </p>
        <blockquote className={styles.quote}>
          A season is long enough to be wrong and still recover.
        </blockquote>
        <p>
          The surprising part was morale. People could see the shape of the
          work, and the end of it, from the first week.
        </p>
      </article>
    ),
  },
];

export default function Demo() {
  return (
    <div className={styles.demo}>
      <CardToArticle items={items} />
    </div>
  );
}
