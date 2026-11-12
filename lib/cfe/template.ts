import ExcelJS from "exceljs";
import type { Framework } from "./types";

/* The upload template: one tab per kind of record, one record per row, columns matched by
 * header name (never by position). TABS is the single definition shared by the template
 * generator and the parser (lib/cfe/parse.ts), so they can't drift apart. */

export const TEMPLATE_VERSION = "cfe-1";

type Col = { key: string; header: string; width: number; wrap?: boolean; required?: boolean; note: string };
export type TabDef = { name: string; purpose: string; columns: Col[] };

const c = (key: string, width: number, note: string, opts: Partial<Col> = {}): Col => ({ key, header: key, width, note, ...opts });

export const TABS: TabDef[] = [
  { name: "meta", purpose: "Index settings and the text shown on the methodology page. One setting per row.", columns: [
    c("field", 26, "The setting's name. Don't change these.", { required: true }), c("value", 90, "Its value.", { wrap: true }),
  ] },
  { name: "levels", purpose: "The defined points on the KPI scale and their names (1 = Low, 3 = Moderate, 5 = High).", columns: [
    c("score", 10, "A whole number on the KPI scale.", { required: true }), c("label", 24, "Its name.", { required: true }),
  ] },
  { name: "bands", purpose: "Readiness bands for pillar and composite scores (0–100). Must cover 0–100 with no gaps or overlaps.", columns: [
    c("min", 10, "Lowest score in the band.", { required: true }), c("max", 10, "Highest score in the band.", { required: true }), c("label", 24, "The band's name.", { required: true }),
  ] },
  { name: "pillars", purpose: "The pillars and their weights. Weights must add up to 100.", columns: [
    c("pillar_id", 30, "Short ID: lowercase letters, numbers and underscores. Used to link KPIs.", { required: true }),
    c("name", 36, "Name shown on the site.", { required: true }), c("weight", 10, "Weight out of 100.", { required: true }),
    c("display_order", 14, "Order on the site (1, 2, 3…)."), c("description", 60, "One or two sentences describing the pillar.", { wrap: true }),
    c("weight_rationale", 60, "Why the pillar has this weight.", { wrap: true }),
  ] },
  { name: "kpis", purpose: "The KPIs in each pillar. A pillar's KPI weights must add up to 1.", columns: [
    c("kpi_id", 34, "Short ID: lowercase letters, numbers and underscores.", { required: true }),
    c("pillar_id", 30, "The pillar it belongs to (from the pillars tab).", { required: true }),
    c("name", 40, "Name shown on the site.", { required: true }), c("weight", 10, "Share of its pillar, e.g. 0.4.", { required: true }),
    c("by_route", 11, "yes = scored once per procurement route and averaged; no = one score.", { required: true }),
    c("group", 22, "Optional sub-heading inside the pillar."), c("display_order", 14, "Order on the site."),
    c("description", 60, "What the KPI assesses.", { wrap: true }),
    c("anchor_high", 40, "What a score of 5 means.", { wrap: true }), c("anchor_moderate", 40, "What a score of 3 means.", { wrap: true }), c("anchor_low", 40, "What a score of 1 means.", { wrap: true }),
  ] },
  { name: "routes", purpose: "The corporate procurement routes used by by-route KPIs.", columns: [
    c("route_id", 24, "Short ID.", { required: true }), c("name", 30, "Name shown on the site.", { required: true }), c("display_order", 14, "Order on the site."),
  ] },
  { name: "countries", purpose: "Countries in the index. A country with no scores yet is listed but not shown on the site.", columns: [
    c("country_id", 20, "Short ID.", { required: true }), c("name", 24, "Name shown on the site.", { required: true }),
    c("iso_code", 10, "ISO 3166-1 alpha-3 code, e.g. IND.", { required: true }), c("slug", 20, "Web address part, e.g. india.", { required: true }),
    c("display_order", 14, "Order where ties need one."), c("summary", 60, "Optional short summary.", { wrap: true }),
  ] },
  { name: "assessments", purpose: "The scores. One row per country and KPI — or per country, KPI and route for by-route KPIs. Leave score empty if the KPI can't be assessed (it is excluded, not counted as zero).", columns: [
    c("country_id", 18, "From the countries tab.", { required: true }), c("kpi_id", 34, "From the kpis tab.", { required: true }),
    c("route_id", 22, "From the routes tab — only for by-route KPIs, otherwise empty."), c("score", 9, "Whole number on the KPI scale (1, 3 or 5), or empty if not assessed."),
    c("finding", 30, "Short verdict, e.g. Available and viable."), c("rationale", 90, "The evidence behind the score. Required for every score.", { wrap: true }),
  ] },
  { name: "sources", purpose: "Sources cited for a country's KPI. One source per row.", columns: [
    c("country_id", 18, "From the countries tab.", { required: true }), c("kpi_id", 34, "From the kpis tab.", { required: true }),
    c("title", 50, "Title of the document or page.", { required: true, wrap: true }), c("publisher", 24, "Who published it."),
    c("url", 50, "Web address (https://…), if it is online."), c("published_date", 16, "Optional, YYYY-MM-DD."),
  ] },
];

export const META_FIELDS = ["template_version", "index_name", "as_of", "intro", "disclaimer", "scale_min", "scale_max", "show_composite", "sample_data",
  "methodology_framework", "methodology_scoring", "methodology_sources", "methodology_assumptions"] as const;

const yes = (b: boolean) => (b ? "yes" : "no");

/** Build the template workbook, filled with `f` (the latest version, or the converted
 *  assessment), or with headers only when there is nothing to start from. */
export async function buildTemplate(f: Framework | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Country Index admin";
  wb.created = new Date();

  const readme = wb.addWorksheet("README");
  readme.columns = [{ width: 18 }, { width: 110 }];
  readme.addRow(["Country Index — assessment workbook", ""]).font = { bold: true, size: 14 };
  readme.addRow(["", "Fill in the tabs below, then upload this file in the admin (Upload data). It is checked before anything can be published; every problem is listed with its tab, row and column."]);
  readme.addRow(["", "Columns are matched by their header name — don't rename headers. Add rows freely; leave unused rows empty. Scores are calculated by the site from these values: don't add totals or formulas."]);
  readme.addRow([]);
  for (const t of TABS) {
    readme.addRow([t.name, t.purpose]).getCell(1).font = { bold: true };
    for (const col of t.columns) readme.addRow(["", `${col.header}${col.required ? " (required)" : ""} — ${col.note}`]);
    readme.addRow([]);
  }
  readme.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  const sheets = new Map<string, ExcelJS.Worksheet>();
  for (const t of TABS) {
    const ws = wb.addWorksheet(t.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = t.columns.map((col) => ({ header: col.header, key: col.key, width: col.width, style: col.wrap ? { alignment: { wrapText: true, vertical: "top" } } : { alignment: { vertical: "top" } } }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF353535" } };
    t.columns.forEach((col, i) => { head.getCell(i + 1).note = col.note; });
    sheets.set(t.name, ws);
  }

  if (f) {
    const m = f.meta;
    const meta: [string, string | number][] = [
      ["template_version", TEMPLATE_VERSION], ["index_name", m.index_name], ["as_of", m.as_of], ["intro", m.intro], ["disclaimer", m.disclaimer],
      ["scale_min", m.scale_min], ["scale_max", m.scale_max], ["show_composite", yes(m.show_composite)], ["sample_data", yes(m.sample)],
      ["methodology_framework", m.methodology.framework], ["methodology_scoring", m.methodology.scoring],
      ["methodology_sources", m.methodology.sources], ["methodology_assumptions", m.methodology.assumptions],
    ];
    meta.forEach(([field, value]) => sheets.get("meta")!.addRow({ field, value }));
    m.levels.forEach((l) => sheets.get("levels")!.addRow(l));
    m.bands.forEach((b) => sheets.get("bands")!.addRow(b));
    f.pillars.forEach((p) => sheets.get("pillars")!.addRow(p));
    f.kpis.forEach((k) => sheets.get("kpis")!.addRow({ ...k, by_route: yes(k.by_route), group: k.group ?? "" }));
    f.routes.forEach((r) => sheets.get("routes")!.addRow(r));
    f.countries.forEach((r) => sheets.get("countries")!.addRow(r));
    f.assessments.forEach((a) => sheets.get("assessments")!.addRow({ ...a, route_id: a.route_id ?? "", score: a.score ?? "" }));
    f.sources.forEach((s) => sheets.get("sources")!.addRow({ ...s, published_date: s.published_date ?? "" }));
  } else {
    META_FIELDS.forEach((field) => sheets.get("meta")!.addRow({ field, value: field === "template_version" ? TEMPLATE_VERSION : "" }));
  }

  // Dropdowns so IDs can't be mistyped (ranges cover room to grow)
  const list = (tab: string, col: string) => [`'${tab}'!$${col}$2:$${col}$500`];
  const rows = 2000;
  const assess = sheets.get("assessments")!, srcs = sheets.get("sources")!, kpis = sheets.get("kpis")!;
  for (let r = 2; r <= rows; r++) {
    assess.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: list("countries", "A") };
    assess.getCell(`B${r}`).dataValidation = { type: "list", allowBlank: true, formulae: list("kpis", "A") };
    assess.getCell(`C${r}`).dataValidation = { type: "list", allowBlank: true, formulae: list("routes", "A") };
    assess.getCell(`D${r}`).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1, 5], showErrorMessage: true, errorTitle: "Score", error: "Use a whole number from 1 to 5, or leave empty if not assessed." };
    if (r <= 500) {
      srcs.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: list("countries", "A") };
      srcs.getCell(`B${r}`).dataValidation = { type: "list", allowBlank: true, formulae: list("kpis", "A") };
      kpis.getCell(`B${r}`).dataValidation = { type: "list", allowBlank: true, formulae: list("pillars", "A") };
      kpis.getCell(`E${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"yes,no"'] };
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
