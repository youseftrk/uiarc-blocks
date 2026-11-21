"use client";

import { Streamgraph } from "./streamgraph";

const series = [
  { key: "bugs", label: "Bugs" },
  { key: "billing", label: "Billing" },
  { key: "onboarding", label: "Onboarding" },
];

const data = [
  { key: "w1", label: "Week of Jan 6", axisLabel: "Jan", values: { bugs: 18, billing: 12, onboarding: 24 } },
  { key: "w2", label: "Week of Jan 13", values: { bugs: 22, billing: 15, onboarding: 20 } },
  { key: "w3", label: "Week of Jan 20", values: { bugs: 16, billing: 19, onboarding: 28 } },
  { key: "w4", label: "Week of Jan 27", values: { bugs: 25, billing: 14, onboarding: 22 } },
  { key: "w5", label: "Week of Feb 3", axisLabel: "Feb", values: { bugs: 19, billing: 21, onboarding: 31 } },
  { key: "w6", label: "Week of Feb 10", values: { bugs: 14, billing: 18, onboarding: 26 } },
];

export default function TicketsByTopic() {
  return (
    <Streamgraph
      data={data}
      series={series}
      label="Support tickets by topic"
      unit="tickets"
      categoryLabel="Week"
    />
  );
}
