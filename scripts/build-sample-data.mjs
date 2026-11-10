// Builds data/sample-global.json: a ~195-country stress-test payload used to design
// for scale (200+ countries). Scores are generated, deterministic and clearly sample —
// they are placeholders, not assessments. Re-run: node scripts/build-sample-data.mjs
import { readFileSync, writeFileSync } from "node:fs";

const iso = JSON.parse(readFileSync("data/iso-alpha3-to-numeric.json", "utf8"));
const geo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const workbook = JSON.parse(readFileSync("data/sample-workbook.json", "utf8"));

// Territories and dependencies are left out; the index covers countries.
const EXCLUDE = new Set(
  "ALA ASM AIA ATA ABW BES BMU BVT IOT CYM CXR CCK COK CUW FLK FRO GUF PYF ATF GIB GRL GLP GUM GGY HMD HKG IMN JEY MAC MTQ MYT MSR NCL NIU NFK MNP PCN PRI REU BLM SHN MAF SPM SXM SGS SJM TKL TCA UMI VGB VIR WLF ESH".split(" "),
);
// world-atlas abbreviates some names; use the full display name.
const NAMES = {
  MHL: "Marshall Islands", SSD: "South Sudan", SLB: "Solomon Islands", SWZ: "Eswatini",
  VCT: "Saint Vincent and the Grenadines", KNA: "Saint Kitts and Nevis", MKD: "North Macedonia",
  GNQ: "Equatorial Guinea", DOM: "Dominican Republic", COD: "Democratic Republic of the Congo",
  CAF: "Central African Republic", BIH: "Bosnia and Herzegovina", ATG: "Antigua and Barbuda",
  USA: "United States", TUR: "Türkiye", TUV: "Tuvalu", VAT: "Vatican City", STP: "São Tomé and Príncipe",
  FSM: "Micronesia", PSE: "Palestine", LCA: "Saint Lucia",
};

const geoName = Object.fromEntries(
  geo.objects.countries.geometries.filter((g) => g.id).map((g) => [g.id, g.properties.name]),
);
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// deterministic pseudo-random in [0,1) from a string
function rand(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const pillars = workbook.pillars;
const countries = Object.entries(iso)
  .filter(([a3]) => !EXCLUDE.has(a3))
  .map(([a3, num]) => ({ a3, name: NAMES[a3] ?? geoName[num] }))
  .filter((c) => c.name)
  .sort((a, b) => a.name.localeCompare(b.name));

const scores = [];
const out = countries.map((c, i) => {
  const id = slugify(c.name);
  // a country-level base with a spread that covers every band, then a per-pillar offset
  const base = 18 + 74 * Math.pow(rand(c.a3 + "base"), 0.85);
  const ps = pillars.map((p) => {
    const s = Math.round(clamp(base + (rand(c.a3 + p.pillar_id) - 0.5) * 26, 4, 98));
    scores.push({
      country_id: id, pillar_id: p.pillar_id, score: s,
      rationale: `${c.name}'s score for ${p.name.toLowerCase()} is a generated placeholder used to test how the dashboard handles a large index. It is not an assessment of ${c.name} and does not reflect real-world conditions. Final rationale text will come from the monthly workbook.`,
      references: [
        { title: "World Bank — Open Data", publisher: "World Bank", url: "https://data.worldbank.org", published_date: "2025-06-01" },
        { title: "ITU — ICT Statistics", publisher: "ITU", url: "https://www.itu.int/en/ITU-D/Statistics/Pages/stat/default.aspx", published_date: "2025-06-01" },
      ],
    });
    return s;
  });
  return {
    country_id: id, name: c.name, iso_code: c.a3, slug: id, display_order: i + 1,
    composite_score: Math.round((ps.reduce((t, v) => t + v, 0) / ps.length) * 10) / 10,
    summary: `This placeholder summary for ${c.name} is generated sample content used to test the dashboard at the scale of a global index. It does not reflect a completed assessment.`,
  };
});

const payload = {
  meta: {
    ...workbook.meta,
    intro: `The Digital Infrastructure Readiness Index compares digital infrastructure readiness across ${out.length} countries using ${pillars.length} pillars. All scores shown here are generated placeholder content for design and testing.`,
  },
  countries: out, pillars, scores,
};
writeFileSync("data/sample-global.json", JSON.stringify(payload));
console.log(`${out.length} countries, ${scores.length} scores`);
