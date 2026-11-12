import { z } from "zod";
import type { Issue, Validation } from "@/lib/admin/types";
import type { RawRow, RawWorkbook } from "./parse";
import type { FAssessment, FCountry, FKpi, FPillar, FRoute, FSource, Framework, Level } from "./types";
import type { ScoreBand } from "@/lib/types";

/* Raw rows → a validated Framework, or the reasons it can't be one. This is what stops a bad
 * number reaching a public page: errors block the upload (nothing is saved as publishable);
 * warnings are recorded on the version and shown, but don't block publishing — like a dead
 * link or a score between the defined levels. Every issue names its tab, row and column. */

const ID = /^[a-z0-9][a-z0-9_]*$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const id = z.string().regex(ID, "Use lowercase letters, numbers and underscores only");
const num = z.string().trim().min(1, "Required").transform(Number).refine(Number.isFinite, "Must be a number");
const optNum = z.string().trim().transform((s) => (s === "" ? null : Number(s))).refine((n) => n === null || Number.isFinite(n), "Must be a number");
const yesNo = z.string().trim().toLowerCase().refine((s) => s === "yes" || s === "no", "Use yes or no").transform((s) => s === "yes");
const text = z.string();
const required = z.string().trim().min(1, "Required");

const schemas = {
  levels: z.object({ score: num, label: required }),
  bands: z.object({ min: num, max: num, label: required }),
  pillars: z.object({ pillar_id: id, name: required, weight: num, display_order: optNum, description: text, weight_rationale: text }),
  kpis: z.object({ kpi_id: id, pillar_id: id, name: required, weight: num, by_route: yesNo, group: text, display_order: optNum, description: text, anchor_high: text, anchor_moderate: text, anchor_low: text }),
  routes: z.object({ route_id: id, name: required, display_order: optNum }),
  countries: z.object({ country_id: id, name: required, iso_code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use the 3-letter ISO code, e.g. IND"), slug: z.string().trim().regex(SLUG, "Lowercase letters, numbers and hyphens"), display_order: optNum, summary: text }),
  assessments: z.object({ country_id: id, kpi_id: id, route_id: z.string().trim(), score: optNum, finding: text, rationale: text }),
  sources: z.object({ country_id: id, kpi_id: id, title: required, publisher: text, url: z.string().trim(), published_date: z.string().trim() }),
};

export function validate(wb: RawWorkbook): { framework: Framework | null; validation: Validation } {
  const errors: Issue[] = [], warnings: Issue[] = [];
  const err = (i: Issue) => errors.push(i), warn = (i: Issue) => warnings.push(i);

  // rows → typed records, field by field
  function rows<K extends keyof typeof schemas>(tab: K) {
    const out: (z.infer<(typeof schemas)[K]> & { _row: number })[] = [];
    for (const r of (wb.tabs[tab] ?? []) as RawRow[]) {
      const res = schemas[tab].safeParse(r.values);
      if (res.success) out.push({ ...(res.data as z.infer<(typeof schemas)[K]>), _row: r.row });
      else for (const e of res.error.issues) err({ code: `${tab}.invalid`, message: `${e.message}${r.values[String(e.path[0])] ? ` (found “${r.values[String(e.path[0])].slice(0, 40)}”)` : ""}.`, tab, row: r.row, column: String(e.path[0]) });
    }
    return out;
  }
  const unique = <T extends { _row: number }>(tab: string, list: T[], key: (x: T) => string, column: string) => {
    const seen = new Map<string, number>();
    for (const x of list) { const k = key(x); if (seen.has(k)) err({ code: `${tab}.duplicate`, message: `“${k}” appears more than once (also row ${seen.get(k)}).`, tab, row: x._row, column }); else seen.set(k, x._row); }
  };

  // meta
  const m = (f: string) => wb.meta[f]?.value ?? "";
  const metaRow = (f: string) => wb.meta[f]?.row;
  if (!m("index_name")) err({ code: "meta.required", message: "index_name is required.", tab: "meta", row: metaRow("index_name"), column: "value" });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m("as_of"))) err({ code: "meta.as_of", message: `as_of must be a reporting period like 2026-11 (found “${m("as_of")}”).`, tab: "meta", row: metaRow("as_of"), column: "value" });
  const scaleMin = Number(m("scale_min")), scaleMax = Number(m("scale_max"));
  if (!Number.isInteger(scaleMin) || !Number.isInteger(scaleMax) || scaleMin >= scaleMax) err({ code: "meta.scale", message: "scale_min and scale_max must be whole numbers with min below max (e.g. 1 and 5).", tab: "meta", row: metaRow("scale_min"), column: "value" });
  if (!/^(yes|no)$/i.test(m("show_composite"))) err({ code: "meta.show_composite", message: "show_composite must be yes or no.", tab: "meta", row: metaRow("show_composite"), column: "value" });

  const levels = rows("levels"), bands = rows("bands"), pillars = rows("pillars"), kpis = rows("kpis"),
    routes = rows("routes"), countries = rows("countries"), assessments = rows("assessments"), sources = rows("sources");

  for (const l of levels) if (!Number.isInteger(l.score) || l.score < scaleMin || l.score > scaleMax) err({ code: "levels.range", message: `Level ${l.score} is not a whole number on the scale ${scaleMin}–${scaleMax}.`, tab: "levels", row: l._row, column: "score" });
  if (!levels.length) err({ code: "levels.empty", message: "Define at least one level (e.g. 1 Low, 3 Moderate, 5 High).", tab: "levels" });

  // bands: cover 0–100, in order, no gaps or overlaps
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (!sorted.length) err({ code: "bands.empty", message: "Define the readiness bands for 0–100.", tab: "bands" });
  sorted.forEach((b, i) => {
    if (b.min > b.max) err({ code: "bands.order", message: `Band “${b.label}” has min above max.`, tab: "bands", row: b._row, column: "min" });
    if (i === 0 && b.min !== 0) err({ code: "bands.start", message: "The lowest band must start at 0.", tab: "bands", row: b._row, column: "min" });
    if (i > 0 && b.min !== sorted[i - 1].max + 1) err({ code: "bands.gap", message: `Band “${b.label}” should start at ${sorted[i - 1].max + 1}, right after “${sorted[i - 1].label}”.`, tab: "bands", row: b._row, column: "min" });
    if (i === sorted.length - 1 && b.max !== 100) err({ code: "bands.end", message: "The highest band must end at 100.", tab: "bands", row: b._row, column: "max" });
  });

  // pillars and their weights
  unique("pillars", pillars, (p) => p.pillar_id, "pillar_id");
  for (const p of pillars) if (p.weight <= 0) err({ code: "pillars.weight", message: "Pillar weight must be above 0.", tab: "pillars", row: p._row, column: "weight" });
  const total = pillars.reduce((t, p) => t + p.weight, 0);
  if (pillars.length && Math.abs(total - 100) > 0.01) err({ code: "pillars.total", message: `Pillar weights add up to ${+total.toFixed(2)}; they must add up to 100.`, tab: "pillars", column: "weight" });

  // KPIs: belong to a pillar; each pillar's weights sum to 1
  const pillarIds = new Set(pillars.map((p) => p.pillar_id));
  unique("kpis", kpis, (k) => k.kpi_id, "kpi_id");
  for (const k of kpis) {
    if (!pillarIds.has(k.pillar_id)) err({ code: "kpis.pillar", message: `Pillar “${k.pillar_id}” isn’t on the pillars tab.`, tab: "kpis", row: k._row, column: "pillar_id" });
    if (k.weight <= 0 || k.weight > 1) err({ code: "kpis.weight", message: "KPI weight must be above 0 and at most 1 (a share of its pillar).", tab: "kpis", row: k._row, column: "weight" });
  }
  for (const p of pillars) {
    const ks = kpis.filter((k) => k.pillar_id === p.pillar_id);
    if (!ks.length) { err({ code: "pillars.empty", message: `Pillar “${p.name}” has no KPIs.`, tab: "pillars", row: p._row, column: "pillar_id" }); continue; }
    const w = ks.reduce((t, k) => t + k.weight, 0);
    if (Math.abs(w - 1) > 0.001) err({ code: "kpis.total", message: `KPI weights in “${p.name}” add up to ${+w.toFixed(3)}; they must add up to 1.`, tab: "kpis", row: ks[0]._row, column: "weight" });
  }

  unique("routes", routes, (r) => r.route_id, "route_id");
  unique("countries", countries, (c) => c.country_id, "country_id");
  unique("countries", countries, (c) => c.slug, "slug");
  unique("countries", countries, (c) => c.iso_code, "iso_code");

  // assessments
  const kpiById = new Map(kpis.map((k) => [k.kpi_id, k]));
  const routeIds = new Set(routes.map((r) => r.route_id));
  const countryIds = new Set(countries.map((c) => c.country_id));
  const levelSet = new Set(levels.map((l) => l.score));
  unique("assessments", assessments, (a) => `${a.country_id} · ${a.kpi_id}${a.route_id ? ` · ${a.route_id}` : ""}`, "kpi_id");
  for (const a of assessments) {
    const at = { tab: "assessments", row: a._row };
    if (!countryIds.has(a.country_id)) err({ ...at, code: "assessments.country", message: `Country “${a.country_id}” isn’t on the countries tab.`, column: "country_id" });
    const k = kpiById.get(a.kpi_id);
    if (!k) { err({ ...at, code: "assessments.kpi", message: `KPI “${a.kpi_id}” isn’t on the kpis tab.`, column: "kpi_id" }); continue; }
    if (k.by_route && !a.route_id) err({ ...at, code: "assessments.route_missing", message: `“${k.name}” is scored per route: give a route_id.`, column: "route_id" });
    if (!k.by_route && a.route_id) err({ ...at, code: "assessments.route_unexpected", message: `“${k.name}” has a single score: leave route_id empty.`, column: "route_id" });
    if (a.route_id && !routeIds.has(a.route_id)) err({ ...at, code: "assessments.route", message: `Route “${a.route_id}” isn’t on the routes tab.`, column: "route_id" });
    if (a.score != null) {
      if (!Number.isInteger(a.score) || a.score < scaleMin || a.score > scaleMax) err({ ...at, code: "assessments.score", message: `Score ${a.score} is not a whole number from ${scaleMin} to ${scaleMax}. Leave it empty if the KPI can’t be assessed.`, column: "score" });
      else if (levelSet.size && !levelSet.has(a.score)) warn({ ...at, code: "assessments.between_levels", message: `Score ${a.score} is between the defined levels (${[...levelSet].sort().join(", ")}). Check it was intended.`, column: "score" });
      if (!a.rationale) err({ ...at, code: "assessments.rationale", message: "Every score needs a rationale.", column: "rationale" });
    } else {
      warn({ ...at, code: "assessments.not_assessed", message: "No score: this KPI is treated as not assessed and left out of the averages.", column: "score" });
      if (!a.rationale) warn({ ...at, code: "assessments.not_assessed_reason", message: "Say why it isn’t assessed in the rationale.", column: "rationale" });
    }
    if (/,\s*,?\s*$/.test(a.rationale)) warn({ ...at, code: "assessments.unfinished", message: "The rationale ends with a comma — it may be unfinished.", column: "rationale" });
  }
  // by-route KPIs: every route present for an assessed country
  for (const c of countries) {
    const mine = assessments.filter((a) => a.country_id === c.country_id);
    if (!mine.some((a) => a.score != null)) { if (countries.length) warn({ code: "countries.unscored", message: `${c.name} has no scores yet, so it won’t appear on the site.`, tab: "countries", row: c._row, column: "country_id" }); continue; }
    for (const k of kpis) {
      const rowsK = mine.filter((a) => a.kpi_id === k.kpi_id);
      if (!rowsK.length) { warn({ code: "assessments.kpi_missing", message: `${c.name} has no row for “${k.name}”; it is treated as not assessed.`, tab: "assessments" }); continue; }
      if (k.by_route) for (const r of routes) if (!rowsK.some((a) => a.route_id === r.route_id)) warn({ code: "assessments.route_row_missing", message: `${c.name} · “${k.name}” has no row for route “${r.name}”; it is left out of that KPI’s average.`, tab: "assessments" });
      if (rowsK.some((a) => a.score != null) && !sources.some((s) => s.country_id === c.country_id && s.kpi_id === k.kpi_id)) warn({ code: "sources.missing", message: `${c.name} · “${k.name}” has no sources listed.`, tab: "sources" });
    }
  }

  // sources
  for (const s of sources) {
    const at = { tab: "sources", row: s._row };
    if (!countryIds.has(s.country_id)) err({ ...at, code: "sources.country", message: `Country “${s.country_id}” isn’t on the countries tab.`, column: "country_id" });
    if (!kpiById.has(s.kpi_id)) err({ ...at, code: "sources.kpi", message: `KPI “${s.kpi_id}” isn’t on the kpis tab.`, column: "kpi_id" });
    if (s.url) { try { const u = new URL(s.url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { err({ ...at, code: "sources.url", message: `“${s.url.slice(0, 60)}” isn’t a web address (https://…).`, column: "url" }); } }
    if (s.published_date && !/^\d{4}-\d{2}-\d{2}$/.test(s.published_date)) err({ ...at, code: "sources.date", message: "published_date must be YYYY-MM-DD or empty.", column: "published_date" });
  }

  const validation: Validation = { passed: errors.length === 0, errors, warnings };
  if (errors.length) return { framework: null, validation };

  const order = (n: number | null, i: number) => n ?? i + 1;
  const framework: Framework = {
    meta: {
      index_name: m("index_name"), as_of: m("as_of"), intro: m("intro"), disclaimer: m("disclaimer"),
      methodology: { framework: m("methodology_framework"), scoring: m("methodology_scoring"), sources: m("methodology_sources"), assumptions: m("methodology_assumptions") },
      scale_min: scaleMin, scale_max: scaleMax,
      levels: levels.map((l): Level => ({ score: l.score, label: l.label })),
      bands: sorted.map((b): ScoreBand => ({ min: b.min, max: b.max, label: b.label })),
      show_composite: /^yes$/i.test(m("show_composite")),
      sample: false,
    },
    pillars: pillars.map(({ _row, ...p }, i): FPillar => { void _row; return { ...p, display_order: order(p.display_order, i) }; }),
    kpis: kpis.map(({ _row, ...k }, i): FKpi => { void _row; return { ...k, group: k.group || null, display_order: order(k.display_order, i) }; }),
    routes: routes.map(({ _row, ...r }, i): FRoute => { void _row; return { ...r, display_order: order(r.display_order, i) }; }),
    countries: countries.map(({ _row, ...c }, i): FCountry => { void _row; return { ...c, display_order: order(c.display_order, i) }; }),
    assessments: assessments.map(({ _row, ...a }): FAssessment => { void _row; return { ...a, route_id: a.route_id || null }; }),
    sources: sources.map(({ _row, ...s }): FSource => { void _row; return { ...s, route_id: null, published_date: s.published_date || null }; }),
  };
  return { framework, validation };
}
