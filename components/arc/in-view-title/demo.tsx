"use client";

import { InViewTitle } from "./in-view-title";

export default function FeaturesHeader() {
  return (
    <InViewTitle
      variant="line"
      text="Everything your team needs to ship"
      lines={["Everything your team", "needs to ship"]}
    />
  );
}
