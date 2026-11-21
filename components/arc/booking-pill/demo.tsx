"use client";

import { BookingPill } from "./booking-pill";
import styles from "./booking-pill.module.css";

/* Closed on Mondays; a few seatings are taken, more of them for larger parties. */
function isAvailable(date: string, time: string, party: number) {
  const [y, m, d] = date.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1) return false;
  const [h, min] = time.split(":").map(Number);
  const slot = (h - 17) * 2 + (min >= 30 ? 1 : 0);
  const seed = (d * 7 + slot * 13 + m * 3) % 11;
  if (date === "2026-09-22") return party > 6 ? slot < 5 : ![6, 8, 9].includes(slot);
  if (party > 6 && slot > 5) return false;
  return seed > 2;
}

export default function Demo() {
  return (
    <div className={styles.stage}>
      <BookingPill venue="Olea" venueDetail="432 Octavia Street, San Francisco" startDate="2026-09-21" isAvailable={isAvailable} />
    </div>
  );
}
