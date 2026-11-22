"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Trash } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../button/button";
import { motionTokens } from "../motion-tokens";
import { PEOPLE } from "../people";
import { useReducedMotion } from "../use-reduced-motion";
import { BlackHole, type BlackHoleHandle } from "./black-hole";
import styles from "./black-hole.module.css";

const MAIL = [
  { id: "a", from: PEOPLE[0], subject: "Onboarding copy, second pass", time: "9:41" },
  { id: "b", from: PEOPLE[1], subject: "Your weekly usage report", time: "9:12" },
  { id: "c", from: PEOPLE[2], subject: "Design review moved to Thursday", time: "8:30" },
  { id: "d", from: PEOPLE[3], subject: "Invoice 2381 is ready", time: "Yesterday" },
  { id: "e", from: PEOPLE[4], subject: "Quarterly planning notes", time: "Yesterday" },
];

export default function Demo() {
  const reduced = !!useReducedMotion();
  const hole = useRef<BlackHoleHandle>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [mail, setMail] = useState(MAIL);
  const [selected, setSelected] = useState(["b", "d"]);
  const [deleted, setDeleted] = useState<typeof MAIL>([]);
  const [restoring, setRestoring] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    await hole.current?.swallow(selected.map(id => rows.current.get(id)).filter(Boolean) as HTMLLIElement[]);
    setDeleted(MAIL.filter(item => selected.includes(item.id)));
    setMail(items => items.filter(item => !selected.includes(item.id)));
    setSelected([]);
    setBusy(false);
  };

  useLayoutEffect(() => {
    if (!restoring.length) return;
    const elements = restoring.map(id => rows.current.get(id)).filter(Boolean) as HTMLLIElement[];
    hole.current?.release(elements).then(() => {
      setRestoring([]);
      setBusy(false);
    });
  }, [restoring]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Backspace" || event.key === "Delete") && selected.length && (event.target as Element | null)?.closest?.("[data-inbox]")) {
        event.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const spring = reduced ? { duration: 0 } : motionTokens.spring.smooth;

  return (
    <div className={styles.dDemo} data-inbox>
      <div className={styles.dPanel}>
        <div className={styles.dHead}>
          <span className={styles.dTitle}>Inbox</span>
          <AnimatePresence initial={false} mode="popLayout">
            {selected.length > 0 && (
              <motion.div
                key="delete"
                initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                transition={{ duration: motionTokens.duration.fast }}
              >
                <Button variant="secondary" size="sm" onClick={remove} disabled={busy}>
                  <Trash size={16} strokeWidth={1.75} aria-hidden />
                  Delete {selected.length}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <BlackHole ref={hole}>
          <ul className={styles.dList}>
            <AnimatePresence initial={false}>
              {mail.map(item => {
                const on = selected.includes(item.id);
                return (
                  <motion.li
                    key={item.id}
                    ref={node => {
                      if (node) rows.current.set(item.id, node);
                      else rows.current.delete(item.id);
                    }}
                    className={styles.dItem}
                    layout="position"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ height: spring, layout: spring }}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className={styles.dRow}
                      data-on={on || undefined}
                      onClick={() => setSelected(ids => (ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id]))}
                      disabled={busy}
                    >
                      <span className={styles.dCheck} aria-hidden>
                        {on && <Check size={12} strokeWidth={2.5} />}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.dAvatar} src={item.from.src} alt="" width={32} height={32} draggable={false} />
                      <span className={styles.dText}>
                        <span className={styles.dName}>{item.from.name}</span>
                        <span className={styles.dSubject}>{item.subject}</span>
                      </span>
                      <span className={styles.dTime}>{item.time}</span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </BlackHole>
      </div>
      <div className={styles.dStatus}>
        <AnimatePresence initial={false}>
          {deleted.length > 0 && (
            <motion.div
              key="toast"
              className={styles.dToast}
              initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
              transition={motionTokens.spring.smooth}
            >
              <span role="status">{deleted.length === 1 ? "1 conversation deleted" : `${deleted.length} conversations deleted`}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!deleted.length || busy) return;
                  const ids = deleted.map(item => item.id);
                  setBusy(true);
                  setMail(items => MAIL.filter(item => ids.includes(item.id) || items.some(other => other.id === item.id)));
                  setRestoring(ids);
                  setDeleted([]);
                }}
              >
                Undo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
