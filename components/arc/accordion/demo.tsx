"use client";

import { Accordion } from "./accordion";

export default function Faq() {
  return (
    <Accordion
      size="lg"
      items={[
        { title: "Can I cancel anytime?", content: "Yes. Your plan stays active until the period ends." },
        { title: "Do you offer refunds?", content: "Within 14 days of purchase, no questions asked." },
      ]}
    />
  );
}
