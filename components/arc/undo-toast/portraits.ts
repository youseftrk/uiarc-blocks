/** Gradient portraits drawn inline, so the demo needs no image files. */
interface PortraitSpec { base: string; blur: number; spots: [color: string, cx: number, cy: number, r: number][]; hi: number[] }

const FALLOFF = [[0, 1], [.15, .966], [.3, .868], [.45, .712], [.6, .512], [.72, .334], [.84, .16], [1, 0]];
const RECT = '<rect x="-55" y="-55" width="190" height="210" fill="';

const SPECS: Record<string, PortraitSpec> = {
  "emma-collins": {"base":"#ee6019","blur":11.0,"spots":[["#7a40ef",32.2,62.8,97.1],["#66fb98",38.6,68.0,89.9],["#66fb98",102.4,78.4,87.7],["#ee6019",29.4,66.3,75.2],["#ee6019",47.0,19.6,68.0],["#ee6019",27.6,50.0,67.3],["#ee6019",36.6,25.9,63.8],["#66fb98",37.5,15.8,63.6],["#7a40ef",65.7,39.1,53.5],["#66fb98",84.4,47.2,46.5],["#7a40ef",27.2,25.5,45.3]],"hi":[25.0,40.3,43.2,0.15]},
  "daniel-kim": {"base":"#21f4eb","blur":11.0,"spots":[["#21f4eb",53.7,76.3,96.9],["#4ac5f8",40.9,45.0,91.3],["#4ac5f8",-6.7,72.0,89.8],["#ed9773",22.6,7.5,86.3],["#f8444b",26.0,76.3,85.4],["#ed9773",42.1,32.6,71.1],["#21f4eb",48.0,60.3,68.1],["#f8444b",74.5,96.0,57.4],["#21f4eb",58.7,41.1,48.7]],"hi":[17.6,21.7,43.2,0.15]},
  "sofia-ramirez": {"base":"#3f96ed","blur":11.0,"spots":[["#eca45c",29.0,-1.4,95.5],["#3153fe",-3.5,59.7,89.1],["#f3dd70",56.0,48.1,84.5],["#3f96ed",54.3,28.4,82.1],["#3f96ed",48.9,86.8,73.7],["#3153fe",65.7,63.5,64.6],["#3f96ed",47.6,60.3,51.6],["#eca45c",20.4,23.4,49.7],["#f3dd70",57.2,34.3,45.4]],"hi":[11.7,32.3,43.2,0.15]},
  "marcus-johnson": {"base":"#41f0af","blur":11.0,"spots":[["#f944e3",48.1,-12.7,78.4],["#41f0af",47.6,46.0,72.2],["#f944e3",28.8,68.0,70.9],["#e86553",25.2,56.6,69.2],["#41f0af",6.8,52.4,66.1],["#e86553",84.3,40.6,63.3],["#f944e3",69.5,35.7,59.8],["#41f0af",7.6,1.2,55.7],["#41f0af",-1.5,99.0,44.4],["#e86553",51.3,54.8,43.6]],"hi":[31.7,36.9,43.2,0.15]},
  "olivia-bennett": {"base":"#d6f368","blur":11.0,"spots":[["#d6f368",63.9,45.4,99.5],["#5025f5",82.1,30.4,87.4],["#a2f65b",52.2,62.9,81.3],["#ad54f8",18.5,37.5,81.1],["#5025f5",59.7,71.2,75.1],["#a2f65b",60.5,-10.6,69.9],["#d6f368",16.4,54.1,60.9],["#ad54f8",37.9,48.0,55.2],["#d6f368",99.2,78.0,52.5]],"hi":[14.6,38.2,43.2,0.15]},
  "nathan-cole": {"base":"#3feb87","blur":11.0,"spots":[["#2af1c0",53.7,55.9,98.6],["#f04aab",64.1,-8.1,97.6],["#f31f53",53.9,78.5,90.3],["#f31f53",8.8,34.1,80.4],["#3feb87",49.0,51.1,75.5],["#3feb87",27.5,55.7,68.4],["#f04aab",60.3,28.5,67.6],["#f04aab",32.4,39.0,53.5],["#2af1c0",60.8,72.4,52.6],["#3feb87",27.2,6.9,52.3],["#2af1c0",-21.0,14.1,44.5]],"hi":[23.5,23.9,43.2,0.15]},
};

const cache = new Map<string, string>();

/** A data URI for the named gradient portrait. */
export function portrait(id: string): string {
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
