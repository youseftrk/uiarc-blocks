"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, Check, Lock, Users, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "../button/button";
import { useReducedMotion } from "../use-reduced-motion";
import { LinearMark, OktaMark, SlackMark } from "./marks";
import styles from "./trial-banner.module.css";

export type TrialBannerVariant = "banner" | "card" | "pill";
export type TrialTone = "active" | "warning" | "expired" | "upgraded";

export interface TrialFeature {
  id: string;
  label: string;
  detail?: string;
  /** A 14px mark. */
  icon?: ReactNode;
}

export interface TrialSnooze {
  id: "tomorrow" | "three-days" | "warning";
  label: string;
  /** Days from today until the reminder. */
  days: number;
}

export interface TrialBannerProps {
  variant?: TrialBannerVariant;
  plan?: string;
  daysLeft?: number;
  trialDays?: number;
  endsAt?: Date | number | string;
  warnAt?: number;
  workspace?: string;
  features?: TrialFeature[];
  lossSummary?: string;
  onAddPayment?: (signal: AbortSignal) => Promise<void> | void;
  onComparePlans?: () => void;
  onManageBilling?: () => void;
  onDismiss?: () => void;
  onSnooze?: (snooze: TrialSnooze & { until: Date }) => void;
  collapseTo?: "pill" | "none";
  dismissible?: boolean;
  snoozable?: boolean;
  className?: string;
}

const DAY = 86_400_000;
const SAMPLE_TODAY = Date.UTC(2026, 9, 27, 12);
const SIMULATED_MS = 900;
const NOTE_MS = 2400;

const DEFAULT_FEATURES: TrialFeature[] = [
  { id: "sso", label: "Single sign-on with Okta", icon: <OktaMark /> },
  { id: "slack", label: "Slack alerts", detail: "4 channels", icon: <SlackMark /> },
  { id: "linear", label: "Linear issue sync", detail: "148 issues", icon: <LinearMark /> },
  { id: "seats", label: "Team seats", detail: "12 in use", icon: <Users size={14} strokeWidth={1.8} aria-hidden="true" /> },
];

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date);
const shortDate = (date: Date) => fmt(date, { month: "short", day: "numeric" });
const longDate = (date: Date) => `${fmt(date, { weekday: "short" })}, ${shortDate(date)}`;
const weekday = (date: Date) => fmt(date, { weekday: "long" });
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/** Old content fades out in 100ms while the new one rises 2px over 160ms, both in one grid cell. */
function Swap({ id, className, reduced, children }: { id: string; className?: string; reduced: boolean; children: ReactNode }) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : { duration: 0.16, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Ring({ size, radius, stroke, tone, fraction, reduced, children }: { size: number; radius: number; stroke: number; tone: TrialTone; fraction: number; reduced: boolean; children?: ReactNode }) {
  const center = size / 2;
  const offset = tone === "upgraded" ? 0 : 1 - fraction;
  return (
    <span className={styles.ring} data-tone={tone} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.ringSvg}>
        <circle className={styles.ringTrack} cx={center} cy={center} r={radius} strokeWidth={stroke} />
        <motion.circle
          className={styles.ringValue}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          pathLength={1}
          strokeDasharray="1 1"
          initial={false}
          animate={{ strokeDashoffset: offset, opacity: tone === "expired" ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { type: "spring", duration: 0.24, bounce: 0 }}
        />
      </svg>
      {children}
    </span>
  );
}

export function TrialBanner({
  variant = "banner",
  plan = "Pro",
  daysLeft = 9,
  trialDays = 14,
  endsAt,
  warnAt = 3,
  workspace = "Northwind",
  features = DEFAULT_FEATURES,
  lossSummary = "Okta SSO and 12 seats",
  onAddPayment,
  onComparePlans,
  onManageBilling,
  onDismiss,
  onSnooze,
  collapseTo = "pill",
  dismissible = true,
  snoozable = true,
  className,
}: TrialBannerProps) {
  const reduced = useReducedMotion();
  const menuId = useId();
  const [upgraded, setUpgraded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pillWidth, setPillWidth] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const focusNext = useRef<"pill" | "primary" | null>(null);

  const days = Math.max(0, Math.floor(daysLeft));
  const tone: TrialTone = upgraded ? "upgraded" : days <= 0 ? "expired" : days <= warnAt ? "warning" : "active";
  const end = useMemo(() => (endsAt === undefined ? new Date(SAMPLE_TODAY + days * DAY) : new Date(endsAt)), [endsAt, days]);
  const today = useMemo(() => new Date(end.getTime() - days * DAY), [end, days]);
  const fraction = Math.min(1, Math.max(0, days / Math.max(1, trialDays)));
  const dayWord = days === 1 ? "1 day" : `${days} days`;

  const copy = useMemo(() => {
    if (tone === "upgraded") {
      const billing = days > 0 ? `Billing starts ${shortDate(end)}.` : `${plan} is active again.`;
      return { title: `You're all set on ${plan}`, sub: `Payment method added. ${billing}`, meta: days > 0 ? `Billing starts ${longDate(end)}` : `${plan} is active`, list: `Included with ${plan}`, pill: `${plan} active`, primary: "Done", secondary: "Manage billing" };
    }
    if (tone === "expired") {
      return { title: `Your ${plan} trial has ended`, sub: `${lossSummary} are paused on Free.`, meta: `Ended ${longDate(end)}`, list: `Paused while ${workspace} is on Free`, pill: "Trial ended", primary: `Upgrade to ${plan}`, secondary: "Compare plans" };
    }
    if (tone === "warning") {
      const when = days === 1 ? "tomorrow" : `in ${dayWord}`;
      return { title: `Your ${plan} trial ends ${when}`, sub: `On ${weekday(end)} you lose ${lossSummary}.`, meta: `Ends ${longDate(end)}`, list: `You lose these on ${weekday(end)}`, pill: `${dayWord} left`, primary: "Add payment method", secondary: "Compare plans" };
    }
    return { title: `${dayWord} left in your ${plan} trial`, sub: `Keep ${lossSummary} after ${shortDate(end)}.`, meta: `Trial ends ${longDate(end)}`, list: "Add a card to keep", pill: `${dayWord} left`, primary: "Add payment method", secondary: "Compare plans" };
  }, [tone, days, dayWord, end, plan, lossSummary, workspace]);

  const snoozes = useMemo<TrialSnooze[]>(() => {
    const list: TrialSnooze[] = [{ id: "tomorrow", label: "Remind me tomorrow", days: 1 }];
    if (tone === "active") {
      if (days - warnAt > 3) list.push({ id: "three-days", label: "Remind me in 3 days", days: 3 });
      if (days - warnAt > 1) list.push({ id: "warning", label: `Remind me when ${warnAt === 1 ? "1 day is" : `${warnAt} days are`} left`, days: days - warnAt });
    }
    return list;
  }, [tone, days, warnAt]);

  const flash = useCallback((text: string) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote(text);
    noteTimer.current = setTimeout(() => setNote(null), NOTE_MS);
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (node) setPillWidth(Math.ceil(node.getBoundingClientRect().width));
  }, [copy.pill, collapsed, variant]);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    (target === "pill" ? pillRef.current : primaryRef.current)?.focus({ preventScroll: true });
  }, [collapsed]);

  const collapse = useCallback(() => {
    if (variant === "pill") {
      setPopoverOpen(false);
      return;
    }
    focusNext.current = collapseTo === "pill" ? "pill" : null;
    setCollapsed(true);
  }, [variant, collapseTo]);

  const pay = useCallback(async () => {
    if (busy) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setBusy(true);
    setFailed(false);
    setAnnouncement(onAddPayment ? "Opening billing." : "Opening billing. Simulated, no card is charged.");
    try {
      if (onAddPayment) await onAddPayment(controller.signal);
      else await new Promise<void>(resolve => setTimeout(resolve, SIMULATED_MS));
      if (controller.signal.aborted) return;
      setUpgraded(true);
      setAnnouncement(`Payment method added. You stay on ${plan}.${onAddPayment ? "" : " Simulated, no card was charged."}`);
    } catch {
      if (controller.signal.aborted) return;
      setFailed(true);
      setAnnouncement("Billing could not open. Try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [busy, onAddPayment, plan]);

  const primary = useCallback(() => {
    if (tone === "upgraded") {
      onDismiss?.();
      collapse();
      return;
    }
    void pay();
  }, [tone, onDismiss, collapse, pay]);

  const secondary = useCallback(() => {
    if (tone === "upgraded") {
      if (onManageBilling) onManageBilling();
      else flash("Simulated: this opens your billing settings.");
      return;
    }
    if (onComparePlans) onComparePlans();
    else flash("Simulated: this opens your plans page.");
  }, [tone, onManageBilling, onComparePlans, flash]);

  const dismiss = useCallback(() => {
    onDismiss?.();
    setAnnouncement(`Trial banner hidden.${onDismiss ? "" : " Simulated, nothing was saved."}`);
    collapse();
  }, [onDismiss, collapse]);

  const snooze = useCallback((choice: TrialSnooze) => {
    const until = new Date(today.getTime() + choice.days * DAY);
    onSnooze?.({ ...choice, until });
    setAnnouncement(`Snoozed until ${longDate(until)}.${onSnooze ? "" : " Simulated, nothing was saved."}`);
    collapse();
  }, [today, onSnooze, collapse]);

  const expand = useCallback(() => {
    focusNext.current = "primary";
    setAnnouncement("");
    setCollapsed(false);
  }, []);

  const subText = failed && tone !== "upgraded" ? "Billing could not open." : note ?? copy.sub;
  const primaryLabel = failed && tone !== "upgraded" ? "Try again" : copy.primary;

  const center = tone === "upgraded"
    ? <Check size={14} strokeWidth={2} className={styles.ringCheck} aria-hidden="true" />
    : tone === "expired"
      ? <Lock size={14} strokeWidth={1.8} className={styles.ringLock} aria-hidden="true" />
      : <span className={styles.ringDays}>{days}</span>;
  const centerKey = tone === "upgraded" ? "check" : tone === "expired" ? "lock" : `d${days}`;

  const icons = (snoozable || dismissible) && (
    <span className={styles.icons}>
      {snoozable && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={styles.iconButton} aria-label="Snooze" id={menuId}>
              <AlarmClock size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} side="bottom" align="end" sideOffset={6} collisionPadding={12}>
              {snoozes.map(choice => (
                <DropdownMenu.Item key={choice.id} className={styles.menuItem} onSelect={() => snooze(choice)}>
                  {choice.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      {dismissible && (
        <button type="button" className={styles.iconButton} aria-label="Dismiss" onClick={dismiss}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </span>
  );

  const card = (floating: boolean) => (
    <div className={cx(styles.card, floating && styles.cardFloating)} data-tone={tone}>
      <div className={styles.cardHead}>
        <Ring size={40} radius={18.5} stroke={3} tone={tone} fraction={fraction} reduced={reduced}>
          <Swap id={centerKey} className={styles.ringCenter} reduced={reduced}>{center}</Swap>
        </Ring>
        {icons}
      </div>
      <Swap id={copy.title} className={styles.cardTitle} reduced={reduced}><span className={styles.truncate}>{copy.title}</span></Swap>
      <Swap id={failed ? "failed" : note ?? copy.meta} className={styles.cardMeta} reduced={reduced}><span className={styles.truncate}>{failed && tone !== "upgraded" ? "Billing could not open." : note ?? copy.meta}</span></Swap>
      <div className={styles.list}>
        <Swap id={copy.list} className={styles.listLabel} reduced={reduced}><span className={styles.truncate}>{copy.list}</span></Swap>
        <ul className={styles.rows}>
          {features.map(feature => (
            <li key={feature.id} className={styles.row}>
              <span className={styles.rowIcon} aria-hidden="true">{feature.icon}</span>
              <span className={styles.rowLabel}>{feature.label}</span>
              {feature.detail && <span className={styles.rowDetail}>{feature.detail}</span>}
              <Swap id={tone === "expired" ? "lock" : tone === "upgraded" ? "check" : "none"} className={styles.rowState} reduced={reduced}>
                {tone === "expired" ? <Lock size={14} strokeWidth={1.8} aria-label="Paused" /> : tone === "upgraded" ? <Check size={14} strokeWidth={2} className={styles.ringCheck} aria-label="Active" /> : <span />}
              </Swap>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.cardActions}>
        <Button ref={primaryRef} variant="primary" size="md" loading={busy} onClick={primary}>{primaryLabel}</Button>
        <Button variant="ghost" size="md" onClick={secondary}>{copy.secondary}</Button>
      </div>
    </div>
  );

  const pillInner = (
    <>
      <Swap id={centerKey === "check" || centerKey === "lock" ? centerKey : "ring"} className={styles.pillLead} reduced={reduced}>
        {tone === "upgraded" ? (
          <Check size={14} strokeWidth={2} className={styles.ringCheck} aria-hidden="true" />
        ) : tone === "expired" ? (
          <Lock size={14} strokeWidth={1.8} className={styles.ringLock} aria-hidden="true" />
        ) : (
          <Ring size={16} radius={7} stroke={2} tone={tone} fraction={fraction} reduced={reduced} />
        )}
      </Swap>
      <motion.span
        className={styles.pillLabel}
        initial={false}
        animate={pillWidth === null ? undefined : { width: pillWidth }}
        transition={reduced ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
      >
        <span ref={measureRef} className={styles.pillMeasure} aria-hidden="true">{copy.pill}</span>
        <Swap id={copy.pill} reduced={reduced}><span className={styles.truncate}>{copy.pill}</span></Swap>
      </motion.span>
    </>
  );

  let view: ReactNode;
  let viewKey: string;
  if (variant === "pill") {
    viewKey = "pill";
    view = (
      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger asChild>
          <button ref={pillRef} type="button" className={styles.pill} data-tone={tone} aria-label={`${plan} trial: ${copy.pill}`}>
            {pillInner}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.popover}
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-label={`${plan} trial`}
            onOpenAutoFocus={event => {
              event.preventDefault();
              primaryRef.current?.focus({ preventScroll: true });
            }}
          >
            {card(true)}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  } else if (collapsed) {
    viewKey = "collapsed";
    view = collapseTo === "none" ? null : (
      <button ref={pillRef} type="button" className={styles.pill} data-tone={tone} aria-label={`${plan} trial: ${copy.pill}. Show details`} onClick={expand}>
        {pillInner}
      </button>
    );
  } else if (variant === "card") {
    viewKey = "card";
    view = <section aria-label={`${plan} trial`}>{card(false)}</section>;
  } else {
    viewKey = "banner";
    view = (
      <section className={styles.banner} data-tone={tone} aria-label={`${plan} trial`}>
        <span className={styles.bannerRing}>
          <Ring size={28} radius={12.75} stroke={2.5} tone={tone} fraction={fraction} reduced={reduced}>
            <Swap id={centerKey} className={styles.ringCenter} reduced={reduced}>{center}</Swap>
          </Ring>
        </span>
        <div className={styles.bannerText}>
          <Swap id={copy.title} className={styles.bannerTitle} reduced={reduced}><span className={styles.truncate}>{copy.title}</span></Swap>
          <Swap id={subText} className={styles.bannerSub} reduced={reduced}>
            <span className={styles.subInner}><span className={styles.subText}>{subText}</span></span>
          </Swap>
        </div>
        <div className={styles.bannerActions}>
          <Button variant="ghost" size="sm" onClick={secondary}>{copy.secondary}</Button>
          <Button ref={primaryRef} variant="primary" size="sm" loading={busy} onClick={primary}>{primaryLabel}</Button>
        </div>
        {icons}
      </section>
    );
  }

  const rootClass = cx(styles.root, variant === "banner" && styles.isBanner, variant === "card" && styles.isCard, variant === "pill" && styles.isPill, className);

  return (
    <div className={rootClass}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewKey}
          className={styles.view}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16 } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
        >
          {view}
        </motion.div>
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

export default TrialBanner;
