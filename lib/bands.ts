import type { ScoreBand } from "./types";

/* Score → band. Thresholds and labels always come from meta.score_bands (the
 * workbook); only the colour ramp lives here, so a brand kit or a different number
 * of bands needs no component changes. TODO(decision): score format — numeric
 * 0–100 in five bands is the CONTEXT §5 default; a 1–5 scale is a workbook edit.
 *
 * Ramp: one calm five-step sequence, the same in both themes — mist sage → soft green →
 * sage green → muted teal → deep teal. Lightness strictly decreases so order reads without
 * hue; nothing is a saturated lime or a bright blue. Each step names the text colour that
 * passes WCAG AA on it (Advanced/white 4.6:1, Leading/white 7.0:1). The maps keep Limited
 * apart from the sea and from unassessed land by hue, coastlines and a hatch, not by
 * changing the band. Not red-to-green, per TECH_SPEC §10. */
const RAMP = [
  { fill: "#DCE8D6", ink: "#1F211C" },
  { fill: "#B5D4A0", ink: "#1F211C" },
  { fill: "#86B988", ink: "#1F211C" },
  { fill: "#378176", ink: "#FFFFFF" },
  { fill: "#17645E", ink: "#FFFFFF" },
] as const;

export type Band = ScoreBand & { index: number; fill: string; ink: string };

export function bandColour(index: number, count: number) {
  const step = count <= 1 ? 0 : Math.round((index * (RAMP.length - 1)) / (count - 1));
  return RAMP[step];
}

export function bandFor(score: number, bands: ScoreBand[]): Band {
  // Bands use whole-number edges (e.g. 0-39, 40-59). A decimal composite such as
  // 39.6 falls in the gap, so it is compared against the next band's minimum.
  let index = bands.findIndex((b, i) => score >= b.min && (i === bands.length - 1 || score < bands[i + 1].min));
  if (index === -1) index = score < bands[0].min ? 0 : bands.length - 1;
  return { ...bands[index], index, ...bandColour(index, bands.length) };
}

export function allBands(bands: ScoreBand[]): Band[] {
  return bands.map((b, i) => ({ ...b, index: i, ...bandColour(i, bands.length) }));
}

export const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function formatAsOf(asOf: string) {
  const [y, m] = asOf.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
