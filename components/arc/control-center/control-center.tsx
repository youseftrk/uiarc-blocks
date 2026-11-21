"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Bell, BellOff, ChevronRight, Presentation, Type, Volume1, Volume2, VolumeX, X, type LucideIcon } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./control-center.module.css";

export interface ControlCenterFocusMode { id: string; label: string; icon: LucideIcon; description: string; defaultMinutes: number; }
export interface ControlCenterChannel { id: string; label: string; description?: string; defaultOn?: boolean; }
export interface ControlCenterPerson { id: string; name: string; avatar: string; }
export interface ControlCenterState {
  focus: { mode: string; minutes: number; until: string } | null;
  notifications: boolean;
  channels: Record<string, boolean>;
  presenting: boolean;
  volume: number;
  textSize: number;
}
export interface ControlCenterProps {
  focusModes: ControlCenterFocusMode[];
  channels: ControlCenterChannel[];
  people?: ControlCenterPerson[];
  defaultVolume?: number;
  defaultTextSize?: number;
  formatTime?: (date: Date) => string;
  onStateChange?: (state: ControlCenterState) => void;
  label?: string;
  className?: string;
}

const spring = motionTokens.spring.smooth;
const snappy = motionTokens.spring.snappy;
const shortTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const currentTime = () => new Date().getTime();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Resistance past an edge: follows closely at first, then settles toward `limit`. */
const rubber = (overflow: number, limit: number, give: number) => Math.sign(overflow) * limit * (1 - Math.exp(-Math.abs(overflow) / give));

function Swap({ id, size, children }: { id: string; size: number; children: ReactNode }) {
  return (
    <span className={styles.swap} style={{ width: size, height: size }} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span key={id} className={styles.swapPhase} initial={{ opacity: 0, filter: "blur(4px)", scale: .8 }} animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }} exit={{ opacity: 0, filter: "blur(4px)", scale: .8 }} transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}>{children}</motion.span>
      </AnimatePresence>
    </span>
  );
}
function Roll({ children }: { children: string }) {
  return (
    <span className={styles.roll}>
      <AnimatePresence initial={false}>
        <motion.span key={children} className={styles.rollPhase} initial={{ opacity: 0, filter: "blur(4px)", y: 4 }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }} exit={{ opacity: 0, filter: "blur(4px)", y: -4 }} transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}>{children}</motion.span>
      </AnimatePresence>
    </span>
  );
}

function Switch({ on, onChange, labelledBy }: { on: boolean; onChange: (on: boolean) => void; labelledBy: string }) {
  return (
    <button className={styles.switch} type="button" role="switch" aria-checked={on} aria-labelledby={labelledBy} data-on={on ? "true" : undefined} onClick={() => onChange(!on)}>
      <motion.span className={styles.switchThumb} style={{ width: 18 }} initial={false} animate={{ x: on ? 16 : 0 }} transition={snappy} />
    </button>
  );
}

const SEGMENTS = Array.from({ length: 28 }, (_, index) => index);

interface MeterProps { label: string; icon: ReactNode; value: number; min: number; max: number; step: number; onChange: (value: number) => void; preview?: (shown: MotionValue<number>) => ReactNode; }
function Meter({ label, icon, value, min, max, step, onChange, preview }: MeterProps) {
  const id = useId();
  const shown = useMotionValue(value);
  const stretch = useMotionValue(0), swell = useMotionValue(1);
  const x = useTransform(stretch, v => v), scaleX = useTransform(stretch, v => 1 + Math.abs(v) * .00614);
  const clipPath = useTransform(shown, v => `inset(0 ${clamp((max - v) / (max - min) * 100, 0, 100)}% 0 0)`);
  const drag = useRef<{ startX: number; startValue: number; moved: boolean; width: number } | null>(null);
  const snap = (raw: number) => clamp(Math.round(raw / step) * step, min, max);
  const settle = (next: number) => { animate(shown, next, snappy); if (next !== value) onChange(next); };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startValue: shown.get(), moved: false, width: event.currentTarget.getBoundingClientRect().width };
    animate(swell, 1.18, snappy);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < 3) return;
    state.moved = true;
    const raw = state.startValue + dx / state.width * (max - min), held = clamp(raw, min, max);
    shown.set(held);
    stretch.set(rubber((raw - held) / (max - min) * state.width, 2.9, 24));
    const next = snap(held);
    if (next !== value) onChange(next);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    animate(swell, 1, snappy);
    animate(stretch, 0, snappy);
    if (state.moved) settle(snap(shown.get()));
    else {
      const box = event.currentTarget.getBoundingClientRect();
      settle(snap(min + clamp((event.clientX - box.left) / box.width, 0, 1) * (max - min)));
    }
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const by = event.key === "ArrowRight" || event.key === "ArrowUp" ? step : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step : event.key === "PageUp" ? step * 4 : event.key === "PageDown" ? -step * 4 : 0;
    const next = event.key === "Home" ? min : event.key === "End" ? max : by ? snap(value + by) : null;
    if (next === null) return;
    event.preventDefault();
    settle(next);
  };

  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span className={styles.meterIcon} aria-hidden="true">{icon}</span>
        <span className={styles.meterLabel} id={id}>{label}</span>
        {preview?.(shown)}
        <span className={styles.meterValue} aria-hidden="true">{value}%</span>
      </div>
      <motion.div className={styles.meterTrack} role="slider" tabIndex={0} aria-labelledby={id} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value}%`} style={{ x, scaleX, scaleY: swell }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
        <span className={styles.meterSegments} aria-hidden="true">{SEGMENTS.map(index => <span key={index} />)}</span>
        <motion.span className={styles.meterSegments} data-fill="true" aria-hidden="true" style={{ clipPath }}>{SEGMENTS.map(index => <span key={index} />)}</motion.span>
      </motion.div>
    </div>
  );
}

const TICKS = Array.from({ length: 24 }, (_, index) => {
  const angle = index * 15 * Math.PI / 180, major = index % 3 === 0;
  const inner = 76, outer = major ? 86 : 82;
  return { major, x1: 100 + Math.sin(angle) * inner, y1: 100 - Math.cos(angle) * inner, x2: 100 + Math.sin(angle) * outer, y2: 100 - Math.cos(angle) * outer };
});
const DIAL_MIN = 5, DIAL_MAX = 120;

function Dial({ minutes, onChange, until }: { minutes: number; onChange: (minutes: number) => void; until: string }) {
  const shown = useMotionValue(minutes);
  const rotate = useTransform(shown, v => v * 3);
  const dash = useTransform(shown, v => `${clamp(v, 0, DIAL_MAX) / DIAL_MAX} 1`);
  const drag = useRef<{ angle: number; raw: number; moved: boolean } | null>(null);
  const last = useRef(minutes);
  useEffect(() => {
    if (last.current === minutes || drag.current) { last.current = minutes; return; }
    last.current = minutes;
    const controls = animate(shown, minutes, snappy);
    return () => controls.stop();
  }, [minutes, shown]);
  const angleOf = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const degrees = Math.atan2(event.clientX - (box.left + box.width / 2), -(event.clientY - (box.top + box.height / 2))) * 180 / Math.PI;
    return (degrees + 360) % 360;
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { angle: angleOf(event), raw: shown.get(), moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const angle = angleOf(event);
    let delta = angle - state.angle;
    if (delta > 180) delta -= 360; else if (delta < -180) delta += 360;
    if (!state.moved && Math.abs(delta) < 1) return;
    state.moved = true;
    state.angle = angle;
    state.raw += delta / 3;
    const held = clamp(state.raw, DIAL_MIN, DIAL_MAX);
    shown.set(held + rubber(state.raw - held, 4, 14));
    const next = Math.round(held);
    if (next !== last.current) { last.current = next; onChange(next); }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    const raw = state.moved ? state.raw : (angleOf(event) / 3 || DIAL_MAX);
    const next = clamp(Math.round(raw / 5) * 5, DIAL_MIN, DIAL_MAX);
    animate(shown, next, { type: "spring", visualDuration: .3, bounce: .25 });
    last.current = next;
    onChange(next);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const by = event.key === "ArrowRight" || event.key === "ArrowUp" ? 5 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -5 : event.key === "PageUp" ? 15 : event.key === "PageDown" ? -15 : 0;
    const next = event.key === "Home" ? DIAL_MIN : event.key === "End" ? DIAL_MAX : by ? clamp(Math.round((minutes + by) / 5) * 5, DIAL_MIN, DIAL_MAX) : null;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };
  return (
    <div className={styles.dial} role="slider" tabIndex={0} aria-label="Session length" aria-valuemin={DIAL_MIN} aria-valuemax={DIAL_MAX} aria-valuenow={minutes} aria-valuetext={`${minutes} minutes, until ${until}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
      <svg className={styles.dialSvg} viewBox="0 0 200 200" aria-hidden="true">
        {TICKS.map((tick, index) => <line key={index} className={styles.dialTick} data-major={tick.major ? "true" : undefined} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />)}
        <circle className={styles.dialTrack} cx="100" cy="100" r="94" />
        <motion.circle className={styles.dialArc} cx="100" cy="100" r="94" pathLength={1} strokeDashoffset={0} strokeDasharray={dash} style={{ rotate: -90, transformOrigin: "50% 50%", transformBox: "fill-box" }} />
      </svg>
      <motion.div className={styles.dialKnobArm} aria-hidden="true" style={{ rotate }}><span className={styles.dialKnob} /></motion.div>
      <div className={styles.dialCenter} aria-hidden="true">
        <span className={styles.dialCount}><span>{minutes}</span><span className={styles.dialUnit}>min</span></span>
        <span className={styles.dialUntil}>Until {until}</span>
      </div>
    </div>
  );
}

type DetailId = "focus" | "notifications";

export function ControlCenter({ focusModes, channels, people = [], defaultVolume = 60, defaultTextSize = 100, formatTime = shortTime, onStateChange, label = "Quick settings", className }: ControlCenterProps) {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const [focus, setFocus] = useState<{ mode: string; minutes: number; until: number } | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [channelState, setChannelState] = useState<Record<string, boolean>>(() => Object.fromEntries(channels.map(channel => [channel.id, !!channel.defaultOn])));
  const [presenting, setPresenting] = useState(false);
  const [volume, setVolume] = useState(() => clamp(Math.round(defaultVolume), 0, 100));
  const [textSize, setTextSize] = useState(() => clamp(Math.round(defaultTextSize / 5) * 5, 85, 130));
  const [open, setOpen] = useState<DetailId | null>(null);
  const [draft, setDraft] = useState<{ mode: string; minutes: number; from: number }>({ mode: focusModes[0]?.id ?? "", minutes: focusModes[0]?.defaultMinutes ?? 30, from: 0 });
  const detail = useRef<HTMLDivElement>(null);
  const expanders = useRef<Partial<Record<DetailId, HTMLButtonElement | null>>>({});
  const returnTo = useRef<DetailId | null>(null);

  const notify = useRef(onStateChange);
  useEffect(() => { notify.current = onStateChange; });
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    notify.current?.({ focus: focus ? { mode: focus.mode, minutes: focus.minutes, until: new Date(focus.until).toISOString() } : null, notifications, channels: channelState, presenting, volume, textSize });
  }, [focus, notifications, channelState, presenting, volume, textSize]);

  useEffect(() => {
    if (open) { detail.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }); return; }
    const back = returnTo.current;
    returnTo.current = null;
    if (back) expanders.current[back]?.focus({ preventScroll: true });
  }, [open]);

  const modeOf = (id: string) => focusModes.find(mode => mode.id === id) ?? focusModes[0];
  const activeMode = focus ? modeOf(focus.mode) : null;
  const FocusIcon = (activeMode ?? focusModes[0])?.icon;
  const onCount = channels.filter(channel => channelState[channel.id]).length;
  const close = () => { returnTo.current = open; setOpen(null); };
  const openDetail = (id: DetailId) => {
    if (id === "focus") setDraft({ mode: focus?.mode ?? focusModes[0]?.id ?? "", minutes: focus?.minutes ?? focusModes[0]?.defaultMinutes ?? 30, from: currentTime() });
    setOpen(id);
  };
  const toggleFocus = () => {
    if (focus) return setFocus(null);
    const first = focusModes[0];
    if (first) setFocus({ mode: first.id, minutes: first.defaultMinutes, until: currentTime() + first.defaultMinutes * 60_000 });
  };
  const commitFocus = () => { setFocus({ mode: draft.mode, minutes: draft.minutes, until: currentTime() + draft.minutes * 60_000 }); close(); };
  const draftMode = modeOf(draft.mode);
  const DraftIcon = draftMode?.icon;
  const draftUntil = formatTime(new Date(draft.from + draft.minutes * 60_000));

  const onDetailKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button, [tabindex="0"]')].filter(node => !node.hasAttribute("disabled"));
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const onModeKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const by = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!by) return;
    event.preventDefault();
    const next = focusModes[(index + by + focusModes.length) % focusModes.length];
    setDraft(current => ({ mode: next.id, minutes: next.defaultMinutes, from: current.from }));
    (event.currentTarget.parentElement?.children[(index + by + focusModes.length) % focusModes.length] as HTMLElement | undefined)?.focus();
  };

  const layout = { layout: true, transition: spring } as const;
  const tile = (id: "focus" | "notifications" | "presenting", wide: boolean, active: boolean, icon: ReactNode, iconKey: string, title: string, status: string, onToggle: () => void, expandLabel?: string) => (
    <div className={styles.slot} data-wide={wide ? "true" : undefined}>
      {open !== id && (
        <motion.div className={styles.tile} data-active={active ? "true" : undefined} layoutId={`${uid}-${id}`} style={{ borderRadius: 22 }} transition={spring} whileTap={{ scale: .985 }}>
          <button className={styles.tileMain} type="button" aria-pressed={active} onClick={onToggle}>
            <motion.span className={styles.tileIcon} layoutId={`${uid}-${id}-icon`} transition={spring}><Swap id={iconKey} size={20}>{icon}</Swap></motion.span>
            <span className={styles.tileText}>
              <motion.span className={styles.tileTitle} layoutId={`${uid}-${id}-title`} transition={spring}>{title}</motion.span>
              <motion.span className={styles.tileStatus} {...layout}><Roll>{status}</Roll></motion.span>
            </span>
          </button>
          {expandLabel && (
            <motion.button ref={node => { expanders.current[id as DetailId] = node; }} className={styles.tileExpand} type="button" aria-label={expandLabel} aria-haspopup="dialog" layoutId={`${uid}-${id}-action`} transition={spring} onClick={() => openDetail(id as DetailId)}>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );

  const detailIcon = open === "focus" ? (DraftIcon ? <DraftIcon size={20} strokeWidth={1.75} /> : null) : notifications ? <Bell size={20} strokeWidth={1.75} /> : <BellOff size={20} strokeWidth={1.75} />;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={uid}>
        <section className={`${styles.panel} ${className ?? ""}`} aria-label={label}>
          <div className={styles.grid} inert={open !== null}>
            {tile("focus", true, !!focus, FocusIcon ? <FocusIcon size={20} strokeWidth={1.75} /> : null, activeMode?.id ?? "off", activeMode?.label ?? "Focus", focus ? `Until ${formatTime(new Date(focus.until))}` : "Off", toggleFocus, "Focus session settings")}
            {tile("notifications", false, notifications, notifications ? <Bell size={20} strokeWidth={1.75} /> : <BellOff size={20} strokeWidth={1.75} />, notifications ? "on" : "off", "Notifications", notifications ? `${onCount} of ${channels.length} channels` : "Paused", () => setNotifications(value => !value), "Notification channels")}
            {tile("presenting", false, presenting, <Presentation size={20} strokeWidth={1.75} />, "presenting", "Presenting", presenting ? "Previews hidden" : "Off", () => setPresenting(value => !value))}
            <div className={styles.meters}>
              <Meter label="Alert volume" icon={<Swap id={VolumeIcon === VolumeX ? "x" : VolumeIcon === Volume1 ? "1" : "2"} size={16}><VolumeIcon size={16} strokeWidth={1.75} /></Swap>} value={volume} min={0} max={100} step={1} onChange={setVolume} />
              <Meter label="Text size" icon={<Type size={16} strokeWidth={1.75} />} value={textSize} min={85} max={130} step={5} onChange={setTextSize} preview={shown => <TextPreview shown={shown} />} />
            </div>
          </div>
          <AnimatePresence>
            {open && <motion.div key="scrim" className={styles.scrim} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.standard }} onClick={close} />}
          </AnimatePresence>
          <AnimatePresence>
            {open && (
              <motion.div key={open} ref={detail} className={styles.detail} role="dialog" aria-modal="true" aria-labelledby={`${uid}-detail-title`} layoutId={`${uid}-${open}`} style={{ borderRadius: 22 }} transition={spring} onKeyDown={onDetailKey}>
                <div className={styles.detailHead}>
                  <motion.span className={styles.tileIcon} data-active="true" layoutId={`${uid}-${open}-icon`} transition={spring}><Swap id={open === "focus" ? draft.mode : notifications ? "on" : "off"} size={20}>{detailIcon}</Swap></motion.span>
                  <motion.h3 className={styles.detailTitle} id={`${uid}-detail-title`} layoutId={`${uid}-${open}-title`} transition={spring}>{open === "focus" ? "Focus" : "Notifications"}</motion.h3>
                  <motion.button className={styles.close} type="button" aria-label="Close" layoutId={`${uid}-${open}-action`} transition={spring} onClick={close}><X size={16} strokeWidth={1.75} aria-hidden="true" /></motion.button>
                </div>
                <motion.div className={styles.detailBody} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.standard, delay: .08, ease: [...motionTokens.ease.enter] } }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}>
                  {open === "focus" ? (
                    <>
                      <div className={styles.modes} role="radiogroup" aria-label="Mode">
                        {focusModes.map((mode, index) => (
                          <button key={mode.id} className={styles.mode} type="button" role="radio" aria-checked={mode.id === draft.mode} tabIndex={mode.id === draft.mode ? 0 : -1} onKeyDown={event => onModeKey(event, index)} onClick={() => setDraft(current => ({ mode: mode.id, minutes: mode.defaultMinutes, from: current.from }))}>
                            {mode.id === draft.mode && <motion.span className={styles.modeHighlight} layoutId={`${uid}-mode`} transition={snappy} />}
                            <span className={styles.modeLabel}>{mode.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className={styles.modeNote}><Roll>{draftMode?.description ?? ""}</Roll></p>
                      <Dial minutes={draft.minutes} until={draftUntil} onChange={minutes => setDraft(current => ({ ...current, minutes }))} />
                      <div className={styles.actions}>
                        {focus && <button className={styles.secondary} type="button" onClick={() => { setFocus(null); close(); }}>End session</button>}
                        <button className={styles.primary} type="button" onClick={commitFocus}>{focus ? "Update session" : "Start session"}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.row}>
                        <span className={styles.rowText}>
                          <span className={styles.rowLabel} id={`${uid}-all`}>All notifications</span>
                          <span className={styles.rowDescription}>{notifications ? "Delivered as they arrive" : "Paused until you resume"}</span>
                        </span>
                        <Switch on={notifications} onChange={setNotifications} labelledBy={`${uid}-all`} />
                      </div>
                      <div className={styles.channels} data-muted={notifications ? undefined : "true"}>
                        {channels.map(channel => (
                          <div key={channel.id} className={styles.row}>
                            <span className={styles.rowText}>
                              <span className={styles.rowLabel} id={`${uid}-channel-${channel.id}`}>{channel.label}</span>
                              {channel.description && <span className={styles.rowDescription}>{channel.description}</span>}
                            </span>
                            <Switch on={notifications && !!channelState[channel.id]} onChange={on => { if (notifications) setChannelState(current => ({ ...current, [channel.id]: on })); }} labelledBy={`${uid}-channel-${channel.id}`} />
                          </div>
                        ))}
                      </div>
                      {people.length > 0 && (
                        <div className={styles.people}>
                          <span className={styles.avatars} aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element -- small decorative avatars from caller-provided URLs. */}
                            {people.map(person => <img key={person.id} alt="" width={28} height={28} draggable={false} src={person.avatar} />)}
                          </span>
                          <span className={styles.peopleText}>{people.map(person => person.name).join(", ")} can reach you during focus</span>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}

function TextPreview({ shown }: { shown: MotionValue<number> }) {
  const scale = useTransform(shown, value => value / 100);
  return <span className={styles.textPreview} aria-hidden="true"><motion.span style={{ scale }}>Aa</motion.span></span>;
}

export default ControlCenter;
