"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, SmilePlus } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import { EmojiPicker } from "./emoji-picker";
import styles from "./emoji-picker.module.css";

/** Gradient avatars drawn inline, so the demo needs no image files. */
interface FaceSpec { base: string; blur: number; spots: [color: string, cx: number, cy: number, r: number][]; hi: number[] }

const FALLOFF = [[0, 1], [.15, .966], [.3, .868], [.45, .712], [.6, .512], [.72, .334], [.84, .16], [1, 0]];
const RECT = '<rect x="-55" y="-55" width="210" height="210" fill="';

const FACES: Record<string, FaceSpec> = {
  "jordan-reyes": {"base":"#f028bd","blur":11.0,"spots":[["#f028bd",91.7,2.9,97.6],["#83f15f",24.6,62.7,91.5],["#76edcf",83.0,14.5,82.4],["#83f15f",64.1,60.0,71.1],["#83f15f",60.4,72.5,68.8],["#76edcf",58.6,99.7,66.5],["#76edcf",57.3,63.2,63.6],["#f028bd",63.4,39.3,60.8],["#f028bd",24.4,43.0,59.0],["#f028bd",29.6,48.1,43.6]],"hi":[49.2,33.0,43.2,0.15]},
  "chloe-nguyen": {"base":"#6611f4","blur":11.0,"spots":[["#bc4bea",53.4,51.4,98.2],["#6611f4",42.4,16.0,94.2],["#bc4bea",55.1,60.0,79.6],["#6611f4",57.1,28.5,78.9],["#abf82b",46.1,67.4,78.8],["#58fa16",42.1,49.1,74.6],["#6611f4",37.5,36.9,73.2],["#bc4bea",103.0,62.0,67.0],["#abf82b",52.8,112.1,64.6],["#58fa16",13.4,63.6,63.1],["#abf82b",82.7,25.6,51.2]],"hi":[35.7,45.3,43.2,0.15]},
  "emma-collins": {"base":"#ee6019","blur":11.0,"spots":[["#7a40ef",42.2,62.8,97.1],["#66fb98",48.6,68.0,89.9],["#66fb98",112.4,78.4,87.7],["#ee6019",39.4,66.3,75.2],["#ee6019",57.0,19.6,68.0],["#ee6019",37.6,50.0,67.3],["#ee6019",46.6,25.9,63.8],["#66fb98",47.5,15.8,63.6],["#7a40ef",75.7,39.1,53.5],["#66fb98",94.4,47.2,46.5],["#7a40ef",37.2,25.5,45.3]],"hi":[35.0,40.3,43.2,0.15]},
};

const cache = new Map<string, string>();

function face(id: string): string {
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = FACES[id];
  if (!spec) return "";
  const gradients = spec.spots.map(([color, cx, cy, r], i) => `<radialGradient id="s${i}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">${FALLOFF.map(([offset, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</radialGradient>`).join("");
  const [hx, hy, hr, ho] = spec.hi;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100"><defs>${gradients}<radialGradient id="h" cx="${hx}" cy="${hy}" r="${hr}" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity="${ho}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="b" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${spec.blur}"/><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter></defs><g filter="url(#b)">${RECT}${spec.base}"/>${spec.spots.map((_, i) => `${RECT}url(#s${i})"/>`).join("")}${RECT}url(#h)"/></g></svg>`;
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(id, uri);
  return uri;
}

interface Message { id: number; author: string; photo: string; text: string }

const MESSAGES: Message[] = [
  { id: 1, author: "Jordan Reyes", photo: "jordan-reyes", text: "Launch checklist is green. Shipping the pricing page at 3pm unless anyone objects." },
  { id: 2, author: "Chloe Nguyen", photo: "chloe-nguyen", text: "Copy is final and the screenshots are swapped in." },
];

export default function Demo() {
  const [messages, setMessages] = useState(MESSAGES);
  const [draft, setDraft] = useState("Looks great, ship it ");
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (field && caret.current !== null) field.setSelectionRange(caret.current, caret.current);
  }, [draft]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages(list => [...list, { id: Date.now(), author: "You", photo: "emma-collins", text }]);
    setDraft("");
    caret.current = 0;
    selection.current = { start: 0, end: 0 };
    requestAnimationFrame(() => listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }));
  };

  const insert = (emoji: string) => {
    const { start, end } = selection.current ?? { start: draft.length, end: draft.length };
    const next = start + emoji.length;
    caret.current = next;
    selection.current = { start: next, end: next };
    setDraft(value => value.slice(0, start) + emoji + value.slice(end));
  };

  return (
    <div className={styles.dDemo}>
      <section className={styles.dThread} aria-label="Launch channel">
        <ol ref={listRef} className={styles.dMessages}>
          {messages.map(message => (
            <li key={message.id} className={styles.dMessage}>
              <Avatar name={message.author} src={face(message.photo)} size="sm" />
              <div className={styles.dBody}>
                <span className={styles.dAuthor}>{message.author}</span>
                <p className={styles.dText}>{message.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <form className={styles.dComposer} onSubmit={event => { event.preventDefault(); send(); }}>
          <label className={styles.dSrOnly} htmlFor="emoji-demo-message">Message</label>
          <textarea
            id="emoji-demo-message"
            ref={fieldRef}
            className={styles.dField}
            rows={2}
            value={draft}
            placeholder="Message #launch"
            onChange={event => { caret.current = null; setDraft(event.target.value); }}
            onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
            onKeyDown={event => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              send();
            }}
          />
          <div className={styles.dToolbar}>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className={styles.dIconButton} aria-label="Add emoji" data-open={open || undefined}>
                <SmilePlus width={18} height={18} strokeWidth={1.75} aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className={styles.dPickerPopover}
                onCloseAutoFocus={event => {
                  event.preventDefault();
                  fieldRef.current?.focus({ preventScroll: true });
                }}
              >
                <EmojiPicker onSelect={(picked, event) => { insert(picked.emoji); if (!event.shiftKey) setOpen(false); }} />
              </PopoverContent>
            </Popover>
            <span className={styles.dHint}>Shift picks several</span>
            <button type="submit" className={styles.dSend} disabled={!draft.trim()} aria-label="Send message">
              <ArrowUp width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
