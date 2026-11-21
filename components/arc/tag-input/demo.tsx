"use client";

import { useState } from "react";

import { TagInput } from "./tag-input";

export default function TopicsField() {
  const [topics, setTopics] = useState(["design", "motion"]);
  return (
    <TagInput
      label="Topics"
      value={topics}
      onValueChange={setTopics}
      description="Press Enter or comma to add."
    />
  );
}
