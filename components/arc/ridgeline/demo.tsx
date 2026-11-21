"use client";

import { Ridgeline } from "./ridgeline";

const REGIONS = [
  { id: "us-east", label: "us-east", values: [18, 22, 24, 29, 31, 28, 25, 21, 34, 42, 27, 23] },
  { id: "eu-west", label: "eu-west", values: [24, 28, 35, 38, 41, 36, 33, 30, 44, 49, 34, 31] },
  { id: "ap-south", label: "ap-south", values: [35, 42, 48, 52, 59, 64, 55, 49, 68, 72, 51, 46] },
];

export default function Latency() {
  return <Ridgeline series={REGIONS} label="API latency by region" unit=" ms" />;
}
