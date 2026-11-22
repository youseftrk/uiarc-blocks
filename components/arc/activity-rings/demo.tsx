"use client";

import { useState } from "react";
import { BookOpen, PenLine, RotateCcw, Timer } from "lucide-react";
import { Button } from "../button/button";
import { ActivityRings, type ActivityRingsDay, type ActivityRingsMetric } from "./activity-rings";
import styles from "./activity-rings.module.css";

const metrics: ActivityRingsMetric[] = [
  { id: "focus", label: "Deep work", unit: "min", goal: 180 },
  { id: "writing", label: "Writing", unit: "words", goal: 1200 },
  { id: "reading", label: "Reading", unit: "pages", goal: 40 },
];

const week: ActivityRingsDay[] = [
  { id: "mon", label: "Monday, September 14", short: "Mon", values: { focus: 205, writing: 1480, reading: 32 } },
  { id: "tue", label: "Tuesday, September 15", short: "Tue", values: { focus: 120, writing: 860, reading: 44 } },
  { id: "wed", label: "Wednesday, September 16", short: "Wed", values: { focus: 240, writing: 2110, reading: 18 } },
  { id: "thu", label: "Thursday, September 17", short: "Thu", values: { focus: 165, writing: 1190, reading: 41 } },
  { id: "fri", label: "Friday, September 18", short: "Fri", values: { focus: 95, writing: 540, reading: 26 } },
  { id: "sat", label: "Saturday, September 19", short: "Sat", values: { focus: 60, writing: 300, reading: 72 } },
  { id: "sun", label: "Sunday, September 20", short: "Sun", values: { focus: 130, writing: 940, reading: 22 } },
];

const steps = [
  { id: "focus", amount: 25, label: "25 min", icon: <Timer size={16} aria-hidden="true" /> },
  { id: "writing", amount: 250, label: "250 words", icon: <PenLine size={16} aria-hidden="true" /> },
  { id: "reading", amount: 10, label: "10 pages", icon: <BookOpen size={16} aria-hidden="true" /> },
];

export default function Demo() {
  const [days, setDays] = useState(week);
  const [day, setDay] = useState("sun");

  const add = (id: string, amount: number) =>
    setDays((current) => current.map((entry) => (entry.id === day ? { ...entry, values: { ...entry.values, [id]: entry.values[id] + amount } } : entry)));

  return (
    <div className={styles.demo}>
      <ActivityRings metrics={metrics} days={days} day={day} onDayChange={setDay} label="Goals this week" />
      <div className={styles.actions}>
        {steps.map((step) => (
          <Button key={step.id} variant="secondary" size="sm" onClick={() => add(step.id, step.amount)}>
            {step.icon}
            {step.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" aria-label="Reset week" disabled={days === week} onClick={() => setDays(week)}>
          <RotateCcw size={16} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
