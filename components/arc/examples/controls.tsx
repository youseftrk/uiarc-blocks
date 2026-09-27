"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Copy,
  Heart,
  Lightbulb,
  PartyPopper,
  Plus,
  Rocket,
  SmilePlus,
  ThumbsUp,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatedCounter } from "../animated-counter";
import { SegmentedControl } from "../segmented-control";
import { motionTokens, cx } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./controls.module.css";

/* ---------------------------------- Switch --------------------------------- */

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}) {
  const reduced = useReducedMotion();
  const [pressing, setPressing] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-state={checked ? "checked" : "unchecked"}
      className={styles.switch}
      onClick={() => onCheckedChange(!checked)}
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => setPressing(false)}
      onPointerLeave={() => setPressing(false)}
    >
      <motion.span
        className={styles.thumb}
        layout={!reduced}
        transition={motionTokens.spring.snappy}
        animate={{ width: pressing ? 26 : 20 }}
      />
    </button>
  );
}

/* ---------------------------------- Slider --------------------------------- */

export function Slider({
  label,
  defaultValue = 50,
  min = 0,
  max = 100,
}: {
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  const fromPointer = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setValue(Math.round(min + ratio * (max - min)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1;
    const map: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + 10,
      PageDown: value - 10,
      Home: min,
      End: max,
    };
    if (!(event.key in map)) return;
    event.preventDefault();
    setValue(Math.min(max, Math.max(min, map[event.key])));
  };

  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <span id={id}>{label}</span>
        <span className={styles.sliderValue}><AnimatedCounter value={value} /></span>
      </div>
      <div
        ref={track}
        className={styles.sliderTrack}
        data-dragging={dragging || undefined}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          fromPointer(event.clientX);
          event.currentTarget.querySelector<HTMLElement>("[role=slider]")?.focus();
        }}
        onPointerMove={(event) => dragging && fromPointer(event.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <span className={styles.sliderFill} style={{ width: `${pct}%` }} />
        <span
          role="slider"
          tabIndex={0}
          aria-labelledby={id}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className={styles.sliderThumb}
          style={{ left: `${pct}%` }}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}

/* -------------------------------- CopyButton ------------------------------- */

export function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<number | undefined>(undefined);
  const reduced = useReducedMotion();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      setState("error");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1900);
  };

  const Icon = state === "copied" ? Check : state === "error" ? X : Copy;
  return (
    <div className={styles.command}>
      <code>{command}</code>
      <button
        type="button"
        className={styles.copy}
        aria-label="Copy command"
        data-state={state}
        onClick={copy}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state}
            className={styles.copyIcon}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(4px)" }}
            transition={motionTokens.spring.snappy}
          >
            <Icon size={16} aria-hidden />
          </motion.span>
        </AnimatePresence>
      </button>
      <span className={styles.srOnly} role="status">
        {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : ""}
      </span>
    </div>
  );
}

/* ------------------------------ HoldToConfirm ------------------------------ */

export function HoldToConfirm({
  label,
  confirmedLabel,
  duration = 1200,
}: {
  label: string;
  confirmedLabel: string;
  duration?: number;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const frame = useRef(0);
  const start = useRef(0);
  const reset = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setHolding(false);
    setProgress(0);
  }, []);

  const begin = () => {
    if (confirmed || holding) return;
    setHolding(true);
    start.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start.current) / duration);
      setProgress(p);
      if (p < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      setHolding(false);
      setConfirmed(true);
      setProgress(0);
      reset.current = window.setTimeout(() => setConfirmed(false), 1800);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(reset.current);
    },
    [],
  );

  const isKey = (event: KeyboardEvent) => event.key === " " || event.key === "Enter";

  return (
    <button
      type="button"
      className={styles.hold}
      data-holding={holding || undefined}
      data-confirmed={confirmed || undefined}
      aria-label={confirmed ? confirmedLabel : `${label}, press and hold`}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        begin();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={() => holding && stop()}
      onBlur={stop}
      onKeyDown={(event) => {
        if (!isKey(event) || event.repeat) return;
        event.preventDefault();
        begin();
      }}
      onKeyUp={(event) => isKey(event) && stop()}
      onClick={(event) => event.preventDefault()}
    >
      <span className={styles.holdFill} style={{ transform: `scaleX(${progress})` }} />
      <span className={styles.holdFace}>
        {confirmed ? <Check size={16} aria-hidden /> : <Trash2 size={16} aria-hidden />}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={confirmed ? "done" : "idle"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={motionTokens.spring.snappy}
          >
            {confirmed ? confirmedLabel : label}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

/* --------------------------------- Reactions -------------------------------- */

type ReactionOption = { id: string; label: string; Icon: LucideIcon };
type Reaction = { id: string; count: number; reacted: boolean };

const reactionOptions: ReactionOption[] = [
  { id: "like", label: "Like", Icon: ThumbsUp },
  { id: "love", label: "Love", Icon: Heart },
  { id: "celebrate", label: "Celebrate", Icon: PartyPopper },
  { id: "insightful", label: "Insightful", Icon: Lightbulb },
  { id: "ship", label: "Ship it", Icon: Rocket },
];

export function Reactions() {
  const [items, setItems] = useState<Reaction[]>([
    { id: "ship", count: 24, reacted: false },
    { id: "love", count: 9, reacted: true },
    { id: "insightful", count: 3, reacted: false },
  ]);
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const toggle = (id: string) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === id);
      if (!existing) return [...current, { id, count: 1, reacted: true }];
      return current
        .map((item) =>
          item.id === id
            ? { ...item, reacted: !item.reacted, count: item.count + (item.reacted ? -1 : 1) }
            : item,
        )
        .filter((item) => item.count > 0);
    });
  };

  useEffect(() => {
    if (!open) return;
    pickerRef.current?.querySelector<HTMLElement>("button")?.focus();
    const close = (event: MouseEvent) => {
      if (!pickerRef.current?.parentElement?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const onPickerKey = (event: KeyboardEvent) => {
    const buttons = Array.from(pickerRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    buttons[(index + delta + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div className={styles.reactions} role="group" aria-label="React to this release">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const option = reactionOptions.find((o) => o.id === item.id);
          if (!option) return null;
          return (
            <motion.button
              layout={!reduced}
              key={item.id}
              type="button"
              className={styles.pill}
              aria-pressed={item.reacted}
              aria-label={`${option.label}, ${item.count} reactions${item.reacted ? ", including yours" : ""}`}
              onClick={() => toggle(item.id)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              whileTap={reduced ? undefined : { scale: 0.92 }}
              transition={motionTokens.spring.snappy}
            >
              <option.Icon size={14} aria-hidden />
              <span className={styles.pillCount}>
                <AnimatedCounter value={item.count} />
              </span>
            </motion.button>
          );
        })}
        <motion.span layout={!reduced} key="add" className={styles.addWrap}>
          <button
            type="button"
            className={styles.add}
            aria-label="Add reaction"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <SmilePlus size={16} aria-hidden />
            <Plus size={10} aria-hidden className={styles.addPlus} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                ref={pickerRef}
                className={styles.picker}
                role="toolbar"
                aria-label="Pick a reaction"
                onKeyDown={onPickerKey}
                initial={{ opacity: 0, y: 6, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.94 }}
                transition={motionTokens.spring.snappy}
              >
                {reactionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => {
                      toggle(option.id);
                      setOpen(false);
                    }}
                  >
                    <option.Icon size={18} aria-hidden />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------- NumberField ------------------------------- */

export function NumberField({
  label,
  defaultValue,
  min,
  max,
}: {
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const set = (n: number) => {
    const next = clamp(n);
    if (next === value) setBump((b) => b + 1);
    setValue(next);
  };

  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft.replace(/[^\d-]/g, ""), 10);
    if (!Number.isNaN(parsed)) set(parsed);
    setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const map: Record<string, number> = {
      ArrowUp: value + 1,
      ArrowDown: value - 1,
      PageUp: value + 10,
      PageDown: value - 10,
      Home: min,
      End: max,
    };
    if (event.key === "Enter") commit();
    if (!(event.key in map)) return;
    event.preventDefault();
    setDraft(null);
    set(map[event.key]);
  };

  return (
    <div className={styles.numberField}>
      <label htmlFor={id}>{label}</label>
      <motion.div
        key={bump}
        className={styles.numberControl}
        animate={bump ? { x: [0, -4, 4, -2, 0] } : undefined}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => set(value - 1)}
        >
          −
        </button>
        <span className={styles.numberValue}>
          <input
            id={id}
            role="spinbutton"
            inputMode="numeric"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`${value} seats`}
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
          {draft === null && (<span className={styles.numberDisplay} aria-hidden><AnimatedCounter value={value} /></span>)}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => set(value + 1)}
        >
          +
        </button>
      </motion.div>
      <small className={styles.hint}>
        {min}–{max}
      </small>
    </div>
  );
}

/* -------------------------------- WordRotate -------------------------------- */

export function WordRotate({
  prefix,
  words,
  interval = 2200,
}: {
  prefix: string;
  words: string[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => window.clearInterval(timer);
  }, [interval, words.length]);

  const word = words[index];
  return (
    <p className={styles.rotate}>
      <span className={styles.srOnly}>
        {prefix}
        {words[0]}
      </span>
      <span aria-hidden>
        {prefix}
        <span className={styles.rotateFrame}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={word} className={styles.rotateWord}>
              {Array.from(word).map((char, i) => (
                <motion.span
                  key={`${char}-${i}`}
                  className={styles.rotateChar}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.6em", filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-0.6em", filter: "blur(6px)" }}
                  transition={{
                    ...motionTokens.spring.smooth,
                    delay: reduced ? 0 : i * motionTokens.stagger.char * 1.5,
                  }}
                >
                  {char === " " ? "\u00a0" : char}
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    </p>
  );
}

export function SwitchRow() {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span>Release notes</span>
        <small className={cx(styles.muted)}>{enabled ? "Emailed on launch day" : "Paused"}</small>
      </span>
      <Switch checked={enabled} onCheckedChange={setEnabled} label="Email release notes" />
    </div>
  );
}

export function SegmentedTile() {
  const [value, setValue] = useState<"day" | "week" | "month">("week");
  return (
    <SegmentedControl
      label="Range"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ]}
    />
  );
}
