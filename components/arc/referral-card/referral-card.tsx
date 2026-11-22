"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Award,
  Check,
  CheckCircle2,
  Clock,
  Mail,
  UserCheck,
  X as CloseIcon,
} from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../motion-tokens";
import styles from "./referral-card.module.css";

export type ReferralStage = "invited" | "signed-up" | "earned";

export type ShareChannel = "x" | "linkedin" | "email";

export interface Referral {
  id: string;
  name?: string;
  email: string;
  avatar?: string;
  stage: ReferralStage;
  invitedAt: string;
}

export interface ReferralMilestone {
  goal: number;
  reward: string;
  detail?: string;
}

export interface ReferralCardProps {
  link: string;
  reward: number;
  currency?: string;
  title?: string;
  description?: string;
  referrals?: Referral[];
  milestone?: ReferralMilestone;
  shareMessage?: string;
  maxInvites?: number;
  simulate?: boolean;
  onCopy?: (link: string) => void;
  onShare?: (channel: ShareChannel, url: string) => void;
  onInvite?: (emails: string[], signal: AbortSignal) => void | Promise<void>;
  onMilestone?: (milestone: ReferralMilestone) => void;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function XLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInLogo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93zM6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37z" />
    </svg>
  );
}

function splitLink(url: string): { base: string; tail: string } {
  const clean = url.replace(/^https?:\/\//, "");
  const lastSlash = clean.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash === clean.length - 1) {
    return { base: "", tail: clean };
  }
  return {
    base: clean.slice(0, lastSlash + 1),
    tail: clean.slice(lastSlash + 1),
  };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildShareUrl(channel: ShareChannel, link: string, message: string): string {
  const text = `${message} ${link}`.trim();
  if (channel === "x") {
    return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }
  if (channel === "linkedin") {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;
  }
  return `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(text)}`;
}

function RollingValue({ value, reduced }: { value: string; reduced: boolean }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className={styles.swapItem}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6 }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.2, ease: motionTokens.ease.standard }
          }
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ReferralCard({
  link,
  reward,
  currency = "USD",
  title,
  description,
  referrals: initialReferrals = [],
  milestone,
  shareMessage,
  maxInvites = 5,
  simulate = false,
  onCopy,
  onShare,
  onInvite,
  onMilestone,
  className,
}: ReferralCardProps) {
  const reduced = useReducedMotion() ?? false;
  const inputId = useId();
  const hintId = useId();
  const headingId = useId();

  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sharedChannel, setSharedChannel] = useState<ShareChannel | null>(null);
  const [hint, setHint] = useState<{
    tone: "default" | "error" | "success";
    text: string;
  }>({
    tone: "default",
    text: "Press Enter or comma to add multiple",
  });
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const milestoneFiredRef = useRef(false);

  const money = useMemo(() => formatMoney(reward, currency), [reward, currency]);
  const displayTitle = title ?? `Give ${money}, get ${money}`;
  const displayDescription =
    description ??
    `Share your link. They get ${money} off their first month, and you earn ${money} credit once they subscribe.`;
  const resolvedShareMessage =
    shareMessage ?? `Try this with ${money} off using my referral link:`;

  const { base: linkBase, tail: linkTail } = useMemo(() => splitLink(link), [link]);

  // Cleanup timers and inflight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  const invitedCount = referrals.length;
  const signedUpCount = useMemo(
    () =>
      referrals.filter((r) => r.stage === "signed-up" || r.stage === "earned").length,
    [referrals],
  );
  const earnedCount = useMemo(
    () => referrals.filter((r) => r.stage === "earned").length,
    [referrals],
  );
  const earnedTotal = earnedCount * reward;
  const milestoneUnlocked = milestone ? earnedCount >= milestone.goal : false;

  useEffect(() => {
    if (!milestone || !milestoneUnlocked || milestoneFiredRef.current) return;
    milestoneFiredRef.current = true;
    onMilestone?.(milestone);
    const t = window.setTimeout(() => {
      setAnnouncement(`Milestone unlocked: ${milestone.reward}.`);
    }, 0);
    return () => window.clearTimeout(t);
  }, [milestone, milestoneUnlocked, onMilestone]);

  const setTempHint = useCallback(
    (tone: "error" | "success", text: string, revertMs = 3600) => {
      setHint({ tone, text });
      setAnnouncement(text);
      const t = window.setTimeout(() => {
        setHint({
          tone: "default",
          text: "Press Enter or comma to add multiple",
        });
      }, revertMs);
      timersRef.current.push(t);
    },
    [],
  );

  const commitTokens = useCallback(
    (raw: string): { added: string[]; error: string | null } => {
      const tokens = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (tokens.length === 0) return { added: [], error: null };

      const existingEmails = new Set([
        ...chips.map((c) => c.toLowerCase()),
        ...referrals.map((r) => r.email.toLowerCase()),
      ]);
      const added: string[] = [];
      let error: string | null = null;

      for (const token of tokens) {
        if (!EMAIL_RE.test(token)) {
          error = `"${token}" is not a valid email address`;
          continue;
        }
        if (existingEmails.has(token)) {
          error = `${token} was already added`;
          continue;
        }
        if (chips.length + added.length >= maxInvites) {
          error = `You can invite up to ${maxInvites} people at once`;
          break;
        }
        existingEmails.add(token);
        added.push(token);
      }

      if (added.length > 0) {
        setChips((prev) => [...prev, ...added]);
        requestAnimationFrame(() => {
          if (trackRef.current) {
            trackRef.current.scrollLeft = trackRef.current.scrollWidth;
          }
        });
      }
      if (error) {
        setTempHint("error", error);
      } else if (added.length > 0) {
        setHint({
          tone: "default",
          text: "Press Enter or comma to add multiple",
        });
      }
      return { added, error };
    },
    [chips, maxInvites, referrals, setTempHint],
  );

  const handleSend = useCallback(async () => {
    if (sending) return;
    let toSend = [...chips];
    if (draft.trim()) {
      const res = commitTokens(draft);
      if (res.error && res.added.length === 0 && toSend.length === 0) {
        return;
      }
      toSend = [...toSend, ...res.added];
      if (res.added.length > 0) setDraft("");
    }
    if (toSend.length === 0) {
      setTempHint("error", "Enter at least one email address");
      inputRef.current?.focus();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);

    try {
      if (onInvite) {
        await onInvite(toSend, controller.signal);
      } else {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 420);
          controller.signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      if (controller.signal.aborted) return;

      const nowIds: string[] = [];
      const newRows: Referral[] = toSend.map((email, idx) => {
        const id = `ref-${Date.now()}-${idx}`;
        nowIds.push(id);
        return {
          id,
          name: nameFromEmail(email),
          email,
          stage: "invited",
          invitedAt: "Just now",
        };
      });

      setReferrals((prev) => [...newRows, ...prev]);
      setChips([]);
      setDraft("");
      setTempHint(
        "success",
        toSend.length === 1
          ? `Invite sent to ${toSend[0]}`
          : `${toSend.length} invites sent`,
      );

      if (simulate) {
        const t1 = window.setTimeout(() => {
          setReferrals((prev) =>
            prev.map((r) =>
              nowIds.includes(r.id) ? { ...r, stage: "signed-up" } : r,
            ),
          );
          setAnnouncement(`${newRows[0]?.name ?? "Invite"} signed up.`);
        }, 1600);
        const t2 = window.setTimeout(() => {
          setReferrals((prev) =>
            prev.map((r) =>
              nowIds.includes(r.id) ? { ...r, stage: "earned" } : r,
            ),
          );
          setAnnouncement(`Earned ${money} from ${newRows[0]?.name ?? "referral"}.`);
        }, 3400);
        timersRef.current.push(t1, t2);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg =
        err instanceof Error ? err.message : "Could not send invites. Try again.";
      setTempHint("error", msg);
    } finally {
      setSending(false);
    }
  }, [chips, commitTokens, draft, money, onInvite, sending, setTempHint, simulate]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (draft.trim()) {
          const { added } = commitTokens(draft);
          if (added.length > 0) setDraft("");
        } else if (chips.length > 0) {
          void handleSend();
        }
        return;
      }
      if (event.key === "," || event.key === " " || event.key === "Tab") {
        if (draft.trim()) {
          event.preventDefault();
          const { added } = commitTokens(draft);
          if (added.length > 0) setDraft("");
        }
        return;
      }
      if (event.key === "Backspace" && draft === "" && chips.length > 0) {
        event.preventDefault();
        setChips((prev) => prev.slice(0, -1));
      }
    },
    [chips.length, commitTokens, draft, handleSend],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData.getData("text");
      if (/[\s,;]+/.test(text.trim())) {
        event.preventDefault();
        const { added } = commitTokens(text);
        if (added.length > 0) setDraft("");
      }
    },
    [commitTokens],
  );

  const handleShare = useCallback(
    (channel: ShareChannel) => {
      const shareUrl = buildShareUrl(channel, link, resolvedShareMessage);
      if (onShare) {
        onShare(channel, shareUrl);
      } else if (typeof window !== "undefined") {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      }
      setSharedChannel(channel);
      setAnnouncement(
        channel === "x"
          ? "Opened share on X."
          : channel === "linkedin"
            ? "Opened share on LinkedIn."
            : "Opened email draft.",
      );
      const t = window.setTimeout(() => {
        setSharedChannel((cur) => (cur === channel ? null : cur));
      }, 1500);
      timersRef.current.push(t);
    },
    [link, onShare, resolvedShareMessage],
  );

  const remainingForMilestone = milestone
    ? Math.max(0, milestone.goal - earnedCount)
    : 0;

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <h2 id={headingId} className={styles.title}>
            {displayTitle}
          </h2>
          <p className={styles.description}>{displayDescription}</p>
        </header>

        <div className={styles.actions}>
          <div className={styles.linkRow}>
            <div className={styles.linkField}>
              <span className={styles.linkText} title={link}>
                {linkBase && <span className={styles.linkBase}>{linkBase}</span>}
                <span>{linkTail}</span>
              </span>
              <CopyButton
                value={link}
                label="Copy link"
                className={styles.copy}
                onCopied={() => {
                  onCopy?.(link);
                  setAnnouncement("Referral link copied.");
                }}
              />
            </div>

            <div className={styles.shareGroup}>
              {(
                [
                  { id: "x", label: "Share on X", icon: <XLogo /> },
                  {
                    id: "linkedin",
                    label: "Share on LinkedIn",
                    icon: <LinkedInLogo />,
                  },
                  {
                    id: "email",
                    label: "Share via email",
                    icon: <Mail size={15} aria-hidden="true" />,
                  },
                ] as const
              ).map((item) => {
                const done = sharedChannel === item.id;
                return (
                  <Tooltip key={item.id} content={item.label}>
                    <button
                      type="button"
                      className={styles.share}
                      aria-label={item.label}
                      data-done={done ? "" : undefined}
                      onClick={() => handleShare(item.id)}
                    >
                      <span className={`${styles.swap} ${styles.shareIcon}`}>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={done ? "done" : "idle"}
                            className={styles.swapItem}
                            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={reduced ? undefined : { opacity: 0, scale: 0.85 }}
                            transition={{
                              duration: reduced ? 0 : 0.14,
                              ease: motionTokens.ease.standard,
                            }}
                          >
                            {done ? <Check size={15} aria-hidden="true" /> : item.icon}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className={styles.inviteRow}>
            <div
              className={styles.chipField}
              data-invalid={hint.tone === "error" ? "" : undefined}
              onClick={() => inputRef.current?.focus()}
            >
              <div ref={trackRef} className={styles.chipTrack}>
                <AnimatePresence initial={false}>
                  {chips.map((email) => (
                    <motion.span
                      key={email}
                      className={styles.chip}
                      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduced ? undefined : { opacity: 0, scale: 0.92 }}
                      transition={{
                        duration: reduced ? 0 : 0.14,
                        ease: motionTokens.ease.standard,
                      }}
                    >
                      <span className={styles.chipText}>{email}</span>
                      <button
                        type="button"
                        className={styles.chipRemove}
                        aria-label={`Remove ${email}`}
                        disabled={sending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setChips((prev) => prev.filter((c) => c !== email));
                        }}
                      >
                        <CloseIcon size={12} aria-hidden="true" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>

                <input
                  ref={inputRef}
                  id={inputId}
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  className={styles.chipInput}
                  placeholder={
                    chips.length === 0 ? "Invite by email..." : "Add another..."
                  }
                  value={draft}
                  disabled={sending}
                  aria-label="Invite friends by email"
                  aria-describedby={hintId}
                  aria-invalid={hint.tone === "error" ? "true" : undefined}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (hint.tone === "error") {
                      setHint({
                        tone: "default",
                        text: "Press Enter or comma to add multiple",
                      });
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              className={styles.send}
              disabled={sending}
              onClick={() => void handleSend()}
            >
              {sending ? "Sending" : "Send"}
            </Button>
          </div>

          <p
            id={hintId}
            className={styles.hint}
            data-tone={hint.tone !== "default" ? hint.tone : undefined}
          >
            <span className={styles.swap}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${hint.tone}:${hint.text}`}
                  className={styles.swapItem}
                  initial={reduced ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -3 }}
                  transition={{
                    duration: reduced ? 0 : 0.14,
                    ease: motionTokens.ease.standard,
                  }}
                >
                  {hint.tone === "success" && (
                    <span className={styles.hintIcon}>
                      <Check size={13} aria-hidden="true" />
                    </span>
                  )}
                  <span className={styles.hintText}>{hint.text}</span>
                </motion.span>
              </AnimatePresence>
            </span>
          </p>
        </div>

        <div className={styles.progress}>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Invited</dt>
              <dd>
                <RollingValue value={String(invitedCount)} reduced={reduced} />
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Signed up</dt>
              <dd>
                <RollingValue value={String(signedUpCount)} reduced={reduced} />
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Earned</dt>
              <dd>
                <RollingValue
                  value={formatMoney(earnedTotal, currency)}
                  reduced={reduced}
                />
              </dd>
            </div>
          </dl>

          {milestone && (
            <div
              className={styles.milestone}
              data-unlocked={milestoneUnlocked ? "" : undefined}
            >
              <div className={styles.milestoneHead}>
                <div className={`${styles.swap} ${styles.milestoneText}`}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={milestoneUnlocked ? "unlocked" : `rem-${remainingForMilestone}`}
                      className={styles.swapItem}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.18,
                        ease: motionTokens.ease.standard,
                      }}
                    >
                      <span className={styles.milestoneIcon} aria-hidden="true">
                        {milestoneUnlocked ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <Award size={15} />
                        )}
                      </span>
                      <span className={styles.milestoneCopy}>
                        {milestoneUnlocked ? (
                          <>
                            <span className={styles.milestoneStrong}>
                              Unlocked: {milestone.reward}
                            </span>
                            {milestone.detail && (
                              <span className={styles.milestoneDetail}>
                                {milestone.detail}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span>
                              {remainingForMilestone} more{" "}
                              {remainingForMilestone === 1 ? "referral" : "referrals"} for{" "}
                              <span className={styles.milestoneStrong}>
                                {milestone.reward}
                              </span>
                            </span>
                            {milestone.detail && (
                              <span className={styles.milestoneDetail}>
                                {milestone.detail}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </motion.span>
                  </AnimatePresence>
                </div>

                <span className={styles.milestoneCount}>
                  {Math.min(earnedCount, milestone.goal)} / {milestone.goal}
                </span>
              </div>

              <div
                className={styles.segments}
                role="progressbar"
                aria-label="Referral milestone progress"
                aria-valuemin={0}
                aria-valuemax={milestone.goal}
                aria-valuenow={Math.min(earnedCount, milestone.goal)}
                aria-valuetext={
                  milestoneUnlocked
                    ? `${milestone.goal} of ${milestone.goal} paid referrals, ${milestone.reward} unlocked`
                    : `${earnedCount} of ${milestone.goal} paid referrals toward ${milestone.reward}`
                }
              >
                {Array.from({ length: milestone.goal }).map((_, idx) => (
                  <span key={idx} className={styles.segment}>
                    <span
                      className={styles.segmentFill}
                      style={{
                        transform: idx < earnedCount ? "scaleX(1)" : "scaleX(0)",
                      }}
                    />
                  </span>
                ))}
              </div>
            </div>
          )}

          <ul className={styles.list} aria-label="Referrals">
            {referrals.length === 0 ? (
              <li className={styles.empty}>
                No referrals yet. Share your link or send an invite above.
              </li>
            ) : (
              <AnimatePresence initial={false}>
                {referrals.map((r) => (
                  <motion.li
                    key={r.id}
                    className={styles.item}
                    initial={reduced ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduced ? undefined : { opacity: 0, height: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 0.22, ease: motionTokens.ease.standard }
                    }
                  >
                    <div className={styles.row}>
                      <Avatar
                        name={r.name ?? r.email}
                        src={r.avatar}
                        size="sm"
                      />
                      <div className={styles.who}>
                        <span className={styles.name}>{r.name ?? r.email}</span>
                        <span className={styles.meta}>
                          <span className={styles.metaEmail}>{r.email}</span>
                          <span aria-hidden="true">·</span>
                          <span className={styles.metaDate}>{r.invitedAt}</span>
                        </span>
                      </div>

                      <div className={`${styles.swap} ${styles.stage}`}>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={r.stage}
                            className={`${styles.swapItem} ${styles.stageInner}`}
                            data-stage={r.stage}
                            initial={reduced ? false : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduced ? undefined : { opacity: 0, y: -4 }}
                            transition={{
                              duration: reduced ? 0 : 0.16,
                              ease: motionTokens.ease.standard,
                            }}
                          >
                            {r.stage === "earned" ? (
                              <>
                                <CheckCircle2 size={14} aria-hidden="true" />
                                <span>+{money}</span>
                              </>
                            ) : r.stage === "signed-up" ? (
                              <>
                                <UserCheck size={14} aria-hidden="true" />
                                <span>Signed up</span>
                              </>
                            ) : (
                              <>
                                <Clock size={14} aria-hidden="true" />
                                <span>Invited</span>
                              </>
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            )}
          </ul>
        </div>
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
