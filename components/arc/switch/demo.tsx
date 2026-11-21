"use client";

import { useState } from "react";

import { Switch } from "./switch";

export default function NotificationsToggle() {
  const [enabled, setEnabled] = useState(true);
  return <Switch label="Email notifications" checked={enabled} onCheckedChange={setEnabled} />;
}
