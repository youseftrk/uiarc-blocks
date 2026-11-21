"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Shuffle } from "lucide-react";
import styles from "./starter-prompts.module.css";

export interface StarterCategory {
  id: string;
  label: string;
}

export interface StarterPrompt {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  app?: "gmail" | "github" | "notion" | "linear" | "calendar" | string;
}

export interface StarterPromptsProps {
  greeting?: string;
  categories?: StarterCategory[];
  prompts?: StarterPrompt[];
  onSelect?: (prompt: StarterPrompt) => void;
  onSubmit?: (message: string, opts: { signal: AbortSignal }) => void | Promise<unknown>;
  className?: string;
}

const DEFAULT_CATEGORIES: StarterCategory[] = [
  { id: "write", label: "Write" },
  { id: "code", label: "Code" },
  { id: "analyze", label: "Analyze" },
  { id: "plan", label: "Plan" },
];

const DEFAULT_PROMPTS: StarterPrompt[] = [
  {
    id: "w1",
    category: "write",
    app: "gmail",
    title: "Draft customer follow-ups",
    description: "Summarize 4 open threads and prepare concise replies",
    prompt: "Review my 4 latest customer threads in Gmail and draft concise follow-up replies.",
  },
  {
    id: "w2",
    category: "write",
    app: "notion",
    title: "Release notes for v2.4",
    description: "Turn merged PR titles into user-facing changelog highlights",
    prompt: "Write concise v2.4 release notes grouped by features and fixes.",
  },
  {
    id: "w3",
    category: "write",
    title: "Tighten onboarding copy",
    description: "Shorten hero and empty-state copy without losing clarity",
    prompt: "Rewrite our onboarding empty states to be crisp, active, and under 18 words each.",
  },
  {
    id: "w4",
    category: "write",
    title: "Executive weekly update",
    description: "Distill milestones, blockers, and next week’s priorities",
    prompt: "Draft a 5-bullet weekly engineering update covering shipped work and key risks.",
  },
  {
    id: "c1",
    category: "code",
    app: "github",
    title: "Review open pull requests",
    description: "Flag edge cases and missing tests across recent diffs",
    prompt: "Inspect my open GitHub PRs and summarize any regressions or untested branches.",
  },
  {
    id: "c2",
    category: "code",
    title: "Add keyboard shortcuts",
    description: "Wire Cmd+K search and arrow navigation with ARIA support",
    prompt: "Add accessible keyboard navigation and Cmd+K shortcut support to our command menu.",
  },
  {
    id: "a1",
    category: "analyze",
    app: "linear",
    title: "Triage P1 bug backlog",
    description: "Cluster duplicate reports and rank by customer impact",
    prompt: "Group open P1 issues in Linear by root cause and suggest an engineering owner.",
  },
  {
    id: "a2",
    category: "analyze",
    title: "Compare conversion funnels",
    description: "Spot drop-offs between trial signup and first project",
    prompt: "Analyze activation funnel drop-offs between signup and first published project.",
  },
  {
    id: "p1",
    category: "plan",
    app: "calendar",
    title: "Prep tomorrow’s design review",
    description: "Pull open questions and build a 30-minute agenda",
    prompt: "Build a 30-minute agenda for tomorrow’s design review using my calendar and open specs.",
  },
  {
    id: "p2",
    category: "plan",
    title: "Break down Q3 launch",
    description: "Split milestones into weekly shippable slices",
    prompt: "Create a 4-week launch checklist with clear owners and verification gates.",
  },
];

export function StarterPrompts({
  greeting = "Good morning, Maya",
  categories = DEFAULT_CATEGORIES,
  prompts = DEFAULT_PROMPTS,
  onSelect,
  onSubmit,
  className,
}: StarterPromptsProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "write");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const visible = useMemo(() => {
    const filtered = prompts.filter((p) => p.category === activeCategory);
    const list = filtered.length > 0 ? filtered : prompts;
    const rotated = list.map((_, idx) => list[(idx + shuffleSeed) % list.length]);
    return rotated.slice(0, 4);
  }, [prompts, activeCategory, shuffleSeed]);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const ac = new AbortController();
    try {
      await onSubmit?.(trimmed, { signal: ac.signal });
      setLastSent(trimmed);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <h2 className={styles.greeting}>{greeting}</h2>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.id}
              className={`${styles.tab} ${
                activeCategory === cat.id ? styles.tabActive : ""
              }`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.shuffleBtn}
          onClick={() => setShuffleSeed((s) => s + 1)}
        >
          <Shuffle size={12} />
          Shuffle
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeCategory}-${shuffleSeed}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          className={styles.grid}
        >
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.card}
              onClick={() => {
                setValue(item.prompt);
                setLastSent(null);
                onSelect?.(item);
              }}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{item.title}</span>
                {item.app && <span className={styles.appBadge}>{item.app}</span>}
              </div>
              <span className={styles.cardDesc}>{item.description}</span>
            </button>
          ))}
        </motion.div>
      </AnimatePresence>

      <div className={styles.composer}>
        <input
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Ask anything or pick a starter above..."
          aria-label="Prompt composer"
        />
        <button
          type="button"
          className={styles.sendBtn}
          disabled={!value.trim() || sending}
          onClick={handleSend}
          aria-label="Send prompt"
        >
          <ArrowUp size={15} />
        </button>
      </div>

      {lastSent && (
        <div className={styles.sentNote} role="status">
          Sent: “{lastSent}”
        </div>
      )}
    </div>
  );
}
