"use client";

import { LineChart } from "./line-chart";

const data = [
  { key: "2026-09-01", label: "Tue, Sep 1", axisLabel: "Sep 1", values: { signups: 120, previous: 98 } },
  { key: "2026-09-02", label: "Wed, Sep 2", values: { signups: 142, previous: 104 } },
  { key: "2026-09-03", label: "Thu, Sep 3", axisLabel: "Sep 3", values: { signups: 131, previous: 110 } },
];

export default function SignupsChart() {
  return (
    <LineChart
      label="Signups"
      data={data}
      series={[
        { key: "signups", label: "This period" },
        { key: "previous", label: "Previous period", dashed: true },
      ]}
    />
  );
}
