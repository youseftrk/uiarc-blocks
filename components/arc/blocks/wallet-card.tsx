"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Cloud,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  PanelsTopLeft,
  Plus,
  ReceiptText,
  Search,
  Send,
  Type,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Button } from "../button";
import { DropdownMenu } from "../dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { SegmentedControl } from "../segmented-control";
import { motionTokens as T } from "../tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./wallet-card.module.css";

type WalletId = "main" | "reserve";
type Period = "week" | "month" | "year";
type Action = "send" | "deposit" | "swap" | "buy";
type Kind = "payment" | "tools" | "license" | "hosting" | "investment" | "transfer" | "deposit" | "send";
type Entry = { id: string; wallet: WalletId; title: string; detail: string; cents: number; kind: Kind };

const ENTRIES: Entry[] = [
  { id: "client", wallet: "main", title: "Client payment", detail: "18 Sep · Studio North", cents: 85000, kind: "payment" },
  { id: "tools", wallet: "main", title: "Workspace tools", detail: "16 Sep · Subscription", cents: -4800, kind: "tools" },
  { id: "type", wallet: "main", title: "Type license", detail: "14 Sep · Purchase", cents: -1200, kind: "license" },
  { id: "hosting", wallet: "main", title: "Website hosting", detail: "10 Sep · Cloud plan", cents: -2400, kind: "hosting" },
  { id: "invoice", wallet: "main", title: "Design retainer", detail: "8 Sep · Forma Studio", cents: 125000, kind: "payment" },
  { id: "reserve", wallet: "reserve", title: "Monthly allocation", detail: "12 Sep · From main wallet", cents: 50000, kind: "transfer" },
];
const KIND_ICON: Record<Kind, LucideIcon> = {
  payment: ReceiptText,
  tools: PanelsTopLeft,
  license: Type,
  hosting: Cloud,
  investment: Landmark,
  transfer: ArrowLeftRight,
  deposit: Plus,
  send: Send,
};
const ACTION_ICON: Record<Action, LucideIcon> = {
  send: ArrowUpRight,
  deposit: Plus,
  swap: ArrowLeftRight,
  buy: CreditCard,
};
const ACTIONS: Action[] = ["send", "deposit", "swap", "buy"];
const ACTION_LABEL: Record<Action, string> = { deposit: "Deposit", send: "Send", swap: "Swap", buy: "Buy" };
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => usd.format(cents / 100);
const SERIES: Record<Period, number[]> = {
  week: [0.87, 0.89, 0.88, 0.94, 0.92, 0.96, 1],
  year: [0.58, 0.64, 0.61, 0.7, 0.68, 0.76, 0.74, 0.83, 0.8, 0.9, 0.93, 1],
  month: [0.84, 0.85, 0.83, 0.88, 0.87, 0.9, 0.88, 0.94, 0.92, 0.96, 0.95, 1],
};

function parseAmount(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(100 * Number(value));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 1e8 ? cents : null;
}

function Money({ cents }: { cents: number }) {
  const reduced = useReducedMotion();
  const value = useMotionValue(cents);
  const [shown, setShown] = useState(cents);
  useMotionValueEvent(value, "change", (v) => setShown(Math.round(v)));
  useEffect(() => {
    if (reduced) {
      value.set(cents);
      return;
    }
    const controls = animate(value, cents, { duration: 0.75, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [cents, reduced, value]);
  return <>{money(reduced ? cents : shown)}</>;
}

export function WalletCard({ initialBalanceCents = 1248032 }: { initialBalanceCents?: number }) {
  const reduced = useReducedMotion();
  const [wallet, setWallet] = useState<WalletId>("main");
  const [balances, setBalances] = useState<Record<WalletId, number>>({ main: initialBalanceCents, reserve: 285000 });
  const [entries, setEntries] = useState(ENTRIES);
  const [period, setPeriod] = useState<Period>("month");
  const [scrub, setScrub] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const actionRefs = useRef<Partial<Record<Action, HTMLButtonElement | null>>>({});
  const detailId = useId();
  const errorId = useId();

  const walletName = wallet === "main" ? "Main wallet" : "Reserve wallet";
  const otherName = wallet === "main" ? "Reserve wallet" : "Main wallet";
  const other: WalletId = wallet === "main" ? "reserve" : "main";
  const visible = entries
    .filter((e) => e.wallet === wallet && `${e.title} ${e.detail}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, showAll ? undefined : 3);
  const series = SERIES[period].map((f) => Math.round(balances[wallet] * f));
  const min = Math.min(...series);
  const range = Math.max(1, Math.max(...series) - min);
  const yFor = (v: number) => 104 - ((v - min) / range) * 88;
  const points = series.map((v, i) => `${(i / (series.length - 1)) * 560},${yFor(v)}`).join(" ");
  const monthDelta = entries.filter((e) => e.wallet === wallet).reduce((sum, e) => sum + e.cents, 0);

  function record(entry: Entry, delta: Partial<Record<WalletId, number>>) {
    setEntries((list) => [entry, ...list]);
    setBalances((b) => ({ main: b.main + (delta.main ?? 0), reserve: b.reserve + (delta.reserve ?? 0) }));
    if (action) actionRefs.current[action]?.focus();
    setAction(null);
    setAmount("");
    setRecipient("");
    setError("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!action) return;
    const cents = parseAmount(amount);
    if (cents === null) return setError("Enter an amount between $0.01 and $1,000,000.00.");
    if (action !== "deposit" && cents > balances[wallet]) return setError("The amount is above the available balance.");
    if (action === "send" && !recipient.trim()) return setError("Enter a recipient name.");
    const id = `demo-${Date.now()}`;
    if (action === "swap") {
      record(
        { id, wallet, title: `Moved to ${otherName}`, detail: "Just now · Transfer", cents: -cents, kind: "transfer" },
        { [wallet]: -cents, [other]: cents },
      );
      setEntries((list) => [
        { id: `${id}-in`, wallet: other, title: `From ${walletName}`, detail: "Just now · Transfer", cents, kind: "transfer" },
        ...list,
      ]);
      setStatus(`${money(cents)} moved to ${otherName}.`);
      return;
    }
    const signed = action === "deposit" ? cents : -cents;
    record(
      {
        id,
        wallet,
        title: action === "deposit" ? "Deposit" : action === "send" ? `To ${recipient.trim()}` : "Index fund purchase",
        detail: "Just now · Activity",
        cents: signed,
        kind: action === "deposit" ? "deposit" : action === "send" ? "send" : "investment",
      },
      { [wallet]: signed },
    );
    setStatus(`${money(cents)} ${action === "deposit" ? "added" : action === "send" ? "sent" : "used to buy shares"}.`);
  }

  const scrubFromPointer = (event: PointerEvent<HTMLInputElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setScrub(
      Math.max(0, Math.min(series.length - 1, Math.round(((event.clientX - rect.left) / rect.width) * (series.length - 1)))),
    );
  };

  const panelMotion = {
    initial: reduced ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -4 },
    transition: { duration: reduced ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <section className={styles.wallet} aria-label="Wallet preview">
      <div className={styles.topRow}>
        <DropdownMenu
          label={walletName}
          icon={<Wallet size={18} />}
          items={(["main", "reserve"] as WalletId[]).map((id) => ({
            label: `${id === "main" ? "Main wallet" : "Reserve wallet"} · ${hidden ? "••••" : money(balances[id])}`,
            icon: wallet === id ? <Check size={16} /> : <Wallet size={16} />,
            onSelect: () => {
              setWallet(id);
              setAction(null);
              setStatus("");
              setScrub(null);
            },
          }))}
        />
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={searching ? "Close activity search" : "Search activity"}
            aria-expanded={searching}
            onClick={() => {
              setSearching((v) => !v);
              setAction(null);
              setQuery("");
              setNoticeOpen(false);
            }}
          >
            {searching ? <X size={19} /> : <Search size={19} />}
          </button>
          <Popover open={noticeOpen} onOpenChange={setNoticeOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={styles.iconButton} aria-label="Notifications">
                <Bell size={19} />
                <span className={styles.noticeDot} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className={styles.notice}>
              <strong>Wallet updates</strong>
              <span>{status || "Your $850.00 payment from Studio North arrived on 18 September."}</span>
              <small>Demo notification · No live account connected</small>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className={styles.balanceArea}>
        <div className={styles.balanceLabel}>
          {scrub === null
            ? "Available balance"
            : `${period === "week" ? "Day" : period === "year" ? "Month" : "September"} ${scrub + 1}`}{" "}
          <button type="button" aria-label={hidden ? "Show balance" : "Hide balance"} onClick={() => setHidden((v) => !v)}>
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className={styles.balance} aria-live="polite">
          {hidden ? (
            <span className={styles.hiddenBalance} aria-label="Balance hidden">
              <span aria-hidden="true">$ ••••••</span>
            </span>
          ) : (
            <Money cents={scrub === null ? balances[wallet] : series[scrub]} />
          )}
        </div>
        <div className={styles.balanceMeta}>
          <span className={styles.changePill} data-negative={monthDelta < 0}>
            {monthDelta >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
            {hidden ? (
              "••••"
            ) : (
              <>
                {monthDelta >= 0 ? "+" : "−"}
                <Money cents={Math.abs(monthDelta)} />
              </>
            )}
            <span> this month</span>
          </span>
          <span className={styles.currency}>USD</span>
        </div>
        <div className={styles.chart} onPointerLeave={() => setScrub(null)}>
          <svg viewBox="0 0 560 120" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.chartGuide} d="M0 30H560 M0 70H560 M0 110H560" />
            <motion.polyline
              points={points}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={false}
              animate={{ points }}
              transition={reduced ? { duration: 0 } : T.spring.gentle}
            />
            {scrub !== null && (
              <line
                x1={(scrub / (series.length - 1)) * 560}
                x2={(scrub / (series.length - 1)) * 560}
                y1="0"
                y2="120"
                stroke="var(--border-strong)"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {scrub !== null && (
            <span
              className={styles.chartDot}
              style={{ left: `${(scrub / (series.length - 1)) * 100}%`, top: `${(yFor(series[scrub]) / 120) * 100}%` }}
              aria-hidden="true"
            />
          )}
          <input
            className={styles.chartScrubber}
            type="range"
            min="0"
            max={series.length - 1}
            value={scrub ?? series.length - 1}
            aria-label="Explore sample balance history"
            aria-valuetext={hidden ? "Balance hidden" : money(series[scrub ?? series.length - 1])}
            onChange={(e) => setScrub(Number(e.target.value))}
            onBlur={() => setScrub(null)}
            onPointerMove={scrubFromPointer}
          />
        </div>
        <div className={styles.chartFoot}>
          <span>{period === "week" ? "Last 7 days" : period === "year" ? "Last 12 months" : "Last 30 days"}</span>
          <SegmentedControl<Period>
            label="Balance history period"
            value={period}
            onValueChange={(p) => {
              setPeriod(p);
              setScrub(null);
            }}
            options={[
              { value: "week", label: "1W" },
              { value: "month", label: "1M" },
              { value: "year", label: "1Y" },
            ]}
          />
        </div>
      </div>

      <div className={styles.actions}>
        {ACTIONS.map((id) => {
          const Icon = ACTION_ICON[id];
          return (
            <button
              key={id}
              type="button"
              ref={(el) => {
                actionRefs.current[id] = el;
              }}
              aria-pressed={action === id}
              aria-controls={detailId}
              className={styles.actionButton}
              onClick={() => {
                if (action === id) return setAction(null);
                setAction(id);
                setAmount("");
                setRecipient("");
                setError("");
                setStatus("");
                setNoticeOpen(false);
              }}
            >
              <Icon size={21} strokeWidth={1.75} />
              <span>{ACTION_LABEL[id]}</span>
              <ChevronRight className={styles.actionArrow} size={15} />
            </button>
          );
        })}
      </div>

      <div className={styles.detail} id={detailId}>
        <AnimatePresence mode="wait" initial={false}>
          {action ? (
            <motion.div key={action} className={styles.actionPanel} {...panelMotion}>
              <div className={styles.detailHeading}>
                <div>
                  <h2>{ACTION_LABEL[action]}</h2>
                  <p>
                    {action === "swap"
                      ? `Move funds to ${otherName}.`
                      : action === "buy"
                        ? "Buy shares in an index fund."
                        : action === "send"
                          ? "Send a payment."
                          : "Add funds to this wallet."}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Close action"
                  onClick={() => {
                    actionRefs.current[action]?.focus();
                    setAction(null);
                    setError("");
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <form className={styles.form} onSubmit={submit} noValidate>
                {action === "send" && (
                  <label>
                    Recipient
                    <input
                      value={recipient}
                      onChange={(e) => {
                        setRecipient(e.target.value);
                        setError("");
                      }}
                      placeholder="e.g. Studio North"
                      maxLength={48}
                    />
                  </label>
                )}
                <label>
                  Amount in USD
                  <input
                    autoFocus
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError("");
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                  />
                </label>
                {error && (
                  <p id={errorId} className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit">
                  {action === "swap" ? "Move funds" : action === "send" ? "Record payment" : action === "buy" ? "Buy shares" : "Add funds"}{" "}
                  <ArrowUpRight size={15} />
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="activity"
              className={styles.activityPanel}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -5 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={styles.detailHeading}>
                <h2>{showAll ? "All activity" : "Recent activity"}</h2>
                <button type="button" className={styles.textButton} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show less" : "View all"}
                  <ChevronRight size={14} />
                </button>
              </div>
              {searching && (
                <label className={styles.searchField}>
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                    placeholder="Search activity"
                    aria-label="Search activity"
                  />
                </label>
              )}
              <ul className={styles.entries}>
                <AnimatePresence initial={false}>
                  {visible.map((entry) => {
                    const Icon = KIND_ICON[entry.kind];
                    return (
                      <motion.li
                        key={entry.id}
                        layout={reduced ? false : "position"}
                        initial={reduced ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 60 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={reduced ? { duration: 0 } : T.spring.gentle}
                      >
                        <span
                          className={styles.entryIcon}
                          data-flow={entry.kind === "transfer" ? "transfer" : entry.cents >= 0 ? "incoming" : "outgoing"}
                          aria-hidden="true"
                        >
                          <Icon size={18} strokeWidth={1.65} />
                        </span>
                        <span className={styles.entryText}>
                          <strong>{entry.title}</strong>
                          <small>{entry.detail}</small>
                        </span>
                        <span className={styles.entryAmount}>
                          {entry.cents >= 0 ? "+" : "−"}
                          {money(Math.abs(entry.cents))}
                        </span>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              {visible.length === 0 && <p className={styles.empty}>No activity matches your search.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.foot}>
        <span role="status" aria-live="polite">
          {status ? (
            <>
              <Check size={14} /> {status}
            </>
          ) : (
            ""
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            record(
              { id: `sample-${Date.now()}`, wallet, title: "Added funds", detail: "Just now · Activity", cents: 12450, kind: "deposit" },
              { [wallet]: 12450 },
            );
            setStatus(`${money(12450)} added to ${walletName}.`);
          }}
        >
          <Plus size={14} /> Add $124.50
        </button>
      </div>
    </section>
  );
}
