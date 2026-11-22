"use client";

import { ArmingSwitch } from "./arming-switch";
import styles from "./arming-switch.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ArmingSwitch
        hints={{
          running: "Simulating the rollout to both regions.",
          done: "Simulated deploy finished. Lift the cover to run it again.",
          failed: "The rollout did not finish. Hold the lamp to retry.",
        }}
        onConfirm={() =>
          new Promise<boolean>((resolve) => {
            window.setTimeout(() => resolve(true), 1600);
          })
        }
      />
    </div>
  );
}
