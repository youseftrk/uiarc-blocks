"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Blocks,
  FileText,
  GitBranch,
  HelpCircle,
  Kanban,
  LifeBuoy,
  Shield,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { MorphNav, type MorphNavItem, type MorphNavSearch } from "./morph-nav";
import styles from "./morph-nav.module.css";

const BRAND_MARK = (
  <svg viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <rect x=".5" y=".5" width="25" height="25" rx="8" fill="currentColor" />
    <path
      d="M8 17.5V8.5h9M8 13h6.5"
      stroke="var(--background)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ITEMS: MorphNavItem[] = [
  {
    value: "product",
    label: "Product",
    columns: 2,
    links: [
      {
        label: "Planning",
        description: "Roadmaps, cycles, and dependencies",
        icon: <Kanban />,
        href: "#planning",
      },
      {
        label: "Docs",
        description: "Specs that stay in sync with the work",
        icon: <FileText />,
        href: "#docs",
      },
      {
        label: "Insights",
        description: "Cycle time and throughput by team",
        icon: <BarChart3 />,
        href: "#insights",
      },
      {
        label: "Automations",
        description: "Rules that triage, assign, and remind",
        icon: <Workflow />,
        href: "#automations",
      },
      {
        label: "Integrations",
        description: "GitHub, Slack, Figma, and 60 more",
        icon: <Blocks />,
        href: "#integrations",
      },
      {
        label: "Security",
        description: "SSO, audit logs, and data residency",
        icon: <Shield />,
        href: "#security",
      },
    ],
    feature: (
      <button type="button" className={styles.story}>
        <span className={styles.storyThumb} aria-hidden="true">
          <Sparkles size={24} strokeWidth={1.6} />
        </span>
        <span className={styles.storyTitle}>Fieldwork 4.0 is here</span>
        <span className={styles.storyMeta}>Plan, write, and ship from one place</span>
      </button>
    ),
    footer: (
      <button type="button" className={styles.footerLink}>
        <span>Automations can now run on a schedule</span>
        <ArrowRight size={13} />
      </button>
    ),
  },
  {
    value: "solutions",
    label: "Solutions",
    columns: 1,
    links: [
      {
        label: "Engineering",
        description: "Triage bugs and ship on a predictable cadence",
        icon: <GitBranch />,
        href: "#engineering",
      },
      {
        label: "Product teams",
        description: "Connect customer feedback to quarterly bets",
        icon: <Zap />,
        href: "#product-teams",
      },
      {
        label: "Design systems",
        description: "Track component adoption and audits",
        icon: <Blocks />,
        href: "#design-systems",
      },
    ],
  },
  {
    value: "resources",
    label: "Resources",
    columns: 1,
    links: [
      {
        label: "Documentation",
        description: "Guides and API reference",
        icon: <BookOpen />,
        href: "#documentation",
      },
      {
        label: "Changelog",
        description: "What shipped this week",
        icon: <Sparkles />,
        href: "#changelog",
      },
      {
        label: "Community",
        description: "12,400 teams trading notes",
        icon: <Users />,
        href: "#community",
      },
      {
        label: "Help center",
        description: "Answers from our support team",
        icon: <LifeBuoy />,
        href: "#help",
      },
    ],
    feature: (
      <button type="button" className={styles.story}>
        <span className={styles.storyThumb} aria-hidden="true">
          <BookOpen size={24} strokeWidth={1.6} />
        </span>
        <span className={styles.storyTitle}>A calm planning week</span>
        <span className={styles.storyMeta}>Guide · 12 min read</span>
      </button>
    ),
  },
  {
    value: "pricing",
    label: "Pricing",
    href: "#pricing",
  },
];

const SEARCH: MorphNavSearch = {
  placeholder: "Search Fieldwork",
  items: [
    {
      label: "Planning",
      description: "Roadmaps, cycles, and dependencies",
      group: "Product",
      icon: <Kanban />,
      href: "#planning",
      keywords: "roadmap sprint cycle",
    },
    {
      label: "Automations",
      description: "Rules that triage, assign, and remind",
      group: "Product",
      icon: <Workflow />,
      href: "#automations",
      keywords: "workflow trigger schedule",
    },
    {
      label: "Pricing",
      description: "Free, Team at $10, and Enterprise",
      group: "Company",
      icon: <HelpCircle />,
      href: "#pricing",
      keywords: "cost billing plans",
    },
    {
      label: "Documentation",
      description: "Guides and API reference",
      group: "Resources",
      icon: <BookOpen />,
      href: "#documentation",
      keywords: "api sdk docs",
    },
    {
      label: "Changelog",
      description: "What shipped this week",
      group: "Resources",
      icon: <Sparkles />,
      href: "#changelog",
      keywords: "releases updates",
    },
    {
      label: "Security",
      description: "SSO, audit logs, and data residency",
      group: "Product",
      icon: <Shield />,
      href: "#security",
      keywords: "soc2 saml compliance",
    },
  ],
};

export default function MorphNavDemo() {
  const [compact, setCompact] = useState(false);
  const [current, setCurrent] = useState("product");
  const [lastNav, setLastNav] = useState("Product / Planning");

  return (
    <div className={styles.stage}>
      <div
        className={styles.viewport}
        onScroll={(e) => {
          setCompact(e.currentTarget.scrollTop > 40);
        }}
      >
        <div className={styles.navSlot}>
          <MorphNav
            brand={{ name: "Fieldwork", mark: BRAND_MARK }}
            items={ITEMS}
            search={SEARCH}
            action={{ label: "Start free", onClick: () => setLastNav("Start free") }}
            current={current}
            compact={compact}
            label="Fieldwork"
            onNavigate={({ label, section }) => {
              if (section) {
                const match = ITEMS.find(
                  (i) => i.label.toLowerCase() === section.toLowerCase() || i.value === section
                );
                if (match) setCurrent(match.value);
              }
              setLastNav(section ? `${section} / ${label}` : label);
            }}
          />
        </div>

        <div className={styles.page}>
          <div className={styles.hero}>
            <p className={styles.crumb}>{lastNav}</p>
            <h3 className={styles.title}>One surface that stays with you</h3>
            <p className={styles.lede}>
              Hover the navigation items, open search, or scroll down to watch the bar tighten into
              compact mode.
            </p>
          </div>

          <div className={styles.grid}>
            <div className={styles.block}>
              <h4>Shared geometry</h4>
              <p>Width, height, and radius spring continuously between bar, panel, and search.</p>
            </div>
            <div className={styles.block}>
              <h4>Keyboard &amp; touch ready</h4>
              <p>Arrow keys traverse triggers and search options; narrow containers collapse cleanly.</p>
            </div>
          </div>

          <p className={styles.note}>Scroll inside this frame to test compact mode</p>
          <div className={styles.spacer} />
        </div>
      </div>
    </div>
  );
}
