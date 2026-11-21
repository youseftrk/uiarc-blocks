"use client";

import { HoloCard } from "./holo-card";
import portrait from "./jasmine-brooks.svg";
import styles from "./holo-card.module.css";

function Mark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 48V29C9 15 19 7 32 7s23 8 23 22v19" />
      <path d="M20 48V31c0-8 5-13 12-13s12 5 12 13v17" />
      <path d="M32 38v10" />
    </svg>
  );
}

export default function Demo() {
  return (
    <div className={styles.demo}>
      <HoloCard
        className={styles.demoCard}
        label="Jasmine Brooks, Arc Pro member card"
        front={
          <div className={styles.front}>
            <div className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.image} alt="" decoding="async" src={portrait.src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: "transparent" }} />
            </div>
            <div className={styles.top}>
              <Mark className={styles.mark} />
              <span className={styles.tier}>Pro</span>
            </div>
            <div className={styles.info}>
              <p className={styles.name}>Jasmine Brooks</p>
              <p className={styles.role}>Design lead</p>
              <dl className={styles.meta}>
                <div><dt>Member since</dt><dd>2023</dd></div>
                <div><dt>Shipped</dt><dd>148</dd></div>
              </dl>
            </div>
          </div>
        }
        back={
          <div className={styles.back}>
            <Mark className={styles.backMark} />
            <p className={styles.backTitle}>Arc Pro</p>
            <p className={styles.backNote}>Founding member, March 2023</p>
            <p className={styles.handle}>uiarc.dev/jasmine</p>
          </div>
        }
      />
    </div>
  );
}
