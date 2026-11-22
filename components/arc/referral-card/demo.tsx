"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import { ReferralCard } from "./referral-card";
import type { Referral } from "./referral-card";
import styles from "./referral-card.module.css";

const INITIAL_REFERRALS: Referral[] = [
  {
    id: "ref-1",
    name: "Priya Nair",
    email: "priya@linear.app",
    stage: "earned",
    invitedAt: "2 days ago",
  },
  {
    id: "ref-2",
    name: "Marcus Lindholm",
    email: "marcus@vercel.com",
    stage: "earned",
    invitedAt: "5 days ago",
  },
  {
    id: "ref-3",
    name: "Elena Rostova",
    email: "elena@stripe.com",
    stage: "earned",
    invitedAt: "1 week ago",
  },
  {
    id: "ref-4",
    name: "Devon Brooks",
    email: "devon@raycast.com",
    stage: "earned",
    invitedAt: "2 weeks ago",
  },
  {
    id: "ref-5",
    name: "Sora Takahashi",
    email: "sora@figma.com",
    stage: "signed-up",
    invitedAt: "3 days ago",
  },
  {
    id: "ref-6",
    name: "Hannah Park",
    email: "hannah@notion.so",
    stage: "invited",
    invitedAt: "Yesterday",
  },
];

export default function ReferralCardDemo() {
  const [runKey, setRunKey] = useState(0);

  return (
    <div className={styles.demo}>
      <ReferralCard
        key={runKey}
        link="https://uiarc.dev/r/maya"
        reward={20}
        referrals={INITIAL_REFERRALS}
        milestone={{
          goal: 5,
          reward: "1 free month of Pro",
          detail: "Applied automatically",
        }}
        simulate
      />
      <Button
        variant="ghost"
        size="sm"
        className={styles.replay}
        onClick={() => setRunKey((k) => k + 1)}
      >
        <RotateCcw size={13} aria-hidden="true" />
        Reset demo
      </Button>
    </div>
  );
}
