"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, UserMinus, UserPlus, X } from "lucide-react";
import { PEOPLE } from "../people";
import { PresenceStack, type PresencePerson, type PresenceStatus } from "./presence-stack";
import styles from "./presence-stack.module.css";

const SELF = "jasmine-brooks";
const TOPICS = ["Pricing", "Launch checklist", "Timeline", "Press kit", "Budget", "Risks"];
const DETAIL: Record<PresenceStatus, (topic: string) => string> = {
  active: topic => `Editing ${topic}`,
  idle: () => "Away for a few minutes",
  typing: topic => `Commenting on ${topic}`,
};

function make(id: string, status: PresenceStatus, topic: string): PresencePerson {
  const person = PEOPLE.find(item => item.id === id)!;
  return { id: person.id, name: person.name, src: person.src, status, detail: id === SELF ? "Viewing Overview" : DETAIL[status](topic) };
}

const INITIAL = [
  make(SELF, "active", "Overview"),
  make("emma-collins", "typing", "Pricing"),
  make("marcus-johnson", "active", "Launch checklist"),
  make("sofia-ramirez", "idle", "Budget"),
  make("daniel-kim", "active", "Timeline"),
  make("chloe-nguyen", "active", "Risks"),
];
const REDUCE = "(prefers-reduced-motion: reduce)";
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export default function Demo() {
  const reduced = useSyncExternalStore(
    notify => {
      const query = window.matchMedia(REDUCE);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
  const [people, setPeople] = useState(INITIAL);
  const [simulate, setSimulate] = useState<boolean | null>(null);
  const [followId, setFollowId] = useState<string | null>(null);
  const following = people.find(item => item.id === followId) ?? null;
  const running = simulate ?? !reduced;
  const latest = useRef(people);
  useEffect(() => {
    latest.current = people;
  }, [people]);

  const join = () =>
    setPeople(list => {
      const free = PEOPLE.filter(item => !list.some(other => other.id === item.id));
      if (!free.length) return list;
      const next = pick(free);
      const [first, ...rest] = list;
      return [first, make(next.id, pick<PresenceStatus>(["active", "active", "typing"]), pick(TOPICS)), ...rest];
    });
  const leave = () =>
    setPeople(list => {
      const others = list.filter(item => item.id !== SELF);
      if (!others.length) return list;
      const gone = pick(others);
      return list.filter(item => item.id !== gone.id);
    });
  const change = () =>
    setPeople(list => {
      const others = list.filter(item => item.id !== SELF);
      if (!others.length) return list;
      const target = pick(others);
      const status = pick((["active", "idle", "typing"] as PresenceStatus[]).filter(value => value !== (target.status ?? "active")));
      return list.map(item => (item.id === target.id ? make(item.id, status, pick(TOPICS)) : item));
    });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const count = latest.current.length;
      const roll = Math.random();
      if (count < 4 || (roll < 0.34 && count < 10)) join();
      else if (roll < 0.6 && count > 3) leave();
      else change();
    }, 2200);
    return () => window.clearInterval(timer);
  }, [running]);

  const others = people.length - 1;

  return (
    <div className={styles.dDemo} data-canvas="wide">
      <div className={styles.dHeader}>
        <div className={styles.dDoc}>
          <span className={styles.dTitle}>Q3 launch plan</span>
          <span className={styles.dMeta}>
            {following ? (
              <>
                Following {following.name}
                <button type="button" className={styles.dStop} onClick={() => setFollowId(null)} aria-label={`Stop following ${following.name}`}>
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </>
            ) : others === 0 ? (
              "Only you"
            ) : (
              `You and ${others} ${others === 1 ? "other" : "others"}`
            )}
          </span>
        </div>
        <PresenceStack
          people={people}
          selfId={SELF}
          max={4}
          align="end"
          onPersonSelect={person => {
            if (person.id !== SELF) setFollowId(person.id);
          }}
        />
      </div>
      <div className={styles.dControls} role="group" aria-label="Simulate people">
        <button type="button" className={styles.dControl} onClick={join} disabled={people.length >= PEOPLE.length}>
          <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
          Someone joins
        </button>
        <button type="button" className={styles.dControl} onClick={leave} disabled={people.length <= 1}>
          <UserMinus size={16} strokeWidth={1.75} aria-hidden="true" />
          Someone leaves
        </button>
        <button type="button" className={styles.dControl} onClick={change} disabled={people.length <= 1}>
          Change a status
        </button>
        <button type="button" className={styles.dControl} onClick={() => setSimulate(!running)} aria-pressed={running}>
          {running ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
          {running ? "Pause" : "Simulate"}
        </button>
      </div>
    </div>
  );
}
