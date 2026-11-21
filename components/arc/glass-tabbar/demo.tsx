"use client";

import { useRef, useState } from "react";
import { Bookmark, Compass, House, Search, UserRound } from "lucide-react";
import { GlassTabBar } from "./glass-tabbar";
import styles from "./glass-tabbar.module.css";

const ROWS: [tall: boolean, wide: boolean][] = [
  [true, true], [false, false], [false, true], [false, true], [true, false], [false, true], [false, true],
  [false, false], [true, true], [false, true], [false, false], [false, true], [true, true], [false, false],
];

export default function Demo() {
  const [tab, setTab] = useState("home");
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className={styles.demo}>
      <div ref={scroller} className={styles.scroller}>
        <div className={styles.canvas} aria-hidden="true">
          {ROWS.map(([tall, wide], i) => <span key={i} className={styles.row} data-tall={tall ? "true" : undefined} data-wide={wide ? "true" : undefined} />)}
        </div>
      </div>
      <GlassTabBar
        className={styles.tabbar} label="Main" value={tab} onValueChange={setTab} scrollRef={scroller}
        items={[
          { value: "home", label: "Home", icon: <House size={24} strokeWidth={1.75} /> },
          { value: "explore", label: "Explore", icon: <Compass size={24} strokeWidth={1.75} /> },
          { value: "saved", label: "Saved", icon: <Bookmark size={24} strokeWidth={1.75} />, badge: 3 },
          { value: "profile", label: "Profile", icon: <UserRound size={24} strokeWidth={1.75} /> },
        ]}
        action={{ value: "search", label: "Search", icon: <Search size={24} strokeWidth={1.75} /> }}
      />
    </div>
  );
}
