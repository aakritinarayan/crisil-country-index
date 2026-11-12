// One-off conversion of the client's working assessment sheet (a country tab plus a
// "Scoring methodology" tab) into the framework data shape
// (lib/cfe/types.ts). Its output pre-fills the upload template; from then on analysts edit
// the template, not this layout.
//
//   node scripts/cfe-import.mjs "<crisil workbook>.xlsx" [out.json]
//
// The output contains client data: it is written under .data/ (git-ignored) by default.
// Conversion rules, applied verbatim from the sheet unless noted:
//   - KPI rows = rows with a weight in column B below a pillar row (pillar weight in B).
//   - By-route KPIs: score pairs in F/G, H/I, J/K, L/M, N/O, P/Q (route names in row 2).
//   - Other KPIs: text in E, score in R.
//   - A score of 0 is outside the 1–5 scale and means "not assessed" (the sheet's own note
//     says the data is not publicly available) → stored as no score, not zero.
//   - "Finding – rationale" text is split at the first " - " or ": " when the lead is short.
//   - Sources (column U): one per line, "Publisher - title or URL".
import ExcelJS from "exceljs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [input, outArg] = process.argv.slice(2);
if (!input) { console.error('Usage: node scripts/cfe-import.mjs "<workbook>.xlsx" [out.json]'); process.exit(1); }
const out = outArg ?? path.join(".data", "cfe", "framework.json");

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(input);

const text = (v) => {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return text(v.result);
    if ("text" in v) return String(v.text);
  }
  return String(v);
};
const clean = (s) => text(s).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\s+$/g, "").trim();
const num = (v) => { const t = text(v).trim(); return t === "" ? null : Number(t); };
const slug = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** "Available and viable - An established route…" → finding + rationale. */
function split(s) {
  const m = s.match(/^(.{3,70}?)(?:\s+-\s+|:\s+)([\s\S]+)$/);
  return m && !/[.!?]$/.test(m[1]) ? { finding: m[1].trim(), rationale: m[2].trim() } : { finding: "", rationale: s };
}

/** "5 = broad suite…; 3 = several…; 1 = very limited" → anchors. */
function anchors(s) {
  const a = { high: "", moderate: "", low: "" };
  for (const m of s.matchAll(/([135])\s*=\s*([^;]+?)(?=;?\s*[135]\s*=|$)/g)) a[{ 5: "high", 3: "moderate", 1: "low" }[m[1]]] = m[2].trim().replace(/[;.]$/, "").trim();
  return a;
}

function sources(cell) {
  return clean(cell).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const url = l.match(/https?:\/\/\S+/)?.[0] ?? "";
    const [lead, ...rest] = l.replace(url, "").split(/\s+-\s+/);
    const publisher = url && !rest.length ? lead.trim() : lead.trim();
    const title = rest.join(" - ").trim() || (url ? new URL(url).hostname.replace(/^www\./, "") : lead.trim());
    return { title, publisher: publisher === title ? "" : publisher, url, published_date: null };
  });
}

// pillar weight rationales, in order
const method = wb.getWorksheet("Scoring methodology");
const rationales = [];
method.eachRow((row, i) => { if (i > 1 && clean(row.getCell(1).value)) rationales.push({ name: clean(row.getCell(1).value), weight: num(row.getCell(2).value), text: clean(row.getCell(3).value) }); });

const sheet = wb.worksheets.find((w) => !["Framework", "Scoring methodology"].includes(w.name));
const countryName = sheet.name.trim();
const ROUTE_COLS = [["F", "G"], ["H", "I"], ["J", "K"], ["L", "M"], ["N", "O"], ["P", "Q"]];
const routes = ROUTE_COLS.map(([c], i) => {
  const name = clean(sheet.getCell(`${c}2`).value).replace(/\s*\(.*?\)\s*$/, "");
  return { route_id: slug(name), name, display_order: i + 1 };
});

// Engagement-specific settings (markets, index name, methodology wording) are client
// material: they live in git-ignored .data/cfe/import-settings.json, not in this script.
const settings = JSON.parse(await readFile(path.join(".data", "cfe", "import-settings.json"), "utf8").catch(() => "{}"));
const COUNTRIES = (settings.countries ?? []).map((c, i) => ({ ...c, display_order: i + 1, summary: "" }));
const country = COUNTRIES.find((c) => c.name === countryName);
if (!country) throw new Error(`Sheet "${countryName}" isn’t in .data/cfe/import-settings.json countries`);

const pillars = [], kpis = [], assessments = [], srcs = [];
let pillar = null, group = null;
for (let r = 2; r <= sheet.rowCount; r++) {
  const a = clean(sheet.getCell(`A${r}`).value), b = num(sheet.getCell(`B${r}`).value);
  if (!a) continue;
  if (/^[IVX]+\.\s/.test(a)) {
    const name = a.replace(/^[IVX]+\.\s*/, "").trim();
    const why = rationales.find((x) => x.name.toLowerCase() === name.toLowerCase());
    pillar = { pillar_id: slug(name), name, description: "", weight: b, weight_rationale: why?.text ?? "", display_order: pillars.length + 1 };
    pillars.push(pillar); group = null; continue;
  }
  if (/^\d+\.\s/.test(a)) { group = a.replace(/^\d+\.\s*/, "").trim(); continue; }
  if (b == null || !pillar) continue;
  const name = a.replace(/\*+$/, "").trim();
  const byRoute = ROUTE_COLS.some(([, s]) => num(sheet.getCell(`${s}${r}`).value) != null);
  const an = anchors(clean(sheet.getCell(`D${r}`).value));
  const kpi = { kpi_id: slug(name), pillar_id: pillar.pillar_id, name, group, description: clean(sheet.getCell(`C${r}`).value), weight: b,
    anchor_high: an.high, anchor_moderate: an.moderate, anchor_low: an.low, by_route: byRoute, display_order: kpis.length + 1 };
  kpis.push(kpi);
  if (byRoute) {
    ROUTE_COLS.forEach(([d, s], i) => {
      const score = num(sheet.getCell(`${s}${r}`).value);
      assessments.push({ country_id: country.country_id, kpi_id: kpi.kpi_id, route_id: routes[i].route_id, score: score === 0 ? null : score, ...split(clean(sheet.getCell(`${d}${r}`).value)) });
    });
  } else {
    const score = num(sheet.getCell(`R${r}`).value);
    assessments.push({ country_id: country.country_id, kpi_id: kpi.kpi_id, route_id: null, score: score === 0 ? null : score, ...split(clean(sheet.getCell(`E${r}`).value)) });
  }
  for (const s of sources(sheet.getCell(`U${r}`).value)) srcs.push({ country_id: country.country_id, kpi_id: kpi.kpi_id, route_id: null, ...s });
}

const pillarList = pillars.map((p) => `${p.name} (${p.weight}%)`).join(", ");
const routeList = routes.map((x) => x.name).join(", ");
const fill = (t) => (t ?? "").replaceAll("{pillars}", pillarList).replaceAll("{routes}", routeList);
const m = settings.meta ?? {};
const framework = {
  meta: {
    index_name: m.index_name ?? "Country Index", as_of: m.as_of ?? new Date().toISOString().slice(0, 7),
    intro: fill(m.intro), disclaimer: m.disclaimer ?? "This index is not a credit rating.",
    methodology: { framework: fill(m.methodology?.framework), scoring: fill(m.methodology?.scoring), sources: fill(m.methodology?.sources), assumptions: fill(m.methodology?.assumptions) },
    scale_min: 1, scale_max: 5,
    levels: m.levels ?? [{ score: 1, label: "Low" }, { score: 3, label: "Moderate" }, { score: 5, label: "High" }],
    bands: m.bands ?? [{ min: 0, max: 39, label: "Low" }, { min: 40, max: 69, label: "Moderate" }, { min: 70, max: 100, label: "High" }],
    show_composite: true,
    sample: false,
  },
  pillars, kpis, routes, countries: COUNTRIES, assessments, sources: srcs,
};

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(framework, null, 2) + "\n");
console.log(`${countryName}: ${pillars.length} pillars, ${kpis.length} KPIs (${kpis.filter((k) => k.by_route).length} by route), ${assessments.length} assessments, ${srcs.length} sources → ${out}`);
