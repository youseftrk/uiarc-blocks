"use client";

import { useState } from "react";
import { Archive, Inbox, RotateCcw, Trash2 } from "lucide-react";
import { UndoToast, UndoToastRow, UndoToastRowAction } from "./undo-toast";
import { portrait } from "./portraits";
import styles from "./undo-toast.module.css";

interface Thread { id: string; person: string; from: string; subject: string; preview: string; time: string; unread?: boolean }

const THREADS: Thread[] = [
  { id: "c1", person: "emma-collins", from: "Emma Collins", subject: "Brand review moved to Thursday", preview: "I pushed it to 2 pm so Daniel can join from Lisbon.", time: "9:41", unread: true },
  { id: "c2", person: "daniel-kim", from: "Daniel Kim", subject: "Invoice 2041 for September", preview: "Updated with the corrected VAT number, same total.", time: "9:12", unread: true },
  { id: "c3", person: "sofia-ramirez", from: "Sofia Ramirez", subject: "Offsite rooms are confirmed", preview: "All twelve rooms are held until Friday at noon.", time: "8:30" },
  { id: "c4", person: "marcus-johnson", from: "Marcus Johnson", subject: "Notes from the checkout crit", preview: "Three small fixes and one bigger question about tax.", time: "Mon" },
  { id: "c5", person: "olivia-bennett", from: "Olivia Bennett", subject: "Signed agreement attached", preview: "Countersigned and filed. Welcome aboard.", time: "Sun" },
  { id: "c6", person: "nathan-cole", from: "Nathan Cole", subject: "Access to the design repo", preview: "Approved for read access, ping me for write.", time: "Sat" },
];

export default function Demo() {
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const canRefill = threads.length < THREADS.length;
  return <div className={styles.demo}>
    <section className={styles.card} aria-labelledby="undo-toast-demo-title">
      <header className={styles.header}>
        <h3 id="undo-toast-demo-title" className={styles.heading}>Inbox</h3>
        <button type="button" className={styles.reset} data-visible={canRefill || undefined} disabled={!canRefill} aria-hidden={!canRefill || undefined} tabIndex={canRefill ? undefined : -1} onClick={() => setThreads(THREADS)}>
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Refill inbox
        </button>
      </header>
      <UndoToast
        className={styles.inbox}
        label="Conversations"
        items={threads}
        onItemsChange={setThreads}
        getKey={thread => thread.id}
        noun={["conversation", "conversations"]}
        empty={<div className={styles.emptyState}><Inbox size={20} strokeWidth={1.75} aria-hidden="true" /><span>All caught up</span></div>}
        renderItem={(thread, { remove }) => (
          <UndoToastRow
            label={`${thread.from}, ${thread.subject}`}
            unread={thread.unread}
            leading={/* eslint-disable-next-line @next/next/no-img-element -- an inline data URI */
              <img className={styles.avatar} src={portrait(thread.person)} alt="" width={36} height={36} draggable={false} />}
            title={<span className={styles.titleLine}><span className={styles.name}>{thread.from}</span><span className={styles.subject}>{thread.subject}</span></span>}
            description={thread.preview}
            meta={thread.time}
            shortcuts={{ e: () => remove("archive"), Backspace: () => remove("delete"), Delete: () => remove("delete") }}
            actions={<>
              <UndoToastRowAction label="Archive" icon={<Archive size={16} strokeWidth={1.75} aria-hidden="true" />} onClick={() => remove("archive")} />
              <UndoToastRowAction label="Delete" icon={<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />} onClick={() => remove("delete")} />
            </>}
          />
        )}
      />
    </section>
    <p className={styles.note}>Archive a few in a row, then undo with the button or ⌘Z. Nothing is sent.</p>
  </div>;
}
