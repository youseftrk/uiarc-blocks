"use client";

import { useState } from "react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import {
  MeetingSummary,
  type MeetingSummaryData,
  type MeetingSummaryStatus,
} from "./meeting-summary";
import styles from "./meeting-summary.module.css";

const SAMPLE_MEETING: MeetingSummaryData = {
  title: "Annual billing launch review",
  platform: "google-meet",
  date: "Tue, Oct 27",
  timeRange: "10:00 to 10:42",
  durationMinutes: 42,
  wordCount: 6214,
  attendees: [
    { id: "diane", name: "Diane Foster" },
    { id: "nathan", name: "Nathan Cole" },
    { id: "jasmine", name: "Jasmine Brooks" },
    { id: "marcus", name: "Marcus Johnson" },
    { id: "andre", name: "Andre Williams" },
    { id: "chloe", name: "Chloe Nguyen" },
    { id: "ava", name: "Ava Mitchell" },
  ],
  summary: [
    {
      id: "s1",
      text: "Annual plans converted at 31% in the pricing test, against 22% for monthly, with trial starts flat.",
      quote: {
        timestamp: "04:12",
        speaker: "Diane Foster",
        excerpt:
          "Across the two-week pricing test, annual converted at 31 percent versus 22 for monthly, and trial starts barely moved.",
      },
    },
    {
      id: "s2",
      text: "Annual churn can't be read until next year, so 60-day refunds will stand in as the signal.",
      quote: {
        timestamp: "11:38",
        speaker: "Chloe Nguyen",
        excerpt:
          "We won't have true annual renewal data for twelve months, so let's track 60-day refund requests as our early warning.",
      },
    },
    {
      id: "s3",
      text: "The new billing toggle tested well, but the savings label read like a coupon on mobile.",
      quote: {
        timestamp: "18:05",
        speaker: "Jasmine Brooks",
        excerpt:
          "People understood the toggle right away, though the 20% off badge looked a bit like a promo coupon on narrow screens.",
      },
    },
    {
      id: "s4",
      text: "Engineering can ship behind the pricing-v3 flag by November 4 if price IDs land this week.",
      quote: {
        timestamp: "26:47",
        speaker: "Marcus Johnson",
        excerpt:
          "If Stripe price IDs are in staging by Thursday, we can ship behind pricing-v3 on November 4 without rushing QA.",
      },
    },
  ],
  decisions: [
    {
      id: "d1",
      text: "Launch annual billing at 20% off, worded as two months free.",
      quote: {
        timestamp: "31:20",
        speaker: "Diane Foster",
        excerpt:
          "Let's lock in 20 percent off and call it two months free everywhere so it feels straightforward.",
      },
    },
    {
      id: "d2",
      text: "Roll out to half of new visitors first, then everyone after two clean weeks.",
      quote: {
        timestamp: "34:02",
        speaker: "Nathan Cole",
        excerpt:
          "Start at 50 percent of new signups, watch refund and support volume for two weeks, then ramp to 100.",
      },
    },
    {
      id: "d3",
      text: "Existing monthly customers get an in-app offer instead of an email blast.",
      quote: {
        timestamp: "37:15",
        speaker: "Ava Mitchell",
        excerpt:
          "Rather than blasting everyone's inbox, let's surface the switch offer inside billing settings.",
      },
    },
  ],
  actionItems: [
    {
      id: "a1",
      text: "Create annual price IDs in Stripe for all three tiers",
      owner: "Andre Williams",
      due: "Oct 30",
      quote: {
        timestamp: "27:32",
        speaker: "Andre Williams",
        excerpt:
          "I'll set up the annual price IDs for Starter, Pro, and Scale in Stripe before Friday.",
      },
    },
    {
      id: "a2",
      text: "Ship the billing toggle behind the pricing-v3 flag",
      owner: "Marcus Johnson",
      due: "Nov 4",
      quote: {
        timestamp: "28:14",
        speaker: "Marcus Johnson",
        excerpt:
          "Once Andre drops the IDs, I'll wire up the checkout toggle behind pricing-v3 for November 4.",
      },
    },
    {
      id: "a3",
      text: "Rewrite the savings label as two months free on mobile",
      owner: "Jasmine Brooks",
      due: "Oct 29",
      quote: {
        timestamp: "32:11",
        speaker: "Jasmine Brooks",
        excerpt:
          "I'll update the mobile badge copy to two months free and hand off the spec tomorrow.",
      },
    },
    {
      id: "a4",
      text: "Build a 60-day refund dashboard for annual plans",
      owner: "Chloe Nguyen",
      due: "Nov 6",
      quote: {
        timestamp: "38:30",
        speaker: "Chloe Nguyen",
        excerpt:
          "I'll put together a 60-day refund view segmented by plan tier so we can watch it from day one.",
      },
    },
  ],
};

type Scenario = "live" | "error" | "empty";

export default function MeetingSummaryDemo() {
  const [scenario, setScenario] = useState<Scenario>("live");

  const statusOverride: MeetingSummaryStatus | undefined =
    scenario === "live" ? undefined : scenario;

  return (
    <div className={styles.demo}>
      <SegmentedControl
        label="Scenario"
        options={[
          { value: "live", label: "Live" },
          { value: "error", label: "Error" },
          { value: "empty", label: "No transcript" },
        ]}
        value={scenario}
        onValueChange={(v) => setScenario(v as Scenario)}
      />
      <div className={styles.stage}>
        <MeetingSummary
          meeting={SAMPLE_MEETING}
          status={statusOverride}
          error="Could not reach the transcription service. Check the recording link and try again."
          onRegenerate={() => {
            if (scenario !== "live") setScenario("live");
          }}
        />
      </div>
    </div>
  );
}
