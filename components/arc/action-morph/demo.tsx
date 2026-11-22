"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Check, ListTodo, StickyNote } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { useReducedMotion } from "../use-reduced-motion";
import { ActionMorph, type ActionMorphAction, type ActionMorphSubmission } from "./action-morph";
import styles from "./action-morph.module.css";

type Kind = "task" | "note" | "reminder";

interface Entry {
  id: number;
  kind: Kind;
  text: string;
  meta?: string;
  done?: boolean;
}

const ACTIONS: ActionMorphAction[] = [
  {
    id: "task",
    label: "Task",
    description: "Add to your list",
    icon: <ListTodo strokeWidth={1.75} />,
    shortcut: "t",
    composer: {
      title: "New task",
      placeholder: "What needs doing?",
      choices: { label: "Due", options: ["Today", "Tomorrow", "Next week"] },
      submitLabel: "Add task",
      successLabel: "Task added",
      emptyHint: "Give the task a title",
    },
  },
  {
    id: "note",
    label: "Note",
    description: "Private to you",
    icon: <StickyNote strokeWidth={1.75} />,
    shortcut: "n",
    composer: {
      title: "New note",
      placeholder: "Write it down",
      multiline: true,
      submitLabel: "Save note",
      successLabel: "Note saved",
      emptyHint: "Write something first",
    },
  },
  {
    id: "reminder",
    label: "Reminder",
    description: "Nudge me at a set time",
    icon: <BellRing strokeWidth={1.75} />,
    shortcut: "r",
    composer: {
      title: "New reminder",
      placeholder: "Remind me to…",
      choices: { label: "When", options: ["In 1 hour", "5:00 PM", "Tomorrow"], defaultValue: "5:00 PM" },
      submitLabel: "Set reminder",
      successLabel: "Reminder set",
      emptyHint: "Say what to remind you of",
    },
  },
];

const INITIAL: Entry[] = [
  { id: 1, kind: "task", text: "Review Emma’s onboarding flow", meta: "Today" },
  { id: 2, kind: "reminder", text: "Call Andre about the Q3 budget", meta: "4:30 PM" },
  { id: 3, kind: "task", text: "Send launch notes to Diane", meta: "Tomorrow", done: true },
  { id: 4, kind: "note", text: "Pricing page: lead with the free tier" },
];

const RESULTS = [
  { value: "succeed", label: "Saving works" },
  { value: "fail", label: "Saving fails" },
];

export default function Demo() {
  const reduced = useReducedMotion();
  const [entries, setEntries] = useState(INITIAL);
  const [result, setResult] = useState("succeed");
  const nextId = useRef(5);
  const open = entries.filter((entry) => entry.kind === "task" && !entry.done).length;

  const save = ({ action, text, choice }: ActionMorphSubmission) =>
    new Promise<void>((resolve, reject) => {
      window.setTimeout(() => {
        if (result === "fail") {
          reject(new Error("Save failed"));
          return;
        }
        const id = nextId.current++;
        setEntries((prev) => [{ id, kind: action as Kind, text, meta: choice }, ...prev]);
        resolve();
      }, 600);
    });

  return (
    <div className={styles.dDemo}>
      <div className={styles.dStage}>
        <header className={styles.dHeader}>
          <h3 className={styles.dTitle}>Today</h3>
          <p className={styles.dCount} aria-live="polite">
            <span className={styles.dNumber}>{open}</span> open {open === 1 ? "task" : "tasks"}
          </p>
        </header>
        <ul className={styles.dList}>
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout={reduced ? false : "position"}
                className={styles.dItem}
                initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", y: -8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
              >
                {entry.kind === "task" ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!entry.done}
                    aria-label={`Mark “${entry.text}” done`}
                    className={styles.dCheck}
                    data-on={entry.done ? true : undefined}
                    onClick={() =>
                      setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, done: !item.done } : item)))
                    }
                  >
                    <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                ) : (
                  <span className={styles.dKind} aria-hidden="true">
                    {entry.kind === "reminder" ? (
                      <BellRing size={16} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <StickyNote size={16} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </span>
                )}
                <span className={styles.dText} data-done={entry.done ? true : undefined}>
                  {entry.text}
                </span>
                {entry.meta ? <span className={styles.dMeta}>{entry.meta}</span> : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className={styles.dCorner}>
          <ActionMorph label="Create" actions={ACTIONS} onSubmit={save} />
        </div>
      </div>
      <div className={styles.dControls}>
        <SegmentedControl label="Save result" options={RESULTS} value={result} onValueChange={setResult} />
      </div>
    </div>
  );
}
