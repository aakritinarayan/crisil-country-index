// Ranking and the previous-period comparison (lib/ranking.ts): ties, missing scores, and when
// a movement may be claimed at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPOSITE, compareRanks, competitionRanks, NO_PREVIOUS } from "../lib/ranking.ts";

const c = (id, composite, scores = {}) => ({ country_id: id, composite_score: composite, scores });
const period = (countries, pillars = ["p1"]) => ({ as_of: "2026-05", version: 3, pillars, countries });

test("competition ranking: ties share a rank, missing values are not ranked", () => {
  const r = competitionRanks([{ id: "a", v: 50 }, { id: "b", v: 70 }, { id: "c", v: 50 }, { id: "d", v: null }, { id: "e", v: 10 }]);
  assert.deepEqual([...r.entries()], [["b", 1], ["a", 2], ["c", 2], ["e", 4]]);
  assert.equal(r.has("d"), false);
});

test("no previous period: every country gets no previous rank and no movement", () => {
  const m = compareRanks([c("ind", 60)], null, COMPOSITE);
  assert.deepEqual(m.get("ind"), { previous: null, previousOf: 0, movement: null, reason: NO_PREVIOUS });
});

test("movement = previous rank − current rank, on the active measure", () => {
  const now = [c("a", 80, { p1: 10 }), c("b", 70, { p1: 30 }), c("c", 60, { p1: 20 })];
  const then = period([c("a", 50, { p1: 10 }), c("b", 70, { p1: 30 }), c("c", 90, { p1: 20 })]);
  const comp = compareRanks(now, then, COMPOSITE);
  assert.deepEqual([comp.get("a").previous, comp.get("a").movement], [3, 2]);   // 3 → 1: up two
  assert.deepEqual([comp.get("b").previous, comp.get("b").movement], [2, 0]);   // unchanged
  assert.deepEqual([comp.get("c").previous, comp.get("c").movement], [1, -2]);  // 1 → 3: down two
  // the pillar ranking is its own: unchanged there
  const pil = compareRanks(now, then, "p1");
  assert.deepEqual(["a", "b", "c"].map((id) => pil.get(id).movement), [0, 0, 0]);
});

test("ties: movement uses the shared rank", () => {
  const now = [c("a", 50), c("b", 50), c("c", 40)];
  const then = period([c("a", 60), c("b", 40), c("c", 30)]);
  const m = compareRanks(now, then, COMPOSITE);
  assert.deepEqual(["a", "b", "c"].map((id) => [m.get(id).previous, m.get(id).movement]), [[1, 0], [2, 1], [3, 0]]);
});

test("a changed ranking population shows the previous rank but claims no movement", () => {
  const now = [c("ind", 60), c("idn", 55), c("phl", 50)];
  const then = period([c("ind", 40), c("idn", 70)]);
  const m = compareRanks(now, then, COMPOSITE);
  assert.equal(m.get("ind").previous, 2);
  assert.equal(m.get("ind").previousOf, 2);
  assert.equal(m.get("ind").movement, null);
  assert.match(m.get("ind").reason, /countries ranked/);
  assert.equal(m.get("phl").previous, null);
  assert.match(m.get("phl").reason, /Not ranked/);
});

test("a measure the previous period didn't have is not compared", () => {
  const m = compareRanks([c("a", 50, { p2: 40 })], period([c("a", 50, { p1: 40 })], ["p1"]), "p2");
  assert.equal(m.get("a").movement, null);
  assert.match(m.get("a").reason, /wasn’t part/);
});
