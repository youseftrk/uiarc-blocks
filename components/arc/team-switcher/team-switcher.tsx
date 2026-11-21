"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import styles from "./team-switcher.module.css";

export interface TeamWorkspace {
  id: string;
  name: string;
  plan?: string;
  members?: number;
  role?: string;
}

export interface TeamSwitcherProps {
  workspaces: TeamWorkspace[];
  value: string;
  onValueChange: (id: string) => void;
  onSwitch?: (ws: TeamWorkspace) => void | Promise<unknown>;
  onCreate?: (name: string) => void;
  className?: string;
}

export function TeamSwitcher({
  workspaces,
  value,
  onValueChange,
  onSwitch,
  onCreate,
  className,
}: TeamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const active = workspaces.find((w) => w.id === value) ?? workspaces[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.plan ?? "").toLowerCase().includes(q)
    );
  }, [workspaces, query]);

  const selectWorkspace = async (ws: TeamWorkspace) => {
    setOpen(false);
    setQuery("");
    if (ws.id === value) return;
    setSwitching(true);
    try {
      await onSwitch?.(ws);
      onValueChange(ws.id);
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const target = workspaces[idx];
        if (target) {
          e.preventDefault();
          void selectWorkspace(target);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={styles.wsLeft}>
          <span className={styles.mark}>
            {switching ? (
              <Loader2 size={14} />
            ) : (
              active?.name[0]?.toUpperCase() ?? "W"
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className={styles.wsName}>{active?.name ?? "Workspace"}</div>
            <div className={styles.wsMeta}>
              {active?.plan ?? "Free"}
              {active?.members ? ` · ${active.members} members` : ""}
            </div>
          </div>
        </div>
        <ChevronsUpDown size={14} style={{ color: "var(--text-muted)", flex: "none" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={styles.popover}
            role="listbox"
          >
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find workspace..."
              aria-label="Filter workspaces"
              autoFocus
            />

            <div className={styles.list}>
              {filtered.map((ws, idx) => (
                <button
                  key={ws.id}
                  type="button"
                  role="option"
                  aria-selected={ws.id === value}
                  className={styles.row}
                  onClick={() => void selectWorkspace(ws)}
                >
                  <div className={styles.wsLeft}>
                    <span className={styles.mark} style={{ width: 24, height: 24, fontSize: 11 }}>
                      {ws.name[0]?.toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.wsName}>{ws.name}</div>
                      <div className={styles.wsMeta}>{ws.role ?? ws.plan}</div>
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    {ws.id === value && <Check size={13} style={{ color: "var(--accent)" }} />}
                    <span className={styles.kbd}>⌘{idx + 1}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            {!creating ? (
              <button
                type="button"
                className={styles.createBtn}
                onClick={() => setCreating(true)}
              >
                <Plus size={14} />
                Create workspace
              </button>
            ) : (
              <div className={styles.createRow}>
                <input
                  className={styles.search}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      onCreate?.(newName.trim());
                      setNewName("");
                      setCreating(false);
                      setOpen(false);
                    }
                  }}
                  autoFocus
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
