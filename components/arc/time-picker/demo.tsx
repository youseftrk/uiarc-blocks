"use client";

import { useState } from "react";

import { TimePicker } from "./time-picker";

export default function MeetingTime() {
  const [time, setTime] = useState("14:30");
  return <TimePicker label="Start time" value={time} onChange={setTime} minuteStep={30} />;
}
