import type { KpiScore, Payload, Reference, Score } from "@/lib/types";
import type { Framework } from "./types";

/* Framework → the payload the site renders. The method is Crisil's, as the workbook's own
 * formulas apply it (country sheet):
 *   by-route KPI     KPI score = mean of its route scores                (R = AVERAGE(G,I,K,M,O,Q))
 *   pillar (1–5)     Σ KPI score × KPI weight                             (S = R × B; SUM(S))
 *   pillar (0–100)   pillar (1–5) ÷ 5 × 100      — shown as a 0–100 score  (T = S ÷ 5 × pillar weight)
 *   composite        Σ pillar (0–100) × pillar weight ÷ Σ pillar weights
 * with one difference agreed with the client: a KPI that is not assessed (no score) is left
 * out and its pillar's other KPI weights are scaled up to fill the gap, instead of counting
 * as zero (Crisil's stated approach to missing data, Framework sheet I27). */

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;

export type PillarResult = { pillar_id: string; score1to5: number | null; score: number | null; assessed: number; total: number };
export type CountryResult = { country_id: string; pillars: PillarResult[]; composite: number | null; kpis: Map<string, number | null> };

/** Scores for one country, at every level. */
export function scoreCountry(f: Framework, countryId: string): CountryResult {
  const mine = f.assessments.filter((a) => a.country_id === countryId);
  const kpis = new Map<string, number | null>();
  for (const k of f.kpis) {
    const rows = mine.filter((a) => a.kpi_id === k.kpi_id);
    const scores = (k.by_route ? rows.filter((a) => a.route_id) : rows.filter((a) => !a.route_id)).map((a) => a.score).filter((s): s is number => s != null);
    kpis.set(k.kpi_id, scores.length ? mean(scores) : null);
  }
  const pillars = f.pillars.map((p) => {
    const ks = f.kpis.filter((k) => k.pillar_id === p.pillar_id);
    const scored = ks.filter((k) => kpis.get(k.kpi_id) != null);
    const w = scored.reduce((t, k) => t + k.weight, 0);
    const s = w > 0 ? scored.reduce((t, k) => t + kpis.get(k.kpi_id)! * k.weight, 0) / w : null;
    return { pillar_id: p.pillar_id, score1to5: s, score: s == null ? null : (s / f.meta.scale_max) * 100, assessed: scored.length, total: ks.length };
  });
  const scoredPillars = pillars.filter((p) => p.score != null);
  const W = scoredPillars.reduce((t, p) => t + f.pillars.find((x) => x.pillar_id === p.pillar_id)!.weight, 0);
  const composite = W > 0 ? scoredPillars.reduce((t, p) => t + p.score! * f.pillars.find((x) => x.pillar_id === p.pillar_id)!.weight, 0) / W : null;
  return { country_id: countryId, pillars, composite, kpis };
}

const refsFor = (f: Framework, countryId: string, kpiId: string): Reference[] =>
  f.sources.filter((s) => s.country_id === countryId && s.kpi_id === kpiId)
    .map((s) => ({ title: s.title, publisher: s.publisher, url: s.url, published_date: s.published_date }));

/** The full payload. Countries with no assessments at all are left out of the index (they
 *  appear once they are scored). */
export function toPayload(f: Framework): Payload {
  const byOrder = <T extends { display_order: number }>(xs: T[]) => [...xs].sort((a, b) => a.display_order - b.display_order);
  const assessed = byOrder(f.countries).filter((c) => f.assessments.some((a) => a.country_id === c.country_id && a.score != null));
  const routes = byOrder(f.routes);
  const totalWeight = f.pillars.reduce((t, p) => t + p.weight, 0);

  const scores: Score[] = [];
  const kpiScores: KpiScore[] = [];
  const countries = assessed.map((c) => {
    const r = scoreCountry(f, c.country_id);
    for (const p of r.pillars) {
      if (p.score == null) continue;
      const kpiIds = f.kpis.filter((k) => k.pillar_id === p.pillar_id).map((k) => k.kpi_id);
      const refs = kpiIds.flatMap((id) => refsFor(f, c.country_id, id));
      const unique = refs.filter((x, i) => refs.findIndex((y) => y.url === x.url && y.title === x.title) === i);
      scores.push({ country_id: c.country_id, pillar_id: p.pillar_id, score: round(p.score), rationale: "", references: unique });
    }
    for (const k of f.kpis) {
      const rows = f.assessments.filter((a) => a.country_id === c.country_id && a.kpi_id === k.kpi_id);
      const single = rows.find((a) => !a.route_id);
      kpiScores.push({
        country_id: c.country_id, kpi_id: k.kpi_id,
        score: r.kpis.get(k.kpi_id) == null ? null : round(r.kpis.get(k.kpi_id)!, 2),
        finding: k.by_route ? "" : single?.finding ?? "", rationale: k.by_route ? "" : single?.rationale ?? "",
        routes: k.by_route ? routes.map((rt) => {
          const a = rows.find((x) => x.route_id === rt.route_id);
          return { route_id: rt.route_id, name: rt.name, score: a?.score ?? null, finding: a?.finding ?? "", rationale: a?.rationale ?? "" };
        }) : null,
        references: refsFor(f, c.country_id, k.kpi_id),
      });
    }
    return { country_id: c.country_id, name: c.name, iso_code: c.iso_code, slug: c.slug, display_order: c.display_order, summary: c.summary,
      composite_score: r.composite == null ? null : round(r.composite) };
  });

  return {
    meta: {
      index_name: f.meta.index_name, as_of: f.meta.as_of, intro: f.meta.intro, disclaimer: f.meta.disclaimer, methodology: f.meta.methodology,
      score_min: 0, score_max: 100, score_bands: f.meta.bands, show_composite: f.meta.show_composite, sample: f.meta.sample,
    },
    countries,
    pillars: byOrder(f.pillars).map((p) => ({ pillar_id: p.pillar_id, name: p.name, description: p.description, display_order: p.display_order,
      weight: totalWeight > 0 ? p.weight / totalWeight : null })),
    scores,
    framework: {
      scale: { min: f.meta.scale_min, max: f.meta.scale_max },
      levels: [...f.meta.levels].sort((a, b) => b.score - a.score),
      kpis: byOrder(f.kpis).map((k) => ({ kpi_id: k.kpi_id, pillar_id: k.pillar_id, name: k.name, group: k.group, description: k.description, weight: k.weight,
        anchors: { high: k.anchor_high, moderate: k.anchor_moderate, low: k.anchor_low }, by_route: k.by_route, display_order: k.display_order })),
      kpi_scores: kpiScores,
    },
  };
}
