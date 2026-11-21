"use client";

import { useState } from "react";
import { Stepper } from "./stepper";

export default function CheckoutSteps() {
  const [step, setStep] = useState(1);
  return (
    <Stepper
      current={step}
      onStepSelect={setStep}
      steps={[
        { id: "cart", label: "Cart" },
        { id: "shipping", label: "Shipping", description: "Address and delivery" },
        { id: "payment", label: "Payment" },
      ]}
    />
  );
}
