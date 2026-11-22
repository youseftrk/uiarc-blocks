"use client";

import { useState } from "react";
import {
  BookOpen,
  CreditCard,
  FileBarChart2,
  Receipt,
  Repeat,
  ShieldCheck,
  Smartphone,
  Terminal,
  Webhook,
  Code2,
} from "lucide-react";
import { Switch } from "../switch/switch";
import {
  MegaMenuMorph,
  type MegaMenuItem,
  type MegaMenuLink,
} from "./mega-menu-morph";
import styles from "./mega-menu-morph.module.css";

function TallyLogo() {
  return (
    <a className={styles.brand} href="#home">
      <span className={styles.brandMark}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2" y="2" width="16" height="16" rx="5" fill="currentColor" />
          <path
            d="M6.5 7.5h7M10 7.5v6"
            stroke="var(--background)"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className={styles.brandName}>Tally</span>
    </a>
  );
}

const ITEMS: MegaMenuItem[] = [
  {
    id: "products",
    label: "Products",
    groups: [
      {
        label: "Payments",
        links: [
          {
            label: "Checkout",
            href: "#checkout",
            description: "Hosted pages in 46 currencies",
            icon: <CreditCard />,
          },
          {
            label: "Billing",
            href: "#billing",
            description: "Subscriptions, usage and invoices",
            icon: <Receipt />,
          },
          {
            label: "Terminal",
            href: "#terminal",
            description: "In person payments on any reader",
            icon: <Smartphone />,
          },
        ],
      },
      {
        label: "Operations",
        links: [
          {
            label: "Payouts",
            href: "#payouts",
            badge: "New",
            description: "Pay sellers and contractors daily",
            icon: <Repeat />,
          },
          {
            label: "Risk",
            href: "#risk",
            description: "Fraud scoring trained on your traffic",
            icon: <ShieldCheck />,
          },
          {
            label: "Reports",
            href: "#reports",
            description: "Reconcile every payout to the cent",
            icon: <FileBarChart2 />,
          },
        ],
      },
    ],
    feature: {
      title: "Instant payouts in the EU",
      description:
        "Sellers in 27 countries now get paid in seconds, weekends included.",
      href: "#eu-payouts",
      cta: "Read the announcement",
    },
  },
  {
    id: "solutions",
    label: "Solutions",
    groups: [
      {
        label: "By stage",
        links: [
          { label: "Startups", href: "#startups" },
          { label: "Enterprises", href: "#enterprises" },
          { label: "Platforms", href: "#platforms" },
        ],
      },
      {
        label: "By industry",
        links: [
          { label: "Software", href: "#software" },
          { label: "Marketplaces", href: "#marketplaces" },
          { label: "Retail", href: "#retail" },
        ],
      },
    ],
  },
  {
    id: "developers",
    label: "Developers",
    groups: [
      {
        label: "Documentation",
        links: [
          {
            label: "Quickstart",
            href: "#quickstart",
            description: "Take a first payment in 10 minutes",
            icon: <BookOpen />,
          },
          {
            label: "API reference",
            href: "#api",
            description: "Every endpoint, with live examples",
            icon: <Code2 />,
          },
        ],
      },
      {
        label: "Tools",
        links: [
          {
            label: "CLI",
            href: "#cli",
            description: "Replay webhooks from your terminal",
            icon: <Terminal />,
          },
          {
            label: "Webhooks",
            href: "#webhooks",
            description: "Signed events with automatic retries",
            icon: <Webhook />,
          },
        ],
      },
    ],
    footer: (
      <>
        <span>
          <span className={styles.statusDot} aria-hidden="true" />
          All systems normal
        </span>
        <span>API uptime 99.998% over 90 days</span>
      </>
    ),
  },
  {
    id: "company",
    label: "Company",
    groups: [
      {
        links: [
          { label: "About", href: "#about" },
          { label: "Customers", href: "#customers" },
          {
            label: "Careers",
            href: "#careers",
            description: "12 open roles",
          },
          { label: "Press", href: "#press" },
        ],
      },
    ],
    footer: <span>Offices in Zurich, Lisbon and New York</span>,
  },
  {
    id: "pricing",
    label: "Pricing",
    href: "#pricing",
  },
];

export default function MegaMenuMorphDemo() {
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [visited, setVisited] = useState<string | null>(null);

  const handleNavigate = (href: string, link?: MegaMenuLink) => {
    setVisited(link?.label ?? href);
  };

  return (
    <div className={styles.demo} data-canvas="wide">
      <div className={styles.window}>
        <MegaMenuMorph
          brand={<TallyLogo />}
          items={ITEMS}
          current={visited ?? undefined}
          showSafeArea={showSafeArea}
          onNavigate={handleNavigate}
          actions={
            <>
              <a
                className={styles.quiet}
                href="#sign-in"
                onClick={(e) => {
                  e.preventDefault();
                  setVisited("Sign in");
                }}
              >
                Sign in
              </a>
              <a
                className={styles.primary}
                href="#start"
                onClick={(e) => {
                  e.preventDefault();
                  setVisited("Start now");
                }}
              >
                Start now
              </a>
            </>
          }
          compactActions={
            <a
              className={styles.primary}
              href="#start"
              onClick={(e) => {
                e.preventDefault();
                setVisited("Start now");
              }}
            >
              Start now
            </a>
          }
        />

        <div className={styles.page}>
          <h2 className={styles.title}>
            Get paid in 46 currencies, settle in yours
          </h2>
          <p className={styles.lead}>
            One integration for checkout, subscriptions and payouts, with fraud
            scoring and reconciliation built in.
          </p>
          <p className={styles.visit} aria-live="polite">
            {visited
              ? `Navigated to ${visited}`
              : "Choose any destination in the header"}
          </p>
        </div>
      </div>

      <div className={styles.controls}>
        <Switch
          label="Show safe area"
          checked={showSafeArea}
          onCheckedChange={setShowSafeArea}
        />
        <span className={styles.hint}>
          Move diagonally from a menu into its links, or tab in and use the
          arrow keys
        </span>
      </div>
    </div>
  );
}
