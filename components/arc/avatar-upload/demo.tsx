"use client";

import { useRef, useState } from "react";
import { AvatarUpload, type AvatarUploadContext, type AvatarUploadHandle } from "./avatar-upload";
import styles from "./avatar-upload.module.css";

/** Gradient portraits drawn inline, so the demo needs no image files. */
interface PortraitSpec { base: string; blur: number; spots: [color: string, cx: number, cy: number, r: number][]; hi: number[] }

const FALLOFF = [[0, 1], [.15, .966], [.3, .868], [.45, .712], [.6, .512], [.72, .334], [.84, .16], [1, 0]];
const RECT = '<rect x="-55" y="-55" width="190" height="210" fill="';

const SPECS: Record<string, PortraitSpec> = {
  "chloe-nguyen": {"base":"#6611f4","blur":11.0,"spots":[["#bc4bea",43.4,51.4,98.2],["#6611f4",32.4,16.0,94.2],["#bc4bea",45.1,60.0,79.6],["#6611f4",47.1,28.5,78.9],["#abf82b",36.1,67.4,78.8],["#58fa16",32.1,49.1,74.6],["#6611f4",27.5,36.9,73.2],["#bc4bea",93.0,62.0,67.0],["#abf82b",42.8,112.1,64.6],["#58fa16",3.4,63.6,63.1],["#abf82b",72.7,25.6,51.2]],"hi":[25.7,45.3,43.2,0.15]},
  "andre-williams": {"base":"#f1391e","blur":11.0,"spots":[["#56dcef",45.8,37.0,96.8],["#4a9fe8",-9.0,24.1,93.8],["#e9934a",63.0,87.3,86.1],["#f1391e",-11.6,32.0,76.1],["#f1391e",76.3,75.4,71.3],["#4a9fe8",18.8,9.6,67.3],["#56dcef",73.5,91.9,65.7],["#f1391e",3.2,30.6,62.6],["#e9934a",52.4,51.0,62.3],["#56dcef",35.1,24.2,61.8],["#e9934a",66.2,10.9,54.6]],"hi":[27.7,33.4,43.2,0.15]},
  "sofia-ramirez": {"base":"#3f96ed","blur":11.0,"spots":[["#eca45c",29.0,-1.4,95.5],["#3153fe",-3.5,59.7,89.1],["#f3dd70",56.0,48.1,84.5],["#3f96ed",54.3,28.4,82.1],["#3f96ed",48.9,86.8,73.7],["#3153fe",65.7,63.5,64.6],["#3f96ed",47.6,60.3,51.6],["#eca45c",20.4,23.4,49.7],["#f3dd70",57.2,34.3,45.4]],"hi":[11.7,32.3,43.2,0.15]},
  "mateo-alvarez": {"base":"#77e619","blur":11.0,"spots":[["#0778fe",25.0,50.5,98.1],["#e95196",12.0,74.3,94.9],["#77e619",39.8,82.2,93.2],["#0778fe",-1.4,76.0,90.3],["#77e619",89.2,25.7,84.9],["#0778fe",78.0,85.1,79.4],["#77e619",71.7,46.7,77.8],["#e95196",20.0,30.3,64.2],["#e95196",3.5,60.7,58.7]],"hi":[26.0,46.0,43.2,0.15]},
};

const cache = new Map<string, string>();

/** A data URI for the named gradient portrait. */
function portrait(id: string): string {
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = SPECS[id];
  if (!spec) return "";
  const gradients = spec.spots.map(([color, cx, cy, r], i) => `<radialGradient id="s${i}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">${FALLOFF.map(([offset, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</radialGradient>`).join("");
  const [hx, hy, hr, ho] = spec.hi;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 80 100"><defs>${gradients}<radialGradient id="h" cx="${hx}" cy="${hy}" r="${hr}" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity="${ho}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="b" x="0" y="0" width="80" height="100" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${spec.blur}"/><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter></defs><g filter="url(#b)">${RECT}${spec.base}"/>${spec.spots.map((_, i) => `${RECT}url(#s${i})"/>`).join("")}${RECT}url(#h)"/></g></svg>`;
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(id, uri);
  return uri;
}

const SAMPLES = [
  { id: "andre-williams", name: "Andre Williams" },
  { id: "sofia-ramirez", name: "Sofia Ramirez" },
  { id: "mateo-alvarez", name: "Mateo Alvarez" },
];

/** Draws a gradient portrait into a real image file, the way a camera roll would hand one over. */
function sampleFile(id: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 1000;
      canvas.getContext("2d")?.drawImage(image, 0, 0, 800, 1000);
      canvas.toBlob(blob => (blob ? resolve(new File([blob], `${id}.png`, { type: "image/png" })) : reject(new Error("No image"))), "image/png");
    };
    image.onerror = () => reject(new Error("No image"));
    image.src = portrait(id);
  });
}

export default function Demo() {
  const upload = useRef<AvatarUploadHandle>(null);
  const failNext = useRef(false);
  const [fail, setFail] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const onUpload = (_image: Blob, { report, signal }: AvatarUploadContext) =>
    new Promise<void>((resolve, reject) => {
      const failing = failNext.current;
      const stopAt = failing ? 0.61 : 1;
      let progress = 0;
      let timer = 0;
      const tick = () => {
        progress = Math.min(1, progress + 0.05 + Math.random() * 0.12);
        if (progress >= stopAt) {
          report(stopAt);
          if (failing) {
            failNext.current = false;
            setFail(false);
            reject(new Error("Upload failed. Your previous photo is unchanged."));
          } else timer = window.setTimeout(resolve, 420);
          return;
        }
        report(progress);
        timer = window.setTimeout(tick, 140);
      };
      timer = window.setTimeout(tick, 320);
      signal.addEventListener("abort", () => window.clearTimeout(timer));
    });

  const pick = async (id: string) => {
    setLoading(id);
    try {
      upload.current?.selectFile(await sampleFile(id));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={styles.dDemo}>
      <section className={styles.dCard} aria-labelledby="avatar-upload-demo-title">
        <div className={styles.dHeader}>
          <h3 id="avatar-upload-demo-title" className={styles.dTitle}>Profile</h3>
          <p className={styles.dLede}>Click or drop a photo on the avatar. Uploads are simulated.</p>
        </div>
        <AvatarUpload ref={upload} name="Chloe Nguyen" src={portrait("chloe-nguyen")} onUpload={onUpload} onRemove={() => {}} />
        <div className={styles.dTools}>
          <div className={styles.dGroup}>
            <span className={styles.dGroupLabel}>Sample photos</span>
            <div className={styles.dSamples}>
              {SAMPLES.map(sample => (
                <button key={sample.id} type="button" className={styles.dSample} aria-label={`Use photo of ${sample.name}`} data-loading={loading === sample.id || undefined} onClick={() => void pick(sample.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={portrait(sample.id)} alt="" draggable={false} />
                </button>
              ))}
            </div>
          </div>
          <div className={styles.dGroup}>
            <span className={styles.dGroupLabel}>Try a failure</span>
            <div className={styles.dChips}>
              <button type="button" className={styles.dChip} onClick={() => upload.current?.selectFile(new File([new Uint8Array(13002342)], "holiday.jpg", { type: "image/jpeg" }))}>12 MB photo</button>
              <button type="button" className={styles.dChip} onClick={() => upload.current?.selectFile(new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" }))}>PDF file</button>
              <button type="button" className={styles.dChip} aria-pressed={fail} onClick={() => { failNext.current = !fail; setFail(!fail); }}>
                <span className={styles.dCheck} aria-hidden="true" />Fail next upload
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
