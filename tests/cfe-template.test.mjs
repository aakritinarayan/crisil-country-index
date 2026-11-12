// The template round-trip and the validation rules: what the admin hands out must read back
// unchanged, and each rule must name the tab, row and column of the problem.
import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildTemplate } from "../lib/cfe/template.ts";
import { readWorkbook } from "../lib/cfe/parse.ts";
import { validate } from "../lib/cfe/validate.ts";
import { framework } from "./fixture.mjs";

const roundTrip = async (f, edit) => {
  let buf = await buildTemplate(f);
  if (edit) { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); edit(wb); buf = Buffer.from(await wb.xlsx.writeBuffer()); }
  const { wb, issues } = await readWorkbook(buf);
  if (!wb) return { framework: null, validation: { passed: false, errors: issues, warnings: [] } };
  return validate(wb);
};
const codes = (list) => list.map((i) => i.code);

test("a template built from a framework reads back as the same framework", async () => {
  const { framework: back, validation } = await roundTrip(framework);
  assert.equal(validation.errors.length, 0, JSON.stringify(validation.errors));
  assert.deepEqual(back.pillars, framework.pillars);
  assert.deepEqual(back.kpis, framework.kpis);
  assert.deepEqual(back.assessments, framework.assessments);
  assert.equal(back.meta.as_of, "2026-11");
  // the fixture's 4 (between levels) and its unassessed KPI are warnings, not errors
  assert.ok(codes(validation.warnings).includes("assessments.not_assessed"));
});

test("weights that don't add up are errors", async () => {
  const { validation } = await roundTrip(framework, (wb) => {
    wb.getWorksheet("pillars").getCell("C2").value = 35;            // policy 30 → 35
    wb.getWorksheet("kpis").getCell("D2").value = 0.5;              // p1 0.4 → 0.5
  });
  assert.equal(validation.passed, false);
  assert.ok(codes(validation.errors).includes("pillars.total"));
  assert.ok(codes(validation.errors).includes("kpis.total"));
});

test("scores off the scale, missing rationale and bad references are errors with locations", async () => {
  const { validation } = await roundTrip(framework, (wb) => {
    const a = wb.getWorksheet("assessments");
    a.getCell("D2").value = 7;                                       // off the 1–5 scale
    a.getCell("F3").value = "";                                      // scored but no rationale
    a.getCell("C30").value = "";                                     // by-route KPI without route
    wb.getWorksheet("sources").getCell("E2").value = "javascript:alert(1)";
  });
  const byCode = Object.fromEntries(validation.errors.map((e) => [e.code, e]));
  assert.deepEqual([byCode["assessments.score"].tab, byCode["assessments.score"].row, byCode["assessments.score"].column], ["assessments", 2, "score"]);
  assert.ok(byCode["assessments.rationale"]);
  assert.ok(byCode["sources.url"]);
});

test("HTML in workbook text is stripped on ingest", async () => {
  const { framework: back } = await roundTrip(framework, (wb) => { wb.getWorksheet("assessments").getCell("F2").value = 'Fine <script>alert(1)</script><b>text</b>'; });
  assert.equal(back.assessments[0].rationale, "Fine alert(1)text");
});

test("a workbook that isn't the template is rejected before validation", async () => {
  const { validation } = await roundTrip(framework, (wb) => wb.removeWorksheet(wb.getWorksheet("kpis").id));
  assert.ok(codes(validation.errors).includes("tab.missing"));
});
