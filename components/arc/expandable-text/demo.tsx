"use client";

import { ExpandableText } from "./expandable-text";

const PARAGRAPHS = [
  "The tactile spring physics make every transition feel grounded rather than ornamental. Layout shifts are cleanly choreographed and respect reduced-motion preferences out of the box.",
  "Keyboard navigation, focus restoration, and ARIA live announcements are built directly into the component primitives instead of bolted on afterward.",
];

export default function ReviewBody() {
  return (
    <div style={{ maxWidth: 420 }}>
      <ExpandableText lines={2}>
        {PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </ExpandableText>
    </div>
  );
}
