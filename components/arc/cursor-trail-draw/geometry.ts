export type Pt = [number, number];
export type WhiteboardShape = "stroke" | "line" | "circle" | "ellipse" | "rectangle" | "triangle" | "quadrilateral";

export interface Recognized {
  shape: Exclude<WhiteboardShape, "stroke">;
  d: string;
  target: Pt[];
}

const f1 = (n: number) => String(Math.round(n * 10) / 10);
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function pathLength(pts: Pt[]) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

/** Resamples a polyline (and a parallel list of values) to `count` points evenly spaced by arc length. */
export function resample(pts: Pt[], count: number, values?: number[]): { pts: Pt[]; values: number[] } {
  const total = pathLength(pts);
  const out: Pt[] = [];
  const outValues: number[] = [];
  if (pts.length === 0) return { pts: out, values: outValues };
  if (total === 0) {
    for (let i = 0; i < count; i++) { out.push([pts[0][0], pts[0][1]]); outValues.push(values ? values[0] : 0); }
    return { pts: out, values: outValues };
  }
  let seg = 1, walked = 0;
  for (let i = 0; i < count; i++) {
    const want = (total * i) / (count - 1);
    while (seg < pts.length - 1 && walked + dist(pts[seg - 1], pts[seg]) < want) { walked += dist(pts[seg - 1], pts[seg]); seg++; }
    const len = dist(pts[seg - 1], pts[seg]) || 1;
    const t = Math.min(1, Math.max(0, (want - walked) / len));
    out.push([lerp(pts[seg - 1][0], pts[seg][0], t), lerp(pts[seg - 1][1], pts[seg][1], t)]);
    outValues.push(values ? lerp(values[seg - 1], values[seg], t) : 0);
  }
  return { pts: out, values: outValues };
}

/** Variable-width outline of a centerline, with round caps. */
export function outline(pts: Pt[], widths: number[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) {
    const r = Math.max(0.1, widths[0] / 2), [x, y] = pts[0];
    return `M${f1(x - r)} ${f1(y)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(x + r)} ${f1(y)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(x - r)} ${f1(y)}Z`;
  }
  const left: Pt[] = [], right: Pt[] = [];
  let nx = 0, ny = 1;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len > 1e-6) { nx = -dy / len; ny = dx / len; }
    const h = widths[i] / 2;
    left.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    right.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  const side = (s: Pt[]) => {
    let d = "";
    for (let i = 1; i < s.length - 1; i++) d += `Q${f1(s[i][0])} ${f1(s[i][1])} ${f1((s[i][0] + s[i + 1][0]) / 2)} ${f1((s[i][1] + s[i + 1][1]) / 2)}`;
    return d + `L${f1(s[s.length - 1][0])} ${f1(s[s.length - 1][1])}`;
  };
  right.reverse();
  const r1 = f1(Math.max(0.1, widths[n - 1] / 2)), r0 = f1(Math.max(0.1, widths[0] / 2));
  return `M${f1(left[0][0])} ${f1(left[0][1])}${side(left)}A${r1} ${r1} 0 0 0 ${f1(right[0][0])} ${f1(right[0][1])}${side(right)}A${r0} ${r0} 0 0 0 ${f1(left[0][0])} ${f1(left[0][1])}Z`;
}

function signedArea(pts: Pt[]) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return area / 2;
}

function segDistance(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  let worst = 0, index = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDistance(pts[i], pts[0], pts[pts.length - 1]); if (d > worst) { worst = d; index = i; } }
  if (worst <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, index + 1), eps).slice(0, -1), ...simplify(pts.slice(index), eps)];
}

/** Points along a closed polygon, starting at the spot nearest `start` and running in the drawn direction. */
function samplePolygon(vertices: Pt[], start: Pt, clockwise: boolean, count: number): Pt[] {
  let ring = vertices.slice();
  if ((signedArea(ring) > 0) !== clockwise) ring.reverse();
  let best = 0, bestD = Infinity, bestPt: Pt = ring[0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((start[0] - a[0]) * dx + (start[1] - a[1]) * dy) / len2));
    const p: Pt = [a[0] + dx * t, a[1] + dy * t], d = dist(p, start);
    if (d < bestD) { bestD = d; best = i; bestPt = p; }
  }
  ring = [bestPt, ...ring.slice(best + 1), ...ring.slice(0, best + 1), bestPt];
  return resample(ring, count).pts;
}

const polygonPath = (v: Pt[]) => v.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("") + "Z";

/** Finds the clean shape a rough stroke stands for, or null when it should stay freehand. `unit` is board units per CSS pixel. */
export function recognize(raw: Pt[], unit: number, count: number): Recognized | null {
  const total = pathLength(raw);
  if (raw.length < 4 || total < 24 * unit) return null;
  const first = raw[0], last = raw[raw.length - 1], chord = dist(first, last);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of raw) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  const closed = total > 70 * unit && chord < Math.max(0.2 * total, 16 * unit) && chord < 0.45 * diag;

  if (!closed) {
    let deviation = 0;
    for (const p of raw) deviation = Math.max(deviation, segDistance(p, first, last));
    if (chord < 20 * unit || deviation > 0.09 * chord || total > 1.25 * chord) return null;
    let angle = Math.atan2(last[1] - first[1], last[0] - first[0]);
    const step = Math.PI / 4, snapped = Math.round(angle / step) * step;
    if (Math.abs(angle - snapped) < (7 * Math.PI) / 180) angle = snapped;
    const cx = (first[0] + last[0]) / 2, cy = (first[1] + last[1]) / 2, half = chord / 2;
    const a: Pt = [cx - Math.cos(angle) * half, cy - Math.sin(angle) * half], b: Pt = [cx + Math.cos(angle) * half, cy + Math.sin(angle) * half];
    return { shape: "line", d: `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`, target: resample([a, b], count).pts };
  }

  const loop = resample(raw, 72).pts;
  const clockwise = signedArea(loop) > 0;
  let corners = simplify([...loop, loop[0]], 0.07 * diag).slice(0, -1);
  for (let pass = 0; pass < 2; pass++) {
    corners = corners.filter((p, i, all) => {
      if (all.length <= 3) return true;
      const a = all[(i + all.length - 1) % all.length], b = all[(i + 1) % all.length];
      const turn = Math.abs(Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0]));
      const wrapped = Math.min(turn, Math.PI * 2 - turn);
      return wrapped > (28 * Math.PI) / 180 && dist(p, a) > 0.12 * diag;
    });
  }
  if (corners.length === 3 || corners.length === 4) {
    let error = 0;
    for (const p of loop) { let d = Infinity; for (let i = 0; i < corners.length; i++) d = Math.min(d, segDistance(p, corners[i], corners[(i + 1) % corners.length])); error += d; }
    if (error / loop.length < 0.04 * diag) {
      if (corners.length === 3) return { shape: "triangle", d: polygonPath(corners), target: samplePolygon(corners, first, clockwise, count) };
      const square = corners.every((p, i) => {
        const a = corners[(i + 3) % 4], b = corners[(i + 1) % 4];
        const dot = ((a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1])) / (dist(a, p) * dist(b, p) || 1);
        return Math.abs(dot) < 0.42;
      });
      if (!square) return { shape: "quadrilateral", d: polygonPath(corners), target: samplePolygon(corners, first, clockwise, count) };
      let longest = 0, angle = 0;
      for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i + 1) % 4], len = dist(a, b); if (len > longest) { longest = len; angle = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
      const quarter = Math.PI / 2, level = Math.round(angle / quarter) * quarter;
      if (Math.abs(angle - level) < (9 * Math.PI) / 180) angle = 0;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      const us = corners.map(p => p[0] * cos + p[1] * sin).sort((a, b) => a - b), vs = corners.map(p => -p[0] * sin + p[1] * cos).sort((a, b) => a - b);
      u0 = (us[0] + us[1]) / 2; u1 = (us[2] + us[3]) / 2; v0 = (vs[0] + vs[1]) / 2; v1 = (vs[2] + vs[3]) / 2;
      if (Math.abs(u1 - u0 - (v1 - v0)) < 0.1 * Math.max(u1 - u0, v1 - v0)) {
        const side = (u1 - u0 + v1 - v0) / 2, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
        u0 = cu - side / 2; u1 = cu + side / 2; v0 = cv - side / 2; v1 = cv + side / 2;
      }
      const rect: Pt[] = ([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as Pt[]).map(([u, v]) => [u * cos - v * sin, u * sin + v * cos]);
      return { shape: "rectangle", d: polygonPath(rect), target: samplePolygon(rect, first, clockwise, count) };
    }
  }

  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  if (rx < 6 * unit || ry < 6 * unit) return null;
  let error = 0;
  for (const p of loop) error += Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1);
  if (error / loop.length > 0.12) return null;
  const round = Math.abs(rx - ry) < 0.14 * Math.max(rx, ry);
  if (round) rx = ry = (rx + ry) / 2;
  const from = Math.atan2((first[1] - cy) / ry, (first[0] - cx) / rx), target: Pt[] = [];
  for (let i = 0; i < count; i++) { const a = from + ((clockwise ? 1 : -1) * Math.PI * 2 * i) / (count - 1); target.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  const d = `M${f1(cx + rx)} ${f1(cy)}A${f1(rx)} ${f1(ry)} 0 1 1 ${f1(cx - rx)} ${f1(cy)}A${f1(rx)} ${f1(ry)} 0 1 1 ${f1(cx + rx)} ${f1(cy)}Z`;
  return { shape: round ? "circle" : "ellipse", d, target };
}
