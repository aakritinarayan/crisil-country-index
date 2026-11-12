import "server-only";
import globalSample from "@/data/sample-global.json";
import workbookSample from "@/data/sample-workbook.json";
import type { IndexSummary, Payload } from "./types";
import { cacheLife, cacheTag } from "next/cache";
import { readPublishedPayload } from "./admin/files";

export const INDEX_DATA_TAG = "index-data";

/** The bundled placeholder dataset. DATASET=workbook → the 3-country design workbook;
 *  anything else → the generated 196-country sample used to design for scale. */
export function sampleSnapshot(): Payload {
  return (process.env.DATASET === "workbook" ? workbookSample : globalSample) as Payload;
}

/* What the public site shows: the version published from the admin, or — until one has
 * been — the bundled sample. Cached and tagged "index-data" so public pages stay static;
 * publishing expires the tag (updateTag in the publish action) — that is the whole "go
 * live" mechanism (TECH_SPEC §3). Today the published version lives in the local store
 * (.data/admin); with MongoDB only the read inside changes. */
export async function getPublishedSnapshot(): Promise<Payload | null> {
  "use cache";
  cacheTag(INDEX_DATA_TAG);
  cacheLife("max");
  return (await readPublishedPayload()) ?? sampleSnapshot();
}

/** The sample-data notice shows while the data is placeholder: switched on by
 *  SHOW_SAMPLE_DATA_BANNER, and never for a real assessment (meta.sample === false). */
export const showSampleNotice = (meta: Pick<Payload["meta"], "sample">) => process.env.SHOW_SAMPLE_DATA_BANNER !== "false" && meta.sample !== false;

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

/** One country's scores, with — for framework data — the KPI evidence behind each pillar
 *  (definitions plus this country's KPI scores, per pillar). */
export function countryDetail(p: Payload, slug: string) {
  const country = p.countries.find((c) => c.slug === slug);
  if (!country) return null;
  const f = p.framework;
  const kpis = f ? {
    levels: f.levels, max: f.scale.max,
    byPillar: Object.fromEntries(p.pillars.map((pl) => [pl.pillar_id, f.kpis.filter((k) => k.pillar_id === pl.pillar_id)
      .map((def) => ({ def, score: f.kpi_scores.find((s) => s.country_id === country.country_id && s.kpi_id === def.kpi_id) ?? null }))])),
  } : null;
  return { country, scores: p.scores.filter((s) => s.country_id === country.country_id), kpis };
}
export type CountryDetail = NonNullable<ReturnType<typeof countryDetail>>;
