"use client";

import { ExpandingSearch } from "./expanding-search";

export default function HeaderSearch() {
  return (
    <ExpandingSearch
      label="Search projects and docs"
      items={[
        { id: "p1", title: "Arc website", group: "Projects", meta: "Updated today" },
        { id: "d1", title: "Motion tokens", group: "Docs", keywords: ["spring"] },
        { id: "d2", title: "Theme switch", group: "Components", keywords: ["dark"] },
      ]}
      onSelect={() => {}}
    />
  );
}
