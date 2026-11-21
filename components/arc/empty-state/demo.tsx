"use client";

import { Search } from "lucide-react";
import { Button } from "../button/button";
import { EmptyState } from "./empty-state";

export default function NoResults() {
  return (
    <EmptyState
      icon={<Search size={24} />}
      title="No matches"
      description="Try a shorter search or clear the filters."
      action={<Button variant="secondary" onClick={() => {}}>Clear filters</Button>}
    />
  );
}
