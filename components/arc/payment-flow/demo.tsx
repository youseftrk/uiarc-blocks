"use client";

import { PaymentFlow } from "./payment-flow";
import styles from "./demo.module.css";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <PaymentFlow />
    </div>
  );
}
