import "server-only";
import globalSample from "@/data/sample-global.json";
import workbookSample from "@/data/sample-workbook.json";
import type { IndexSummary, Payload } from "./types";

/* Design-phase data source. Later this becomes the cached read of the published
 * snapshot from MongoDB (TECH_SPEC §3) — callers do not change.
 * DATASET=workbook → the real 3-country workbook; anything else → the generated
 * 196-country sample used to design for scale. */
export async function getPublishedSnapshot(): Promise<Payload | null> {
  return (process.env.DATASET === "workbook" ? workbookSample : globalSample) as Payload;
}

const composite = (p: Payload, cid: string) => {
  const c = p.countries.find((x) => x.country_id === cid)!;
  if (c.composite_score != null) return c.composite_score;
  const s = p.scores.filter((x) => x.country_id === cid);
  return s.reduce((t, x) => t + x.score, 0) / s.length;
};

export function summarise(p: Payload): IndexSummary {
  const pillars = [...p.pillars].sort((a, b) => a.display_order - b.display_order);
  const byCountry = new Map<string, Record<string, number>>();
  for (const s of p.scores) {
    const row = byCountry.get(s.country_id) ?? {};
    row[s.pillar_id] = s.score;
    byCountry.set(s.country_id, row);
  }
  const ranked = [...p.countries]
    .map((c) => ({ ...c, composite_score: Math.round(composite(p, c.country_id) * 10) / 10 }))
    .sort((a, b) => b.composite_score - a.composite_score || a.display_order - b.display_order);
  // Competition ranking: ties share a rank (1, 2, 2, 4).
  let prev: number | null = null;
  let rank = 0;
  const countries = ranked.map((c, i) => {
    if (c.composite_score !== prev) rank = i + 1;
    prev = c.composite_score;
    return { ...c, rank, summary: "", scores: byCountry.get(c.country_id) ?? {} };
  });
  return { meta: p.meta, pillars, countries };
}

export function countryDetail(p: Payload, slug: string) {
  const country = p.countries.find((c) => c.slug === slug);
  if (!country) return null;
  return { country, scores: p.scores.filter((s) => s.country_id === country.country_id) };
}
