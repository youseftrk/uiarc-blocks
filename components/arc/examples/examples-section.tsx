import type { CSSProperties, ReactNode } from "react";
import { ProBadge } from "../pro-badge";
import { cx } from "../tokens";
import {
  CopyCommand,
  HoldToConfirm,
  NumberField,
  Reactions,
  SegmentedTile,
  Slider,
  SwitchRow,
  WordRotate,
} from "./controls";
import { DataGrid } from "./data-grid";
import { LineChartDemo } from "./line-chart";
import { CoverFlow, Dock, WalletStack } from "./stacks";
import { ActivityRings, ControlCenter, LiquidTabBar, NowPlaying, OrbitMenu, VoiceOrb } from "./widgets";
import styles from "./examples-section.module.css";

type Example = { name: string; w: number; size: "show" | "tile"; pro?: boolean; tall?: boolean; node: ReactNode };

const examples: Example[] = [
  { name: "Line chart", w: 8, size: "show", node: <LineChartDemo /> },
  { name: "Segmented control", w: 4, size: "tile", node: <SegmentedTile /> },
  { name: "Switch", w: 4, size: "tile", node: <SwitchRow /> },
  { name: "Wallet stack", w: 5, size: "show", pro: true, node: <WalletStack /> },
  { name: "Dock", w: 7, size: "show", pro: true, node: <Dock /> },
  { name: "Slider", w: 3, size: "tile", node: <Slider label="Volume" defaultValue={64} /> },
  { name: "Copy button", w: 3, size: "tile", node: <CopyCommand command="npx shadcn@latest add @uiarc/button" /> },
  { name: "Hold to confirm", w: 3, size: "tile", node: <HoldToConfirm label="Hold to delete" confirmedLabel="Deleted" /> },
  { name: "Reactions", w: 3, size: "tile", node: <Reactions /> },
  { name: "Cover flow", w: 7, size: "show", pro: true, node: <CoverFlow /> },
  { name: "Voice orb", w: 5, size: "show", pro: true, node: <VoiceOrb /> },
  {
    name: "Word rotate",
    w: 4,
    size: "tile",
    node: <WordRotate prefix="Ship it " words={["today", "with taste", "faster", "calmly"]} />,
  },
  { name: "Liquid tab bar", w: 4, size: "show", pro: true, node: <LiquidTabBar /> },
  { name: "Orbit menu", w: 4, size: "show", pro: true, node: <OrbitMenu /> },
  { name: "Number field", w: 4, size: "tile", node: <NumberField label="Seats" defaultValue={12} min={1} max={500} /> },
  { name: "Data grid", w: 12, size: "show", pro: true, tall: true, node: <DataGrid /> },
  { name: "Control center", w: 4, size: "show", pro: true, node: <ControlCenter /> },
  { name: "Activity rings", w: 4, size: "show", pro: true, node: <ActivityRings /> },
  { name: "Now playing", w: 4, size: "show", pro: true, node: <NowPlaying /> },
];

export function ExamplesSection() {
  return (
    <section className={styles.section} id="examples" aria-labelledby="examples-title">
      <div className={styles.head}>
        <h2 id="examples-title">Every example is live</h2>
        <p>Drag it, press it, type into it.</p>
      </div>
      <div className={styles.bento}>
        {examples.map((ex, i) => (
          <div
            key={ex.name}
            role="group"
            aria-label={ex.name}
            className={cx(ex.size === "show" ? styles.show : styles.tile, ex.tall && styles.tall)}
            style={{ "--w": ex.w, "--i": i } as CSSProperties}
          >
            <div className={styles.mount}>{ex.node}</div>
            <div className={styles.caption}>
              <strong>{ex.name}</strong>
              {ex.pro ? <ProBadge /> : <span className={styles.free}>Free</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
