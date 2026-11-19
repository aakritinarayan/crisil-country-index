import "server-only";
import type { Payload, PreviousPeriod } from "@/lib/types";
import { backend, dataSource } from "./source";

/* The previous comparable assessment period, for the rankings' "Previous ranking" and
 * "Movement vs. previous". Read from stored versions only — never inferred from current
 * scores. A period qualifies when:
 *   - it was published at some point (published_at set) — a never-published upload isn't a
 *     period anyone saw;
 *   - its reporting period (as_of) is earlier than the one shown — a re-publish within the same
 *     period is a correction, not a previous assessment;
 *   - it is the same kind of data: real against real, sample against sample — a real
 *     assessment is never compared with the fictional 196-country sample.
 * Of those, the latest period wins, and within it the version published last. Whether a
 * movement can be claimed for a measure (same ranked countries) is lib/ranking.ts. The
 * demonstration history (lib/admin/demo.ts) has no stored data and never counts. */
export async function readPreviousPeriod(current: Payload): Promise<PreviousPeriod | null> {
  if (dataSource() === "demo") return null;
  const store = backend();
  const { versions } = await store.load();
  const candidates = versions
    .filter((v) => v.published_at && v.as_of < current.meta.as_of && v.validation.passed)
    .sort((a, b) => b.as_of.localeCompare(a.as_of) || b.published_at!.localeCompare(a.published_at!));
  const sample = current.meta.sample !== false;
  for (const v of candidates) {
    const p = await store.readPayload(v.id);
    if (!p || (p.meta.sample !== false) !== sample) continue;
    return toPeriod(p, v.version);
  }
  return null;
}

function toPeriod(p: Payload, version: number | null): PreviousPeriod {
  const scores = new Map<string, Record<string, number>>();
  for (const s of p.scores) scores.set(s.country_id, { ...scores.get(s.country_id), [s.pillar_id]: s.score });
  return {
    as_of: p.meta.as_of, version,
    pillars: p.pillars.map((x) => x.pillar_id),
    countries: p.countries.map((c) => ({ country_id: c.country_id, composite_score: c.composite_score, scores: scores.get(c.country_id) ?? {} })),
  };
}
