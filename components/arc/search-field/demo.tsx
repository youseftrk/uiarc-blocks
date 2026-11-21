"use client";

import { useState } from "react";

import { SearchField } from "./search-field";

export default function MemberFilter() {
  const [query, setQuery] = useState("");
  return (
    <SearchField
      label="Search members"
      placeholder="Name or email"
      value={query}
      onValueChange={setQuery}
    />
  );
}
