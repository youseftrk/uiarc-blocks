"use client";

import { useState } from "react";
import { SignaturePad } from "./signature-pad";
import type { InkStroke } from "./signature-pad";

export default function SignContract() {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SignaturePad signer="Ada Lovelace" fileName="ada-signature" onChange={setStrokes} />
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {strokes.length ? `${strokes.length} stroke(s) captured` : "Draw your signature above"}
      </div>
    </div>
  );
}
