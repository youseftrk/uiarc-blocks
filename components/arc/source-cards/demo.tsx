"use client";

import { SourceCards, SourceCitation } from "./source-cards";

export default function SourceCardsDemo() {
  return (
    <SourceCards duration={1800}>
      <p style={{ margin: 0 }}>
        Read the raw request body with <code>await request.text()</code> before
        parsing JSON so byte order stays intact <SourceCitation n={1} />
        <SourceCitation n={2} />, then verify the HMAC digest in constant time{" "}
        <SourceCitation n={3} />.
      </p>
    </SourceCards>
  );
}
