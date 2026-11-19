import type { PreviousPeriod } from "./types";

/* Ranking, in one place: the explorer, the rankings table and the previous-period comparison
 * all rank the same way. Pure (no server or React imports), so it is unit-tested
 * (tests/ranking). */

/** The workbook's composite option (meta.show_composite) — a measure beside the pillar ids. */
export const COMPOSITE = "__composite";

type Scored = { country_id: string; composite_score: number | null; scores: Record<string, number> };

/** A country's value on a measure (COMPOSITE or a pillar id). Missing stays missing. */
export const measureValue = (c: Scored, measure: string): number | null =>
  measure === COMPOSITE ? c.composite_score : c.scores[measure] ?? null;

/** Competition ranking, highest first: ties share a rank (1, 2, 2, 4). Countries without a
 *  value are not ranked (absent from the map), never ranked as zero. */
export function competitionRanks(entries: { id: string; v: number | null }[]): Map<string, number> {
  const sorted = entries.filter((e): e is { id: string; v: number } => e.v != null && Number.isFinite(e.v)).sort((a, b) => b.v - a.v);
  const ranks = new Map<string, number>();
  sorted.forEach((e, i) => ranks.set(e.id, i > 0 && sorted[i - 1].v === e.v ? ranks.get(sorted[i - 1].id)! : i + 1));
  return ranks;
}

export const ranksOn = (countries: Scored[], measure: string) =>
  competitionRanks(countries.map((c) => ({ id: c.country_id, v: measureValue(c, measure) })));

/** How a country's rank on one measure compares with the previous assessment period.
 *    previous  its rank then, on the same measure (null: no previous period, or not ranked then)
 *    movement  previous − current: positive = moved up, negative = moved down, 0 = unchanged;
 *              null whenever the comparison isn't valid (see `reason`) */
export type RankChange = { previous: number | null; previousOf: number; movement: number | null; reason: string | null };

export const NO_PREVIOUS = "Previous ranking unavailable — no earlier assessment period has been published.";

/** Comparison rule: a movement is shown only when both periods ranked exactly the same set of
 *  countries on this measure. When coverage changed (a country added or dropped), positions
 *  aren't like for like — the previous rank is still shown as it was published, but no
 *  movement is claimed. Which previous period qualifies at all (an earlier reporting period,
 *  real vs sample alike) is decided where it is read (lib/admin/history.ts). */
export function compareRanks(current: Scored[], previous: PreviousPeriod | null, measure: string): Map<string, RankChange> {
  const now = ranksOn(current, measure);
  const out = new Map<string, RankChange>();
  if (!previous) {
    for (const c of current) out.set(c.country_id, { previous: null, previousOf: 0, movement: null, reason: NO_PREVIOUS });
    return out;
  }
  const measured = measure === COMPOSITE || previous.pillars.includes(measure);
  const then = measured ? ranksOn(previous.countries, measure) : new Map<string, number>();
  const samePopulation = then.size === now.size && [...now.keys()].every((id) => then.has(id));
  for (const c of current) {
    const cur = now.get(c.country_id) ?? null;
    const prev = then.get(c.country_id) ?? null;
    const reason = !measured ? "This measure wasn’t part of the previous assessment."
      : prev == null ? "Not ranked on this measure in the previous assessment."
      : cur == null ? "Not ranked on this measure in this assessment."
      : !samePopulation ? "Movement not shown: the countries ranked on this measure changed since the previous assessment."
      : null;
    out.set(c.country_id, { previous: prev, previousOf: then.size, movement: reason ? null : prev! - cur!, reason });
  }
  return out;
}
