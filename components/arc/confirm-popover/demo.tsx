"use client";

import { useId, useState } from "react";
import { Trash2, UserMinus } from "lucide-react";
import { ConfirmPopover, type ConfirmPopoverContext } from "./confirm-popover";
import styles from "./confirm-popover.module.css";

/** Gradient avatars drawn inline, so the demo needs no image files. */
interface FaceSpec { base: string; blur: number; spots: [color: string, cx: number, cy: number, r: number][]; hi: number[] }

const FALLOFF = [[0, 1], [.15, .966], [.3, .868], [.45, .712], [.6, .512], [.72, .334], [.84, .16], [1, 0]];
const RECT = '<rect x="-55" y="-55" width="210" height="210" fill="';

const FACES: Record<string, FaceSpec> = {
  "jordan-reyes": {"base":"#f028bd","blur":11.0,"spots":[["#f028bd",91.7,2.9,97.6],["#83f15f",24.6,62.7,91.5],["#76edcf",83.0,14.5,82.4],["#83f15f",64.1,60.0,71.1],["#83f15f",60.4,72.5,68.8],["#76edcf",58.6,99.7,66.5],["#76edcf",57.3,63.2,63.6],["#f028bd",63.4,39.3,60.8],["#f028bd",24.4,43.0,59.0],["#f028bd",29.6,48.1,43.6]],"hi":[49.2,33.0,43.2,0.15]},
};

const cache = new Map<string, string>();

function face(id: string): string {
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = FACES[id];
  if (!spec) return "";
  const gradients = spec.spots.map(([color, cx, cy, r], i) => `<radialGradient id="s${i}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">${FALLOFF.map(([offset, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</radialGradient>`).join("");
  const [hx, hy, hr, ho] = spec.hi;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100"><defs>${gradients}<radialGradient id="h" cx="${hx}" cy="${hy}" r="${hr}" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity="${ho}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="b" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${spec.blur}"/><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter></defs><g filter="url(#b)">${RECT}${spec.base}"/>${spec.spots.map((_, i) => `${RECT}url(#s${i})"/>`).join("")}${RECT}url(#h)"/></g></svg>`;
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(id, uri);
  return uri;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Error("Aborted"));
    });
  });

export default function Demo() {
  const [fail, setFail] = useState(false);
  const [log, setLog] = useState("Nothing has changed yet");
  const switchId = useId();

  const run = async (steps: number, { setProgress, signal }: ConfirmPopoverContext, message: string) => {
    for (let step = 1; step <= steps; step++) {
      await wait(360 + 260 * Math.random(), signal);
      if (fail && step === Math.ceil(steps / 2)) {
        setFail(false);
        throw Error("The server didn't respond. Nothing was changed.");
      }
      setProgress(step / steps);
    }
    setLog(message);
  };

  return (
    <div className={styles.dDemo}>
      <section className={styles.dCard} aria-labelledby="confirm-popover-demo-title">
        <h3 id="confirm-popover-demo-title" className={styles.dHeading}>Atlas settings</h3>
        <div className={styles.dRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.dAvatar} src={face("jordan-reyes")} alt="" width={36} height={36} draggable={false} />
          <div className={styles.dText}>
            <span className={styles.dName}>Jordan Reyes</span>
            <span className={styles.dMeta}>Editor · jordan@atlas.dev</span>
          </div>
          <ConfirmPopover
            icon={<UserMinus size={16} strokeWidth={1.75} />}
            align="end"
            title="Remove Jordan from Atlas?"
            description="Jordan loses access to the project and its three environments right away. You can invite them again later."
            confirmLabel="Remove"
            pendingLabel="Removing"
            successLabel="Removed"
            errorTitle="Couldn't remove Jordan"
            onConfirm={ctx => run(3, ctx, "Jordan was removed (simulated)")}
          >
            Remove
          </ConfirmPopover>
        </div>
        <div className={styles.dRow}>
          <div className={styles.dText}>
            <span className={styles.dName}>Delete project</span>
            <span className={styles.dMeta}>14 deployments, 3 environments and all logs</span>
          </div>
          <ConfirmPopover
            icon={<Trash2 size={16} strokeWidth={1.75} />}
            align="end"
            title="Delete Atlas?"
            description="This permanently deletes 14 deployments, 3 environments and every log. It can't be undone."
            confirmText="atlas"
            confirmLabel="Delete project"
            errorTitle="Couldn't delete Atlas"
            onConfirm={ctx => run(5, ctx, "Atlas was deleted (simulated)")}
          >
            Delete
          </ConfirmPopover>
        </div>
      </section>
      <div className={styles.dFooter}>
        <label className={styles.dSwitchLabel} htmlFor={switchId}>
          <input id={switchId} type="checkbox" role="switch" className={styles.dSwitch} checked={fail} onChange={event => setFail(event.target.checked)} />
          Fail the next attempt
        </label>
        <p className={styles.dLog} aria-live="polite">{log}</p>
      </div>
    </div>
  );
}
