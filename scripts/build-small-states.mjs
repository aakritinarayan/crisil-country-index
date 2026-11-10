// Countries too small for the 110m map shapes are drawn as dots. This records a
// centre point for each one, taken from the detailed 50m shapes.
// Re-run: node scripts/build-small-states.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoCentroid, geoArea } from "d3-geo";
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const iso = read("data/iso-alpha3-to-numeric.json");
const byNum = Object.fromEntries(Object.entries(iso).map(([a, n]) => [n, a]));
const t110 = read("node_modules/world-atlas/countries-110m.json");
const t50 = read("node_modules/world-atlas/countries-50m.json");
const in110 = new Set(t110.objects.countries.geometries.map((g) => g.id).filter(Boolean));
const out = {};
for (const f of feature(t50, t50.objects.countries).features) {
  if (!f.id || in110.has(f.id) || !byNum[f.id]) continue;
  // largest polygon's centroid, so dots sit on the main island
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.map((c) => ({ type: "Polygon", coordinates: c })) : [f.geometry];
  const main = polys.sort((a, b) => geoArea(b) - geoArea(a))[0];
  const [lon, lat] = geoCentroid(main);
  out[byNum[f.id]] = [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];
}
// Not in either map file: placed by hand (capital).
out.TUV ??= [179.2, -8.52];
writeFileSync("data/small-states.json", JSON.stringify(out));
console.log(Object.keys(out).length, "small states:", Object.keys(out).join(" "));
