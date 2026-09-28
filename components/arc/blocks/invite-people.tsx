"use client";

import {
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardPaste,
  LoaderCircle,
  Mail,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import Image from "next/image";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatedCounter } from "../animated-counter";
import { PEOPLE } from "../people";
import { motionTokens as T, cx } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./invite-people.module.css";

type Role = "admin" | "member" | "guest";
type Plan = "starter" | "team";
type Person = { email: string; name?: string; title?: string; src?: string };
type OkItem = { kind: "ok"; key: string; entry: Person; role: Role; flown: boolean };
type ErrorItem = { kind: "error"; key: string; text: string; message: string };
type Item = OkItem | ErrorItem;
type InviteStatus = "sending" | "sent" | "joined";
type Invite = { key: string; entry: Person; role: Role; status: InviteStatus; note: string };
type Suggestion = { id: string; kind: "person" | "blocked" | "email"; entry: Person; note: string };
type Parsed = { kind: "ok"; entry: Person } | { kind: "error"; text: string; message: string };

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Manages members and billing" },
  { value: "member", label: "Member", description: "Creates and edits projects" },
  { value: "guest", label: "Guest", description: "Views shared projects only" },
];
const roleLabel = (role: Role) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
const DOMAIN = "fieldwork.example";
const emailFor = (id: string) => `${id.replace("-", ".")}@${DOMAIN}`;
const DIRECTORY: Person[] = PEOPLE.map((p) => ({ email: emailFor(p.id), name: p.name, title: p.role, src: p.src }));
const person = (id: string) => DIRECTORY.find((p) => p.email === emailFor(id))!;
const INITIAL_TEAM = ["diane-foster", "nathan-cole", "jasmine-brooks", "daniel-kim", "chloe-nguyen"].map(person);
const INITIAL_PENDING = { entry: person("tyler-hayes"), role: "member" as Role, note: "Sent 2 days ago" };
const PLANS: Record<Plan, { name: string; seats: number }> = {
  starter: { name: "Starter", seats: 10 },
  team: { name: "Team", seats: 25 },
};
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;
const SAMPLE_LIST =
  "emma.collins@fieldwork.example, Marcus Johnson, sofia.ramirez@fieldwork.example, olivia@northwind, jordan.reyes@, Nathan Cole, Ava Mitchell <ava.mitchell@fieldwork.example>, hannah.walsh@fieldwork.example, alex turner, emma.collins@fieldwork.example";

function splitInviteInput(value: string): string[] {
  return /[,;\n]/.test(value)
    ? value.split(/[,;\n]+/)
    : (value.match(/@/g)?.length ?? 0) > 1
      ? value.split(/\s+/)
      : [value];
}

function parseEntry(raw: string, sets: { team: Set<string>; pending: Set<string> }): Parsed | null {
  const angled = raw.match(/<\s*([^<>\s]+)\s*>/);
  const text = (angled ? angled[1] : raw).trim().replace(/^["']+|["']+$/g, "").trim();
  if (!text) return null;
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const match =
    DIRECTORY.find((p) => p.name?.toLowerCase() === lower) ??
    (EMAIL.test(text) ? (DIRECTORY.find((p) => p.email === lower) ?? { email: lower }) : undefined);
  if (match) {
    const label = match.name ?? match.email;
    if (sets.team.has(match.email)) return { kind: "error", text, message: `${label} is already on the team` };
    if (sets.pending.has(match.email)) return { kind: "error", text, message: `${label} already has a pending invite` };
    return { kind: "ok", entry: match };
  }
  const quoted = `“${text}”`;
  if (!text.includes("@")) return { kind: "error", text, message: `${quoted} isn’t an email address` };
  const at = text.lastIndexOf("@");
  const local = text.slice(0, at);
  const domain = text.slice(at + 1);
  if (!local) return { kind: "error", text, message: `${quoted} is missing a name before the @` };
  if (!domain) return { kind: "error", text, message: `${quoted} is missing a domain` };
  if (domain.includes(".")) return { kind: "error", text, message: `${quoted} isn’t a valid email address` };
  return { kind: "error", text, message: `${quoted} needs a full domain, like ${DOMAIN}` };
}

const SHAKES = [
  [0, -6, 6, -4, 4, -2, 0],
  [0, 6, -6, 4, -4, 2, 0],
];
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const noop = () => () => {};

function useReduced() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return useReducedMotion() && mounted;
}

function AutoWidth({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReduced();
  const ref = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.span
      className={cx(styles.autoWidth, className)}
      initial={false}
      animate={{ width }}
      transition={reduced ? { duration: 0 } : T.spring.morph}
    >
      <span ref={ref} className={styles.autoWidthInner}>
        {children}
      </span>
    </motion.span>
  );
}

function AutoHeight({ children }: { children: ReactNode }) {
  const reduced = useReduced();
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : T.spring.smooth}>
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

function Swap({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useReduced();
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.4em", filter: `blur(${T.blur.subtle}px)` }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: "-0.4em", filter: `blur(${T.blur.subtle}px)`, transition: { duration: T.duration.fast } }
          }
          transition={reduced ? { duration: T.duration.instant } : { duration: T.duration.standard, ease: T.ease.enter }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Collapse({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReduced();
  return (
    <motion.div
      className={cx(styles.collapse, className)}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={reduced ? { duration: 0 } : { height: T.spring.smooth, opacity: { duration: T.duration.standard } }}
    >
      {children}
    </motion.div>
  );
}

const AVATAR_LAYOUT = { type: "spring", visualDuration: 0.5, bounce: 0.16 } as const;

function Avatar({ entry, size, layoutId, alt = "" }: { entry: Person; size: number; layoutId?: string; alt?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      className={styles.avatar}
      style={{ width: size, height: size, borderRadius: "50%" }}
      transition={{ layout: AVATAR_LAYOUT }}
    >
      {entry.src ? (
        <Image src={entry.src} alt={alt} width={size} height={size} sizes={`${size}px`} draggable={false} />
      ) : (
        <span className={styles.initial} aria-hidden={!alt || undefined} role={alt ? "img" : undefined} aria-label={alt || undefined}>
          {entry.email.charAt(0).toUpperCase()}
        </span>
      )}
    </motion.span>
  );
}

const initialPending = (): Invite[] => [
  { key: INITIAL_PENDING.entry.email, entry: INITIAL_PENDING.entry, role: INITIAL_PENDING.role, status: "sent", note: INITIAL_PENDING.note },
];

export function InvitePeople() {
  const id = useId();
  const reduced = useReduced();
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuAnchor = useRef<HTMLElement | null>(null);
  const pendingHeadRef = useRef<HTMLHeadingElement>(null);
  const errorSeq = useRef(0);
  const joinScheduled = useRef(false);
  const timers = useRef<number[]>([]);
  const [team, setTeam] = useState<Person[]>(INITIAL_TEAM);
  const [invites, setInvites] = useState<Invite[]>(initialPending);
  const [items, setItems] = useState<Item[]>([]);
  const [plan, setPlan] = useState<Plan>("starter");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [armed, setArmed] = useState(false);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState(0);
  const [overShake, setOverShake] = useState(0);
  const [resent, setResent] = useState<Record<string, boolean>>({});
  const [live, setLive] = useState("");
  const invitesRef = useRef(invites);
  useEffect(() => {
    invitesRef.current = invites;
  });
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const avatarId = (email: string) => `${id}-avatar-${email}`;
  const okItems = items.filter((i): i is OkItem => i.kind === "ok");
  const errorItems = items.filter((i): i is ErrorItem => i.kind === "error");
  const teamSet = useMemo(() => new Set(team.map((p) => p.email)), [team]);
  const pendingSet = useMemo(() => new Set(invites.map((i) => i.key)), [invites]);
  const joinedCount = invites.filter((i) => i.status === "joined").length;
  const members = team.length + joinedCount;
  const pendingCount = invites.length - joinedCount;
  const newCount = okItems.length;
  const seats = PLANS[plan].seats;
  const used = members + pendingCount + newCount;
  const over = Math.max(0, used - seats);
  const sendBlocked = newCount === 0 || errorItems.length > 0 || over > 0;

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    const added = new Set(items.map((i) => i.key));
    const blockedNote = (p: Person) =>
      teamSet.has(p.email) ? "On the team" : pendingSet.has(p.email) ? "Invited" : added.has(p.email) ? "Added" : null;
    if (!q) {
      return DIRECTORY.filter((p) => !blockedNote(p))
        .slice(0, 4)
        .map((p) => ({ id: p.email, kind: "person", entry: p, note: p.title ?? "" }));
    }
    const list: Suggestion[] = DIRECTORY.filter((p) => p.name!.toLowerCase().includes(q) || p.email.includes(q))
      .map((p) => {
        const note = blockedNote(p);
        return { id: p.email, kind: note ? "blocked" : "person", entry: p, note: note ?? p.title ?? "" } as Suggestion;
      })
      .sort((a, b) => Number(a.kind === "blocked") - Number(b.kind === "blocked"))
      .slice(0, 5);
    if (EMAIL.test(q) && !DIRECTORY.some((p) => p.email === q) && !added.has(q)) {
      list.unshift({ id: `new:${q}`, kind: "email", entry: { email: q }, note: "Invite by email" });
    }
    return list;
  }, [items, pendingSet, query, teamSet]);
  const firstSelectable = suggestions.findIndex((s) => s.kind !== "blocked");
  const active = suggestions[cursor] && suggestions[cursor].kind !== "blocked" ? cursor : firstSelectable;
  const listOpen = focused && !dismissed && (suggestions.length > 0 || !!query.trim());
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorsId = `${id}-errors`;
  const seatsId = `${id}-seats`;
  const pendingId = `${id}-pending`;

  const flashHint = (text: string) => {
    setHint(text);
    later(3200, () => setHint((h) => (h === text ? null : h)));
  };

  const addFromText = (text: string) => {
    const sets = { team: teamSet, pending: pendingSet };
    const next = [...items];
    let added = 0;
    let errors = 0;
    let skipped = 0;
    for (const raw of splitInviteInput(text)) {
      const parsed = parseEntry(raw, sets);
      if (!parsed) continue;
      if (parsed.kind === "ok") {
        if (next.some((i) => i.key === parsed.entry.email)) {
          skipped++;
          continue;
        }
        next.push({ kind: "ok", key: parsed.entry.email, entry: parsed.entry, role: "member", flown: false });
        added++;
      } else {
        if (next.some((i) => i.kind === "error" && i.text.toLowerCase() === parsed.text.toLowerCase())) {
          skipped++;
          continue;
        }
        next.push({ kind: "error", key: `error-${errorSeq.current++}`, text: parsed.text, message: parsed.message });
        errors++;
      }
    }
    setItems(next);
    setArmed(false);
    const parts = [
      added && `Added ${plural(added, "person", "people")}`,
      errors && `${plural(errors, "entry", "entries")} need a fix`,
      skipped && `skipped ${plural(skipped, "duplicate")}`,
    ].filter((p): p is string => Boolean(p));
    if (parts.length) {
      const message = parts.join(", ").replace(/^./, (c) => c.toUpperCase());
      setLive(message);
      if (parts.length > 1 || skipped) flashHint(message);
    }
  };

  const pick = (s: Suggestion | undefined) => {
    if (!s || s.kind === "blocked") return;
    setItems((list) =>
      list.some((i) => i.key === s.entry.email)
        ? list
        : [...list, { kind: "ok", key: s.entry.email, entry: s.entry, role: "member", flown: s.kind === "person" }],
    );
    setQuery("");
    setCursor(0);
    setArmed(false);
    setLive(`Added ${s.entry.name ?? s.entry.email}`);
  };

  const removeItem = (key: string, label: string) => {
    setItems((list) => list.filter((i) => i.key !== key));
    setArmed(false);
    setLive(`Removed ${label}`);
    inputRef.current?.focus({ preventScroll: true });
  };

  const openMenu = (key: string, anchor: HTMLElement) => {
    const root = rootRef.current;
    if (!root) return;
    if (menu?.key === key) return setMenu(null);
    const rootRect = root.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    menuAnchor.current = anchor;
    setMenu({
      key,
      x: Math.max(8, Math.min(rect.left - rootRect.left - 8, rootRect.width - 232 - 8)),
      y: rect.bottom - rootRect.top + 6,
    });
  };
  const closeMenu = (refocus: boolean) => {
    setMenu(null);
    if (refocus) menuAnchor.current?.focus({ preventScroll: true });
  };
  const menuItem = menu ? okItems.find((i) => i.key === menu.key) : undefined;
  const menuKey = menuItem?.key;
  useEffect(() => {
    if (!menuKey) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuAnchor.current?.contains(target)) setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuKey]);

  const smooth = reduced ? { duration: 0 } : T.spring.smooth;
  const snappy = reduced ? { duration: 0 } : T.spring.snappy;
  const layoutSpring = reduced ? { duration: 0 } : T.spring.smooth;
  const shownTeam = team.slice(0, 5);
  const moreTeam = team.length - shownTeam.length;
  const pct = (n: number) => `${Math.min(100, (n / seats) * 100)}%`;

  const moveCursor = (delta: number) => {
    const selectable = suggestions.map((s, i) => (s.kind === "blocked" ? -1 : i)).filter((i) => i >= 0);
    if (!selectable.length) return;
    const at = selectable.indexOf(active);
    setCursor(selectable[(at + delta + selectable.length) % selectable.length]);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!listOpen) return setDismissed(false);
      moveCursor(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = listOpen && active >= 0 ? suggestions[active] : undefined;
      if (chosen && (query.trim() || chosen.kind === "person")) return pick(chosen);
      if (query.trim()) {
        addFromText(query);
        setQuery("");
      }
    } else if ((event.key === "," || event.key === ";") && query.trim()) {
      event.preventDefault();
      addFromText(query);
      setQuery("");
    } else if (event.key === "Backspace" && !query && items.length) {
      const last = items[items.length - 1];
      const label = last.kind === "ok" ? (last.entry.name ?? last.entry.email) : last.text;
      if (armed) removeItem(last.key, label);
      else {
        setArmed(true);
        setLive(`Press backspace again to remove ${label}`);
      }
    } else if (event.key === "Escape") {
      if (listOpen) {
        event.preventDefault();
        setDismissed(true);
      } else if (query) {
        event.preventDefault();
        setQuery("");
      }
    }
  };

  const reset = () => {
    timers.current.splice(0).forEach((t) => window.clearTimeout(t));
    joinScheduled.current = false;
    setTeam(INITIAL_TEAM);
    setInvites(initialPending());
    setItems([]);
    setPlan("starter");
    setQuery("");
    setMenu(null);
    setHint(null);
    setResent({});
    setArmed(false);
    setLive("Preview reset");
  };

  const send = () => {
    if (!newCount) return inputRef.current?.focus();
    if (errorItems.length) {
      setErrorShake((n) => n + 1);
      setLive(`Fix or remove ${plural(errorItems.length, "entry", "entries")} before sending`);
      return;
    }
    if (over) {
      setOverShake((n) => n + 1);
      setLive(`${plural(over, "seat")} over the ${PLANS[plan].name} plan. Upgrade or remove people to send.`);
      return;
    }
    const outgoing: Invite[] = okItems.map((i) => ({ key: i.key, entry: i.entry, role: i.role, status: "sending", note: "Sending" }));
    setMenu(null);
    setItems([]);
    setQuery("");
    setInvites((list) => [...outgoing, ...list]);
    setLive(`Sending ${plural(outgoing.length, "invite")}`);
    const gap = reduced ? 0 : 160;
    const base = reduced ? 300 : 700;
    outgoing.forEach((invite, i) =>
      later(base + i * gap, () =>
        setInvites((list) =>
          list.map((x) => (x.key === invite.key && x.status === "sending" ? { ...x, status: "sent", note: "Sent just now" } : x)),
        ),
      ),
    );
    const settled = base + outgoing.length * gap;
    later(settled, () => setLive(`${plural(outgoing.length, "invite")} sent`));
    if (joinScheduled.current) return;
    joinScheduled.current = true;
    const first = outgoing[0];
    const label = first.entry.name ?? first.entry.email;
    later(settled + 2400, () => {
      if (!invitesRef.current.some((x) => x.key === first.key && x.status === "sent")) {
        joinScheduled.current = false;
        return;
      }
      setInvites((list) => list.map((x) => (x.key === first.key ? { ...x, status: "joined", note: "Joined" } : x)));
      setLive(`${label} accepted and joined Fieldwork`);
      later(1200, () => {
        if (invitesRef.current.some((x) => x.key === first.key && x.status === "joined")) {
          setInvites((list) => list.filter((x) => x.key !== first.key));
          setTeam((list) => [first.entry, ...list]);
        }
      });
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
        <section ref={rootRef} className={styles.root} aria-labelledby={`${id}-title`}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 id={`${id}-title`} className={styles.title}>
                Invite teammates
              </h2>
              <p className={styles.subtitle}>Add people to Fieldwork by name or email</p>
            </div>
            <ul className={styles.team} aria-label={`Team, ${plural(team.length, "member")}`}>
              <AnimatePresence initial={false} mode="popLayout">
                {shownTeam.map((p) => (
                  <motion.li
                    key={p.email}
                    layout="position"
                    className={styles.teamItem}
                    initial={false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ ...snappy, layout: layoutSpring }}
                  >
                    <Avatar entry={p} size={28} layoutId={avatarId(p.email)} alt={p.name ?? p.email} />
                  </motion.li>
                ))}
                {moreTeam > 0 && (
                  <motion.li
                    key="more"
                    layout="position"
                    className={cx(styles.teamItem, styles.teamMore)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ ...snappy, layout: layoutSpring }}
                  >
                    <span aria-hidden="true">+{moreTeam}</span>
                    <span className={styles.srOnly}>and {moreTeam} more</span>
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
          </header>

          <div className={styles.fieldWrap}>
            <AutoHeight>
              <div
                className={styles.field}
                data-focused={focused || undefined}
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button, input")) inputRef.current?.focus();
                }}
              >
                <ul className={styles.chips} aria-label="People to invite">
                  <AnimatePresence initial={false} mode="popLayout">
                    {items.map((item) => {
                      const isLast = armed && item === items[items.length - 1];
                      if (item.kind === "error") {
                        return (
                          <motion.li
                            key={item.key}
                            layout="position"
                            className={styles.chip}
                            data-kind="error"
                            data-armed={isLast || undefined}
                            initial={{ opacity: 0, x: 0 }}
                            animate={{ opacity: 1, x: reduced ? 0 : SHAKES[errorShake % 2] }}
                            exit={{ opacity: 0, scale: 0.92, transition: { duration: T.duration.fast } }}
                            transition={{ opacity: { duration: T.duration.fast }, x: { duration: 0.42, ease: "easeOut" }, layout: layoutSpring }}
                          >
                            <span className={styles.chipSkin} aria-hidden="true" />
                            <button
                              type="button"
                              className={styles.errorEdit}
                              onClick={() => {
                                setItems((list) => list.filter((i) => i.key !== item.key));
                                setQuery(item.text);
                                setDismissed(false);
                                setLive(`Editing ${item.text}`);
                                const input = inputRef.current;
                                if (input) {
                                  input.focus({ preventScroll: true });
                                  requestAnimationFrame(() => input.setSelectionRange(item.text.length, item.text.length));
                                }
                              }}
                              aria-label={`Edit ${item.text}. ${item.message}`}
                              title="Edit"
                            >
                              <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                              <span className={styles.chipLabel}>{item.text}</span>
                            </button>
                            <button type="button" className={styles.chipRemove} aria-label={`Remove ${item.text}`} onClick={() => removeItem(item.key, item.text)}>
                              <X size={14} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </motion.li>
                        );
                      }
                      const label = item.entry.name ?? item.entry.email;
                      const open = menu?.key === item.key;
                      return (
                        <motion.li
                          key={item.key}
                          layout="position"
                          className={styles.chip}
                          data-armed={isLast || undefined}
                          initial={item.flown ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: T.duration.fast } }}
                          transition={{ opacity: { duration: T.duration.fast }, layout: layoutSpring }}
                        >
                          <motion.span
                            className={styles.chipSkin}
                            aria-hidden="true"
                            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={snappy}
                          />
                          <Avatar entry={item.entry} size={22} layoutId={avatarId(item.entry.email)} />
                          <motion.span
                            className={styles.chipBody}
                            initial={reduced ? false : { opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={reduced ? { duration: 0 } : { ...T.spring.smooth, delay: item.flown ? 0.08 : 0 }}
                          >
                            <span className={styles.chipLabel} title={item.entry.email}>
                              {label}
                            </span>
                            <button
                              type="button"
                              className={styles.role}
                              aria-haspopup="menu"
                              aria-expanded={open}
                              aria-label={`Role for ${label}: ${roleLabel(item.role)}`}
                              data-open={open || undefined}
                              onClick={(event) => openMenu(item.key, event.currentTarget)}
                              onKeyDown={(event) => {
                                if (event.key === "ArrowDown" && !open) {
                                  event.preventDefault();
                                  openMenu(item.key, event.currentTarget);
                                }
                              }}
                            >
                              <AutoWidth>
                                <Swap id={item.role}>{roleLabel(item.role)}</Swap>
                              </AutoWidth>
                              <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <button type="button" className={styles.chipRemove} aria-label={`Remove ${label}`} onClick={() => removeItem(item.key, label)}>
                              <X size={14} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </motion.span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                  <motion.li layout="position" transition={{ layout: layoutSpring }} className={styles.inputItem}>
                    <input
                      ref={inputRef}
                      className={styles.input}
                      type="text"
                      role="combobox"
                      aria-label="Emails or names"
                      aria-expanded={listOpen}
                      aria-controls={listId}
                      aria-autocomplete="list"
                      aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
                      aria-describedby={hintId}
                      placeholder={items.length ? "Add more" : "Name or email, like emma@fieldwork.example"}
                      value={query}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setCursor(0);
                        setDismissed(false);
                        setArmed(false);
                      }}
                      onKeyDown={onInputKeyDown}
                      onPaste={(event) => {
                        const text = event.clipboardData.getData("text");
                        if (splitInviteInput(text).length < 2) return;
                        event.preventDefault();
                        addFromText(text);
                      }}
                      onFocus={() => {
                        setFocused(true);
                        setDismissed(false);
                      }}
                      onBlur={() => {
                        setFocused(false);
                        setArmed(false);
                      }}
                    />
                  </motion.li>
                </ul>
              </div>
            </AutoHeight>
            <AnimatePresence>
              {listOpen && (
                <motion.div
                  key="list"
                  className={styles.popover}
                  onPointerDown={(event) => event.preventDefault()}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: T.duration.fast } }}
                  transition={reduced ? { duration: T.duration.instant } : T.spring.snappy}
                >
                  {!query.trim() && <p className={styles.popHeading}>Suggested</p>}
                  <ul id={listId} className={styles.options} role="listbox" aria-label="Suggestions">
                    {suggestions.map((s, i) => (
                      <motion.li
                        key={s.id}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        aria-disabled={s.kind === "blocked" || undefined}
                        className={styles.option}
                        data-kind={s.kind}
                        layout="position"
                        transition={{ layout: layoutSpring }}
                        onPointerMove={() => {
                          if (s.kind !== "blocked" && i !== active) setCursor(i);
                        }}
                        onClick={() => pick(s)}
                      >
                        {i === active && (
                          <motion.span
                            layoutId={`${id}-highlight`}
                            className={styles.optionHighlight}
                            transition={reduced ? { duration: 0 } : T.spring.morph}
                            aria-hidden="true"
                          />
                        )}
                        {s.kind === "email" ? (
                          <span className={cx(styles.avatar, styles.mailAvatar)} style={{ width: 30, height: 30 }}>
                            <Mail size={15} strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        ) : (
                          <Avatar entry={s.entry} size={30} layoutId={s.kind === "person" ? avatarId(s.entry.email) : undefined} />
                        )}
                        <span className={styles.optionText}>
                          <span className={styles.optionName}>{s.kind === "email" ? s.entry.email : s.entry.name}</span>
                          <span className={styles.optionEmail}>{s.kind === "email" ? "Invite by email" : s.entry.email}</span>
                        </span>
                        {s.kind !== "email" && <span className={styles.optionNote}>{s.note}</span>}
                      </motion.li>
                    ))}
                  </ul>
                  {!suggestions.length && (
                    <p className={styles.popEmpty}>No one matches “{query.trim()}”. Type a full email to invite them.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.hintRow}>
            <p id={hintId} className={styles.hint}>
              <Swap id={hint ?? "default"}>{hint ?? "Separate with commas, or paste a whole list"}</Swap>
            </p>
            <button type="button" className={styles.textButton} onClick={() => addFromText(SAMPLE_LIST)}>
              <ClipboardPaste {...ICON} size={14} />
              Paste a sample list
            </button>
          </div>

          <AnimatePresence initial={false}>
            {errorItems.length > 0 && (
              <Collapse key="errors">
                <div id={errorsId} className={styles.errors}>
                  <div className={styles.errorsHead}>
                    <span className={styles.errorsTitle}>
                      <CircleAlert {...ICON} />
                      <AutoWidth>
                        <Swap id={String(errorItems.length)}>{plural(errorItems.length, "entry", "entries")} can’t be invited</Swap>
                      </AutoWidth>
                    </span>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => {
                        setItems((list) => list.filter((i) => i.kind === "ok"));
                        setLive(`Removed ${plural(errorItems.length, "entry", "entries")}`);
                      }}
                    >
                      Remove invalid
                    </button>
                  </div>
                  <ul className={styles.errorList}>
                    <AnimatePresence initial={false}>
                      {errorItems.map((item) => (
                        <motion.li
                          key={item.key}
                          className={styles.collapse}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={reduced ? { duration: 0 } : { height: T.spring.smooth, opacity: { duration: T.duration.fast } }}
                        >
                          <span className={styles.errorLine}>{item.message}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <p className={styles.errorsFoot}>Select an entry to fix it</p>
                </div>
              </Collapse>
            )}
          </AnimatePresence>

          <div className={styles.seats} id={seatsId}>
            <div className={styles.seatsHead}>
              <span className={styles.seatsCount} data-over={over > 0 || undefined}>
                <span className={styles.num}>
                  <AnimatedCounter value={used} />
                </span>
                <span className={styles.seatsOf}>of</span>
                <span className={styles.num}>
                  <AnimatedCounter value={seats} />
                </span>
                <span className={styles.seatsOf}>seats</span>
              </span>
              <span className={styles.plan}>
                <Swap id={plan}>{PLANS[plan].name} plan</Swap>
              </span>
            </div>
            <div
              className={styles.track}
              role="meter"
              aria-label="Seats"
              aria-valuemin={0}
              aria-valuemax={seats}
              aria-valuenow={Math.min(used, seats)}
              aria-valuetext={`${used} of ${seats} seats${over ? `, ${over} over the limit` : ""}`}
            >
              <motion.span className={styles.segment} data-kind={over ? "over" : "new"} initial={false} animate={{ width: pct(used) }} transition={smooth} />
              <motion.span className={styles.segment} data-kind="pending" data-edge={newCount > 0 || undefined} initial={false} animate={{ width: pct(members + pendingCount) }} transition={smooth} />
              <motion.span className={styles.segment} data-kind="members" data-edge={pendingCount + newCount > 0 || undefined} initial={false} animate={{ width: pct(members) }} transition={smooth} />
            </div>
            <ul className={styles.legend} aria-hidden="true">
              <li>
                <span className={styles.swatch} data-kind="members" />
                {plural(members, "member")}
              </li>
              <li>
                <span className={styles.swatch} data-kind="pending" />
                {pendingCount} pending
              </li>
              <li>
                <span className={styles.swatch} data-kind={over ? "over" : "new"} />
                {newCount} new
              </li>
            </ul>
            <AnimatePresence initial={false}>
              {over > 0 && (
                <Collapse key="over">
                  <motion.div
                    className={styles.over}
                    animate={{ x: reduced || !overShake ? 0 : SHAKES[overShake % 2] }}
                    transition={{ duration: 0.42, ease: "easeOut" }}
                  >
                    <CircleAlert {...ICON} />
                    <span className={styles.overText}>
                      <AutoWidth>
                        <Swap id={String(over)}>{plural(over, "seat")} over</Swap>
                      </AutoWidth>{" "}
                      the {PLANS[plan].name} plan
                    </span>
                    {plan === "starter" ? (
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => {
                          setPlan("team");
                          setLive(`Upgraded to the Team plan with ${PLANS.team.seats} seats.`);
                          flashHint("Upgraded to Team");
                        }}
                      >
                        Upgrade to Team
                      </button>
                    ) : (
                      <span className={styles.overHelp}>Remove people to send</span>
                    )}
                  </motion.div>
                </Collapse>
              )}
            </AnimatePresence>
          </div>

          <footer className={styles.footer}>
            <div className={styles.footerActions}>
              <button type="button" className={styles.iconButton} onClick={reset} aria-label="Reset preview" title="Reset preview">
                <RotateCcw {...ICON} />
              </button>
              <button
                type="button"
                className={styles.send}
                onClick={send}
                aria-disabled={sendBlocked || undefined}
                aria-describedby={errorItems.length ? errorsId : over ? seatsId : undefined}
                aria-label={newCount ? `Send ${plural(newCount, "invite")}` : "Send invites"}
              >
                <Send {...ICON} />
                <span className={styles.sendLabel} aria-hidden="true">
                  Send
                  <motion.span
                    className={styles.sendCount}
                    initial={false}
                    animate={{ width: newCount ? "auto" : 0, opacity: newCount ? 1 : 0 }}
                    transition={reduced ? { duration: 0 } : T.spring.morph}
                  >
                    <span className={styles.num}>
                      <AnimatedCounter value={Math.max(1, newCount)} />
                    </span>
                  </motion.span>
                  <AutoWidth className={styles.sendWord}>
                    <Swap id={newCount === 1 ? "one" : "many"}>{newCount === 1 ? "invite" : "invites"}</Swap>
                  </AutoWidth>
                </span>
              </button>
            </div>
          </footer>

          <section className={styles.pending} aria-labelledby={pendingId}>
            <h3 id={pendingId} ref={pendingHeadRef} tabIndex={-1} className={styles.pendingHead}>
              Pending{" "}
              <span className={styles.pendingCount}>
                <span className={styles.num}>
                  <AnimatedCounter value={pendingCount} />
                </span>
              </span>
            </h3>
            <ul className={styles.rows}>
              <AnimatePresence initial={false}>
                {invites.map((invite) => {
                  const label = invite.entry.name ?? invite.entry.email;
                  const wasResent = !!resent[invite.key];
                  return (
                    <motion.li
                      key={invite.key}
                      className={styles.row}
                      initial={{ height: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={reduced ? { duration: 0 } : { height: T.spring.smooth, opacity: { duration: T.duration.fast } }}
                    >
                      <div className={styles.rowInner}>
                        <Avatar entry={invite.entry} size={36} layoutId={avatarId(invite.entry.email)} />
                        <motion.div
                          className={styles.rowText}
                          initial={reduced ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: T.duration.standard, delay: 0.12 }}
                        >
                          <span className={styles.rowName}>{label}</span>
                          <span className={styles.rowMeta}>
                            {roleLabel(invite.role)}
                            {invite.entry.name ? ` · ${invite.entry.email}` : ""}
                          </span>
                        </motion.div>
                        <span className={styles.status} data-status={invite.status}>
                          <AutoWidth>
                            <Swap id={invite.status + invite.note}>
                              <span className={styles.statusInner}>
                                {invite.status === "sending" && <LoaderCircle className={styles.spin} size={13} strokeWidth={1.75} aria-hidden="true" />}
                                {invite.status === "joined" && <Check size={13} strokeWidth={2} aria-hidden="true" />}
                                {invite.note}
                              </span>
                            </Swap>
                          </AutoWidth>
                        </span>
                        <div className={styles.rowActions} data-hidden={invite.status === "joined" || undefined}>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => {
                              if (wasResent) return;
                              setResent((r) => ({ ...r, [invite.key]: true }));
                              setLive(`Invite sent again to ${label}`);
                              later(2000, () => setResent((r) => ({ ...r, [invite.key]: false })));
                            }}
                            disabled={invite.status !== "sent"}
                            aria-disabled={wasResent || undefined}
                            aria-label={wasResent ? `Invite sent again to ${label}` : `Resend invite to ${label}`}
                          >
                            <span className={styles.stack}>
                              <span data-on={!wasResent || undefined}>Resend</span>
                              <span data-on={wasResent || undefined}>
                                <Check size={13} strokeWidth={2} aria-hidden="true" />
                                Sent again
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            data-size="sm"
                            onClick={() => {
                              setInvites((list) => list.filter((x) => x.key !== invite.key));
                              setLive(`Revoked the invite for ${label}. One seat freed.`);
                              pendingHeadRef.current?.focus({ preventScroll: true });
                            }}
                            disabled={invite.status !== "sent"}
                            aria-label={`Revoke invite for ${label}`}
                            title="Revoke invite"
                          >
                            <X size={15} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <AnimatePresence initial={false}>
              {invites.length === 0 && (
                <Collapse key="empty">
                  <p className={styles.empty}>No pending invites</p>
                </Collapse>
              )}
            </AnimatePresence>
          </section>

          <AnimatePresence>
            {menu && menuItem && (
              <motion.div
                key="menu"
                ref={menuRef}
                className={styles.menu}
                role="menu"
                aria-label={`Role for ${menuItem.entry.name ?? menuItem.entry.email}`}
                style={{ left: menu.x, top: menu.y }}
                onKeyDown={(event) => {
                  const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
                  const at = options.indexOf(document.activeElement as HTMLElement);
                  const go = (i: number) => {
                    event.preventDefault();
                    options[(i + options.length) % options.length]?.focus();
                  };
                  if (event.key === "ArrowDown") go(at + 1);
                  else if (event.key === "ArrowUp") go(at - 1);
                  else if (event.key === "Home") go(0);
                  else if (event.key === "End") go(options.length - 1);
                  else if (event.key === "Escape") {
                    event.preventDefault();
                    closeMenu(true);
                  } else if (event.key === "Tab") setMenu(null);
                }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, scale: 0.97, transition: { duration: T.duration.fast } }}
                transition={reduced ? { duration: T.duration.instant } : T.spring.snappy}
              >
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={menuItem.role === option.value}
                    className={styles.menuItem}
                    onPointerMove={(event) => {
                      if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
                    }}
                    onClick={() => {
                      setItems((list) => list.map((i) => (i.key === menuItem.key && i.kind === "ok" ? { ...i, role: option.value } : i)));
                      setLive(`${menuItem.entry.name ?? menuItem.entry.email} will join as ${option.label.toLowerCase()}`);
                      closeMenu(true);
                    }}
                  >
                    <span className={styles.menuLabel}>{option.label}</span>
                    <span className={styles.menuDescription}>{option.description}</span>
                    {menuItem.role === option.value && <Check className={styles.menuCheck} size={15} strokeWidth={2} aria-hidden="true" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <p className={styles.srOnly} aria-live="polite">
            {live}
          </p>
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}
