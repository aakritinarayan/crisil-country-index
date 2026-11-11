import { allBands, bandFor, type Band } from "./bands";
import type { ScoreBand } from "./types";

export type BandShare = Band & { count: number; share: number; pct: number };

/** How a set of scores spreads across the workbook's bands. Each value is one country;
 *  missing scores are counted separately, never as a band. `share` is the exact fraction
 *  of scored countries; `pct` is a whole-number percentage, rounded by largest remainder
 *  so the displayed percentages always add up to exactly 100. */
export function distribution(values: (number | null | undefined)[], bands: ScoreBand[]) {
  const scored = values.filter((v): v is number => v != null && Number.isFinite(v));
  const all = allBands(bands);
  const counts = all.map(() => 0);
  for (const v of scored) counts[bandFor(v, bands).index]++;
  const total = scored.length;
  const raw = counts.map((c) => (total ? (c / total) * 100 : 0));
  const pct = raw.map(Math.floor);
  let left = total ? 100 - pct.reduce((a, b) => a + b, 0) : 0;
  [...raw.keys()].sort((a, b) => (raw[b] - pct[b]) - (raw[a] - pct[a])).forEach((i) => { if (left > 0 && counts[i] > 0) { pct[i]++; left--; } });
  return {
    bands: all.map((b, i): BandShare => ({ ...b, count: counts[i], share: total ? counts[i] / total : 0, pct: pct[i] })),
    total,
    missing: values.length - total,
  };
}
