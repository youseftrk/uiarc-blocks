"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import { ToolCallGroup, toolCallSampleCalls, type ToolCallData, type ToolCallStatus } from "./tool-call";
import styles from "./demo.module.css";

const [SEARCH, PROJECT, QUERY, POST] = toolCallSampleCalls;
const INTRO = ["Let me check what ", "is blocking the release."];
const ANSWER = ["Two things block 2.8: ", "the coupon checkout bug #1284 and ", "migration 0047, which is still pending on production. ", "I posted ", "a summary in #release."];
const DENIED = ["Two things block 2.8: ", "the coupon checkout bug #1284 and ", "migration 0047, which is still pending on production. ", "I did not post ", "anything to #release."];
const TIMEOUT = "Connection to app_production timed out after 5s";
const APPROVAL = "Sends as Arc agent to 48 people in #release";
const smooth = { ...motionTokens.spring.smooth };

export default function Demo() {
  const reduced = useReducedMotion();
  const [intro, setIntro] = useState(0);
  const [calls, setCalls] = useState<ToolCallData[]>([]);
  const [active, setActive] = useState(false);
  const [answer, setAnswer] = useState<{ chunks: string[]; shown: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, task: () => void) => { timers.current.push(window.setTimeout(task, ms)); }, []);
  const set = useCallback((id: string, status: ToolCallStatus, message?: string) => setCalls(list => list.map(call => call.id === id ? { ...call, status, message } : call)), []);
  const add = useCallback((call: ToolCallData, status: ToolCallStatus, message?: string) => setCalls(list => [...list, { ...call, status, message }]), []);
  const speak = useCallback((chunks: string[], at: number) => {
    chunks.forEach((_, index) => later(at + index * 40, () => setAnswer({ chunks, shown: index + 1 })));
    later(at + chunks.length * 40 + 560, () => { setFinished(true); setAnnouncement(chunks.join("")); });
  }, [later]);

  // The scripted turn: two calls land, the third times out and waits for Retry.
  useEffect(() => {
    const pending = timers.current;
    later(0, () => { setIntro(0); setCalls([]); setAnswer(null); setFinished(false); setAnnouncement(""); setActive(true); });
    later(350, () => setIntro(1));
    later(520, () => setIntro(2));
    later(900, () => add(SEARCH, "running"));
    later(2080, () => set(SEARCH.id, "success"));
    later(2360, () => add(PROJECT, "running"));
    later(3120, () => set(PROJECT.id, "success"));
    later(3400, () => add(QUERY, "running"));
    later(4700, () => { set(QUERY.id, "error", TIMEOUT); setActive(false); setAnnouncement("PostgreSQL timed out. Retry it to continue."); });
    return () => { pending.forEach(clearTimeout); pending.length = 0; };
  }, [run, add, later, set]);

  const retry = () => {
    set(QUERY.id, "running");
    setActive(true);
    later(520, () => set(QUERY.id, "success"));
    later(800, () => { add(POST, "approval", APPROVAL); setActive(false); });
  };
  const allow = () => {
    set(POST.id, "running");
    setActive(true);
    later(610, () => { set(POST.id, "success"); setActive(false); setAnnouncement("Allowed. This preview simulates the post, so nothing was sent to Slack."); });
    speak(ANSWER, 1550);
  };
  const deny = () => {
    set(POST.id, "denied", "Denied, so nothing was posted");
    setAnnouncement("Denied. Nothing was posted to Slack.");
    speak(DENIED, 940);
  };

  return (
    <div className={styles.demo}>
      <p className={styles.user}>Is anything blocking the 2.8 release?</p>
      <div className={styles.turn}>
        <p className={styles.prose}>{INTRO.slice(0, intro).map((chunk, index) => <span key={`${run}:${index}`} className={styles.chunk}>{chunk}</span>)}</p>
        {calls.length > 0 && (
          <motion.div key={run} className={styles.slot} initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={reduced ? { duration: 0 } : smooth}>
            <ToolCallGroup calls={calls} active={active} onRetry={retry} onApprove={allow} onDeny={deny} />
          </motion.div>
        )}
        {answer && <p className={styles.prose}>{answer.chunks.slice(0, answer.shown).map((chunk, index) => <span key={index} className={styles.chunk}>{chunk}</span>)}</p>}
        {finished && (
          <motion.div className={styles.again} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.standard }}>
            <Button variant="ghost" size="sm" onClick={() => setRun(value => value + 1)}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Run again</Button>
          </motion.div>
        )}
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}
