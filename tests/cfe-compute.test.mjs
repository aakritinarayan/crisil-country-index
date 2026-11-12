// Checks lib/cfe/compute against what the client workbook's own formulas produce for the
// same inputs (S = R × B, T = S ÷ 5 × pillar weight), using an anonymised fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCountry, toPayload } from "../lib/cfe/compute.ts";
import { framework as f } from "./fixture.mjs";

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≠ ${b}`);

test("pillar scores match the workbook's formulas (T = S ÷ 5 × weight)", () => {
  const r = scoreCountry(f, "in");
  const p = Object.fromEntries(r.pillars.map((x) => [x.pillar_id, x]));
  close(p.policy.score1to5, 3.7083, "policy S8");          // as the workbook formula gives
  close(p.policy.score * 0.30, 22.25, "policy T8");         // as the workbook formula gives
  close(p.data.score * 0.15, 8.7, "data T21");              // as the workbook formula gives
  close(p.cfe.score * 0.30, 20.0, "cfe T27");               // as the workbook formula gives
});

test("a KPI that isn't assessed is excluded, not scored as zero", () => {
  const r = scoreCountry(f, "in");
  const m = r.pillars.find((x) => x.pillar_id === "market");
  close(m.score1to5, 2.7 / 0.7, "market, reweighted");      // counting it as 0 would give 2.7
  assert.equal(m.assessed, 3); assert.equal(m.total, 4);
  close(r.composite, 70.24, "composite");                   // counting it as 0 would give 64.45
});

test("payload: unassessed countries left out, 0–100 scores, KPI detail kept", () => {
  const p = toPayload(f);
  assert.deepEqual(p.countries.map((c) => c.country_id), ["in"]);
  assert.equal(p.countries[0].composite_score, 70.2);
  assert.equal(p.meta.score_max, 100);
  assert.equal(p.scores.find((s) => s.pillar_id === "policy").score, 74.2);
  close(p.pillars.reduce((t, x) => t + x.weight, 0), 1, "pillar weights as shares");
  const p1 = p.framework.kpi_scores.find((k) => k.kpi_id === "p1");
  assert.equal(p1.routes.length, 6); assert.equal(p1.score, 4);
  assert.equal(p.framework.kpi_scores.find((k) => k.kpi_id === "m1").score, null);
  assert.equal(p.scores.find((s) => s.pillar_id === "market").references.length, 1);
});
