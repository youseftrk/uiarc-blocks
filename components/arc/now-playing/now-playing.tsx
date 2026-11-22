"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, MotionConfig, motion, type PanInfo } from "motion/react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import styles from "./now-playing.module.css";

export interface NowPlayingTrack {
  id: string;
  title: string;
  artist: string;
  /** Seconds. */
  duration: number;
  artwork: string;
  artworkAlt?: string;
}

export interface NowPlayingProps {
  tracks: NowPlayingTrack[];
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  playing?: boolean;
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  currentTime?: number;
  onSeek?: (seconds: number) => void;
  defaultExpanded?: boolean;
  label?: string;
  className?: string;
}

export interface NowPlayingLevelsProps {
  playing: boolean;
  className?: string;
}

const BARS = 54;
const MORPH = { type: "spring", duration: 0.5, bounce: 0.14 } as const;
const SWAP = { type: "spring", duration: 0.4, bounce: 0 } as const;
const FADE_IN = { initial: { opacity: 0, filter: "blur(4px)", y: 6 }, animate: { opacity: 1, filter: "blur(0px)", y: 0 } };

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A stable waveform per track: an arch-shaped envelope with seeded jitter. */
function waveform(seed: string) {
  let state = hash(seed) || 1;
  const random = () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    state = (state ^ (state >>> 16)) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: BARS }, (_, i) => {
    const t = i / (BARS - 1);
    const envelope = 0.14 + 0.42 * Math.sin(Math.PI * Math.pow(t, 0.85)) ** 0.7;
    return clamp((envelope + random() * 0.42) * 100, 15, 98);
  });
}

export function NowPlayingLevels({ playing, className }: NowPlayingLevelsProps) {
  return (
    <span className={cx(styles.levels, className)} data-playing={playing || undefined} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

const Bars = memo(function Bars({ heights, played }: { heights: number[]; played?: number }) {
  return (
    <span
      className={styles.bars}
      data-played={played === undefined ? undefined : "true"}
      aria-hidden="true"
      style={played === undefined ? undefined : { clipPath: `inset(0px ${(100 - played * 100).toFixed(4)}% 0px 0px)` }}
    >
      {heights.map((height, i) => <span key={i} style={{ height: `${height.toFixed(4)}%` }} />)}
    </span>
  );
});

function PlayGlyph({ playing, size }: { playing: boolean; size: number }) {
  const Icon = playing ? Pause : Play;
  return (
    <span className={styles.playGlyph} style={{ width: size, height: size }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={playing ? "pause" : "play"}
          className={styles.playPhase}
          data-icon={playing ? "pause" : "play"}
          initial={{ opacity: 0, filter: "blur(4px)", scale: 0.6 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, filter: "blur(4px)", scale: 0.6 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          <Icon size={size} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function NowPlaying({
  tracks,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  playing: playingProp,
  defaultPlaying = false,
  onPlayingChange,
  currentTime,
  onSeek,
  defaultExpanded = false,
  label = "Now playing",
  className,
}: NowPlayingProps) {
  const statusId = useId();
  const count = Math.max(1, tracks.length);
  const [indexState, setIndexState] = useState(defaultIndex);
  const [playingState, setPlayingState] = useState(defaultPlaying);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [time, setTime] = useState(currentTime ?? 0);
  const [direction, setDirection] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  const [height, setHeight] = useState<number | null>(null);

  const index = ((indexProp ?? indexState) % count + count) % count;
  const playing = playingProp ?? playingState;
  const track = tracks[index];
  const duration = Math.max(1, track?.duration ?? 1);

  const inner = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const miniMain = useRef<HTMLButtonElement>(null);
  const collapse = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const timeRef = useRef(time);
  const scrubRef = useRef(false);
  const dragged = useRef(false);

  const heights = useMemo(() => waveform(track?.id ?? ""), [track?.id]);

  const writeTime = useCallback((next: number) => {
    timeRef.current = next;
    setTime(next);
  }, []);

  const setIndex = useCallback((next: number, dir: number) => {
    const wrapped = ((next % count) + count) % count;
    setDirection(dir);
    if (indexProp === undefined) setIndexState(wrapped);
    writeTime(0);
    onIndexChange?.(wrapped);
  }, [count, indexProp, onIndexChange, writeTime]);

  const setPlaying = useCallback((next: boolean) => {
    if (playingProp === undefined) setPlayingState(next);
    onPlayingChange?.(next);
  }, [playingProp, onPlayingChange]);

  // Real audio corrects the built-in clock, except mid-scrub.
  useEffect(() => {
    if (currentTime === undefined || scrubRef.current) return;
    timeRef.current = currentTime;
    queueMicrotask(() => setTime(currentTime));
  }, [currentTime]);

  const advance = useRef(() => {});
  useEffect(() => {
    advance.current = () => setIndex(index + 1, 1);
  }, [index, setIndex]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!scrubRef.current) {
        const next = timeRef.current + delta;
        if (next >= duration) advance.current();
        else writeTime(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, writeTime]);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const measure = () => setHeight(Math.round(node.offsetHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (expanded ? collapse.current : miniMain.current)?.focus({ preventScroll: true });
  }, [expanded]);

  const open = useCallback((next: boolean) => {
    moveFocus.current = true;
    setExpanded(next);
  }, []);

  const seek = useCallback((seconds: number) => {
    const next = clamp(seconds, 0, duration);
    writeTime(next);
    onSeek?.(next);
  }, [duration, onSeek, writeTime]);

  const previous = useCallback(() => {
    if (timeRef.current > 3) seek(0);
    else setIndex(index - 1, -1);
  }, [index, seek, setIndex]);

  const pointerTime = (event: PointerEvent<HTMLDivElement>) => {
    const rect = wave.current?.getBoundingClientRect();
    if (!rect || !rect.width) return timeRef.current;
    return clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
  };

  const onWaveDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubRef.current = true;
    setScrubbing(true);
    writeTime(pointerTime(event));
  };
  const onWaveMove = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubRef.current) writeTime(pointerTime(event));
  };
  const onWaveUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!scrubRef.current) return;
    scrubRef.current = false;
    setScrubbing(false);
    seek(pointerTime(event));
  };

  const onWaveKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const now = timeRef.current;
    const target =
      event.key === "ArrowRight" || event.key === "ArrowUp" ? now + 5
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? now - 5
      : event.key === "PageUp" ? now + 30
      : event.key === "PageDown" ? now - 30
      : event.key === "Home" ? 0
      : event.key === "End" ? duration
      : null;
    if (target === null) return;
    event.preventDefault();
    seek(target);
  };

  const onArtDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 70 || info.velocity.y > 600) open(false);
    requestAnimationFrame(() => { dragged.current = false; });
  };

  if (!track) return null;

  const fraction = clamp(time / duration, 0, 1);
  const shown = Math.floor(time);

  return (
    <MotionConfig reducedMotion="user" transition={MORPH}>
      <section
        className={cx(styles.root, className)}
        aria-label={label}
        aria-describedby={statusId}
        onKeyDown={event => {
          if (event.key === "Escape" && expanded) {
            event.stopPropagation();
            open(false);
          }
        }}
      >
        <p id={statusId} className={styles.srOnly} aria-live="polite">
          {track.title} by {track.artist}, {playing ? "playing" : "paused"}
        </p>
        <motion.div
          className={styles.shell}
          data-expanded={expanded || undefined}
          initial={false}
          animate={{ height: height ?? (expanded ? 411 : 64), borderRadius: expanded ? 30 : 22 }}
        >
          <div ref={inner} className={styles.inner}>
            <motion.div
              layout
              className={styles.art}
              initial={false}
              animate={{ borderRadius: expanded ? 20 : 12 }}
              drag={expanded ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.12, bottom: 0.7 }}
              dragSnapToOrigin
              onDragStart={() => { dragged.current = true; }}
              onDragEnd={onArtDragEnd}
            >
              <motion.div layout className={styles.artSquare}>
                <AnimatePresence initial={false} custom={direction}>
                  <motion.img
                    key={track.id}
                    className={styles.artImage}
                    src={track.artwork}
                    alt={track.artworkAlt ?? ""}
                    draggable={false}
                    decoding="async"
                    custom={direction}
                    variants={{
                      enter: (dir: number) => ({ opacity: 0, filter: "blur(4px)", x: `${dir * 24}%`, scale: 0.96 }),
                      rest: { opacity: 1, filter: "blur(0px)", x: "0%", scale: 1 },
                      exit: (dir: number) => ({ opacity: 0, filter: "blur(4px)", x: `${dir * -24}%`, scale: 0.96 }),
                    }}
                    initial="enter"
                    animate="rest"
                    exit="exit"
                    transition={SWAP}
                  />
                </AnimatePresence>
              </motion.div>
              {expanded ? (
                <motion.button
                  ref={collapse}
                  type="button"
                  className={styles.collapse}
                  aria-label="Collapse player"
                  aria-expanded="true"
                  onClick={() => { if (!dragged.current) open(false); }}
                  initial={{ opacity: 0, filter: "blur(4px)", scale: 0.8 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  transition={{ ...SWAP, delay: 0.12 }}
                >
                  <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                </motion.button>
              ) : null}
            </motion.div>

            {expanded ? (
              <>
                <motion.div className={styles.info} {...FADE_IN} transition={{ ...SWAP, delay: 0.08 }}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={track.id}
                      className={styles.infoText}
                      initial={{ opacity: 0, filter: "blur(4px)", y: 6 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      exit={{ opacity: 0, filter: "blur(4px)", y: -6 }}
                      transition={SWAP}
                    >
                      <h3 className={styles.titleLarge}>{track.title}</h3>
                      <p className={styles.artistLarge}>{track.artist}</p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
                <motion.div className={styles.waveArea} {...FADE_IN} transition={{ ...SWAP, delay: 0.12 }}>
                  <div className={styles.scrubber}>
                    <motion.div
                      ref={wave}
                      className={styles.wave}
                      role="slider"
                      tabIndex={0}
                      aria-label="Position"
                      aria-valuemin={0}
                      aria-valuemax={Math.round(duration)}
                      aria-valuenow={shown}
                      aria-valuetext={`${clock(time)} of ${clock(duration)}`}
                      animate={{ scaleY: scrubbing ? 1.18 : 1 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
                      onPointerDown={onWaveDown}
                      onPointerMove={onWaveMove}
                      onPointerUp={onWaveUp}
                      onPointerCancel={onWaveUp}
                      onKeyDown={onWaveKey}
                    >
                      <Bars heights={heights} />
                      <Bars heights={heights} played={fraction} />
                    </motion.div>
                    <div className={styles.times} aria-hidden="true">
                      <span>{clock(time)}</span>
                      <span>−{clock(duration - shown)}</span>
                    </div>
                  </div>
                </motion.div>
                <motion.button
                  type="button"
                  className={styles.prev}
                  aria-label="Previous track"
                  onClick={previous}
                  initial={{ opacity: 0, filter: "blur(4px)", x: 12 }}
                  animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
                  transition={{ ...SWAP, delay: 0.12 }}
                >
                  <SkipBack size={20} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  ref={miniMain}
                  type="button"
                  className={styles.miniMain}
                  aria-label={`Expand player, ${track.title} by ${track.artist}`}
                  aria-expanded="false"
                  onClick={() => open(true)}
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ ...SWAP, delay: 0.1 }}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={track.id}
                      className={styles.miniText}
                      initial={{ opacity: 0, filter: "blur(4px)", y: 6 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      exit={{ opacity: 0, filter: "blur(4px)", y: -6 }}
                      transition={SWAP}
                    >
                      <span className={styles.miniTitle}>{track.title}</span>
                      <span className={styles.miniArtist}>{track.artist}</span>
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
                <motion.span
                  className={styles.levelsArea}
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ ...SWAP, delay: 0.1 }}
                >
                  <NowPlayingLevels playing={playing} />
                </motion.span>
                <motion.span
                  className={styles.miniProgressTrack}
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...SWAP, delay: 0.1 }}
                >
                  <span className={styles.miniProgress} style={{ transform: `scaleX(${fraction})` }} />
                </motion.span>
              </>
            )}

            <motion.button
              layout
              type="button"
              className={styles.play}
              aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}
              onClick={() => setPlaying(!playing)}
            >
              <PlayGlyph playing={playing} size={expanded ? 24 : 18} />
            </motion.button>
            <motion.button layout type="button" className={styles.next} aria-label="Next track" onClick={() => setIndex(index + 1, 1)}>
              <SkipForward size={expanded ? 20 : 18} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}

export default NowPlaying;
