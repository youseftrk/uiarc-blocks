"use client";

import { useState } from "react";
import { Switch } from "../switch/switch";
import { AiCommand, createSampleAsk } from "./ai-command";
import styles from "./ai-command.module.css";

const working = createSampleAsk();
const failing = createSampleAsk(() => true);

export default function Demo() {
  const [fail, setFail] = useState(false);

  return (
    <div className={styles.demo}>
      <AiCommand onAsk={fail ? failing : working} autoPlay />
      <div className={styles.controls}>
        <Switch label="Simulate failures" checked={fail} onCheckedChange={setFail} />
      </div>
    </div>
  );
}
