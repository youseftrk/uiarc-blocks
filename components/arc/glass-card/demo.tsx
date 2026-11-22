"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";
import { GlassCard } from "./glass-card";
import styles from "./glass-card.module.css";

const PORTRAIT_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
    <defs>
      <radialGradient id="g1" cx="15%" cy="10%" r="70%">
        <stop offset="0%" stop-color="#c4e6b4"/>
        <stop offset="60%" stop-color="#c4e6b4" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g2" cx="85%" cy="15%" r="65%">
        <stop offset="0%" stop-color="#f2899e"/>
        <stop offset="65%" stop-color="#f2899e" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g3" cx="20%" cy="62%" r="68%">
        <stop offset="0%" stop-color="#98cf9f"/>
        <stop offset="70%" stop-color="#98cf9f" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g4" cx="88%" cy="72%" r="70%">
        <stop offset="0%" stop-color="#eb5e91"/>
        <stop offset="72%" stop-color="#eb5e91" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#d2e2cc"/>
        <stop offset="50%" stop-color="#dfcfd8"/>
        <stop offset="100%" stop-color="#d989ac"/>
      </linearGradient>
    </defs>
    <rect width="400" height="500" fill="url(#bg)"/>
    <rect width="400" height="500" fill="url(#g1)"/>
    <rect width="400" height="500" fill="url(#g2)"/>
    <rect width="400" height="500" fill="url(#g3)"/>
    <rect width="400" height="500" fill="url(#g4)"/>
  </svg>`,
)}`;

export default function GlassCardDemo() {
  const [following, setFollowing] = useState(false);
  const [messaged, setMessaged] = useState(false);

  return (
    <div className={styles.demo}>
      <GlassCard
        image={PORTRAIT_SVG}
        imageAlt="Portrait of Jasmine Brooks"
        title="Jasmine Brooks"
        subtitle="Design lead, Lisbon"
        aside={
          <span className={styles.rating}>
            <Star size={14} strokeWidth={1.75} className={styles.star} aria-hidden="true" />
            4.9
          </span>
        }
      >
        <p className={styles.bio}>
          Leads design systems at Meridian. Mentors on motion, type, and shipping small teams fast.
        </p>
        <dl className={styles.stats}>
          <div>
            <dt>Sessions</dt>
            <dd>128</dd>
          </div>
          <div>
            <dt>Followers</dt>
            <dd>{following ? "12.4k" : "12.4k"}</dd>
          </div>
          <div>
            <dt>Replies in</dt>
            <dd>2 h</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            aria-pressed={following}
            data-on={following ? "" : undefined}
            onClick={() => setFollowing((f) => !f)}
          >
            {following && <Check size={14} strokeWidth={2} aria-hidden="true" />}
            {following ? "Following" : "Follow"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            aria-pressed={messaged}
            data-on={messaged ? "" : undefined}
            onClick={() => setMessaged((m) => !m)}
          >
            {messaged ? "Sent" : "Message"}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
