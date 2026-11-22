"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { Check, CircleAlert, HeartHandshake, PenLine, Smile, Zap } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { Slider } from "../slider/slider";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { useReducedMotion } from "../use-reduced-motion";
import { ClaudeMark } from "./marks";
import { SAMPLE_REWRITES, SAMPLE_TEXT } from "./sample";
import styles from "./tone-tuner.module.css";

export type ToneLevel = 0 | 1 | 2;
export type ToneVoice = "neutral" | "friendly" | "confident" | "empathetic";
export interface ToneSettings { formality: ToneLevel; detail: ToneLevel; voice: ToneVoice }
export interface ToneRewriteRequest extends ToneSettings { text: string; /** A ready made prompt for the model. */ instructions: string }
export interface TonePreset { voice: Exclude<ToneVoice, "neutral">; label: string; icon?: ReactNode; formality: ToneLevel; detail: ToneLevel }
export interface ToneRecipient { name: string; avatar?: string; subject?: string }
export interface ToneTunerProps {
  text?: string;
  rewrite?: (request: ToneRewriteRequest, signal: AbortSignal) => Promise<string>;
  value?: ToneSettings;
  defaultValue?: ToneSettings;
  onValueChange?: (value: ToneSettings) => void;
  onRewrite?: (text: string, value: ToneSettings) => void;
  onCopy?: (text: string) => void;
  recipient?: ToneRecipient;
  model?: string;
  presets?: TonePreset[];
  debounceMs?: number;
  showChanges?: boolean;
  defaultShowChanges?: boolean;
  onShowChangesChange?: (show: boolean) => void;
  autoPlay?: boolean;
  className?: string;
}

const FORMALITY = ["Casual", "Neutral", "Formal"], DETAIL = ["Concise", "Balanced", "Detailed"];
const NEUTRAL: ToneSettings = { formality: 1, detail: 1, voice: "neutral" };
const SAMPLE_RECIPIENT: ToneRecipient = { name: "Sofia Ramirez", avatar: "/media/people/sofia-ramirez.jpg", subject: "Re: Duplicate charge on INV-20481" };
const DEFAULT_PRESETS: TonePreset[] = [
  { voice: "friendly", label: "Friendly", icon: <Smile size={14} aria-hidden="true" />, formality: 0, detail: 1 },
  { voice: "confident", label: "Confident", icon: <Zap size={14} aria-hidden="true" />, formality: 1, detail: 0 },
  { voice: "empathetic", label: "Empathetic", icon: <HeartHandshake size={14} aria-hidden="true" />, formality: 1, detail: 2 },
];
const VOICES: ToneVoice[] = ["neutral", "friendly", "confident", "empathetic"];
const SIMULATED = "Simulated, nothing was sent.";
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const keyOf = (tone: ToneSettings) => `${tone.voice}:${tone.formality}:${tone.detail}`;
const describe = (tone: ToneSettings) => `${tone.voice} voice, ${FORMALITY[tone.formality].toLowerCase()}, ${DETAIL[tone.detail].toLowerCase()}`;
const isNeutral = (tone: ToneSettings) => tone.voice === "neutral" && tone.formality === 1 && tone.detail === 1;
const wordsOf = (text: string) => text.match(/\S+/g) ?? [];
const instructionsFor = (tone: ToneSettings) =>
  `Rewrite the message in a ${tone.voice} voice. Formality: ${FORMALITY[tone.formality].toLowerCase()}. Detail: ${DETAIL[tone.detail].toLowerCase()}. Keep every fact, name and number. Return plain text only, with the same greeting and sign off structure.`;

interface Segment { text: string; line: boolean }
/** Blank lines split paragraphs; single breaks keep lines; everything else splits into sentences. */
function parse(text: string): Segment[][] {
  return text.trim().split(/\n\s*\n/).map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length > 1) return lines.map(line => ({ text: line, line: true }));
    return (lines[0]?.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [lines[0] ?? ""]).map(sentence => ({ text: sentence.trim(), line: false })).filter(segment => segment.text);
  });
}

/** Marks which words of `next` are not part of the longest common subsequence with `base`. */
function addedWords(base: string[], next: string[]) {
  const rows = base.length + 1, cols = next.length + 1, table = new Uint16Array(rows * cols);
  for (let i = base.length - 1; i >= 0; i--) for (let j = next.length - 1; j >= 0; j--)
    table[i * cols + j] = base[i] === next[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
  const added = new Array<boolean>(next.length).fill(true);
  for (let i = 0, j = 0; i < base.length && j < next.length;) {
    if (base[i] === next[j]) { added[j] = false; i++; j++; }
    else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) i++;
    else j++;
  }
  return added;
}

function Words({ text, flags, show }: { text: string; flags: boolean[]; show: boolean }) {
  const words = wordsOf(text), runs: { added: boolean; words: string[] }[] = [];
  words.forEach((word, index) => {
    const added = show && !!flags[index], last = runs[runs.length - 1];
    if (last && last.added === added) last.words.push(word); else runs.push({ added, words: [word] });
  });
  return <>{runs.map((run, index) => {
    const body = run.words.join(" ");
    return run.added
      ? <span key={index}>{index > 0 && " "}<mark className={styles.ins}>{body}</mark></span>
      : <span key={index}>{index > 0 && " "}{body}</span>;
  })}</>;
}

function Paragraphs({ blocks, flags, show, hidden }: { blocks: Segment[][]; flags?: boolean[]; show?: boolean; hidden?: Set<string> }) {
  const starts: number[][] = [];
  blocks.reduce((total, block) => {
    const row: number[] = [];
    starts.push(row);
    return block.reduce((sum, segment) => { row.push(sum); return sum + wordsOf(segment.text).length; }, total);
  }, 0);
  return <>{blocks.map((block, at) => (
    <p key={at} className={styles.paragraph}>
      {block.map((segment, index) => {
        const offset = starts[at][index], slice = flags ? flags.slice(offset, offset + wordsOf(segment.text).length) : [];
        return (
          <span key={index} className={cx(styles.segment, segment.line && styles.line)} data-out={hidden?.has(`${at}:${index}`) || undefined}>
            {index > 0 && !segment.line && " "}<Words text={segment.text} flags={slice} show={!!show} />
          </span>
        );
      })}
    </p>
  ))}</>;
}

type Phase = "idle" | "rewriting" | "done" | "error";
const fadeIn = { opacity: 1, transition: { duration: .16 } }, fadeOut = { opacity: 0, transition: { duration: .1 } };

export function ToneTuner({
  text,
  rewrite,
  value,
  defaultValue = NEUTRAL,
  onValueChange,
  onRewrite,
  onCopy,
  recipient = SAMPLE_RECIPIENT,
  model = "Claude Sonnet 5.5",
  presets = DEFAULT_PRESETS,
  debounceMs = 220,
  showChanges,
  defaultShowChanges = true,
  onShowChangesChange,
  autoPlay,
  className,
}: ToneTunerProps) {
  const reduced = useReducedMotion();
  const textId = useId();
  const simulated = !rewrite;
  const original = rewrite && text !== undefined ? text : text ?? SAMPLE_TEXT;
  const sample = simulated && text === undefined;
  const tour = autoPlay ?? (sample && value === undefined);

  const [toneState, setToneState] = useState<ToneSettings>(defaultValue);
  const tone = value ?? toneState;
  const [showState, setShowState] = useState(defaultShowChanges);
  const show = showChanges ?? showState;
  const [current, setCurrent] = useState(original);
  const [landed, setLanded] = useState<ToneSettings>(NEUTRAL);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [failure, setFailure] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const shown = useRef(original);
  const latest = useRef({ rewrite, onRewrite, original, sample, reduced });
  useEffect(() => { latest.current = { rewrite, onRewrite, original, sample, reduced }; });

  const land = useCallback((next: string, settings: ToneSettings, phaseAfter: Phase, message: string) => {
    const before = parse(shown.current), after = parse(next), changed = new Set<string>();
    after.forEach((block, at) => block.forEach((segment, index) => { if (before[at]?.[index]?.text !== segment.text) changed.add(`${at}:${index}`); }));
    before.forEach((block, at) => block.forEach((_, index) => { if (!after[at]?.[index]) changed.add(`${at}:${index}`); }));
    const commit = () => {
      shown.current = next;
      setCurrent(next);
      setLanded(settings);
      setPhase(phaseAfter);
      setAnnouncement(message);
      setHidden(new Set());
    };
    if (latest.current.reduced || !changed.size) { commit(); return; }
    setHidden(changed);
    timers.current.push(window.setTimeout(commit, 100));
  }, []);

  const request = useCallback((settings: ToneSettings, delay: number) => {
    controller.current?.abort();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const now = latest.current;
    if (isNeutral(settings)) {
      controller.current = null;
      setFailure("");
      land(now.original, settings, "idle", "Showing the original draft.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setPhase("rewriting");
    setFailure("");
    timers.current.push(window.setTimeout(async () => {
      try {
        let next: string;
        if (now.rewrite) next = await now.rewrite({ ...settings, text: now.original, instructions: instructionsFor(settings) }, abort.signal);
        else {
          await new Promise(resolve => timers.current.push(window.setTimeout(resolve, 520)));
          next = now.sample ? SAMPLE_REWRITES[keyOf(settings)] ?? now.original : now.original;
        }
        if (abort.signal.aborted) return;
        controller.current = null;
        land(next, settings, "done", `Rewritten: ${describe(settings)}.${now.rewrite ? "" : ` ${SIMULATED}`}`);
        now.onRewrite?.(next, settings);
      } catch (error) {
        if (abort.signal.aborted) return;
        controller.current = null;
        const message = error instanceof Error && error.message ? error.message : "The model did not respond.";
        setPhase("error");
        setFailure(message);
        setAnnouncement(`Couldn’t rewrite. ${message}`);
      }
    }, delay));
  }, [land]);

  useEffect(() => () => { controller.current?.abort(); timers.current.forEach(clearTimeout); }, []);

  // Every settings change asks once, after the debounce.
  const asked = useRef(`${keyOf(tone)}|${original}`);
  useEffect(() => {
    const key = `${keyOf(tone)}|${original}`;
    if (asked.current === key) return;
    asked.current = key;
    queueMicrotask(() => request(tone, debounceMs));
  }, [tone, original, debounceMs, request]);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!isNeutral(tone)) queueMicrotask(() => request(tone, 0));
  }, [tone, request]);

  const change = useCallback((next: ToneSettings) => {
    if (value === undefined) setToneState(next);
    onValueChange?.(next);
  }, [value, onValueChange]);
  const pressPreset = (preset: TonePreset) => change(tone.voice === preset.voice ? { ...tone, voice: "neutral" } : { voice: preset.voice, formality: preset.formality, detail: preset.detail });
  const toggleChanges = (next: boolean) => { if (showChanges === undefined) setShowState(next); onShowChangesChange?.(next); };

  // The tour presses each chip in turn while the card is on screen, until the first press or focus inside it.
  const tourStep = useRef(0);
  const live = useRef({ change, presets });
  useEffect(() => { live.current = { change, presets }; });
  useEffect(() => {
    const node = rootRef.current;
    if (!tour || reduced || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0, visible = false;
    const tick = () => {
      if (touched.current || !visible) return;
      const { presets: chips, change: apply } = live.current, step = tourStep.current++ % (chips.length + 1);
      const preset = chips[step];
      apply(preset ? { voice: preset.voice, formality: preset.formality, detail: preset.detail } : NEUTRAL);
      timer = window.setTimeout(tick, 3200);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      clearTimeout(timer);
      if (visible && !touched.current) timer = window.setTimeout(tick, 1400);
    }, { threshold: .4 });
    observer.observe(node);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [tour, reduced]);
  const touch = () => { touched.current = true; };

  const baseWords = useMemo(() => wordsOf(original), [original]);
  const blocks = useMemo(() => parse(current), [current]);
  const flags = useMemo(() => addedWords(baseWords, wordsOf(current)), [baseWords, current]);
  const changedCount = flags.filter(Boolean).length, wordCount = flags.length;
  // The sizer holds the longest voice at this formality and detail, so a voice change never resizes the card.
  const sizer = useMemo(() => {
    if (!sample) return blocks;
    let longest = "";
    for (const voice of VOICES) {
      const candidate = isNeutral({ ...tone, voice }) ? SAMPLE_TEXT : SAMPLE_REWRITES[keyOf({ ...tone, voice })] ?? "";
      if (candidate.length > longest.length) longest = candidate;
    }
    return parse(longest);
  }, [sample, tone, blocks]);

  const height = useMotionValue<number | string>("auto");
  const measured = useRef({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let playing: ReturnType<typeof animate> | undefined;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight, width = node.offsetWidth, last = measured.current;
      if (next === last.height && width === last.width) return;
      const from = typeof height.get() === "number" ? (height.get() as number) : last.height;
      const jump = reduced || !last.height || width !== last.width;
      measured.current = { width, height: next };
      playing?.stop();
      if (jump) { height.set("auto"); return; }
      height.set(from);
      playing = animate(height as never, next, { type: "spring", visualDuration: .3, bounce: 0, onComplete: () => height.set("auto") });
    });
    observer.observe(node);
    return () => { playing?.stop(); observer.disconnect(); };
  }, [height, reduced]);

  const icon = phase === "rewriting" ? "claude" : phase === "done" ? "done" : phase === "error" ? "error" : "idle";
  const statusKey = phase === "done" ? `done:${keyOf(landed)}` : phase;

  return (
    <div ref={rootRef} className={cx(styles.root, className)} data-changes={show} data-phase={phase} onPointerDownCapture={touch} onFocusCapture={touch}>
      <div className={styles.head}>
        <Avatar name={recipient.name} src={recipient.avatar} size="md" className={styles.avatar} />
        <div className={styles.who}><span className={styles.name}>{recipient.name}</span>{recipient.subject && <span className={styles.subject}>{recipient.subject}</span>}</div>
        <div className={styles.counts} aria-hidden="true">
          <span className={styles.changed} data-on={show ? "" : undefined}><i className={styles.swatch} /><span className={styles.num}>{changedCount}</span> changed</span>
          <span><span className={styles.num}>{wordCount}</span> words</span>
        </div>
      </div>
      <motion.div className={styles.bodyClip} style={{ height }}>
        <div ref={bodyRef} className={styles.body}>
          <div className={styles.stack}>
            <div className={styles.sizer} aria-hidden="true"><Paragraphs blocks={sizer} /></div>
            <div className={styles.text} id={textId} aria-label="Message" role="group"><Paragraphs blocks={blocks} flags={flags} show={show} hidden={hidden} /></div>
          </div>
        </div>
      </motion.div>
      <div className={styles.controls}>
        <div className={styles.presets} role="group" aria-label="Voice">
          {presets.map(preset => (
            <button key={preset.voice} type="button" className={styles.chip} aria-pressed={tone.voice === preset.voice} onClick={() => pressPreset(preset)}>
              {preset.icon && <span className={styles.chipIcon}>{preset.icon}</span>}<span className={styles.chipLabel}>{preset.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.sliders}>
          <Slider label="Formality" min={0} max={2} step={1} largeStep={1} showValue={false} value={tone.formality} format={level => FORMALITY[level]}
            marks={FORMALITY.map((label, level) => ({ value: level, label }))} onValueChange={level => change({ ...tone, formality: level as ToneLevel })} />
          <Slider label="Detail" min={0} max={2} step={1} largeStep={1} showValue={false} value={tone.detail} format={level => DETAIL[level]}
            marks={DETAIL.map((label, level) => ({ value: level, label }))} onValueChange={level => change({ ...tone, detail: level as ToneLevel })} />
        </div>
      </div>
      <div className={styles.foot}>
        <div className={styles.status} data-icon={icon}>
          <span className={styles.statusIcon}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={icon} className={styles.fadeItem} initial={{ opacity: 0 }} animate={fadeIn} exit={fadeOut}>
                {icon === "claude" ? <ClaudeMark width={14} height={14} className={styles.claude} aria-hidden="true" /> : icon === "done" ? <Check size={14} aria-hidden="true" /> : icon === "error" ? <CircleAlert size={14} aria-hidden="true" /> : <PenLine size={14} aria-hidden="true" />}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className={styles.statusText}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={statusKey} className={styles.fadeItem} initial={{ opacity: 0 }} animate={fadeIn} exit={fadeOut}>
                {phase === "rewriting" ? <TextShimmer className={styles.statusLabel}>{`Rewriting with ${model}`}</TextShimmer>
                  : phase === "done" ? <span className={styles.statusLabel}>Rewritten<span className={styles.statusMeta}>{describe(landed)}</span></span>
                  : phase === "error" ? <span className={styles.statusLabel} title={failure}>Couldn’t rewrite</span>
                  : <span className={styles.statusLabel}>Original draft</span>}
              </motion.span>
            </AnimatePresence>
          </span>
          {phase === "error" && <Button variant="ghost" size="sm" onClick={() => request(tone, 0)}>Retry</Button>}
        </div>
        <div className={styles.actions}>
          <Switch className={styles.switch} label="Changes" aria-label="Highlight changes" checked={show} onCheckedChange={toggleChanges} />
          <CopyButton value={current} label="Copy" onCopied={() => onCopy?.(current)} />
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

export default ToneTuner;
