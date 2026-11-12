import type { ChangeSummary } from "@/lib/admin/types";
import type { Payload } from "@/lib/types";
import type { Framework } from "./types";

/* What an upload changes against the version that is live (FLOW §2: "the diff is the most
 * important thing on this screen"). Counts individual judgements (a route score is one),
 * and lists the largest movements in the scores people actually see: pillar scores, 0–100. */
export function diffFrameworks(before: { framework: Framework; payload: Payload; version: number | null }, after: { framework: Framework; payload: Payload }): ChangeSummary {
  const key = (a: { country_id: string; kpi_id: string; route_id: string | null }) => `${a.country_id}|${a.kpi_id}|${a.route_id ?? ""}`;
  const prev = new Map(before.framework.assessments.map((a) => [key(a), a]));
  let scores = 0, rationales = 0;
  for (const a of after.framework.assessments) {
    const b = prev.get(key(a));
    if (!b) { if (a.score != null) scores++; continue; }
    if (b.score !== a.score) scores++;
    if (b.rationale !== a.rationale || b.finding !== a.finding) rationales++;
  }
  const src = (f: Framework) => new Set(f.sources.map((s) => `${s.country_id}|${s.kpi_id}|${s.url || s.title}`));
  const s0 = src(before.framework), s1 = src(after.framework);
  const shown = (p: Payload) => new Set(p.countries.map((c) => c.country_id));
  const c0 = shown(before.payload), c1 = shown(after.payload);

  const name = (p: Payload, id: string) => p.countries.find((c) => c.country_id === id)?.name ?? id;
  const pillarName = (id: string) => after.payload.pillars.find((p) => p.pillar_id === id)?.name ?? before.payload.pillars.find((p) => p.pillar_id === id)?.name ?? id;
  const old = new Map(before.payload.scores.map((s) => [`${s.country_id}|${s.pillar_id}`, s.score]));
  const moves = after.payload.scores
    .filter((s) => old.has(`${s.country_id}|${s.pillar_id}`) && old.get(`${s.country_id}|${s.pillar_id}`) !== s.score)
    .map((s) => ({ country: name(after.payload, s.country_id), pillar: pillarName(s.pillar_id), before: old.get(`${s.country_id}|${s.pillar_id}`)!, after: s.score }))
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 6);

  return {
    against_version: before.version,
    scores_changed: scores,
    rationales_edited: rationales,
    sources_added: [...s1].filter((x) => !s0.has(x)).length,
    sources_removed: [...s0].filter((x) => !s1.has(x)).length,
    countries_added: [...c1].filter((x) => !c0.has(x)).length,
    countries_removed: [...c0].filter((x) => !c1.has(x)).length,
    largest_moves: moves,
  };
}
