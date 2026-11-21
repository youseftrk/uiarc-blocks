"use client";

import { useState } from "react";
import { MorphBlock, SkeletonMorph } from "./skeleton-morph";

const PAYOUTS = [
  { name: "Marcus Johnson", date: "Paid today", amount: "$1,240", initials: "MJ", hue: 215 },
  { name: "Chloe Nguyen", date: "Paid Sep 22", amount: "$860", initials: "CN", hue: 335 },
  { name: "Daniel Kim", date: "Scheduled Sep 30", amount: "$2,180", initials: "DK", hue: 155 },
];

export default function SkeletonMorphDemo() {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);

  const replay = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1100);
  };

  return (
    <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }}>
      <SkeletonMorph
        loading={loading}
        style={{
          padding: 20,
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MorphBlock radius="circle" width={46} height={46}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "999px",
                  background: "hsl(265 60% 54%)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                JB
              </div>
            </MorphBlock>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <MorphBlock width={132} lines={1} lineHeight={20}>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: "20px", color: "var(--text)" }}>
                  Jasmine Brooks
                </div>
              </MorphBlock>
              <MorphBlock width={156} lines={1} lineHeight={18}>
                <div style={{ fontSize: 12.5, lineHeight: "18px", color: "var(--text-muted)" }}>
                  Design lead at Northwind
                </div>
              </MorphBlock>
            </div>
          </div>

          <MorphBlock width={82} height={32} radius={999}>
            <button
              type="button"
              onClick={() => setFollowing((f) => !f)}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 999,
                border: following ? "1px solid var(--border)" : "none",
                background: following ? "var(--surface-subtle)" : "var(--accent)",
                color: following ? "var(--text)" : "var(--accent-contrast)",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {following ? "Following" : "Follow"}
            </button>
          </MorphBlock>
        </div>

        <MorphBlock lines={2} lineHeight={20}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: "20px", color: "var(--text-secondary)" }}>
            Designs calm tools for busy teams. Currently rebuilding the Northwind scheduling flow.
          </p>
        </MorphBlock>

        <MorphBlock width={165} lines={1} lineHeight={18}>
          <div style={{ fontSize: 12.5, lineHeight: "18px", color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>2.4k</strong> followers ·{" "}
            <strong style={{ color: "var(--text)" }}>184</strong> posts
          </div>
        </MorphBlock>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <MorphBlock width={104} lines={1} lineHeight={16}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", lineHeight: "16px" }}>
              Recent payouts
            </div>
          </MorphBlock>

          {PAYOUTS.map((p) => (
            <div
              key={p.name}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MorphBlock radius="circle" width={32} height={32}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "999px",
                      background: `hsl(${p.hue} 58% 50%)`,
                      color: "#fff",
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p.initials}
                  </div>
                </MorphBlock>
                <div>
                  <MorphBlock width={112} lines={1} lineHeight={18}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: "18px", color: "var(--text)" }}>
                      {p.name}
                    </div>
                  </MorphBlock>
                  <MorphBlock width={86} lines={1} lineHeight={16}>
                    <div style={{ fontSize: 12, lineHeight: "16px", color: "var(--text-muted)" }}>
                      {p.date}
                    </div>
                  </MorphBlock>
                </div>
              </div>
              <MorphBlock width={54} lines={1} lineHeight={18}>
                <div style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
                  {p.amount}
                </div>
              </MorphBlock>
            </div>
          ))}
        </div>
      </SkeletonMorph>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setLoading((l) => !l)}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {loading ? "Resolve content" : "Show skeleton"}
        </button>
        <button
          type="button"
          onClick={replay}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--surface-subtle)",
            color: "var(--text-muted)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Replay morph
        </button>
      </div>
    </div>
  );
}
