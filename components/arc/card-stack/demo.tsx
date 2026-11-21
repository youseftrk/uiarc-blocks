"use client";

import { CardStack } from "./card-stack";

const cities = [
  { id: "lis", name: "Lisbon" },
  { id: "osl", name: "Oslo" },
  { id: "kyo", name: "Kyoto" },
];

export default function Shortlist() {
  return (
    <CardStack
      items={cities}
      getKey={(city) => city.id}
      getLabel={(city) => city.name}
      renderCard={(city) => <h3 style={{ margin: 0 }}>{city.name}</h3>}
      labels={{ left: "Skip", right: "Shortlist" }}
      onDecide={() => {}}
    />
  );
}
