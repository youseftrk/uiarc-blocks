"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";

export default function FormatBar() {
  const [marks, setMarks] = useState<string[]>([]);
  const [align, setAlign] = useState("left");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <ToggleGroup type="multiple" label="Text style" value={marks} onValueChange={setMarks}>
        <ToggleGroupItem value="bold" label="Bold"><Bold /></ToggleGroupItem>
        <ToggleGroupItem value="italic" label="Italic"><Italic /></ToggleGroupItem>
        <ToggleGroupItem value="underline" label="Underline"><Underline /></ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup label="Alignment" value={align} onValueChange={setAlign}>
        <ToggleGroupItem value="left" label="Align left"><AlignLeft /></ToggleGroupItem>
        <ToggleGroupItem value="center" label="Align center"><AlignCenter /></ToggleGroupItem>
        <ToggleGroupItem value="right" label="Align right"><AlignRight /></ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
