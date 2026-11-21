"use client";

import { Countdown } from "./countdown";

export default function LaunchCountdown() {
  return (
    <Countdown
      target="2027-10-06T10:00:00"
      timeZone="America/Los_Angeles"
      label="Keynote starts in"
    />
  );
}
