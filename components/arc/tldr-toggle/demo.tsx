"use client";

import { useCallback, useState } from "react";
import { Switch } from "../switch/switch";
import { TldrToggle, simulateTldr, type TldrSummarize } from "./tldr-toggle";
import styles from "./demo.module.css";

export default function Demo() {
  const [fail, setFail] = useState(false);
  const summarize = useCallback<TldrSummarize>(request => simulateTldr(request, { fail }), [fail]);
  return (
    <div className={styles.demo}>
      <TldrToggle summarize={summarize} autoPlay simulated />
      <div className={styles.options}><Switch label="Simulate a failure" checked={fail} onCheckedChange={setFail} /></div>
    </div>
  );
}
