"use client";

import { Headphones, Sunset, UsersRound } from "lucide-react";
import { ControlCenter } from "./control-center";
import emily from "./avatars/emily.svg";
import tyler from "./avatars/tyler.svg";
import ryan from "./avatars/ryan.svg";
import styles from "./control-center.module.css";

const focusModes = [
  { id: "deep", label: "Deep work", icon: Headphones, description: "Only mentions from your team get through", defaultMinutes: 50 },
  { id: "meetings", label: "Meetings", icon: UsersRound, description: "Chat is held, calendar alerts stay on", defaultMinutes: 30 },
  { id: "wind-down", label: "Wind down", icon: Sunset, description: "Everything waits until tomorrow morning", defaultMinutes: 90 },
];
const channels = [
  { id: "mentions", label: "Mentions", description: "When someone tags you", defaultOn: true },
  { id: "direct", label: "Direct messages", description: "One to one and small groups", defaultOn: true },
  { id: "deploys", label: "Deploy alerts", description: "Failed builds on main" },
];
const src = (file: string | { src: string }) => typeof file === "string" ? file : file.src;
const people = [
  { id: "emily", name: "Emily", avatar: src(emily) },
  { id: "tyler", name: "Tyler", avatar: src(tyler) },
  { id: "ryan", name: "Ryan", avatar: src(ryan) },
];

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ControlCenter focusModes={focusModes} channels={channels} people={people} defaultVolume={64} label="Workspace quick settings" />
    </div>
  );
}
