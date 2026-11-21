"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Share2,
  X,
} from "lucide-react";
import styles from "./share-sheet.module.css";

export interface SharePerson {
  id: string;
  name: string;
  avatar?: string;
}

export interface ShareSheetAccess {
  value: string;
  label: string;
  description: string;
  icon: ReactNode;
}

/** @deprecated Use ShareSheetAccess instead. */
export type ShareAccess = ShareSheetAccess;

export interface ShareChannel {
  id: string;
  label: string;
  icon: ReactNode;
  doneLabel: string;
}

export interface ShareSubmission {
  people: SharePerson[];
  access: string;
}

export interface ShareSheetProps {
  title: string;
  link: string;
  people: SharePerson[];
  access: ShareSheetAccess[];
  channels?: ShareChannel[];
  defaultAccess?: string;
  onSend?: (submission: ShareSubmission) => void | Promise<unknown>;
  onChannel?: (channel: string) => void | Promise<unknown>;
  onCopy?: (access: string) => void;
  label?: string;
  align?: "start" | "end" | "center";
  sheetOnPhones?: boolean;
  className?: string;
}

type ChannelStatus = "idle" | "pending" | "done" | "failed";
type Face = "closed" | "panel" | "sent";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ShareSheet({
  title,
  link,
  people,
  access,
  channels = [],
  defaultAccess,
  onSend,
  onChannel,
  onCopy,
  label = "Share",
  align = "end",
  sheetOnPhones = true,
  className,
}: ShareSheetProps) {
  const prefersReduced = useReducedMotion();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const doneBtnRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [face, setFace] = useState<Face>("closed");
  const [selectedAccess, setSelectedAccess] = useState<string>(
    defaultAccess ?? access[0]?.value ?? ""
  );
  const [accessOpen, setAccessOpen] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [channelState, setChannelState] = useState<Record<string, ChannelStatus>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [shakeTick, setShakeTick] = useState(0);
  const [sentNames, setSentNames] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    if (!sheetOnPhones || typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 520px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [sheetOnPhones]);

  const closePanel = useCallback((returnFocus = false) => {
    setFace("closed");
    setAccessOpen(false);
    setSendError(null);
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (face === "closed") return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closePanel(false);
      }
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (accessOpen) {
          setAccessOpen(false);
        } else {
          closePanel(true);
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [face, accessOpen, closePanel]);

  useEffect(() => {
    if (face === "panel") {
      requestAnimationFrame(() => copyBtnRef.current?.focus());
    } else if (face === "sent") {
      requestAnimationFrame(() => doneBtnRef.current?.focus());
    }
  }, [face]);

  const currentAccess =
    access.find((a) => a.value === selectedAccess) ?? access[0];
  const pickedPeople = pickedIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is SharePerson => Boolean(p));

  const handleOpen = () => {
    setSendError(null);
    setFace("panel");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(link);
    } catch {
      // Clipboard may be unavailable in restricted contexts.
    }
    setCopied(true);
    setStatusMessage(`Copied link (${currentAccess?.label ?? selectedAccess})`);
    onCopy?.(selectedAccess);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const togglePerson = (person: SharePerson) => {
    setSendError(null);
    setPickedIds((prev) => {
      if (prev.includes(person.id)) {
        setStatusMessage(`Removed ${person.name}`);
        return prev.filter((id) => id !== person.id);
      }
      setStatusMessage(`Added ${person.name}`);
      return [...prev, person.id];
    });
  };

  const handleChannelClick = async (channel: ShareChannel) => {
    if (channelState[channel.id] === "pending") return;
    setChannelState((prev) => ({ ...prev, [channel.id]: "pending" }));
    try {
      await onChannel?.(channel.id);
      setChannelState((prev) => ({ ...prev, [channel.id]: "done" }));
      setStatusMessage(`${channel.label}: ${channel.doneLabel}`);
      window.setTimeout(() => {
        setChannelState((prev) => ({ ...prev, [channel.id]: "idle" }));
      }, 2200);
    } catch {
      setChannelState((prev) => ({ ...prev, [channel.id]: "failed" }));
      setStatusMessage(`${channel.label} failed`);
      window.setTimeout(() => {
        setChannelState((prev) => ({ ...prev, [channel.id]: "idle" }));
      }, 2200);
    }
  };

  const handleSend = async () => {
    if (pickedPeople.length === 0) {
      setShakeTick((n) => n + 1);
      setStatusMessage("Pick at least one person to send to");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSend?.({ people: pickedPeople, access: selectedAccess });
      const names = pickedPeople.map((p) => p.name);
      setSentNames(names);
      setStatusMessage(`Shared "${title}" with ${names.join(", ")}`);
      setPickedIds([]);
      setFace("sent");
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Could not send share. Please try again.";
      setSendError(msg);
      setStatusMessage(msg);
    } finally {
      setSending(false);
    }
  };

  const handleAccessKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = access.findIndex((a) => a.value === selectedAccess);
    if (["ArrowDown", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const next = (idx + 1) % access.length;
      setSelectedAccess(access[next].value);
      optionRefs.current[next]?.focus();
    } else if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      const prev = (idx - 1 + access.length) % access.length;
      setSelectedAccess(access[prev].value);
      optionRefs.current[prev]?.focus();
    }
  };

  const alignClass =
    align === "start"
      ? styles.alignStart
      : align === "center"
        ? styles.alignCenter
        : styles.alignEnd;

  const panelContent = (
    <div
      className={styles.panel}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className={styles.panelHeader}>
        <h3 id={titleId} className={styles.panelTitle}>
          Share &ldquo;{title}&rdquo;
        </h3>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Close share sheet"
          onClick={() => closePanel(true)}
        >
          <X size={15} />
        </button>
      </div>

      <div className={styles.linkRow}>
        <span className={styles.linkText}>{link}</span>
        <button
          ref={copyBtnRef}
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {currentAccess && (
        <div className={styles.accessBox}>
          <button
            type="button"
            className={styles.accessTrigger}
            aria-expanded={accessOpen}
            aria-haspopup="listbox"
            onClick={() => setAccessOpen((o) => !o)}
          >
            <span className={styles.accessIcon}>{currentAccess.icon}</span>
            <span className={styles.accessMeta}>
              <span className={styles.accessLabel}>{currentAccess.label}</span>
              <span className={styles.accessDesc}>
                {currentAccess.description}
              </span>
            </span>
            <ChevronDown
              size={15}
              style={{
                color: "var(--text-muted)",
                transform: accessOpen ? "rotate(180deg)" : "none",
                transition: "transform 160ms ease",
              }}
            />
          </button>

          <AnimatePresence initial={false}>
            {accessOpen && (
              <motion.div
                role="listbox"
                aria-label="Access level"
                className={styles.accessList}
                onKeyDown={handleAccessKeyDown}
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
              >
                {access.map((opt, idx) => {
                  const selected = opt.value === selectedAccess;
                  return (
                    <button
                      key={opt.value}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      className={styles.accessOption}
                      onClick={() => {
                        setSelectedAccess(opt.value);
                        setAccessOpen(false);
                        setStatusMessage(`Access set to ${opt.label}`);
                      }}
                    >
                      <span className={styles.accessIcon}>{opt.icon}</span>
                      <span className={styles.accessMeta}>
                        <span className={styles.accessLabel}>{opt.label}</span>
                        <span className={styles.accessDesc}>
                          {opt.description}
                        </span>
                      </span>
                      {selected && (
                        <Check size={14} style={{ color: "var(--accent)" }} />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {channels.length > 0 && (
        <div className={styles.channelsRow}>
          {channels.map((ch) => {
            const st = channelState[ch.id] ?? "idle";
            return (
              <button
                key={ch.id}
                type="button"
                disabled={st === "pending"}
                className={`${styles.channelBtn} ${
                  st === "done"
                    ? styles.channelDone
                    : st === "failed"
                      ? styles.channelFailed
                      : ""
                }`}
                onClick={() => handleChannelClick(ch)}
              >
                {st === "pending" ? (
                  <Loader2 size={14} className={styles.spinner} />
                ) : st === "done" ? (
                  <Check size={14} />
                ) : (
                  ch.icon
                )}
                <span>
                  {st === "done"
                    ? ch.doneLabel
                    : st === "failed"
                      ? "Failed"
                      : ch.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div>
        <div className={styles.sectionLabel}>Send to</div>
        <motion.div
          key={shakeTick}
          className={styles.sendToRow}
          animate={
            shakeTick > 0 && !prefersReduced
              ? { x: [0, -7, 7, -5, 5, -2, 0] }
              : undefined
          }
          transition={{ duration: 0.36 }}
        >
          {pickedPeople.length === 0 ? (
            <span className={styles.sendToPlaceholder}>
              Pick people below to send directly
            </span>
          ) : (
            <AnimatePresence initial={false}>
              {pickedPeople.map((person) => (
                <motion.span
                  key={person.id}
                  layout={!prefersReduced}
                  initial={
                    prefersReduced
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.72, y: 12 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={
                    prefersReduced
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.75 }
                  }
                  transition={{ type: "spring", stiffness: 460, damping: 32 }}
                  className={styles.chip}
                >
                  {person.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatar}
                      alt=""
                      className={styles.chipAvatar}
                    />
                  ) : null}
                  <span>{person.name.split(" ")[0]}</span>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={`Remove ${person.name}`}
                    onClick={() => togglePerson(person)}
                  >
                    <X size={11} />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          )}
        </motion.div>
      </div>

      <div className={styles.peopleGrid}>
        {people.map((person) => {
          const pressed = pickedIds.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={pressed}
              className={styles.personBtn}
              onClick={() => togglePerson(person)}
            >
              <span className={styles.avatarWrap}>
                {person.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={person.avatar}
                    alt={person.name}
                    className={styles.avatarImg}
                  />
                ) : (
                  <span className={styles.avatarInitials}>
                    {initials(person.name)}
                  </span>
                )}
                {pressed && (
                  <span className={styles.avatarCheck} aria-hidden="true">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className={styles.personName}>
                {person.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {sendError && (
        <p role="alert" className={styles.errorMsg}>
          {sendError}
        </p>
      )}

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.sendBtn}
          disabled={sending}
          onClick={handleSend}
        >
          {sending ? (
            <>
              <Loader2 size={15} className={styles.spinner} />
              <span>Sending…</span>
            </>
          ) : (
            <>
              <span>Send</span>
              {pickedPeople.length > 0 && (
                <span className={styles.countSlot}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={pickedPeople.length}
                      initial={
                        prefersReduced ? { opacity: 0 } : { y: 10, opacity: 0 }
                      }
                      animate={{ y: 0, opacity: 1 }}
                      exit={
                        prefersReduced ? { opacity: 0 } : { y: -10, opacity: 0 }
                      }
                      transition={{ duration: 0.16 }}
                    >
                      {pickedPeople.length}
                    </motion.span>
                  </AnimatePresence>
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const confirmContent = (
    <div
      className={styles.confirmFace}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className={styles.confirmIcon}>
        <Check size={20} strokeWidth={2.5} />
      </div>
      <h3 id={titleId} className={styles.confirmTitle}>
        Sent
      </h3>
      <p className={styles.confirmDesc}>
        Shared &ldquo;{title}&rdquo; with {sentNames.join(", ")}.
      </p>
      <button
        ref={doneBtnRef}
        type="button"
        className={styles.doneBtn}
        onClick={() => closePanel(true)}
      >
        Done
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className={`${styles.root} ${className ?? ""}`}>
      <div
        className={styles.morphShell}
        style={{
          borderRadius: 999,
          visibility: face !== "closed" && !isPhone ? "hidden" : "visible",
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-haspopup="dialog"
          aria-expanded={face !== "closed"}
          onClick={handleOpen}
        >
          <Share2 size={15} />
          <span>{label}</span>
        </button>
      </div>

      <AnimatePresence>
        {face !== "closed" && isPhone && (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => closePanel(true)}
            />
            <motion.div
              className={styles.mobileSheet}
              drag={prefersReduced ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 420) {
                  closePanel(true);
                }
              }}
              initial={prefersReduced ? { opacity: 0 } : { y: "100%" }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              <div className={styles.grabber} aria-hidden="true" />
              {face === "panel" ? panelContent : confirmContent}
            </motion.div>
          </>
        )}

        {face !== "closed" && !isPhone && (
          <motion.div
            key="desktop-panel"
            layout={!prefersReduced}
            className={`${styles.morphShell} ${styles.morphShellOpen} ${alignClass}`}
            style={{
              borderRadius: 18,
              width:
                face === "sent"
                  ? "min(19rem, calc(100vw - 2rem))"
                  : undefined,
            }}
            initial={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.92, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, filter: "blur(4px)" }
            }
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
          >
            {face === "panel" ? panelContent : confirmContent}
          </motion.div>
        )}
      </AnimatePresence>

      <span role="status" aria-live="polite" className={styles.srOnly}>
        {statusMessage}
      </span>
    </div>
  );
}
