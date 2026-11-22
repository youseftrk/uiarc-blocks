"use client";

import { useState } from "react";
import { Bookmark, Home, Inbox, User } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import {
  LiquidTabBar,
  liquidPanelId,
  liquidTabId,
  type LiquidTabItem,
} from "./liquid-tab-bar";
import styles from "./liquid-tab-bar.module.css";

type LabelMode = "active" | "always" | "none";

const NOTES: Record<string, string> = {
  home: "Grab the active pill and drag or flick across tabs.",
  saved: "Saved views and bookmarked items.",
  inbox: "2 unread updates waiting in your inbox.",
  profile: "Workspace preferences and account settings.",
};

export default function LiquidTabBarDemo() {
  const [tab, setTab] = useState("home");
  const [labelMode, setLabelMode] = useState<LabelMode>("active");

  const tabs: LiquidTabItem[] = [
    { value: "home", label: "Home", icon: <Home strokeWidth={1.75} /> },
    { value: "saved", label: "Saved", icon: <Bookmark strokeWidth={1.75} /> },
    {
      value: "inbox",
      label: "Inbox",
      icon: <Inbox strokeWidth={1.75} />,
      badge: 2,
      badgeLabel: "2 unread",
    },
    { value: "profile", label: "Profile", icon: <User strokeWidth={1.75} /> },
  ];

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <LiquidTabBar
          id="demo-liquid"
          value={tab}
          onValueChange={setTab}
          labels={labelMode}
          tabs={tabs}
        />
        <div
          id={liquidPanelId("demo-liquid", tab)}
          role="tabpanel"
          aria-labelledby={liquidTabId("demo-liquid", tab)}
          className={styles.noteRow}
        >
          <p className={styles.note}>{NOTES[tab]}</p>
        </div>
      </div>
      <div className={styles.modes}>
        <SegmentedControl
          label="Label display"
          value={labelMode}
          onValueChange={(v: string) => setLabelMode(v as LabelMode)}
          options={[
            { value: "active", label: "Active" },
            { value: "always", label: "Always" },
            { value: "none", label: "Icons" },
          ]}
        />
      </div>
    </div>
  );
}
