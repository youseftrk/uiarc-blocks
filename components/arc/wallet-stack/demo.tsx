"use client";

import { WalletStack } from "./wallet-stack";

const CARDS = [
  {
    id: "debit",
    issuer: "Northbank",
    product: "Everyday debit",
    lastFour: "4821",
    holder: "Ada Lovelace",
    expires: "09/29",
    variant: "metal" as const,
    balance: 2480.5,
    balanceLabel: "Available",
    transactions: [
      { id: "t1", merchant: "Blue Bottle", detail: "Coffee · Today", amount: -6.5 },
      { id: "t2", merchant: "Linear", detail: "Software · Yesterday", amount: -16.0 },
    ],
  },
  {
    id: "travel",
    issuer: "Northbank",
    product: "Travel credit",
    lastFour: "0917",
    holder: "Ada Lovelace",
    expires: "03/28",
    variant: "color" as const,
    tint: "#2563eb",
    balance: 812.4,
    balanceLabel: "Spent this month",
    transactions: [
      { id: "t3", merchant: "TAP Air Portugal", detail: "Flight · 2d ago", amount: -418.0 },
    ],
  },
  {
    id: "virtual",
    issuer: "Northbank",
    product: "Virtual team card",
    lastFour: "7742",
    holder: "Design Ops",
    expires: "11/27",
    variant: "color" as const,
    tint: "#7c3aed",
    balance: 1200.0,
    balanceLabel: "Monthly limit remaining",
    transactions: [
      { id: "t4", merchant: "Figma", detail: "Seats · 4d ago", amount: -75.0 },
    ],
  },
];

export default function WalletStackDemo() {
  return <WalletStack cards={CARDS} />;
}
