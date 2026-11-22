"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, Share2 } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import { ShareAccess } from "./share-access";
import type { ShareAccessContact, ShareAccessMember } from "./share-access";
import styles from "./share-access.module.css";

const INITIAL_MEMBERS: ShareAccessMember[] = [
  {
    id: "jasmine",
    name: "Jasmine Brooks",
    email: "jasmine.brooks@fieldwork.example",
    role: "owner",
  },
  {
    id: "nathan",
    name: "Nathan Cole",
    email: "nathan.cole@fieldwork.example",
    role: "editor",
  },
  {
    id: "chloe",
    name: "Chloe Nguyen",
    email: "chloe.nguyen@fieldwork.example",
    role: "commenter",
  },
  {
    id: "daniel",
    name: "Daniel Kim",
    email: "daniel.kim@fieldwork.example",
    role: "viewer",
  },
];

const DIRECTORY: ShareAccessContact[] = [
  { name: "Maya Patel", email: "maya.patel@fieldwork.example" },
  { name: "Liam O’Connor", email: "liam.oconnor@fieldwork.example" },
  { name: "Sofia Reyes", email: "sofia.reyes@fieldwork.example" },
  { name: "Noah Park", email: "noah.park@fieldwork.example" },
  { name: "Hannah Lin", email: "hannah.lin@fieldwork.example" },
];

export default function ShareAccessDemo() {
  const [open, setOpen] = useState(true);
  const reducedMotion = useReducedMotion();

  return (
    <div className={styles.demo}>
      <div className={styles.bar}>
        <span className={styles.doc}>
          <FileText size={16} aria-hidden="true" />
          <span>Q3 launch plan</span>
        </span>
        <button
          type="button"
          className={styles.share}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Share2 size={14} aria-hidden="true" />
          <span>Share</span>
        </button>
      </div>

      <div className={styles.stage}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              className={styles.popover}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
              transition={
                reducedMotion ? { duration: 0 } : motionTokens.spring.snappy
              }
            >
              <ShareAccess
                title="Q3 launch plan"
                defaultMembers={INITIAL_MEMBERS}
                directory={DIRECTORY}
                selfId="jasmine"
                link="https://fieldwork.example/docs/q3-launch-plan"
                onDone={() => setOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
