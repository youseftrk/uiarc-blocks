"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Globe,
  Link2,
  Lock,
  X,
} from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./share-access.module.css";

export type ShareRole = "viewer" | "commenter" | "editor";
export type ShareMemberRole = "owner" | ShareRole;
export type ShareGeneralAccess = "restricted" | "link";

export interface ShareAccessContact {
  email: string;
  name?: string;
  src?: string;
}

export interface ShareAccessMember {
  id: string;
  email: string;
  name?: string;
  src?: string;
  role: ShareMemberRole;
  pending?: boolean;
}

export interface ShareAccessProps {
  title?: string;
  members?: readonly ShareAccessMember[];
  defaultMembers?: readonly ShareAccessMember[];
  onMembersChange?: (members: ShareAccessMember[]) => void;
  access?: ShareGeneralAccess;
  defaultAccess?: ShareGeneralAccess;
  onAccessChange?: (access: ShareGeneralAccess) => void;
  linkRole?: ShareRole;
  defaultLinkRole?: ShareRole;
  onLinkRoleChange?: (role: ShareRole) => void;
  directory?: readonly ShareAccessContact[];
  link?: string;
  selfId?: string;
  defaultInviteRole?: ShareRole;
  onInvite?: (
    people: ShareAccessContact[],
    role: ShareRole,
  ) => void | Promise<void>;
  onCopyLink?: (link: string) => void;
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
}

interface ChipItem {
  key: string;
  email: string;
  name?: string;
  src?: string;
  valid: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: { value: ShareRole; label: string; hint: string }[] = [
  { value: "editor", label: "Can edit", hint: "Edit and share" },
  { value: "commenter", label: "Can comment", hint: "View and add comments" },
  { value: "viewer", label: "Can view", hint: "Read only" },
];

const ROLE_LABEL: Record<ShareRole, string> = {
  editor: "Can edit",
  commenter: "Can comment",
  viewer: "Can view",
};

const ACCESS_OPTIONS: {
  value: ShareGeneralAccess;
  label: string;
  hint: string;
}[] = [
  {
    value: "restricted",
    label: "Restricted",
    hint: "Only people with access can open",
  },
  {
    value: "link",
    label: "Anyone with the link",
    hint: "Anyone on the internet with the link",
  },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #f472b6 0%, #60a5fa 55%, #34d399 100%)",
  "linear-gradient(135deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
  "linear-gradient(135deg, #a3e635 0%, #22c55e 45%, #8b5cf6 100%)",
  "linear-gradient(135deg, #38bdf8 0%, #2dd4bf 50%, #fb7185 100%)",
  "linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ec4899 100%)",
  "linear-gradient(135deg, #818cf8 0%, #38bdf8 55%, #2dd4bf 100%)",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function AvatarFace({
  name,
  email,
  src,
  size = 32,
}: {
  name?: string;
  email: string;
  src?: string;
  size?: number;
}) {
  const gradient = AVATAR_GRADIENTS[hashString(email) % AVATAR_GRADIENTS.length];
  const initial = (name || email).trim().charAt(0).toUpperCase();

  return (
    <span
      className={styles.face}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: src ? undefined : gradient,
      }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={styles.photo} />
      ) : (
        <span className={styles.srOnly}>{initial}</span>
      )}
    </span>
  );
}

function MorphLabel({
  text,
  reducedMotion,
}: {
  text: string;
  reducedMotion: boolean;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (measureRef.current) {
      setWidth(measureRef.current.getBoundingClientRect().width);
    }
  }, [text]);

  return (
    <motion.span
      className={styles.morph}
      animate={width !== undefined ? { width } : undefined}
      transition={reducedMotion ? { duration: 0 } : motionTokens.spring.morph}
    >
      <span ref={measureRef} className={styles.morphMeasure} aria-hidden="true">
        {text}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.morphText}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={
            reducedMotion ? { duration: 0 } : { duration: motionTokens.duration.fast }
          }
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

function RoleDropdown({
  value,
  onChange,
  onRemove,
  ariaLabel,
  reducedMotion,
}: {
  value: ShareRole;
  onChange: (next: ShareRole) => void;
  onRemove?: () => void;
  ariaLabel: string;
  reducedMotion: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={styles.menuTrigger}
          aria-label={ariaLabel}
        >
          <MorphLabel text={ROLE_LABEL[value]} reducedMotion={reducedMotion} />
          <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          align="end"
          sideOffset={6}
          collisionPadding={12}
        >
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(v) => onChange(v as ShareRole)}
          >
            {ROLE_OPTIONS.map((opt) => (
              <DropdownMenu.RadioItem
                key={opt.value}
                value={opt.value}
                className={styles.menuItem}
              >
                <span className={styles.menuText}>
                  <span>{opt.label}</span>
                  <span className={styles.menuHint}>{opt.hint}</span>
                </span>
                <DropdownMenu.ItemIndicator className={styles.menuCheck}>
                  <Check size={14} aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          {onRemove && (
            <>
              <DropdownMenu.Separator className={styles.menuSeparator} />
              <DropdownMenu.Item
                className={`${styles.menuItem} ${styles.menuDanger}`}
                onSelect={onRemove}
              >
                <span>Remove access</span>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ShareAccess({
  title = "Q3 launch plan",
  members: controlledMembers,
  defaultMembers = [],
  onMembersChange,
  access: controlledAccess,
  defaultAccess = "restricted",
  onAccessChange,
  linkRole: controlledLinkRole,
  defaultLinkRole = "viewer",
  onLinkRoleChange,
  directory = [],
  link,
  selfId,
  defaultInviteRole = "editor",
  onInvite,
  onCopyLink,
  onDone,
  className,
  style,
}: ShareAccessProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const titleId = useId();
  const listboxId = useId();
  const errorId = useId();
  const highlightId = useId();

  const inputRef = useRef<HTMLInputElement>(null);

  const [internalMembers, setInternalMembers] = useState<ShareAccessMember[]>(
    () => [...defaultMembers],
  );
  const members = controlledMembers ?? internalMembers;

  const [internalAccess, setInternalAccess] =
    useState<ShareGeneralAccess>(defaultAccess);
  const access = controlledAccess ?? internalAccess;

  const [internalLinkRole, setInternalLinkRole] =
    useState<ShareRole>(defaultLinkRole);
  const linkRole = controlledLinkRole ?? internalLinkRole;

  const [inviteRole, setInviteRole] = useState<ShareRole>(defaultInviteRole);
  const [chips, setChips] = useState<ChipItem[]>([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [armedBackspace, setArmedBackspace] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [undoEntry, setUndoEntry] = useState<{
    member: ShareAccessMember;
    index: number;
  } | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [announcement, setAnnouncement] = useState("");

  const copyTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const updateMembers = useCallback(
    (next: ShareAccessMember[]) => {
      if (controlledMembers === undefined) {
        setInternalMembers(next);
      }
      onMembersChange?.(next);
    },
    [controlledMembers, onMembersChange],
  );

  const updateAccess = useCallback(
    (next: ShareGeneralAccess) => {
      if (controlledAccess === undefined) {
        setInternalAccess(next);
      }
      onAccessChange?.(next);
      setAnnouncement(
        next === "link"
          ? "General access set to anyone with the link"
          : "General access set to restricted",
      );
    },
    [controlledAccess, onAccessChange],
  );

  const updateLinkRole = useCallback(
    (next: ShareRole) => {
      if (controlledLinkRole === undefined) {
        setInternalLinkRole(next);
      }
      onLinkRoleChange?.(next);
      setAnnouncement(`Link access set to ${ROLE_LABEL[next]}`);
    },
    [controlledLinkRole, onLinkRoleChange],
  );

  const existingEmails = useMemo(() => {
    const s = new Set<string>();
    members.forEach((m) => s.add(m.email.toLowerCase()));
    chips.forEach((c) => s.add(c.email.toLowerCase()));
    return s;
  }, [members, chips]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !focused) return [];
    return directory
      .filter((person) => {
        if (existingEmails.has(person.email.toLowerCase())) return false;
        if (person.email.toLowerCase().startsWith(q)) return true;
        if (person.name) {
          const parts = person.name.toLowerCase().split(/\s+/);
          if (parts.some((p) => p.startsWith(q))) return true;
          if (person.name.toLowerCase().startsWith(q)) return true;
        }
        return false;
      })
      .slice(0, 5);
  }, [query, focused, directory, existingEmails]);

  const safeActiveIdx =
    suggestions.length > 0 ? Math.min(activeSuggestion, suggestions.length - 1) : -1;

  const addChipFromContact = useCallback(
    (contact: ShareAccessContact) => {
      const normalized = contact.email.trim().toLowerCase();
      if (!normalized) return;
      if (existingEmails.has(normalized)) {
        setAnnouncement(`${contact.name ?? contact.email} is already added`);
        setQuery("");
        return;
      }
      const valid = EMAIL_RE.test(normalized);
      const item: ChipItem = {
        key: `${normalized}-${Date.now()}`,
        email: contact.email.trim(),
        name: contact.name,
        src: contact.src,
        valid,
      };
      setChips((prev) => [...prev, item]);
      setQuery("");
      setArmedBackspace(false);
      setInviteError(null);
      setAnnouncement(
        valid
          ? `Added ${contact.name ?? contact.email}`
          : `${contact.email} is not a valid email address`,
      );
    },
    [existingEmails],
  );

  const commitRawText = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().replace(/^[,;\s]+|[,;\s]+$/g, "");
      if (!trimmed) return false;
      // Check exact directory name match first
      const lower = trimmed.toLowerCase();
      const dirMatch = directory.find(
        (d) =>
          d.email.toLowerCase() === lower ||
          (d.name && d.name.toLowerCase() === lower),
      );
      if (dirMatch) {
        addChipFromContact(dirMatch);
        return true;
      }
      addChipFromContact({ email: trimmed });
      return true;
    },
    [directory, addChipFromContact],
  );

  const removeChip = useCallback((key: string, label: string) => {
    setChips((prev) => prev.filter((c) => c.key !== key));
    setArmedBackspace(false);
    setInviteError(null);
    setAnnouncement(`Removed ${label}`);
  }, []);

  const invalidChips = useMemo(() => chips.filter((c) => !c.valid), [chips]);
  const validChips = useMemo(() => chips.filter((c) => c.valid), [chips]);

  const handleSendInvite = useCallback(async () => {
    if (sending || validChips.length === 0 || invalidChips.length > 0) return;
    const people: ShareAccessContact[] = validChips.map((c) => ({
      email: c.email,
      name: c.name,
      src: c.src,
    }));

    setSending(true);
    setInviteError(null);
    try {
      await onInvite?.(people, inviteRole);
      const added: ShareAccessMember[] = people.map((p) => ({
        id: `m-${p.email.toLowerCase()}-${Date.now()}`,
        email: p.email,
        name: p.name,
        src: p.src,
        role: inviteRole,
        pending: true,
      }));
      const nextList = [...members, ...added];
      updateMembers(nextList);
      setChips([]);
      setFreshIds(new Set(added.map((a) => a.id)));
      window.setTimeout(() => {
        setFreshIds(new Set());
      }, 1200);
      setAnnouncement(
        `Invited ${people.length === 1 ? (people[0].name ?? people[0].email) : `${people.length} people`} as ${ROLE_LABEL[inviteRole]}`,
      );
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Could not send invite. Try again.",
      );
    } finally {
      setSending(false);
    }
  }, [
    sending,
    validChips,
    invalidChips.length,
    onInvite,
    inviteRole,
    members,
    updateMembers,
  ]);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveSuggestion(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }
    if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        setQuery("");
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && safeActiveIdx >= 0) {
        addChipFromContact(suggestions[safeActiveIdx]);
        return;
      }
      if (query.trim()) {
        commitRawText(query);
        return;
      }
      if (chips.length > 0) {
        void handleSendInvite();
      }
      return;
    }
    if (
      e.key === "," ||
      e.key === ";" ||
      (e.key === "Tab" && query.trim()) ||
      (e.key === " " && query.includes("@"))
    ) {
      if (query.trim()) {
        e.preventDefault();
        commitRawText(query);
      }
      return;
    }
    if (e.key === "Backspace" && !query && chips.length > 0) {
      e.preventDefault();
      if (!armedBackspace) {
        setArmedBackspace(true);
      } else {
        const last = chips[chips.length - 1];
        removeChip(last.key, last.name ?? last.email);
      }
      return;
    }
    if (armedBackspace) {
      setArmedBackspace(false);
    }
  };

  const handleRoleChange = (memberId: string, nextRole: ShareRole) => {
    const target = members.find((m) => m.id === memberId);
    const next = members.map((m) =>
      m.id === memberId ? { ...m, role: nextRole } : m,
    );
    updateMembers(next);
    if (target) {
      setAnnouncement(
        `Changed ${target.name ?? target.email} to ${ROLE_LABEL[nextRole]}`,
      );
    }
  };

  const handleRemoveMember = (member: ShareAccessMember, index: number) => {
    const next = members.filter((m) => m.id !== member.id);
    updateMembers(next);
    setUndoEntry({ member, index });
    setAnnouncement(`Removed ${member.name ?? member.email}`);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoEntry(null);
    }, 8000);
  };

  const handleUndo = () => {
    if (!undoEntry) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    const { member, index } = undoEntry;
    const next = [...members];
    const insertAt = Math.min(index, next.length);
    next.splice(insertAt, 0, member);
    updateMembers(next);
    setUndoEntry(null);
    setAnnouncement(`Restored ${member.name ?? member.email}`);
  };

  const handleCopyLink = async () => {
    const url =
      link ??
      (typeof window !== "undefined" ? window.location.href : "https://uiarc.dev");
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      onCopyLink?.(url);
      setAnnouncement("Link copied to clipboard");
    } catch {
      setCopyState("failed");
      setAnnouncement("Could not copy link");
    }
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
    }, 1800);
  };

  const fieldMessage = inviteError
    ? { text: inviteError, error: true }
    : invalidChips.length > 0
      ? {
          text:
            invalidChips.length === 1
              ? `“${invalidChips[0].email}” doesn’t look like an email address.`
              : `${invalidChips.length} addresses don’t look like valid emails.`,
          error: true,
        }
      : null;

  const smoothTransition = reducedMotion
    ? { duration: 0 }
    : motionTokens.spring.smooth;
  const snappyTransition = reducedMotion
    ? { duration: 0 }
    : motionTokens.spring.snappy;

  const generalHintText =
    access === "restricted"
      ? "Only people with access can open"
      : `Anyone on the internet with the link ${ROLE_LABEL[linkRole].toLowerCase()}`;

  return (
    <section
      className={className ? `${styles.root} ${className}` : styles.root}
      style={style}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className={styles.title}>
        Share “{title}”
      </h2>

      {/* Invite input & chips */}
      <div className={styles.inviteArea}>
        <div className={styles.fieldWrap}>
          <div
            className={`${styles.field} ${focused ? styles.fieldFocused : ""} ${
              invalidChips.length > 0 ? styles.fieldInvalid : ""
            }`}
            onClick={() => inputRef.current?.focus()}
          >
            <AnimatePresence initial={false}>
              {chips.map((chip, idx) => {
                const isArmed = armedBackspace && idx === chips.length - 1;
                const display = chip.name ?? chip.email;
                return (
                  <motion.span
                    key={chip.key}
                    layout={!reducedMotion}
                    initial={
                      reducedMotion ? false : { opacity: 0, scale: 0.8 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                    transition={snappyTransition}
                    className={`${styles.chip} ${
                      !chip.valid ? styles.chipInvalid : ""
                    } ${isArmed ? styles.chipArmed : ""}`}
                  >
                    {!chip.valid ? (
                      <AlertCircle
                        size={14}
                        className={styles.chipAlert}
                        aria-hidden="true"
                      />
                    ) : (
                      <AvatarFace
                        name={chip.name}
                        email={chip.email}
                        src={chip.src}
                        size={20}
                      />
                    )}
                    <span className={styles.chipText}>{display}</span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      aria-label={`Remove ${display}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChip(chip.key, display);
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </motion.span>
                );
              })}
            </AnimatePresence>

            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={
                suggestions.length > 0 && safeActiveIdx >= 0
                  ? `${listboxId}-opt-${safeActiveIdx}`
                  : undefined
              }
              aria-invalid={invalidChips.length > 0 || undefined}
              aria-describedby={fieldMessage ? errorId : undefined}
              aria-label="Add people by name or email"
              placeholder={chips.length === 0 ? "Add people by name or email" : ""}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveSuggestion(0);
                setArmedBackspace(false);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setFocused(false), 120);
              }}
              onKeyDown={handleInputKeyDown}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/[,;\n\s]/.test(text) && text.includes("@")) {
                  e.preventDefault();
                  const tokens = text
                    .split(/[,;\s\n]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  tokens.forEach((tok) => commitRawText(tok));
                }
              }}
            />
          </div>

          {/* Suggestions listbox */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.ul
                id={listboxId}
                role="listbox"
                aria-label="Suggestions"
                className={styles.suggestions}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: motionTokens.duration.fast }
                }
              >
                {suggestions.map((person, idx) => {
                  const isActive = idx === safeActiveIdx;
                  return (
                    <li
                      key={person.email}
                      id={`${listboxId}-opt-${idx}`}
                      role="option"
                      aria-selected={isActive}
                      className={styles.option}
                      onMouseEnter={() => setActiveSuggestion(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addChipFromContact(person);
                      }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId={`share-opt-${highlightId}`}
                          className={styles.optionHighlight}
                          transition={
                            reducedMotion
                              ? { duration: 0 }
                              : motionTokens.spring.snappy
                          }
                        />
                      )}
                      <AvatarFace
                        name={person.name}
                        email={person.email}
                        src={person.src}
                        size={30}
                      />
                      <span className={styles.personText}>
                        <span className={styles.personName}>
                          {person.name ?? person.email}
                        </span>
                        {person.name && (
                          <span className={styles.personMeta}>
                            {person.email}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Field error / status message */}
        <AnimatePresence initial={false}>
          {fieldMessage && (
            <motion.p
              id={errorId}
              className={`${styles.message} ${
                fieldMessage.error ? styles.messageError : ""
              }`}
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={smoothTransition}
            >
              <span className={styles.messageInner}>{fieldMessage.text}</span>
            </motion.p>
          )}
        </AnimatePresence>

        {/* Invite role + send button row */}
        <AnimatePresence initial={false}>
          {chips.length > 0 && (
            <motion.div
              className={styles.inviteRowWrap}
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={smoothTransition}
            >
              <div className={styles.inviteRow}>
                <div className={styles.inviteRole}>
                  <span className={styles.inviteAs}>Invite as</span>
                  <RoleDropdown
                    value={inviteRole}
                    onChange={setInviteRole}
                    ariaLabel={`Role for new invites: ${ROLE_LABEL[inviteRole]}`}
                    reducedMotion={reducedMotion}
                  />
                </div>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={
                    sending || validChips.length === 0 || invalidChips.length > 0
                  }
                  onClick={() => void handleSendInvite()}
                >
                  {sending ? "Sending…" : "Invite"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* People with access */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span>People with access</span>
          <span className={styles.count}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={members.length}
                initial={reducedMotion ? false : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { y: -10, opacity: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: motionTokens.duration.fast }
                }
              >
                {members.length}
              </motion.span>
            </AnimatePresence>
          </span>
        </h3>

        <ul className={styles.people}>
          <AnimatePresence initial={false}>
            {members.map((member, idx) => {
              const displayName = member.name ?? member.email;
              const isSelf = selfId !== undefined && member.id === selfId;
              const isFresh = freshIds.has(member.id);

              return (
                <motion.li
                  key={member.id}
                  className={styles.personWrap}
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={smoothTransition}
                >
                  <div
                    className={`${styles.person} ${isFresh ? styles.fresh : ""}`}
                  >
                    <AvatarFace
                      name={member.name}
                      email={member.email}
                      src={member.src}
                      size={32}
                    />
                    <div className={styles.personText}>
                      <span className={styles.personName}>
                        {displayName}
                        {isSelf && <span className={styles.you}> (you)</span>}
                      </span>
                      <span className={styles.personMeta}>
                        {member.email}
                        {member.pending ? " · Pending" : ""}
                      </span>
                    </div>
                    {member.role === "owner" ? (
                      <span className={styles.owner}>Owner</span>
                    ) : (
                      <RoleDropdown
                        value={member.role}
                        onChange={(r) => handleRoleChange(member.id, r)}
                        onRemove={() => handleRemoveMember(member, idx)}
                        ariaLabel={`Role for ${displayName}: ${ROLE_LABEL[member.role]}`}
                        reducedMotion={reducedMotion}
                      />
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {/* Undo bar */}
        <AnimatePresence initial={false}>
          {undoEntry && (
            <motion.div
              className={styles.undoWrap}
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={smoothTransition}
            >
              <div className={styles.undo}>
                <span className={styles.undoText}>
                  Removed {undoEntry.member.name ?? undoEntry.member.email}
                </span>
                <button
                  type="button"
                  className={styles.link}
                  onClick={handleUndo}
                >
                  Undo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* General access */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>General access</h3>
        <div className={styles.general}>
          <span className={styles.generalIcon} aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={access}
                className={styles.iconSwap}
                initial={
                  reducedMotion
                    ? false
                    : { opacity: 0, rotate: -25, scale: 0.85 }
                }
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, rotate: 25, scale: 0.85 }
                }
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: motionTokens.duration.fast }
                }
              >
                {access === "restricted" ? (
                  <Lock size={16} />
                ) : (
                  <Globe size={16} />
                )}
              </motion.span>
            </AnimatePresence>
          </span>

          <div className={styles.generalText}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={`${styles.menuTrigger} ${styles.accessTrigger}`}
                  aria-label={`General access: ${
                    access === "restricted"
                      ? "Restricted"
                      : "Anyone with the link"
                  }`}
                >
                  <MorphLabel
                    text={
                      access === "restricted"
                        ? "Restricted"
                        : "Anyone with the link"
                    }
                    reducedMotion={reducedMotion}
                  />
                  <ChevronDown
                    size={14}
                    className={styles.chevron}
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={styles.menu}
                  align="start"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <DropdownMenu.RadioGroup
                    value={access}
                    onValueChange={(v) => updateAccess(v as ShareGeneralAccess)}
                  >
                    {ACCESS_OPTIONS.map((opt) => (
                      <DropdownMenu.RadioItem
                        key={opt.value}
                        value={opt.value}
                        className={styles.menuItem}
                      >
                        <span className={styles.menuText}>
                          <span>{opt.label}</span>
                          <span className={styles.menuHint}>{opt.hint}</span>
                        </span>
                        <DropdownMenu.ItemIndicator className={styles.menuCheck}>
                          <Check size={14} aria-hidden="true" />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <span className={styles.generalHint}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={generalHintText}
                  className={styles.generalHintText}
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: motionTokens.duration.fast }
                  }
                >
                  {generalHintText}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <AnimatePresence initial={false}>
            {access === "link" && (
              <motion.div
                className={styles.linkRole}
                initial={reducedMotion ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                transition={smoothTransition}
              >
                <span className={styles.linkRoleInner}>
                  <RoleDropdown
                    value={linkRole}
                    onChange={updateLinkRole}
                    ariaLabel={`Link access role: ${ROLE_LABEL[linkRole]}`}
                    reducedMotion={reducedMotion}
                  />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer actions */}
      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.secondary} ${
            copyState === "failed" ? styles.secondaryFailed : ""
          }`}
          onClick={() => void handleCopyLink()}
        >
          <span className={styles.stack}>
            {/* Width-preserving hidden sizers */}
            <span className={`${styles.copyLabel} ${styles.hidden}`} aria-hidden="true">
              <Link2 size={14} />
              <span>Link copied</span>
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              {copyState === "idle" && (
                <motion.span
                  key="idle"
                  className={styles.copyLabel}
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: motionTokens.duration.fast }
                  }
                >
                  <Link2 size={14} aria-hidden="true" />
                  <span>Copy link</span>
                </motion.span>
              )}
              {copyState === "copied" && (
                <motion.span
                  key="copied"
                  className={styles.copyLabel}
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: motionTokens.duration.fast }
                  }
                >
                  <Check size={14} aria-hidden="true" />
                  <span>Link copied</span>
                </motion.span>
              )}
              {copyState === "failed" && (
                <motion.span
                  key="failed"
                  className={styles.copyLabel}
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: motionTokens.duration.fast }
                  }
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>Couldn’t copy</span>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>

        {onDone && (
          <button type="button" className={styles.primary} onClick={onDone}>
            Done
          </button>
        )}
      </div>

      {/* Live announcements */}
      <div className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </div>
    </section>
  );
}

export default ShareAccess;
