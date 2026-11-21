"use client";

import { useState } from "react";

import { ChipGroup } from "./chip-group";

export default function TopicFilter() {
  const [topics, setTopics] = useState<string[]>([]);
  return (
    <ChipGroup
      label="Topics"
      value={topics}
      onValueChange={setTopics}
      maxVisible={4}
      options={["Design", "Motion", "Code", "Research", "Writing"].map((t) => ({ value: t.toLowerCase(), label: t }))}
    />
  );
}
