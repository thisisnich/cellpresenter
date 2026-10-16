// Builds every logo file from docs/brand/logo.json (the Logo Lab settings):
//   docs/brand/mark.svg, mark-dark.svg  the mark alone, for light / dark pages
//   docs/brand/icon.svg                 the app icon tile
//   app/src/brand/markPaths.ts          path data for the in-app <Mark />
// `npm run gen:icon` then runs `tauri icon` on icon.svg for src-tauri/icons.
import { readFileSync, writeFileSync } from "node:fs";

const logo = JSON.parse(readFileSync("docs/brand/logo.json", "utf8"));
const palette = logo.palette;
const parts = logo.parts.filter((p) => p.visible !== false);

const f = (n) => +(+n).toFixed(2);

// ---- geometry (same maths as the Logo Lab) ----
const CURSOR = [[0, 0], [0, 0.8], [0.21, 0.62], [0.36, 0.96], [0.5, 0.9], [0.35, 0.57], [0.62, 0.57]];

function rawPoints(p) {
  const { x, y, w, h } = p;
  if (p.kind === "play") return [[x, y, 0], [x + w, y + h / 2, 0], [x, y + h, 0]];
  if (p.kind === "cursor") return CURSOR.map(([u, v]) => [x + (u / 0.62) * w, y + (v / 0.96) * h, 0]);
  return [[x + p.sl, y, p.ctl], [x + w - p.sr, y, p.ctr], [x + w, y + h, p.cbr], [x, y + h, p.cbl]];
}

function chamfer(cs) {
  const out = [];
  const n = cs.length;
  for (let i = 0; i < n; i++) {
    const [px, py, c] = cs[i];
    if (!(c > 0)) {
      out.push([px, py]);
      continue;
    }
    const a = cs[(i - 1 + n) % n];
    const b = cs[(i + 1) % n];
    const da = Math.hypot(a[0] - px, a[1] - py) || 1;
    const db = Math.hypot(b[0] - px, b[1] - py) || 1;
    const ca = Math.min(c, da * 0.49);
    const cb = Math.min(c, db * 0.49);
    out.push([px + ((a[0] - px) / da) * ca, py + ((a[1] - py) / da) * ca]);
    out.push([px + ((b[0] - px) / db) * cb, py + ((b[1] - py) / db) * cb]);
  }
  return out;
}

function rotate(pts, deg, cx, cy) {
  if (!deg) return pts;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) out.push(p);
  }
  const [a, z] = [out[0], out[out.length - 1]];
  if (out.length > 1 && Math.hypot(a[0] - z[0], a[1] - z[1]) <= 0.01) out.pop();
  return out;
}

function roundedPath(pts, r) {
  const n = pts.length;
  if (!(r > 0)) return "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + "Z";
  const k = 0.552;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const rr = Math.min(r, la / 2, lb / 2);
    const p1 = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr];
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr];
    const c1 = [p1[0] + (p[0] - p1[0]) * k, p1[1] + (p[1] - p1[1]) * k];
    const c2 = [p2[0] + (p[0] - p2[0]) * k, p2[1] + (p[1] - p2[1]) * k];
    d += `${i ? "L" : "M"}${f(p1[0])} ${f(p1[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

function geom(p) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  if (p.kind === "circle") {
    const rx = p.w / 2;
    const ry = p.h / 2;
    const box = rotate([[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]], p.rot, cx, cy);
    const d = `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
    return { d, pts: box, transform: p.rot ? `rotate(${f(p.rot)} ${f(cx)} ${f(cy)})` : "" };
  }
  const pts = dedupe(rotate(chamfer(rawPoints(p)), p.rot, cx, cy));
  return { d: roundedPath(pts, p.r), pts, transform: "" };
}

// The in-app mark colours each shape by role, so a theme can recolour it:
// "ink" the blocks, "corner" the accent blocks, "play" the play / cursor.
const role = (p) => (p.fill === "accent" ? (p.kind === "play" || p.kind === "cursor" ? "play" : "corner") : "ink");

const shapes = parts.map((p) => ({ ...geom(p), part: p, role: role(p) }));
let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
for (const s of shapes)
  for (const [x, y] of s.pts) {
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
const box = { x: f(x0), y: f(y0), w: f(x1 - x0), h: f(y1 - y0) };
const viewBox = `${box.x} ${box.y} ${box.w} ${box.h}`;

const colour = (tok, map = {}) => palette[map[tok] ?? tok] ?? tok;
const pathsSvg = (map) =>
  shapes
    .map((s) => {
      const p = s.part;
      const stroke = p.stroke !== "none" && p.sw > 0 ? ` stroke="${colour(p.stroke, map)}" stroke-width="${f(p.sw)}" stroke-linejoin="round"` : "";
      return `<path d="${s.d}" fill="${colour(p.fill, map)}"${stroke}${s.transform ? ` transform="${s.transform}"` : ""}/>`;
    })
    .join("");

const ON_DARK = { ink: "paper" };
const markSvg = (map) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${pathsSvg(map)}</svg>\n`;

// macOS icon grid: an 824 px tile centred on a 1024 px canvas. The mark sits
// inside the tile with `icon.pad` percent padding on each side.
const icon = (() => {
  const ic = logo.icon;
  const tile = 824;
  const off = (1024 - tile) / 2;
  const s = (tile * (1 - (2 * ic.pad) / 100)) / Math.max(box.w, box.h);
  const tx = 512 - (box.x + box.w / 2) * s;
  const ty = 512 - (box.y + box.h / 2) * s;
  return { off, tile, rx: f((tile * ic.radius) / 100), transform: `translate(${f(tx)} ${f(ty)}) scale(${f(s)})` };
})();

function iconSvg() {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">` +
    `<rect x="${icon.off}" y="${icon.off}" width="${icon.tile}" height="${icon.tile}" rx="${icon.rx}" fill="${colour(logo.icon.bg)}"/>` +
    `<g transform="${icon.transform}">${pathsSvg(logo.icon.invert ? ON_DARK : {})}</g></svg>\n`
  );
}

writeFileSync("docs/brand/mark.svg", markSvg({}));
writeFileSync("docs/brand/mark-dark.svg", markSvg(ON_DARK));
writeFileSync("docs/brand/icon.svg", iconSvg());

const ts = `// Generated by scripts/gen-icon.mjs from docs/brand/logo.json. Don't edit;
// change the logo in the Logo Lab, save its settings there and rerun
// \`npm run gen:icon\`.

export type MarkRole = "ink" | "corner" | "play";

export const MARK_VIEWBOX = "${viewBox}";

/** The app icon on a 1024 canvas (macOS grid): the tile, and where the
 *  mark sits on it. */
export const MARK_ICON = { off: ${icon.off}, tile: ${icon.tile}, rx: ${icon.rx}, transform: "${icon.transform}" };

export const MARK_PATHS: { d: string; role: MarkRole; transform?: string }[] = [
${shapes.map((s) => `  { d: "${s.d}", role: "${s.role}"${s.transform ? `, transform: "${s.transform}"` : ""} },`).join("\n")}
];
`;
writeFileSync("app/src/brand/markPaths.ts", ts);
console.log("wrote docs/brand/{mark,mark-dark,icon}.svg and app/src/brand/markPaths.ts");
